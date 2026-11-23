import React, { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '../supabaseClient';
import { CartaoVisualVale } from './ValePresente';
import { textoVale, linkDoVale, formatarIenes, formatarDataVale } from '../config/valePresente';

// Admin > Vales Presente
// Venda no balcão, lista de vales, baixa/cancelamento e configuração da
// campanha. Regras no banco: supabase/migrations/20261124_vale_presente.sql

const OURO = '#d4af37';
const card = { background: '#2d2d2d', border: '1px solid #404040', borderRadius: 10, padding: 16, marginBottom: 16 };
const input = { width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' };
const botao = { padding: '10px 14px', background: OURO, color: '#1a1a1a', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' };
const botaoContorno = { padding: '6px 10px', background: 'transparent', color: OURO, border: `1px solid ${OURO}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', textDecoration: 'none' };

const ROTULO_STATUS = {
  pendente: '⏳ Aguardando pagamento', ativo: '🟢 Ativo', usado: '✅ Usado',
  perdido: '🔴 Perdido (faltas)', cancelado: '⚫ Cancelado',
};
const FORMAS = [
  { v: 'dinheiro', r: 'Dinheiro' }, { v: 'paypay', r: 'PayPay' }, { v: 'cartao', r: 'Cartão (maquininha)' },
  { v: 'transferencia', r: 'Transferência' }, { v: 'cortesia', r: 'Cortesia (grátis)' },
];

const hojeJapao = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function CartaoComAcoes({ vale, telefone }) {
  const ref = useRef(null);
  const t = (c, v) => textoVale('pt-BR', c, v);
  const link = linkDoVale(vale.codigo);
  const texto = vale.tipo === 'bonus'
    ? `🎁 Seu bônus Kaizen: ${formatarIenes(vale.valor)} de desconto no próximo corte. Use o código ${vale.codigo} ao agendar: ${link}`
    : t('texto_compartilhar', { link });
  const numeroWhats = (telefone || '').replace(/\D/g, '');

  const baixar = async () => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { backgroundColor: null, scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `vale-${vale.codigo}.png`;
    a.click();
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div ref={ref} style={{ padding: 4 }}>
        <CartaoVisualVale vale={vale} idioma="pt-BR" t={t} comQr />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" style={botaoContorno} onClick={() => navigator.clipboard?.writeText(link)}>🔗 Copiar link</button>
        <a style={botaoContorno} target="_blank" rel="noreferrer"
          href={numeroWhats ? `https://wa.me/${numeroWhats}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`}>WhatsApp</a>
        <a style={botaoContorno} target="_blank" rel="noreferrer" href={`https://line.me/R/msg/text/?${encodeURIComponent(texto)}`}>LINE</a>
        <button type="button" style={botaoContorno} onClick={baixar}>🖼️ Baixar imagem (imprimir)</button>
      </div>
    </div>
  );
}

function VenderBalcao({ servicos, aoCriar }) {
  const [form, setForm] = useState({ servico_id: '', quantidade: 1, nomes: '', comprador: '', telefone: '', mensagem: '', forma: 'dinheiro', caixa: true });
  const [salvando, setSalvando] = useState(false);
  const [criados, setCriados] = useState([]);

  useEffect(() => {
    if (!form.servico_id && servicos[0]) setForm(f => ({ ...f, servico_id: servicos[0].id }));
  }, [servicos, form.servico_id]);

  const servico = servicos.find(s => s.id === form.servico_id);
  const cortesia = form.forma === 'cortesia';
  const qtd = Math.max(1, Number(form.quantidade) || 1);
  const unit = !servico ? 0 : cortesia ? 0 : qtd >= 3 ? Math.round(servico.preco * 0.9) : Number(servico.preco);

  const criar = async () => {
    if (!servico) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc('criar_vales_balcao', {
        p_servico_id: form.servico_id,
        p_quantidade: qtd,
        p_nomes_presenteados: form.nomes.split(',').map(n => n.trim()),
        p_nome_comprador: form.comprador || null,
        p_telefone_comprador: form.telefone || null,
        p_mensagem: form.mensagem || null,
        p_forma_pagamento: form.forma,
        p_origem: cortesia ? 'cortesia' : 'balcao',
        p_registrar_caixa: form.caixa && !cortesia,
        p_dar_bonus: !cortesia,
      });
      if (error) throw error;
      setCriados((data || []).map(v => ({ ...v, servico_nome: servicos.find(s => s.id === v.servico_id)?.nome })));
      setForm(f => ({ ...f, quantidade: 1, nomes: '', comprador: '', telefone: '', mensagem: '' }));
      aoCriar();
    } catch (e) {
      alert('Erro ao criar vale: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={card}>
      <h3 style={{ color: OURO, marginTop: 0 }}>🧾 Vender no balcão</h3>
      <label style={{ fontSize: 12, color: '#999' }}>Serviço</label>
      <select style={input} value={form.servico_id} onChange={e => setForm({ ...form, servico_id: e.target.value })}>
        {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} — {formatarIenes(s.preco)}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: '0 0 90px' }}>
          <label style={{ fontSize: 12, color: '#999' }}>Qtd</label>
          <input style={input} type="number" min={1} max={20} value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: '#999' }}>Forma de pagamento</label>
          <select style={input} value={form.forma} onChange={e => setForm({ ...form, forma: e.target.value })}>
            {FORMAS.map(f => <option key={f.v} value={f.v}>{f.r}</option>)}
          </select>
        </div>
      </div>
      <input style={input} placeholder={qtd > 1 ? 'Nomes dos presenteados (separados por vírgula)' : 'Nome do presenteado (opcional)'} value={form.nomes} onChange={e => setForm({ ...form, nomes: e.target.value })} />
      <input style={input} placeholder="Nome de quem comprou" value={form.comprador} onChange={e => setForm({ ...form, comprador: e.target.value })} />
      <input style={input} placeholder="WhatsApp de quem comprou (ex: 8180...)" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
      <textarea style={{ ...input, minHeight: 60 }} placeholder="Mensagem no cartão (opcional)" value={form.mensagem} maxLength={300} onChange={e => setForm({ ...form, mensagem: e.target.value })} />
      {!cortesia && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#ccc', marginBottom: 10 }}>
          <input type="checkbox" checked={form.caixa} onChange={e => setForm({ ...form, caixa: e.target.checked })} /> Lançar entrada no Caixa de hoje
        </label>
      )}
      <p style={{ color: '#ccc', fontSize: 14, margin: '0 0 10px' }}>
        Total a receber: <strong style={{ color: OURO }}>{formatarIenes(unit * qtd)}</strong>
        {qtd >= 3 && !cortesia && <span style={{ color: '#4ade80' }}> (combo −10%)</span>}
        {!cortesia && <span style={{ color: '#999' }}> · inclui bônus ¥500 pro comprador</span>}
      </p>
      <button type="button" style={{ ...botao, width: '100%', opacity: salvando ? 0.6 : 1 }} disabled={salvando} onClick={criar}>
        {salvando ? 'Gerando...' : '🎁 Gerar vale(s)'}
      </button>

      {criados.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ color: '#4ade80' }}>Vales gerados — envie ao cliente:</h4>
          {criados.map(v => <CartaoComAcoes key={v.id} vale={v} telefone={v.telefone_comprador} />)}
        </div>
      )}
    </div>
  );
}

