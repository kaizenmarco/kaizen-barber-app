#!/usr/bin/env node
// ============================================================================
// stripe-copiar-para-producao.mjs
//
// Leva o Kaizen Flow do Stripe de TESTE (sandbox) para o Stripe REAL (live).
// Roda uma vez, no terminal do Marco, depois que a conta do Stripe for ativada:
//
//   STRIPE_TEST_KEY=sk_test_... STRIPE_LIVE_KEY=sk_live_... \
//     node scripts/stripe-copiar-para-producao.mjs
//
// O que faz (pode rodar de novo sem duplicar nada):
//   1. Descobre exatamente quais preços do sandbox o Kaizen Flow usa hoje,
//      comparando o SHA-256 de cada price id com o "digest" que o painel da
//      Supabase mostra para os secrets STRIPE_PRICE_* (DIGESTS abaixo).
//   2. Cria no modo real os mesmos produtos e preços (valor, moeda, recorrência).
//   3. Copia os cupons e códigos de promoção ativos (ex.: KAIZENAMIGO).
//   4. Cria o webhook real apontando para a função stripe-webhook do
//      kaizen-saas, nos 5 eventos que ela trata, fixado na API 2024-06-20
//      (a função lê invoice.subscription, que não existe nas versões novas).
//   5. Grava em ~/kaizen-stripe-producao.env (só você lê o arquivo) o bloco
//      pronto para colar em Supabase → Edge Functions → Secrets.
//
// Com --simular, só lê e mostra o que faria, sem criar nada.
// ============================================================================

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const VERSAO_API = "2024-06-20";
const URL_WEBHOOK = "https://bjrrgxfghwumhirvdpmx.supabase.co/functions/v1/stripe-webhook";
const EVENTOS_WEBHOOK = [
  "checkout.session.completed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
];
const ARQUIVO_SAIDA = join(homedir(), "kaizen-stripe-producao.env");

// SHA-256 dos valores atuais (sandbox) dos secrets, copiados do painel
// Supabase → kaizen-saas → Edge Functions → Secrets, em 07/11/2026.
const DIGESTS_REAIS = {
  STRIPE_PRICE_BASICO_JPY: "715f3f8832a8c1256befadc1dda8ae972b22b2c930e88557ffc0f6d9f825b006",
  STRIPE_PRICE_BASICO_BRL: "4267f58ae6ba1c25aeeec56a2f63226e70504a877fdf31cf873201406e7097cd",
  STRIPE_PRICE_INTERMEDIARIO_JPY: "bef1f3f2b8917fda232eeef1da9578e2971c5dc30b2c2529779c8a91694957d5",
  STRIPE_PRICE_INTERMEDIARIO_BRL: "5e5fd38f53de15a96d71603842e9b6b76fc91a3c86b96fbec63508b011ff14a2",
  STRIPE_PRICE_COMPLETO_JPY: "cf5be59052aa87eb9014ba49a145ff0c6c8edfd6dce7aef3bf56b62d5de4e87b",
  STRIPE_PRICE_COMPLETO_BRL: "e9a374013fbd0da61a42f78835ccbbdba6f96696d5c6788d03b4296b8b74008b",
  STRIPE_PRICE_ADICIONAL_JPY: "632e3fea8d37c0ea42701f6b251c467a35f371a888125fe580f2c775555b8f23",
  STRIPE_PRICE_ADICIONAL_BRL: "7261732a155f53ee2386f2874d8380ba5377a28e5ac887776238707e198720c6",
};
// Os testes automáticos trocam os digests (não dá para fabricar um price id
// com o mesmo SHA-256 dos reais).
const DIGESTS = process.env.KAIZEN_DIGESTS_TESTE ? JSON.parse(process.env.KAIZEN_DIGESTS_TESTE) : DIGESTS_REAIS;

