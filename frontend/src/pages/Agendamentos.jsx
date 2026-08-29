import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getSlotsLivresNoDia, paraMinutos, paraHHMM, getHorarioDoDia, buscarHorarioEstendido, HORARIO_ESTENDIDO_PADRAO } from '../config/horarios';
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
  const [diaModal, setDiaModal] = useState(null); // data (YYYY-MM-DD) do dia clicado no calendário, ou null se fechado
  const [bloqueios, setBloqueios] = useState([]);
  const [agendamentoEditando, setAgendamentoEditando] = useState(null); // agendamento sendo editado (data/hora), ou null se fechado
  const [edicaoForm, setEdicaoForm] = useState({ data: '', horario: '', encaixe: false });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // ---- Tela principal reformulada: dia selecionado + sub-abas ----
  // "dia" é a visão padrão ao abrir (grade horária de um único dia, sem
  // rolagem longa); "mes"/"lista"/"bloqueios" são as telas antigas,
  // preservadas do jeito que já funcionavam, só que atrás de sub-abas.
  const hojeISO = new Date().toISOString().split('T')[0];
  const [diaSelecionado, setDiaSelecionado] = useState(hojeISO);
  const [semanaAncora, setSemanaAncora] = useState(() => new Date());
  const [subView, setSubView] = useState('dia');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);

  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    data: '',
    horario: '',
    servico: '',
    profissional: ''
  });

  const [novoBloqueio, setNovoBloqueio] = useState({
    profissional: '',
    data: '',
    dataFim: '',
    diaInteiro: false,
    horaInicio: '',
    horaFim: '',
    motivo: ''
  });

  // Sentinela usado para representar "dia inteiro" — cobre de sobra o
  // horário de funcionamento do salão (ver getSlotsLivresNoDia), então
  // nenhum slot sobra livre naquele dia, sem precisar saber o horário exato.
  const HORA_INICIO_DIA_INTEIRO = '00:00';
  const HORA_FIM_DIA_INTEIRO = '23:59';
  const ehBloqueioDiaInteiro = (b) => b.horaInicio === HORA_INICIO_DIA_INTEIRO && b.horaFim === HORA_FIM_DIA_INTEIRO;
  const formatarHorarioBloqueio = (b) => ehBloqueioDiaInteiro(b) ? t('agendamentos.diaTodo') : `${b.horaInicio}–${b.horaFim}`;

  // Gera a lista de datas (YYYY-MM-DD) entre dataInicio e dataFim, inclusive.
  // IMPORTANTE: usa os getters locais (getFullYear/getMonth/getDate), não
  // toISOString() — toISOString() converte pra UTC, e no fuso do Japão
  // (UTC+9) meia-noite local vira 15h do dia anterior em UTC, fazendo o
  // bloqueio salvar sempre um dia antes do escolhido.
  const gerarIntervaloDatas = (dataInicioStr, dataFimStr) => {
    const datas = [];
    const cursor = new Date(`${dataInicioStr}T00:00:00`);
    const fim = new Date(`${dataFimStr || dataInicioStr}T00:00:00`);
    while (cursor <= fim) {
      const ano = cursor.getFullYear();
      const mes = String(cursor.getMonth() + 1).padStart(2, '0');
      const dia = String(cursor.getDate()).padStart(2, '0');
      datas.push(`${ano}-${mes}-${dia}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return datas;
  };

  // Gera os 7 dias (domingo a sábado) da semana que contém `ancora`, para o
  // carrossel de datas do topo da Agenda.
  const obterDiasDaSemana = (ancora) => {
    const inicioSemana = new Date(ancora);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicioSemana);
      d.setDate(inicioSemana.getDate() + i);
      dias.push(d);
    }
    return dias;
  };

  const mudarSemana = (deltaSemanas) => {
    const novaAncora = new Date(semanaAncora);
    novaAncora.setDate(novaAncora.getDate() + deltaSemanas * 7);
    setSemanaAncora(novaAncora);
  };

  // Iniciais pro avatar circular do profissional (ex: "Marco Kaizen" -> "MK").
  const obterIniciais = (nome) => nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0].toUpperCase())
    .join('');

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
    buscarBloqueios();
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

  const intervalosOcupadosNoDia = (!profissionalNovoObj || !novoAgendamento.data) ? [] : [
    ...agendamentos
      .filter(a => a.profissionalId === profissionalNovoObj.uuid && a.data === novoAgendamento.data && a.status !== 'CANCELADO')
      .map(a => {
        const inicioMin = paraMinutos(a.hora);
        const duracao = servicosLista.find(s => s.nome === a.servico)?.duracaoMinutos || 60;
        return { inicioMin, fimMin: inicioMin + duracao, cliente: a.cliente, hora: a.hora, servico: a.servico };
      }),
    ...bloqueios
      .filter(b => b.profissionalId === profissionalNovoObj.uuid && b.data === novoAgendamento.data)
      .map(b => ({
        inicioMin: paraMinutos(b.horaInicio),
        fimMin: paraMinutos(b.horaFim),
        cliente: b.motivo ? `${t('agendamentos.bloqueioTag')} — ${b.motivo}` : t('agendamentos.bloqueioTag'),
        hora: b.horaInicio,
        servico: t('agendamentos.bloqueioTag')
      }))
  ];

  const slotsDisponiveisNovoAgendamento = (!profissionalNovoObj || !servicoNovoObj || !novoAgendamento.data) ? [] : (() => {
    const dataObj = new Date(`${novoAgendamento.data}T00:00:00`);
    return getSlotsLivresNoDia(dataObj, duracaoNovoAgendamento, intervalosOcupadosNoDia, horarioEstendido);
  })();

  const conflitosEncaixe = (!modoEncaixe || !novoAgendamento.horario) ? [] : (() => {
    const inicioMin = paraMinutos(novoAgendamento.horario);
    const fimMin = inicioMin + duracaoNovoAgendamento;
    return intervalosOcupadosNoDia.filter(o => inicioMin < o.fimMin && fimMin > o.inicioMin);
  })();

  // ---- Cálculo de horários disponíveis para o modal "Editar Agendamento" ----
  // Mesma lógica do "Novo Agendamento" acima, mas excluindo o próprio
  // agendamento em edição da lista de ocupados (senão ele "colidiria" consigo
  // mesmo e nenhum horário apareceria livre, nem o horário atual dele).
  const duracaoEdicao = agendamentoEditando
    ? (servicosLista.find(s => s.nome === agendamentoEditando.servico)?.duracaoMinutos || 60)
    : 60;

  const intervalosOcupadosEdicao = (!agendamentoEditando || !edicaoForm.data) ? [] : [
    ...agendamentos
      .filter(a => a.id !== agendamentoEditando.id && a.profissionalId === agendamentoEditando.profissionalId && a.data === edicaoForm.data && a.status !== 'CANCELADO')
      .map(a => {
        const inicioMin = paraMinutos(a.hora);
        const duracao = servicosLista.find(s => s.nome === a.servico)?.duracaoMinutos || 60;
        return { inicioMin, fimMin: inicioMin + duracao, cliente: a.cliente, hora: a.hora, servico: a.servico };
      }),
    ...bloqueios
      .filter(b => b.profissionalId === agendamentoEditando.profissionalId && b.data === edicaoForm.data)
      .map(b => ({
        inicioMin: paraMinutos(b.horaInicio),
        fimMin: paraMinutos(b.horaFim),
        cliente: b.motivo ? `${t('agendamentos.bloqueioTag')} — ${b.motivo}` : t('agendamentos.bloqueioTag'),
        hora: b.horaInicio,
        servico: t('agendamentos.bloqueioTag')
      }))
  ];

  const slotsDisponiveisEdicao = (!agendamentoEditando || !edicaoForm.data) ? [] : (() => {
    const dataObj = new Date(`${edicaoForm.data}T00:00:00`);
    return getSlotsLivresNoDia(dataObj, duracaoEdicao, intervalosOcupadosEdicao, horarioEstendido);
  })();

  const conflitosEncaixeEdicao = (!edicaoForm.encaixe || !edicaoForm.horario) ? [] : (() => {
    const inicioMin = paraMinutos(edicaoForm.horario);
    const fimMin = inicioMin + duracaoEdicao;
    return intervalosOcupadosEdicao.filter(o => inicioMin < o.fimMin && fimMin > o.inicioMin);
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

  const buscarBloqueios = async () => {
    try {
      const { data, error } = await supabase
        .from('bloqueios_horario')
        .select('id, profissional_id, data, horario_inicio, horario_fim, motivo')
        .order('data', { ascending: true });

      if (error) throw error;

      const bloqueiosFormatados = data.map(b => ({
        id: b.id,
        profissionalId: b.profissional_id,
        data: b.data,
        horaInicio: b.horario_inicio?.substring(0, 5) || '',
        horaFim: b.horario_fim?.substring(0, 5) || '',
        motivo: b.motivo || ''
      }));

      setBloqueios(bloqueiosFormatados);
    } catch (error) {
      console.error('Erro ao buscar bloqueios:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoAgendamento({ ...novoAgendamento, [name]: value });
  };

  const handleBloqueioInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNovoBloqueio({ ...novoBloqueio, [name]: type === 'checkbox' ? checked : value });
  };

  const handleCriarBloqueio = async (e) => {
    e.preventDefault();

    if (!novoBloqueio.profissional || !novoBloqueio.data) {
      alert(t('agendamentos.preencherObrigatorios'));
      return;
    }

    if (!novoBloqueio.diaInteiro && (!novoBloqueio.horaInicio || !novoBloqueio.horaFim)) {
      alert(t('agendamentos.preencherObrigatorios'));
      return;
    }

    if (novoBloqueio.dataFim && novoBloqueio.dataFim < novoBloqueio.data) {
      alert(t('agendamentos.dataFimAntesInicio'));
      return;
    }

    if (!novoBloqueio.diaInteiro && paraMinutos(novoBloqueio.horaFim) <= paraMinutos(novoBloqueio.horaInicio)) {
      alert(t('agendamentos.horarioFimAntesInicio'));
      return;
    }

    try {
      const profissionalSelecionado = profissionaisLista.find(p => p.nome === novoBloqueio.profissional);
      const horaInicio = novoBloqueio.diaInteiro ? HORA_INICIO_DIA_INTEIRO : novoBloqueio.horaInicio;
      const horaFim = novoBloqueio.diaInteiro ? HORA_FIM_DIA_INTEIRO : novoBloqueio.horaFim;
      const datas = gerarIntervaloDatas(novoBloqueio.data, novoBloqueio.dataFim);

      const linhas = datas.map(data => ({
        profissional_id: profissionalSelecionado?.uuid,
        data,
        horario_inicio: horaInicio,
        horario_fim: horaFim,
        motivo: novoBloqueio.motivo || null
      }));

      const { error } = await supabase
        .from('bloqueios_horario')
        .insert(linhas);

      if (error) throw error;

      alert(datas.length > 1 ? t('agendamentos.bloqueioCriadoPeriodo', { n: datas.length }) : t('agendamentos.bloqueioCriado'));
      setNovoBloqueio({ profissional: '', data: '', dataFim: '', diaInteiro: false, horaInicio: '', horaFim: '', motivo: '' });
      buscarBloqueios();
    } catch (error) {
      alert(t('agendamentos.erroCriarBloqueio', { msg: error.message }));
    }
  };

  const handleDeletarBloqueio = async (bloqueioId) => {
    if (!window.confirm(t('agendamentos.confirmarDeletarBloqueio'))) return;

    try {
      const { error } = await supabase
        .from('bloqueios_horario')
        .delete()
        .eq('id', bloqueioId);

      if (error) throw error;

      alert(t('agendamentos.bloqueioDeletado'));
      buscarBloqueios();
    } catch (error) {
      alert(t('agendamentos.erroDeletarBloqueio', { msg: error.message }));
    }
  };

  const handleAgendar = async (e) => {
    e.preventDefault();

    if (!novoAgendamento.cliente || !novoAgendamento.email || !novoAgendamento.telefone || !novoAgendamento.data || !novoAgendamento.horario || !novoAgendamento.servico || !novoAgendamento.profissional) {
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
        // Cliente já existia — se ele não tinha telefone/data de nascimento
        // salvos ainda, aproveita os dados digitados agora pra completar o
        // cadastro (sem sobrescrever o que já tinha).
        await supabase
          .from('clientes')
          .update({
            telefone: novoAgendamento.telefone || undefined,
            data_nascimento: novoAgendamento.dataNascimento || undefined
          })
          .eq('id', clienteId)
          .or('telefone.is.null,data_nascimento.is.null');
      } else {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes')
          .insert([{
            nome: novoAgendamento.cliente,
            email: novoAgendamento.email,
            telefone: novoAgendamento.telefone || null,
            data_nascimento: novoAgendamento.dataNascimento || null
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
      setNovoAgendamento({ cliente: '', email: '', telefone: '', dataNascimento: '', data: '', horario: '', servico: '', profissional: '' });
      setModoEncaixe(false);
      setModalNovoAberto(false);
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

  const abrirEdicao = (agendamento) => {
    setAgendamentoEditando(agendamento);
    setEdicaoForm({ data: agendamento.data, horario: agendamento.hora, encaixe: false });
  };

  const fecharEdicao = () => {
    setAgendamentoEditando(null);
    setEdicaoForm({ data: '', horario: '', encaixe: false });
  };

  const handleEdicaoInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEdicaoForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Altera a data/hora do agendamento. O e-mail para o cliente e para o
  // profissional é disparado automaticamente pelo trigger do banco (ver
  // migração trg_notificar_reagendamento) assim que o UPDATE abaixo mudar
  // o campo data_hora — não precisa chamar nada daqui.
  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    if (!agendamentoEditando) return;

    if (!edicaoForm.data || !edicaoForm.horario) {
      alert(t('agendamentos.preencherObrigatorios'));
      return;
    }

    const semMudanca = edicaoForm.data === agendamentoEditando.data && edicaoForm.horario === agendamentoEditando.hora;
    if (semMudanca) {
      fecharEdicao();
      return;
    }

    if (!edicaoForm.encaixe && !slotsDisponiveisEdicao.includes(edicaoForm.horario)) {
      alert(t('agendamentos.horarioIndisponivel'));
      return;
    }

    if (edicaoForm.encaixe && conflitosEncaixeEdicao.length > 0) {
      const resumoConflito = conflitosEncaixeEdicao
        .map(c => `${c.hora} - ${c.cliente} (${c.servico})`)
        .join('\n');
      const confirmou = window.confirm(
        t('agendamentos.confirmarEncaixe', { horario: edicaoForm.horario, prof: agendamentoEditando.profissional, resumo: resumoConflito })
      );
      if (!confirmou) return;
    }

    setSalvandoEdicao(true);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ data_hora: `${edicaoForm.data}T${edicaoForm.horario}:00` })
        .eq('id', agendamentoEditando.id);

      if (error) throw error;

      alert(t('agendamentos.alteracaoSalva'));
      fecharEdicao();
      buscarAgendamentos();
    } catch (error) {
      alert(t('agendamentos.erroSalvarAlteracao', { msg: error.message }));
    } finally {
      setSalvandoEdicao(false);
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

  // Bloqueios (folgas/consultas etc.) da aba ativa
  const bloqueiosFiltrados = bloqueios.filter(b => b.profissionalId === abaProfissional);

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

    const bloqueadosDeste = bloqueiosFiltrados.filter(b => {
      const dataBloqueio = new Date(b.data);
      return dataBloqueio.getFullYear() === ano && dataBloqueio.getMonth() === mes;
    });

    return dias.map((dia, idx) => {
      if (!dia) return <div key={`vazio-${idx}`} style={{ padding: '10px' }}></div>;

      const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const agendadosNoDia = agendadosDeste.filter(a => a.data === dataStr);
      const bloqueiosNoDia = bloqueadosDeste.filter(b => b.data === dataStr);

      const temConteudo = agendadosNoDia.length > 0 || bloqueiosNoDia.length > 0;

      return (
        <div
          key={dia}
          onClick={temConteudo ? () => setDiaModal(dataStr) : undefined}
          title={temConteudo ? t('agendamentos.agendamentosDoDia', { data: dia }) : undefined}
          style={{
            border: '1px solid #404040',
            padding: '10px',
            borderRadius: '6px',
            background: agendadosNoDia.length > 0 ? '#2d3d2d' : (bloqueiosNoDia.length > 0 ? '#3d2d2d' : '#2d2d2d'),
            minHeight: '80px',
            cursor: temConteudo ? 'pointer' : 'default',
            transition: 'border-color 0.15s, background 0.15s'
          }}
          onMouseEnter={(e) => { if (temConteudo) e.currentTarget.style.borderColor = '#d4af37'; }}
          onMouseLeave={(e) => { if (temConteudo) e.currentTarget.style.borderColor = '#404040'; }}
        >
          <strong style={{ color: '#d4af37' }}>{dia}</strong>
          {bloqueiosNoDia.map(b => (
            <div key={`b-${b.id}`} style={{ fontSize: '11px', color: '#f87171', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #404040' }}>
              🚫 {formatarHorarioBloqueio(b)}
              {b.motivo && <div style={{ color: '#999', fontSize: '10px' }}>{b.motivo}</div>}
            </div>
          ))}
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

  // ---- Visão "Dia" (padrão ao abrir a tela) ----
  const dataDiaSelecionadoObj = new Date(`${diaSelecionado}T00:00:00`);
  const horarioDoDiaSelecionado = getHorarioDoDia(dataDiaSelecionadoObj, horarioEstendido);
  const agendamentosDoDiaSelecionado = agendamentosFiltrados
    .filter(a => a.data === diaSelecionado)
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const bloqueiosDoDiaSelecionado = bloqueiosFiltrados
    .filter(b => b.data === diaSelecionado)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  // ---- Timeline vertical de 15 em 15 minutos ----
  // SLOT_ALTURA_PX = quantos pixels representam 15 minutos na tela. Todo o
  // resto (posição e altura dos blocos, linhas de grade, marcas de hora)
  // deriva desse único número, pra manter tudo proporcional e "encaixado"
  // na grade de 15 min (nunca solto/flutuando entre marcas).
  const SLOT_MINUTOS = 15;
  const SLOT_ALTURA_PX = 22;

  const arredondarParaBaixo15 = (min) => Math.floor(min / SLOT_MINUTOS) * SLOT_MINUTOS;
  const arredondarParaCima15 = (min) => Math.ceil(min / SLOT_MINUTOS) * SLOT_MINUTOS;

  const aberturaMinDia = horarioDoDiaSelecionado.aberto ? paraMinutos(horarioDoDiaSelecionado.abertura) : 0;
  const fechamentoMinDia = horarioDoDiaSelecionado.aberto ? paraMinutos(horarioDoDiaSelecionado.fechamento) : 0;
  const totalSlotsDia = horarioDoDiaSelecionado.aberto ? Math.round((fechamentoMinDia - aberturaMinDia) / SLOT_MINUTOS) : 0;
  const alturaTimelinePx = totalSlotsDia * SLOT_ALTURA_PX;

  const marcasDeHoraDia = [];
  if (horarioDoDiaSelecionado.aberto) {
    for (let m = aberturaMinDia; m <= fechamentoMinDia; m += 60) {
      marcasDeHoraDia.push(m);
    }
  }

  // Atribui uma "coluna" pra cada agendamento/bloqueio que se sobrepõe no
  // tempo (ex: um encaixe colidindo com outro atendimento), pra desenhar
  // lado a lado em vez de um por cima do outro.
  const atribuirColunasTimeline = (itens) => {
    const ordenados = [...itens].sort((x, y) => x.inicioMin - y.inicioMin || x.fimMin - y.fimMin);
    const fimOcupadoPorColuna = [];
    const comColuna = ordenados.map(item => {
      let coluna = fimOcupadoPorColuna.findIndex(fim => fim <= item.inicioMin);
      if (coluna === -1) {
        coluna = fimOcupadoPorColuna.length;
        fimOcupadoPorColuna.push(item.fimMin);
      } else {
        fimOcupadoPorColuna[coluna] = item.fimMin;
      }
      return { ...item, coluna };
    });
    const totalColunas = Math.max(1, fimOcupadoPorColuna.length);
    return comColuna.map(item => ({ ...item, totalColunas }));
  };

  const itensTimeline = !horarioDoDiaSelecionado.aberto ? [] : atribuirColunasTimeline([
    ...agendamentosDoDiaSelecionado.map(a => {
      const duracaoReal = servicosLista.find(s => s.nome === a.servico)?.duracaoMinutos || 60;
      const inicioReal = paraMinutos(a.hora);
      const fimReal = inicioReal + duracaoReal;
      const inicioMin = Math.max(aberturaMinDia, arredondarParaBaixo15(inicioReal));
      const fimMin = Math.min(fechamentoMinDia, Math.max(inicioMin + SLOT_MINUTOS, arredondarParaCima15(fimReal)));
      return { tipo: 'agendamento', id: `ag-${a.id}`, inicioMin, fimMin, dado: a };
    }),
    ...bloqueiosDoDiaSelecionado.map(b => {
      const inicioReal = Math.max(aberturaMinDia, paraMinutos(b.horaInicio));
      const fimReal = Math.min(fechamentoMinDia, paraMinutos(b.horaFim));
      const inicioMin = arredondarParaBaixo15(inicioReal);
      const fimMin = Math.min(fechamentoMinDia, Math.max(inicioMin + SLOT_MINUTOS, arredondarParaCima15(fimReal)));
      return { tipo: 'bloqueio', id: `bl-${b.id}`, inicioMin, fimMin, dado: b };
    }),
  ].filter(item => item.fimMin > item.inicioMin && item.inicioMin < fechamentoMinDia));

  const diasDaSemanaAtual = obterDiasDaSemana(semanaAncora);

  return (
    <div className="page-container">
      <h2>{t('agendamentos.titulo')}</h2>

      {/* FILTRO POR PROFISSIONAL — avatares circulares */}
      <div className="agenda-avatares">
        {profissionaisLista.map(prof => (
          <button
            key={prof.uuid}
            type="button"
            className={`agenda-avatar-btn${abaProfissional === prof.uuid ? ' ativo' : ''}`}
            onClick={() => setAbaProfissional(prof.uuid)}
          >
            <span className="agenda-avatar-circulo">{obterIniciais(prof.nome)}</span>
            <span className="agenda-avatar-nome">{prof.nome.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* SELETOR DE DATA — carrossel semanal */}
      <div className="agenda-dias-semana">
        <button type="button" className="agenda-seta-semana" onClick={() => mudarSemana(-1)} aria-label={t('agendamentos.anterior')}>‹</button>
        {diasDaSemanaAtual.map(d => {
          const dataStr = d.toISOString().split('T')[0];
          return (
            <button
              key={dataStr}
              type="button"
              className={`agenda-dia-btn${diaSelecionado === dataStr ? ' ativo' : ''}${dataStr === hojeISO ? ' hoje' : ''}`}
              onClick={() => { setDiaSelecionado(dataStr); setSubView('dia'); }}
            >
              <span className="agenda-dia-semana-label">{diasAbrev[d.getDay()]}</span>
              <span className="agenda-dia-numero">{d.getDate()}</span>
            </button>
          );
        })}
        <button type="button" className="agenda-seta-semana" onClick={() => mudarSemana(1)} aria-label={t('agendamentos.proximo')}>›</button>
      </div>

      {/* SUB-ABAS: Dia (padrão) | Mês | Lista | Bloqueios */}
      <div className="agenda-subview-tabs">
        <button type="button" className={subView === 'dia' ? 'ativo' : ''} onClick={() => setSubView('dia')}>{t('agendamentos.subDia')}</button>
        <button type="button" className={subView === 'mes' ? 'ativo' : ''} onClick={() => setSubView('mes')}>{t('agendamentos.subMes')}</button>
        <button type="button" className={subView === 'lista' ? 'ativo' : ''} onClick={() => setSubView('lista')}>{t('agendamentos.subLista')}</button>
        <button type="button" className={subView === 'bloqueios' ? 'ativo' : ''} onClick={() => setSubView('bloqueios')}>{t('agendamentos.subBloqueios')}</button>
      </div>

      {/* VISÃO DIA: grade horária do dia selecionado, sem rolagem longa */}
      {subView === 'dia' && (
        <section className="agenda-dia-view">
          {!horarioDoDiaSelecionado.aberto ? (
            <p className="agenda-fechado-aviso">{t('agendamentos.salaoFechadoNesseDia')}</p>
          ) : (
            <>
              {agendamentosDoDiaSelecionado.length === 0 && bloqueiosDoDiaSelecionado.length === 0 && (
                <p className="agenda-dia-vazio">{t('agendamentos.nenhumAgendamentoNoDia')}</p>
              )}

              <div className="agenda-timeline-wrapper" style={{ height: `${alturaTimelinePx}px` }}>
                {/* Marcas de hora (coluna fixa à esquerda) */}
                <div className="agenda-timeline-marcas">
                  {marcasDeHoraDia.map(m => (
                    <div
                      key={`marca-${m}`}
                      className="agenda-timeline-marca-hora"
                      style={{ top: `${((m - aberturaMinDia) / SLOT_MINUTOS) * SLOT_ALTURA_PX}px` }}
                    >
                      {paraHHMM(m)}
                    </div>
                  ))}
                </div>

                {/* Grade com linhas a cada 15min (finas) e a cada hora (mais fortes) */}
                <div
                  className="agenda-timeline-grade"
                  style={{
                    backgroundImage:
                      `repeating-linear-gradient(to bottom, rgba(212,175,55,0.35) 0, rgba(212,175,55,0.35) 1px, transparent 1px, transparent ${SLOT_ALTURA_PX * 4}px),` +
                      `repeating-linear-gradient(to bottom, var(--border-color) 0, var(--border-color) 1px, transparent 1px, transparent ${SLOT_ALTURA_PX}px)`
                  }}
                >
                  {itensTimeline.map(item => {
                    const top = ((item.inicioMin - aberturaMinDia) / SLOT_MINUTOS) * SLOT_ALTURA_PX;
                    const altura = ((item.fimMin - item.inicioMin) / SLOT_MINUTOS) * SLOT_ALTURA_PX;
                    const larguraPercentual = 100 / item.totalColunas;
                    const estiloPosicao = {
                      top: `${top}px`,
                      height: `${altura - 2}px`,
                      left: `calc(${item.coluna * larguraPercentual}% + 2px)`,
                      width: `calc(${larguraPercentual}% - 4px)`
                    };

                    if (item.tipo === 'bloqueio') {
                      const b = item.dado;
                      return (
                        <div key={item.id} className="agenda-timeline-evento agenda-timeline-bloqueio" style={estiloPosicao}>
                          <span>
                            🚫 {formatarHorarioBloqueio(b)}
                            {b.motivo && altura >= 40 && <span className="agenda-timeline-bloqueio-motivo"> — {b.motivo}</span>}
                          </span>
                          {altura >= 28 && (
                            <button className="btn-delete agenda-timeline-del" onClick={() => handleDeletarBloqueio(b.id)}>🗑️</button>
                          )}
                        </div>
                      );
                    }

                    const a = item.dado;
                    const compacto = altura < 56;
                    return (
                      <div
                        key={item.id}
                        className="agenda-timeline-evento agenda-card"
                        style={{ ...estiloPosicao, borderLeftColor: getCorStatus(a.status) }}
                      >
                        <div className="agenda-card-topo">
                          <strong onClick={() => abrirEdicao(a)} title={t('agendamentos.editarTooltip')} className="agenda-card-cliente">
                            {a.hora} · {a.cliente} ✏️
                          </strong>
                          {!compacto && <button className="btn-delete" onClick={() => handleDeletar(a.id)}>🗑️</button>}
                        </div>
                        {!compacto && (
                          <>
                            <div className="agenda-card-servico">
                              {a.servico}
                              {a.encaixe && <span className="agenda-card-encaixe"> {t('agendamentos.encaixeTag')}</span>}
                            </div>
                            <div className="agenda-card-rodape">
                              <select
                                value={a.status}
                                onChange={(e) => handleAlterarStatus(a.id, e.target.value)}
                                style={{ background: getCorStatus(a.status), color: '#1a1a1a', border: 'none', borderRadius: '4px', padding: '4px 8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                              >
                                {statusOpcoes.map(s => <option key={s} value={s}>{t(`statusAg.${s}`)}</option>)}
                              </select>
                              <span className="agenda-card-preco">{a.preco ? `¥${a.preco.toLocaleString('ja-JP')}` : '-'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* BOTÃO FLUTUANTE — abre o modal de Novo Agendamento */}
      <button
        type="button"
        className="agenda-fab"
        onClick={() => setModalNovoAberto(true)}
        aria-label={t('agendamentos.novoBtnFlutuante')}
        title={t('agendamentos.novoBtnFlutuante')}
      >
        +
      </button>

      {/* MODAL: NOVO AGENDAMENTO (mesmo formulário de antes, agora dentro de um modal) */}
      {modalNovoAberto && (
        <div className="agenda-modal-overlay" onClick={() => setModalNovoAberto(false)}>
          <div className="agenda-modal-conteudo" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{t('agendamentos.novoAgendamento')}</h3>
              <button
                type="button"
                onClick={() => setModalNovoAberto(false)}
                style={{ background: 'transparent', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ {t('comum.cancelar')}
              </button>
            </div>
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
                required
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('agendamentos.dataNascimento')}
                <input
                  type="date"
                  name="dataNascimento"
                  value={novoAgendamento.dataNascimento}
                  onChange={handleInputChange}
                />
              </label>
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
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('agendamentos.escolhaData')}
                <input
                  type="date"
                  name="data"
                  value={novoAgendamento.data}
                  onChange={(e) => { handleInputChange(e); setNovoAgendamento(prev => ({ ...prev, data: e.target.value, horario: '' })); }}
                  required
                />
              </label>

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
          </div>
        </div>
      )}

      {/* SUB-ABA BLOQUEIOS: bloqueio de horário (folga, consulta médica etc.) */}
      {subView === 'bloqueios' && (
      <section className="form-section">
        <h3>{t('agendamentos.bloquearHorario')}</h3>
        <p style={{ fontSize: '13px', color: '#999', marginTop: '-6px', marginBottom: '10px' }}>
          {t('agendamentos.bloquearHorarioDescricao')}
        </p>
        <form onSubmit={handleCriarBloqueio}>
          <select
            name="profissional"
            value={novoBloqueio.profissional}
            onChange={handleBloqueioInputChange}
            required
          >
            <option value="">{t('comum.selecioneProfissional')}</option>
            {profissionaisLista.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
              {t('agendamentos.dataInicioLabel')}
              <input
                type="date"
                name="data"
                value={novoBloqueio.data}
                onChange={handleBloqueioInputChange}
                required
              />
            </label>
            <label style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
              {t('agendamentos.dataFimOpcionalLabel')}
              <input
                type="date"
                name="dataFim"
                value={novoBloqueio.dataFim}
                min={novoBloqueio.data || undefined}
                onChange={handleBloqueioInputChange}
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="diaInteiro"
              checked={novoBloqueio.diaInteiro}
              onChange={handleBloqueioInputChange}
            />
            <strong>{t('agendamentos.diaInteiroLabel')}</strong>
          </label>

          {!novoBloqueio.diaInteiro && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="time"
                name="horaInicio"
                value={novoBloqueio.horaInicio}
                onChange={handleBloqueioInputChange}
                required={!novoBloqueio.diaInteiro}
                style={{ flex: 1, minWidth: '120px' }}
              />
              <input
                type="time"
                name="horaFim"
                value={novoBloqueio.horaFim}
                onChange={handleBloqueioInputChange}
                required={!novoBloqueio.diaInteiro}
                style={{ flex: 1, minWidth: '120px' }}
              />
            </div>
          )}

          <input
            type="text"
            name="motivo"
            placeholder={t('agendamentos.motivoOpcional')}
            value={novoBloqueio.motivo}
            onChange={handleBloqueioInputChange}
          />
          <button type="submit" className="btn-primary">{t('agendamentos.criarBloqueio')}</button>
        </form>

        {bloqueiosFiltrados.filter(b => b.data >= new Date().toISOString().split('T')[0]).length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <p style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
              {t('agendamentos.bloqueiosAtivos')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bloqueiosFiltrados
                .filter(b => b.data >= new Date().toISOString().split('T')[0])
                .sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio))
                .map(b => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '13px'
                    }}
                  >
                    <span style={{ color: '#e8e8e8' }}>
                      🚫 {b.data} · {formatarHorarioBloqueio(b)}
                      {b.motivo && <span style={{ color: '#999' }}> — {b.motivo}</span>}
                    </span>
                    <button className="btn-delete" onClick={() => handleDeletarBloqueio(b.id)}>🗑️</button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>
      )}

      {/* SUB-ABA MÊS: calendário visual do mês (profissional já filtrado pelos avatares do topo) */}
      {subView === 'mes' && (
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
      )}

      {/* SUB-ABA LISTA: tabela detalhada com dia da semana */}
      {subView === 'lista' && (
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
                      <span
                        onClick={() => abrirEdicao(agendamento)}
                        title={t('agendamentos.editarTooltip')}
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
                      >
                        {agendamento.cliente} ✏️
                      </span>
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
      )}

      {/* MODAL DE AGENDAMENTOS DO DIA */}
      {diaModal && (() => {
        const agendamentosDoDia = agendamentosFiltrados
          .filter(a => a.data === diaModal)
          .sort((a, b) => a.hora.localeCompare(b.hora));
        const bloqueiosDoDia = bloqueiosFiltrados
          .filter(b => b.data === diaModal)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        const dataFormatada = new Date(`${diaModal}T00:00:00`)
          .toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

        return (
          <div
            onClick={() => setDiaModal(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#2d2d2d',
                border: '1px solid #d4af37',
                borderRadius: '10px',
                padding: '24px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ color: '#d4af37', margin: 0, textTransform: 'capitalize' }}>
                  {t('agendamentos.agendamentosDoDia', { data: dataFormatada })}
                </h3>
                <button
                  onClick={() => setDiaModal(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #d4af37',
                    color: '#d4af37',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✕ {t('agendamentos.fecharModal')}
                </button>
              </div>

              {bloqueiosDoDia.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: agendamentosDoDia.length > 0 ? '16px' : 0 }}>
                  {bloqueiosDoDia.map(b => (
                    <div
                      key={`b-${b.id}`}
                      style={{
                        border: '1px solid #f87171',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        background: '#1a1a1a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <span style={{ color: '#f87171', fontWeight: 'bold' }}>
                        🚫 {formatarHorarioBloqueio(b)}
                        {b.motivo && <span style={{ color: '#999', fontWeight: 'normal' }}> — {b.motivo}</span>}
                      </span>
                      <button className="btn-delete" onClick={() => handleDeletarBloqueio(b.id)}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              {agendamentosDoDia.length === 0 && bloqueiosDoDia.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center' }}>{t('agendamentos.nenhumAgendamentoNoDia')}</p>
              ) : agendamentosDoDia.length === 0 ? null : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {agendamentosDoDia.map(a => (
                    <div
                      key={a.id}
                      style={{
                        border: '1px solid #404040',
                        borderRadius: '8px',
                        padding: '14px',
                        background: '#1a1a1a'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong style={{ color: '#d4af37', fontSize: '16px' }}>{a.hora}</strong>
                          {' — '}
                          <strong
                            onClick={() => { setDiaModal(null); abrirEdicao(a); }}
                            title={t('agendamentos.editarTooltip')}
                            style={{ color: '#e8e8e8', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}
                          >
                            {a.cliente} ✏️
                          </strong>
                          {a.encaixe && <span style={{ color: '#f97316', fontWeight: 'bold', marginLeft: '6px', fontSize: '11px' }}>{t('agendamentos.encaixeTag')}</span>}
                        </div>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeletar(a.id)}
                        >
                          🗑️
                        </button>
                      </div>

                      <div style={{ color: '#999', fontSize: '13px', marginTop: '6px' }}>{a.servico}</div>

                      {(a.telefone || a.email) && (
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                          {a.telefone && <span>📞 {a.telefone}</span>}
                          {a.telefone && a.email && <span> · </span>}
                          {a.email && <span>✉️ {a.email}</span>}
                        </div>
                      )}

                      <div style={{ marginTop: '10px' }}>
                        <select
                          value={a.status}
                          onChange={(e) => handleAlterarStatus(a.id, e.target.value)}
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            border: 'none',
                            background: getCorStatus(a.status),
                            color: '#1a1a1a',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {statusOpcoes.map(s => (
                            <option key={s} value={s}>{t(`statusAg.${s}`)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* MODAL DE EDIÇÃO DE AGENDAMENTO (data/hora) */}
      {agendamentoEditando && (
        <div
          onClick={fecharEdicao}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d',
              border: '1px solid #d4af37',
              borderRadius: '10px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ color: '#d4af37', margin: 0 }}>{t('agendamentos.editarAgendamento')}</h3>
              <button
                onClick={fecharEdicao}
                style={{
                  background: 'transparent',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✕ {t('comum.cancelar')}
              </button>
            </div>

            <p style={{ color: '#999', fontSize: '13px', marginBottom: '18px' }}>
              {t('agendamentos.editarAgendamentoAviso')}
            </p>

            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#e8e8e8' }}>
              <div><span style={{ color: '#666' }}>{t('comum.cliente')}: </span><strong>{agendamentoEditando.cliente}</strong></div>
              <div><span style={{ color: '#666' }}>{t('comum.servico')}: </span><strong>{agendamentoEditando.servico}</strong></div>
              <div><span style={{ color: '#666' }}>{t('comum.profissional')}: </span><strong>{agendamentoEditando.profissional}</strong></div>
            </div>

            <form onSubmit={handleSalvarEdicao}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#999' }}>
                {t('agendamentos.escolhaData')}
                <input
                  type="date"
                  name="data"
                  value={edicaoForm.data}
                  onChange={(e) => { handleEdicaoInputChange(e); setEdicaoForm(prev => ({ ...prev, data: e.target.value, horario: '' })); }}
                  required
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="encaixe"
                  checked={edicaoForm.encaixe}
                  onChange={(e) => { handleEdicaoInputChange(e); setEdicaoForm(prev => ({ ...prev, horario: '' })); }}
                />
                <strong style={{ color: edicaoForm.encaixe ? '#f97316' : undefined }}>
                  {t('agendamentos.modoEncaixe')} {edicaoForm.encaixe ? t('agendamentos.modoEncaixeAtivado') : ''}
                </strong>
              </label>

              {edicaoForm.encaixe ? (
                <>
                  <input
                    type="time"
                    name="horario"
                    value={edicaoForm.horario}
                    onChange={handleEdicaoInputChange}
                    required
                  />
                  {edicaoForm.horario && conflitosEncaixeEdicao.length > 0 && (
                    <div style={{ background: 'rgba(249, 115, 22, 0.12)', border: '1px solid #f97316', borderRadius: '6px', padding: '10px', margin: '8px 0', fontSize: '13px' }}>
                      <strong style={{ color: '#f97316' }}>{t('agendamentos.conflito')} </strong>
                      {conflitosEncaixeEdicao.map(c => `${c.hora} - ${c.cliente} (${c.servico})`).join('; ')}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ margin: '8px 0' }}>
                  {slotsDisponiveisEdicao.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#f87171' }}>{t('agendamentos.nenhumHorarioLivre')}</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {slotsDisponiveisEdicao.map(h => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setEdicaoForm(prev => ({ ...prev, horario: h }))}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '999px',
                            border: '1px solid #4ade80',
                            background: edicaoForm.horario === h ? '#4ade80' : 'transparent',
                            color: edicaoForm.horario === h ? '#1a1a1a' : '#4ade80',
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

              <button type="submit" className="btn-primary" disabled={salvandoEdicao}>
                {salvandoEdicao ? t('comum.carregando') : t('agendamentos.salvarAlteracao')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Agendamentos;
