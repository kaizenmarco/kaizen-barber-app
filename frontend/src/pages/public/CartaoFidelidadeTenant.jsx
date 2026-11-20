import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../config/supabaseClientTenant';
import PaginaCartao from '../../components/fidelidade/PaginaCartao';

// Cartão Fidelidade digital de cada barbearia do Kaizen Flow.
//   /b/:slug/cartao          → QR code do balcão
//   /b/:slug/cartao/:token   → cartão pessoal do cliente

function CartaoFidelidadeTenant() {
  const { slug } = useParams();
  const [nomeLoja, setNomeLoja] = useState('');
  const [logo, setLogo] = useState('');

  useEffect(() => {
    let ativo = true;
    supabase.from('empresas').select('nome, logo_url, logo_pequeno_url').eq('slug', slug).maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setNomeLoja(data?.nome || '');
        setLogo(data?.logo_pequeno_url || data?.logo_url || '');
      });
    return () => { ativo = false; };
  }, [slug]);

  const api = useMemo(() => ({
    config: async () => {
      const { data, error } = await supabase.rpc('fidelidade_config_publica', { p_slug: slug });
      if (error) throw error;
      return data;
    },
    entrar: async (nome, telefone, ref) => {
      const { data, error } = await supabase.rpc('fidelidade_entrar', {
        p_slug: slug, p_nome: nome, p_telefone: telefone, p_ref: ref || null,
      });
      if (error) throw error;
      return data;
    },
    cartao: async (token) => {
      const { data, error } = await supabase.rpc('fidelidade_cartao', { p_slug: slug, p_token: token });
      if (error) {
        if (error.code === '22P02') return null;
        throw error;
      }
      return data;
    },
  }), [slug]);

  return (
    <PaginaCartao
      api={api}
      nomeLoja={nomeLoja || ' '}
      linkAgendar={`/b/${slug}`}
      caminhoBase={`/b/${slug}/cartao`}
      chaveStorage={`kaizen_cartao_token_${slug}`}
      logoSelo={logo || undefined}
    />
  );
}

export default CartaoFidelidadeTenant;
