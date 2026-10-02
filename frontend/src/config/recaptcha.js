// ============================================================================
// reCAPTCHA v3 (invisível) — usado nas duas etapas públicas que soltam um
// "token" de longa duração pra criar agendamentos (verificar-telefone, no
// Kaizen Barber Shop original, e enviar-codigo-confirmacao, no Kaizen Flow):
// depois do ataque de 02/10/2026, em que um número/e-mail verificado uma
// única vez foi reaproveitado por um bot pra criar dezenas de agendamentos
// falsos, isso dificulta um script chegar até o primeiro código.
//
// RECAPTCHA_SITE_KEY é pública (fica no bundle do site, não tem problema
// nenhum em expor) — pegue em https://www.google.com/recaptcha/admin/create
// escolhendo "reCAPTCHA v3" e cadastrando os domínios do site. A chave
// SECRETA correspondente nunca vai no frontend: ela é um "secret" da Edge
// Function (RECAPTCHA_SECRET_KEY), configurado só no painel do Supabase.
//
// Enquanto RECAPTCHA_SITE_KEY ficar vazia (''), o captcha fica desativado
// sem quebrar nada — obterTokenRecaptcha() sempre devolve null, e as Edge
// Functions não exigem token até o secret correspondente também existir.
// Ou seja: só preencher aqui não é suficiente nem necessário sozinho — os
// dois lados (site key aqui + secret key no Supabase) precisam estar
// configurados juntos pra proteção entrar em vigor.
export const RECAPTCHA_SITE_KEY = '';

let promessaScript = null;

function carregarScriptRecaptcha() {
  if (!RECAPTCHA_SITE_KEY) return Promise.resolve(false);
  if (window.grecaptcha?.execute) return Promise.resolve(true);
  if (promessaScript) return promessaScript;

  promessaScript = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return promessaScript;
}

// Devolve um token do reCAPTCHA v3 pra essa ação específica, ou null se o
// captcha estiver desativado (site key vazia) ou algo falhar ao carregar —
// nesse caso o fluxo normal segue sem travar ninguém; quem decide bloquear
// de fato é a Edge Function, só quando o secret key também estiver configurado.
export async function obterTokenRecaptcha(acao) {
  if (!RECAPTCHA_SITE_KEY) return null;
  try {
    const carregado = await carregarScriptRecaptcha();
    if (!carregado || !window.grecaptcha?.execute) return null;
    return await new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: acao }).then(resolve).catch(() => resolve(null));
      });
    });
  } catch {
    return null;
  }
}
