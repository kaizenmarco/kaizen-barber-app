import React, { useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO } from '../config/traducoesAdmin';
import FidelidadeAdminPainel from '../components/fidelidade/FidelidadeAdminPainel';

// Aba Fidelidade do admin da Kaizen Barber Shop: Cartão Fidelidade digital
// (substituiu o antigo programa de pontos). Regras no banco: ver
// supabase/migrations/20261120_cartao_fidelidade.sql.

// O admin roda em admin.kaizenbarbershop.com, mas o cliente precisa cair no
// site público (app.), onde "/" é o agendamento.
const origemPublica = () => (window.location.hostname.endsWith('kaizenbarbershop.com')
  ? 'https://app.kaizenbarbershop.com'
  : window.location.origin);

const rpc = async (nome, args) => {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
};

function Fidelidade({ idioma }) {
  const api = useMemo(() => ({
    resumo: () => rpc('fidelidade_resumo_admin'),
    config: async () => {
      const { data, error } = await supabase.from('config_fidelidade').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    salvarConfig: async (campos) => {
      const { error } = await supabase.from('config_fidelidade')
        .update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
    },
    resgatar: (clienteId, marco) => rpc('fidelidade_resgatar', { p_cliente_id: clienteId, p_marco: marco }),
    tokenCliente: (clienteId) => rpc('fidelidade_token_cliente', { p_cliente_id: clienteId }),
  }), []);

  const origem = origemPublica();
  return (
    <FidelidadeAdminPainel
      api={api}
      idioma={idioma || IDIOMA_ADMIN_PADRAO}
      nomeLoja="Kaizen Barber Shop"
      linkEntrada={`${origem}/cartao`}
      linkCartao={(token) => `${origem}/cartao/${token}`}
    />
  );
}

export default Fidelidade;
