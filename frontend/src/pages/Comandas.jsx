import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function Comandas({ t }) {
  const hoje = new Date();

  const [comandaAberta, setComandaAberta] = useState(false);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [novoItem, setNovoItem] = useState({
    cliente: '',
    servico: '',
    valor: '',
    profissional: ''
  });

  const servicosLista = [
    { nome: 'Corte', valor: 4000 },
    { nome: 'Corte + Sobrancelhas', valor: 4500 },
    { nome: 'Corte + Barba', valor: 6500 },
    { nome: 'Coloração', valor: 15000 },
    { nome: 'Alisamento', valor: 15000 },
    { nome: 'Corte Feminino', valor: 4000 },
    { nome: 'Permanente', valor: 6000 },
    { nome: 'Limpeza de Pele', valor: 5000 },
  ];

  useEffect(() => {
    buscarComandas();
  }, []);

  const buscarComandas = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          cliente_id,
          profissional_id,
          servico_id,
          data_hora,
          status,
          preco_final,
          clientes(id, nome),
          profissionais:profissional_id(id, nome),
          servicos:servico_id(id, nome)
        `)
        .eq('status', 'REALIZADO')
        .order('data_hora', { ascending: false });

      if (error) throw error;

      const itensFormatados = data.map(agendamento => {
        const dataHora = new Date(agendamento.data_hora);
        const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dataHora.getDay()];
        const dia = String(dataHora.getDate()).padStart(2, '0');
        const hora = agendamento.data_hora.split('T')[1]?.substring(0, 5) || '';

        return {
          id: agendamento.id,
          cliente: agendamento.clientes?.nome || 'Desconhecido',
          servico: agendamento.servicos?.nome || 'N/A',
          valor: agendamento.preco_final || 0,
          profissional: agendamento.profissionais?.nome || 'N/A',
          hora: hora,
          data: agendamento.data_hora?.split('T')[0] || '',
          diaSemana: diaSemana,
          dia: dia
        };
      });

      setItens(itensFormatados);
    } catch (error) {
      alert('❌ Erro ao buscar comandas: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleAbrirComanda = () => {
    setComandaAberta(true);
  };

  const handleFecharComanda = () => {
    setComandaAberta(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoItem({ ...novoItem, [name]: value });
  };

  const handleAdicionarItem = async (e) => {
    e.preventDefault();
    
    if (!novoItem.cliente || !novoItem.servico || !novoItem.valor || !novoItem.profissional) {
      alert('⚠️ Preencha todos os campos!');
      return;
    }

    try {
      const { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', novoItem.cliente)
        .single();

      if (!clienteExistente) {
        const { error: erroCliente } = await supabase
          .from('clientes')
          .insert([{ nome: novoItem.cliente }]);

        if (erroCliente) throw erroCliente;
      }

      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dataHora = new Date();
      const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dataHora.getDay()];
      const dia = String(dataHora.getDate()).padStart(2, '0');

      const novoItemFormatado = {
        id: Date.now(),
        cliente: novoItem.cliente,
        servico: novoItem.servico,
        valor: parseFloat(novoItem.valor),
        profissional: novoItem.profissional,
        hora: hora,
        data: dataHora.toISOString().split('T')[0],
        diaSemana: diaSemana,
        dia: dia
      };

      setItens([novoItemFormatado, ...itens]);
      setNovoItem({ cliente: '', servico: '', valor: '', profissional: '' });
      alert('✅ Serviço adicionado à comanda!');
    } catch (error) {
      alert('❌ Erro ao adicionar: ' + error.message);
    }
  };

  const total = itens.reduce((sum, item) => sum + item.valor, 0);

  const nomeDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][hoje.getDay()];
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();

  return (
    <div className="page-container">
      <h2>📋 Comandas do Dia - {nomeDia}, {dia}/{mes}/{ano}</h2>

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
              {servicosLista.map((s, idx) => (
                <option key={idx} value={s.nome}>{s.nome} - ¥{s.valor.toLocaleString('ja-JP')}</option>
              ))}
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
              <option value="Marco Kaizen">Marco Kaizen</option>
              <option value="Gabriel Little Kaizen">Gabriel Little Kaizen</option>
              <option value="Neia">Neia</option>
            </select>
            <button type="submit" className="btn-primary">Adicionar Serviço</button>
          </form>
        </section>
      )}

      <section className="list-section">
        <h3>📊 Serviços Realizados</h3>
        
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>⏳ Carregando...</p>
        ) : itens.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum serviço realizado ainda</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Dia da Semana</th>
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
                    <td style={{ fontWeight: 'bold', color: '#d4af37' }}>{item.dia}</td>
                    <td style={{ fontWeight: 'bold', color: '#4ade80' }}>{item.diaSemana}</td>
                    <td>{item.hora}</td>
                    <td>{item.cliente}</td>
                    <td>{item.servico}</td>
                    <td>{item.profissional}</td>
                    <td style={{ fontWeight: 'bold', color: '#d4af37' }}>¥{item.valor.toLocaleString('ja-JP')}</td>
                    <td>
                      <button 
                        className="btn-delete"
                        onClick={() => setItens(itens.filter(i => i.id !== item.id))}
                      >
                        🗑️ Deletar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Comandas;