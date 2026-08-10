import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  getSlotsLivresNoDia,
  paraMinutos,
  buscarHorarioEstendido,
  HORARIO_ESTENDIDO_PADRAO,
  HORARIO_SALAO,
  HORARIO_ALMOCO,
  getDiaSemana,
} from '../config/horarios';
import { SERVICOS, getNomeServico, getDescricaoServico } from '../config/servicos';
import { IDIOMAS, IDIOMA_PADRAO, DIAS_ABREV_POR_IDIOMA, DIAS_NOMES_POR_IDIOMA, LOCALE_POR_IDIOMA, traduzir } from '../config/traducoes';

const NOME_ESTABELECIMENTO = 'Kaizen Barber Shop';
const ENDERECO_ESTABELECIMENTO = 'Aichi-Ken Anjo-Shi, Hamatomi-Cho 4-17, San City Oomy 302';
const ENDERECO_JAPONES = '〒446-0022 Aichi, Anjo, Hamatomicho, 4−17 サン シテイ オーミ 302号';
const ORDEM_DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const DIAS_CARROSSEL = 90; // até quantos dias à frente o cliente pode agendar (~3 meses, cobre os períodos de feriados prolongados no Japão)
const OPCOES_LEMBRETE = [15, 20, 30, 60];
const CHAVE_IDIOMA_STORAGE = 'kaizen_idioma';

const formatarPreco = (valor) => `¥${valor.toLocaleString('ja-JP')}`;

const somarMinutos = (horaStr, minutos) => {
  const total = paraMinutos(horaStr) + minutos;
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
};

