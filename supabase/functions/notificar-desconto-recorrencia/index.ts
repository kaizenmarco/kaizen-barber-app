import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Segredo compartilhado só entre o trigger do Postgres e esta função —
// não é uma credencial de terceiros, só evita que qualquer pessoa na
// internet consiga chamar esta função e disparar mensagens à toa.
const WEBHOOK_SECRET = "kzn_wh_desc15_01ab7fadfd1cd3ce507840650a2c9645";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
// Número do WhatsApp Business aprovado na Twilio (formato internacional,
// ex: +5511999999999). Fica vazio até a Twilio/Meta aprovarem o remetente —
// enquanto isso, a função só registra no log e não quebra nada.
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");

// SID do template de WhatsApp ("desconto_recorrencia_15_v2") aprovado pela
// Meta. Não é um segredo — é só o identificador do modelo de mensagem — por
// isso fica fixo aqui em vez de precisar configurar como secret no Supabase.
// Mensagens de WhatsApp iniciadas pela empresa (fora de uma janela de 24h em
// que o cliente mandou mensagem primeiro) só podem ser enviadas usando um
// template pré-aprovado — texto livre (Body) é recusado pela WhatsApp API
// nesse caso, por isso usamos ContentSid em vez de Body. Esse template (v2)
// tem o texto fixo pedido pelo Marco, sem variavel de nome do cliente.
const TWILIO_CONTENT_SID = "HXde94c28d3fd7f06f892a815dd73c05dc";

// Credenciais da conta oficial "Kaizen Barber ShopJP" no LINE. Diferente do
// WhatsApp, o LINE não exige template pré-aprovado pela Meta — a empresa pode
// mandar texto livre pra qualquer pessoa que já adicionou a conta como amiga.
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");

const MENSAGEM_DESCONTO_LINE =
  "Obrigado pela visita hoje na Kaizen Barber Shop! Garanta 15% de desconto no próximo corte se agendar ainda hoje: https://app.kaizenbarbershop.com";

async function enviarPorLine(lineUserId: string): Promise<boolean> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN não configurado — não dá pra mandar pelo LINE.");
    return false;
  }

  const resp = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: MENSAGEM_DESCONTO_LINE }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Erro ao enviar mensagem de desconto via LINE:", errText);
    return false;
  }

  return true;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "não autorizado" }), { status: 401 });
    }

    const { agendamento_id } = await req.json();
    if (!agendamento_id) {
      return new Response(JSON.stringify({ error: "agendamento_id ausente" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: agendamento, error } = await supabase
      .from("agendamentos")
      .select(`id, clientes ( nome, telefone, line_user_id )`)
      .eq("id", agendamento_id)
      .single();

    if (error || !agendamento) {
      console.error("Erro ao buscar agendamento:", error);
      return new Response(JSON.stringify({ error: "agendamento não encontrado" }), { status: 404 });
    }

    const cliente = (agendamento as any).clientes;
    const lineUserId: string | undefined = cliente?.line_user_id;

    // Prioridade: se o cliente já se vinculou ao LINE, manda por lá — é o
    // canal que ele escolheu e não tem o problema do número americano do
    // WhatsApp. Só cai pro WhatsApp se não tiver vínculo com o LINE.
    if (lineUserId) {
      const enviouPorLine = await enviarPorLine(lineUserId);
      if (enviouPorLine) {
        return new Response(JSON.stringify({ ok: true, canal: "line" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      console.warn("Falha ao enviar pelo LINE, tentando WhatsApp como alternativa:", agendamento_id);
    }

    const telefone: string | undefined = cliente?.telefone;

    if (!telefone || !telefone.startsWith("+")) {
      console.warn("Cliente sem telefone em formato internacional (+país) — não dá pra mandar WhatsApp:", agendamento_id);
      return new Response(JSON.stringify({ ok: false, motivo: "telefone_sem_formato_internacional" }), { status: 200 });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
      console.warn(
        "WhatsApp Business ainda não configurado (faltam TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM) — lembrete de 15% não enviado para:",
        agendamento_id
      );
      return new Response(JSON.stringify({ ok: false, motivo: "whatsapp_nao_configurado" }), { status: 200 });
    }

    const corpo = new URLSearchParams({
      From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      To: `whatsapp:${telefone}`,
      ContentSid: TWILIO_CONTENT_SID,
    });

    const twilioResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: corpo,
      }
    );

    if (!twilioResp.ok) {
      const errText = await twilioResp.text();
      console.error("Erro ao enviar WhatsApp via Twilio:", errText);
      return new Response(JSON.stringify({ error: "falha ao enviar whatsapp", detalhe: errText }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, canal: "whatsapp" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
