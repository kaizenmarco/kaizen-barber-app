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

// Intervalo de almoço padrão. Cada profissional pode ter o seu (colunas
// horario_almoco_inicio/fim em profissionais, editável em Profissionais no
// Admin) — este valor só é usado enquanto o horário individual não carrega
// ou se ele não existir.
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

// ----------------------------------------------------------------------------
// Horário semanal individual de cada profissional (tabela
// horario_semanal_profissional). Só existe linha pros dias em que o
// profissional NÃO segue o horário do salão — ex.: Marco fecha domingo à
// tarde (domingo 09:00–12:45) ou não atende num dia (aberto = false).
// Formato devolvido: { [uuid]: { [0-6 (0 = domingo)]: { aberto, abertura, fechamento } } }
// ----------------------------------------------------------------------------
export const buscarHorariosSemanais = async () => {
  const { data, error } = await supabase
    .from('horario_semanal_profissional')
    .select('profissional_id, dia_semana, aberto, abertura, fechamento');
  if (error) {
    console.error('Erro ao buscar horários individuais:', error);
    return {};
  }
  const mapa = {};
  (data || []).forEach(r => {
    if (!mapa[r.profissional_id]) mapa[r.profissional_id] = {};
    mapa[r.profissional_id][r.dia_semana] = { aberto: r.aberto, abertura: r.abertura, fechamento: r.fechamento };
  });
  return mapa;
};

// horario = { aberto, abertura, fechamento } pra gravar, ou null pra voltar
// ao horário padrão do salão naquele dia.
export const salvarHorarioSemanal = async (uuidProfissional, diaSemana, horario) => {
  if (!horario) {
    const { error } = await supabase
      .from('horario_semanal_profissional')
      .delete()
      .eq('profissional_id', uuidProfissional)
      .eq('dia_semana', diaSemana);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('horario_semanal_profissional')
    .upsert({
      profissional_id: uuidProfissional,
      dia_semana: diaSemana,
      aberto: horario.aberto,
      abertura: horario.aberto ? horario.abertura : null,
      fechamento: horario.aberto ? horario.fechamento : null,
      atualizado_em: new Date().toISOString(),
    });
  if (error) throw error;
};

export const ORDEM_DIAS_SEMANA_CHAVES = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

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
export const getHorarioDoDia = (data, horarioEstendido = HORARIO_ESTENDIDO_PADRAO, horarioSemanalProf = null) => {
  // Horário individual do profissional pra esse dia da semana (tabela
  // horario_semanal_profissional, editada em Profissionais no Admin) vale
  // no lugar do horário do salão — inclusive pra abrir num dia que o salão
  // fecha. Sem horário individual, segue o padrão abaixo.
  const individual = horarioSemanalProf?.[data.getDay()];
  if (individual) {
    return individual.aberto
      ? { aberto: true, abertura: individual.abertura, fechamento: individual.fechamento, individual: true }
      : { aberto: false, abertura: null, fechamento: null, individual: true };
  }

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

// Divide um dia nos blocos de trabalho (manhã e tarde, separados pelo
// almoço), em minutos desde 00:00. Não considera agendamentos já feitos —
// só a grade fixa de funcionamento do salão.
const getBlocosDoDia = (data, horarioEstendido = HORARIO_ESTENDIDO_PADRAO, horarioAlmoco = HORARIO_ALMOCO, horarioSemanalProf = null) => {
  const { aberto, abertura, fechamento } = getHorarioDoDia(data, horarioEstendido, horarioSemanalProf);
  if (!aberto) return [];

  const aberturaMin = paraMinutos(abertura);
  const fechamentoMin = paraMinutos(fechamento);
  const almocoInicio = paraMinutos(horarioAlmoco.inicio);
  const almocoFim = paraMinutos(horarioAlmoco.fim);

  return [
    [aberturaMin, Math.min(almocoInicio, fechamentoMin)],
    [Math.max(almocoFim, aberturaMin), fechamentoMin],
  ].filter(([inicio, fim]) => fim > inicio);
};

// Gera os horários de início possíveis para um dia, dado a duração do
// serviço, respeitando abertura/fechamento e sem cruzar o almoço.
// NÃO considera agendamentos já existentes — use getSlotsLivresNoDia para
// isso. Mantida por compatibilidade / para quando não há nada ocupado ainda.
export const getSlotsDisponiveisNoDia = (data, duracaoMinutos = 60, horarioEstendido = HORARIO_ESTENDIDO_PADRAO) =>
  getSlotsLivresNoDia(data, duracaoMinutos, [], horarioEstendido);

// Gera os horários de início realmente livres num dia, dada a duração do
// NOVO serviço e os intervalos já ocupados naquele profissional/dia
// (formato [{ inicioMin, fimMin }, ...], em minutos desde 00:00).
//
// Diferente de simplesmente "andar de duracaoMinutos em duracaoMinutos" a
// partir da abertura (o que pula por cima de buracos deixados por
// agendamentos de duração diferente — ex: dois cortes de 45min terminando
// às 10:30 "escondiam" esse horário de um corte+barba de 60min, que só
// aparecia às 11h), aqui o cursor anda livremente: pula direto para o fim
// de cada agendamento existente e continua a grade a partir dali. Assim
// buracos "torcidos" (tipo 30min sobrando) aparecem como opção real de
// horário, sem precisar do modo Encaixe.
// `horarioSemanalProf` = horário individual do profissional (de
// buscarHorariosSemanais()[uuid]); sem ele, usa o horário do salão.
export const getSlotsLivresNoDia = (data, duracaoMinutos = 60, intervalosOcupados = [], horarioEstendido = HORARIO_ESTENDIDO_PADRAO, horarioAlmoco = HORARIO_ALMOCO, horarioSemanalProf = null) => {
  const blocos = getBlocosDoDia(data, horarioEstendido, horarioAlmoco, horarioSemanalProf);
  if (blocos.length === 0) return [];

  const ocupadosOrdenados = [...intervalosOcupados].sort((a, b) => a.inicioMin - b.inicioMin);

  const slots = [];
  blocos.forEach(([inicioBloco, fimBloco]) => {
    let cursor = inicioBloco;
    const ocupadosDoBloco = ocupadosOrdenados.filter(o => o.inicioMin < fimBloco && o.fimMin > inicioBloco);

    ocupadosDoBloco.forEach(o => {
      // preenche o espaço livre antes deste agendamento, em passos do
      // tamanho do novo serviço
      for (let m = cursor; m + duracaoMinutos <= o.inicioMin; m += duracaoMinutos) {
        slots.push(paraHHMM(m));
      }
      cursor = Math.max(cursor, o.fimMin);
    });

    // espaço livre restante até o fim do bloco
    for (let m = cursor; m + duracaoMinutos <= fimBloco; m += duracaoMinutos) {
      slots.push(paraHHMM(m));
    }
  });

  return slots;
};
