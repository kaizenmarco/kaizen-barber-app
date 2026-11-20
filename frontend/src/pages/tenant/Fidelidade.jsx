import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { enviarImagemTenant } from '../../config/uploadImagemTenant';
import { IDIOMA_ADMIN_PADRAO } from '../../config/traducoesAdmin';
import FidelidadeAdminPainel from '../../components/fidelidade/FidelidadeAdminPainel';
import { reduzirImagemQuadrada } from '../../components/fidelidade/reduzirImagem';

// Aba Fidelidade do painel do Kaizen Flow: Cartão Fidelidade digital da
// empresa. Cada dono define as próprias regras (começam em branco) e o
// carimbo do cartão (tesoura, logo ou imagem própria). Regras no banco: ver
// supabase/migrations/saas/20261120_cartao_fidelidade_saas.sql e seguintes.

const rpc = async (nome, args) => {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
};

function Fidelidade({ idioma, empresaId, empresa }) {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!empresaId) return undefined;
    let ativo = true;
    supabase.from('empresas').select('logo_url, logo_pequeno_url').eq('id', empresaId).maybeSingle()
      .then(({ data }) => { if (ativo) setLogoUrl(data?.logo_pequeno_url || data?.logo_url || ''); });
    return () => { ativo = false; };
  }, [empresaId]);

  const api = useMemo(() => ({
    resumo: () => rpc('fidelidade_resumo_admin', { p_empresa_id: empresaId }),
    config: async () => {
      const { data, error } = await supabase.from('config_fidelidade').select('*').eq('empresa_id', empresaId).maybeSingle();
      if (error) throw error;
      // Ainda sem config: tudo em branco, para o dono definir as regras dele.
      return data || { empresa_id: empresaId, ativo: false, selos_boas_vindas: 0, selo_estilo: 'tesoura' };
    },
    salvarConfig: async (campos) => {
      const { error } = await supabase.from('config_fidelidade')
        .upsert({ ...campos, empresa_id: empresaId, atualizado_em: new Date().toISOString() });
      if (error) throw error;
    },
    resgatar: (clienteId, marco) => rpc('fidelidade_resgatar', { p_cliente_id: clienteId, p_marco: marco }),
    tokenCliente: (clienteId) => rpc('fidelidade_token_cliente', { p_cliente_id: clienteId }),
    descontos: () => rpc('fidelidade_descontos_admin', { p_empresa_id: empresaId }),
  }), [empresaId]);

  const opcoesSelo = useMemo(() => ({
    logoUrl,
    // arquivo enviado ou URL da logo → cópia 240px no storage da empresa
    enviarImagem: async (origem) => enviarImagemTenant(empresaId, await reduzirImagemQuadrada(origem), 'fidelidade'),
  }), [logoUrl, empresaId]);

  const base = `${window.location.origin}/b/${empresa?.slug || ''}`;
  return (
    <FidelidadeAdminPainel
      api={api}
      idioma={idioma || IDIOMA_ADMIN_PADRAO}
      nomeLoja={empresa?.nome || ''}
      linkEntrada={`${base}/cartao`}
      linkCartao={(token) => `${base}/cartao/${token}`}
      opcoesSelo={opcoesSelo}
    />
  );
}

export default Fidelidade;
