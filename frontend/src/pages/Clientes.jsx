import React, { useState } from 'react';

function Clientes({ t }) {
  const [clientes, setClientes] = useState([
    { id: 1, nome: 'João Silva', telefone: '81999999999', email: 'joao@email.com', data_primeira_visita: '2026-07-01' },
    { id: 2, nome: 'Maria Santos', telefone: '81988888888', email: 'maria@email.com', data_primeira_visita: '2026-07-05' },
    { id: 3, nome: 'Pedro Costa', telefone: '81977777777', email: 'pedro@email.com', data_primeira_visita: '2026-07-10' },
  ]);

  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    email: '',
    data_primeira_visita: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoCliente({ ...novoCliente, [name]: value });
  };

  const handleAdicionarCliente = (e) => {
    e.preventDefault();
    if (novoCliente.nome && novoCliente.telefone) {
      setClientes([...clientes, {
        id: clientes.length + 1,
        ...novoCliente,
        data_primeira_visita: novoCliente.data_primeira_visita || new Date().toISOString().split('T')[0]
      }]);
      setNovoCliente({ nome: '', telefone: '', email: '', data_primeira_visita: '' });
    }
  };

  return (
    <div className="page-container">
      <h2>{t('nav.clientes')}</h2>

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
            type="tel"
            name="telefone"
            placeholder="Telefone"
            value={novoCliente.telefone}
            onChange={handleInputChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={novoCliente.email}
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
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Email</th>
              <th>Primeira Visita</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nome}</td>
                <td>{cliente.telefone}</td>
                <td>{cliente.email}</td>
                <td>{cliente.data_primeira_visita}</td>
                <td>
                  <button 
                    className="btn-delete"
                    onClick={() => setClientes(clientes.filter(c => c.id !== cliente.id))}
                  >
                    Deletar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default Clientes;