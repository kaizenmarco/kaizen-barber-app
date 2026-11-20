import React, { useMemo } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { IDIOMA_ADMIN_PADRAO } from '../../config/traducoesAdmin';
import FidelidadeAdminPainel from '../../components/fidelidade/FidelidadeAdminPainel';

// Aba Fidelidade do painel do Kaizen Flow: Cartão Fidelidade digital da
// empresa (substituiu o antigo programa de pontos). Regras no banco: ver
// supabase/migrations/saas/20261120_cartao_fidelidade_saas.sql.

const rpc = async (nome, args) => {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
};

function Fidelidade({ idioma, empresaId, empresa }) {
  const api = useMemo(() => ({
    resumo: () => rpc('fidelidade_resumo_admin', { p_empresa_id: empresaId }),
    config: async () => {
      const { data, error } = await supabase.from('config_fidelidade').select('*').eq('empresa_id', empresaId).maybeSingle();
      if (error) throw error;
      return data;
    },
    salvarConfig: async (campos) => {
      const { error } = await supabase.from('config_fidelidade')
        .upsert({ ...campos, empresa_id: empresaId, atualizado_em: new Date().toISOString() });
      if (error) throw error;
    },
    resgatar: (clienteId, marco) => rpc('fidelidade_resgatar', { p_cliente_id: clienteId, p_marco: marco }),
    tokenCliente: (clienteId) => rpc('fidelidade_token_cliente', { p_cliente_id: clienteId }),
  }), [empresaId]);

  const base = `${window.location.origin}/b/${empresa?.slug || ''}`;
  return (
    <FidelidadeAdminPainel
      api={api}
      idioma={idioma || IDIOMA_ADMIN_PADRAO}
      nomeLoja={empresa?.nome || ''}
      linkEntrada={`${base}/cartao`}
      linkCartao={(token) => `${base}/cartao/${token}`}
    />
  );
}

export default Fidelidade;
