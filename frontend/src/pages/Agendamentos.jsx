import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getSlotsLivresNoDia, paraMinutos, buscarHorarioEstendido, HORARIO_ESTENDIDO_PADRAO } from '../config/horarios';
import { SERVICOS } from '../config/servicos';
import { LOCALE_POR_IDIOMA_ADMIN, DIAS_SEMANA_ABREV_ADMIN, DIAS_SEMANA_ADMIN, IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

function Agendamentos({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const locale = LOCALE_POR_IDIOMA_ADMIN[idioma] || 'pt-BR';
  const diasAbrev = DIAS_SEMANA_ABREV_ADMIN[idioma] || DIAS_SEMANA_ABREV_ADMIN['pt-BR'];
  const diasNomes = DIAS_SEMANA_ADMIN[idioma] || DIAS_SEMANA_ADMIN['pt-BR'];

  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaProfissional, setAbaProfissional] = useState('11c0c7fb-e020-4c49-ab0a-28a16109b35f');
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [horarioEstendido, setHorarioEstendido] = useState(HORARIO_ESTENDIDO_PADRAO);
  const [modoEncaixe, setModoEncaixe] = useState(false);

  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: '',
    email: '',
    telefone: '',
    data: '',
    horario: '',
    servico: '',
    profissional: ''
  });

  const statusOpcoes = ['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO'];

  const profissionaisLista = [
    { id: 1, uuid: '11c0c7fb-e020-4c49-ab0a-28a16109b35f', nome: 'Marco Kaizen' },
    { id: 2, uuid: '66266181-d06b-4f54-bcc9-12dccc100cb4', nome: 'Gabriel Little Kaizen' },
    { id: 3, uuid: 'ad232428-9872-46db-82b3-27819ab353ff', nome: 'Neia' },
  ];

  // Serviços (nome, duração, preço) vêm de config/servicos.js — mesma fonte
  // usada pelo site público, para nunca mais ficarem dessincronizados.
  const servicosLista = SERVICOS;

  useEffect(() => {
    buscarHorarioEstendido().then(setHorarioEstendido);
  }, []);

  // Buscar agendamentos
  useEffect(() => {
    buscarAgendamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Cálculo de horários disponíveis para o formulário "Novo Agendamento" ----
  // Usa a mesma lógica de duração por serviço do site público (config/horarios.js
  // + config/servicos.js), e os agendamentos já carregados nesta tela para saber
  // o que está ocupado — assim Admin e site público nunca mais mostram
  // disponibilidades diferentes para o mesmo dia.
  const profissionalNovoObj = profissionaisLista.find(p => p.nome === novoAgendamento.profissional);
  const servicoNovoObj = servicosLista.find(s => s.nome === novoAgendamento.servico);
  const duracaoNovoAgendamento = servicoNovoObj ? servicoNovoObj.duracaoMinutos : 60;

  const intervalosOcupadosNoDia = (!profissionalNovoObj || !novoAgendamento.data) ? [] : agendamentos
    .filter(a => a.profissionalId === profissionalNovoObj.uuid && a.data === novoAgendamento.data && a.status !== 'CANCELADO')
    .map(a => {
      const inicioMin = paraMinutos(a.hora);
      const duracao = servicosLista.find(s => s.nome === a.servico)?.duracaoMinutos || 60;
      return { inicioMin, fimMin: inicioMin + duracao, cliente: a.cliente, hora: a.hora, servico: a.servico };
    });

  const slotsDisponiveisNovoAgendamento = (!profissionalNovoObj || !servicoNovoObj || !novoAgendamento.data) ? [] : (() => {
    const dataObj = new Date(`${novoAgendamento.data}T00:00:00`);
    return getSlotsLivresNoDia(dataObj, duracaoNovoAgendamento, intervalosOcupadosNoDia, horarioEstendido);
  })();

  const conflitosEncaixe = (!modoEncaixe || !novoAgendamento.horario) ? [] : (() => {
    const inicioMin = paraMinutos(novoAgendamento.horario);
    const fimMin = inicioMin + duracaoNovoAgendamento;
    return intervalosOcupadosNoDia.filter(o => inicioMin < o.fimMin && fimMin > o.inicioMin);
  })();

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
          observacoes,
          clientes(id, nome, email, telefone),
          profissionais:profissional_id(id, nome),
          servicos:servico_id(id, nome)
        `)
        .order('data_hora', { ascending: false });

      if (error) throw error;

      const agendamentosFormatados = data.map(agendamento => {
        const dataHora = new Date(agendamento.data_hora);

        return {
          id: agendamento.id,
          cliente: agendamento.clientes?.nome || t('agendamentos.desconhecido'),
          email: agendamento.clientes?.email || '',
          telefone: agendamento.clientes?.telefone || '',
          data: agendamento.data_hora?.split('T')[0] || '',
          hora: agendamento.data_hora?.split('T')[1]?.substring(0, 5) || '',
          diaSemanaIndex: dataHora.getDay(),
          servico: agendamento.servicos?.nome || 'N/A',
          profissional: agendamento.profissionais?.nome || 'N/A',
          profissionalId: agendamento.profissional_id,
          status: agendamento.status,
          preco: agendamento.preco_final,
          encaixe: !!agendamento.observacoes?.startsWith('[ENCAIXE]')
        };
      });

      setAgendamentos(agendamentosFormatados);
    } catch (error) {
      alert(t('agendamentos.erroBuscar', { msg: error.message }));
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

    if (!novoAgendamento.cliente || !novoAgendamento.email || !novoAgendamento.data || !novoAgendamento.horario || !novoAgendamento.servico || !novoAgendamento.profissional) {
      alert(t('agendamentos.preencherObrigatorios'));
      return;
    }

    // Fora do modo Encaixe, só deixa agendar em horários que a própria tela
    // calculou como livres (evita conflito criado por engano).
    if (!modoEncaixe && !slotsDisponiveisNovoAgendamento.includes(novoAgendamento.horario)) {
      alert(t('agendamentos.horarioIndisponivel'));
      return;
    }

    // No modo Encaixe, se colide com outro agendamento, exige confirmação
    // explícita descrevendo o conflito — quem confirma assume a responsabilidade.
    if (modoEncaixe && conflitosEncaixe.length > 0) {
      const resumoConflito = conflitosEncaixe
        .map(c => `${c.hora} - ${c.cliente} (${c.servico})`)
        .join('\n');
      const confirmou = window.confirm(
        t('agendamentos.confirmarEncaixe', { horario: novoAgendamento.horario, prof: novoAgendamento.profissional, resumo: resumoConflito })
      );
      if (!confirmou) return;
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

      const observacoes = (modoEncaixe && conflitosEncaixe.length > 0)
        ? `[ENCAIXE] Agendado manualmente pelo Admin, sobrepondo: ${conflitosEncaixe.map(c => `${c.hora} ${c.cliente}`).join(', ')}`
        : (modoEncaixe ? '[ENCAIXE] Agendado manualmente pelo Admin fora dos horários padrão.' : null);

      const { error: erroAgendamento } = await supabase
        .from('agendamentos')
        .insert([{
          cliente_id: clienteId,
          profissional_id: profissionalSelecionado?.uuid,
          servico_id: servicoSelecionado?.uuid,
          data_hora: `${novoAgendamento.data}T${novoAgendamento.horario}:00`,
          status: 'AGENDADO',
          preco_final: 0,
          observacoes
        }]);

      if (erroAgendamento) throw erroAgendamento;

      alert(t('agendamentos.criadoComSucesso'));
      setNovoAgendamento({ cliente: '', email: '', telefone: '', data: '', horario: '', servico: '', profissional: '' });
      setModoEncaixe(false);
      buscarAgendamentos();
    } catch (error) {
      alert(t('agendamentos.erroAoCriar', { msg: error.message }));
    }
  };

  const handleAlterarStatus = async (agendamentoId, novoStatus) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: novoStatus })
        .eq('id', agendamentoId);

      if (error) throw error;

      alert(t('agendamentos.statusAtualizado'));
      buscarAgendamentos();
    } catch (error) {
      alert(t('agendamentos.erroAtualizarStatus', { msg: error.message }));
    }
  };

  const handleDeletar = async (agendamentoId) => {
    if (!window.confirm(t('agendamentos.confirmarDeletar'))) return;

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamentoId);

      if (error) throw error;

      alert(t('agendamentos.deletado'));
      buscarAgendamentos();
    } catch (error) {
      alert(t('agendamentos.erroDeletar', { msg: error.message }));
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
              {a.encaixe && <span style={{ color: '#f97316', fontWeight: 'bold' }}> {t('agendamentos.encaixeTag')}</span>}
              <div style={{ color: '#999', fontSize: '10px' }}>{a.servico}</div>
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <div className="page-container">
      <h2>{t('agendamentos.titulo')}</h2>

      <section className="form-section">
        <h3>{t('agendamentos.novoAgendamento')}</h3>
        <form onSubmit={handleAgendar}>
          <input
            type="text"
            name="cliente"
            placeholder={t('agendamentos.nomeCliente')}
            value={novoAgendamento.cliente}
            onChange={handleInputChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder={t('agendamentos.emailCliente')}
            value={novoAgendamento.email}
            onChange={handleInputChange}
            required
          />
          <input
            type="tel"
            name="telefone"
            placeholder={t('agendamentos.telefoneOpcional')}
            value={novoAgendamento.telefone}
            onChange={handleInputChange}
          />
          <select
            name="servico"
            value={novoAgendamento.servico}
            onChange={(e) => { handleInputChange(e); setNovoAgendamento(prev => ({ ...prev, servico: e.target.value, horario: '' })); }}
            required
          >
            <option value="">{t('comum.selecioneServico')}</option>
            {servicosLista.map(s => (
              <option key={s.id} value={s.nome}>{s.nome} ({s.duracao})</option>
            ))}
          </select>
          <select
            name="profissional"
            value={novoAgendamento.profissional}
            onChange={(e) => { handleInputChange(e); setNovoAgendamento(prev => ({ ...prev, profissional: e.target.value, horario: '' })); }}
            required
          >
            <option value="">{t('comum.selecioneProfissional')}</option>
            {profissionaisLista.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>
          <input
            type="date"
            name="data"
            value={novoAgendamento.data}
            onChange={(e) => { handleInputChange(e); setNovoAgendamento(prev => ({ ...prev, data: e.target.value, horario: '' })); }}
            required
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={modoEncaixe}
              onChange={(e) => { setModoEncaixe(e.target.checked); setNovoAgendamento(prev => ({ ...prev, horario: '' })); }}
            />
            <strong style={{ color: modoEncaixe ? '#f97316' : undefined }}>
              {t('agendamentos.modoEncaixe')} {modoEncaixe ? t('agendamentos.modoEncaixeAtivado') : ''}
            </strong>
          </label>

          {!novoAgendamento.profissional || !novoAgendamento.servico || !novoAgendamento.data ? (
            <p style={{ fontSize: '13px', color: '#999' }}>{t('agendamentos.selecioneParaVerHorarios')}</p>
          ) : modoEncaixe ? (
            <>
              <input
                type="time"
                name="horario"
                value={novoAgendamento.horario}
                onChange={handleInputChange}
                required
              />
              {novoAgendamento.horario && conflitosEncaixe.length > 0 && (
                <div style={{ background: 'rgba(249, 115, 22, 0.12)', border: '1px solid #f97316', borderRadius: '6px', padding: '10px', margin: '8px 0', fontSize: '13px' }}>
                  <strong style={{ color: '#f97316' }}>{t('agendamentos.conflito')} </strong>
                  {conflitosEncaixe.map(c => `${c.hora} - ${c.cliente} (${c.servico})`).join('; ')}
                </div>
              )}
              {intervalosOcupadosNoDia.length > 0 && (
                <p style={{ fontSize: '12px', color: '#999', margin: '4px 0' }}>
                  {t('agendamentos.jaOcupadoNesseDia', { lista: intervalosOcupadosNoDia.map(o => o.hora).join(', ') })}
                </p>
              )}
            </>
          ) : (
            <div style={{ margin: '8px 0' }}>
              {slotsDisponiveisNovoAgendamento.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#f87171' }}>{t('agendamentos.nenhumHorarioLivre')}</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {slotsDisponiveisNovoAgendamento.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setNovoAgendamento(prev => ({ ...prev, horario: h }))}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '999px',
                        border: '1px solid #4ade80',
                        background: novoAgendamento.horario === h ? '#4ade80' : 'transparent',
                        color: novoAgendamento.horario === h ? '#1a1a1a' : '#4ade80',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary">{t('agendamentos.agendar')}</button>
        </form>
      </section>

      {/* CALENDÁRIO VISUAL */}
      <section className="list-section">
        <h3>{t('agendamentos.calendario', { nome: profissionaisLista.find(p => p.uuid === abaProfissional)?.nome })}</h3>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1))}
            style={{ padding: '8px 16px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {t('agendamentos.anterior')}
          </button>
          <span style={{ color: '#d4af37', fontWeight: 'bold', minWidth: '150px', textAlign: 'center' }}>
            {mesAtual.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1))}
            style={{ padding: '8px 16px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {t('agendamentos.proximo')}
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
          {diasAbrev.map(dia => (
            <div key={dia} style={{ textAlign: 'center', color: '#d4af37', fontWeight: 'bold', padding: '10px' }}>
              {dia}
            </div>
          ))}
          {gerarCalendario()}
        </div>
      </section>

      {/* TABELA COM DIA DA SEMANA */}
      <section className="list-section">
        <h3>{t('agendamentos.listaDetalhada')}</h3>

        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d4af37', background: '#2d2d2d', color: '#e8e8e8' }}
          >
            <option value="todos">{t('statusAg.todos')}</option>
            {statusOpcoes.map(s => (
              <option key={s} value={s}>{t(`statusAg.${s}`)}</option>
            ))}
          </select>

          <p style={{ color: '#d4af37', fontWeight: 'bold' }}>
            {t('agendamentos.totalAgendamentos', { n: agendamentosFiltrados.length })}
          </p>
        </div>

        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
        ) : agendamentosFiltrados.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('agendamentos.nenhumEncontrado')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('comum.cliente')}</th>
                  <th>{t('comum.email')}</th>
                  <th>{t('comum.data')}</th>
                  <th>{t('agendamentos.diaSemana')}</th>
                  <th>{t('comum.hora')}</th>
                  <th>{t('comum.servico')}</th>
                  <th>{t('comum.status')}</th>
                  <th>{t('agendamentos.preco')}</th>
                  <th>{t('comum.acoes')}</th>
                </tr>
              </thead>
              <tbody>
                {agendamentosFiltrados.map((agendamento) => (
                  <tr key={agendamento.id}>
                    <td style={{ fontWeight: 'bold' }}>
                      {agendamento.cliente}
                      {agendamento.encaixe && <span title={t('agendamentos.criadoComoEncaixe')} style={{ color: '#f97316', marginLeft: '6px', fontSize: '11px' }}>{t('agendamentos.encaixeTag')}</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: '#999' }}>{agendamento.email}</td>
                    <td>{agendamento.data}</td>
                    <td style={{ color: '#d4af37', fontWeight: 'bold' }}>{diasNomes[agendamento.diaSemanaIndex]}</td>
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
                        {statusOpcoes.map(s => (
                          <option key={s} value={s}>{t(`statusAg.${s}`)}</option>
                        ))}
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
