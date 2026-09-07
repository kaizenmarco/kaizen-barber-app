// ============================================================================
// Reincidência de cancelamentos de última hora — versão MULTI-TENANT do
// config/reincidencias.js original. Mesma regra: "última hora" = cancelamento
// registrado pelo Admin como pedido do cliente (cancelado_por = 'cliente')
// com menos de LIMITE_ULTIMA_HORA_MIN de antecedência do horário agendado.
// RLS da tabela agendamentos já isola por empresa — não precisa filtrar
// empresa_id manualmente aqui.
// ============================================================================
import { supabase } from './supabaseClientTenant';

export const LIMITE_ULTIMA_HORA_MIN = 120;
export const LIMITE_REINCIDENTE = 3;

const ehUltimaHora = (dataHora, canceladoEm) => {
  if (!dataHora || !canceladoEm) return false;
  const diffMin = (new Date(dataHora) - new Date(canceladoEm)) / 60000;
  return diffMin < LIMITE_ULTIMA_HORA_MIN;
};

// Busca todos os clientes (desta empresa) com pelo menos 1 cancelamento de
// última hora, agrupados com a lista de ocorrências — pra uma futura tela
// Reincidentes no painel tenant.
export const buscarClientesReincidentes = async () => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('cliente_id, data_hora, cancelado_em, motivo_cancelamento, servicos:servico_id(nome), clientes(id, nome, telefone, email, bloqueado)')
      .eq('status', 'CANCELADO')
      .eq('cancelado_por', 'cliente')
      .not('cancelado_em', 'is', null);

    if (error || !data) return [];

    const porCliente = new Map();
    data.forEach(row => {
      if (!row.cliente_id || !ehUltimaHora(row.data_hora, row.cancelado_em)) return;
      if (!porCliente.has(row.cliente_id)) {
        porCliente.set(row.cliente_id, {
          clienteId: row.cliente_id,
          nome: row.clientes?.nome || '—',
          telefone: row.clientes?.telefone || '',
          email: row.clientes?.email || '',
          bloqueado: !!row.clientes?.bloqueado,
          ocorrencias: []
        });
      }
      porCliente.get(row.cliente_id).ocorrencias.push({
        dataHora: row.data_hora,
        canceladoEm: row.cancelado_em,
        motivo: row.motivo_cancelamento || '',
        servico: row.servicos?.nome || ''
      });
    });

    return Array.from(porCliente.values())
      .map(c => ({ ...c, ocorrencias: c.ocorrencias.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora)) }))
      .sort((a, b) => b.ocorrencias.length - a.ocorrencias.length);
  } catch {
    return [];
  }
};

// Conta quantos cancelamentos de última hora um cliente específico já
// acumula — usado pro aviso imediato assim que o Admin confirma mais um.
export const contarCancelamentosUltimaHora = async (clienteId) => {
  if (!clienteId) return 0;
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('data_hora, cancelado_em')
      .eq('cliente_id', clienteId)
      .eq('status', 'CANCELADO')
      .eq('cancelado_por', 'cliente')
      .not('cancelado_em', 'is', null);
    if (error || !data) return 0;
    return data.filter(row => ehUltimaHora(row.data_hora, row.cancelado_em)).length;
  } catch {
    return 0;
  }
};

// Bloquear/desbloquear é só um sinalizador manual — decisão do Admin.
export const definirClienteBloqueado = async (clienteId, bloqueado) => {
  const { error } = await supabase.from('clientes').update({ bloqueado }).eq('id', clienteId);
  if (error) throw error;
};
