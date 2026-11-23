import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import { IDIOMAS, IDIOMA_PADRAO } from '../config/traducoes';
import {
  textoVale, buscarConfigVale, consultarVale, linkDoVale, formatarIenes,
  nomeServicoVale, formatarDataVale, ORIGEM_PUBLICA,
} from '../config/valePresente';

// Rotas:
//   /valepresente            -> compra online + "já ganhou? digite o código"
//   /valepresente/sucesso    -> volta do Stripe: confirma e mostra os códigos
//   /valepresente/:codigo    -> cartão do vale (o link que o presenteado recebe)

const CHAVE_IDIOMA_STORAGE = 'kaizen_idioma';
const OURO = '#d4af37';
const FUNDO = '#141414';
const CARTAO = '#232323';

const estilos = {
  pagina: { background: FUNDO, minHeight: '100vh', color: '#e8e8e8', fontFamily: 'inherit', paddingBottom: 48 },
  topo: {
    background: 'radial-gradient(circle at 20% 0%, rgba(212,175,55,0.25), transparent 60%), linear-gradient(180deg, #1f1a0d 0%, #141414 100%)',
    padding: '28px 20px 22px', textAlign: 'center', borderBottom: `1px solid ${OURO}33`,
  },
  conteudo: { maxWidth: 520, margin: '0 auto', padding: '0 18px' },
  card: { background: CARTAO, border: '1px solid #3a3a3a', borderRadius: 14, padding: 18, marginTop: 16 },
  input: {
    width: '100%', padding: '12px', marginBottom: 10, borderRadius: 8, border: '1px solid #404040',
    background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box', fontSize: 15, fontFamily: 'inherit',
  },
  botaoOuro: {
    width: '100%', padding: '15px', background: OURO, color: '#1a1a1a', border: 'none', borderRadius: 10,
    fontWeight: 'bold', fontSize: 16, cursor: 'pointer',
  },
  botaoContorno: {
    padding: '9px 12px', background: 'transparent', color: OURO, border: `1px solid ${OURO}`, borderRadius: 8,
    fontWeight: 'bold', fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
  },
  h2: { color: OURO, fontSize: 17, margin: '0 0 12px' },
};

function useIdioma() {
  const [idioma, setIdioma] = useState(() => {
    try { return localStorage.getItem(CHAVE_IDIOMA_STORAGE) || IDIOMA_PADRAO; } catch { return IDIOMA_PADRAO; }
  });
  const mudar = (novo) => {
    setIdioma(novo);
    try { localStorage.setItem(CHAVE_IDIOMA_STORAGE, novo); } catch { /* sem persistência */ }
  };
  return [idioma, mudar];
}

