// ============================================================================
// stripe-webhook
//
// Recebe os eventos que o Stripe dispara (pagamento confirmado, falhou,
// assinatura cancelada etc.) e atualiza o status da empresa no banco. É essa
// função que liga/desliga automaticamente o acesso de cada barbearia cliente
// conforme o pagamento dela.
//
// Configurar no painel do Stripe (Developers → Webhooks) apontando para a
// URL desta função, escutando os eventos:
//   checkout.session.completed
//   invoice.payment_succeeded
//   invoice.payment_failed
//   customer.subscription.updated
//   customer.subscription.deleted
//
// Variáveis de ambiente necessárias:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   STRIPE_PRICE_BASICO_JPY / STRIPE_PRICE_BASICO_BRL
//   STRIPE_PRICE_INTERMEDIARIO_JPY / STRIPE_PRICE_INTERMEDIARIO_BRL
//   STRIPE_PRICE_COMPLETO_JPY / STRIPE_PRICE_COMPLETO_BRL
//   STRIPE_PRICE_ADICIONAL_JPY / STRIPE_PRICE_ADICIONAL_BRL
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injetadas automaticamente)
//
// Sobre inadimplência: quando uma cobrança falha, marcamos a empresa como
// "inadimplente" e guardamos em inadimplente_desde a data da PRIMEIRA falha
// (não reinicia a cada nova tentativa automática do Stripe). Uma rotina
// separada no banco (pg_cron, ver migration 012b) cancela automaticamente
// quem ficar inadimplente por mais de 35 dias.
// ============================================================================

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Mapeia cada price id de PLANO (Básico/Intermediário/Completo, nas duas
// moedas) pro nome do plano. O price id do "profissional adicional" fica de
// propósito FORA deste mapa — ver ADICIONAL_PRICE_IDS mais abaixo — assim
// dá pra distinguir, dentro dos itens de uma subscription, qual item é o
// plano e qual é o extra de profissional.
const PLANO_POR_PRICE_ID: Record<string, string> = {};
for (const [chaveEnv, plano] of [
  ["STRIPE_PRICE_BASICO_JPY", "basico"],
  ["STRIPE_PRICE_BASICO_BRL", "basico"],
  ["STRIPE_PRICE_INTERMEDIARIO_JPY", "intermediario"],
  ["STRIPE_PRICE_INTERMEDIARIO_BRL", "intermediario"],
  ["STRIPE_PRICE_COMPLETO_JPY", "completo"],
  ["STRIPE_PRICE_COMPLETO_BRL", "completo"],
] as const) {
  const priceId = Deno.env.get(chaveEnv);
  if (priceId) PLANO_POR_PRICE_ID[priceId] = plano;
}

const ADICIONAL_PRICE_IDS = new Set(
  [Deno.env.get("STRIPE_PRICE_ADICIONAL_JPY"), Deno.env.get("STRIPE_PRICE_ADICIONAL_BRL")]
    .filter((v): v is string => Boolean(v))
);

async function marcarStatus(empresaId: string, status: string, extra: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin
    .from("empresas")
    .update({ status, atualizado_em: new Date().toISOString(), ...extra })
    .eq("id", empresaId);
  if (error) console.error(`Falha ao atualizar empresa ${empresaId} para status=${status}:`, error.message);
  else console.log(`empresa ${empresaId} -> status=${status}`);
}

async function empresaIdPelaSubscription(subscriptionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return data?.id ?? null;
}

// Lê os itens de uma subscription e descobre (a) qual é o plano, pelo item
// cujo price bate com PLANO_POR_PRICE_ID, e (b) quantos profissionais
// adicionais tem contratado, pela quantity do item de "adicional" (se
// houver). Ignora qualquer outro item desconhecido em vez de assumir que o
// primeiro item da lista é sempre o plano — isso quebraria assim que a
// subscription passou a ter 2 itens (plano + adicional).
function interpretarItensDaSubscription(subscription: Stripe.Subscription) {
  let plano: string | undefined;
  let moeda: string | undefined;
  let profissionaisAdicionais = 0;

  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    if (PLANO_POR_PRICE_ID[priceId]) {
      plano = PLANO_POR_PRICE_ID[priceId];
      moeda = item.price.currency;
    } else if (ADICIONAL_PRICE_IDS.has(priceId)) {
      profissionaisAdicionais = item.quantity ?? 0;
    }
  }

  return { plano, moeda, profissionaisAdicionais };
}

