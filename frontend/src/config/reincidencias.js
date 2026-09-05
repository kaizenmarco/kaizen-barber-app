// ============================================================================
// Reincidência de cancelamentos de última hora — usado tanto no aviso rápido
// exibido ao Admin logo depois de cancelar um agendamento (Agendamentos.jsx)
// quanto na tela dedicada Reincidentes.jsx (menu Mais).
//
// "Última hora" = o cliente pediu o cancelamento (o Admin registrou o motivo
// e marcou "quem cancelou = cliente") com menos de LIMITE_ULTIMA_HORA_MIN de
// antecedência do horário agendado — mesmo limite de 2h já usado na regra de
// cancelamento pelo próprio cliente no site público (ver ClientePublico.jsx).
//
// Cancelamentos feitos pelo próprio cliente direto no site público (>2h de
// antecedência) NÃO entram aqui: eles não passam pelo modal de cancelamento
// do Admin, então cancelado_por fica null — só contam cancelamentos que o
// Admin de fato registrou como pedido do cliente.
//
// import feito dentro de cada função (não no topo do arquivo) só pra evitar
// import circular, mesmo padrão de config/servicos.js.
// ============================================================================

export const LIMITE_ULTIMA_HORA_MIN = 120;
export const LIMITE_REINCIDENTE = 3;

const ehUltimaHora = (dataHora, canceladoEm) => {
  if (!dataHora || !canceladoEm) return false;
  const diffMin = (new Date(dataHora) - new Date(canceladoEm)) / 60000;
  return diffMin < LIMITE_ULTIMA_HORA_MIN;
};

// Busca todos os clientes com pelo menos 1 cancelamento de última hora,
// agrupados com a lista de ocorrências — usado na tela Reincidentes.
export const buscarClientesReincidentes = async () => {
  try {
    const { supabase } = await import('../supabaseClient');
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
    const { supabase } = await import('../supabaseClient');
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

// Bloquear/desbloquear é só um sinalizador manual (não impede novo
// agendamento automaticamente ainda) — decisão do Admin, exibido como selo
// em Clientes e na própria tela Reincidentes.
export const definirClienteBloqueado = async (clienteId, bloqueado) => {
  const { supabase } = await import('../supabaseClient');
  const { error } = await supabase.from('clientes').update({ bloqueado }).eq('id', clienteId);
  if (error) throw error;
};
