import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarDados();
  }, []);

  const buscarDados = async () => {
    setCarregando(true);
    try {
      // Buscar agendamentos
      const { data: agendamentosData, error: erroAgendamentos } = await supabase
        .from('agendamentos')
        .select(`
          id,
          cliente_id,
          profissional_id,
          data_hora,
          status,
          preco_final,
          clientes(nome),
          profissionais:profissional_id(id, nome),
          servicos:servico_id(id, nome)
        `)
        .order('data_hora', { ascending: false });

      if (erroAgendamentos) throw erroAgendamentos;

      // Buscar clientes
      const { data: clientesData, error: erroClientes } = await supabase
        .from('clientes')
        .select('id, nome');

      if (erroClientes) throw erroClientes;

      setAgendamentos(agendamentosData);
      setClientes(clientesData);
    } catch (error) {
      alert('❌ Erro ao buscar dados: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  // Calcular estatísticas
  const totalAgendamentos = agendamentos.length;
  const agendamentosConfirmados = agendamentos.filter(a => a.status === 'CONFIRMADO').length;
  const agendamentosRealizados = agendamentos.filter(a => a.status === 'REALIZADO').length;
  const receitaTotal = agendamentos
    .filter(a => a.status === 'REALIZADO')
    .reduce((sum, a) => sum + (a.preco_final || 0), 0);

  // Dados por status
  const dadosStatus = [
    { name: 'Confirmado', value: agendamentos.filter(a => a.status === 'CONFIRMADO').length, color: '#4ade80' },
    { name: 'Realizado', value: agendamentos.filter(a => a.status === 'REALIZADO').length, color: '#60a5fa' },
    { name: 'Cancelado', value: agendamentos.filter(a => a.status === 'CANCELADO').length, color: '#f87171' },
    { name: 'Agendado', value: agendamentos.filter(a => a.status === 'AGENDADO').length, color: '#d4af37' },
  ].filter(d => d.value > 0);

  // Dados por profissional
  const agendamentosPerProf = {};
  agendamentos.forEach(a => {
    const prof = a.profissionais?.nome || 'N/A';
    agendamentosPerProf[prof] = (agendamentosPerProf[prof] || 0) + 1;
  });

  const dadosProfissionais = Object.entries(agendamentosPerProf).map(([nome, count]) => ({
    name: nome,
    agendamentos: count
  }));

  // Receita por dia (últimos 7 dias)
  const agora = new Date();
  const ultimos7Dias = {};
  
  for (let i = 6; i >= 0; i--) {
    const data = new Date(agora);
    data.setDate(data.getDate() - i);
    const dataStr = data.toISOString().split('T')[0];
    ultimos7Dias[dataStr] = 0;
  }

  agendamentos
    .filter(a => a.status === 'REALIZADO')
    .forEach(a => {
      const dataStr = a.data_hora.split('T')[0];
      if (ultimos7Dias.hasOwnProperty(dataStr)) {
        ultimos7Dias[dataStr] += a.preco_final || 0;
      }
    });

  const dadosReceita = Object.entries(ultimos7Dias).map(([data, valor]) => ({
    data: new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    receita: valor
  }));

  // Agendamentos recentes
  const agendamentosRecentes = agendamentos.slice(0, 5);

  const getCorStatus = (status) => {
    switch(status) {
      case 'AGENDADO': return '#d4af37';
      case 'CONFIRMADO': return '#4ade80';
      case 'REALIZADO': return '#60a5fa';
      case 'CANCELADO': return '#f87171';
      default: return '#9ca3af';
    }
  };

  if (carregando) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#d4af37' }}>⏳ Carregando dashboard...</div>;
  }

  return (
    <div className="page-container">
      <h2>📊 Dashboard</h2>

      {/* CARDS DE RESUMO */}
      <section className="caixa-status" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div className="status-card">
          <h3>📅 Total Agendamentos</h3>
          <p style={{ fontSize: '32px', color: '#d4af37', fontWeight: 'bold', margin: '10px 0' }}>{totalAgendamentos}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>Todos os status</p>
        </div>

        <div className="status-card">
          <h3>✅ Confirmados</h3>
          <p style={{ fontSize: '32px', color: '#4ade80', fontWeight: 'bold', margin: '10px 0' }}>{agendamentosConfirmados}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>Aguardando</p>
        </div>

        <div className="status-card">
          <h3>✓ Realizados</h3>
          <p style={{ fontSize: '32px', color: '#60a5fa', fontWeight: 'bold', margin: '10px 0' }}>{agendamentosRealizados}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>Completados</p>
        </div>

        <div className="status-card">
          <h3>💰 Receita Total</h3>
          <p style={{ fontSize: '28px', color: '#4ade80', fontWeight: 'bold', margin: '10px 0' }}>¥{receitaTotal.toLocaleString('ja-JP')}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>De serviços realizados</p>
        </div>

        <div className="status-card">
          <h3>👥 Clientes</h3>
          <p style={{ fontSize: '32px', color: '#d4af37', fontWeight: 'bold', margin: '10px 0' }}>{clientes.length}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>Cadastrados</p>
        </div>
      </section>

      {/* GRÁFICOS */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {/* PIZZA - STATUS */}
        <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#d4af37', marginBottom: '15px' }}>Agendamentos por Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {dadosStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* BARRAS - PROFISSIONAIS */}
        <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ color: '#d4af37', marginBottom: '15px' }}>Agendamentos por Profissional</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosProfissionais}>
              <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
              <XAxis dataKey="name" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #d4af37' }} />
              <Bar dataKey="agendamentos" fill="#d4af37" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LINHA - RECEITA */}
        <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '12px', padding: '20px', gridColumn: 'span 2' }}>
          <h3 style={{ color: '#d4af37', marginBottom: '15px' }}>Receita - Últimos 7 Dias</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosReceita}>
              <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
              <XAxis dataKey="data" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #d4af37' }} />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="#4ade80" strokeWidth={2} name="Receita (¥)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* TABELA AGENDAMENTOS RECENTES */}
      <section style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ color: '#d4af37', marginBottom: '15px' }}>Agendamentos Recentes</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Profissional</th>
                <th>Data/Hora</th>
                <th>Status</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {agendamentosRecentes.map((agendamento) => (
                <tr key={agendamento.id}>
                  <td style={{ fontWeight: 'bold' }}>{agendamento.clientes?.nome || 'N/A'}</td>
                  <td>{agendamento.servicos?.nome || 'N/A'}</td>
                  <td>{agendamento.profissionais?.nome || 'N/A'}</td>
                  <td style={{ fontSize: '12px' }}>
                    {new Date(agendamento.data_hora).toLocaleDateString('pt-BR')} {agendamento.data_hora.split('T')[1]?.substring(0, 5)}
                  </td>
                  <td>
                    <span style={{
                      background: getCorStatus(agendamento.status),
                      color: '#1a1a1a',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {agendamento.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 'bold', color: '#d4af37' }}>¥{(agendamento.preco_final || 0).toLocaleString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;