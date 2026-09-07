// ============================================================================
// Motor de disponibilidade de horários MULTI-TENANT.
//
// Diferença-chave em relação ao config/horarios.js original (single-tenant):
// lá o horário de funcionamento era um único horário fixo pra barbearia
// inteira (HORARIO_SALAO/HORARIO_ALMOCO, hardcoded no código). Aqui cada
// EMPRESA pode ter vários PROFISSIONAIS, e cada um configura seus próprios
// dias/horários de trabalho na tabela `horarios_profissional` (múltiplos
// blocos por dia — ex: 09:00-12:00 e 13:00-19:00 — representam o almoço sem
// precisar de um campo separado: o buraco entre blocos já não é slot livre).
//
// Ausência de qualquer bloco para um dia = profissional não trabalha nesse
// dia da semana.
// ============================================================================
import { supabase } from './supabaseClientTenant';

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

// ----------------------------------------------------------------------------
// Horário estendido — mesma ideia do app original (períodos como Golden
// Week/Ano Novo, em que a abertura muda pra um horário diferente do padrão),
// só que agora por empresa via supabaseClientTenant (RLS isola cada uma).
// Ao contrário do horário semanal (por profissional), o estendido continua
// valendo pra empresa toda — é uma exceção de calendário, não de expediente.
// ----------------------------------------------------------------------------
export const HORARIO_ESTENDIDO_PADRAO = {
  ativo: false,
  abertura: '08:00',
  dataInicio: null,
  dataFim: null,
};

export const buscarHorarioEstendido = async () => {
  try {
    const { data, error } = await supabase
      .from('configuracoes_horario')
      .select('ativo, abertura, data_inicio, data_fim')
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

export const salvarHorarioEstendido = async (config) => {
  // upsert: a empresa pode ainda não ter nenhuma linha em configuracoes_horario
  // (não é criada automaticamente no cadastro) — onConflict por empresa_id
  // (coluna única) cobre tanto o primeiro salvamento quanto os seguintes.
  const { error } = await supabase
    .from('configuracoes_horario')
    .upsert(
      {
        ativo: config.ativo,
        abertura: config.abertura,
        data_inicio: config.dataInicio || null,
        data_fim: config.dataFim || null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'empresa_id' }
    );

  if (error) throw error;
};

const dataDentroDoIntervalo = (dataStr, inicio, fim) => {
  if (!inicio || !fim) return false;
  return dataStr >= inicio && dataStr <= fim;
};

// ----------------------------------------------------------------------------
// Busca TODOS os horários de todos os profissionais da empresa de uma vez
// (uma query só) e organiza como { [profissionalId]: { [diaSemana]: [{inicioMin,fimMin}, ...] } },
// já ordenado — pronto pra getBlocosDoDiaProfissional consumir sem nova query.
// ----------------------------------------------------------------------------
export const buscarHorariosPorProfissional = async () => {
  const mapa = {};
  try {
    const { data, error } = await supabase
      .from('horarios_profissional')
      .select('profissional_id, dia_semana, horario_inicio, horario_fim');
    if (error || !data) return mapa;

    data.forEach((linha) => {
      const pid = linha.profissional_id;
      const dia = linha.dia_semana;
      if (!mapa[pid]) mapa[pid] = {};
      if (!mapa[pid][dia]) mapa[pid][dia] = [];
      mapa[pid][dia].push({
        inicioMin: paraMinutos(linha.horario_inicio.substring(0, 5)),
        fimMin: paraMinutos(linha.horario_fim.substring(0, 5)),
      });
    });

    Object.values(mapa).forEach((porDia) => {
      Object.values(porDia).forEach((blocos) => blocos.sort((a, b) => a.inicioMin - b.inicioMin));
    });
  } catch (erro) {
    console.error('Erro ao buscar horários dos profissionais:', erro);
  }
  return mapa;
};

// Blocos de trabalho de UM profissional num dia específico, já aplicando o
// horário estendido (se ativo, e a data estiver no período, empurra o
// início do PRIMEIRO bloco do dia pra mais cedo, igual ao app original —
// nunca mexe no fim nem nos blocos seguintes).
export const getBlocosDoDiaProfissional = (profissionalId, data, horariosPorProfissional, horarioEstendido = HORARIO_ESTENDIDO_PADRAO) => {
  const diaSemana = getDiaSemana(data);
  const blocosBase = horariosPorProfissional?.[profissionalId]?.[diaSemana] || [];
  if (blocosBase.length === 0) return [];

  const blocos = blocosBase.map((b) => ({ ...b }));

  const dataStr = data.toISOString().split('T')[0];
  if (horarioEstendido?.ativo && dataDentroDoIntervalo(dataStr, horarioEstendido.dataInicio, horarioEstendido.dataFim)) {
    const abertaEstendidaMin = paraMinutos(horarioEstendido.abertura);
    if (abertaEstendidaMin < blocos[0].inicioMin) {
      blocos[0] = { ...blocos[0], inicioMin: abertaEstendidaMin };
    }
  }

  return blocos;
};

// Mesma lógica do app original (config/horarios.js): anda livremente pelos
// blocos de trabalho do dia, pulando o fim de cada intervalo já ocupado —
// buracos "torcidos" (ex: 30min sobrando entre dois agendamentos) aparecem
// como horário livre de verdade, sem precisar do modo Encaixe.
export const getSlotsLivresNoDia = (profissionalId, data, duracaoMinutos = 60, intervalosOcupados = [], horariosPorProfissional = {}, horarioEstendido = HORARIO_ESTENDIDO_PADRAO) => {
  const blocos = getBlocosDoDiaProfissional(profissionalId, data, horariosPorProfissional, horarioEstendido);
  if (blocos.length === 0) return [];

  const ocupadosOrdenados = [...intervalosOcupados].sort((a, b) => a.inicioMin - b.inicioMin);

  const slots = [];
  blocos.forEach(({ inicioMin: inicioBloco, fimMin: fimBloco }) => {
    let cursor = inicioBloco;
    const ocupadosDoBloco = ocupadosOrdenados.filter(o => o.inicioMin < fimBloco && o.fimMin > inicioBloco);

    ocupadosDoBloco.forEach(o => {
      for (let m = cursor; m + duracaoMinutos <= o.inicioMin; m += duracaoMinutos) {
        slots.push(paraHHMM(m));
      }
      cursor = Math.max(cursor, o.fimMin);
    });

    for (let m = cursor; m + duracaoMinutos <= fimBloco; m += duracaoMinutos) {
      slots.push(paraHHMM(m));
    }
  });

  return slots;
};

// "Horário do dia" resumido pra UM profissional — usado pra desenhar a
// timeline (abertura/fechamento do dia = início do 1º bloco / fim do
// último). Se não trabalha nesse dia, aberto:false.
export const getHorarioDoDiaProfissional = (profissionalId, data, horariosPorProfissional, horarioEstendido = HORARIO_ESTENDIDO_PADRAO) => {
  const blocos = getBlocosDoDiaProfissional(profissionalId, data, horariosPorProfissional, horarioEstendido);
  if (blocos.length === 0) return { aberto: false, abertura: null, fechamento: null, blocos: [] };
  return {
    aberto: true,
    abertura: paraHHMM(blocos[0].inicioMin),
    fechamento: paraHHMM(blocos[blocos.length - 1].fimMin),
    blocos,
  };
};