const SIMULAR = process.argv.includes("--simular");
const API_BASE = process.env.STRIPE_API_BASE || "https://api.stripe.com"; // trocado só nos testes
const CHAVE_TESTE = process.env.STRIPE_TEST_KEY || "";
const CHAVE_REAL = process.env.STRIPE_LIVE_KEY || "";

function parar(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!/^(sk|rk)_test_/.test(CHAVE_TESTE)) parar("STRIPE_TEST_KEY precisa ser a chave secreta do sandbox (sk_test_...).");
if (!SIMULAR && !/^sk_live_/.test(CHAVE_REAL)) parar("STRIPE_LIVE_KEY precisa ser a chave secreta real (sk_live_...).");

// ---------------------------------------------------------------------------
// Cliente mínimo da API do Stripe (sem dependências)
// ---------------------------------------------------------------------------
function codificar(obj, prefixo = "", saida = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? codificar(item, `${chave}[${i}]`, saida) : saida.append(`${chave}[${i}]`, String(item))));
    else if (typeof v === "object") codificar(v, chave, saida);
    else saida.append(chave, String(v));
  }
  return saida;
}

function cliente(chave) {
  async function chamar(metodo, caminho, params = {}) {
    let url = `${API_BASE}/v1/${caminho}`;
    const opcoes = { method: metodo, headers: { Authorization: `Bearer ${chave}`, "Stripe-Version": VERSAO_API } };
    const corpo = codificar(params);
    if (metodo === "GET") { if ([...corpo].length) url += `?${corpo}`; }
    else { opcoes.body = corpo; opcoes.headers["Content-Type"] = "application/x-www-form-urlencoded"; }
    const resp = await fetch(url, opcoes);
    const json = await resp.json();
    if (!resp.ok) {
      const erro = new Error(`${metodo} ${caminho}: ${json?.error?.message || resp.status}`);
      erro.status = resp.status;
      throw erro;
    }
    return json;
  }
  async function listarTudo(caminho, params = {}) {
    const itens = [];
    let depoisDe;
    for (;;) {
      const pagina = await chamar("GET", caminho, { ...params, limit: 100, starting_after: depoisDe });
      itens.push(...pagina.data);
      if (!pagina.has_more || !pagina.data.length) return itens;
      depoisDe = pagina.data[pagina.data.length - 1].id;
    }
  }
  return { chamar, listarTudo };
}

const sha256 = (txt) => createHash("sha256").update(txt).digest("hex");
const teste = cliente(CHAVE_TESTE);
const real = SIMULAR ? null : cliente(CHAVE_REAL);
const sim = (txt) => console.log(`  ${SIMULAR ? "[simulação] " : ""}${txt}`);

// ---------------------------------------------------------------------------
// 1. Preços do sandbox que o Kaizen Flow usa
// ---------------------------------------------------------------------------
console.log("\n1. Lendo os preços do sandbox…");
const precosTeste = await teste.listarTudo("prices", { "expand[]": "data.product" });
const precoPorSecret = {};
for (const [secret, digest] of Object.entries(DIGESTS)) {
  const preco = precosTeste.find((p) => sha256(p.id) === digest);
  if (!preco) parar(`Não achei no sandbox o preço de ${secret}. A chave de teste é da conta certa ("New business")?`);
  precoPorSecret[secret] = preco;
  const valor = preco.currency === "jpy" ? preco.unit_amount : (preco.unit_amount / 100).toFixed(2);
  console.log(`  ${secret} = ${preco.id} · ${preco.product.name} · ${valor} ${preco.currency.toUpperCase()}/${preco.recurring?.interval ?? "único"}`);
}

// ---------------------------------------------------------------------------
// 2. Produtos e preços no modo real (marcados com metadata.origem_teste)
// ---------------------------------------------------------------------------
console.log("\n2. Produtos e preços no modo real…");
const produtosReais = real ? await real.listarTudo("products") : [];
const precosReais = real ? await real.listarTudo("prices") : [];
const produtoRealPorTeste = {};

