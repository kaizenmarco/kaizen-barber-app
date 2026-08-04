import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function Agendamentos({ t }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaProfissional, setAbaProfissional] = useState('11c0c7fb-e020-4c49-ab0a-28a16109b35f');
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: '',
    email: '',
    telefone: '',
    data: '',
    horario: '',
    servico: '',
    profissional: ''
  });

  const profissionaisLista = [
    { id: 1, uuid: '11c0c7fb-e020-4c49-ab0a-28a16109b35f', nome: 'Marco Kaizen' },
    { id: 2, uuid: '66266181-d06b-4f54-bcc9-12dccc100cb4', nome: 'Gabriel Little Kaizen' },
    { id: 3, uuid: 'ad232428-9872-46db-82b3-27819ab353ff', nome: 'Neia' },
  ];

  const servicosLista = [
    { id: 1, uuid: '3f905b1f-61b6-4749-870a-cbe485e39fec', nome: 'Corte' },
    { id: 2, uuid: '68b86906-5816-4532-a4ac-6487531f872f', nome: 'Corte + Sobrancelhas' },
    { id: 3, uuid: 'b38f864d-e4f6-44e3-a03b-4706c7984306', nome: 'Corte + Barba' },
    { id: 4, uuid: '21a0d4eb-ee51-4124-a84b-34c3bdf307dc', nome: 'Coloração' },
    { id: 5, uuid: '2f4ab333-ba87-40f5-9c3a-3dd911104130', nome: 'Alisamento' },
    { id: 6, uuid: '3ccdf5fc-eda5-4c09-9d19-19bcb7ee044a', nome: 'Corte Feminino' },
    { id: 7, uuid: '47d96756-2f6c-48ed-82f6-da80e0166b96', nome: 'Permanente' },
    { id: 8, uuid: '1b3d936d-e4ff-4ab0-8bb5-78c6139230c2', nome: 'Limpeza de Pele' },
  ];

  // Buscar agendamentos
  useEffect(() => {
    buscarAgendamentos();
  }, []);

  const buscarAgendamentos = async () => {
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
          clientes(id, nome, email, telefone),
          profissionais:profissional_id(id, nome),
          servicos:servico_id(id, nome)
        `)
        .order('data_hora', { ascending: false });

      if (error) throw error;

      const agendamentosFormatados = data.map(agendamento => {
        const dataHora = new Date(agendamento.data_hora);
        const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dataHora.getDay()];
        
        return {
          id: agendamento.id,
          cliente: agendamento.clientes?.nome || 'Desconhecido',
          email: agendamento.clientes?.email || '',
          telefone: agendamento.clientes?.telefone || '',
          data: agendamento.data_hora?.split('T')[0] || '',
          hora: agendamento.data_hora?.split('T')[1]?.substring(0, 5) || '',
          diaSemana: diaSemana,
          servico: agendamento.servicos?.nome || 'N/A',
          profissional: agendamento.profissionais?.nome || 'N/A',
          profissionalId: agendamento.profissional_id,
          status: agendamento.status,
          preco: agendamento.preco_final
        };
      });

      setAgendamentos(agendamentosFormatados);
    } catch (error) {
      alert('❌ Erro ao buscar agendamentos: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoAgendamento({ ...novoAgendamento, [name]: value });
  };

  const handleAgendar = async (e) => {
    e.preventDefault();
    
    if (!novoAgendamento.cliente || !novoAgendamento.email || !novoAgendamento.data || !novoAgendamento.horario) {
      alert('⚠️ Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      let clienteId = null;
      const { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', novoAgendamento.email)
        .single();

      if (clienteExistente) {
        clienteId = clienteExistente.id;
      } else {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes')
          .insert([{
            nome: novoAgendamento.cliente,
            email: novoAgendamento.email,
            telefone: novoAgendamento.telefone || null
          }])
          .select('id')
          .single();

        if (erroCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      const profissionalSelecionado = profissionaisLista.find(p => p.nome === novoAgendamento.profissional);
      const servicoSelecionado = servicosLista.find(s => s.nome === novoAgendamento.servico);

      const { error: erroAgendamento } = await supabase
        .from('agendamentos')
        .insert([{
          cliente_id: clienteId,
          profissional_id: profissionalSelecionado?.uuid,
          servico_id: servicoSelecionado?.uuid,
          data_hora: `${novoAgendamento.data}T${novoAgendamento.horario}:00`,
          status: 'AGENDADO',
          preco_final: 0
        }]);

      if (erroAgendamento) throw erroAgendamento;

      alert('✅ Agendamento criado com sucesso!');
      setNovoAgendamento({ cliente: '', email: '', telefone: '', data: '', horario: '', servico: '', profissional: '' });
      buscarAgendamentos();
    } catch (error) {
      alert('❌ Erro ao criar agendamento: ' + error.message);
    }
  };

  const handleAlterarStatus = async (agendamentoId, novoStatus) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: novoStatus })
        .eq('id', agendamentoId);

      if (error) throw error;

      alert('✅ Status atualizado!');
      buscarAgendamentos();
    } catch (error) {
      alert('❌ Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDeletar = async (agendamentoId) => {
    if (!window.confirm('Tem certeza que deseja deletar este agendamento?')) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamentoId);

      if (error) throw error;

      alert('✅ Agendamento deletado!');
      buscarAgendamentos();
    } catch (error) {
      alert('❌ Erro ao deletar: ' + error.message);
    }
  };

  const getCorStatus = (status) => {
    switch(status) {
      case 'AGENDADO': return '#d4af37';
      case 'CONFIRMADO': return '#4ade80';
      case 'REALIZADO': return '#60a5fa';
      case 'CANCELADO': return '#f87171';
      case 'NÃO_COMPARECEU': return '#fb923c';
      case 'PREÇO_PENDENTE': return '#f97316';
      default: return '#9ca3af';
    }
  };

  // Filtrar agendamentos da aba ativa
  const agendamentosFiltrados = agendamentos.filter(a => {
    const statusOk = filtroStatus === 'todos' || a.status === filtroStatus;
    const profissionalOk = a.profissionalId === abaProfissional;
    return statusOk && profissionalOk;
  });

  // Gerar calendário
  const gerarCalendario = () => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasMes = ultimoDia.getDate();
    const diaInicio = primeiroDia.getDay();

    const dias = [];
    for (let i = 0; i < diaInicio; i++) {
      dias.push(null);
    }
    for (let i = 1; i <= diasMes; i++) {
      dias.push(i);
    }

    const agendadosDeste = agendamentosFiltrados.filter(a => {
      const dataAgendamento = new Date(a.data);
      return dataAgendamento.getFullYear() === ano && dataAgendamento.getMonth() === mes;
    });

    return dias.map((dia, idx) => {
      if (!dia) return <div key={`vazio-${idx}`} style={{ padding: '10px' }}></div>;

      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const agendadosNoDia = agendadosDeste.filter(a => a.data === dataStr);

      return (
        <div
          key={dia}
          style={{
            border: '1px solid #404040',
            padding: '10px',
            borderRadius: '6px',
            background: agendadosNoDia.length > 0 ? '#2d3d2d' : '#2d2d2d',
            minHeight: '80px'
          }}
        >
          <strong style={{ color: '#d4af37' }}>{dia}</strong>
          {agendadosNoDia.map(a => (
            <div key={a.id} style={{ fontSize: '11px', color: '#e8e8e8', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #404040' }}>
              <span style={{ color: getCorStatus(a.status), fontWeight: 'bold' }}>● </span>
              {a.hora} - {a.cliente}
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <div className="page-container">
      <h2>📅 Agendamentos</h2>

      <section className="form-section">
        <h3>Novo Agendamento</h3>
        <form onSubmit={handleAgendar}>
          <input
            type="text"
            name="cliente"
            placeholder="Nome do Cliente"
            value={novoAgendamento.cliente}
            onChange={handleInputChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email do Cliente"
            value={novoAgendamento.email}
            onChange={handleInputChange}
            required
          />
          <input
            type="tel"
            name="telefone"
            placeholder="Telefone (opcional)"
            value={novoAgendamento.telefone}
            onChange={handleInputChange}
          />
          <input
            type="date"
            name="data"
            value={novoAgendamento.data}
            onChange={handleInputChange}
            required
          />
          <input
            type="time"
            name="horario"
            value={novoAgendamento.horario}
            onChange={handleInputChange}
            required
          />
          <select
            name="servico"
            value={novoAgendamento.servico}
            onChange={handleInputChange}
            required
          >
            <option value="">Selecione um serviço</option>
            {servicosLista.map(s => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
          <select
            name="profissional"
            value={novoAgendamento.profissional}
            onChange={handleInputChange}
            required
          >
            <option value="">Selecione um profissional</option>
            {profissionaisLista.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Agendar</button>
        </form>
      </section>

      {/* CALENDÁRIO VISUAL */}
      <section className="list-section">
        <h3>📅 Calendário - {profissionaisLista.find(p => p.uuid === abaProfissional)?.nome}</h3>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))}
            style={{ padding: '8px 16px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ← Anterior
          </button>
          <span style={{ color: '#d4af37', fontWeight: 'bold', minWidth: '150px', textAlign: 'center' }}>
            {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))}
            style={{ padding: '8px 16px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Próximo →
          </button>
        </div>

        {/* ABAS DOS PROFISSIONAIS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #d4af37', paddingBottom: '10px', overflowX: 'auto' }}>
          {profissionaisLista.map(prof => (
            <button
              key={prof.uuid}
              onClick={() => setAbaProfissional(prof.uuid)}
              style={{
                padding: '10px 20px',
                background: abaProfissional === prof.uuid ? '#d4af37' : '#2d2d2d',
                color: abaProfissional === prof.uuid ? '#1a1a1a' : '#d4af37',
                border: '1px solid #d4af37',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {prof.nome}
            </button>
          ))}
        </div>

        {/* GRID DO CALENDÁRIO */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '10px',
          marginBottom: '30px'
        }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(dia => (
            <div key={dia} style={{ textAlign: 'center', color: '#d4af37', fontWeight: 'bold', padding: '10px' }}>
              {dia}
            </div>
          ))}
          {gerarCalendario()}
        </div>
      </section>

      {/* TABELA COM DIA DA SEMANA */}
      <section className="list-section">
        <h3>📋 Lista Detalhada</h3>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select 
            value={filtroStatus} 
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d4af37', background: '#2d2d2d', color: '#e8e8e8' }}
          >
            <option value="todos">Todos os Status</option>
            <option value="AGENDADO">Agendado</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="REALIZADO">Realizado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>

          <p style={{ color: '#d4af37', fontWeight: 'bold' }}>
            Total: {agendamentosFiltrados.length} agendamentos
          </p>
        </div>

        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>⏳ Carregando...</p>
        ) : agendamentosFiltrados.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum agendamento encontrado</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Email</th>
                  <th>Data</th>
                  <th>Dia da Semana</th>
                  <th>Hora</th>
                  <th>Serviço</th>
                  <th>Status</th>
                  <th>Preço (¥)</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {agendamentosFiltrados.map((agendamento) => (
                  <tr key={agendamento.id}>
                    <td style={{ fontWeight: 'bold' }}>{agendamento.cliente}</td>
                    <td style={{ fontSize: '12px', color: '#999' }}>{agendamento.email}</td>
                    <td>{agendamento.data}</td>
                    <td style={{ color: '#d4af37', fontWeight: 'bold' }}>{agendamento.diaSemana}</td>
                    <td>{agendamento.hora}</td>
                    <td>{agendamento.servico}</td>
                    <td>
                      <select
                        value={agendamento.status}
                        onChange={(e) => handleAlterarStatus(agendamento.id, e.target.value)}
                        style={{
                          padding: '6px',
                          borderRadius: '4px',
                          border: 'none',
                          background: getCorStatus(agendamento.status),
                          color: '#1a1a1a',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="AGENDADO">Agendado</option>
                        <option value="CONFIRMADO">Confirmado</option>
                        <option value="REALIZADO">Realizado</option>
                        <option value="CANCELADO">Cancelado</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#d4af37' }}>
                      {agendamento.preco || '-'}
                    </td>
                    <td>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeletar(agendamento.id)}
                      >
                        🗑️
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

export default Agendamentos;