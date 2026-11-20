import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ============================================================================
// Painel admin do Cartão Fidelidade digital (as duas bases usam este mesmo
// componente; cada uma passa seu `api`):
//   api.resumo()                 → linhas { cliente_id, nome, telefone, tem_cartao, token, estado }
//   api.config()                 → linha crua de config_fidelidade
//   api.salvarConfig(campos)     → grava
//   api.resgatar(clienteId, marco)
//   api.tokenCliente(clienteId)  → token (cria o cartão se preciso)
// ============================================================================

const OURO = '#d4af37';

const TEXTOS = {
  'pt-BR': {
    titulo: '🎁 Cartão Fidelidade Digital',
    sub: 'Cupom de 1ª visita pelo QR code + cartão de selos no celular do cliente.',
    cartoes: 'Cartões criados', cuponsAtivos: 'Cupons de 1ª visita ativos', convertidos: '1ª visita realizada',
    pendentes: 'Recompensas a entregar', indicacoes: 'Indicações que vieram',
    qrTitulo: 'QR code do balcão', qrTexto: 'Imprima e deixe no balcão, no espelho e no cartão de visita. Também serve para a bio do Instagram:',
    imprimir: '🖨️ Imprimir', copiarLink: '📋 Copiar link', copiado: '✅ Copiado',
    config: '⚙️ Regras do programa', ativo: 'Programa ativo', pct: 'Desconto na 1ª visita (%)', validade: 'Validade do cupom (dias)',
    meta: 'Selos para o prêmio', seloBrinde: 'Selo do brinde (0 = sem brinde)', boasVindas: 'Selos de boas-vindas',
    brinde: 'Brinde', premio: 'Prêmio', salvar: 'Salvar regras', salvo: '✅ Regras salvas',
    clientes: '👥 Clientes', buscar: 'Buscar por nome ou telefone...', so_recompensas: 'Só com recompensa a entregar',
    colCliente: 'Cliente', colSelos: 'Selos', colCupom: 'Cupom 1ª visita', colRecompensas: 'Recompensas', colAcoes: 'Ações',
    cupomAtivo: 'Ativo até {d}', cupomUsado: 'Usado', semCupom: '—',
    resgatarBrinde: 'Entregar brinde', resgatarPremio: 'Entregar prêmio', confirmarResgate: 'Confirmar entrega de "{r}" para {n}?',
    linkCartao: '🔗 Link', whatsapp: 'WhatsApp', msgWhats: 'Oi {n}! Aqui está seu cartão fidelidade da {loja}: {link}',
    nenhum: 'Nenhum cliente ainda.', carregando: 'Carregando...', erro: 'Erro: {m}',
    comoFunciona: '📋 Como funciona',
    passo1: '1. O cliente aponta a câmera para o QR code e recebe {pct}% OFF na 1ª visita (válido por {dias} dias).',
    passo2: '2. O desconto entra sozinho quando ele agenda. Não acumula com promoções nem com o desconto de recorrência; vale o maior.',
    passo3: '3. Cada atendimento realizado vira 1 selo no cartão. Selo {b}: {brinde}. Selo {m}: {premio}. Depois o cartão recomeça.',
    passo4: '4. Indicação: o amigo entra pelo link do cliente; quando ele vem pela 1ª vez, o cliente ganha +1 selo.',
    passo5: '5. Quando aparecer uma recompensa aqui, entregue e clique em "Entregar" para dar baixa.',
    qrCartaz: '{pct}% OFF', qrCartazSub: 'na sua 1ª visita', qrCartazRodape: 'Aponte a câmera e salve seu cartão fidelidade',
  },
  en: {
    titulo: '🎁 Digital Loyalty Card',
    sub: 'First-visit coupon via QR code + stamp card on the customer\'s phone.',
    cartoes: 'Cards created', cuponsAtivos: 'Active first-visit coupons', convertidos: 'First visit completed',
    pendentes: 'Rewards to hand out', indicacoes: 'Referrals who came',
    qrTitulo: 'Counter QR code', qrTexto: 'Print it for the counter, mirror and business cards. Also works in your Instagram bio:',
    imprimir: '🖨️ Print', copiarLink: '📋 Copy link', copiado: '✅ Copied',
    config: '⚙️ Program rules', ativo: 'Program active', pct: 'First-visit discount (%)', validade: 'Coupon validity (days)',
    meta: 'Stamps for the reward', seloBrinde: 'Gift stamp (0 = no gift)', boasVindas: 'Welcome stamps',
    brinde: 'Gift', premio: 'Reward', salvar: 'Save rules', salvo: '✅ Rules saved',
    clientes: '👥 Customers', buscar: 'Search by name or phone...', so_recompensas: 'Only with rewards to hand out',
    colCliente: 'Customer', colSelos: 'Stamps', colCupom: 'First-visit coupon', colRecompensas: 'Rewards', colAcoes: 'Actions',
    cupomAtivo: 'Active until {d}', cupomUsado: 'Used', semCupom: '—',
    resgatarBrinde: 'Hand out gift', resgatarPremio: 'Hand out reward', confirmarResgate: 'Confirm handing out "{r}" to {n}?',
    linkCartao: '🔗 Link', whatsapp: 'WhatsApp', msgWhats: 'Hi {n}! Here is your {loja} loyalty card: {link}',
    nenhum: 'No customers yet.', carregando: 'Loading...', erro: 'Error: {m}',
    comoFunciona: '📋 How it works',
    passo1: '1. The customer scans the QR code and gets {pct}% OFF their first visit (valid for {dias} days).',
    passo2: '2. The discount is applied automatically when they book. It does not stack with promotions or the recurrence discount; the best one wins.',
    passo3: '3. Each completed visit is 1 stamp. Stamp {b}: {brinde}. Stamp {m}: {premio}. Then the card starts over.',
    passo4: '4. Referral: a friend joins through the customer\'s link; when the friend comes for the first time, the customer gets +1 stamp.',
    passo5: '5. When a reward shows up here, hand it out and click "Hand out" to record it.',
    qrCartaz: '{pct}% OFF', qrCartazSub: 'your first visit', qrCartazRodape: 'Scan to save your loyalty card',
  },
  ja: {
    titulo: '🎁 デジタルポイントカード',
    sub: 'QRコードで初回クーポン＋お客様のスマホにスタンプカード。',
    cartoes: '発行カード数', cuponsAtivos: '有効な初回クーポン', convertidos: '初回来店済み',
    pendentes: '未渡しの特典', indicacoes: '紹介で来店',
    qrTitulo: '受付用QRコード', qrTexto: '受付・鏡・ショップカードに印刷してください。Instagramのプロフィールにも使えます：',
    imprimir: '🖨️ 印刷', copiarLink: '📋 リンクをコピー', copiado: '✅ コピーしました',
    config: '⚙️ ルール設定', ativo: 'プログラム有効', pct: '初回割引（%）', validade: 'クーポン有効期限（日）',
    meta: '特典までのスタンプ数', seloBrinde: 'プレゼントのスタンプ（0＝なし）', boasVindas: '登録特典スタンプ',
    brinde: 'プレゼント', premio: '特典', salvar: '保存', salvo: '✅ 保存しました',
    clientes: '👥 お客様', buscar: '名前・電話番号で検索...', so_recompensas: '未渡しの特典があるお客様のみ',
    colCliente: 'お客様', colSelos: 'スタンプ', colCupom: '初回クーポン', colRecompensas: '特典', colAcoes: '操作',
    cupomAtivo: '{d}まで有効', cupomUsado: '使用済み', semCupom: '—',
    resgatarBrinde: 'プレゼントを渡す', resgatarPremio: '特典を渡す', confirmarResgate: '{n}様に「{r}」を渡しましたか？',
    linkCartao: '🔗 リンク', whatsapp: 'WhatsApp', msgWhats: '{n}様、{loja}のポイントカードです：{link}',
    nenhum: 'まだお客様がいません。', carregando: '読み込み中...', erro: 'エラー：{m}',
    comoFunciona: '📋 仕組み',
    passo1: '1. お客様がQRコードを読み取ると、初回{pct}% OFF（{dias}日間有効）。',
    passo2: '2. 予約時に自動で割引。キャンペーンやリピート割引とは併用不可（お得な方を適用）。',
    passo3: '3. 来店ごとにスタンプ1個。{b}個目：{brinde}。{m}個目：{premio}。その後カードはリセット。',
    passo4: '4. 紹介：お友達がお客様のリンクから登録し、初来店するとお客様にスタンプ+1個。',
    passo5: '5. 特典が表示されたらお渡しし、「渡す」をクリックして記録してください。',
    qrCartaz: '初回 {pct}% OFF', qrCartazSub: '', qrCartazRodape: 'カメラで読み取ってポイントカードを保存',
  },
};

