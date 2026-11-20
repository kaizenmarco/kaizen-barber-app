import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CampoTelefone from '../CampoTelefone';
import { IDIOMAS_CARTAO, LOCALE_CARTAO, textoRecompensa, traduzirCartao } from './textosCartao';

// ============================================================================
// Página pública do Cartão Fidelidade digital. Serve as duas bases:
//   /cartao            → formulário de entrada (QR code do balcão)
//   /cartao/:token     → o cartão do cliente (link pessoal, salvo na tela
//                        de início do celular)
//
// `api` isola o banco de cada base:
//   api.config()                   → config do programa (pct, meta, brinde…)
//   api.entrar(nome, telefone, ref) → { token }
//   api.cartao(token)              → estado do cartão ou null
// ============================================================================

const CHAVE_IDIOMA = 'kaizen_idioma';
const OURO = '#d4af37';

const lerStorage = (chave) => { try { return localStorage.getItem(chave); } catch { return null; } };
const gravarStorage = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem storage */ } };

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
const estaInstalado = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;

function PaginaCartao({ api, nomeLoja, linkAgendar, linkInicio, caminhoBase, chaveStorage, logoSelo }) {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ref = searchParams.get('ref');

  const [idioma, setIdiomaState] = useState(() => lerStorage(CHAVE_IDIOMA) || 'pt-BR');
  const t = useCallback((k, v) => traduzirCartao(idioma, k, v), [idioma]);
  const setIdioma = (novo) => { setIdiomaState(novo); gravarStorage(CHAVE_IDIOMA, novo); };

  const [config, setConfig] = useState(null);
  const [cartao, setCartao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Título e nome do atalho na tela de início
  useEffect(() => {
    const anterior = document.title;
    document.title = `${nomeLoja} · ${t('titulo')}`;
    const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const metaAnterior = meta?.getAttribute('content');
    meta?.setAttribute('content', t('titulo'));
    return () => { document.title = anterior; if (meta && metaAnterior) meta.setAttribute('content', metaAnterior); };
  }, [nomeLoja, t]);

  // Sem token: se este celular já tem um cartão salvo, abre direto ele.
  useEffect(() => {
    if (token || ref) return;
    const salvo = lerStorage(chaveStorage);
    if (salvo) navigate(`${caminhoBase}/${salvo}`, { replace: true });
  }, [token, ref, chaveStorage, caminhoBase, navigate]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro('');
      try {
        if (token) {
          const dados = await api.cartao(token);
          if (!ativo) return;
          if (!dados) { setErro(t('cartao_nao_encontrado')); setCartao(null); }
          else { setCartao(dados); setConfig(dados.config); gravarStorage(chaveStorage, token); }
        } else {
          const cfg = await api.config();
          if (ativo) setConfig(cfg);
        }
      } catch {
        if (ativo) setErro(t('erro_generico'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const entrar = async (e) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setErro(t('erro_nome')); return; }
    if (telefone.replace(/\D/g, '').length < 9) { setErro(t('erro_telefone')); return; }
    setEnviando(true);
    setErro('');
    try {
      const { token: novoToken } = await api.entrar(nome.trim(), telefone, ref);
      gravarStorage(chaveStorage, novoToken);
      navigate(`${caminhoBase}/${novoToken}`, { replace: true });
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('TELEFONE_INVALIDO')) setErro(t('erro_telefone'));
      else if (msg.includes('NOME_INVALIDO')) setErro(t('erro_nome'));
      else if (msg.includes('CLIENTE_BLOQUEADO')) setErro(t('erro_bloqueado'));
      else if (msg.includes('PROGRAMA_INATIVO')) setErro(t('erro_inativo'));
      else setErro(t('erro_generico'));
    } finally {
      setEnviando(false);
    }
  };

  const pctAmigo = Number(config?.desconto_pct) || 0;
  const pctIndicacao = Number(config?.indicacao_pct ?? config?.desconto_pct) || 0;
  const carimbo = logoSelo || config?.selo_url || null;

  const linkIndicacao = useMemo(() => {
    if (!cartao?.codigo_indicacao) return '';
    return `${window.location.origin}${caminhoBase}?ref=${cartao.codigo_indicacao}`;
  }, [cartao, caminhoBase]);

  const indicar = async () => {
    const texto = t(pctAmigo > 0 ? 'indicar_mensagem' : 'indicar_mensagem_sem_desconto', { pct: pctAmigo, loja: nomeLoja, link: linkIndicacao });
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch { /* cancelou — cai no copiar */ }
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { window.prompt('', texto); }
  };

  const premio = textoRecompensa(config?.premio, idioma);
  const brinde = textoRecompensa(config?.brinde, idioma);

  return (
    <div style={estilos.pagina}>
      <div style={estilos.topo}>
        {linkInicio ? <a href={linkInicio} style={estilos.voltar}>{t('voltar')}</a> : <span />}
        <div style={estilos.idiomas}>
        {IDIOMAS_CARTAO.map((op) => (
          <button key={op.codigo} onClick={() => setIdioma(op.codigo)}
            style={{ ...estilos.botaoIdioma, ...(idioma === op.codigo ? estilos.botaoIdiomaAtivo : {}) }}>
            {op.rotulo}
          </button>
        ))}
        </div>
      </div>

      <h1 style={estilos.loja}>{nomeLoja}</h1>

      {carregando ? (
        <p style={{ color: OURO, textAlign: 'center', marginTop: 40 }}>{t('carregando')}</p>
      ) : token ? (
        cartao ? (
          <Cartao cartao={cartao} config={config} t={t} idioma={idioma} nomeLoja={nomeLoja}
            premio={premio} brinde={brinde} linkAgendar={linkAgendar} logoSelo={carimbo}
            pctAmigo={pctAmigo} pctIndicacao={pctIndicacao}
            indicar={indicar} copiado={copiado} />
        ) : (
          <p style={estilos.erro}>{erro}</p>
        )
      ) : config && config.ativo === false ? (
        <p style={{ ...estilos.erro, color: '#ccc' }}>{t('erro_inativo')}</p>
      ) : (
        <form onSubmit={entrar} style={estilos.bloco}>
          {ref && <p style={{ color: '#4ade80', fontWeight: 'bold', margin: '0 0 8px' }}>{t('indicado_por_amigo')}</p>}
          <h2 style={{ color: OURO, margin: '0 0 8px', fontSize: 26 }}>
            {ref && pctAmigo > 0 ? t('entrar_titulo', { pct: pctAmigo }) : t('entrar_titulo_sem_desconto')}
          </h2>

          {/* Sem convite: deixa claro que o desconto é só para quem vem pela 1ª vez
              e mostra o que o cliente antigo ganha (selos + indicação). */}
          {!ref && (pctAmigo > 0 || pctIndicacao > 0) && (
            <div style={{ display: 'grid', gap: 10, margin: '4px 0 14px' }}>
              {pctAmigo > 0 && (
                <div style={estilos.porta}>
                  <div style={estilos.portaTitulo}>{t('porta_novo_titulo')}</div>
                  <div style={estilos.portaTexto}>{t('porta_novo_texto', { pct: pctAmigo })}</div>
                </div>
              )}
              <div style={estilos.porta}>
                <div style={estilos.portaTitulo}>{t('porta_cliente_titulo')}</div>
                <div style={estilos.portaTexto}>
                  {config?.selos_obrigado > 0 && <strong style={{ color: OURO }}>{t('porta_cliente_presente', { n: config.selos_obrigado + (Number(config.selos_boas_vindas) || 0) })} </strong>}
                  {t(pctIndicacao > 0 ? 'porta_cliente_texto' : 'porta_cliente_texto_sem_ind', { pctInd: pctIndicacao })}
                </div>
              </div>
            </div>
          )}

          <p style={{ color: '#ccc', margin: '0 0 16px', lineHeight: 1.5 }}>{t(ref ? 'entrar_sub' : 'entrar_sub_geral')}</p>

          {config && (
            <div style={{ ...estilos.regras }}>
              {config.selos_boas_vindas > 0 && <p style={estilos.regra}>⭐ {t('entrar_regra_boas_vindas', { n: config.selos_boas_vindas })}</p>}
              {config.selo_brinde > 0 && config.selo_brinde < config.meta_selos && (
                <p style={estilos.regra}>🎁 {t('entrar_regra_brinde', { n: config.selo_brinde, brinde })}</p>
              )}
              <p style={estilos.regra}>✂️ {t('entrar_regra_selos', { meta: config.meta_selos, premio })}</p>
              {pctAmigo > 0 && <p style={{ ...estilos.regra, color: '#999', fontSize: 12, marginTop: 8 }}>* {t('regra_so_novos')}</p>}
            </div>
          )}

          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('nome')}
            autoComplete="name" style={estilos.input} maxLength={80} />
          <div style={{ marginTop: 10 }}>
            <CampoTelefone value={telefone} onChange={setTelefone} placeholder={t('telefone')} required
              estiloSelect={estilos.select} estiloInput={{ ...estilos.input, marginTop: 0 }} />
          </div>
          {erro && <p style={estilos.erro}>{erro}</p>}
          <button type="submit" disabled={enviando} style={{ ...estilos.botaoPrincipal, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? t('entrando') : t('botao_entrar')}
          </button>
        </form>
      )}
    </div>
  );
}

function Cartao({ cartao, config, t, idioma, nomeLoja, premio, brinde, linkAgendar, indicar, copiado, logoSelo, pctAmigo, pctIndicacao }) {
  const meta = config?.meta_selos || 10;
  const seloBrinde = config?.selo_brinde && config.selo_brinde < meta ? config.selo_brinde : null;
  const noCiclo = cartao.selos_no_ciclo || 0;
  const pendentes = cartao.recompensas_pendentes || [];
  const cupom = cartao.cupom || {};
  const dataCupom = cupom.expira_em
    ? new Date(`${cupom.expira_em}T12:00:00`).toLocaleDateString(LOCALE_CARTAO[idioma] || 'pt-BR', { day: 'numeric', month: 'long' })
    : '';

  const cuponsIndicacao = cartao.cupons || [];
  const formatarData = (d) => new Date(`${d}T12:00:00`)
    .toLocaleDateString(LOCALE_CARTAO[idioma] || 'pt-BR', { day: 'numeric', month: 'long' });
  const temCupomLivre = cupom.ativo || cuponsIndicacao.some((c) => !c.agendado);

  const proximoBrinde = seloBrinde && noCiclo < seloBrinde ? seloBrinde - noCiclo : null;
  const [mostrarSalvar, setMostrarSalvar] = useState(() => !estaInstalado());

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <p style={{ color: '#e8e8e8', fontSize: 18, margin: '0 0 12px', textAlign: 'center' }}>
        {t('ola', { nome: cartao.primeiro_nome || '' })}
      </p>

      {!cupom.ativo && cartao.visitas > 0 && cuponsIndicacao.length === 0 && (
        <div style={{ ...estilos.bloco, marginBottom: 16, textAlign: 'center', borderColor: OURO }}>
          <div style={{ color: OURO, fontWeight: 900, fontSize: 17 }}>{t('volta_titulo')}</div>
          {cartao.selos_obrigado > 0 && (
            <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: 15, marginTop: 6 }}>{t('presente_obrigado', { n: cartao.selos_obrigado + (Number(cartao.selos_bonus) || 0) })}</div>
          )}
          <div style={{ color: '#ccc', fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            {t(pctIndicacao > 0 ? 'volta_texto' : 'volta_texto_sem_ind', { pctInd: pctIndicacao })}
          </div>
        </div>
      )}

      {cupom.ativo && (
        <div style={estilos.cupom}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 0.5 }}>{t('cupom_titulo', { pct: cupom.pct })}</div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: 0.85 }}>{t('cupom_validade', { data: dataCupom })}</div>
          {linkAgendar && (
            <a href={linkAgendar} style={estilos.botaoCupom}>{t('agendar')} →</a>
          )}
        </div>
      )}

      {cuponsIndicacao.map((c) => (
        <div key={c.id} style={{ ...estilos.cupom, ...(c.agendado ? { opacity: 0.75 } : {}) }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.5 }}>🤝 {t('cupom_indicacao_titulo', { pct: c.pct })}</div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: 0.85 }}>
            {c.agendado ? t('cupom_reservado') : t('cupom_indicacao_validade', { data: formatarData(c.expira_em) })}
          </div>
          {!c.agendado && !cupom.ativo && linkAgendar && (
            <a href={linkAgendar} style={estilos.botaoCupom}>{t('agendar')} →</a>
          )}
        </div>
      ))}

      {/* O cartão */}
      <div style={estilos.cartao}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: OURO, fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>{nomeLoja.toUpperCase()}</div>
            <div style={{ color: '#999', fontSize: 11, letterSpacing: 2 }}>{t('titulo').toUpperCase()}</div>
          </div>
          <div style={{ color: '#1a1a1a', background: OURO, fontSize: 12, fontWeight: 'bold', padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
            {t('selos_de', { n: noCiclo, meta })}
          </div>
        </div>

        <div style={{ ...estilos.gradeSelos, gridTemplateColumns: `repeat(${Math.min(5, meta)}, 1fr)` }}>
          {Array.from({ length: meta }, (_, i) => {
            const n = i + 1;
            const cheio = n <= noCiclo;
            const ehBrinde = n === seloBrinde;
            const ehPremio = n === meta;
            return (
              <div key={n} style={{
                ...estilos.selo,
                ...(cheio ? estilos.seloCheio : {}),
                ...(cheio && logoSelo ? { background: '#111', overflow: 'hidden' } : {}),
                ...((ehBrinde || ehPremio) && !cheio ? { borderStyle: 'dashed', borderColor: OURO } : {}),
              }}>
                {cheio
                  ? (logoSelo
                    ? <img src={logoSelo} alt="" style={{ ...estilos.carimbo, transform: `rotate(${((n * 37) % 25) - 12}deg)` }} />
                    : '✂')
                  : ehPremio ? '👑' : ehBrinde ? '🎁' : n}
              </div>
            );
          })}
        </div>

        <div style={{ color: '#aaa', fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
          {seloBrinde && <div>🎁 {seloBrinde}: {brinde}</div>}
          <div>👑 {meta}: {premio}</div>
        </div>
      </div>

      {pendentes.length > 0 ? (
        <div style={estilos.recompensa}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{t('recompensa_disponivel')}</div>
          {pendentes.map((p) => (
            <div key={p.marco} style={{ marginTop: 6 }}>
              {p.tipo === 'premio' ? `👑 ${t('premio_label')}: ${premio}` : `🎁 ${t('brinde_label')}: ${brinde}`}
            </div>
          ))}
          <div style={{ fontSize: 13, marginTop: 8, opacity: 0.85 }}>{t('recompensa_mostrar')}</div>
        </div>
      ) : (
        <p style={{ color: '#ccc', textAlign: 'center', margin: '14px 0' }}>
          {proximoBrinde
            ? t('faltam_brinde', { n: proximoBrinde, brinde })
            : t('faltam', { n: meta - noCiclo, premio })}
        </p>
      )}

      {!temCupomLivre && linkAgendar && (
        <a href={linkAgendar} style={{ ...estilos.botaoPrincipal, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          {t('agendar')}
        </a>
      )}

      {/* Indicação (some se a barbearia não dá nada nem ao amigo nem a quem indica) */}
      {(pctAmigo > 0 || pctIndicacao > 0) && (
      <div style={{ ...estilos.bloco, marginTop: 16 }}>
        <h3 style={{ color: OURO, margin: '0 0 6px' }}>🤝 {t('indicar_titulo')}</h3>
        <p style={{ color: '#ccc', margin: '0 0 12px', fontSize: 14, lineHeight: 1.5 }}>
          {t(pctAmigo > 0 && pctIndicacao > 0 ? 'indicar_texto' : pctAmigo > 0 ? 'indicar_texto_so_amigo' : 'indicar_texto_so_voce',
            { pct: pctAmigo, pctInd: pctIndicacao })}
        </p>
        <button onClick={indicar} style={estilos.botaoSecundario}>
          {copiado ? t('indicar_copiado') : t('indicar_botao')}
        </button>
        {cartao.indicacoes_creditadas > 0 && (
          <p style={{ color: '#4ade80', fontSize: 13, margin: '10px 0 0' }}>{t('indicacoes', { n: cartao.indicacoes_creditadas })}</p>
        )}
      </div>
      )}

      {mostrarSalvar && (
        <div style={{ ...estilos.bloco, marginTop: 16, position: 'relative' }}>
          <button onClick={() => setMostrarSalvar(false)} aria-label="×" style={estilos.fechar}>×</button>
          <h3 style={{ color: OURO, margin: '0 0 6px' }}>📲 {t('salvar_titulo')}</h3>
          {(ehIOS() ? ['salvar_ios', 'salvar_android'] : ['salvar_android', 'salvar_ios']).map((k, i) => (
            <p key={k} style={{ color: i === 0 ? '#e8e8e8' : '#999', margin: i === 0 ? 0 : '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>
              {t(k)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: '100vh', background: 'radial-gradient(circle at 50% 0%, #2a2210 0%, #111 55%)', color: '#e8e8e8',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 48px', boxSizing: 'border-box',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Segoe UI", Roboto, sans-serif',
  },
  topo: { width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  voltar: { color: OURO, textDecoration: 'none', fontWeight: 'bold', fontSize: 15, padding: '6px 4px' },
  idiomas: { display: 'flex', gap: 6 },
  porta: { background: '#141414', border: '1px solid #3a3320', borderRadius: 12, padding: '10px 14px' },
  portaTitulo: { color: OURO, fontWeight: 'bold', fontSize: 15 },
  portaTexto: { color: '#e8e8e8', fontSize: 14, marginTop: 4, lineHeight: 1.5 },
  botaoIdioma: { background: 'transparent', color: OURO, border: `1px solid ${OURO}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' },
  botaoIdiomaAtivo: { background: OURO, color: '#1a1a1a' },
  loja: { color: OURO, fontSize: 22, letterSpacing: 3, margin: '8px 0 16px', textAlign: 'center' },
  bloco: { width: '100%', maxWidth: 420, background: '#1c1c1c', border: '1px solid #333', borderRadius: 16, padding: 20, boxSizing: 'border-box' },
  regras: { background: '#141414', borderRadius: 12, padding: '10px 14px', marginBottom: 16 },
  regra: { margin: '4px 0', fontSize: 14, color: '#e8e8e8' },
  input: { width: '100%', padding: '14px 12px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff', fontSize: 16, boxSizing: 'border-box' },
  select: { padding: '14px 8px', borderRadius: 10, border: '1px solid #444', background: '#111', color: '#fff', fontSize: 16 },
  erro: { color: '#f87171', margin: '10px 0 0', textAlign: 'center' },
  botaoPrincipal: { width: '100%', marginTop: 16, padding: '16px', borderRadius: 12, border: 'none', background: OURO, color: '#1a1a1a', fontWeight: 900, fontSize: 17, cursor: 'pointer', boxSizing: 'border-box' },
  botaoSecundario: { width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${OURO}`, background: 'transparent', color: OURO, fontWeight: 'bold', fontSize: 15, cursor: 'pointer' },
  cupom: { background: `linear-gradient(135deg, ${OURO}, #f0d77a)`, color: '#1a1a1a', borderRadius: 16, padding: 18, marginBottom: 16, textAlign: 'center' },
  botaoCupom: { display: 'inline-block', marginTop: 12, background: '#1a1a1a', color: OURO, padding: '10px 18px', borderRadius: 10, fontWeight: 'bold', textDecoration: 'none' },
  cartao: { background: 'linear-gradient(160deg, #1f1f1f 0%, #0d0d0d 100%)', border: `1.5px solid ${OURO}`, borderRadius: 18, padding: 20, boxShadow: '0 10px 40px rgba(212,175,55,0.15)' },
  gradeSelos: { display: 'grid', gap: 10, marginTop: 18 },
  selo: { aspectRatio: '1 / 1', borderRadius: '50%', border: '1.5px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 16, fontWeight: 'bold' },
  seloCheio: { background: OURO, borderColor: OURO, color: '#1a1a1a', fontSize: 20 },
  carimbo: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' },
  recompensa: { background: '#14532d', border: '1px solid #4ade80', color: '#dcfce7', borderRadius: 16, padding: 16, margin: '16px 0', textAlign: 'center' },
  fechar: { position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' },
};

export default PaginaCartao;
