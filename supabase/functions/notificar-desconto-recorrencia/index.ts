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

function montarMensagem(nomeCliente: string): string {
  const primeiroNome = (nomeCliente || "").trim().split(" ")[0] || "";
  return (
    `Oi${primeiroNome ? ", " + primeiroNome : ""}! Valeu pela visita hoje na Kaizen Barber Shop 💈 ` +
    `Se você marcar o próximo atendimento ainda hoje, garante 15% de desconto. ` +
    `Agende por aqui: https://app.kaizenbarbershop.com`
  );
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
      .select(`id, clientes ( nome, telefone )`)
      .eq("id", agendamento_id)
      .single();

    if (error || !agendamento) {
      console.error("Erro ao buscar agendamento:", error);
      return new Response(JSON.stringify({ error: "agendamento não encontrado" }), { status: 404 });
    }

    const cliente = (agendamento as any).clientes;
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

    const mensagem = montarMensagem(cliente?.nome ?? "");

    const corpo = new URLSearchParams({
      From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      To: `whatsapp:${telefone}`,
      Body: mensagem,
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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
