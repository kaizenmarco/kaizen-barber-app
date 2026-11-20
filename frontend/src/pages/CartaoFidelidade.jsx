import React from 'react';
import { supabase } from '../supabaseClient';
import PaginaCartao from '../components/fidelidade/PaginaCartao';

// Cartão Fidelidade digital da Kaizen Barber Shop.
//   app.kaizenbarbershop.com/cartao          → QR code do balcão (40% na 1ª visita)
//   app.kaizenbarbershop.com/cartao/:token   → cartão pessoal do cliente

const configParaJson = (c) => c && ({
  ativo: c.ativo,
  meta_selos: c.meta_selos,
  selo_brinde: c.selo_brinde,
  selos_boas_vindas: c.selos_boas_vindas,
  desconto_pct: c.desconto_primeira_visita_pct,
  validade_cupom_dias: c.validade_cupom_dias,
  brinde: { pt: c.brinde_pt, en: c.brinde_en, ja: c.brinde_ja },
  premio: { pt: c.premio_pt, en: c.premio_en, ja: c.premio_ja },
});

const api = {
  config: async () => {
    const { data, error } = await supabase.from('config_fidelidade').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return configParaJson(data);
  },
  entrar: async (nome, telefone, ref) => {
    const { data, error } = await supabase.rpc('fidelidade_entrar', { p_nome: nome, p_telefone: telefone, p_ref: ref || null });
    if (error) throw error;
    return data;
  },
  cartao: async (token) => {
    const { data, error } = await supabase.rpc('fidelidade_cartao', { p_token: token });
    if (error) {
      if (error.code === '22P02') return null; // token com formato inválido
      throw error;
    }
    return data;
  },
};

function CartaoFidelidade() {
  return (
    <PaginaCartao
      api={api}
      nomeLoja="Kaizen Barber Shop"
      linkAgendar="/?aba=agendar"
      caminhoBase="/cartao"
      chaveStorage="kaizen_cartao_token"
    />
  );
}

export default CartaoFidelidade;
