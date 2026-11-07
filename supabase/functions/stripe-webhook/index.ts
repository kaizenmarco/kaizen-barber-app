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
//   WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID
//   RESEND_API_KEY (já configurada neste projeto) / EMAIL_REMETENTE (opcional)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (injetadas automaticamente)
//
// Sobre inadimplência: quando uma cobrança falha, marcamos a empresa como
// "inadimplente" e guardamos em inadimplente_desde a data da PRIMEIRA falha
// (não reinicia a cada nova tentativa automática do Stripe). Uma rotina
// separada no banco (pg_cron, ver migration 012b) cancela automaticamente
// quem ficar inadimplente por mais de 35 dias. Na primeira falha, também
// disparamos um aviso pelo WhatsApp (modelo "aviso_pagamento_pendente",
// categoria Utilidade) pro telefone cadastrado da empresa.
//
// Sobre o login do dono (2026-09): até aqui, pagar criava a empresa mas
// NINGUÉM criava/vinculava automaticamente o login da pessoa que pagou —
// ela ficava travada numa tela de "conta não vinculada" até alguém rodar um
// UPDATE manual no banco. Agora, assim que o primeiro pagamento é
// confirmado (checkout.session.completed), a função:
//   1. Se já existe uma linha em usuarios com o e-mail de contato da
//      empresa (a pessoa já tinha criado login antes de pagar, pelo botão
//      "Ainda não tenho conta" do /painel), só vincula essa conta à
//      empresa (caso ainda não estivesse vinculada).
//   2. Senão, cria a conta automaticamente com supabase.auth.admin.
//      inviteUserByEmail — isso já dispara um e-mail de convite pro dono
//      definir a senha e acessar o /painel direto, sem precisar se
//      cadastrar de novo.
// Isso depende do envio de e-mail estar configurado no projeto (Supabase
// Auth → Emails). O serviço de e-mail padrão do Supabase tem um limite bem
// baixo de envios por hora, adequado só pra teste — antes de depender disso
// pra clientes de verdade, configurar um SMTP próprio em Project Settings →
// Auth → SMTP Settings. Se o e-mail não chegar, dá pra vincular manualmente
// pela tela de Super Admin (usa a função vincular-usuario-empresa).
//
// Sobre o e-mail de boas-vindas (2026-11): depois do login, manda pelo
// Resend um e-mail com o endereço do painel, os bônus liberados pelo plano
// (aba "Meus Bônus") e o WhatsApp do suporte. A trava é a coluna
// empresas.email_boas_vindas_enviado_em (supabase_email_boas_vindas.sql):
// só envia quem consegue preenchê-la, então evento repetido não duplica.
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

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_REMETENTE = Deno.env.get("EMAIL_REMETENTE") ?? "Kaizen Flow <onboarding@resend.dev>";
const URL_PAINEL = "https://painel.kaizenflowaplicativo.com";
const WHATSAPP_SUPORTE = "818097242512";

// Mesma regra da aba "Meus Bônus" (tenant/MeusBonus.jsx) e da política
// bonus_leitura_por_plano no Storage.
const BONUS_POR_PLANO: Record<string, string[]> = {
  basico: ["Implantação Kaizen"],
  intermediario: ["Implantação Kaizen", "Manual de Bolso da Equipe"],
  completo: ["Implantação Kaizen", "Manual de Bolso da Equipe", "Migração Sem Perder Histórico"],
};

const NOME_PLANO: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  completo: "Completo",
};

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

