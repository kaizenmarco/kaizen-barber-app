import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

// ============================================================================
// Origem do agendamento (anúncios pagos / links marcados)
//
// Os anúncios do Meta abrem o app com parâmetros UTM, ex:
//   app.kaizenbarbershop.com/?utm_source=meta&utm_medium=paid
//     &utm_campaign=fimdeano2026&utm_content=vespera_jp
//
// 1) capturarOrigemAnuncio() roda assim que o app carrega (import em App.jsx)
//    e guarda esses parâmetros no aparelho por 30 dias — assim, mesmo que a
//    pessoa feche o app e volte depois pra agendar, ainda sabemos que ela
//    veio do anúncio.
// 2) dadosOrigemAnuncio() devolve { utm_source, utm_campaign, utm_content }
//    para gravar junto no agendamento (ClientePublico.jsx). Sem origem
//    guardada, devolve {} e o agendamento fica igual a antes.
// 3) <BannerAnuncio /> mostra a faixa "1ª visita 40% OFF" para quem chegou
//    pelo anúncio, no idioma do app.
// O banco limpa/limita os valores (trigger limpar_utm_agendamento) e anota a
// origem nas observações, pra aparecer no Admin.
// ============================================================================

const CHAVE_ORIGEM = 'kaizen_origem_anuncio';
const CHAVE_BANNER_FECHADO = 'kaizen_banner_anuncio_fechado';
const CHAVE_IDIOMA = 'kaizen_idioma';
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

const limpar = (v, max) => (v || '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, max) || null;

// Idioma do anúncio pelo final do utm_content (vespera_jp -> ja etc.)
const idiomaDoAnuncio = (conteudo) => {
  const c = (conteudo || '').toLowerCase();
  if (/(^|_)(jp|ja)$/.test(c)) return 'ja';
  if (/(^|_)(en|fil|ph)$/.test(c)) return 'en';
  if (/(^|_)(pt|br)$/.test(c)) return 'pt-BR';
  if (/(^|_)es$/.test(c)) return 'es';
  return null;
};

export const capturarOrigemAnuncio = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fonte = limpar(params.get('utm_source'), 40);
    if (!fonte) return;
    const origem = {
      utm_source: fonte,
      utm_campaign: limpar(params.get('utm_campaign'), 60),
      utm_content: limpar(params.get('utm_content'), 60),
      ts: Date.now(),
    };
    localStorage.setItem(CHAVE_ORIGEM, JSON.stringify(origem));
    localStorage.removeItem(CHAVE_BANNER_FECHADO);
    // Quem veio do anúncio em japonês/inglês já abre o app nesse idioma —
    // só se a pessoa ainda não escolheu um idioma antes.
    const idioma = idiomaDoAnuncio(origem.utm_content);
    if (idioma && !localStorage.getItem(CHAVE_IDIOMA)) {
      localStorage.setItem(CHAVE_IDIOMA, idioma);
    }
  } catch {
    // localStorage indisponível (modo privado etc.) — segue sem origem
  }
};

const lerOrigem = () => {
  try {
    const bruto = localStorage.getItem(CHAVE_ORIGEM);
    if (!bruto) return null;
    const origem = JSON.parse(bruto);
    if (!origem?.utm_source || Date.now() - (origem.ts || 0) > VALIDADE_MS) return null;
    return origem;
  } catch {
    return null;
  }
};

export const dadosOrigemAnuncio = () => {
  const origem = lerOrigem();
  if (!origem) return {};
  return {
    utm_source: origem.utm_source,
    utm_campaign: origem.utm_campaign || null,
    utm_content: origem.utm_content || null,
  };
};

const TEXTOS = {
  'pt-BR': { titulo: '🎁 1ª visita na Kaizen: 40% OFF', sub: 'O desconto entra sozinho quando você agenda pelo app.', fechar: 'Fechar' },
  ja: { titulo: '🎁 初回のお客様 40%OFF', sub: 'アプリでご予約いただくと自動で割引されます。', fechar: '閉じる' },
  en: { titulo: '🎁 40% OFF your first visit', sub: 'The discount is applied automatically when you book in the app.', fechar: 'Close' },
  es: { titulo: '🎁 40% OFF en tu primera visita', sub: 'El descuento se aplica automáticamente al reservar en la app.', fechar: 'Cerrar' },
};

export function BannerAnuncio() {
  const location = useLocation();
  const [fechado, setFechado] = useState(() => {
    try { return localStorage.getItem(CHAVE_BANNER_FECHADO) === '1'; } catch { return false; }
  });

  const host = window.location.hostname;
  const ehSiteCliente = !/^(admin|cadastro|painel)\./.test(host);
  if (fechado || !ehSiteCliente || location.pathname !== '/' || !lerOrigem()) return null;

  let idioma = 'pt-BR';
  try { idioma = localStorage.getItem(CHAVE_IDIOMA) || 'pt-BR'; } catch { /* segue em pt */ }
  const tx = TEXTOS[idioma] || TEXTOS['pt-BR'];

  const fechar = () => {
    setFechado(true);
    try { localStorage.setItem(CHAVE_BANNER_FECHADO, '1'); } catch { /* ok */ }
  };

  return (
    <div
      role="status"
      style={{
        background: 'linear-gradient(90deg, #b8901f, #d4af37, #b8901f)',
        color: '#1a1a1a',
        padding: '10px 44px 10px 16px',
        textAlign: 'center',
        position: 'relative',
        fontFamily: 'inherit',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 16, lineHeight: 1.3 }}>{tx.titulo}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{tx.sub}</div>
      <button
        type="button"
        onClick={fechar}
        aria-label={tx.fechar}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#1a1a1a', padding: 6,
        }}
      >
        ×
      </button>
    </div>
  );
}

export default BannerAnuncio;
