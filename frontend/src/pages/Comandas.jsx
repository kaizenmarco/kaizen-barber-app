import React, { useState } from 'react';

function Comandas({ t }) {
  const hoje = new Date().toISOString().split('T')[0];
  
  const [comandaAberta, setComandaAberta] = useState(false);
  const [itens, setItens] = useState([
    { id: 1, cliente: 'João Silva', servico: 'Corte', valor: 4000, profissional: 'Marco', hora: '10:00' },
    { id: 2, cliente: 'Maria Santos', servico: 'Coloração', valor: 15000, profissional: 'Neia', hora: '11:30' },
  ]);

  const [novoItem, setNovoItem] = useState({
    cliente: '',
    servico: '',
    valor: '',
    profissional: ''
  });

  const handleAbrirComanda = () => {
    setComandaAberta(true);
    setItens([]);
  };

  const handleFecharComanda = () => {
    setComandaAberta(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoItem({ ...novoItem, [name]: value });
  };

  const handleAdicionarItem = (e) => {
    e.preventDefault();
    if (novoItem.cliente && novoItem.servico && novoItem.valor) {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setItens([...itens, {
        id: itens.length + 1,
        ...novoItem,
        valor: parseFloat(novoItem.valor),
        hora
      }]);
      setNovoItem({ cliente: '', servico: '', valor: '', profissional: '' });
    }
  };

  const total = itens.reduce((sum, item) => sum + item.valor, 0);

  return (
    <div className="page-container">
      <h2>Comanda do Dia - {hoje}</h2>

      <section className="caixa-status">
        <div className="status-card">
          <h3>Status da Comanda</h3>
          <p className={`status ${comandaAberta ? 'aberto' : 'fechado'}`}>
            {comandaAberta ? '✅ ABERTA' : '❌ FECHADA'}
          </p>
          {!comandaAberta ? (
            <button className="btn-primary" onClick={handleAbrirComanda}>
              Abrir Comanda
            </button>
          ) : (
            <button className="btn-danger" onClick={handleFecharComanda}>
              Fechar Comanda
            </button>
          )}
        </div>

        <div className="status-card">
          <h3>Total do Dia</h3>
          <p>Itens: <strong>{itens.length}</strong></p>
          <p className="saldo-final">Total: <strong>¥{total.toLocaleString('ja-JP')}</strong></p>
        </div>
      </section>

      {comandaAberta && (
        <section className="form-section">
          <h3>Adicionar Serviço</h3>
          <form onSubmit={handleAdicionarItem}>
            <input
              type="text"
              name="cliente"
              placeholder="Nome do Cliente"
              value={novoItem.cliente}
              onChange={handleInputChange}
              required
            />
            <select
              name="servico"
              value={novoItem.servico}
              onChange={handleInputChange}
              required
            >
              <option value="">Selecione um serviço</option>
              <option value="Corte">Corte - ¥4.000</option>
              <option value="Corte & Barba">Corte & Barba - ¥6.500</option>
              <option value="Barba">Barba - ¥3.000</option>
              <option value="Coloração">Coloração - ¥15.000</option>
              <option value="Alisamento">Alisamento - ¥15.000</option>
            </select>
            <input
              type="number"
              name="valor"
              placeholder="Valor (¥)"
              value={novoItem.valor}
              onChange={handleInputChange}
              required
            />
            <select
              name="profissional"
              value={novoItem.profissional}
              onChange={handleInputChange}
              required
            >
              <option value="">Selecione profissional</option>
              <option value="Marco">Marco</option>
              <option value="Gabriel Little Kaizen">Gabriel Little Kaizen</option>
              <option value="Neia">Neia</option>
            </select>
            <button type="submit" className="btn-primary">Adicionar Serviço</button>
          </form>
        </section>
      )}

      <section className="list-section">
        <h3>Serviços Realizados</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Valor</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td>{item.hora}</td>
                <td>{item.cliente}</td>
                <td>{item.servico}</td>
                <td>{item.profissional}</td>
                <td>¥{item.valor.toLocaleString('ja-JP')}</td>
                <td>
                  <button 
                    className="btn-delete"
                    onClick={() => setItens(itens.filter(i => i.id !== item.id))}
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

export default Comandas;