// Gera um arquivo .ics (padrão universal de calendário) com um lembrete
// (VALARM) embutido, para o cliente importar no calendário do celular.
const gerarConteudoICS = ({ servico, profissional, dataStr, horaInicio, horaFim, lembreteMinutos }) => {
  const dtStart = `${dataStr.replace(/-/g, '')}T${horaInicio.replace(':', '')}00`;
  const dtEnd = `${dataStr.replace(/-/g, '')}T${horaFim.replace(':', '')}00`;
  const agora = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${dataStr}-${horaInicio}-${Math.random().toString(36).slice(2)}@kaizenbarber`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kaizen Barber Shop//Agendamento//PT',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${agora}`,
    `DTSTART;TZID=Asia/Tokyo:${dtStart}`,
    `DTEND;TZID=Asia/Tokyo:${dtEnd}`,
    `SUMMARY:${servico} - ${NOME_ESTABELECIMENTO}`,
    `DESCRIPTION:Profissional: ${profissional}`,
    `LOCATION:${ENDERECO_ESTABELECIMENTO}`,
    'BEGIN:VALARM',
    `TRIGGER:-PT${lembreteMinutos}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete: seu horário na ${NOME_ESTABELECIMENTO} é em ${lembreteMinutos} minutos`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

const baixarArquivoICS = (conteudo, nomeArquivo) => {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const linkGoogleCalendar = ({ servico, profissional, dataStr, horaInicio, horaFim }) => {
  const inicio = `${dataStr.replace(/-/g, '')}T${horaInicio.replace(':', '')}00`;
  const fim = `${dataStr.replace(/-/g, '')}T${horaFim.replace(':', '')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${servico} - ${NOME_ESTABELECIMENTO}`,
    dates: `${inicio}/${fim}`,
    details: `Profissional: ${profissional}`,
    location: ENDERECO_ESTABELECIMENTO,
    ctz: 'Asia/Tokyo',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

function ClientePublico() {
  const [idioma, setIdioma] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_IDIOMA_STORAGE) || IDIOMA_PADRAO;
    } catch {
      return IDIOMA_PADRAO;
    }
  });
  const t = (chave, valores) => traduzir(idioma, chave, valores);
  const localeAtual = LOCALE_POR_IDIOMA[idioma] || LOCALE_POR_IDIOMA[IDIOMA_PADRAO];
  const mudarIdioma = (novoIdioma) => {
    setIdioma(novoIdioma);
    try {
      localStorage.setItem(CHAVE_IDIOMA_STORAGE, novoIdioma);
    } catch {
      // localStorage indisponível (ex: modo privado) — segue sem persistir
    }
  };

  const [abaAtiva, setAbaAtiva] = useState('servicos');
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [horariosOcupados, setHorariosOcupados] = useState({});
  const [horarioEstendido, setHorarioEstendido] = useState(HORARIO_ESTENDIDO_PADRAO);
  const [pontosCliente, setPontosCliente] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [atendimentosRealizados, setAtendimentosRealizados] = useState(0);
  const [pontosJaResgatados, setPontosJaResgatados] = useState(0);
  const [diaHorarioSelecionado, setDiaHorarioSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [observacoesCliente, setObservacoesCliente] = useState('');

  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [profissionalSelecionadoId, setProfissionalSelecionadoId] = useState(null);
  const [descricaoExpandida, setDescricaoExpandida] = useState({});

  const [listaEsperaAberta, setListaEsperaAberta] = useState(false);
  const [listaEsperaDados, setListaEsperaDados] = useState({ nome: '', email: '', telefone: '' });
  const [listaEsperaEnviada, setListaEsperaEnviada] = useState(false);
  const [enviandoListaEspera, setEnviandoListaEspera] = useState(false);

  const [lembreteMinutos, setLembreteMinutos] = useState(30);
  const [presencaConfirmada, setPresencaConfirmada] = useState(false);

  const [emailConsultaPontos, setEmailConsultaPontos] = useState('');
  const [consultaPontosFeita, setConsultaPontosFeita] = useState(false);

  const [dadosAgendamento, setDadosAgendamento] = useState({
    nome: '',
    email: '',
    telefone: '',
    profissional: '',
    hora: '',
    servico: '',
    data: ''
  });

  const [avaliacoes, setAvaliacoes] = useState([
    { id: 1, nome: 'João Silva', estrelas: 5, texto: 'Excelente atendimento! Marco é o melhor barbeiro!', data: '2026-07-25' },
    { id: 2, nome: 'Carlos Santos', estrelas: 5, texto: 'Ambiente perfeito e profissionais incríveis!', data: '2026-07-20' },
  ]);
  const [novaAvaliacao, setNovaAvaliacao] = useState({
    nome: '',
    estrelas: 5,
    texto: ''
  });

  const servicos = SERVICOS;

  const profissionais = [
    {
      id: 1,
      uuid: '11c0c7fb-e020-4c49-ab0a-28a16109b35f',
      nome: 'Marco Kaizen',
      especialidade: 'Especialista em Cortes e Barba',
      especialidadeEn: 'Cuts & Beard Specialist',
      especialidadeJa: 'カット・ひげ専門',
      qualificacoes: ['14 anos de experiência', 'Dono da Kaizen', 'Especialista em Barba'],
      servicos: ['Cortes', 'Barba', 'Coloração'],
      imagem: '/images/marco.jpg',
    },
    {
      id: 2,
      uuid: '66266181-d06b-4f54-bcc9-12dccc100cb4',
      nome: 'Gabriel Little Kaizen',
      especialidade: 'Especialista em Cortes',
      especialidadeEn: 'Haircut Specialist',
      especialidadeJa: 'カット専門',
      qualificacoes: ['Profissional certificado', 'Especialista em Permanente', 'Técnica moderna'],
      servicos: ['Cortes', 'Permanente', 'Lavagem'],
      imagem: '/images/gabriel.jpg',
    },
    {
      id: 3,
      uuid: 'ad232428-9872-46db-82b3-27819ab353ff',
      nome: 'Neia',
      especialidade: 'Especialista em Coloração e Estética',
      especialidadeEn: 'Coloring & Esthetics Specialist',
      especialidadeJa: 'カラーリング・エステ専門',
      qualificacoes: ['Coloração avançada', 'Limpeza facial', 'Massagem facial'],
      servicos: ['Coloração', 'Alisamento', 'Estética'],
      imagem: '/images/neia.jpg',
    },
  ];
  const getEspecialidadeProf = (prof) => {
    if (idioma === 'en') return prof.especialidadeEn || prof.especialidade;
    if (idioma === 'ja') return prof.especialidadeJa || prof.especialidade;
    return prof.especialidade;
  };

  const servicoSelecionadoInfo = servicos.find(s => s.nome === dadosAgendamento.servico);
  const duracaoSelecionada = servicoSelecionadoInfo ? servicoSelecionadoInfo.duracaoMinutos : 60;
  const profissionaisAptos = servicoSelecionadoInfo
    ? profissionais.filter(p => servicoSelecionadoInfo.profissionaisIds.includes(p.id))
    : profissionais;
  const profissionalSelecionado = profissionaisAptos.find(p => p.id === profissionalSelecionadoId) || profissionaisAptos[0] || null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limiteDataMax = new Date(hoje);
  limiteDataMax.setDate(hoje.getDate() + DIAS_CARROSSEL - 1);
  const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const podeVoltarMes = mesCalendario.getFullYear() > inicioMesAtual.getFullYear() ||
    (mesCalendario.getFullYear() === inicioMesAtual.getFullYear() && mesCalendario.getMonth() > inicioMesAtual.getMonth());
  const proximoMesRef = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1);
  const podeAvancarMes = proximoMesRef <= limiteDataMax;

  useEffect(() => {
    buscarHorariosOcupados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    buscarHorarioEstendido().then(setHorarioEstendido);
  }, []);

  useEffect(() => {
    if (dadosAgendamento.email && dadosAgendamento.email.includes('@')) {
      buscarPontosCliente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosAgendamento.email]);

  // Sempre que o serviço muda, garante que o profissional selecionado
  // continua sendo um dos aptos para aquele serviço.
  useEffect(() => {
    if (profissionaisAptos.length > 0 && !profissionaisAptos.some(p => p.id === profissionalSelecionadoId)) {
      setProfissionalSelecionadoId(profissionaisAptos[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosAgendamento.servico]);

  // Mantém o calendário sempre mostrando o mês da data selecionada (ex:
  // quando o serviço muda e a data volta para hoje, ou quando o cliente
  // escolhe uma data em outro mês).
  useEffect(() => {
    const novoMes = new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), 1);
    setMesCalendario(prev => (
      prev.getFullYear() === novoMes.getFullYear() && prev.getMonth() === novoMes.getMonth()
    ) ? prev : novoMes);
  }, [dataSelecionada]);

  const buscarPontosCliente = async (emailParam) => {
    const email = emailParam || dadosAgendamento.email;
    if (!email) return;
    setCarregandoPontos(true);
    try {
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', email);

      if (!clientes || clientes.length === 0) {
        setPontosCliente(0);
        setAtendimentosRealizados(0);
        setPontosJaResgatados(0);
        setCarregandoPontos(false);
        return;
      }

      const cliente = clientes[0];

      const { data: realizados, error: erroRealizados } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('status', 'REALIZADO');

      if (erroRealizados) throw erroRealizados;

      // Conta quantos agendamentos já usaram desconto de pontos, para saber quanto ja foi resgatado
      const { data: resgates, error: erroResgates } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_id', cliente.id)
        .ilike('observacoes', '%Desconto de pontos%');

      if (erroResgates) throw erroResgates;

      const totalGanho = (realizados?.length || 0) * 2;
      const totalResgatado = (resgates?.length || 0) * 10;
      const saldo = Math.max(0, totalGanho - totalResgatado);

      setAtendimentosRealizados(realizados?.length || 0);
      setPontosJaResgatados(totalResgatado);
      setPontosCliente(saldo);
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
      setPontosCliente(0);
    } finally {
      setCarregandoPontos(false);
    }
  };

  const buscarHorariosOcupados = async () => {
    try {
      // cobre toda a janela de agendamento do calendário (hoje + DIAS_CARROSSEL dias),
      // não só o mês corrente, para não deixar passar conflitos perto da virada do mês.
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const fimJanela = new Date(hoje);
      fimJanela.setDate(hoje.getDate() + DIAS_CARROSSEL);

      const dataInicio = hoje.toISOString().split('T')[0];
      const dataFim = fimJanela.toISOString().split('T')[0];

      // Qualquer agendamento não cancelado ocupa o horário — inclui os
      // criados manualmente pelo Admin (status AGENDADO), que antes não
      // apareciam como ocupados aqui e causavam conflito com a agenda pública.
      const { data, error } = await supabase
        .from('agendamentos')
        .select('profissional_id, data_hora, servico_id, status')
        .gte('data_hora', `${dataInicio}T00:00:00`)
        .lte('data_hora', `${dataFim}T23:59:59`)
        .neq('status', 'CANCELADO');

      if (error) throw error;

      const ocupados = {};
      data.forEach(agendamento => {
        const profUUID = agendamento.profissional_id;
        const [dataStr, horaCompleta] = agendamento.data_hora.split('T');
        const [hh, mm] = horaCompleta.split(':').map(Number);
        const inicioMin = hh * 60 + mm;
        const servicoInfo = servicos.find(s => s.uuid === agendamento.servico_id);
        const duracaoMin = servicoInfo ? servicoInfo.duracaoMinutos : 60;

        if (!ocupados[profUUID]) {
          ocupados[profUUID] = [];
        }
        ocupados[profUUID].push({ data: dataStr, inicioMin, fimMin: inicioMin + duracaoMin });
      });

      setHorariosOcupados(ocupados);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
  };

  // Horários disponíveis para um profissional em uma data: parte dos slots
  // do horário do salão (config/horarios.js) e remove os que colidem com
  // agendamentos já existentes daquele profissional.
  const getHorariosProfissional = (prof, data, duracaoMinutos) => {
    if (!prof) return [];
    const duracao = duracaoMinutos || 60;
    const dataStr = data.toISOString().split('T')[0];
    const intervalosOcupados = (horariosOcupados[prof.uuid] || []).filter(o => o.data === dataStr);
    return getSlotsLivresNoDia(data, duracao, intervalosOcupados, horarioEstendido);
  };

  const calcularPrecoFinal = () => {
    if (!dadosAgendamento.servico) return 0;
    const servico = servicos.find(s => s.nome === dadosAgendamento.servico);
    if (!servico) return 0;
    let preco = servico.preco;
    if (usarPontos && pontosCliente >= 10) {
      preco -= 500;
    }
    return Math.max(0, preco);
  };

  const abrirAgendamentoParaServico = (servico) => {
    setDadosAgendamento({ ...dadosAgendamento, servico: servico.nome });
    setDiaHorarioSelecionado(null);
    setDataSelecionada(new Date());
    setAbaAtiva('agendar');
  };

  const handleSelecionarHorario = (hora) => {
    if (!profissionalSelecionado) return;
    setDiaHorarioSelecionado({ data: dataSelecionada, prof: profissionalSelecionado, hora });
    setDadosAgendamento({
      ...dadosAgendamento,
      data: dataSelecionada.toISOString().split('T')[0],
      profissional: profissionalSelecionado.nome,
      hora
    });
    setModalAberto(true);
  };

  const handleConfirmarAgendamento = async () => {
    if (!dadosAgendamento.nome || !dadosAgendamento.email) {
      alert('⚠️ ' + t('alerta_preencha_nome_email'));
      return;
    }

    if (!dadosAgendamento.servico) {
      alert('⚠️ ' + t('alerta_selecione_servico'));
      return;
    }

    if (usarPontos && pontosCliente < 10) {
      alert('⚠️ ' + t('alerta_pontos_insuficientes'));
      return;
    }

    setCarregando(true);

    try {
      let clienteId = null;

      const { data: clientesExistentes } = await supabase
        .from('clientes')
        .select('id')
        .eq('email', dadosAgendamento.email);

      if (clientesExistentes && clientesExistentes.length > 0) {
        clienteId = clientesExistentes[0].id;
      } else {
        const { data: novoCliente, error: erroClienteInsert } = await supabase
          .from('clientes')
          .insert([
            {
              nome: dadosAgendamento.nome,
              email: dadosAgendamento.email,
              telefone: dadosAgendamento.telefone || null
            }
          ])
          .select('id')
          .single();

        if (erroClienteInsert) throw erroClienteInsert;
        clienteId = novoCliente.id;
      }

      const profissionalUUID = diaHorarioSelecionado.prof.uuid;
      const servicoSelecionado = servicos.find(s => s.nome === dadosAgendamento.servico);
      const servicoUUID = servicoSelecionado.uuid;
      const precoFinal = calcularPrecoFinal();

      const notas = [
        usarPontos ? 'Desconto de pontos de fidelidade aplicado (-¥500)' : null,
        observacoesCliente ? `Observação do cliente: ${observacoesCliente}` : null,
      ].filter(Boolean).join(' | ') || null;

      const { data: novoAgendamento, error } = await supabase
        .from('agendamentos')
        .insert([
          {
            cliente_id: clienteId,
            profissional_id: profissionalUUID,
            servico_id: servicoUUID,
            data_hora: `${dadosAgendamento.data}T${dadosAgendamento.hora}:00`,
            status: 'CONFIRMADO',
            preco_final: precoFinal,
            observacoes: notas
          }
        ])
        .select('id')
        .single();

      if (error) throw error;

      await buscarHorariosOcupados();

      setAgendamentoConfirmado({
        id: novoAgendamento?.id,
        numero: Math.floor(Math.random() * 100000),
        profissional: dadosAgendamento.profissional,
        servico: dadosAgendamento.servico,
        servicoExibicao: getNomeServico(servicoSelecionado, idioma),
        dataStr: dadosAgendamento.data,
        data: new Date(dadosAgendamento.data).toLocaleDateString(localeAtual),
        hora: dadosAgendamento.hora,
        horaFim: somarMinutos(dadosAgendamento.hora, duracaoSelecionada),
        duracaoMinutos: duracaoSelecionada,
        precoOriginal: servicoSelecionado.preco,
        precoFinal: precoFinal,
        desconto: usarPontos ? 500 : 0
      });

      setPresencaConfirmada(false);
      setModalAberto(false);
      setDadosAgendamento({ nome: '', email: '', telefone: '', profissional: '', hora: '', servico: '', data: '' });
      setUsarPontos(false);
      setObservacoesCliente('');
      setPontosCliente(0);
      setDiaHorarioSelecionado(null);

    } catch (error) {
      alert('❌ ' + t('alerta_erro_agendar') + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmarPresenca = async () => {
    if (!agendamentoConfirmado?.id) {
      setPresencaConfirmada(true);
      return;
    }
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ presenca_confirmada: true })
        .eq('id', agendamentoConfirmado.id);
      if (error) throw error;
      setPresencaConfirmada(true);
    } catch (error) {
      alert('❌ ' + t('alerta_erro_presenca') + error.message);
    }
  };

  const handleAdicionarAoCalendario = () => {
    const conteudo = gerarConteudoICS({
      servico: agendamentoConfirmado.servicoExibicao || agendamentoConfirmado.servico,
      profissional: agendamentoConfirmado.profissional,
      dataStr: agendamentoConfirmado.dataStr,
      horaInicio: agendamentoConfirmado.hora,
      horaFim: agendamentoConfirmado.horaFim,
      lembreteMinutos,
    });
    baixarArquivoICS(conteudo, `agendamento-kaizen-${agendamentoConfirmado.dataStr}.ics`);
  };

  const handleEnviarListaEspera = async (e) => {
    e.preventDefault();
    if (!listaEsperaDados.nome || !listaEsperaDados.email) return;
    setEnviandoListaEspera(true);
    try {
      const { error } = await supabase.from('lista_espera').insert([{
        nome: listaEsperaDados.nome,
        email: listaEsperaDados.email,
        telefone: listaEsperaDados.telefone || null,
        servico: dadosAgendamento.servico || null,
        profissional: profissionalSelecionado?.nome || null,
        data_desejada: dataSelecionada.toISOString().split('T')[0],
      }]);
      if (error) throw error;
      setListaEsperaEnviada(true);
    } catch (error) {
      alert('❌ ' + t('alerta_erro_lista_espera') + error.message);
    } finally {
      setEnviandoListaEspera(false);
    }
  };

  const handleAdicionarAvaliacao = (e) => {
    e.preventDefault();
    if (novaAvaliacao.nome && novaAvaliacao.texto) {
      const hoje = new Date().toISOString().split('T')[0];
      setAvaliacoes([...avaliacoes, {
        id: avaliacoes.length + 1,
        ...novaAvaliacao,
        data: hoje
      }]);
      setNovaAvaliacao({ nome: '', estrelas: 5, texto: '' });
      alert('✅ ' + t('alerta_avaliacao_enviada'));
    }
  };

  const renderizarEstrelas = (num) => {
    return '★'.repeat(num);
  };

  // Monta a grade do mês (semanas de domingo a sábado) para o calendário
  // visual, com células vazias (null) preenchendo os dias fora do mês.
  const gerarGradeMes = (mesRef) => {
    const ano = mesRef.getFullYear();
    const mes = mesRef.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias = [];
    for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null);
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(ano, mes, d));
    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  };

  const irMesAnterior = () => {
    if (!podeVoltarMes) return;
    setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1));
  };

  const irProximoMes = () => {
    if (!podeAvancarMes) return;
    setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1));
  };

  if (agendamentoConfirmado) {
    const horariosDisponiveisLembrete = OPCOES_LEMBRETE;
    return (
      <div style={{ background: '#1a1a1a', minHeight: '100vh', paddingBottom: '40px' }}>
        <div style={{ background: '#166534', padding: '18px 20px', textAlign: 'center' }}>
          <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '17px', margin: 0 }}>✅ {t('conf_titulo')}</p>
        </div>

        <div style={{ maxWidth: '480px', margin: '30px auto', padding: '0 20px' }}>
          <div style={{ background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '25px', marginBottom: '20px' }}>
            <p style={{ color: '#999', fontSize: '12px', margin: '0 0 4px 0' }}>#{agendamentoConfirmado.numero} · {NOME_ESTABELECIMENTO}</p>
            <h2 style={{ color: '#d4af37', margin: '0 0 15px 0' }}>{agendamentoConfirmado.servicoExibicao || agendamentoConfirmado.servico}</h2>
            <div style={{ color: '#e8e8e8', fontSize: '15px', lineHeight: '1.9' }}>
              <p style={{ margin: 0 }}>💈 {t('conf_profissional')} <strong>{agendamentoConfirmado.profissional}</strong></p>
              <p style={{ margin: 0 }}>📅 {t('conf_data')} <strong>{agendamentoConfirmado.data}</strong></p>
              <p style={{ margin: 0 }}>🕐 {t('conf_horario')} <strong>{agendamentoConfirmado.hora} - {agendamentoConfirmado.horaFim} ({agendamentoConfirmado.duracaoMinutos} min)</strong></p>
              <p style={{ margin: 0 }}>
                💰 {t('conf_valor')} <strong>{formatarPreco(agendamentoConfirmado.precoFinal)}</strong>
                {agendamentoConfirmado.desconto > 0 && (
                  <span style={{ color: '#4ade80' }}> {t('conf_desconto_aplicado', { valor: formatarPreco(agendamentoConfirmado.desconto) })}</span>
                )}
              </p>
            </div>
            <p style={{ color: '#999', fontSize: '13px', marginTop: '15px' }}>⭐ {t('conf_pontos_fidelidade')}</p>
          </div>

          <div style={{ background: '#2d2d2d', border: '1px solid #404040', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
            <h3 style={{ color: '#d4af37', marginTop: 0, fontSize: '16px' }}>⏰ {t('conf_criar_lembrete')}</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {horariosDisponiveisLembrete.map(min => (
                <button
                  key={min}
                  onClick={() => setLembreteMinutos(min)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: '1px solid #d4af37',
                    background: lembreteMinutos === min ? '#d4af37' : 'transparent',
                    color: lembreteMinutos === min ? '#1a1a1a' : '#d4af37',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {t('conf_min_antes', { min })}
                </button>
              ))}
            </div>
            <button onClick={handleAdicionarAoCalendario} style={{ width: '100%', padding: '12px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
              📲 {t('conf_add_calendario')}
            </button>
            <a
              href={linkGoogleCalendar({
                servico: agendamentoConfirmado.servicoExibicao || agendamentoConfirmado.servico,
                profissional: agendamentoConfirmado.profissional,
                dataStr: agendamentoConfirmado.dataStr,
                horaInicio: agendamentoConfirmado.hora,
                horaFim: agendamentoConfirmado.horaFim,
              })}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', color: '#999', fontSize: '13px', textDecoration: 'underline' }}
            >
              {t('conf_google_agenda')}
            </a>
          </div>

          <button
            onClick={handleConfirmarPresenca}
            disabled={presencaConfirmada}
            style={{
              width: '100%',
              padding: '14px',
              background: presencaConfirmada ? '#166534' : 'transparent',
              color: presencaConfirmada ? '#fff' : '#4ade80',
              border: '1px solid #4ade80',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: presencaConfirmada ? 'default' : 'pointer',
              marginBottom: '20px'
            }}
          >
            {presencaConfirmada ? `✓ ${t('conf_presenca_confirmada')}` : t('conf_confirmar_presenca')}
          </button>

          <button
            onClick={() => { setAgendamentoConfirmado(null); setAbaAtiva('servicos'); }}
            style={{ width: '100%', padding: '12px', background: 'transparent', color: '#999', border: '1px solid #404040', borderRadius: '6px', cursor: 'pointer' }}
          >
            {t('conf_voltar_site')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#1a1a1a', color: '#e8e8e8', minHeight: '100vh' }}>
      <header style={{ borderBottom: '3px solid #d4af37', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 2 }}>
          {IDIOMAS.map((op) => (
            <button
              key={op.codigo}
              onClick={() => mudarIdioma(op.codigo)}
              style={{
                padding: '5px 10px',
                borderRadius: '20px',
                border: '1px solid #d4af37',
                background: idioma === op.codigo ? '#d4af37' : 'rgba(26,26,26,0.75)',
                color: idioma === op.codigo ? '#1a1a1a' : '#d4af37',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {op.bandeira} {op.rotulo}
            </button>
          ))}
        </div>
        <img
          src="/images/header_banner.jpg"
          alt="Kaizen Barber Shop"
          style={{ width: '100%', aspectRatio: '16 / 7', objectFit: 'cover', objectPosition: 'center' }}
        />
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1 style={{ color: '#d4af37', fontSize: '32px', margin: '0' }}>Kaizen Barber Shop</h1>
          <p style={{ color: '#999', margin: '0' }}>{t('header_subtitulo')}</p>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '10px', padding: '20px', borderBottom: '1px solid #404040', overflowX: 'auto' }}>
        {[
          { id: 'servicos', label: `💈 ${t('nav_servicos')}` },
          { id: 'agendar', label: `📅 ${t('nav_agendar')}` },
          { id: 'endereco', label: `📍 ${t('nav_endereco')}` },
          { id: 'profissionais', label: `👥 ${t('nav_profissionais')}` },
          { id: 'fidelidade', label: `🎁 ${t('nav_fidelidade')}` },
          { id: 'avaliacoes', label: `★ ${t('nav_avaliacoes')}` },
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              padding: '10px 15px',
              background: abaAtiva === aba.id ? '#d4af37' : 'transparent',
              color: abaAtiva === aba.id ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            {aba.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>

        {abaAtiva === 'servicos' && (
          <section>
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>💈 {t('servicos_titulo')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {servicos.map((servico, idx) => {
                const nomeServico = getNomeServico(servico, idioma);
                const descricaoServico = getDescricaoServico(servico, idioma);
                const descricaoLonga = descricaoServico.length > 60;
                const expandida = !!descricaoExpandida[servico.id];
                const descricaoExibida = !descricaoLonga || expandida
                  ? descricaoServico
                  : `${descricaoServico.slice(0, 60)}...`;

                return (
                  <div
                    key={servico.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      border: '1px solid #d4af37',
                      borderRadius: '10px',
                      background: '#2d2d2d',
                      padding: '14px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <img
                      src={servico.imagem}
                      alt={servico.nome}
                      style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                    />

                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <h3 style={{ color: '#d4af37', margin: '0 0 4px 0', fontSize: '16px', letterSpacing: '0.3px' }}>
                        {idx + 1}. {nomeServico.toUpperCase()}
                      </h3>
                      <p style={{ color: '#999', fontSize: '13px', margin: '0 0 6px 0' }}>
                        {descricaoExibida}
                        {descricaoLonga && (
                          <button
                            onClick={() => setDescricaoExpandida({ ...descricaoExpandida, [servico.id]: !expandida })}
                            style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '13px', padding: 0, marginLeft: '4px', textDecoration: 'underline' }}
                          >
                            {expandida ? t('servicos_ver_menos') : t('servicos_ver_mais')}
                          </button>
                        )}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '16px' }}>{formatarPreco(servico.preco)}</span>
                        <span style={{ color: '#999', fontSize: '13px' }}>⏱️ {servico.duracao}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => abrirAgendamentoParaServico(servico)}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 22px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {t('servicos_agendar')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {abaAtiva === 'agendar' && (
          <section style={{
            backgroundImage: 'url(/images/interior.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)'
          }}>
            <div style={{
              background: 'rgba(26, 26, 26, 0.55)',
              padding: '30px'
            }}>
              <h2 style={{ color: '#d4af37', marginBottom: '20px' }}>📅 {t('agendar_titulo')}</h2>

              <div style={{ maxWidth: '500px', margin: '0 auto 25px' }}>
                <label style={{ color: '#d4af37', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{t('agendar_servico_label')}</label>
                <select
                  value={dadosAgendamento.servico}
                  onChange={(e) => { setDadosAgendamento({ ...dadosAgendamento, servico: e.target.value }); setDiaHorarioSelecionado(null); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                >
                  <option value="">{t('agendar_servico_placeholder')}</option>
                  {servicos.map(s => (<option key={s.id} value={s.nome}>{getNomeServico(s, idioma)} ({s.duracao})</option>))}
                </select>
              </div>

              {!dadosAgendamento.servico ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>👆 {t('agendar_escolha_servico')}</p>
              ) : (
                <div style={{ maxWidth: '560px', margin: '0 auto' }}>

                  {/* Calendário do mês: navegação por mês (até 3 meses de
                      antecedência) com visualização completa dos dias da
                      semana e números, para o cliente decidir com calma. */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <button
                      onClick={irMesAnterior}
                      disabled={!podeVoltarMes}
                      aria-label={t('agendar_mes_anterior')}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        border: '1px solid #d4af37',
                        background: 'transparent',
                        color: podeVoltarMes ? '#d4af37' : '#555',
                        fontSize: '18px',
                        cursor: podeVoltarMes ? 'pointer' : 'not-allowed',
                        opacity: podeVoltarMes ? 1 : 0.4
                      }}
                    >
                      ‹
                    </button>
                    <p style={{ color: '#d4af37', fontWeight: 'bold', margin: 0, fontSize: '17px', textTransform: 'capitalize' }}>
                      {mesCalendario.toLocaleDateString(localeAtual, { month: 'long', year: 'numeric' })}
                    </p>
                    <button
                      onClick={irProximoMes}
                      disabled={!podeAvancarMes}
                      aria-label={t('agendar_proximo_mes')}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        border: '1px solid #d4af37',
                        background: 'transparent',
                        color: podeAvancarMes ? '#d4af37' : '#555',
                        fontSize: '18px',
                        cursor: podeAvancarMes ? 'pointer' : 'not-allowed',
                        opacity: podeAvancarMes ? 1 : 0.4
                      }}
                    >
                      ›
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
                    {(DIAS_ABREV_POR_IDIOMA[idioma] || DIAS_ABREV_POR_IDIOMA[IDIOMA_PADRAO]).map(dia => (
                      <div key={dia} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#999' }}>
                        {dia}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '20px' }}>
                    {gerarGradeMes(mesCalendario).map((data, idx) => {
                      if (!data) return <div key={`vazio-${idx}`} />;
                      const diaSemana = getDiaSemana(data);
                      const fechado = !HORARIO_SALAO[diaSemana]?.aberto;
                      const foraDoIntervalo = data < hoje || data > limiteDataMax;
                      const desabilitado = fechado || foraDoIntervalo;
                      const selecionado = data.toDateString() === dataSelecionada.toDateString();
                      return (
                        <button
                          key={data.toISOString()}
                          disabled={desabilitado}
                          onClick={() => { setDataSelecionada(data); setListaEsperaAberta(false); setListaEsperaEnviada(false); }}
                          title={fechado ? t('endereco_fechado') : (foraDoIntervalo ? t('agendar_fora_periodo') : undefined)}
                          style={{
                            aspectRatio: '1',
                            width: '100%',
                            borderRadius: '8px',
                            border: selecionado ? '2px solid #d4af37' : '1px solid #404040',
                            background: selecionado ? '#d4af37' : 'rgba(45, 45, 45, 0.85)',
                            color: desabilitado ? '#666' : (selecionado ? '#1a1a1a' : '#e8e8e8'),
                            cursor: desabilitado ? 'not-allowed' : 'pointer',
                            opacity: desabilitado ? 0.45 : 1,
                            fontWeight: selecionado ? 'bold' : 'normal',
                            fontSize: '14px'
                          }}
                        >
                          {data.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Seletor de profissional */}
                  <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '10px' }}>{t('agendar_profissional_label')}</p>
                  <div style={{ display: 'flex', gap: '18px', marginBottom: '25px', flexWrap: 'wrap' }}>
                    {profissionaisAptos.map((prof) => {
                      const selecionado = profissionalSelecionado?.id === prof.id;
                      return (
                        <button
                          key={prof.id}
                          onClick={() => { setProfissionalSelecionadoId(prof.id); setListaEsperaAberta(false); setListaEsperaEnviada(false); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}
                        >
                          <img
                            src={prof.imagem}
                            alt={prof.nome}
                            style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: selecionado ? '3px solid #d4af37' : '3px solid transparent',
                              display: 'block',
                              margin: '0 auto 6px'
                            }}
                          />
                          <span style={{ fontSize: '12px', color: selecionado ? '#d4af37' : '#e8e8e8', fontWeight: selecionado ? 'bold' : 'normal' }}>
                            {prof.nome}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Grade de horários, dividida em Manhã / Tarde */}
                  {(() => {
                    const horarios = getHorariosProfissional(profissionalSelecionado, dataSelecionada, duracaoSelecionada);
                    const limiteManha = paraMinutos(HORARIO_ALMOCO.inicio);
                    const manha = horarios.filter(h => paraMinutos(h) < limiteManha);
                    const tarde = horarios.filter(h => paraMinutos(h) >= limiteManha);

                    if (horarios.length === 0) {
                      return (
                        <div style={{ background: 'rgba(45, 45, 45, 0.9)', border: '1px solid #404040', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                          <p style={{ color: '#e8e8e8', marginBottom: '15px' }}>😕 {t('agendar_sem_horario', { prof: profissionalSelecionado?.nome || t('agendar_este_profissional') })}</p>
                          {!listaEsperaAberta && !listaEsperaEnviada && (
                            <button
                              onClick={() => setListaEsperaAberta(true)}
                              style={{ background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              {t('agendar_lista_espera')}
                            </button>
                          )}
                          {listaEsperaEnviada && (
                            <p style={{ color: '#4ade80', fontWeight: 'bold', margin: 0 }}>✅ {t('agendar_anotado')}</p>
                          )}
                          {listaEsperaAberta && !listaEsperaEnviada && (
                            <form onSubmit={handleEnviarListaEspera} style={{ marginTop: '15px', textAlign: 'left' }}>
                              <input type="text" placeholder={t('agendar_le_nome')} value={listaEsperaDados.nome} onChange={(e) => setListaEsperaDados({ ...listaEsperaDados, nome: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                              <input type="email" placeholder={t('agendar_le_email')} value={listaEsperaDados.email} onChange={(e) => setListaEsperaDados({ ...listaEsperaDados, email: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                              <input type="tel" placeholder={t('agendar_le_telefone')} value={listaEsperaDados.telefone} onChange={(e) => setListaEsperaDados({ ...listaEsperaDados, telefone: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
                              <button type="submit" disabled={enviandoListaEspera} style={{ width: '100%', padding: '10px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                                {enviandoListaEspera ? `⏳ ${t('agendar_le_enviando')}` : t('agendar_le_enviar')}
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    }

                    return (
                      <>
                        {manha.length > 0 && (
                          <div style={{ marginBottom: '20px' }}>
                            <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '10px' }}>☀️ {t('agendar_manha', { n: manha.length })}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {manha.map(h => (
                                <button
                                  key={h}
                                  onClick={() => handleSelecionarHorario(h)}
                                  style={{ background: '#4ade80', color: '#1a1a1a', border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {tarde.length > 0 && (
                          <div>
                            <p style={{ color: '#d4af37', fontWeight: 'bold', marginBottom: '10px' }}>🌆 {t('agendar_tarde', { n: tarde.length })}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {tarde.map(h => (
                                <button
                                  key={h}
                                  onClick={() => handleSelecionarHorario(h)}
                                  style={{ background: '#4ade80', color: '#1a1a1a', border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'endereco' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>📍 {t('endereco_titulo')}</h2>
            <div style={{ maxWidth: '600px' }}>
              <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
                <h3 style={{ color: '#d4af37', marginTop: 0, marginBottom: '12px' }}>Kaizen Barber Shop</h3>
                <p style={{ margin: '0 0 12px 0', lineHeight: '1.6' }}>Aichi-Ken Anjo-Shi<br />Hamatomi-Cho 4-17<br />San City Oomy 302</p>
                <p style={{ margin: '0 0 16px 0', lineHeight: '1.6', color: '#e8e8e8' }}>{ENDERECO_JAPONES}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ENDERECO_JAPONES)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#d4af37',
                    border: '1px solid #d4af37',
                    borderRadius: '4px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                  }}
                >
                  🗺️ {t('endereco_ver_mapa')}
                </a>
              </div>

              <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
                <h3 style={{ color: '#d4af37', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🕒 {t('endereco_horario_titulo')}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {ORDEM_DIAS_SEMANA.map((dia) => {
                      const h = HORARIO_SALAO[dia];
                      const ehHoje = dia === getDiaSemana(new Date());
                      const nomesDias = DIAS_NOMES_POR_IDIOMA[idioma] || DIAS_NOMES_POR_IDIOMA[IDIOMA_PADRAO];
                      return (
                        <tr
                          key={dia}
                          style={{
                            borderBottom: '1px solid #404040',
                            background: ehHoje ? 'rgba(212, 175, 55, 0.14)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px 8px', color: ehHoje ? '#d4af37' : '#e8e8e8', fontWeight: ehHoje ? 'bold' : 'normal' }}>
                            {ehHoje && '▶ '}{nomesDias[dia]}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: ehHoje ? 'bold' : 'normal' }}>
                            {h.aberto ? (
                              <span style={{ color: '#4ade80' }}>{h.abertura} - {h.fechamento}</span>
                            ) : (
                              <span style={{ color: '#f87171' }}>{t('endereco_fechado')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ fontSize: '13px', color: '#999', marginTop: '14px', marginBottom: 0 }}>
                  ☕ {t('endereco_almoco', { inicio: HORARIO_ALMOCO.inicio, fim: HORARIO_ALMOCO.fim })}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <img src="/images/fachada.jpg" alt={t('endereco_fachada')} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <img src="/images/interior.jpg" alt={t('endereco_interior')} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <img src="/images/detalhes.jpg" alt={t('endereco_detalhes')} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <img src="/images/ambiente.jpg" alt={t('endereco_ambiente')} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            </div>
          </section>
        )}

        {abaAtiva === 'profissionais' && (
          <section>
            <h2 style={{ color: '#d4af37', marginBottom: '30px' }}>👥 {t('profissionais_titulo')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {profissionais.map((prof) => (
                <div key={prof.id} style={{ border: '1px solid #d4af37', borderRadius: '8px', overflow: 'hidden', background: '#2d2d2d' }}>
                  <img src={prof.imagem} alt={prof.nome} style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', objectPosition: 'center top' }} />
                  <div style={{ padding: '15px' }}>
                    <h3 style={{ color: '#d4af37' }}>{prof.nome}</h3>
                    <p style={{ color: '#999', fontSize: '14px' }}>{getEspecialidadeProf(prof)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === 'fidelidade' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>🎁 {t('fidelidade_titulo')}</h2>
            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px', marginBottom: '20px' }}>
              <p>✅ {t('fidelidade_regra1')}</p>
              <p>✅ {t('fidelidade_regra2')}</p>
            </div>

            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', maxWidth: '600px' }}>
              <h3 style={{ color: '#d4af37', marginTop: 0 }}>{t('fidelidade_consultar_titulo')}</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder={t('fidelidade_email_placeholder')}
                  value={emailConsultaPontos}
                  onChange={(e) => setEmailConsultaPontos(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }}
                />
                <button
                  onClick={async () => { await buscarPontosCliente(emailConsultaPontos); setConsultaPontosFeita(true); }}
                  disabled={!emailConsultaPontos.includes('@') || carregandoPontos}
                  style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: carregandoPontos ? 'wait' : 'pointer' }}
                >
                  {carregandoPontos ? '⏳' : t('fidelidade_consultar_botao')}
                </button>
              </div>

              {consultaPontosFeita && !carregandoPontos && (
                <div style={{ marginTop: '20px', color: '#e8e8e8', lineHeight: '1.8' }}>
                  <p>{t('fidelidade_atendimentos')} <strong style={{ color: '#d4af37' }}>{atendimentosRealizados}</strong></p>
                  <p>{t('fidelidade_resgatados')} <strong style={{ color: '#60a5fa' }}>{pontosJaResgatados}</strong></p>
                  <p style={{ fontSize: '18px' }}>{t('fidelidade_saldo')} <strong style={{ color: '#4ade80' }}>{pontosCliente} {t('fidelidade_pontos')}</strong></p>
                  {pontosCliente >= 10 ? (
                    <p style={{ color: '#4ade80', fontWeight: 'bold' }}>🎉 {t('fidelidade_pode_resgatar')}</p>
                  ) : (
                    <p style={{ color: '#999' }}>{t('fidelidade_faltam', { n: 10 - pontosCliente })}</p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {abaAtiva === 'avaliacoes' && (
          <section>
            <h2 style={{ color: '#d4af37' }}>★ {t('avaliacoes_titulo')}</h2>
            <div style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '8px', padding: '20px', marginBottom: '30px', maxWidth: '600px' }}>
              <h3 style={{ color: '#d4af37' }}>{t('avaliacoes_deixe')}</h3>
              <form onSubmit={handleAdicionarAvaliacao}>
                <input type="text" placeholder={t('avaliacoes_nome_placeholder')} value={novaAvaliacao.nome} onChange={(e) => setNovaAvaliacao({...novaAvaliacao, nome: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} required />
                <textarea placeholder={t('avaliacoes_texto_placeholder')} value={novaAvaliacao.texto} onChange={(e) => setNovaAvaliacao({...novaAvaliacao, texto: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box', minHeight: '80px' }} required />
                <button type="submit" style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>{t('avaliacoes_enviar')}</button>
              </form>
            </div>
            {avaliacoes.map((av) => (
              <div key={av.id} style={{ border: '1px solid #404040', borderRadius: '6px', padding: '15px', marginBottom: '15px', background: '#2d2d2d' }}>
                <h4 style={{ color: '#e8e8e8', margin: '0' }}>{av.nome}</h4>
                <span style={{ color: '#d4af37' }}>{renderizarEstrelas(av.estrelas)}</span>
                <p style={{ color: '#e8e8e8' }}>{av.texto}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #404040', padding: '20px', textAlign: 'center', color: '#999' }}>
        <p>&copy; 2026 Kaizen Barber Shop. {t('footer_direitos')}</p>
      </footer>

      {/* Tela 3: modal de confirmação (bottom sheet) */}
      {modalAberto && diaHorarioSelecionado && (
        <div
          className="kaizen-modal-overlay"
          onClick={() => setModalAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="kaizen-modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d',
              borderTop: '2px solid #d4af37',
              borderRadius: '16px 16px 0 0',
              padding: '20px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#555' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <img src={diaHorarioSelecionado.prof.imagem} alt={diaHorarioSelecionado.prof.nome} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>{NOME_ESTABELECIMENTO}</p>
                <p style={{ margin: 0, color: '#d4af37', fontWeight: 'bold' }}>{diaHorarioSelecionado.prof.nome}</p>
              </div>
            </div>

            <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid #404040', borderRadius: '8px', padding: '14px', marginBottom: '15px' }}>
              <p style={{ margin: '0 0 6px 0', color: '#e8e8e8', fontWeight: 'bold' }}>{servicoSelecionadoInfo ? getNomeServico(servicoSelecionadoInfo, idioma) : dadosAgendamento.servico}</p>
              <p style={{ margin: '0 0 6px 0', color: '#999', fontSize: '13px' }}>
                📅 {diaHorarioSelecionado.data.toLocaleDateString(localeAtual)} · 🕐 {diaHorarioSelecionado.hora} - {somarMinutos(diaHorarioSelecionado.hora, duracaoSelecionada)} ({duracaoSelecionada} min)
              </p>
              <p style={{ margin: 0 }}>
                {usarPontos && pontosCliente >= 10 ? (
                  <>
                    <span style={{ textDecoration: 'line-through', color: '#999', marginRight: '8px' }}>{formatarPreco(servicoSelecionadoInfo?.preco || 0)}</span>
                    <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '18px' }}>{formatarPreco(calcularPrecoFinal())}</span>
                  </>
                ) : (
                  <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '18px' }}>{formatarPreco(calcularPrecoFinal())}</span>
                )}
              </p>
            </div>

            <input type="text" placeholder={t('modal_nome_placeholder')} value={dadosAgendamento.nome} onChange={(e) => setDadosAgendamento({...dadosAgendamento, nome: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <input type="email" placeholder={t('modal_email_placeholder')} value={dadosAgendamento.email} onChange={(e) => setDadosAgendamento({...dadosAgendamento, email: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <input type="tel" placeholder={t('modal_telefone_placeholder')} value={dadosAgendamento.telefone} onChange={(e) => setDadosAgendamento({...dadosAgendamento, telefone: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box' }} />
            <textarea
              placeholder={t('modal_obs_placeholder')}
              value={observacoesCliente}
              onChange={(e) => setObservacoesCliente(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '4px', border: '1px solid #404040', background: '#1a1a1a', color: '#e8e8e8', boxSizing: 'border-box', minHeight: '60px' }}
            />

            {dadosAgendamento.email && dadosAgendamento.email.includes('@') && (
              <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid #d4af37', borderRadius: '4px', padding: '12px', marginBottom: '15px', fontSize: '13px' }}>
                {carregandoPontos ? (
                  <p style={{ margin: 0, color: '#999' }}>⏳ {t('modal_consultando_pontos')}</p>
                ) : (
                  <>
                    <p style={{ margin: '0 0 8px 0', color: '#d4af37' }}>🎁 {t('modal_pontos_disponiveis', { n: pontosCliente })}</p>
                    {pontosCliente >= 10 ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e8e8e8' }}>
                        <input type="checkbox" checked={usarPontos} onChange={(e) => setUsarPontos(e.target.checked)} />
                        {t('modal_usar_pontos')}
                      </label>
                    ) : (
                      <p style={{ margin: 0, color: '#999' }}>{t('modal_faltam_pontos', { n: 10 - pontosCliente, a: Math.ceil((10 - pontosCliente) / 2) })}</p>
                    )}
                  </>
                )}
              </div>
            )}

            <button onClick={handleConfirmarAgendamento} disabled={carregando} style={{ width: '100%', background: '#d4af37', color: '#1a1a1a', border: 'none', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: carregando ? 'wait' : 'pointer', fontSize: '15px' }}>
              {carregando ? `⏳ ${t('modal_agendando')}` : `✅ ${t('modal_confirmar')}`}
            </button>
            <button onClick={() => setModalAberto(false)} style={{ width: '100%', background: 'transparent', color: '#999', border: 'none', padding: '10px', marginTop: '6px', cursor: 'pointer' }}>
              {t('modal_cancelar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientePublico;
