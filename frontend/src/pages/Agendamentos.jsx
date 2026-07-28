import React, { useState } from 'react';

function Agendamentos({ t }) {
  const [agendamentos, setAgendamentos] = useState([
    { id: 1, cliente: 'João Silva', data: '2026-07-28', horario: '10:00', servico: 'Corte', profissional: 'Marco' },
    { id: 2, cliente: 'Maria Santos', data: '2026-07-28', horario: '14:30', servico: 'Corte & Barba', profissional: 'Filho' },
  ]);

  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: '',
    data: '',
    horario: '',
    servico: '',
    profissional: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoAgendamento({ ...novoAgendamento, [name]: value });
  };

  const handleAgendar = (e) => {
    e.preventDefault();
    if (novoAgendamento.cliente && novoAgendamento.data && novoAgendamento.horario) {
      setAgendamentos([...agendamentos, {
        id: agendamentos.length + 1,
        ...novoAgendamento
      }]);
      setNovoAgendamento({ cliente: '', data: '', horario: '', servico: '', profissional: '' });
    }
  };

  return (
    <div className="page-container">
      <h2>{t('nav.agendamentos')}</h2>

      <section className="form-section">
        <h3>Cadastro/Agendamento</h3>
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
            <option value="Corte">Corte</option>
            <option value="Corte & Barba">Corte & Barba</option>
            <option value="Barba">Barba</option>
            <option value="Coloração">Coloração</option>
          </select>
          <select
  name="profissional"
  value={novoAgendamento.profissional}
  onChange={handleInputChange}
  required
>
  <option value="">Selecione um profissional</option>
  <option value="Marco">Marco Kaizen</option>
  <option value="Gabriel Little Kaizen">Gabriel Little Kaizen</option>
  <option value="Neia">Neia</option>
</select>
          <button type="submit" className="btn-primary">Agendar</button>
        </form>
      </section>

      <section className="list-section">
        <h3>Agendamentos Hoje</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Data</th>
              <th>Horário</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {agendamentos.map((agendamento) => (
              <tr key={agendamento.id}>
                <td>{agendamento.cliente}</td>
                <td>{agendamento.data}</td>
                <td>{agendamento.horario}</td>
                <td>{agendamento.servico}</td>
                <td>{agendamento.profissional}</td>
                <td>
                  <button 
                    className="btn-delete"
                    onClick={() => setAgendamentos(agendamentos.filter(a => a.id !== agendamento.id))}
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

export default Agendamentos;