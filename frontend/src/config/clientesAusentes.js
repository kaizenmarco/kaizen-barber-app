// ============================================================================
// Indicador de retenção — clientes "ausentes" (30+ dias sem um atendimento
// REALIZADO). Usado na tela dedicada ClientesAusentes.jsx (menu Mais).
//
// O mesmo limite de 30 dias é usado pelo trigger do banco que marca
// clientes.email_reativacao_enviado_em (ver public.disparar_emails_reativacao
// no Supabase) — aqui é só leitura, pra exibir a lista no Admin.
// ============================================================================

export const LIMITE_DIAS_AUSENTE = 30;

// Busca todos os clientes cujo último atendimento REALIZADO já passou de
// LIMITE_DIAS_AUSENTE dias, do mais ausente pro mais recente.
export const buscarClientesAusentes = async () => {
  try {
    const { supabase } = await import('../supabaseClient');
    const { data, error } = await supabase
      .from('agendamentos')
      .select('cliente_id, data_hora, clientes(id, nome, telefone, email, bloqueado, email_reativacao_enviado_em)')
      .eq('status', 'REALIZADO');

    if (error || !data) return [];

    const ultimoPorCliente = new Map();
    data.forEach(row => {
      if (!row.cliente_id || !row.clientes) return;
      const atual = ultimoPorCliente.get(row.cliente_id);
      if (!atual || new Date(row.data_hora) > new Date(atual.ultimoRealizado)) {
        ultimoPorCliente.set(row.cliente_id, {
          clienteId: row.cliente_id,
          nome: row.clientes.nome || '—',
          telefone: row.clientes.telefone || '',
          email: row.clientes.email || '',
          bloqueado: !!row.clientes.bloqueado,
          emailReativacaoEnviadoEm: row.clientes.email_reativacao_enviado_em || null,
          ultimoRealizado: row.data_hora,
        });
      }
    });

    const agora = Date.now();
    return Array.from(ultimoPorCliente.values())
      .map(c => ({
        ...c,
        diasAusente: Math.floor((agora - new Date(c.ultimoRealizado).getTime()) / 86400000),
        // Já foi enviado um e-mail de reativação depois do último REALIZADO?
        emailJaEnviado: !!(c.emailReativacaoEnviadoEm && new Date(c.emailReativacaoEnviadoEm) > new Date(c.ultimoRealizado)),
      }))
      .filter(c => c.diasAusente >= LIMITE_DIAS_AUSENTE)
      .sort((a, b) => b.diasAusente - a.diasAusente);
  } catch {
    return [];
  }
};
