import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

// ============================================================================
// Preços especiais por grupo de clientes (ex.: "Corte quinzenal especial").
// Cada grupo tem um nome livre, um preço por serviço e a lista de clientes.
// Cada cliente fica em no máximo um grupo. O preço é aplicado pelo banco em
// todo agendamento novo desse cliente (trigger trg_preco_grupo), tanto pelo
// site quanto pelo Admin; no site o cliente já vê o preço dele.
// ============================================================================

const formatarYen = (v) => `¥${Number(v || 0).toLocaleString('ja-JP')}`;
const soDigitos = (v) => (v || '').replace(/\D/g, '');

function PrecosEspeciais({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [carregando, setCarregando] = useState(true);
  const [grupos, setGrupos] = useState([]);
  const [precos, setPrecos] = useState([]); // grupos_preco_servicos
  const [membros, setMembros] = useState([]); // grupos_preco_clientes
  const [servicos, setServicos] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [nomeNovoGrupo, setNomeNovoGrupo] = useState('');
  const [precosEditados, setPrecosEditados] = useState({}); // { [grupoId]: { [servicoId]: 'texto' } }
  const [busca, setBusca] = useState({}); // { [grupoId]: 'texto' }
  const [grupoAberto, setGrupoAberto] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const [mensagem, setMensagem] = useState({});

  const carregar = async () => {
    const [g, p, m, s, c] = await Promise.all([
      supabase.from('grupos_preco').select('id, nome, ativo, criado_em').order('criado_em'),
      supabase.from('grupos_preco_servicos').select('grupo_id, servico_id, preco'),
      supabase.from('grupos_preco_clientes').select('grupo_id, cliente_id'),
      supabase.from('servicos').select('id, nome, preco, eh_pacote, ativo').eq('ativo', true).order('criado_em'),
      supabase.from('clientes').select('id, nome, telefone').order('nome'),
    ]);
    const erro = g.error || p.error || m.error || s.error || c.error;
    if (erro) {
      alert(t('precos.erro', { msg: erro.message }));
    }
    setGrupos(g.data || []);
    setPrecos(p.data || []);
    setMembros(m.data || []);
    setServicos((s.data || []).filter(x => !x.eh_pacote));
    setClientes(c.data || []);
    const editados = {};
    (g.data || []).forEach(gr => {
      editados[gr.id] = {};
      (p.data || []).filter(x => x.grupo_id === gr.id).forEach(x => { editados[gr.id][x.servico_id] = String(Number(x.preco)); });
    });
    setPrecosEditados(editados);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientePorId = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c])), [clientes]);
  const grupoDoCliente = useMemo(() => Object.fromEntries(membros.map(m => [m.cliente_id, m.grupo_id])), [membros]);
  const nomeGrupo = (id) => grupos.find(g => g.id === id)?.nome || '';

  const avisar = (grupoId, texto) => setMensagem(prev => ({ ...prev, [grupoId]: texto }));

  const criarGrupo = async (e) => {
    e.preventDefault();
    const nome = nomeNovoGrupo.trim();
    if (!nome) return;
    setSalvando('novo');
    const { data, error } = await supabase.from('grupos_preco').insert({ nome }).select('id').single();
    setSalvando(null);
    if (error) { alert(t('precos.erro', { msg: error.message })); return; }
    setNomeNovoGrupo('');
    await carregar();
    setGrupoAberto(data.id);
  };

  const renomearGrupo = async (grupo) => {
    const nome = window.prompt(t('precos.renomear'), grupo.nome);
    if (!nome || !nome.trim() || nome.trim() === grupo.nome) return;
    const { error } = await supabase.from('grupos_preco').update({ nome: nome.trim() }).eq('id', grupo.id);
    if (error) { alert(t('precos.erro', { msg: error.message })); return; }
    carregar();
  };

  const alternarAtivo = async (grupo) => {
    const { error } = await supabase.from('grupos_preco').update({ ativo: !grupo.ativo }).eq('id', grupo.id);
    if (error) { alert(t('precos.erro', { msg: error.message })); return; }
    carregar();
  };

  const excluirGrupo = async (grupo) => {
    if (!window.confirm(t('precos.confirmarExcluir', { nome: grupo.nome }))) return;
    const { error } = await supabase.from('grupos_preco').delete().eq('id', grupo.id);
    if (error) { alert(t('precos.erro', { msg: error.message })); return; }
    carregar();
  };

  const salvarPrecos = async (grupoId) => {
    const editados = precosEditados[grupoId] || {};
    const upserts = [];
    const remover = [];
    for (const s of servicos) {
      const texto = (editados[s.id] ?? '').trim();
      if (texto === '') { remover.push(s.id); continue; }
      const valor = Number(soDigitos(texto));
      if (!Number.isFinite(valor)) { avisar(grupoId, t('precos.precoInvalido')); return; }
      upserts.push({ grupo_id: grupoId, servico_id: s.id, preco: valor });
    }
    setSalvando(grupoId);
    try {
      if (upserts.length) {
        const { error } = await supabase.from('grupos_preco_servicos').upsert(upserts);
        if (error) throw error;
      }
      if (remover.length) {
        const { error } = await supabase.from('grupos_preco_servicos').delete().eq('grupo_id', grupoId).in('servico_id', remover);
        if (error) throw error;
      }
      avisar(grupoId, t('precos.salvo'));
      await carregar();
    } catch (erro) {
      avisar(grupoId, t('precos.erro', { msg: erro.message }));
    } finally {
      setSalvando(null);
    }
  };

  const adicionarCliente = async (grupoId, cliente) => {
    const atual = grupoDoCliente[cliente.id];
    if (atual === grupoId) return;
    if (atual && !window.confirm(t('precos.clienteEmOutroGrupo', { nome: cliente.nome, grupo: nomeGrupo(atual) }))) return;
    const { error } = await supabase
      .from('grupos_preco_clientes')
      .upsert({ cliente_id: cliente.id, grupo_id: grupoId });
    if (error) { alert(t('precos.erro', { msg: error.message })); return; }
    setBusca(prev => ({ ...prev, [grupoId]: '' }));
    carregar();
  };

  const removerCliente = async (clienteId) => {
    const { error } = await supabase.from('grupos_preco_clientes').delete().eq('cliente_id', clienteId);
    if (error) { alert(t('precos.erro', { msg: error.message })); return; }
    carregar();
  };

  const sugestoes = (grupoId) => {
    const termo = (busca[grupoId] || '').trim().toLowerCase();
    if (termo.length < 2) return [];
    const termoDigitos = soDigitos(termo);
    return clientes
      .filter(c => (c.nome || '').toLowerCase().includes(termo)
        || (termoDigitos.length >= 3 && soDigitos(c.telefone).includes(termoDigitos)))
      .slice(0, 8);
  };

  if (carregando) {
    return <div className="page-container"><p>{t('login.carregando')}</p></div>;
  }

  return (
    <div className="page-container">
      <h2>{t('nav.precosEspeciais')}</h2>
      <p style={{ fontSize: '13px', color: '#999', marginTop: 0 }}>{t('precos.desc')}</p>

      <section className="form-section">
        <h3>{t('precos.novoGrupo')}</h3>
        <form onSubmit={criarGrupo} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={nomeNovoGrupo}
            onChange={(e) => setNomeNovoGrupo(e.target.value)}
            placeholder={t('precos.nomeGrupoPlaceholder')}
            style={{ flex: '1 1 220px', marginBottom: 0 }}
            required
          />
          <button type="submit" className="btn-primary" disabled={salvando === 'novo'} style={{ width: 'auto' }}>
            {salvando === 'novo' ? t('comum.salvando') : t('precos.criarGrupo')}
          </button>
        </form>
      </section>

      {grupos.length === 0 && <p style={{ color: '#999' }}>{t('precos.nenhumGrupo')}</p>}

      {grupos.map(grupo => {
        const membrosDoGrupo = membros.filter(m => m.grupo_id === grupo.id).map(m => clientePorId[m.cliente_id]).filter(Boolean);
        const precosDoGrupo = precos.filter(p => p.grupo_id === grupo.id);
        const aberto = grupoAberto === grupo.id;
        return (
          <section key={grupo.id} className="form-section" style={{ opacity: grupo.ativo ? 1 : 0.6 }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              onClick={() => setGrupoAberto(aberto ? null : grupo.id)}
            >
              <h3 style={{ margin: 0 }}>💎 {grupo.nome}</h3>
              <span style={{ color: '#999', fontSize: '12px', whiteSpace: 'nowrap' }}>
                {t('precos.resumo', { clientes: membrosDoGrupo.length, servicos: precosDoGrupo.length })} {aberto ? '▲' : '▼'}
              </span>
            </div>
            {!grupo.ativo && <p style={{ color: '#f87171', fontSize: '12px', margin: '6px 0 0 0' }}>{t('precos.inativo')}</p>}

            {aberto && (
              <div style={{ marginTop: '14px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#d4af37' }}>{t('precos.tabelaPrecos')}</h4>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 8px 0' }}>{t('precos.tabelaPrecosDesc')}</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                  <thead>
                    <tr style={{ color: '#999', fontSize: '12px', textAlign: 'left' }}>
                      <th style={{ padding: '4px' }}>{t('precos.servico')}</th>
                      <th style={{ padding: '4px' }}>{t('precos.precoNormal')}</th>
                      <th style={{ padding: '4px' }}>{t('precos.precoEspecial')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicos.map(s => (
                      <tr key={s.id} style={{ borderTop: '1px solid #2a2a2a' }}>
                        <td style={{ padding: '6px 4px', fontSize: '13px' }}>{s.nome}</td>
                        <td style={{ padding: '6px 4px', fontSize: '13px', color: '#999' }}>{formatarYen(s.preco)}</td>
                        <td style={{ padding: '6px 4px' }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="—"
                            value={precosEditados[grupo.id]?.[s.id] ?? ''}
                            onChange={(e) => {
                              avisar(grupo.id, '');
                              setPrecosEditados(prev => ({ ...prev, [grupo.id]: { ...(prev[grupo.id] || {}), [s.id]: soDigitos(e.target.value) } }));
                            }}
                            style={{ width: '90px', marginBottom: 0 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="btn-primary" onClick={() => salvarPrecos(grupo.id)} disabled={salvando === grupo.id}>
                  {salvando === grupo.id ? t('comum.salvando') : t('precos.salvarPrecos')}
                </button>
                {mensagem[grupo.id] && (
                  <p style={{ fontSize: '12px', marginTop: '6px', color: mensagem[grupo.id] === t('precos.salvo') ? '#4ade80' : '#f87171' }}>{mensagem[grupo.id]}</p>
                )}

                <h4 style={{ margin: '18px 0 8px 0', color: '#d4af37' }}>{t('precos.clientes')} ({membrosDoGrupo.length})</h4>
                {membrosDoGrupo.length === 0 && <p style={{ fontSize: '13px', color: '#999' }}>{t('precos.nenhumCliente')}</p>}
                {membrosDoGrupo.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #2a2a2a', gap: '8px' }}>
                    <span style={{ fontSize: '13px' }}>
                      {c.nome} {c.telefone && <span style={{ color: '#999' }}>· {c.telefone}</span>}
                    </span>
                    <button type="button" className="btn-delete" onClick={() => removerCliente(c.id)} title={t('precos.remover')}>✕</button>
                  </div>
                ))}
                <div style={{ position: 'relative', marginTop: '10px' }}>
                  <input
                    type="text"
                    value={busca[grupo.id] || ''}
                    onChange={(e) => setBusca(prev => ({ ...prev, [grupo.id]: e.target.value }))}
                    placeholder={t('precos.buscarCliente')}
                    style={{ marginBottom: 0 }}
                  />
                  {sugestoes(grupo.id).length > 0 && (
                    <div style={{ border: '1px solid #404040', borderRadius: '6px', marginTop: '4px', background: '#1f1f1f' }}>
                      {sugestoes(grupo.id).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => adicionarCliente(grupo.id, c)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderBottom: '1px solid #2a2a2a', color: '#e8e8e8', cursor: 'pointer', fontSize: '13px' }}
                        >
                          ➕ {c.nome} {c.telefone && <span style={{ color: '#999' }}>· {c.telefone}</span>}
                          {grupoDoCliente[c.id] && grupoDoCliente[c.id] !== grupo.id && (
                            <span style={{ color: '#f59e0b' }}> ({nomeGrupo(grupoDoCliente[c.id])})</span>
                          )}
                          {grupoDoCliente[c.id] === grupo.id && <span style={{ color: '#4ade80' }}> ✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '18px' }}>
                  <button type="button" className="btn-primary" style={{ width: 'auto', background: 'transparent', color: '#d4af37', border: '1px solid #d4af37' }} onClick={() => renomearGrupo(grupo)}>
                    ✏️ {t('precos.renomear')}
                  </button>
                  <button type="button" className="btn-primary" style={{ width: 'auto', background: 'transparent', color: '#d4af37', border: '1px solid #d4af37' }} onClick={() => alternarAtivo(grupo)}>
                    {grupo.ativo ? `⏸️ ${t('precos.pausar')}` : `▶️ ${t('precos.reativar')}`}
                  </button>
                  <button type="button" className="btn-primary" style={{ width: 'auto', background: 'transparent', color: '#f87171', border: '1px solid #f87171' }} onClick={() => excluirGrupo(grupo)}>
                    🗑️ {t('precos.excluirGrupo')}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default PrecosEspeciais;
