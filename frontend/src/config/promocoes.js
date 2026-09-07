// ============================================================================
// Promoções pausáveis/retomáveis (ex: Corte por ¥3.000 em vez de ¥4.000,
// toda segunda/quarta/quinta das 13:45 às 18h). Genérico o bastante pra
// qualquer outra campanha futura (Dia dos Pais, Black Friday etc.) sem
// precisar de código novo — só cadastrar em Cadastros > Promoções no Admin.
//
// A elegibilidade de pontos de fidelidade (conta_pontos_fidelidade) é
// calculada automaticamente no banco (trigger aplicar_promocao_agendamento),
// então este arquivo só cuida de: buscar promoções ativas e calcular o
// preço promocional para exibir/gravar no momento do agendamento no App
// Público — a mesma regra de "cabe no horário" já usada no banco.
// ============================================================================

import { paraMinutos } from './horarios';

export const TIPOS_DESCONTO = {
  PRECO_FIXO: 'preco_fixo',
  PERCENTUAL: 'percentual',
};

// Busca as promoções com ativo=true (a política de RLS pública já garante
// isso, mas repetimos a condição por clareza). Se falhar (offline etc.),
// devolve lista vazia — o app segue funcionando normalmente sem promoção.
export const buscarPromocoesAtivas = async () => {
  try {
    const { supabase } = await import('../supabaseClient');
    const { data, error } = await supabase
      .from('promocoes')
      .select('id, nome, descricao, servico_id, tipo_desconto, valor_desconto, dias_semana, hora_inicio, hora_fim, pontos_fidelidade, ativo, data_inicio, data_fim')
      .eq('ativo', true);

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
};

// dataStr = 'AAAA-MM-DD'. Convertida como data "de calendário" local (meio-dia
// pra nunca cair no dia errado por causa de fuso), igual ao padrão já usado
// em ClientePublico.jsx (paraDataStr).
const diaSemanaDeDataStr = (dataStr) => {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0).getDay(); // 0=domingo .. 6=sábado
};

// Mesma regra usada no trigger do banco: o horário de início tem que estar
// dentro da janela E o serviço tem que TERMINAR até o fim da janela (não só
// começar antes) — por isso "hora_fim" da promoção é o horário em que o
// último corte precisa estar concluído, não o último horário de início.
export const promocaoAplicavel = (promo, { servicoId, dataStr, horaInicio, duracaoMinutos }) => {
  if (!promo || !promo.ativo) return false;
  if (promo.servico_id && servicoId && promo.servico_id !== servicoId) return false;
  if (promo.data_inicio && dataStr < promo.data_inicio) return false;
  if (promo.data_fim && dataStr > promo.data_fim) return false;

  const diaSemana = diaSemanaDeDataStr(dataStr);
  if (!(promo.dias_semana || []).includes(diaSemana)) return false;

  const inicioMin = paraMinutos(horaInicio);
  const fimMin = inicioMin + (duracaoMinutos || 0);
  const promoInicioMin = paraMinutos((promo.hora_inicio || '00:00').substring(0, 5));
  const promoFimMin = paraMinutos((promo.hora_fim || '00:00').substring(0, 5));

  if (inicioMin < promoInicioMin) return false;
  if (fimMin > promoFimMin) return false;

  return true;
};

export const encontrarPromocaoAplicavel = (promocoes, contexto) =>
  (promocoes || []).find((p) => promocaoAplicavel(p, contexto)) || null;

export const calcularPrecoComPromocao = (precoOriginal, promo) => {
  if (!promo) return precoOriginal;
  if (promo.tipo_desconto === TIPOS_DESCONTO.PERCENTUAL) {
    return Math.max(0, Math.round(precoOriginal * (1 - Number(promo.valor_desconto) / 100)));
  }
  return Math.max(0, Number(promo.valor_desconto));
};

// Texto amigável dos dias da semana de uma promoção, no idioma pt-BR (usado
// no Admin) — o App Público usa suas próprias traduções (ver traducoes.js).
const NOMES_DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const formatarDiasSemanaPt = (diasSemana) =>
  (diasSemana || [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => NOMES_DIAS_PT[d])
    .join(', ');
