import React, { useState } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../../config/traducoesAdmin';

// Aba "Meus Bônus": os materiais prometidos na landing do Kaizen Flow,
// liberados conforme o plano da empresa. Os PDFs ficam no bucket PRIVADO
// "bonus" do Storage — o botão pede um link temporário (createSignedUrl), e a
// política bonus_leitura_por_plano (supabase_bonus_meus_bonus.sql) só gera o
// link se o plano liberar aquele arquivo. A lista `planos` abaixo é só para
// mostrar o cadeado; quem garante o acesso é o Storage.
const BONUS = [
  { chave: 'bonus1', numero: '01', arquivo: 'bonus-1-implantacao-kaizen.pdf', planos: ['basico', 'intermediario', 'completo'] },
  { chave: 'bonus2', numero: '02', arquivo: 'bonus-2-manual-de-bolso.pdf', planos: ['intermediario', 'completo'], planoMinimo: 'Intermediário' },
  { chave: 'bonus3', numero: '03', arquivo: 'bonus-3-migracao-de-clientes.pdf', planos: ['completo'], planoMinimo: 'Completo' },
];

const LINK_VALIDO_SEGUNDOS = 300;

const estilos = {
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },
  cartao: { background: '#1a1a1a', border: '1px solid #d4af37', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  cartaoBloqueado: { borderColor: '#444', opacity: 0.75 },
  numero: { fontSize: '36px', fontWeight: 'bold', color: '#d4af37', lineHeight: 1 },
  titulo: { margin: 0, fontSize: '18px', color: '#e8e8e8' },
  descricao: { margin: 0, fontSize: '13px', color: '#aaa', lineHeight: 1.5, flex: 1 },
  bloqueado: { margin: 0, fontSize: '13px', color: '#999' },
};

function MeusBonus({ t: tProp, idioma: idiomaProp, empresa }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [baixando, setBaixando] = useState(null);
  const [erro, setErro] = useState('');

  const handleBaixar = async (bonus) => {
    setBaixando(bonus.chave);
    setErro('');
    try {
      const { data, error } = await supabase.storage
        .from('bonus')
        .createSignedUrl(bonus.arquivo, LINK_VALIDO_SEGUNDOS, { download: bonus.arquivo });
      if (error) throw error;
      window.location.href = data.signedUrl;
    } catch (err) {
      setErro(t('meusBonus.erroBaixar', { msg: err.message }));
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="page-container">
      <h2>{t('meusBonus.titulo')}</h2>
      <p style={{ color: '#999', fontSize: '14px', marginBottom: '18px' }}>{t('meusBonus.intro')}</p>

      {erro && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{erro}</p>}

      <div style={estilos.grade}>
        {BONUS.map((bonus) => {
          const liberado = bonus.planos.includes(empresa?.plano);
          return (
            <section key={bonus.chave} style={{ ...estilos.cartao, ...(liberado ? {} : estilos.cartaoBloqueado) }}>
              <div style={estilos.numero}>{bonus.numero}</div>
              <h3 style={estilos.titulo}>{liberado ? '' : '🔒 '}{t(`meusBonus.${bonus.chave}Titulo`)}</h3>
              <p style={estilos.descricao}>{t(`meusBonus.${bonus.chave}Desc`)}</p>
              {liberado ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleBaixar(bonus)}
                  disabled={baixando === bonus.chave}
                >
                  {baixando === bonus.chave ? t('meusBonus.gerandoLink') : t('meusBonus.baixar')}
                </button>
              ) : (
                <p style={estilos.bloqueado}>{t('meusBonus.bloqueado', { plano: bonus.planoMinimo })}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default MeusBonus;