const fmt = (texto, valores) => Object.entries(valores || {}).reduce(
  (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v), texto);

const CAMPOS_CONFIG = ['ativo', 'desconto_primeira_visita_pct', 'validade_cupom_dias', 'meta_selos', 'selo_brinde',
  'selos_boas_vindas', 'brinde_pt', 'brinde_en', 'brinde_ja', 'premio_pt', 'premio_en', 'premio_ja'];

function FidelidadeAdminPainel({ api, idioma = 'pt-BR', nomeLoja, linkEntrada, linkCartao }) {
  const T = TEXTOS[idioma] || TEXTOS['pt-BR'];
  const t = useCallback((k, v) => fmt(T[k] ?? TEXTOS['pt-BR'][k] ?? k, v), [T]);
  const locale = idioma === 'ja' ? 'ja-JP' : idioma === 'en' ? 'en-US' : 'pt-BR';

  const [linhas, setLinhas] = useState([]);
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [soRecompensas, setSoRecompensas] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [copiado, setCopiado] = useState('');
  const qrRef = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [r, c] = await Promise.all([api.resumo(), api.config()]);
      setLinhas(r || []);
      setConfig(c);
      setForm(c ? Object.fromEntries(CAMPOS_CONFIG.map((k) => [k, c[k] ?? ''])) : null);
    } catch (e) {
      alert(t('erro', { m: e.message }));
    } finally {
      setCarregando(false);
    }
  }, [api, t]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarConfig = async (e) => {
    e.preventDefault();
    try {
      const campos = { ...form };
      ['desconto_primeira_visita_pct', 'validade_cupom_dias', 'meta_selos', 'selos_boas_vindas'].forEach((k) => { campos[k] = Number(campos[k]); });
      campos.selo_brinde = Number(campos.selo_brinde) > 0 ? Number(campos.selo_brinde) : null;
      await api.salvarConfig(campos);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
      carregar();
    } catch (err) {
      alert(t('erro', { m: err.message }));
    }
  };

  const copiar = async (texto, chave) => {
    try { await navigator.clipboard.writeText(texto); } catch { window.prompt('', texto); }
    setCopiado(chave);
    setTimeout(() => setCopiado(''), 2000);
  };

  const urlCartao = async (linha) => {
    const token = linha.token || await api.tokenCliente(linha.cliente_id);
    return linkCartao(token);
  };

  const enviarWhats = async (linha) => {
    const link = await urlCartao(linha);
    const tel = (linha.telefone || '').replace(/\D/g, '');
    const telIntl = tel.startsWith('0') ? `81${tel.slice(1)}` : tel;  // números antigos sem +, do Japão
    const msg = t('msgWhats', { n: (linha.nome || '').split(' ')[0], loja: nomeLoja, link });
    window.open(`https://wa.me/${telIntl}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const resgatar = async (linha, p) => {
    const recompensa = p.tipo === 'premio' ? config?.[`premio_${idioma === 'pt-BR' ? 'pt' : idioma}`] || config?.premio_pt
      : config?.[`brinde_${idioma === 'pt-BR' ? 'pt' : idioma}`] || config?.brinde_pt;
    if (!window.confirm(t('confirmarResgate', { r: recompensa, n: linha.nome }))) return;
    try {
      await api.resgatar(linha.cliente_id, p.marco);
      carregar();
    } catch (err) {
      alert(t('erro', { m: err.message }));
    }
  };

  const imprimirQR = () => {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML || '';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${nomeLoja}</title>
      <style>body{font-family:-apple-system,"Hiragino Sans",sans-serif;text-align:center;margin:0;padding:40px;color:#111}
      .loja{letter-spacing:4px;font-weight:800;font-size:22px}.pct{font-size:64px;font-weight:900;margin:16px 0 0}
      .sub{font-size:24px;margin:0 0 24px}svg{width:300px;height:300px}.rodape{font-size:18px;margin-top:20px}</style></head>
      <body><div class="loja">${nomeLoja.toUpperCase()}</div>
      <div class="pct">${t('qrCartaz', { pct: config?.desconto_primeira_visita_pct ?? 40 })}</div>
      <div class="sub">${t('qrCartazSub')}</div>${svg}<div class="rodape">${t('qrCartazRodape')}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const resumo = useMemo(() => ({
    cartoes: linhas.filter((l) => l.tem_cartao).length,
    cuponsAtivos: linhas.filter((l) => l.estado?.cupom?.ativo).length,
    convertidos: linhas.filter((l) => l.estado?.cupom?.usado_em).length,
    pendentes: linhas.reduce((s, l) => s + (l.estado?.recompensas_pendentes?.length || 0), 0),
    indicacoes: linhas.reduce((s, l) => s + (l.estado?.indicacoes_creditadas || 0), 0),
  }), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = q.replace(/\D/g, '');
    return linhas.filter((l) => {
      if (soRecompensas && !(l.estado?.recompensas_pendentes?.length > 0)) return false;
      if (!q) return true;
      return (l.nome || '').toLowerCase().includes(q) || (qDig && (l.telefone || '').replace(/\D/g, '').includes(qDig));
    });
  }, [linhas, busca, soRecompensas]);

  const meta = config?.meta_selos || 10;
  const nomeRec = (k) => config?.[`${k}_${idioma === 'pt-BR' ? 'pt' : idioma}`] || config?.[`${k}_pt`] || '';

  if (carregando && !config) return <div className="page-container"><p style={{ color: OURO }}>{t('carregando')}</p></div>;

  return (
    <div className="page-container">
      <h2>{t('titulo')}</h2>
      <p style={{ color: '#999', marginTop: -8 }}>{t('sub')}</p>

      <section className="caixa-status">
        {[
          ['cartoes', resumo.cartoes, OURO], ['cuponsAtivos', resumo.cuponsAtivos, '#60a5fa'],
          ['convertidos', resumo.convertidos, '#4ade80'], ['pendentes', resumo.pendentes, '#f472b6'],
          ['indicacoes', resumo.indicacoes, '#fbbf24'],
        ].map(([k, v, cor]) => (
          <div className="status-card" key={k}>
            <h3>{t(k)}</h3>
            <p style={{ fontSize: 32, color: cor, fontWeight: 'bold', margin: '10px 0' }}>{v}</p>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
        {/* QR code */}
        <section style={{ ...estilos.caixa, flex: '1 1 280px', textAlign: 'center' }}>
          <h3 style={{ color: OURO, marginTop: 0 }}>{t('qrTitulo')}</h3>
          <div ref={qrRef} style={{ background: '#fff', display: 'inline-block', padding: 14, borderRadius: 12 }}>
            <QRCodeSVG value={linkEntrada} size={180} level="M" />
          </div>
          <p style={{ color: '#ccc', fontSize: 13 }}>{t('qrTexto')}</p>
          <code style={{ color: OURO, fontSize: 12, wordBreak: 'break-all' }}>{linkEntrada}</code>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button className="btn-primary" onClick={imprimirQR}>{t('imprimir')}</button>
            <button className="btn-secondary" onClick={() => copiar(linkEntrada, 'qr')}>{copiado === 'qr' ? t('copiado') : t('copiarLink')}</button>
          </div>
        </section>

        {/* Regras */}
        {form && (
          <form onSubmit={salvarConfig} style={{ ...estilos.caixa, flex: '2 1 420px' }}>
            <h3 style={{ color: OURO, marginTop: 0 }}>{t('config')}</h3>
            <label style={{ ...estilos.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              {t('ativo')}
            </label>
            <div style={estilos.grade}>
              {[['desconto_primeira_visita_pct', 'pct', 0, 100], ['validade_cupom_dias', 'validade', 1, 365],
                ['meta_selos', 'meta', 3, 30], ['selo_brinde', 'seloBrinde', 0, 29], ['selos_boas_vindas', 'boasVindas', 0, 5]]
                .map(([campo, rotulo, min, max]) => (
                  <label key={campo} style={estilos.label}>
                    {t(rotulo)}
                    <input type="number" min={min} max={max} value={form[campo] ?? ''} style={estilos.input}
                      onChange={(e) => setForm({ ...form, [campo]: e.target.value })} />
                  </label>
                ))}
            </div>
            {['brinde', 'premio'].map((tipo) => (
              <div key={tipo} style={estilos.grade}>
                {['pt', 'en', 'ja'].map((lang) => (
                  <label key={lang} style={estilos.label}>
                    {t(tipo)} ({lang.toUpperCase()})
                    <input value={form[`${tipo}_${lang}`] ?? ''} style={estilos.input} maxLength={60}
                      onChange={(e) => setForm({ ...form, [`${tipo}_${lang}`]: e.target.value })} />
                  </label>
                ))}
              </div>
            ))}
            <button type="submit" className="btn-primary" style={{ marginTop: 10 }}>{salvo ? t('salvo') : t('salvar')}</button>
          </form>
        )}
      </div>

      {/* Clientes */}
      <section className="list-section" style={{ marginTop: 24 }}>
        <h3>{t('clientes')}</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <input type="text" placeholder={t('buscar')} value={busca} onChange={(e) => setBusca(e.target.value)}
            style={{ ...estilos.input, width: 300, maxWidth: '100%' }} />
          <label style={{ color: '#ccc', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={soRecompensas} onChange={(e) => setSoRecompensas(e.target.checked)} />
            {t('so_recompensas')}
          </label>
        </div>

        {filtradas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('nenhum')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('colCliente')}</th><th>{t('colSelos')}</th><th>{t('colCupom')}</th>
                  <th>{t('colRecompensas')}</th><th>{t('colAcoes')}</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => {
                  const e = l.estado || {};
                  const cupom = e.cupom || {};
                  return (
                    <tr key={l.cliente_id}>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>{l.nome}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{l.telefone}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ color: OURO, fontWeight: 'bold' }}>{e.selos_no_ciclo ?? 0}/{meta}</span>
                        <span style={{ color: '#777', fontSize: 12 }}> · {e.selos_total ?? 0} total</span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {cupom.ativo
                          ? <span style={{ color: '#60a5fa' }}>{t('cupomAtivo', { d: new Date(`${cupom.expira_em}T12:00:00`).toLocaleDateString(locale) })}</span>
                          : cupom.usado_em ? <span style={{ color: '#4ade80' }}>{t('cupomUsado')}</span> : t('semCupom')}
                      </td>
                      <td>
                        {(e.recompensas_pendentes || []).map((p) => (
                          <button key={p.marco} onClick={() => resgatar(l, p)} style={estilos.botaoResgate}
                            title={p.tipo === 'premio' ? nomeRec('premio') : nomeRec('brinde')}>
                            {p.tipo === 'premio' ? `👑 ${t('resgatarPremio')}` : `🎁 ${t('resgatarBrinde')}`}
                          </button>
                        ))}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-secondary" style={estilos.botaoPequeno}
                          onClick={async () => copiar(await urlCartao(l), l.cliente_id)}>
                          {copiado === l.cliente_id ? t('copiado') : t('linkCartao')}
                        </button>
                        {l.telefone && (
                          <button className="btn-secondary" style={{ ...estilos.botaoPequeno, marginLeft: 6 }} onClick={() => enviarWhats(l)}>
                            {t('whatsapp')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ ...estilos.caixa, marginTop: 30 }}>
        <h3 style={{ color: OURO, marginTop: 0 }}>{t('comoFunciona')}</h3>
        <div style={{ color: '#e8e8e8', lineHeight: 1.8 }}>
          <p>{t('passo1', { pct: config?.desconto_primeira_visita_pct, dias: config?.validade_cupom_dias })}</p>
          <p>{t('passo2')}</p>
          <p>{t('passo3', { b: config?.selo_brinde || '—', brinde: nomeRec('brinde'), m: meta, premio: nomeRec('premio') })}</p>
          <p>{t('passo4')}</p>
          <p>{t('passo5')}</p>
        </div>
      </section>
    </div>
  );
}

const estilos = {
  caixa: { background: '#2d2d2d', border: `1px solid ${OURO}`, borderRadius: 12, padding: 20, boxSizing: 'border-box' },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, color: '#ccc', fontSize: 13 },
  input: { padding: 10, borderRadius: 6, border: `1px solid ${OURO}`, background: '#1f1f1f', color: '#e8e8e8', fontSize: 14 },
  botaoResgate: { display: 'block', margin: '2px 0', padding: '6px 10px', borderRadius: 6, border: 'none', background: '#4ade80', color: '#1a1a1a', fontWeight: 'bold', cursor: 'pointer', fontSize: 12 },
  botaoPequeno: { padding: '6px 10px', fontSize: 12 },
};

export default FidelidadeAdminPainel;
