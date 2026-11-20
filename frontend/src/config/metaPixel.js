// Pixel da Meta (Facebook/Instagram Ads) do Kaizen Flow.
//
// Carregado SÓ nas páginas de cadastro do SaaS (/cadastro e /cadastro/sucesso).
// Este app também serve as páginas públicas de agendamento das barbearias
// clientes — não queremos rastrear os clientes delas no nosso Pixel.

export const META_PIXEL_ID = '1559059672649104';

const CHAVE_COMPRA = 'kaizen_pixel_compra';

export function iniciarMetaPixel() {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq === 'function') return;

  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
}

export function rastrear(evento, parametros) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (parametros) window.fbq('track', evento, parametros);
  else window.fbq('track', evento);
}

// Guarda moeda/valor antes de ir pro Stripe, pra página de sucesso saber o que reportar.
export function guardarDadosCompra(dados) {
  try { sessionStorage.setItem(CHAVE_COMPRA, JSON.stringify(dados)); } catch (_) { /* ignora */ }
}

export function lerEApagarDadosCompra() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_COMPRA);
    sessionStorage.removeItem(CHAVE_COMPRA);
    return bruto ? JSON.parse(bruto) : null;
  } catch (_) {
    return null;
  }
}
