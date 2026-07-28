import React, { useState } from 'react';

function Fidelidade({ t }) {
  const [clientes, setClientes] = useState([
    { id: 1, nome: 'João Silva', pontos: 8, data_inicio: '2026-07-01', data_validade: '2026-10-01' },
    { id: 2, nome: 'Maria Santos', pontos: 10, data_inicio: '2026-06-15', data_validade: '2026-09-15', resgatado: false },
    { id: 3, nome: 'Pedro Costa', pontos: 5, data_inicio: '2026-07-10', data_validade: '2026-10-10' },
  ]);

  const [novoCliente, setNovoCliente] = useState('');

  const verificarValidade = (dataValidade) => {
    const hoje = new Date();
    const validade = new Date(dataValidade);
    return validade > hoje;
  };

  const handleAdicionarCliente = (e) => {
    e.preventDefault();
    if (novoCliente.trim()) {
      const hoje = new Date().toISOString().split('T')[0];
      const dataValidade = new Date();
      dataValidade.setMonth(dataValidade.getMonth() + 3);
      const validadeStr = dataValidade.toISOString().split('T')[0];

      setClientes([...clientes, {
        id: clientes.length + 1,
        nome: novoCliente,
        pontos: 0,
        data_inicio: hoje,
        data_validade: validadeStr,
        resgatado: false
      }]);
      setNovoCliente('');
    }
  };

  const handleAdicionarPontos = (id) => {
    setClientes(clientes.map(cliente => {
      if (cliente.id === id && !cliente.resgatado) {
        return { ...cliente, pontos: cliente.pontos + 2 };
      }
      return cliente;
    }));
  };

  const handleResgatar = (id) => {
    setClientes(clientes.map(cliente => {
      if (cliente.id === id && cliente.pontos >= 10 && verificarValidade(cliente.data_validade)) {
        return { ...cliente, pontos: 0, resgatado: true };
      }
      return cliente;
    }));
  };

  const handleDeletar = (id) => {
    setClientes(clientes.filter(c => c.id !== id));
  };

  return (
    <div className="page-container">
      <h2>Programa de Fidelidade</h2>

      <section className="info-banner">
        <h3>📋 Como Funciona?</h3>
        <p>✅ <strong>2 pontos</strong> por cada serviço realizado</p>
        <p>✅ <strong>10 pontos</strong> = <strong>¥500</strong> de desconto</p>
        <p>✅ Válido por <strong>3 meses</strong> (se não usar, perde)</p>
        <p>✅ <strong>Intransferível</strong> (pessoal do cliente)</p>
      </section>

      <section className="form-section">
        <h3>Novo Cliente no Programa</h3>
        <form onSubmit={handleAdicionarCliente}>
          <input
            type="text"
            placeholder="Nome do Cliente"
            value={novoCliente}
            onChange={(e) => setNovoCliente(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" style={{gridColumn: '1 / -1'}}>
            Adicionar ao Programa
          </button>
        </form>
      </section>

      <section className="list-section">
        <h3>Clientes no Programa</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Pontos</th>
              <th>Validade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => {
              const valido = verificarValidade(cliente.data_validade);
              const podeResgatar = cliente.pontos >= 10 && valido;
              
              return (
                <tr key={cliente.id}>
                  <td>{cliente.nome}</td>
                  <td>
                    <strong style={{color: '#d4af37', fontSize: '16px'}}>
                      {cliente.pontos} / 10
                    </strong>
                  </td>
                  <td>{cliente.data_validade}</td>
                  <td>
                    {cliente.resgatado ? (
                      <span style={{color: '#4caf50', fontWeight: 'bold'}}>✅ Resgatado</span>
                    ) : !valido ? (
                      <span style={{color: '#f44336', fontWeight: 'bold'}}>❌ Expirado</span>
                    ) : podeResgatar ? (
                      <span style={{color: '#ff9800', fontWeight: 'bold'}}>🎁 Pronto para Resgatar</span>
                    ) : (
                      <span style={{color: '#999'}}>Acumulando...</span>
                    )}
                  </td>
                  <td style={{display: 'flex', gap: '5px'}}>
                    {!cliente.resgatado && valido && (
                      <>
                        <button 
                          className="btn-primary"
                          onClick={() => handleAdicionarPontos(cliente.id)}
                          style={{padding: '5px 10px', fontSize: '12px'}}
                        >
                          +2 Pontos
                        </button>
                        {podeResgatar && (
                          <button 
                            className="btn-primary"
                            onClick={() => handleResgatar(cliente.id)}
                            style={{padding: '5px 10px', fontSize: '12px', backgroundColor: '#ff9800'}}
                          >
                            Resgatar
                          </button>
                        )}
                      </>
                    )}
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeletar(cliente.id)}
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default Fidelidade;