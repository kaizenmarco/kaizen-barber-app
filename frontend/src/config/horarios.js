// ============================================================================
// Configuração central de horários da Kaizen Barber.
// Fonte única de verdade: tanto a agenda pública (ClientePublico.jsx)
// quanto o painel administrativo (Profissionais.jsx) leem daqui, para nunca
// mais ficarem dessincronizados.
// ============================================================================
import { supabase } from '../supabaseClient';

// Horário de funcionamento do salão por dia da semana.
// aberto: false = fechado o dia inteiro (ex: terça-feira).
export const HORARIO_SALAO = {
  domingo: { aberto: true, abertura: '09:00', fechamento: '17:00' },
  segunda: { aberto: true, abertura: '09:00', fechamento: '19:00' },
  terca: { aberto: false, abertura: null, fechamento: null },
  quarta: { aberto: true, abertura: '09:00', fechamento: '20:30' },
  quinta: { aberto: true, abertura: '09:00', fechamento: '22:00' },
  sexta: { aberto: true, abertura: '09:00', fechamento: '22:00' },
  sabado: { aberto: true, abertura: '08:00', fechamento: '20:30' },
};

// Intervalo de almoço, válido em todos os dias de funcionamento.
export const HORARIO_ALMOCO = { inicio: '12:45', fim: '13:45' };

// ----------------------------------------------------------------------------
// Horário estendido — usado em períodos como feriados prolongados no Japão
// (Golden Week, Obon, Ano Novo etc.), quando os profissionais trabalham a
// partir de um horário diferente do padrão (ex: o Gabriel já costuma abrir
// às 08:00 em dias de semana, mais cedo que o horário padrão do salão).
//
// Quando "ativo" for true e a data do agendamento estiver dentro do período
// [dataInicio, dataFim], a ABERTURA do dia passa a ser "abertura" abaixo
// (para TODOS os profissionais), no lugar do horário padrão de HORARIO_SALAO.
// O fechamento e o almoço continuam os mesmos.
//
// Isso agora fica salvo na tabela "configuracoes_horario" do Supabase (linha
// única, id = 1), controlado pelo botão em Profissionais.jsx — não precisa
// mais editar código para ativar/desativar.
// ----------------------------------------------------------------------------
export const HORARIO_ESTENDIDO_PADRAO = {
  ativo: false,
  abertura: '08:00',
  dataInicio: null, // 'AAAA-MM-DD'
  dataFim: null, // 'AAAA-MM-DD'
};

// Busca a configuração atual de horário estendido no Supabase.
// Em caso de erro (ou tabela ainda não criada), volta ao padrão desativado.
export const buscarHorarioEstendido = async () => {
  try {
    const { data, error } = await supabase
      .from('configuracoes_horario')
      .select('ativo, abertura, data_inicio, data_fim')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return HORARIO_ESTENDIDO_PADRAO;

    return {
      ativo: !!data.ativo,
      abertura: data.abertura || HORARIO_ESTENDIDO_PADRAO.abertura,
      dataInicio: data.data_inicio,
      dataFim: data.data_fim,
    };
  } catch (erro) {
    console.error('Erro ao buscar horário estendido:', erro);
    return HORARIO_ESTENDIDO_PADRAO;
  }
};

// Salva a configuração de horário estendido no Supabase.
export const salvarHorarioEstendido = async (config) => {
  const { error } = await supabase
    .from('configuracoes_horario')
    .update({
      ativo: config.ativo,
      abertura: config.abertura,
      data_inicio: config.dataInicio || null,
      data_fim: config.dataFim || null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) throw error;
};

const ORDEM_DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export const getDiaSemana = (data) => ORDEM_DIAS[data.getDay()];

export const paraMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const paraHHMM = (minutos) => {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const dataDentroDoIntervalo = (dataStr, inicio, fim) => {
  if (!inicio || !fim) return false;
  return dataStr >= inicio && dataStr <= fim;
};

// Retorna o horário de funcionamento do salão para uma data específica, já
// aplicando o horário estendido quando ativo e a data estiver no período.
// `horarioEstendido` deve vir de buscarHorarioEstendido() (ou usar o padrão
// desativado, se ainda não foi carregado).
export const getHorarioDoDia = (data, horarioEstendido = HORARIO_ESTENDIDO_PADRAO) => {
  const diaSemana = getDiaSemana(data);
  const padrao = HORARIO_SALAO[diaSemana];
  if (!padrao || !padrao.aberto) {
    return { aberto: false, abertura: null, fechamento: null };
  }

  const dataStr = data.toISOString().split('T')[0];
  let abertura = padrao.abertura;

  if (horarioEstendido?.ativo && dataDentroDoIntervalo(dataStr, horarioEstendido.dataInicio, horarioEstendido.dataFim)) {
    // usa o horário mais cedo entre o padrão do dia e o estendido
    abertura = paraMinutos(horarioEstendido.abertura) < paraMinutos(padrao.abertura)
      ? horarioEstendido.abertura
      : padrao.abertura;
  }

  return { aberto: true, abertura, fechamento: padrao.fechamento };
};

// Gera os horários de início possíveis para um dia, dado a duração do
// serviço, respeitando abertura/fechamento e sem cruzar o almoço.
export const getSlotsDisponiveisNoDia = (data, duracaoMinutos = 60, horarioEstendido = HORARIO_ESTENDIDO_PADRAO) => {
  const { aberto, abertura, fechamento } = getHorarioDoDia(data, horarioEstendido);
  if (!aberto) return [];

  const aberturaMin = paraMinutos(abertura);
  const fechamentoMin = paraMinutos(fechamento);
  const almocoInicio = paraMinutos(HORARIO_ALMOCO.inicio);
  const almocoFim = paraMinutos(HORARIO_ALMOCO.fim);

  // divide o dia em blocos de trabalho (manhã e tarde, separados pelo almoço)
  const blocos = [
    [aberturaMin, Math.min(almocoInicio, fechamentoMin)],
    [Math.max(almocoFim, aberturaMin), fechamentoMin],
  ].filter(([inicio, fim]) => fim > inicio);

  // O passo entre um horário e o próximo é a própria duração do serviço,
  // não um intervalo fixo — assim os horários oferecidos ficam "encostados"
  // um no outro (ex: corte de 40min -> 09:00, 09:40, 10:20...; coloração de
  // 180min -> só os horários em que um bloco inteiro de 3h cabe).
  const slots = [];
  blocos.forEach(([inicioBloco, fimBloco]) => {
    for (let m = inicioBloco; m + duracaoMinutos <= fimBloco; m += duracaoMinutos) {
      slots.push(paraHHMM(m));
    }
  });
  return slots;
};