function SeletorIdioma({ idioma, aoMudar }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14 }}>
      {IDIOMAS.map(i => (
        <button
          key={i.codigo}
          type="button"
          onClick={() => aoMudar(i.codigo)}
          style={{
            padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${idioma === i.codigo ? OURO : '#444'}`,
            background: idioma === i.codigo ? OURO : 'transparent',
            color: idioma === i.codigo ? '#1a1a1a' : '#bbb',
          }}
        >
          {i.bandeira} {i.rotulo}
        </button>
      ))}
    </div>
  );
}

function Topo({ idioma, aoMudarIdioma, t, subtitulo = true }) {
  return (
    <div style={estilos.topo}>
      <img src="/images/logo.jpg" alt="Kaizen Barber Shop" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${OURO}` }} />
      <h1 style={{ color: OURO, margin: '12px 0 6px', fontSize: 24, letterSpacing: 0.5 }}>🎁 {t('titulo')}</h1>
      {subtitulo && <p style={{ color: '#ccc', margin: 0, fontSize: 14, lineHeight: 1.5 }}>{t('subtitulo')}</p>}
      <SeletorIdioma idioma={idioma} aoMudar={aoMudarIdioma} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão visual do vale (usado no link do presenteado e na tela de sucesso)
// ---------------------------------------------------------------------------
export function CartaoVisualVale({ vale, idioma, t, comQr = false }) {
  const ehBonus = vale.tipo === 'bonus';
  const servico = nomeServicoVale(vale.servico_id, vale.servico_nome, idioma);
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '22px 20px',
      background: 'linear-gradient(135deg, #2b2410 0%, #1a1a1a 45%, #2b2410 100%)',
      border: `2px solid ${OURO}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `${OURO}22` }} />
      <p style={{ margin: 0, fontSize: 11, letterSpacing: 2, color: OURO, textTransform: 'uppercase' }}>Kaizen Barber Shop</p>
      {ehBonus ? (
        <>
          <h2 style={{ margin: '10px 0 4px', color: '#fff', fontSize: 22 }}>{t('bonus_titulo')}</h2>
          <p style={{ margin: 0, color: OURO, fontSize: 20, fontWeight: 'bold' }}>{t('bonus_desc', { valor: formatarIenes(vale.valor) })}</p>
        </>
      ) : (
        <>
          {vale.nome_presenteado && (
            <p style={{ margin: '12px 0 0', color: '#bbb', fontSize: 13 }}>{t('presente_para')}</p>
          )}
          {vale.nome_presenteado && (
            <h2 style={{ margin: '2px 0 0', color: '#fff', fontSize: 24 }}>{vale.nome_presenteado}</h2>
          )}
          <p style={{ margin: '12px 0 0', color: '#bbb', fontSize: 13 }}>{t('vale_para')}</p>
          <p style={{ margin: '2px 0 0', color: OURO, fontSize: 22, fontWeight: 'bold' }}>✂️ {servico}</p>
        </>
      )}
      {!ehBonus && vale.mensagem && (
        <p style={{ margin: '14px 0 0', color: '#eee', fontStyle: 'italic', fontSize: 15, lineHeight: 1.5 }}>“{vale.mensagem}”</p>
      )}
      {!ehBonus && vale.nome_comprador && (
        <p style={{ margin: '6px 0 0', color: '#bbb', fontSize: 13 }}>— {t('de')}: {vale.nome_comprador}</p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, gap: 10 }}>
        <div>
          <p style={{ margin: 0, color: '#999', fontSize: 11 }}>{t('codigo')}</p>
          <p style={{ margin: 0, color: '#fff', fontFamily: 'monospace', fontSize: 18, letterSpacing: 1 }}>{vale.codigo}</p>
          {vale.expira_em && (
            <p style={{ margin: '6px 0 0', color: '#999', fontSize: 12 }}>{t('validade')}: {formatarDataVale(vale.expira_em, idioma)}</p>
          )}
        </div>
        {comQr && (
          <div style={{ background: '#fff', padding: 6, borderRadius: 8 }}>
            <QRCodeSVG value={linkDoVale(vale.codigo)} size={76} />
          </div>
        )}
      </div>
    </div>
  );
}

function BotoesCompartilhar({ vale, t }) {
  const [copiado, setCopiado] = useState(false);
  const link = linkDoVale(vale.codigo);
  const texto = t('texto_compartilhar', { link });
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { window.prompt('', link); }
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <button type="button" style={estilos.botaoContorno} onClick={copiar}>{copiado ? t('copiado') : `🔗 ${t('copiar_link')}`}</button>
      <a style={estilos.botaoContorno} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">{t('enviar_whatsapp')}</a>
      <a style={estilos.botaoContorno} href={`https://line.me/R/msg/text/?${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">{t('enviar_line')}</a>
      <a style={estilos.botaoContorno} href={`/valepresente/${vale.codigo}`}>{t('abrir_vale')}</a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// /valepresente — compra
// ---------------------------------------------------------------------------
function TelaCompra({ idioma, setIdioma, t }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cancelado = new URLSearchParams(location.search).get('cancelado') === '1';
  const [cfg, setCfg] = useState(null);
  const [qtd, setQtd] = useState({});
  const [dados, setDados] = useState({ nome: '', email: '', telefone: '', mensagem: '' });
  const [presenteados, setPresenteados] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    buscarConfigVale().then((c) => {
      setCfg(c);
      const inicial = {};
      (c?.servicos || []).forEach((s, i) => { inicial[s.id] = i === 0 ? 1 : 0; });
      setQtd(inicial);
    }).catch(() => setCfg({ servicos: [] }));
  }, []);

  const totalQtd = Object.values(qtd).reduce((a, b) => a + b, 0);
  const combo = cfg && cfg.combo_pct > 0 && totalQtd >= cfg.combo_min_qtd;
  const total = useMemo(() => (cfg?.servicos || []).reduce((acc, s) => {
    const unit = combo ? Math.round(s.preco * (100 - cfg.combo_pct) / 100) : Number(s.preco);
    return acc + unit * (qtd[s.id] || 0);
  }, 0), [cfg, qtd, combo]);
  const totalSemDesconto = (cfg?.servicos || []).reduce((acc, s) => acc + Number(s.preco) * (qtd[s.id] || 0), 0);

  useEffect(() => {
    setPresenteados(prev => Array.from({ length: totalQtd }, (_, i) => prev[i] || ''));
  }, [totalQtd]);

  const mudarQtd = (id, delta) => setQtd(q => ({ ...q, [id]: Math.max(0, Math.min(10, (q[id] || 0) + delta)) }));

  const pagar = async () => {
    setErro('');
    if (totalQtd < 1) { setErro(t('erro_itens')); return; }
    if (!dados.nome.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.email.trim())) { setErro(t('erro_dados')); return; }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('vale-presente', {
        body: {
          acao: 'checkout',
          itens: Object.entries(qtd).filter(([, n]) => n > 0).map(([servico_id, quantidade]) => ({ servico_id, quantidade })),
          nome_comprador: dados.nome.trim(),
          email: dados.email.trim(),
          telefone: dados.telefone.trim(),
          presenteados,
          mensagem: dados.mensagem.trim(),
          idioma,
          origem: window.location.origin,
        },
      });
      if (error || !data?.checkout_url) throw new Error(data?.erro || error?.message || 'erro');
      window.location.href = data.checkout_url;
    } catch (e) {
      setErro(t('erro_generico'));
      setEnviando(false);
    }
  };

  if (!cfg) return <div style={estilos.pagina}><Topo idioma={idioma} aoMudarIdioma={setIdioma} t={t} /><p style={{ textAlign: 'center', color: '#999' }}>{t('carregando')}</p></div>;

  return (
    <div style={estilos.pagina}>
      <Topo idioma={idioma} aoMudarIdioma={setIdioma} t={t} />
      <div style={estilos.conteudo}>
        {cancelado && (
          <div style={{ ...estilos.card, borderColor: '#f87171', color: '#fca5a5', fontSize: 14 }}>{t('cancelado_aviso')}</div>
        )}

        <div style={estilos.card}>
          <h2 style={estilos.h2}>{t('escolha_servico')}</h2>
          {cfg.servicos.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #333' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 16 }}>✂️ {nomeServicoVale(s.id, s.nome, idioma)}</p>
                <p style={{ margin: '2px 0 0', color: OURO, fontSize: 15 }}>{formatarIenes(s.preco)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" aria-label="-" onClick={() => mudarQtd(s.id, -1)} style={{ ...estilos.botaoContorno, width: 36, padding: '6px 0' }}>−</button>
                <span style={{ minWidth: 18, textAlign: 'center', fontSize: 17, fontWeight: 'bold' }}>{qtd[s.id] || 0}</span>
                <button type="button" aria-label="+" onClick={() => mudarQtd(s.id, 1)} style={{ ...estilos.botaoContorno, width: 36, padding: '6px 0' }}>+</button>
              </div>
            </div>
          ))}
          {cfg.combo_pct > 0 && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: combo ? '#4ade80' : '#bbb' }}>
              {combo ? t('combo_aplicado', { pct: cfg.combo_pct }) : t('combo_aviso', { qtd: cfg.combo_min_qtd, pct: cfg.combo_pct })}
            </p>
          )}
          {cfg.bonus_ativo && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: OURO }}>
              {t('bonus_aviso', { valor: formatarIenes(cfg.bonus_valor), data: formatarDataVale(cfg.bonus_expira_em, idioma) })}
            </p>
          )}
        </div>

        <div style={estilos.card}>
          <h2 style={estilos.h2}>{t('seus_dados')}</h2>
          <input style={estilos.input} placeholder={t('nome')} value={dados.nome} maxLength={80} onChange={e => setDados({ ...dados, nome: e.target.value })} />
          <input style={estilos.input} type="email" placeholder={t('email')} value={dados.email} maxLength={120} onChange={e => setDados({ ...dados, email: e.target.value })} />
          <input style={estilos.input} type="tel" placeholder={t('telefone')} value={dados.telefone} maxLength={30} onChange={e => setDados({ ...dados, telefone: e.target.value })} />

          {totalQtd > 0 && (
            <>
              <h2 style={{ ...estilos.h2, marginTop: 10 }}>{t('presenteados')}</h2>
              {presenteados.map((p, i) => (
                <input key={i} style={estilos.input} placeholder={t('presenteado_n', { n: totalQtd > 1 ? i + 1 : '' })} value={p} maxLength={60}
                  onChange={e => setPresenteados(arr => arr.map((x, j) => (j === i ? e.target.value : x)))} />
              ))}
            </>
          )}
          <textarea style={{ ...estilos.input, minHeight: 70 }} placeholder={t('mensagem_ph')} aria-label={t('mensagem')} value={dados.mensagem} maxLength={300}
            onChange={e => setDados({ ...dados, mensagem: e.target.value })} />
        </div>

        <div style={{ ...estilos.card, borderColor: OURO }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>{t('total')}</span>
            <span>
              {combo && <span style={{ textDecoration: 'line-through', color: '#888', marginRight: 8 }}>{formatarIenes(totalSemDesconto)}</span>}
              <strong style={{ color: OURO, fontSize: 24 }}>{formatarIenes(total)}</strong>
            </span>
          </div>
          {erro && <p style={{ color: '#f87171', fontSize: 14, margin: '0 0 10px' }}>⚠️ {erro}</p>}
          <button type="button" style={{ ...estilos.botaoOuro, opacity: enviando || !cfg.venda_ativa ? 0.6 : 1 }} disabled={enviando || !cfg.venda_ativa} onClick={pagar}>
            {enviando ? t('processando') : `💳 ${t('pagar')}`}
          </button>
        </div>

        <div style={estilos.card}>
          <h2 style={estilos.h2}>{t('regras_titulo')}</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#ccc', fontSize: 14, lineHeight: 1.7 }}>
            <li>{t('regra1', { meses: cfg.validade_meses })}</li>
            <li>{t('regra2')}</li>
            <li>{t('regra3')}</li>
            <li>{t('regra4')}</li>
            <li>{t('regra5')}</li>
          </ul>
        </div>

        <div style={estilos.card}>
          <h2 style={estilos.h2}>🎁 {t('ja_ganhou')}</h2>
          <input style={{ ...estilos.input, textTransform: 'uppercase', fontFamily: 'monospace' }} placeholder="KZN-XXXX-XXXX" aria-label={t('digite_codigo')} value={codigo} onChange={e => setCodigo(e.target.value)} />
          <button type="button" style={estilos.botaoContorno} onClick={() => codigo.trim() && navigate(`/valepresente/${codigo.trim().toUpperCase()}`)}>{t('ver_vale')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// /valepresente/sucesso
// ---------------------------------------------------------------------------
function TelaSucesso({ idioma, setIdioma, t }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pedido = params.get('pedido');
  const sessionId = params.get('session_id');
  const [estado, setEstado] = useState('carregando');
  const [vales, setVales] = useState([]);

  useEffect(() => {
    let ativo = true;
    const confirmar = async (tentativa = 0) => {
      try {
        const { data } = await supabase.functions.invoke('vale-presente', { body: { acao: 'confirmar', pedido_id: pedido, session_id: sessionId } });
        if (!ativo) return;
        if (data?.pago) { setVales(data.vales || []); setEstado('ok'); return; }
        if (tentativa < 4) { setTimeout(() => confirmar(tentativa + 1), 2500); return; }
        setEstado('nao_pago');
      } catch {
        if (ativo) setEstado('nao_pago');
      }
    };
    if (pedido && sessionId) confirmar(); else setEstado('nao_pago');
    return () => { ativo = false; };
  }, [pedido, sessionId]);

  const presentes = vales.filter(v => v.tipo === 'presente');
  const bonus = vales.filter(v => v.tipo === 'bonus');

  return (
    <div style={estilos.pagina}>
      <Topo idioma={idioma} aoMudarIdioma={setIdioma} t={t} subtitulo={false} />
      <div style={estilos.conteudo}>
        {estado === 'carregando' && <p style={{ textAlign: 'center', color: '#bbb', marginTop: 30 }}>{t('confirmando')}</p>}
        {estado === 'nao_pago' && <div style={{ ...estilos.card, color: '#fca5a5' }}>{t('nao_pago')}</div>}
        {estado === 'ok' && (
          <>
            <h2 style={{ color: '#4ade80', textAlign: 'center', marginTop: 22 }}>{t('sucesso_titulo')}</h2>
            <p style={{ textAlign: 'center', color: '#ccc', fontSize: 14 }}>{t('sucesso_texto')}</p>
            {presentes.map(v => (
              <div key={v.codigo} style={{ marginTop: 18 }}>
                <CartaoVisualVale vale={v} idioma={idioma} t={t} comQr />
                <BotoesCompartilhar vale={v} t={t} />
              </div>
            ))}
            {bonus.map(v => (
              <div key={v.codigo} style={{ marginTop: 26 }}>
                <h3 style={{ color: OURO, margin: '0 0 8px' }}>{t('seu_bonus')}</h3>
                <CartaoVisualVale vale={v} idioma={idioma} t={t} />
                <div style={{ marginTop: 10 }}>
                  <a style={estilos.botaoContorno} href={`/valepresente/${v.codigo}`}>{t('abrir_vale')}</a>
                </div>
              </div>
            ))}
            <p style={{ color: '#999', fontSize: 12, marginTop: 22, textAlign: 'center' }}>{t('guarde_pagina')}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// /valepresente/:codigo
// ---------------------------------------------------------------------------
const COR_STATUS = { ativo: '#4ade80', reservado: OURO, usado: '#999', expirado: '#f87171', perdido: '#f87171', cancelado: '#f87171', pendente: '#fbbf24' };

function TelaVale({ codigo, idioma, setIdioma, t }) {
  const [vale, setVale] = useState(undefined);

  useEffect(() => {
    consultarVale(codigo).then(setVale).catch(() => setVale({ encontrado: false }));
  }, [codigo]);

  const agendar = () => {
    const destino = new URL(`${ORIGEM_PUBLICA}/`);
    destino.searchParams.set('aba', 'agendar');
    destino.searchParams.set('vale', vale.codigo);
    window.location.href = window.location.origin === ORIGEM_PUBLICA ? `/${destino.search}` : destino.toString();
  };

  return (
    <div style={estilos.pagina}>
      <Topo idioma={idioma} aoMudarIdioma={setIdioma} t={t} subtitulo={false} />
      <div style={estilos.conteudo}>
        {vale === undefined && <p style={{ textAlign: 'center', color: '#bbb', marginTop: 30 }}>{t('carregando')}</p>}
        {vale && !vale.encontrado && (
          <div style={{ ...estilos.card, textAlign: 'center' }}>
            <p style={{ color: '#fca5a5' }}>{t('nao_encontrado')}</p>
            <a href="/valepresente" style={estilos.botaoContorno}>{t('titulo')}</a>
          </div>
        )}
        {vale && vale.encontrado && (
          <>
            <div style={{ marginTop: 22 }}>
              <CartaoVisualVale vale={vale} idioma={idioma} t={t} />
            </div>
            <p style={{ textAlign: 'center', marginTop: 14, fontWeight: 'bold', color: COR_STATUS[vale.status] || '#ccc' }}>
              ● {t(`status_${vale.status}`)}
              {vale.status === 'reservado' && vale.reserva_data_hora && (
                <span style={{ display: 'block', color: '#ccc', fontWeight: 'normal', fontSize: 14, marginTop: 4 }}>
                  {t('reservado_em', { data: `${formatarDataVale(vale.reserva_data_hora, idioma)} ${String(vale.reserva_data_hora).slice(11, 16)}` })}
                </span>
              )}
            </p>
            {vale.status === 'ativo' && (
              <button type="button" style={{ ...estilos.botaoOuro, marginTop: 8 }} onClick={agendar}>📅 {t('agendar')}</button>
            )}
            <div style={estilos.card}>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#ccc', fontSize: 13, lineHeight: 1.7 }}>
                <li>{t('regra3')}</li>
                <li>{t('regra4')}</li>
                <li>{t('regra5')}</li>
              </ul>
            </div>
            <p style={{ textAlign: 'center', marginTop: 18 }}>
              <a href="/" style={{ color: OURO, fontSize: 14 }}>{t('voltar_site')}</a>
            </p>
            <p style={{ textAlign: 'center', color: '#777', fontSize: 12 }}>{t('endereco')}</p>
          </>
        )}
      </div>
    </div>
  );
}

function ValePresente() {
  const { codigo } = useParams();
  const [idioma, setIdioma] = useIdioma();
  const t = (chave, valores) => textoVale(idioma, chave, valores);

  useEffect(() => {
    document.title = `${textoVale(idioma, 'titulo')} · Kaizen Barber Shop`;
  }, [idioma]);

  if (codigo === 'sucesso') return <TelaSucesso idioma={idioma} setIdioma={setIdioma} t={t} />;
  if (codigo) return <TelaVale codigo={codigo} idioma={idioma} setIdioma={setIdioma} t={t} />;
  return <TelaCompra idioma={idioma} setIdioma={setIdioma} t={t} />;
}

export default ValePresente;
