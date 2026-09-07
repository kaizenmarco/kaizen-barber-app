// ============================================================================
// Promoções pausáveis/retomáveis — versão MULTI-TENANT de config/promocoes.js.
// Mesma lógica de elegibilidade do app original; a única diferença é de onde
// vem o cliente Supabase (projeto kaizen-saas, isolado por empresa via RLS)
// e o motor de horários (horariosTenant.js, que trabalha com paraMinutos por
// profissional em vez de um horário único da loja).
//
// Ao contrário do app original, aqui não existe (ainda) um trigger no banco
// que calcule conta_pontos_fidelidade automaticamente — quem grava esse valor
// no momento do agendamento é o próprio App Público (ver AgendamentoPublico.jsx),
// usando promo.pontos_fidelidade.
// ============================================================================

import { supabase } from './supabaseClientTenant';
import { paraMinutos } from './horariosTenant';

export const TIPOS_DESCONTO = {
  PRECO_FIXO: 'preco_fixo',
  PERCENTUAL: 'percentual',
};

// Busca as promoções ativas da empresa atual (a política publico_leitura_catalogo
// já isola por empresa_id — repetimos ativo=true por clareza). Se falhar
// (offline etc.), devolve lista vazia — o app segue funcionando sem promoção.
export const buscarPromocoesAtivas = async () => {
  try {
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
// pra nunca cair no dia errado por causa de fuso).
const diaSemanaDeDataStr = (dataStr) => {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0).getDay(); // 0=domingo .. 6=sábado
};

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

const NOMES_DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const formatarDiasSemanaPt = (diasSemana) =>
  (diasSemana || [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => NOMES_DIAS_PT[d])
    .join(', ');
