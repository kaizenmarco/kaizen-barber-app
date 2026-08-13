import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

function Clientes({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    email: '',
    data_primeira_visita: ''
  });

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

    if (!novoCliente.nome || !novoCliente.email) {
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
            email: novoCliente.email,
            data_primeiro_atendimento: novoCliente.data_primeira_visita || new Date().toISOString().split('T')[0]
          }
        ]);

      if (error) throw error;

      alert(t('clientes.adicionadoComSucesso'));
      setNovoCliente({ nome: '', telefone: '', email: '', data_primeira_visita: '' });
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
            placeholder={t('comum.email')}
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
          />
          <input
            type="date"
            name="data_primeira_visita"
            value={novoCliente.data_primeira_visita}
            onChange={handleInputChange}
          />
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
                      <td>
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
    </div>
  );
}

export default Clientes;
