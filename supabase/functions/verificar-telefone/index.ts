import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Confirmação de telefone por SMS (Twilio Verify) no app público.
//
// Dois passos, chamados pelo site (ClientePublico.jsx):
//   { acao: "enviar",    telefone, idioma }                       -> manda o código por SMS
//   { acao: "confirmar", telefone, codigo, nome, email, data_nascimento }
//        -> confere o código, acha/cria o cliente e devolve um "token" que o
//           trigger exigir_telefone_verificado() exige pra aceitar o agendamento.
//
// Credenciais ficam nos secrets da função (Supabase > Edge Functions > Secrets):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID

const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

// Mesma lista de países do seletor no site (config/paisesTelefone.js).
// Restringir evita que alguém use a função pra disparar SMS caro pra
// qualquer lugar do mundo à nossa custa.
const PREFIXOS_PERMITIDOS = [
  "81", "55", "51", "63", "84", "1", "351", "591", "595", "54", "86", "82", "977", "62", "66", "34", "44",
];

// Limites de envio de SMS (cada SMS custa dinheiro).
const MAX_POR_TELEFONE_10MIN = 3;
const MAX_POR_TELEFONE_24H = 8;
const MAX_POR_IP_1H = 10;

// Por quanto tempo o telefone confirmado vale neste aparelho, sem pedir
// código de novo. 1 ano = na prática "confirma uma vez só" (pedido do
// Marco, pra economizar SMS); só pede de novo se trocar de celular ou
// limpar os dados do navegador.
const VALIDADE_TOKEN_DIAS = 365;