// Cria (se ainda não existir) o login do dono da empresa e garante que ele
// fica vinculado (usuarios.empresa_id) assim que o primeiro pagamento é
// confirmado. Nunca lança erro pra fora — se e-mail/convite falhar, isso
// não pode derrubar o processamento do webhook do Stripe (a empresa já foi
// marcada como ativa de qualquer forma; o vínculo pode ser feito depois,
// manualmente, pela tela de Super Admin).
async function garantirLoginDoDono(empresaId: string) {
  try {
    const { data: empresa } = await supabaseAdmin
      .from("empresas")
      .select("nome, email_contato")
      .eq("id", empresaId)
      .maybeSingle();

    const email = empresa?.email_contato;
    if (!email) {
      console.warn(`Empresa ${empresaId} sem email_contato — não dá pra criar/vincular login.`);
      return;
    }

    // Já existe uma conta com esse e-mail? (a pessoa pode ter se cadastrado
    // pelo /painel antes de pagar, ou isso pode ser um pagamento repetido).
    const { data: usuarioExistente } = await supabaseAdmin
      .from("usuarios")
      .select("id, empresa_id")
      .eq("email", email)
      .maybeSingle();

    if (usuarioExistente) {
      if (!usuarioExistente.empresa_id) {
        await supabaseAdmin.from("usuarios").update({ empresa_id: empresaId }).eq("id", usuarioExistente.id);
        console.log(`Login existente (${email}) vinculado à empresa ${empresaId}.`);
      }
      return;
    }

    // Não existe login ainda — cria a conta e dispara o e-mail de convite
    // (a pessoa define a senha dela e já cai vinculada à empresa).
    const { data: convite, error: erroConvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { nome: empresa?.nome || undefined },
    });

    if (erroConvite) {
      console.error(`Falha ao convidar ${email} pra empresa ${empresaId}:`, erroConvite.message);
      return;
    }

    const novoUsuarioId = convite?.user?.id;
    if (novoUsuarioId) {
      await supabaseAdmin.from("usuarios").update({ empresa_id: empresaId }).eq("id", novoUsuarioId);
      console.log(`Login criado e vinculado pra ${email} -> empresa ${empresaId}.`);
    }
  } catch (erro) {
    console.error(`Erro inesperado garantindo login do dono da empresa ${empresaId}:`, erro);
  }
}

function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// E-mail de boas-vindas (Resend): endereço do painel, bônus liberados pelo
// plano e suporte. Nunca lança erro pra fora, pelo mesmo motivo do
// garantirLoginDoDono. Se o envio falhar, solta a trava pra um evento
// repetido da Stripe poder tentar de novo.
async function enviarEmailBoasVindas(empresaId: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY não configurada — e-mail de boas-vindas não enviado.");
    return;
  }

  try {
    const { data: empresa } = await supabaseAdmin
      .from("empresas")
      .update({ email_boas_vindas_enviado_em: new Date().toISOString() })
      .eq("id", empresaId)
      .is("email_boas_vindas_enviado_em", null)
      .select("nome, email_contato, plano")
      .maybeSingle();

    if (!empresa) return; // já enviado antes (ou empresa não existe)

    if (!empresa.email_contato) {
      console.warn(`Empresa ${empresaId} sem email_contato — e-mail de boas-vindas não enviado.`);
      return;
    }

    const nome = escaparHtml(empresa.nome || "sua barbearia");
    const plano = NOME_PLANO[empresa.plano] ?? empresa.plano;
    const bonus = BONUS_POR_PLANO[empresa.plano] ?? BONUS_POR_PLANO.basico;
    const listaBonus = bonus.map((b) => `<li style="margin-bottom:6px;">${b}</li>`).join("");

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_REMETENTE,
        to: empresa.email_contato,
        subject: "Bem-vindo ao Kaizen Flow — seu acesso e seus bônus",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <div style="background:#121212; padding:24px; border-radius:10px 10px 0 0;">
              <div style="color:#d4af37; font-size:20px; font-weight:bold; letter-spacing:3px;">KAIZEN FLOW</div>
            </div>
            <div style="border:1px solid #e3ddcc; border-top:none; padding:24px; border-radius:0 0 10px 10px;">
              <h2 style="margin:0 0 12px;">Bem-vindo, ${nome}!</h2>
              <p>Sua assinatura do plano <strong>${plano}</strong> está ativa. Seu painel fica em:</p>
              <p style="text-align:center; margin:22px 0;">
                <a href="${URL_PAINEL}" style="background:#d4af37; color:#121212; font-weight:bold; padding:12px 24px; border-radius:6px; text-decoration:none;">Acessar meu painel</a>
              </p>
              <p style="font-size:13px; color:#555;">Entre com este e-mail. Se ainda não tem senha, procure o e-mail de convite que enviamos junto com este e use o link para criar a sua.</p>
              <h3 style="margin:24px 0 8px;">🎁 Seus bônus</h3>
              <ul style="padding-left:20px; margin:0 0 8px;">${listaBonus}</ul>
              <p style="font-size:13px; color:#555;">Estão em PDF no painel, na aba <strong>Meus Bônus</strong>. Comece pela Implantação Kaizen: em 5 passos sua barbearia fica pronta para receber agendamentos.</p>
              <p style="font-size:13px; color:#555; margin-top:24px;">Precisa de ajuda? Fale com o suporte pelo <a href="https://wa.me/${WHATSAPP_SUPORTE}" style="color:#9a7b1c;">WhatsApp</a>.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!resposta.ok) {
      console.error(`Falha ao enviar e-mail de boas-vindas pra empresa ${empresaId}:`, resposta.status, await resposta.text());
      await supabaseAdmin.from("empresas").update({ email_boas_vindas_enviado_em: null }).eq("id", empresaId);
      return;
    }
    console.log(`E-mail de boas-vindas enviado pra empresa ${empresaId}.`);
  } catch (erro) {
    console.error(`Erro inesperado enviando boas-vindas da empresa ${empresaId}:`, erro);
  }
}

