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
    cartoes: 'Cartões criados', cuponsAtivos: 'Descontos ativos', convertidos: '1ª visita realizada',
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
    passo4: '4. Indicação: o amigo entra pelo link do cliente e ganha {pct}% na 1ª visita. Quando ele vem, quem indicou ganha um cupom: {ini}% na 1ª indicação, depois {ini2}%, {ini3}%… até o mínimo de {min}%. Se passar {dias} dias sem indicar, volta para {ini}%.',
    indInicial: 'Indicação: 1º cupom (%)', indReducao: 'Indicação: reduz a cada nova (%)', indMinimo: 'Indicação: mínimo (%)',
    descontos: '🎟️ Descontos', descontosSub: 'Quem tem desconto, quanto e até quando. O desconto entra sozinho no próximo agendamento do cliente. Cupom vencido sem uso some da lista.',
    abaAtivos: 'Ativos ({n})', abaUsados: 'Usados ({n})',
    colTipo: 'Tipo', colDesconto: 'Desconto', colValidade: 'Válido até', colSituacao: 'Situação', colValor: 'Valor',
    tipo1a: '1ª visita', tipoInd: 'Indicação', trouxe: 'trouxe {n}',
    stDisponivel: 'Disponível', stAgendado: 'Agendado {d}', stUsado: 'Usado {d}',
    nenhumDesconto: 'Nenhum desconto aqui.',
    exemplo: 'ex.: {v}', regrasVazias: 'Defina as regras do seu programa e marque "Programa ativo" para começar.',
    faltaRegras: 'Para ativar o programa, preencha: {campos}.',
    carimbo: 'Carimbo do cartão', carimboTesoura: '✂️ Tesoura', carimboLogo: 'Logo da barbearia', carimboImagem: 'Imagem própria',
    semLogo: 'Cadastre a logo na aba Visual para usar esta opção.', enviarImagem: 'Enviar imagem', enviando: 'Enviando...',
    carimboDica: 'Imagem quadrada; ela aparece recortada em círculo.',
    qrCartazSemDesconto: 'Cartão Fidelidade',
    passo5: '5. Quando aparecer uma recompensa aqui, entregue e clique em "Entregar" para dar baixa.',
    qrCartaz: '{pct}% OFF', qrCartazSub: 'na sua 1ª visita', qrCartazRodape: 'Aponte a câmera e salve seu cartão fidelidade',
  },
  en: {
    titulo: '🎁 Digital Loyalty Card',
    sub: 'First-visit coupon via QR code + stamp card on the customer\'s phone.',
    cartoes: 'Cards created', cuponsAtivos: 'Active discounts', convertidos: 'First visit completed',
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
    passo4: '4. Referral: the friend joins through the customer\'s link and gets {pct}% off the first visit. When the friend comes, the referrer gets a coupon: {ini}% for the 1st referral, then {ini2}%, {ini3}%… down to {min}%. After {dias} days without a referral it goes back to {ini}%.',
    indInicial: 'Referral: 1st coupon (%)', indReducao: 'Referral: decrease per new one (%)', indMinimo: 'Referral: minimum (%)',
    descontos: '🎟️ Discounts', descontosSub: 'Who has a discount, how much and until when. It is applied automatically to the customer\'s next booking. Expired unused coupons disappear from the list.',
    abaAtivos: 'Active ({n})', abaUsados: 'Used ({n})',
    colTipo: 'Type', colDesconto: 'Discount', colValidade: 'Valid until', colSituacao: 'Status', colValor: 'Amount',
    tipo1a: 'First visit', tipoInd: 'Referral', trouxe: 'brought {n}',
    stDisponivel: 'Available', stAgendado: 'Booked {d}', stUsado: 'Used {d}',
    nenhumDesconto: 'No discounts here.',
    exemplo: 'e.g. {v}', regrasVazias: 'Set your program rules and tick "Program active" to start.',
    faltaRegras: 'To activate the program, fill in: {campos}.',
    carimbo: 'Card stamp', carimboTesoura: '✂️ Scissors', carimboLogo: 'Shop logo', carimboImagem: 'Custom image',
    semLogo: 'Upload your logo in the Visual tab to use this option.', enviarImagem: 'Upload image', enviando: 'Uploading...',
    carimboDica: 'Square image; it is shown cropped into a circle.',
    qrCartazSemDesconto: 'Loyalty Card',
    passo5: '5. When a reward shows up here, hand it out and click "Hand out" to record it.',
    qrCartaz: '{pct}% OFF', qrCartazSub: 'your first visit', qrCartazRodape: 'Scan to save your loyalty card',
  },
  ja: {
    titulo: '🎁 デジタルポイントカード',
    sub: 'QRコードで初回クーポン＋お客様のスマホにスタンプカード。',
    cartoes: '発行カード数', cuponsAtivos: '有効な割引', convertidos: '初回来店済み',
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
    passo4: '4. 紹介：お友達はお客様のリンクから登録し初回{pct}% OFF。お友達が来店すると紹介者にクーポン：1人目{ini}%、次は{ini2}%、{ini3}%…最低{min}%。{dias}日間紹介がなければ{ini}%に戻ります。',
    indInicial: '紹介：最初のクーポン（%）', indReducao: '紹介：1人ごとの減少（%）', indMinimo: '紹介：最低（%）',
    descontos: '🎟️ 割引一覧', descontosSub: '割引を持つお客様・割引率・有効期限。次回のご予約に自動で適用されます。期限切れの未使用クーポンは表示されません。',
    abaAtivos: '有効（{n}）', abaUsados: '使用済み（{n}）',
    colTipo: '種類', colDesconto: '割引', colValidade: '有効期限', colSituacao: '状況', colValor: '金額',
    tipo1a: '初回', tipoInd: '紹介', trouxe: '{n}様をご紹介',
    stDisponivel: '利用可能', stAgendado: '予約済み {d}', stUsado: '使用済み {d}',
    nenhumDesconto: '割引はありません。',
    exemplo: '例：{v}', regrasVazias: 'ルールを設定し「プログラム有効」にチェックすると開始できます。',
    faltaRegras: 'プログラムを有効にするには次を入力してください：{campos}。',
    carimbo: 'スタンプのデザイン', carimboTesoura: '✂️ ハサミ', carimboLogo: '店舗ロゴ', carimboImagem: 'オリジナル画像',
    semLogo: 'この設定を使うには「ビジュアル」タブでロゴを登録してください。', enviarImagem: '画像をアップロード', enviando: 'アップロード中...',
    carimboDica: '正方形の画像がおすすめです（円形に切り抜かれます）。',
    qrCartazSemDesconto: 'ポイントカード',
    passo5: '5. 特典が表示されたらお渡しし、「渡す」をクリックして記録してください。',
    qrCartaz: '初回 {pct}% OFF', qrCartazSub: '', qrCartazRodape: 'カメラで読み取ってポイントカードを保存',
  },
};

