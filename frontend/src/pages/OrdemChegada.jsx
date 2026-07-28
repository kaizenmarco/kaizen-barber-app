import React, { useState } from 'react';

function OrdemChegada({ t }) {
  const hoje = new Date().toISOString().split('T')[0];

  const [bloqueios, setBloqueios] = useState([
    { id: 1, data: '2026-07-28', tipo: 'dia_inteiro', motivo: 'Feriado Prolongado', ativo: true },
    { id: 2, data: '2026-08-15', tipo: 'dia_inteiro', motivo: 'Obon Festival', ativo: true },
  ]);

  const [fila, setFila] = useState([
    { id: 1, nome: 'João Silva', horario_chegada: '09:30', servico: 'Corte', status: 'atendendo' },
    { id: 2, nome: 'Maria Santos', horario_chegada: '09:45', servico: 'Coloração', status: 'aguardando' },
    { id: 3, nome: 'Pedro Costa', horario_chegada: '10:00', servico: 'Corte & Barba', status: 'aguardando' },
  ]);

  const [novoBloquio, setNovoBloquio] = useState({
    data: '',
    tipo: 'dia_inteiro',
    motivo: ''
  });

  const [novaChegada, setNovaChegada] = useState({
    nome: '',
    servico: ''
  });

  const handleAdicionarBloquio = (e) => {
    e.preventDefault();
    if (novoBloquio.data && novoBloquio.motivo) {
      setBloqueios([...bloqueios, {
        id: bloqueios.length + 1,
        ...novoBloquio,
        ativo: true
      }]);
      setNovoBloquio({ data: '', tipo: 'dia_inteiro', motivo: '' });
    }
  };

  const handleAdicionarChegada = (e) => {
    e.preventDefault();
    if (novaChegada.nome && novaChegada.servico) {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setFila([...fila, {
        id: fila.length + 1,
        ...novaChegada,
        horario_chegada: hora,
        status: 'aguardando'
      }]);
      setNovaChegada({ nome: '', servico: '' });
    }
  };

  const handleMudarStatus = (id, novoStatus) => {
    setFila(fila.map(cliente => 
      cliente.id === id ? { ...cliente, status: novoStatus } : cliente
    ));
  };

  const handleDeletarBloquio = (id) => {
    setBloqueios(bloqueios.filter(b => b.id !== id));
  };

  const handleDeletarChegada = (id) => {
    setFila(fila.filter(c => c.id !== id));
  };

  const bloquioHoje = bloqueios.find(b => b.data === hoje && b.ativo);

  return (
    <div className="page-container">
      <h2>Ordem de Chegada</h2>

      {bloquioHoje && (
        <section className="info-banner" style={{backgroundColor: 'rgba(244, 67, 54, 0.1)', borderLeft: '4px solid #f44336'}}>
          <h3>🚫 Bloqueio Ativo Hoje</h3>
          <p><strong>Motivo:</strong> {bloquioHoje.motivo}</p>
          <p><strong>Tipo:</strong> {bloquioHoje.tipo === 'dia_inteiro' ? 'Dia Inteiro' : 'Período'}</p>
          <p style={{color: '#f44336', fontWeight: 'bold'}}>⚠️ Agendamentos bloqueados! Apenas ordem de chegada.</p>
        </section>
      )}

      <section className="form-section">
        <h3>Bloquear Dia/Período</h3>
        <form onSubmit={handleAdicionarBloquio}>
          <input
            type="date"
            value={novoBloquio.data}
            onChange={(e) => setNovoBloquio({...novoBloquio, data: e.target.value})}
            required
          />
          <select
            value={novoBloquio.tipo}
            onChange={(e) => setNovoBloquio({...novoBloquio, tipo: e.target.value})}
          >
            <option value="dia_inteiro">Dia Inteiro</option>
            <option value="manha">Período (Manhã)</option>
            <option value="tarde">Período (Tarde)</option>
            <option value="noite">Período (Noite)</option>
          </select>
          <input
            type="text"
            placeholder="Motivo (ex: Feriado, Festival, Movimento Alto)"
            value={novoBloquio.motivo}
            onChange={(e) => setNovoBloquio({...novoBloquio, motivo: e.target.value})}
            required
          />
          <button type="submit" className="btn-primary" style={{gridColumn: '1 / -1'}}>
            Bloquear
          </button>
        </form>
      </section>

      <section className="list-section">
        <h3>Dias Bloqueados</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {bloqueios.map((bloqueio) => (
              <tr key={bloqueio.id}>
                <td>{bloqueio.data}</td>
                <td>{bloqueio.tipo === 'dia_inteiro' ? '📅 Dia Inteiro' : '🕐 Período'}</td>
                <td>{bloqueio.motivo}</td>
                <td>
                  {bloqueio.ativo ? (
                    <span style={{color: '#f44336', fontWeight: 'bold'}}>🔒 Ativo</span>
                  ) : (
                    <span style={{color: '#999'}}>Inativo</span>
                  )}
                </td>
                <td>
                  <button 
                    className="btn-delete"
                    onClick={() => handleDeletarBloquio(bloqueio.id)}
                  >
                    Deletar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {bloquioHoje && (
        <>
          <section className="form-section">
            <h3>Registrar Chegada</h3>
            <form onSubmit={handleAdicionarChegada}>
              <input
                type="text"
                placeholder="Nome do Cliente"
                value={novaChegada.nome}
                onChange={(e) => setNovaChegada({...novaChegada, nome: e.target.value})}
                required
              />
              <select
                value={novaChegada.servico}
                onChange={(e) => setNovaChegada({...novaChegada, servico: e.target.value})}
                required
              >
                <option value="">Selecione serviço</option>
                <option value="Corte">Corte</option>
                <option value="Corte & Barba">Corte & Barba</option>
                <option value="Coloração">Coloração</option>
                <option value="Alisamento">Alisamento</option>
              </select>
              <button type="submit" className="btn-primary" style={{gridColumn: '1 / -1'}}>
                Registrar Chegada
              </button>
            </form>
          </section>

          <section className="list-section">
            <h3>Fila de Espera (Ordem de Chegada)</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Cliente</th>
                  <th>Horário de Chegada</th>
                  <th>Serviço</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {fila.map((cliente, index) => (
                  <tr key={cliente.id}>
                    <td><strong>#{index + 1}</strong></td>
                    <td>{cliente.nome}</td>
                    <td>{cliente.horario_chegada}</td>
                    <td>{cliente.servico}</td>
                    <td>
                      {cliente.status === 'atendendo' ? (
                        <span style={{color: '#4caf50', fontWeight: 'bold'}}>✅ Atendendo</span>
                      ) : cliente.status === 'atendido' ? (
                        <span style={{color: '#999'}}>✔️ Atendido</span>
                      ) : (
                        <span style={{color: '#ff9800', fontWeight: 'bold'}}>⏳ Aguardando</span>
                      )}
                    </td>
                    <td style={{display: 'flex', gap: '5px'}}>
                      {cliente.status !== 'atendendo' && (
                        <button 
                          className="btn-primary"
                          onClick={() => handleMudarStatus(cliente.id, 'atendendo')}
                          style={{padding: '5px 10px', fontSize: '12px'}}
                        >
                          Atender
                        </button>
                      )}
                      {cliente.status === 'atendendo' && (
                        <button 
                          className="btn-primary"
                          onClick={() => handleMudarStatus(cliente.id, 'atendido')}
                          style={{padding: '5px 10px', fontSize: '12px', backgroundColor: '#4caf50'}}
                        >
                          Finalizar
                        </button>
                      )}
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeletarChegada(cliente.id)}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

export default OrdemChegada;