async function garantirProduto(produtoTeste) {
  if (produtoRealPorTeste[produtoTeste.id]) return produtoRealPorTeste[produtoTeste.id];
  let produto = produtosReais.find((p) => p.metadata?.origem_teste === produtoTeste.id);
  if (produto) sim(`produto já existe: ${produto.name} (${produto.id})`);
  else if (SIMULAR) { sim(`criaria o produto "${produtoTeste.name}"`); produto = { id: `prod_novo_${produtoTeste.id}` }; }
  else {
    produto = await real.chamar("POST", "products", {
      name: produtoTeste.name,
      description: produtoTeste.description || undefined,
      metadata: { ...produtoTeste.metadata, origem_teste: produtoTeste.id },
    });
    sim(`produto criado: ${produto.name} (${produto.id})`);
  }
  produtoRealPorTeste[produtoTeste.id] = produto.id;
  return produto.id;
}

const novosSecrets = {};
for (const [secret, precoTeste] of Object.entries(precoPorSecret)) {
  const produtoId = await garantirProduto(precoTeste.product);
  let preco = precosReais.find((p) => p.metadata?.origem_teste === precoTeste.id && p.active);
  if (preco) sim(`preço já existe para ${secret}: ${preco.id}`);
  else if (SIMULAR) { sim(`criaria o preço de ${secret}`); preco = { id: "(novo)" }; }
  else {
    preco = await real.chamar("POST", "prices", {
      product: produtoId,
      currency: precoTeste.currency,
      unit_amount: precoTeste.unit_amount,
      nickname: precoTeste.nickname || undefined,
      tax_behavior: precoTeste.tax_behavior && precoTeste.tax_behavior !== "unspecified" ? precoTeste.tax_behavior : undefined,
      recurring: precoTeste.recurring
        ? { interval: precoTeste.recurring.interval, interval_count: precoTeste.recurring.interval_count }
        : undefined,
      metadata: { ...precoTeste.metadata, origem_teste: precoTeste.id },
    });
    sim(`preço criado para ${secret}: ${preco.id}`);
  }
  novosSecrets[secret] = preco.id;
}

// ---------------------------------------------------------------------------
// 3. Cupons e códigos de promoção ativos
// ---------------------------------------------------------------------------
console.log("\n3. Cupons e códigos de promoção…");
const cuponsTeste = (await teste.listarTudo("coupons", { "expand[]": "data.applies_to" })).filter((c) => c.valid);
for (const cupomTeste of cuponsTeste) {
  const produtosDoCupom = cupomTeste.applies_to?.products ?? [];
  const produtosReaisDoCupom = [];
  for (const prodTesteId of produtosDoCupom) {
    const produtoTeste = precosTeste.find((p) => p.product.id === prodTesteId)?.product
      ?? (await teste.chamar("GET", `products/${prodTesteId}`));
    produtosReaisDoCupom.push(await garantirProduto(produtoTeste));
  }

  let cupomReal = null;
  if (real) {
    try { cupomReal = await real.chamar("GET", `coupons/${encodeURIComponent(cupomTeste.id)}`); }
    catch (e) { if (e.status !== 404) throw e; }
  }
  if (cupomReal) sim(`cupom já existe: ${cupomTeste.name || cupomTeste.id}`);
  else if (SIMULAR) sim(`criaria o cupom "${cupomTeste.name || cupomTeste.id}"`);
  else {
    cupomReal = await real.chamar("POST", "coupons", {
      id: cupomTeste.id,
      name: cupomTeste.name || undefined,
      percent_off: cupomTeste.percent_off ?? undefined,
      amount_off: cupomTeste.amount_off ?? undefined,
      currency: cupomTeste.amount_off ? cupomTeste.currency : undefined,
      duration: cupomTeste.duration,
      duration_in_months: cupomTeste.duration === "repeating" ? cupomTeste.duration_in_months : undefined,
      max_redemptions: cupomTeste.max_redemptions ?? undefined,
      redeem_by: cupomTeste.redeem_by ?? undefined,
      applies_to: produtosReaisDoCupom.length ? { products: produtosReaisDoCupom } : undefined,
      metadata: { ...cupomTeste.metadata, origem_teste: cupomTeste.id },
    });
    sim(`cupom criado: ${cupomReal.name || cupomReal.id}`);
  }

  const codigosTeste = (await teste.listarTudo("promotion_codes", { coupon: cupomTeste.id, active: true }));
  for (const codigo of codigosTeste) {
    const existentes = real ? await real.listarTudo("promotion_codes", { code: codigo.code }) : [];
    if (existentes.length) { sim(`código já existe: ${codigo.code}`); continue; }
    if (SIMULAR) { sim(`criaria o código "${codigo.code}"`); continue; }
    await real.chamar("POST", "promotion_codes", {
      coupon: cupomReal.id,
      code: codigo.code,
      max_redemptions: codigo.max_redemptions ?? undefined,
      expires_at: codigo.expires_at ?? undefined,
      restrictions: {
        first_time_transaction: codigo.restrictions?.first_time_transaction || undefined,
        minimum_amount: codigo.restrictions?.minimum_amount ?? undefined,
        minimum_amount_currency: codigo.restrictions?.minimum_amount_currency ?? undefined,
      },
      metadata: { ...codigo.metadata, origem_teste: codigo.id },
    });
    sim(`código criado: ${codigo.code}`);
  }
}
if (!cuponsTeste.length) sim("nenhum cupom ativo no sandbox.");

