// ============================================================================
// vale-presente
//
// Venda online do Vale Presente Kaizen (Stripe Checkout, pagamento único em
// ienes). Regras de negócio no banco: supabase/migrations/20261124_vale_presente.sql
//
// Ações (POST JSON, campo "acao"):
//   checkout  -> cria os vales "pendente" + Checkout Session e devolve a URL
//                body: { acao, itens:[{servico_id, quantidade}], nome_comprador,
//                        email, telefone, presenteados:[nomes], mensagem,
//                        idioma, origem }
//   confirmar -> chamado pela página de sucesso: confere no Stripe se o
//                pagamento foi feito, ativa os vales e devolve os códigos
//                body: { acao, pedido_id, session_id }
//
// Webhook (opcional, mesma URL): se vier o header stripe-signature e o
// secret STRIPE_WEBHOOK_SECRET_VALE estiver configurado, trata
// checkout.session.completed — garante a ativação mesmo se a pessoa fechar
// a aba antes de voltar pro site.
//
// Secrets: STRIPE_SECRET_KEY (já existe), STRIPE_WEBHOOK_SECRET_VALE (opcional)
// ============================================================================

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const ORIGEM_PADRAO = "https://app.kaizenbarbershop.com";
const MAX_VALES_POR_PEDIDO = 10;

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const hojeJapao = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function somarMesesMenosUmDia(dataIso: string, meses: number) {
  const [a, m, d] = dataIso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1 + meses, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function origemSegura(origem?: string) {
  if (!origem) return ORIGEM_PADRAO;
  try {
    const u = new URL(origem);
    if (u.hostname.endsWith("kaizenbarbershop.com") || u.hostname === "localhost") return u.origin;
  } catch (_) { /* ignora */ }
  return ORIGEM_PADRAO;
}

const limpar = (v: unknown, max = 120) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

async function carregarConfig() {
  const { data, error } = await supabase.from("config_vale_presente").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

// Ativa os vales do pedido (idempotente) e cria o bônus do comprador uma vez.
async function ativarPedido(pedidoId: string, session: Stripe.Checkout.Session) {
  const cfg = await carregarConfig();
  const hoje = hojeJapao();
  const expira = somarMesesMenosUmDia(hoje, cfg.validade_meses);

  await supabase
    .from("vales_presente")
    .update({ status: "ativo", pago_em: new Date().toISOString(), expira_em: expira, forma_pagamento: "cartao" })
    .eq("pedido_id", pedidoId)
    .eq("status", "pendente")
    .eq("tipo", "presente");

  const bonusPrometido = session.metadata?.bonus === "1";
  if (bonusPrometido) {
    const { data: jaTem } = await supabase
      .from("vales_presente").select("id").eq("pedido_id", pedidoId).eq("tipo", "bonus").limit(1);
    if (!jaTem?.length) {
      const { data: algum } = await supabase
        .from("vales_presente").select("nome_comprador, email_comprador, telefone_comprador")
        .eq("pedido_id", pedidoId).limit(1).maybeSingle();
      await supabase.from("vales_presente").insert({
        tipo: "bonus",
        valor: cfg.bonus_valor,
        valor_pago: 0,
        nome_presenteado: algum?.nome_comprador ?? null,
        nome_comprador: algum?.nome_comprador ?? null,
        email_comprador: algum?.email_comprador ?? null,
        telefone_comprador: algum?.telefone_comprador ?? null,
        origem: "stripe",
        status: "ativo",
        expira_em: cfg.bonus_expira_em ?? expira,
        pedido_id: pedidoId,
        stripe_session_id: session.id,
        pago_em: new Date().toISOString(),
      });
    }
  }
}

async function valesDoPedido(pedidoId: string) {
  const { data } = await supabase
    .from("vales_presente")
    .select("codigo, tipo, status, valor, nome_presenteado, expira_em, servicos(nome)")
    .eq("pedido_id", pedidoId)
    .order("tipo", { ascending: false })
    .order("criado_em");
  return (data ?? []).map((v: any) => ({ ...v, servico_nome: v.servicos?.nome ?? null, servicos: undefined }));
}

async function acaoCheckout(body: any) {
  const cfg = await carregarConfig();
  if (!cfg.venda_ativa) return json({ erro: "venda_encerrada" }, 400);

  const nome = limpar(body.nome_comprador, 80);
  const email = limpar(body.email, 120);
  const telefone = limpar(body.telefone, 30);
  if (!nome || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "dados_comprador" }, 400);

  const itens = Array.isArray(body.itens) ? body.itens : [];
  const permitidos: string[] = cfg.servico_ids ?? [];
  const { data: servicos } = await supabase
    .from("servicos").select("id, nome, preco, preco_minimo, ativo").in("id", permitidos);

  const linhas: { servico: any; qtd: number }[] = [];
  for (const it of itens) {
    const qtd = Math.floor(Number(it?.quantidade) || 0);
    const servico = (servicos ?? []).find((s: any) => s.id === it?.servico_id && s.ativo);
    if (qtd > 0 && servico) linhas.push({ servico, qtd });
  }
  const total = linhas.reduce((acc, l) => acc + l.qtd, 0);
  if (total < 1) return json({ erro: "sem_itens" }, 400);
  if (total > MAX_VALES_POR_PEDIDO) return json({ erro: "muitos_itens" }, 400);

  const combo = total >= cfg.combo_min_qtd && cfg.combo_pct > 0;
  const hoje = hojeJapao();
  const bonus = !!cfg.bonus_ativo && (!cfg.bonus_venda_ate || hoje <= cfg.bonus_venda_ate);
  const presenteados: string[] = Array.isArray(body.presenteados) ? body.presenteados : [];
  const mensagem = limpar(body.mensagem, 300);
  const pedidoId = crypto.randomUUID();

  const novos: any[] = [];
  let idx = 0;
  for (const l of linhas) {
    const preco = Number(l.servico.preco ?? l.servico.preco_minimo);
    const unit = combo ? Math.round(preco * (100 - cfg.combo_pct) / 100) : preco;
    for (let i = 0; i < l.qtd; i++) {
      novos.push({
        tipo: "presente",
        servico_id: l.servico.id,
        valor: preco,
        valor_pago: unit,
        nome_presenteado: limpar(presenteados[idx], 60),
        nome_comprador: nome,
        email_comprador: email,
        telefone_comprador: telefone,
        mensagem,
        origem: "stripe",
        status: "pendente",
        pedido_id: pedidoId,
      });
      idx++;
    }
  }

  const { error: erroInsert } = await supabase.from("vales_presente").insert(novos);
  if (erroInsert) throw erroInsert;

  const origem = origemSegura(body.origem);
  const idioma = ["ja", "en"].includes(body.idioma) ? body.idioma : "pt-BR";
  const nomeProduto = (servico: string) =>
    idioma === "ja" ? `Kaizen ギフト券 – ${servico}` : idioma === "en" ? `Kaizen Gift Card – ${servico}` : `Vale Presente Kaizen – ${servico}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    locale: idioma === "ja" ? "ja" : idioma === "en" ? "en" : "pt-BR",
    line_items: linhas.map((l) => {
      const preco = Number(l.servico.preco ?? l.servico.preco_minimo);
      const unit = combo ? Math.round(preco * (100 - cfg.combo_pct) / 100) : preco;
      return {
        quantity: l.qtd,
        price_data: {
          currency: "jpy",
          unit_amount: unit,
          product_data: { name: nomeProduto(l.servico.nome) },
        },
      };
    }),
    metadata: { tipo: "vale_presente", pedido_id: pedidoId, bonus: bonus ? "1" : "0" },
    payment_intent_data: { metadata: { tipo: "vale_presente", pedido_id: pedidoId } },
    success_url: `${origem}/valepresente/sucesso?pedido=${pedidoId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origem}/valepresente?cancelado=1`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });

  await supabase.from("vales_presente").update({ stripe_session_id: session.id }).eq("pedido_id", pedidoId);
  return json({ checkout_url: session.url, pedido_id: pedidoId });
}

async function acaoConfirmar(body: any) {
  const pedidoId = limpar(body.pedido_id, 60);
  const sessionId = limpar(body.session_id, 200);
  if (!pedidoId || !sessionId) return json({ erro: "parametros" }, 400);

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.pedido_id !== pedidoId) return json({ erro: "pedido_invalido" }, 403);
  if (session.payment_status !== "paid") return json({ ok: false, pago: false });

  await ativarPedido(pedidoId, session);
  return json({ ok: true, pago: true, vales: await valesDoPedido(pedidoId) });
}

async function tratarWebhook(req: Request) {
  const segredo = Deno.env.get("STRIPE_WEBHOOK_SECRET_VALE");
  if (!segredo) return new Response("webhook não configurado", { status: 400 });
  const corpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(corpo, req.headers.get("stripe-signature")!, segredo);
  } catch (e) {
    return new Response(`assinatura inválida: ${e instanceof Error ? e.message : e}`, { status: 400 });
  }
  if (evento.type === "checkout.session.completed" || evento.type === "checkout.session.async_payment_succeeded") {
    const session = evento.data.object as Stripe.Checkout.Session;
    if (session.metadata?.tipo === "vale_presente" && session.metadata?.pedido_id && session.payment_status === "paid") {
      await ativarPedido(session.metadata.pedido_id, session);
    }
  }
  return json({ recebido: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.headers.get("stripe-signature")) return await tratarWebhook(req);
    if (!Deno.env.get("STRIPE_SECRET_KEY")) return json({ erro: "pagamento_nao_configurado" }, 500);
    const body = await req.json();
    if (body?.acao === "checkout") return await acaoCheckout(body);
    if (body?.acao === "confirmar") return await acaoConfirmar(body);
    return json({ erro: "acao_invalida" }, 400);
  } catch (erro) {
    console.error(erro);
    return json({ erro: erro instanceof Error ? erro.message : "erro_inesperado" }, 500);
  }
});
