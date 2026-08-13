import React, { useState } from 'react';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

function OrdemChegada({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

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
      <h2>{t('ordem.titulo')}</h2>

      {bloquioHoje && (
        <section className="info-banner" style={{backgroundColor: 'rgba(244, 67, 54, 0.1)', borderLeft: '4px solid #f44336'}}>
          <h3>{t('ordem.bloqueioAtivoHoje')}</h3>
          <p><strong>{t('ordem.motivo')}</strong> {bloquioHoje.motivo}</p>
          <p><strong>{t('ordem.tipo')}</strong> {bloquioHoje.tipo === 'dia_inteiro' ? t('ordem.diaInteiro') : t('ordem.periodo')}</p>
          <p style={{color: '#f44336', fontWeight: 'bold'}}>{t('ordem.agendamentosBloqueados')}</p>
        </section>
      )}

      <section className="form-section">
        <h3>{t('ordem.bloquearDiaPeriodo')}</h3>
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
            <option value="dia_inteiro">{t('ordem.diaInteiro')}</option>
            <option value="manha">{t('ordem.periodoManha')}</option>
            <option value="tarde">{t('ordem.periodoTarde')}</option>
            <option value="noite">{t('ordem.periodoNoite')}</option>
          </select>
          <input
            type="text"
            placeholder={t('ordem.motivoPlaceholder')}
            value={novoBloquio.motivo}
            onChange={(e) => setNovoBloquio({...novoBloquio, motivo: e.target.value})}
            required
          />
          <button type="submit" className="btn-primary" style={{gridColumn: '1 / -1'}}>
            {t('ordem.bloquear')}
          </button>
        </form>
      </section>

      <section className="list-section">
        <h3>{t('ordem.diasBloqueados')}</h3>
        <table className="table">
          <thead>
            <tr>
              <th>{t('comum.data')}</th>
              <th>{t('caixa.tipo')}</th>
              <th>{t('ordem.motivo').replace(':', '')}</th>
              <th>{t('comum.status')}</th>
              <th>{t('comum.acao')}</th>
            </tr>
          </thead>
          <tbody>
            {bloqueios.map((bloqueio) => (
              <tr key={bloqueio.id}>
                <td>{bloqueio.data}</td>
                <td>{bloqueio.tipo === 'dia_inteiro' ? t('ordem.diaInteiroTag') : t('ordem.periodoTag')}</td>
                <td>{bloqueio.motivo}</td>
                <td>
                  {bloqueio.ativo ? (
                    <span style={{color: '#f44336', fontWeight: 'bold'}}>{t('ordem.ativo')}</span>
                  ) : (
                    <span style={{color: '#999'}}>{t('ordem.inativo')}</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeletarBloquio(bloqueio.id)}
                  >
                    {t('comum.deletar')}
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
            <h3>{t('ordem.registrarChegada')}</h3>
            <form onSubmit={handleAdicionarChegada}>
              <input
                type="text"
                placeholder={t('ordem.nomeCliente')}
                value={novaChegada.nome}
                onChange={(e) => setNovaChegada({...novaChegada, nome: e.target.value})}
                required
              />
              <select
                value={novaChegada.servico}
                onChange={(e) => setNovaChegada({...novaChegada, servico: e.target.value})}
                required
              >
                <option value="">{t('ordem.selecioneServico')}</option>
                <option value="Corte">Corte</option>
                <option value="Corte & Barba">Corte & Barba</option>
                <option value="Coloração">Coloração</option>
                <option value="Alisamento">Alisamento</option>
              </select>
              <button type="submit" className="btn-primary" style={{gridColumn: '1 / -1'}}>
                {t('ordem.registrarChegada')}
              </button>
            </form>
          </section>

          <section className="list-section">
            <h3>{t('ordem.filaEspera')}</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('ordem.ordem')}</th>
                  <th>{t('comum.cliente')}</th>
                  <th>{t('ordem.horarioChegada')}</th>
                  <th>{t('comum.servico')}</th>
                  <th>{t('comum.status')}</th>
                  <th>{t('comum.acoes')}</th>
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
                        <span style={{color: '#4caf50', fontWeight: 'bold'}}>{t('ordem.atendendo')}</span>
                      ) : cliente.status === 'atendido' ? (
                        <span style={{color: '#999'}}>{t('ordem.atendido')}</span>
                      ) : (
                        <span style={{color: '#ff9800', fontWeight: 'bold'}}>{t('ordem.aguardando')}</span>
                      )}
                    </td>
                    <td style={{display: 'flex', gap: '5px'}}>
                      {cliente.status !== 'atendendo' && (
                        <button
                          className="btn-primary"
                          onClick={() => handleMudarStatus(cliente.id, 'atendendo')}
                          style={{padding: '5px 10px', fontSize: '12px'}}
                        >
                          {t('ordem.atender')}
                        </button>
                      )}
                      {cliente.status === 'atendendo' && (
                        <button
                          className="btn-primary"
                          onClick={() => handleMudarStatus(cliente.id, 'atendido')}
                          style={{padding: '5px 10px', fontSize: '12px', backgroundColor: '#4caf50'}}
                        >
                          {t('ordem.finalizar')}
                        </button>
                      )}
                      <button
                        className="btn-delete"
                        onClick={() => handleDeletarChegada(cliente.id)}
                      >
                        {t('comum.remover')}
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