// ---------------------------------------------------------------------------
// 4. Webhook real
// ---------------------------------------------------------------------------
console.log("\n4. Webhook real…");
let segredoWebhook = null;
const webhooksReais = real ? await real.listarTudo("webhook_endpoints") : [];
const webhookExistente = webhooksReais.find((w) => w.url === URL_WEBHOOK);
if (webhookExistente) {
  sim(`já existe (${webhookExistente.id}). O Stripe só mostra o segredo na criação: se você ainda não`);
  sim("guardou, pegue em Developers → Webhooks → esse destino → Signing secret.");
} else if (SIMULAR) {
  sim(`criaria o webhook ${URL_WEBHOOK} (API ${VERSAO_API}) com: ${EVENTOS_WEBHOOK.join(", ")}`);
} else {
  const webhook = await real.chamar("POST", "webhook_endpoints", {
    url: URL_WEBHOOK,
    enabled_events: EVENTOS_WEBHOOK,
    api_version: VERSAO_API,
    description: "Kaizen Flow — stripe-webhook (kaizen-saas)",
  });
  segredoWebhook = webhook.secret;
  sim(`webhook criado: ${webhook.id}`);
}

// ---------------------------------------------------------------------------
// 5. Bloco para colar na Supabase
// ---------------------------------------------------------------------------
if (SIMULAR) {
  console.log("\nSimulação concluída — nada foi criado. Rode sem --simular para valer.\n");
  process.exit(0);
}

const linhas = [
  `STRIPE_SECRET_KEY=${CHAVE_REAL}`,
  segredoWebhook ? `STRIPE_WEBHOOK_SECRET=${segredoWebhook}` : "# STRIPE_WEBHOOK_SECRET=  (pegue no painel do Stripe, ver passo 4 acima)",
  ...Object.entries(novosSecrets).map(([k, v]) => `${k}=${v}`),
];
writeFileSync(ARQUIVO_SAIDA, linhas.join("\n") + "\n", { mode: 0o600 });

console.log(`\n✔ Pronto. O bloco com os secrets está em ${ARQUIVO_SAIDA}`);
console.log("  Cole o conteúdo inteiro em Supabase → kaizen-saas → Edge Functions → Secrets");
console.log("  (campo \"paste key-value pairs\"), clique em Save e depois apague o arquivo.\n");
