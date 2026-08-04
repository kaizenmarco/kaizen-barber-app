import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function Clientes({ t }) {
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
      alert('❌ Erro ao buscar clientes: ' + error.message);
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
      alert('⚠️ Nome e email são obrigatórios!');
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

      alert('✅ Cliente adicionado com sucesso!');
      setNovoCliente({ nome: '', telefone: '', email: '', data_primeira_visita: '' });
      buscarClientes();
    } catch (error) {
      alert('❌ Erro ao adicionar cliente: ' + error.message);
    }
  };

  const handleDeletarCliente = async (clienteId) => {
    if (!window.confirm('Tem certeza que deseja deletar este cliente? Seus agendamentos também serão deletados!')) return;

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

      alert('✅ Cliente deletado!');
      buscarClientes();
    } catch (error) {
      alert('❌ Erro ao deletar cliente: ' + error.message);
    }
  };

  return (
    <div className="page-container">
      <h2>👥 Clientes</h2>

      <section className="form-section">
        <h3>Novo Cliente</h3>
        <form onSubmit={handleAdicionarCliente}>
          <input
            type="text"
            name="nome"
            placeholder="Nome do Cliente"
            value={novoCliente.nome}
            onChange={handleInputChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={novoCliente.email}
            onChange={handleInputChange}
            required
          />
          <input
            type="tel"
            name="telefone"
            placeholder="Telefone"
            value={novoCliente.telefone}
            onChange={handleInputChange}
          />
          <input
            type="date"
            name="data_primeira_visita"
            value={novoCliente.data_primeira_visita}
            onChange={handleInputChange}
          />
          <button type="submit" className="btn-primary">Adicionar Cliente</button>
        </form>
      </section>

      <section className="list-section">
        <h3>Lista de Clientes</h3>
        
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>⏳ Carregando clientes...</p>
        ) : clientes.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum cliente cadastrado ainda</p>
        ) : (
          <>
            <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '15px' }}>
              Total: {clientes.length} clientes
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Primeira Visita</th>
                    <th>Total Agendamentos</th>
                    <th>Confirmados</th>
                    <th>Ação</th>
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
                          🗑️ Deletar
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