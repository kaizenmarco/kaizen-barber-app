import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

function Clientes({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Mesma ideia do rascunho salvo em Agendamentos.jsx: no iPhone, sair pra
  // outro app (Contatos, Telefone) pra conferir um número e voltar pode
  // recarregar o PWA e zerar o formulário — isso guarda o que já foi
  // digitado no localStorage e restaura sozinho.
  const RASCUNHO_NOVO_CLIENTE_STORAGE = 'kaizen_admin_rascunho_novo_cliente';
  const CLIENTE_EM_BRANCO = { nome: '', telefone: '', email: '', data_nascimento: '', data_primeira_visita: '' };

  const [novoCliente, setNovoCliente] = useState(() => {
    try {
      const salvo = localStorage.getItem(RASCUNHO_NOVO_CLIENTE_STORAGE);
      return salvo ? { ...CLIENTE_EM_BRANCO, ...JSON.parse(salvo) } : CLIENTE_EM_BRANCO;
    } catch {
      return CLIENTE_EM_BRANCO;
    }
  });

  useEffect(() => {
    try {
      const temAlgoDigitado = Object.values(novoCliente).some(v => !!v);
      if (temAlgoDigitado) {
        localStorage.setItem(RASCUNHO_NOVO_CLIENTE_STORAGE, JSON.stringify(novoCliente));
      } else {
        localStorage.removeItem(RASCUNHO_NOVO_CLIENTE_STORAGE);
      }
    } catch {
      // sem localStorage, só não persiste.
    }
  }, [novoCliente]);

  const [clienteEditando, setClienteEditando] = useState(null);
  const [edicaoClienteForm, setEdicaoClienteForm] = useState({ nome: '', telefone: '', email: '', data_nascimento: '' });
  const [salvandoEdicaoCliente, setSalvandoEdicaoCliente] = useState(false);

  // Buscar clientes do Supabase
  useEffect(() => {
    buscarClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarClientes = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          nome,
          email,
          telefone,
          data_nascimento,
          criado_em,
          agendamentos(id, status, data_hora)
        `)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Mapear dados e calcular agendamentos
      const clientesFormatados = data.map(cliente => ({
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone || '-',
        email: cliente.email,
        data_nascimento: cliente.data_nascimento || '',
        data_primeira_visita: cliente.criado_em?.split('T')[0] || '-',
        total_agendamentos: cliente.agendamentos?.length || 0,
        agendamentos_confirmados: cliente.agendamentos?.filter(a => a.status === 'CONFIRMADO').length || 0
      }));

      setClientes(clientesFormatados);
    } catch (error) {
      alert(t('clientes.erroBuscar', { msg: error.message }));
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoCliente({ ...novoCliente, [name]: value });
  };

  const handleAdicionarCliente = async (e) => {
    e.preventDefault();

    if (!novoCliente.nome || !novoCliente.telefone) {
      alert(t('clientes.nomeEmailObrigatorios'));
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .insert([
          {
            nome: novoCliente.nome,
            telefone: novoCliente.telefone || null,
            email: novoCliente.email || null,
            data_nascimento: novoCliente.data_nascimento || null,
            data_primeiro_atendimento: novoCliente.data_primeira_visita || new Date().toISOString().split('T')[0]
          }
        ]);

      if (error) throw error;

      alert(t('clientes.adicionadoComSucesso'));
      setNovoCliente(CLIENTE_EM_BRANCO);
      buscarClientes();
    } catch (error) {
      alert(t('clientes.erroAdicionar', { msg: error.message }));
    }
  };

  const handleDeletarCliente = async (clienteId) => {
    if (!window.confirm(t('clientes.confirmarDeletar'))) return;

    try {
      // Primeiro deleta os agendamentos
      const { error: erroAgendamentos } = await supabase
        .from('agendamentos')
        .delete()
        .eq('cliente_id', clienteId);

      if (erroAgendamentos) throw erroAgendamentos;

      // Depois deleta o cliente
      const { error: erroCliente } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clienteId);

      if (erroCliente) throw erroCliente;

      alert(t('clientes.deletado'));
      buscarClientes();
    } catch (error) {
      alert(t('clientes.erroDeletar', { msg: error.message }));
    }
  };

  const abrirEdicaoCliente = (cliente) => {
    setEdicaoClienteForm({
      nome: cliente.nome || '',
      telefone: cliente.telefone === '-' ? '' : (cliente.telefone || ''),
      email: cliente.email || '',
      data_nascimento: cliente.data_nascimento || ''
    });
    setClienteEditando(cliente);
  };

  const fecharEdicaoCliente = () => {
    setClienteEditando(null);
  };

  const handleEdicaoClienteInputChange = (e) => {
    const { name, value } = e.target;
    setEdicaoClienteForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSalvarEdicaoCliente = async (e) => {
    e.preventDefault();

    if (!edicaoClienteForm.nome || !edicaoClienteForm.telefone) {
      alert(t('clientes.nomeEmailObrigatorios'));
      return;
    }

    setSalvandoEdicaoCliente(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: edicaoClienteForm.nome,
          telefone: edicaoClienteForm.telefone || null,
          email: edicaoClienteForm.email || null,
          data_nascimento: edicaoClienteForm.data_nascimento || null
        })
        .eq('id', clienteEditando.id);

      if (error) throw error;

      alert(t('clientes.editadoComSucesso'));
      setClienteEditando(null);
      buscarClientes();
    } catch (error) {
      alert(t('clientes.erroEditar', { msg: error.message }));
    } finally {
      setSalvandoEdicaoCliente(false);
    }
  };

  return (
    <div className="page-container">
      <h2>{t('clientes.titulo')}</h2>

      <section className="form-section">
        <h3>{t('clientes.novoCliente')}</h3>
        <form onSubmit={handleAdicionarCliente}>
          <input
            type="text"
            name="nome"
            placeholder={t('clientes.nomeCliente')}
            value={novoCliente.nome}
            onChange={handleInputChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder={t('clientes.emailOpcional')}
            value={novoCliente.email}
            onChange={handleInputChange}
            required
          />
          <input
            type="tel"
            name="telefone"
            placeholder={t('comum.telefone')}
            value={novoCliente.telefone}
            onChange={handleInputChange}
            required
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
            {t('clientes.dataNascimento')}
            <div className="campo-data-wrapper">
              <input
                type="date"
                name="data_nascimento"
                value={novoCliente.data_nascimento}
                onChange={handleInputChange}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
            {t('clientes.primeiraVisita')}
            <div className="campo-data-wrapper">
              <input
                type="date"
                name="data_primeira_visita"
                value={novoCliente.data_primeira_visita}
                onChange={handleInputChange}
              />
            </div>
          </label>
          <button type="submit" className="btn-primary">{t('clientes.adicionarCliente')}</button>
        </form>
      </section>

      <section className="list-section">
        <h3>{t('clientes.listaClientes')}</h3>

        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
        ) : clientes.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('clientes.nenhumCadastrado')}</p>
        ) : (
          <>
            <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '15px' }}>
              {t('clientes.totalClientes', { n: clientes.length })}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('clientes.nome')}</th>
                    <th>{t('comum.email')}</th>
                    <th>{t('comum.telefone')}</th>
                    <th>{t('clientes.primeiraVisita')}</th>
                    <th>{t('clientes.totalAgendamentos')}</th>
                    <th>{t('clientes.confirmados')}</th>
                    <th>{t('comum.acao')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td style={{ fontWeight: 'bold' }}>{cliente.nome}</td>
                      <td style={{ fontSize: '12px', color: '#999' }}>{cliente.email}</td>
                      <td>{cliente.telefone}</td>
                      <td>{cliente.data_primeira_visita}</td>
                      <td style={{ textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }}>
                        {cliente.total_agendamentos}
                      </td>
                      <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 'bold' }}>
                        {cliente.agendamentos_confirmados}
                      </td>
                      <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          className="btn-primary"
                          onClick={() => abrirEdicaoCliente(cliente)}
                        >
                          ✏️ {t('comum.editar')}
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeletarCliente(cliente.id)}
                        >
                          🗑️ {t('comum.deletar')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {clienteEditando && (
        <div
          onClick={fecharEdicaoCliente}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            paddingTop: 'calc(20px + env(safe-area-inset-top))',
            overflowY: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d',
              border: '1px solid #d4af37',
              borderRadius: '10px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ color: '#d4af37', margin: 0 }}>{t('clientes.editarCliente')}</h3>
              <button
                onClick={fecharEdicaoCliente}
                style={{
                  background: 'transparent',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✕ {t('comum.cancelar')}
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoCliente} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('clientes.nome')}
                <input
                  type="text"
                  name="nome"
                  value={edicaoClienteForm.nome}
                  onChange={handleEdicaoClienteInputChange}
                  required
                  style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('comum.telefone')}
                <input
                  type="tel"
                  name="telefone"
                  value={edicaoClienteForm.telefone}
                  onChange={handleEdicaoClienteInputChange}
                  required
                  style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('clientes.emailOpcional')}
                <input
                  type="email"
                  name="email"
                  value={edicaoClienteForm.email}
                  onChange={handleEdicaoClienteInputChange}
                  style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('clientes.dataNascimento')}
                <div className="campo-data-wrapper">
                  <input
                    type="date"
                    name="data_nascimento"
                    value={edicaoClienteForm.data_nascimento}
                    onChange={handleEdicaoClienteInputChange}
                    style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px', paddingRight: '34px' }}
                  />
                </div>
              </label>

              <button type="submit" className="btn-primary" disabled={salvandoEdicaoCliente} style={{ marginTop: '8px' }}>
                {salvandoEdicaoCliente ? t('comum.salvando') : t('comum.salvar')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;