function ValesPresente() {
  const [servicos, setServicos] = useState([]);
  const [config, setConfig] = useState(null);
  const [vales, setVales] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: cfgPublica }, { data: cfg }, { data: lista }] = await Promise.all([
      supabase.rpc('config_vale_presente_publica'),
      supabase.from('config_vale_presente').select('*').eq('id', 1).maybeSingle(),
      supabase.from('vales_presente')
        .select('*, servicos(nome), agendamentos:agendamentos!vales_presente_agendamento_id_fkey(data_hora)')
        .order('criado_em', { ascending: false }).limit(500),
    ]);
    setServicos(cfgPublica?.servicos || []);
    setConfig(cfg);
    setVales((lista || []).map(v => ({ ...v, servico_nome: v.servicos?.nome })));
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const hoje = hojeJapao();
  const statusExibicao = (v) => (v.status === 'ativo' && v.expira_em && v.expira_em < hoje ? 'expirado' : v.status);

  const filtrados = vales.filter(v => {
    const st = statusExibicao(v);
    if (filtro !== 'todos' && st !== filtro) return false;
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return [v.codigo, v.nome_presenteado, v.nome_comprador, v.email_comprador, v.telefone_comprador]
      .some(x => (x || '').toLowerCase().includes(q));
  });

  const presentes = vales.filter(v => v.tipo === 'presente' && v.status !== 'pendente' && v.status !== 'cancelado');
  const vendidoTotal = presentes.reduce((a, v) => a + Number(v.valor_pago || 0), 0);
  const ativos = presentes.filter(v => statusExibicao(v) === 'ativo').length;
  const usados = presentes.filter(v => v.status === 'usado').length;

  const cancelar = async (v) => {
    if (!window.confirm(`Cancelar o vale ${v.codigo}? Ele deixa de valer (o reembolso, se houver, é feito à parte).`)) return;
    const { error } = await supabase.from('vales_presente').update({ status: 'cancelado' }).eq('id', v.id);
    if (error) alert(error.message); else carregar();
  };
  const darBaixa = async (v) => {
    if (!window.confirm(`Marcar o vale ${v.codigo} como usado agora (cliente atendido sem reserva pelo app)?`)) return;
    const { error } = await supabase.from('vales_presente').update({ status: 'usado', usado_em: new Date().toISOString() }).eq('id', v.id).eq('status', 'ativo');
    if (error) alert(error.message); else carregar();
  };
  const reativar = async (v) => {
    const { error } = await supabase.from('vales_presente').update({ status: 'ativo', faltas: 0 }).eq('id', v.id);
    if (error) alert(error.message); else carregar();
  };
  const verificarPagamento = async (v) => {
    const { data, error } = await supabase.functions.invoke('vale-presente', {
      body: { acao: 'confirmar', pedido_id: v.pedido_id, session_id: v.stripe_session_id },
    });
    if (error) { alert('Erro: ' + error.message); return; }
    alert(data?.pago ? '✅ Pagamento confirmado — vale ativado.' : '⏳ O Stripe ainda não confirmou esse pagamento (pode ter sido abandonado).');
    carregar();
  };
  const salvarConfig = async (campos) => {
    const { error } = await supabase.from('config_vale_presente').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', 1);
    if (error) alert(error.message); else carregar();
  };

  const linkVenda = `${linkDoVale('').replace(/\/$/, '')}`;

  return (
    <div className="page-container" style={{ color: '#e8e8e8' }}>
      <h2 style={{ color: OURO }}>🎁 Vales Presente</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[['Vendido', formatarIenes(vendidoTotal)], ['Ativos', ativos], ['Usados', usados]].map(([r, v]) => (
          <div key={r} style={{ ...card, marginBottom: 0, textAlign: 'center', padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{r}</p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 'bold', color: OURO }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={card}>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#ccc' }}>Link de venda online (para Instagram, LINE, anúncios):</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ color: OURO, fontSize: 13 }}>{linkVenda}</code>
          <button type="button" style={botaoContorno} onClick={() => navigator.clipboard?.writeText(linkVenda)}>Copiar</button>
        </div>
        {config && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 13, color: '#ccc' }}>
            <label><input type="checkbox" checked={config.venda_ativa} onChange={e => salvarConfig({ venda_ativa: e.target.checked })} /> Venda online aberta</label>
            <label><input type="checkbox" checked={config.bonus_ativo} onChange={e => salvarConfig({ bonus_ativo: e.target.checked })} /> Bônus ¥{Number(config.bonus_valor)} pro comprador (vendas até {formatarDataVale(config.bonus_venda_ate, 'pt-BR')})</label>
          </div>
        )}
      </div>

      <VenderBalcao servicos={servicos} aoCriar={carregar} />

      <div style={card}>
        <h3 style={{ color: OURO, marginTop: 0 }}>📋 Todos os vales</h3>
        <input style={input} placeholder="Buscar por código, nome ou telefone" value={busca} onChange={e => setBusca(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {['todos', 'ativo', 'usado', 'expirado', 'pendente', 'perdido', 'cancelado'].map(f => (
            <button key={f} type="button" onClick={() => setFiltro(f)}
              style={{ ...botaoContorno, background: filtro === f ? OURO : 'transparent', color: filtro === f ? '#1a1a1a' : OURO }}>
              {f}
            </button>
          ))}
        </div>
        {carregando && <p style={{ color: '#999' }}>Carregando...</p>}
        {!carregando && filtrados.length === 0 && <p style={{ color: '#999' }}>Nenhum vale.</p>}
        {filtrados.map(v => {
          const st = statusExibicao(v);
          return (
            <div key={v.id} style={{ borderTop: '1px solid #404040', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }} onClick={() => setAberto(aberto === v.id ? null : v.id)}>
                <div>
                  <p style={{ margin: 0, fontFamily: 'monospace', color: '#fff' }}>{v.codigo}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#ccc' }}>
                    {v.tipo === 'bonus' ? `Bônus ${formatarIenes(v.valor)}` : v.servico_nome}
                    {v.nome_presenteado ? ` · para ${v.nome_presenteado}` : ''}
                    {v.nome_comprador && v.tipo !== 'bonus' ? ` · de ${v.nome_comprador}` : ''}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>
                    {v.origem === 'stripe' ? '💳 Online' : v.origem === 'cortesia' ? '🎀 Cortesia' : `🧾 Balcão (${v.forma_pagamento || '-'})`}
                    {v.expira_em ? ` · vence ${formatarDataVale(v.expira_em, 'pt-BR')}` : ''}
                    {v.faltas > 0 ? ` · ${v.faltas} falta(s)` : ''}
                  </p>
                </div>
                <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: st === 'expirado' ? '#f87171' : '#ccc' }}>
                  {st === 'expirado' ? '🔴 Vencido' : ROTULO_STATUS[st]}
                </span>
              </div>
              {aberto === v.id && (
                <div style={{ marginTop: 10 }}>
                  {v.status !== 'pendente' && <CartaoComAcoes vale={v} telefone={v.telefone_comprador} />}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {v.status === 'pendente' && v.stripe_session_id && (
                      <button type="button" style={botaoContorno} onClick={() => verificarPagamento(v)}>🔄 Verificar pagamento no Stripe</button>
                    )}
                    {v.status === 'ativo' && (
                      <button type="button" style={botaoContorno} onClick={() => darBaixa(v)}>✅ Dar baixa (usado no balcão)</button>
                    )}
                    {(v.status === 'ativo' || v.status === 'pendente') && (
                      <button type="button" style={{ ...botaoContorno, color: '#f87171', borderColor: '#f87171' }} onClick={() => cancelar(v)}>Cancelar vale</button>
                    )}
                    {(v.status === 'perdido' || v.status === 'cancelado') && v.pago_em && (
                      <button type="button" style={botaoContorno} onClick={() => reativar(v)}>Reativar</button>
                    )}
                  </div>
                  {v.email_comprador && <p style={{ fontSize: 12, color: '#999' }}>E-mail do comprador: {v.email_comprador}</p>}
                  {v.agendamentos?.data_hora && <p style={{ fontSize: 12, color: '#999' }}>Usado no atendimento de {String(v.agendamentos.data_hora).replace('T', ' ').slice(0, 16)}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ ...card, fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
        <strong style={{ color: OURO }}>Como dar baixa:</strong> o cliente agenda pelo link do vale (ou digita o código na reserva). Na agenda, o horário aparece com “🎁 Vale presente KZN-…” nas observações e o preço já descontado. Ao marcar o atendimento como <em>Realizado</em>, o vale é dado como usado automaticamente. Se for “Não compareceu”, ele pode reagendar 1 vez; na 2ª falta o vale é perdido.
        <br />Cliente chegou sem agendar? Atenda normalmente e use “Dar baixa” no vale dele aqui (se ele escolher um serviço mais caro, cobre só a diferença).
      </div>
    </div>
  );
}

export default ValesPresente;