const fmt = (texto, valores) => Object.entries(valores || {}).reduce(
  (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v), texto);

const CAMPOS_CONFIG = ['ativo', 'desconto_primeira_visita_pct', 'validade_cupom_dias', 'meta_selos', 'selo_brinde',
  'selos_boas_vindas', 'indicacao_pct_inicial', 'indicacao_reducao_pct', 'indicacao_minimo_pct',
  'brinde_pt', 'brinde_en', 'brinde_ja', 'premio_pt', 'premio_en', 'premio_ja'];

const CAMPOS_NUMERICOS = ['desconto_primeira_visita_pct', 'validade_cupom_dias', 'meta_selos', 'selo_brinde', 'selos_boas_vindas',
  'indicacao_pct_inicial', 'indicacao_reducao_pct', 'indicacao_minimo_pct'];

// opcoesSelo (só no Kaizen Flow): { logoUrl, enviarImagem(arquivo) → url } — habilita a escolha do carimbo.
function FidelidadeAdminPainel({ api, idioma = 'pt-BR', nomeLoja, linkEntrada, linkCartao, opcoesSelo }) {
  const T = TEXTOS[idioma] || TEXTOS['pt-BR'];
  const t = useCallback((k, v) => fmt(T[k] ?? TEXTOS['pt-BR'][k] ?? k, v), [T]);
  const locale = idioma === 'ja' ? 'ja-JP' : idioma === 'en' ? 'en-US' : 'pt-BR';

  const [linhas, setLinhas] = useState([]);
  const [descontos, setDescontos] = useState([]);
  const [abaDescontos, setAbaDescontos] = useState('ativos');
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [soRecompensas, setSoRecompensas] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [copiado, setCopiado] = useState('');
  const qrRef = useRef(null);
  const [enviandoSelo, setEnviandoSelo] = useState(false);
  const camposConfig = useMemo(() => (opcoesSelo ? [...CAMPOS_CONFIG, 'selo_estilo', 'selo_imagem_url'] : CAMPOS_CONFIG), [opcoesSelo]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [r, c, d] = await Promise.all([api.resumo(), api.config(), api.descontos ? api.descontos() : []]);
      setLinhas(r || []);
      setDescontos(d || []);
      setConfig(c);
      setForm(c ? Object.fromEntries(camposConfig.map((k) => [k, c[k] ?? ''])) : null);
    } catch (e) {
      alert(t('erro', { m: e.message }));
    } finally {
      setCarregando(false);
    }
  }, [api, t, camposConfig]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarConfig = async (e) => {
    e.preventDefault();
    try {
      const campos = { ...form };
      CAMPOS_NUMERICOS.forEach((k) => { campos[k] = campos[k] === '' || campos[k] == null ? null : Number(campos[k]); });
      campos.selos_boas_vindas = campos.selos_boas_vindas ?? 0;
      campos.selo_brinde = campos.selo_brinde > 0 ? campos.selo_brinde : null;
      Object.keys(campos).filter((k) => /^(brinde|premio)_/.test(k) || k === 'selo_imagem_url')
        .forEach((k) => { campos[k] = String(campos[k] ?? '').trim() || null; });
      if (campos.ativo) {
        const faltando = [
          campos.desconto_primeira_visita_pct == null && t('pct'),
          campos.validade_cupom_dias == null && t('validade'),
          campos.meta_selos == null && t('meta'),
          !campos.premio_pt && `${t('premio')} (PT)`,
          campos.selo_brinde && !campos.brinde_pt && `${t('brinde')} (PT)`,
        ].filter(Boolean);
        if (faltando.length) { alert(t('faltaRegras', { campos: faltando.join(', ') })); return; }
      }
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
      <div class="pct">${config?.desconto_primeira_visita_pct > 0 ? t('qrCartaz', { pct: config.desconto_primeira_visita_pct }) : t('qrCartazSemDesconto')}</div>
      <div class="sub">${config?.desconto_primeira_visita_pct > 0 ? t('qrCartazSub') : ''}</div>${svg}<div class="rodape">${t('qrCartazRodape')}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const resumo = useMemo(() => ({
    cartoes: linhas.filter((l) => l.tem_cartao).length,
    cuponsAtivos: descontos.filter((d) => d.status !== 'usado').length,
    convertidos: linhas.filter((l) => l.estado?.cupom?.usado_em).length,
    pendentes: linhas.reduce((s, l) => s + (l.estado?.recompensas_pendentes?.length || 0), 0),
    indicacoes: linhas.reduce((s, l) => s + (l.estado?.indicacoes_creditadas || 0), 0),
  }), [linhas, descontos]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDig = q.replace(/\D/g, '');
    return linhas.filter((l) => {
      if (soRecompensas && !(l.estado?.recompensas_pendentes?.length > 0)) return false;
      if (!q) return true;
      return (l.nome || '').toLowerCase().includes(q) || (qDig && (l.telefone || '').replace(/\D/g, '').includes(qDig));
    });
  }, [linhas, busca, soRecompensas]);

  const descontosAtivos = descontos.filter((d) => d.status !== 'usado');
  const descontosUsados = descontos.filter((d) => d.status === 'usado');
  const dataCurta = (v) => (v ? new Date(String(v).length === 10 ? `${v}T12:00:00` : v).toLocaleDateString(locale) : '');
  const dataHora = (v) => (v ? new Date(v).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  const numero = (v) => Number(v).toLocaleString(locale);

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
            {opcoesSelo && !config?.ativo && (
              <p style={{ background: '#3b2f0b', color: '#fde68a', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{t('regrasVazias')}</p>
            )}
            <label style={{ ...estilos.label, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              {t('ativo')}
            </label>
            <div style={estilos.grade}>
              {[['desconto_primeira_visita_pct', 'pct', 0, 100, 30], ['validade_cupom_dias', 'validade', 1, 365, 30],
                ['meta_selos', 'meta', 3, 30, 8], ['selo_brinde', 'seloBrinde', 0, 29, 4], ['selos_boas_vindas', 'boasVindas', 0, 5, 0],
                ['indicacao_pct_inicial', 'indInicial', 0, 100, 20], ['indicacao_reducao_pct', 'indReducao', 0, 100, 5],
                ['indicacao_minimo_pct', 'indMinimo', 0, 100, 5]]
                .map(([campo, rotulo, min, max, ex]) => (
                  <label key={campo} style={estilos.label}>
                    {t(rotulo)}
                    <input type="number" min={min} max={max} value={form[campo] ?? ''} style={estilos.input}
                      placeholder={t('exemplo', { v: ex })}
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
                      placeholder={lang === 'pt' ? t('exemplo', { v: tipo === 'brinde' ? 'Pomada de brinde' : 'Corte grátis' }) : ''}
                      onChange={(e) => setForm({ ...form, [`${tipo}_${lang}`]: e.target.value })} />
                  </label>
                ))}
              </div>
            ))}
            {opcoesSelo && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: '#ccc', fontSize: 13, marginBottom: 6 }}>{t('carimbo')}</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[['tesoura', 'carimboTesoura'], ['logo', 'carimboLogo'], ['imagem', 'carimboImagem']].map(([v, rotulo]) => (
                    <label key={v} style={{ color: '#e8e8e8', display: 'flex', gap: 6, alignItems: 'center', fontSize: 14,
                      opacity: v === 'logo' && !opcoesSelo.logoUrl ? 0.5 : 1 }}>
                      <input type="radio" name="selo_estilo" value={v} checked={(form.selo_estilo || 'tesoura') === v}
                        disabled={v === 'logo' && !opcoesSelo.logoUrl}
                        onChange={async () => {
                          setForm((f) => ({ ...f, selo_estilo: v, ...(v !== 'imagem' ? { selo_imagem_url: '' } : {}) }));
                          if (v !== 'logo') return;
                          // cópia pequena da logo para o carimbo (se falhar, usa a logo original)
                          setEnviandoSelo(true);
                          try {
                            const url = await opcoesSelo.enviarImagem(opcoesSelo.logoUrl);
                            setForm((f) => (f.selo_estilo === 'logo' ? { ...f, selo_imagem_url: url } : f));
                          } catch { /* fica com a logo original */ } finally {
                            setEnviandoSelo(false);
                          }
                        }} />
                      {t(rotulo)}
                    </label>
                  ))}
                  <div style={estilos.previaSelo}>
                    {(() => {
                      const url = form.selo_estilo === 'logo' ? (form.selo_imagem_url || opcoesSelo.logoUrl)
                        : form.selo_estilo === 'imagem' ? form.selo_imagem_url : null;
                      return url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '✂';
                    })()}
                  </div>
                </div>
                {!opcoesSelo.logoUrl && <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{t('semLogo')}</div>}
                {form.selo_estilo === 'imagem' && (
                  <div style={{ marginTop: 8 }}>
                    <label className="btn-secondary" style={{ ...estilos.botaoPequeno, display: 'inline-block', cursor: 'pointer' }}>
                      {enviandoSelo ? t('enviando') : t('enviarImagem')}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={enviandoSelo}
                        onChange={async (e) => {
                          const arquivo = e.target.files?.[0];
                          if (!arquivo) return;
                          setEnviandoSelo(true);
                          try {
                            const url = await opcoesSelo.enviarImagem(arquivo);
                            setForm((f) => ({ ...f, selo_imagem_url: url }));
                          } catch (err) {
                            alert(t('erro', { m: err.message }));
                          } finally {
                            setEnviandoSelo(false);
                            e.target.value = '';
                          }
                        }} />
                    </label>
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>{t('carimboDica')}</span>
                  </div>
                )}
              </div>
            )}
            <button type="submit" className="btn-primary" style={{ marginTop: 14 }} disabled={enviandoSelo}>
              {enviandoSelo ? t('enviando') : salvo ? t('salvo') : t('salvar')}
            </button>
          </form>
        )}
      </div>

      {/* Descontos */}
      <section className="list-section" style={{ marginTop: 24 }}>
        <h3>{t('descontos')}</h3>
        <p style={{ color: '#999', marginTop: -6, fontSize: 13 }}>{t('descontosSub')}</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['ativos', 'abaAtivos', descontosAtivos.length], ['usados', 'abaUsados', descontosUsados.length]].map(([k, rotulo, n]) => (
            <button key={k} onClick={() => setAbaDescontos(k)}
              className={abaDescontos === k ? 'btn-primary' : 'btn-secondary'} style={estilos.botaoPequeno}>
              {t(rotulo, { n })}
            </button>
          ))}
        </div>
        {(abaDescontos === 'ativos' ? descontosAtivos : descontosUsados).length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('nenhumDesconto')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('colCliente')}</th><th>{t('colTipo')}</th><th>{t('colDesconto')}</th>
                  <th>{t('colValidade')}</th><th>{t('colSituacao')}</th><th>{t('colValor')}</th>
                </tr>
              </thead>
              <tbody>
                {(abaDescontos === 'ativos' ? descontosAtivos : descontosUsados).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{d.nome}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{d.telefone}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {d.tipo === 'indicacao' ? `🤝 ${t('tipoInd')}` : `🎟️ ${t('tipo1a')}`}
                      {d.indicado_nome && <div style={{ fontSize: 12, color: '#999' }}>{t('trouxe', { n: d.indicado_nome })}</div>}
                    </td>
                    <td style={{ color: OURO, fontWeight: 'bold', fontSize: 18 }}>{d.pct}%</td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{dataCurta(d.expira_em)}</td>
                    <td style={{ fontSize: 13 }}>
                      {d.status === 'disponivel' && <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{t('stDisponivel')}</span>}
                      {d.status === 'agendado' && <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{t('stAgendado', { d: dataHora(d.agendamento_data) })}</span>}
                      {d.status === 'usado' && <span style={{ color: '#4ade80' }}>{t('stUsado', { d: d.usado_em ? dataCurta(d.usado_em) : '' })}</span>}
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      {d.preco_antes != null && d.preco_final != null ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#777' }}>{numero(d.preco_antes)}</span>
                          {' → '}<b>{numero(d.preco_final)}</b>
                          <div style={{ color: '#f472b6', fontSize: 12 }}>−{numero(d.preco_antes - d.preco_final)}</div>
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
          <p>{t('passo1', { pct: config?.desconto_primeira_visita_pct ?? '—', dias: config?.validade_cupom_dias ?? '—' })}</p>
          <p>{t('passo2')}</p>
          <p>{t('passo3', { b: config?.selo_brinde || '—', brinde: nomeRec('brinde'), m: meta, premio: nomeRec('premio') })}</p>
          <p>{t('passo4', {
            pct: config?.desconto_primeira_visita_pct ?? '—', dias: config?.validade_cupom_dias ?? '—', min: config?.indicacao_minimo_pct ?? 0,
            ini: config?.indicacao_pct_inicial ?? 0,
            ini2: Math.max((config?.indicacao_pct_inicial ?? 0) - (config?.indicacao_reducao_pct ?? 0), config?.indicacao_minimo_pct ?? 0),
            ini3: Math.max((config?.indicacao_pct_inicial ?? 0) - 2 * (config?.indicacao_reducao_pct ?? 0), config?.indicacao_minimo_pct ?? 0),
          })}</p>
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
  previaSelo: { width: 52, height: 52, borderRadius: '50%', border: `2px solid ${OURO}`, overflow: 'hidden', background: OURO,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#1a1a1a' },
};

export default FidelidadeAdminPainel;