const LOCALE_TWILIO: Record<string, string> = { "pt-BR": "pt-BR", en: "en", ja: "ja", es: "es" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sempre 200 com { ok, erro } — assim o site lê o motivo direto, sem
// precisar decifrar o erro genérico do supabase.functions.invoke.
const responder = (corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { headers: { ...CORS, "Content-Type": "application/json" } });

const telefoneValido = (tel: string) =>
  /^\+[1-9]\d{7,14}$/.test(tel) && PREFIXOS_PERMITIDOS.some((p) => tel.startsWith(`+${p}`));

const ultimos9 = (tel: string | null) => (tel || "").replace(/\D/g, "").slice(-9);

async function twilio(caminho: string, params: Record<string, string>) {
  const resp = await fetch(`https://verify.twilio.com/v2/Services/${VERIFY_SID}/${caminho}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, json };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (!ACCOUNT_SID || !AUTH_TOKEN || !VERIFY_SID) {
      console.error("Secrets do Twilio não configurados.");
      return responder({ ok: false, erro: "nao_configurado" });
    }

    const corpo = await req.json();
    const acao = corpo?.acao;
    const telefone = String(corpo?.telefone || "").trim();

    if (!telefoneValido(telefone)) {
      return responder({ ok: false, erro: "telefone_invalido" });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (acao === "enviar") {
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
      const agora = Date.now();
      const desde = (ms: number) => new Date(agora - ms).toISOString();

      const [{ count: ultimos10min }, { count: ultimas24h }, { count: doIp }] = await Promise.all([
        supabase.from("verificacao_telefone_envios").select("id", { count: "exact", head: true })
          .eq("telefone", telefone).gte("criado_em", desde(10 * 60_000)),
        supabase.from("verificacao_telefone_envios").select("id", { count: "exact", head: true })
          .eq("telefone", telefone).gte("criado_em", desde(24 * 3600_000)),
        ip
          ? supabase.from("verificacao_telefone_envios").select("id", { count: "exact", head: true })
              .eq("ip", ip).gte("criado_em", desde(3600_000))
          : Promise.resolve({ count: 0 }),
      ]);

      if ((ultimos10min ?? 0) >= MAX_POR_TELEFONE_10MIN || (ultimas24h ?? 0) >= MAX_POR_TELEFONE_24H || (doIp ?? 0) >= MAX_POR_IP_1H) {
        return responder({ ok: false, erro: "muitas_tentativas" });
      }

      await supabase.from("verificacao_telefone_envios").insert({ telefone, ip });

      const r = await twilio("Verifications", {
        To: telefone,
        Channel: "sms",
        Locale: LOCALE_TWILIO[corpo?.idioma] || "en",
      });
      if (!r.ok) {
        console.error("Twilio (enviar):", r.status, r.json);
        // 60200 = número inválido; 60203 = muitas tentativas pro mesmo número
        if (r.json?.code === 60200 || r.json?.code === 21211) return responder({ ok: false, erro: "telefone_invalido" });
        if (r.json?.code === 60203) return responder({ ok: false, erro: "muitas_tentativas" });
        return responder({ ok: false, erro: "falha_envio" });
      }
      return responder({ ok: true });
    }

    if (acao === "confirmar") {
      const codigo = String(corpo?.codigo || "").replace(/\D/g, "");
      const nome = String(corpo?.nome || "").trim();
      const email = String(corpo?.email || "").trim();
      const dataNascimento = corpo?.data_nascimento || null;

      if (!codigo || !nome || !email.includes("@")) {
        return responder({ ok: false, erro: "dados_incompletos" });
      }

      const r = await twilio("VerificationCheck", { To: telefone, Code: codigo });
      if (r.status === 404) return responder({ ok: false, erro: "codigo_expirado" });
      if (!r.ok) {
        console.error("Twilio (confirmar):", r.status, r.json);
        return responder({ ok: false, erro: "falha_confirmacao" });
      }
      if (r.json?.status !== "approved") return responder({ ok: false, erro: "codigo_incorreto" });

      // Telefone comprovado. Acha o cliente primeiro pelo telefone (é o dado
      // confirmado agora), depois pelo e-mail; se não existir, cria.
      const alvo = ultimos9(telefone);
      const { data: comTelefone, error: erroBusca } = await supabase
        .from("clientes")
        .select("id, telefone, bloqueado, data_nascimento")
        .not("telefone", "is", null);
      if (erroBusca) throw erroBusca;

      let cliente = (comTelefone || []).find((c) => ultimos9(c.telefone) === alvo) || null;

      if (!cliente) {
        const { data: porEmail } = await supabase
          .from("clientes")
          .select("id, telefone, bloqueado, data_nascimento")
          .ilike("email", email)
          .limit(1);
        cliente = porEmail?.[0] || null;
      }

      if (cliente) {
        if (cliente.bloqueado) return responder({ ok: false, erro: "cliente_bloqueado" });
        // Grava o telefone no formato internacional (+país) — é ele que o
        // Admin usa pra abrir o WhatsApp do cliente no país certo.
        await supabase
          .from("clientes")
          .update({
            telefone,
            ...(cliente.data_nascimento || !dataNascimento ? {} : { data_nascimento: dataNascimento }),
          })
          .eq("id", cliente.id);
      } else {
        const { data: novo, error: erroInsert } = await supabase
          .from("clientes")
          .insert({ nome, email, telefone, data_nascimento: dataNascimento })
          .select("id, telefone, bloqueado, data_nascimento")
          .single();
        if (erroInsert) throw erroInsert;
        cliente = novo;
      }

      const expiraEm = new Date(Date.now() + VALIDADE_TOKEN_DIAS * 24 * 3600_000).toISOString();
      const { data: token, error: erroToken } = await supabase
        .from("telefones_verificados")
        .insert({ cliente_id: cliente!.id, telefone, expira_em: expiraEm })
        .select("token")
        .single();
      if (erroToken) throw erroToken;

      return responder({ ok: true, token: token.token, cliente_id: cliente!.id, expira_em: expiraEm });
    }

    return responder({ ok: false, erro: "acao_invalida" });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return responder({ ok: false, erro: "erro_interno" });
  }
});
