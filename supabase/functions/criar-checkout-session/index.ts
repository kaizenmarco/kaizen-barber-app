// ============================================================================
// criar-checkout-session
//
// Chamada pelo frontend (tela de cadastro / onboarding) quando uma barbearia
// escolhe um plano. Cria (se ainda não existir) a linha da empresa no banco
// com status "trial", cria/reaproveita o Customer no Stripe, abre uma
// Checkout Session de assinatura recorrente e devolve a URL para redirecionar
// o navegador. O pagamento em si acontece na página hospedada pelo Stripe —
// esta função nunca vê número de cartão.
//
// A partir de 2026-09, os planos têm preço PRÓPRIO por mercado (não é
// conversão automática de câmbio): Japão em ienes, Brasil em reais — porque
// o valor competitivo em cada mercado é diferente, não só o câmbio. Os
// planos Básico e Intermediário também aceitam profissionais extras além do
// incluído no plano, cobrados à parte; o Completo já inclui vários
// profissionais, sem cobrança adicional.
//
// Body esperado (JSON):
//   { nome_empresa, slug?, email_contato, plano, moeda, profissionais_adicionais? }
//   plano = "basico" | "intermediario" | "completo"
//   moeda = "jpy" | "brl"
//   profissionais_adicionais = número inteiro >= 0 (ignorado se plano = "completo")
//
// Variáveis de ambiente necessárias (Supabase → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_BASICO_JPY / STRIPE_PRICE_BASICO_BRL
//   STRIPE_PRICE_INTERMEDIARIO_JPY / STRIPE_PRICE_INTERMEDIARIO_BRL
//   STRIPE_PRICE_COMPLETO_JPY / STRIPE_PRICE_COMPLETO_BRL
//   STRIPE_PRICE_ADICIONAL_JPY / STRIPE_PRICE_ADICIONAL_BRL
//   APP_URL_SUCESSO (para onde o Stripe manda de volta após pagar)
//   APP_URL_CANCELADO
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injetadas automaticamente pelo Supabase)
// ============================================================================

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MOEDAS_VALIDAS = ["jpy", "brl"] as const;
type Moeda = (typeof MOEDAS_VALIDAS)[number];

const PRECO_POR_PLANO_E_MOEDA: Record<string, Record<Moeda, string | undefined>> = {
  basico: {
    jpy: Deno.env.get("STRIPE_PRICE_BASICO_JPY"),
    brl: Deno.env.get("STRIPE_PRICE_BASICO_BRL"),
  },
  intermediario: {
    jpy: Deno.env.get("STRIPE_PRICE_INTERMEDIARIO_JPY"),
    brl: Deno.env.get("STRIPE_PRICE_INTERMEDIARIO_BRL"),
  },
  completo: {
    jpy: Deno.env.get("STRIPE_PRICE_COMPLETO_JPY"),
    brl: Deno.env.get("STRIPE_PRICE_COMPLETO_BRL"),
  },
};

const PRECO_ADICIONAL_POR_MOEDA: Record<Moeda, string | undefined> = {
  jpy: Deno.env.get("STRIPE_PRICE_ADICIONAL_JPY"),
  brl: Deno.env.get("STRIPE_PRICE_ADICIONAL_BRL"),
};

// Limite de segurança — não é um limite real de negócio, só evita erro de
// digitação (ex: "999999999") virar uma cobrança absurda sem querer.
const MAXIMO_PROFISSIONAIS_ADICIONAIS = 50;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(texto: string): string {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const corpo = await req.json();
    const { nome_empresa, slug, email_contato, plano } = corpo;
    const moeda = (corpo.moeda ?? "jpy") as Moeda;
    let profissionaisAdicionais = Number.parseInt(corpo.profissionais_adicionais, 10);
    if (!Number.isFinite(profissionaisAdicionais) || profissionaisAdicionais < 0) {
      profissionaisAdicionais = 0;
    }
    profissionaisAdicionais = Math.min(profissionaisAdicionais, MAXIMO_PROFISSIONAIS_ADICIONAIS);
    // Completo já inclui vários profissionais — não cobra adicional.
    if (plano === "completo") profissionaisAdicionais = 0;

    if (!nome_empresa || !email_contato || !plano) {
      return new Response(
        JSON.stringify({ erro: "nome_empresa, email_contato e plano são obrigatórios." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!MOEDAS_VALIDAS.includes(moeda)) {
      return new Response(
        JSON.stringify({ erro: `Moeda inválida: ${moeda}. Use jpy ou brl.` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const priceIdPlano = PRECO_POR_PLANO_E_MOEDA[plano]?.[moeda];
    if (!priceIdPlano) {
      return new Response(
        JSON.stringify({ erro: `Plano inválido ou sem preço configurado para essa moeda: ${plano}/${moeda}.` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const priceIdAdicional = PRECO_ADICIONAL_POR_MOEDA[moeda];
    if (profissionaisAdicionais > 0 && !priceIdAdicional) {
      return new Response(
        JSON.stringify({ erro: `Preço de profissional adicional não configurado para a moeda ${moeda}.` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const slugFinal = slug ? slugify(slug) : slugify(nome_empresa);

    // Reaproveita a empresa se já existe uma linha "trial" pendente com esse
    // e-mail (ex: usuário voltou pra tentar pagar de novo); senão cria nova.
    let { data: empresa } = await supabaseAdmin
      .from("empresas")
      .select("id, stripe_customer_id")
      .eq("email_contato", email_contato)
      .eq("status", "trial")
      .maybeSingle();

    if (!empresa) {
      const { data: novaEmpresa, error: erroInsert } = await supabaseAdmin
        .from("empresas")
        .insert({
          nome: nome_empresa,
          slug: slugFinal,
          email_contato,
          plano,
          status: "trial",
          moeda,
          profissionais_extras: profissionaisAdicionais,
        })
        .select("id, stripe_customer_id")
        .single();

      if (erroInsert) {
        return new Response(
          JSON.stringify({ erro: `Não consegui criar a empresa: ${erroInsert.message}` }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
      empresa = novaEmpresa;
    } else {
      // Empresa já existia (tentativa anterior) — atualiza com a escolha atual.
      await supabaseAdmin
        .from("empresas")
        .update({ plano, moeda, profissionais_extras: profissionaisAdicionais })
        .eq("id", empresa.id);
    }

    // Customer no Stripe: reaproveita se já criamos antes, senão cria agora.
    let stripeCustomerId = empresa.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: nome_empresa,
        email: email_contato,
        metadata: { empresa_id: empresa.id },
      });
      stripeCustomerId = customer.id;
      await supabaseAdmin
        .from("empresas")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", empresa.id);
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceIdPlano, quantity: 1 },
    ];
    if (profissionaisAdicionais > 0 && priceIdAdicional) {
      lineItems.push({ price: priceIdAdicional, quantity: profissionaisAdicionais });
    }

    const metadataComum = {
      empresa_id: empresa.id,
      plano,
      moeda,
      profissionais_adicionais: String(profissionaisAdicionais),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      success_url: Deno.env.get("APP_URL_SUCESSO") ?? "https://example.com/sucesso",
      cancel_url: Deno.env.get("APP_URL_CANCELADO") ?? "https://example.com/cancelado",
      metadata: metadataComum,
      subscription_data: { metadata: metadataComum },
      locale: moeda === "brl" ? "pt-BR" : "auto",
    });

    return new Response(
      JSON.stringify({ checkout_url: session.url, empresa_id: empresa.id }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (erro) {
    console.error(erro);
    return new Response(
      JSON.stringify({ erro: erro instanceof Error ? erro.message : "Erro inesperado" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
