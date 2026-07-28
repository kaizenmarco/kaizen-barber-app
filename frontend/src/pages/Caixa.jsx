import React, { useState } from 'react';

function Caixa({ t }) {
  const hoje = new Date().toISOString().split('T')[0];
  
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [movimentacoes, setMovimentacoes] = useState([
    { id: 1, tipo: 'entrada', descricao: 'Corte - João Silva', valor: 4000, hora: '10:00' },
    { id: 2, tipo: 'entrada', descricao: 'Corte & Barba - Pedro Costa', valor: 6500, hora: '11:30' },
    { id: 3, tipo: 'saida', descricao: 'Compra de produtos', valor: 2000, hora: '14:00' },
  ]);

  const [novaMovimentacao, setNovaMovimentacao] = useState({
    tipo: 'entrada',
    descricao: '',
    valor: ''
  });

  const handleAbrirCaixa = () => {
    setCaixaAberto(true);
    setMovimentacoes([]);
  };

  const handleFecharCaixa = () => {
    setCaixaAberto(false);
    setSaldoInicial('0');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovaMovimentacao({ ...novaMovimentacao, [name]: value });
  };

  const handleAdicionarMovimentacao = (e) => {
    e.preventDefault();
    if (novaMovimentacao.descricao && novaMovimentacao.valor) {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setMovimentacoes([...movimentacoes, {
        id: movimentacoes.length + 1,
        ...novaMovimentacao,
        valor: parseFloat(novaMovimentacao.valor),
        hora
      }]);
      setNovaMovimentacao({ tipo: 'entrada', descricao: '', valor: '' });
    }
  };

  const totalEntradas = movimentacoes
    .filter(m => m.tipo === 'entrada')
    .reduce((sum, m) => sum + m.valor, 0);

  const totalSaidas = movimentacoes
    .filter(m => m.tipo === 'saida')
    .reduce((sum, m) => sum + m.valor, 0);

  const saldoAtual = parseFloat(saldoInicial || 0) + totalEntradas - totalSaidas;

  return (
    <div className="page-container">
      <h2>Caixa - {hoje}</h2>

      <section className="caixa-status">
        <div className="status-card">
          <h3>Status do Caixa</h3>
          <p className={`status ${caixaAberto ? 'aberto' : 'fechado'}`}>
            {caixaAberto ? '✅ ABERTO' : '❌ FECHADO'}
          </p>
          {!caixaAberto ? (
            <>
              <input
                type="number"
                placeholder="Saldo Inicial (¥)"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
              />
              <button className="btn-primary" onClick={handleAbrirCaixa}>
                Abrir Caixa
              </button>
            </>
          ) : (
            <button className="btn-danger" onClick={handleFecharCaixa}>
              Fechar Caixa
            </button>
          )}
        </div>

        <div className="status-card">
          <h3>Resumo do Dia</h3>
          <p>Saldo Inicial: <strong>¥{parseFloat(saldoInicial || 0).toLocaleString('ja-JP')}</strong></p>
          <p>Entradas: <strong style={{color: '#4caf50'}}>¥{totalEntradas.toLocaleString('ja-JP')}</strong></p>
          <p>Saídas: <strong style={{color: '#f44336'}}>¥{totalSaidas.toLocaleString('ja-JP')}</strong></p>
          <p className="saldo-final">Saldo Final: <strong>¥{saldoAtual.toLocaleString('ja-JP')}</strong></p>
        </div>
      </section>

      {caixaAberto && (
        <section className="form-section">
          <h3>Nova Movimentação</h3>
          <form onSubmit={handleAdicionarMovimentacao}>
            <select
              name="tipo"
              value={novaMovimentacao.tipo}
              onChange={handleInputChange}
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
            <input
              type="text"
              name="descricao"
              placeholder="Descrição"
              value={novaMovimentacao.descricao}
              onChange={handleInputChange}
              required
            />
            <input
              type="number"
              name="valor"
              placeholder="Valor (¥)"
              value={novaMovimentacao.valor}
              onChange={handleInputChange}
              required
            />
            <button type="submit" className="btn-primary">Adicionar</button>
          </form>
        </section>
      )}

      <section className="list-section">
        <h3>Movimentações do Dia</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((mov) => (
              <tr key={mov.id} className={mov.tipo}>
                <td>{mov.hora}</td>
                <td>
                  <span className={`badge ${mov.tipo}`}>
                    {mov.tipo === 'entrada' ? '➕ Entrada' : '➖ Saída'}
                  </span>
                </td>
                <td>{mov.descricao}</td>
                <td>¥{mov.valor.toLocaleString('ja-JP')}</td>
                <td>
                  <button 
                    className="btn-delete"
                    onClick={() => setMovimentacoes(movimentacoes.filter(m => m.id !== mov.id))}
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

export default Caixa;