Deno.serve(async (req) => {
  const assinatura = req.headers.get("stripe-signature");
  const corpoBruto = await req.text();

  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(corpoBruto, assinatura!, webhookSecret);
  } catch (erro) {
    console.error("Assinatura do webhook inválida:", erro);
    return new Response(`Webhook signature inválida: ${erro instanceof Error ? erro.message : erro}`, { status: 400 });
  }

  try {
    switch (evento.type) {
      // Cliente terminou o checkout e a primeira cobrança foi feita.
      case "checkout.session.completed": {
        const session = evento.data.object as Stripe.Checkout.Session;
        const empresaId = session.metadata?.empresa_id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (empresaId && subscriptionId) {
          const extra: Record<string, unknown> = {
            stripe_subscription_id: subscriptionId,
            inadimplente_desde: null,
            observacao_status: null,
          };
          if (session.metadata?.moeda) extra.moeda = session.metadata.moeda;
          if (session.metadata?.profissionais_adicionais) {
            extra.profissionais_extras = Number.parseInt(session.metadata.profissionais_adicionais, 10) || 0;
          }
          await marcarStatus(empresaId, "ativo", extra);
        }
        break;
      }

      // Cobrança recorrente (mês seguinte) bem-sucedida — mantém ativo e
      // limpa qualquer marca de inadimplência anterior (o cliente pagou).
      case "invoice.payment_succeeded": {
        const invoice = evento.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const empresaId = await empresaIdPelaSubscription(subscriptionId);
          if (empresaId) {
            await marcarStatus(empresaId, "ativo", { inadimplente_desde: null, observacao_status: null });
          }
        }
        break;
      }

      // Cobrança falhou (cartão recusado etc.) — desativa o acesso até
      // resolver. Guarda a data da PRIMEIRA falha em inadimplente_desde,
      // sem reiniciar a contagem a cada nova tentativa automática do
      // Stripe — é essa data que a rotina de 35 dias (pg_cron) usa depois
      // pra cancelar automaticamente quem não resolver.
      case "invoice.payment_failed": {
        const invoice = evento.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const empresaId = await empresaIdPelaSubscription(subscriptionId);
          if (empresaId) {
            const { data: atual } = await supabaseAdmin
              .from("empresas")
              .select("inadimplente_desde")
              .eq("id", empresaId)
              .maybeSingle();
            const extra: Record<string, unknown> = {};
            if (!atual?.inadimplente_desde) extra.inadimplente_desde = new Date().toISOString();
            await marcarStatus(empresaId, "inadimplente", extra);
          }
        }
        break;
      }

      // Assinatura cancelada de vez (pelo cliente ou por inadimplência prolongada).
      case "customer.subscription.deleted": {
        const subscription = evento.data.object as Stripe.Subscription;
        const empresaId = await empresaIdPelaSubscription(subscription.id);
        if (empresaId) await marcarStatus(empresaId, "cancelado");
        break;
      }

      // Troca de plano, de moeda, ou de quantidade de profissionais extras.
      case "customer.subscription.updated": {
        const subscription = evento.data.object as Stripe.Subscription;
        const { plano, moeda, profissionaisAdicionais } = interpretarItensDaSubscription(subscription);
        if (plano) {
          const empresaId = await empresaIdPelaSubscription(subscription.id);
          if (empresaId) {
            const atualizacao: Record<string, unknown> = { plano };
            if (moeda) atualizacao.moeda = moeda;
            atualizacao.profissionais_extras = plano === "completo" ? 0 : profissionaisAdicionais;
            await supabaseAdmin.from("empresas").update(atualizacao).eq("id", empresaId);
          }
        }
        break;
      }

      default:
        // Outros eventos do Stripe que não usamos — ignora sem erro.
        break;
    }
  } catch (erro) {
    console.error(`Erro processando evento ${evento.type}:`, erro);
    return new Response("Erro interno processando o evento", { status: 500 });
  }

  return new Response(JSON.stringify({ recebido: true }), { headers: { "Content-Type": "application/json" } });
});
