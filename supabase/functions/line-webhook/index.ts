import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Credenciais do canal "Kaizen Barber ShopJP" na LINE Messaging API.
// Configuradas como secrets no Supabase (nunca ficam fixas no código).
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET");
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");

// Prefixo usado no link de vínculo (https://line.me/R/oaMessage/...) que
// pré-preenche a mensagem do cliente com "KZNLINK-<id do cliente>". Quando
// o cliente só aperta "enviar", recebemos essa mensagem aqui e associamos
// o ID dele no LINE ao cadastro certo — sem precisar perguntar nome/telefone.
const CODIGO_REGEX = /KZNLINK-([0-9a-fA-F-]{36})/;

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function assinaturaValida(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!LINE_CHANNEL_SECRET || !signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const esperado = bufferToBase64(mac);
  return esperado === signatureHeader;
}

async function responderLine(replyToken: string, texto: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: texto }],
    }),
  });
}

Deno.serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature");

    if (!(await assinaturaValida(rawBody, signature))) {
      console.warn("Assinatura do webhook da LINE inválida — requisição ignorada.");
      return new Response(JSON.stringify({ error: "assinatura inválida" }), { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventos = payload?.events ?? [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    for (const evento of eventos) {
      if (evento.type !== "message" || evento.message?.type !== "text") continue;

      const texto: string = evento.message.text ?? "";
      const lineUserId: string | undefined = evento.source?.userId;
      const replyToken: string | undefined = evento.replyToken;
      const match = texto.match(CODIGO_REGEX);

      if (!match || !lineUserId) {
        // Mensagem comum (não é o link de vínculo) — não faz nada automático,
        // só evita responder qualquer coisa fora do fluxo de vínculo.
        continue;
      }

      const clienteId = match[1];

      const { data: cliente, error: erroBusca } = await supabase
        .from("clientes")
        .select("id, nome, line_user_id")
        .eq("id", clienteId)
        .single();

      if (erroBusca || !cliente) {
        console.error("Cliente não encontrado para vínculo LINE:", clienteId, erroBusca);
        if (replyToken) {
          await responderLine(
            replyToken,
            "Não consegui encontrar seu cadastro automaticamente. Pode falar com a gente na barbearia que a gente resolve na hora!",
          );
        }
        continue;
      }

      const { error: erroUpdate } = await supabase
        .from("clientes")
        .update({ line_user_id: lineUserId })
        .eq("id", clienteId);

      if (erroUpdate) {
        console.error("Erro ao salvar line_user_id:", erroUpdate);
        continue;
      }

      const primeiroNome = (cliente.nome ?? "").trim().split(" ")[0] || "cliente";
      if (replyToken) {
        await responderLine(
          replyToken,
          `Perfeito, ${primeiroNome}! A partir de agora você recebe nossas promoções por aqui mesmo no LINE. Obrigado por confiar na Kaizen Barber Shop! 💈`,
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro inesperado no line-webhook:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