// Envia o aviso de pagamento pendente pelo WhatsApp (modelo aprovado
// "aviso_pagamento_pendente", categoria Utilidade) pro telefone cadastrado
// da empresa. Nunca lança erro pra fora — se o WhatsApp falhar (número não
// cadastrado, template ainda não aprovado, token expirado etc.) isso não
// pode derrubar o processamento do webhook do Stripe.
async function enviarAvisoPagamentoPendente(empresaId: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados — aviso não enviado.");
    return;
  }

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("nome, telefone")
    .eq("id", empresaId)
    .maybeSingle();

  if (!empresa?.telefone) {
    console.warn(`Empresa ${empresaId} sem telefone cadastrado — aviso de pagamento não enviado.`);
    return;
  }

  const telefone = empresa.telefone.replace(/[^\d]/g, "");

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefone,
          type: "template",
          template: {
            name: "aviso_pagamento_pendente",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: empresa.nome || "cliente" }],
              },
            ],
          },
        }),
      }
    );

    if (!resposta.ok) {
      const corpoErro = await resposta.text();
      console.error(`Falha ao enviar WhatsApp pra empresa ${empresaId}:`, resposta.status, corpoErro);
    } else {
      console.log(`Aviso de pagamento pendente enviado por WhatsApp pra empresa ${empresaId}.`);
    }
  } catch (erro) {
    console.error(`Erro de rede enviando WhatsApp pra empresa ${empresaId}:`, erro);
  }
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
          await garantirLoginDoDono(empresaId);
          await enviarEmailBoasVindas(empresaId);
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
      // pra cancelar automaticamente quem não resolver. Só dispara o aviso
      // por WhatsApp na primeira falha, pra não ficar reenviando a cada
      // nova tentativa automática do Stripe pra mesma fatura.
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
            const primeiraFalha = !atual?.inadimplente_desde;
            const extra: Record<string, unknown> = {};
            if (primeiraFalha) extra.inadimplente_desde = new Date().toISOString();
            await marcarStatus(empresaId, "inadimplente", extra);
            if (primeiraFalha) await enviarAvisoPagamentoPendente(empresaId);
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
