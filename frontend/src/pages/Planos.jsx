import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

// Aba "Planos" (menu Mais) — CRUD dos planos de assinatura recorrente
// (tabela planos_assinatura + planos_assinatura_servicos). O cliente
// assina pelo site público (aba "Assinatura" em ClientePublico.jsx), que
// chama a edge function criar-checkout-assinatura usando o
// stripe_price_id_cartao configurado aqui. Esse campo precisa ser colado
// manualmente depois de criar o Price correspondente no Dashboard da
// Stripe — ver aviso na própria tela.
//
// Construído como página própria (fora de Cadastros.jsx) por segurança/
// simplicidade: Cadastros.jsx já é um componente grande e esse fluxo tem
// uma peça externa (Stripe) que os outros cadastros não têm.
function Planos({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [servicos, setServicos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [planoEditando, setPlanoEditando] = useState(null); // null = criando novo
  const [formModal, setFormModal] = useState({});

  const buscarServicos = async () => {
    const { data, error } = await supabase
      .from('servicos')
      .select('id, nome')
      .eq('eh_pacote', false)
      .eq('ativo', true)
      .order('nome');
    if (error) {
      alert(t('planos.erroCarregar', { msg: error.message }));
      return;
    }
    setServicos(data || []);
  };

  const buscarPlanos = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('planos_assinatura')
        .select('id, nome, descricao, preco, periodo, ativo, stripe_price_id_cartao, planos_assinatura_servicos(servico_id)')
        .order('nome');
      if (error) throw error;
      setPlanos((data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao || '',
        preco: row.preco != null ? Number(row.preco) : 0,
        periodo: row.periodo,
        ativo: row.ativo !== false,
        stripePriceId: row.stripe_price_id_cartao || '',
        servicoIds: (row.planos_assinatura_servicos || []).map(s => s.servico_id)
      })));
    } catch (error) {
      alert(t('planos.erroCarregar', { msg: error.message }));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscarServicos();
    buscarPlanos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNovo = () => {
    setPlanoEditando(null);
    setFormModal({ nome: '', descricao: '', preco: '', servicoIds: [], stripePriceId: '' });
    setModalAberto(true);
  };

  const abrirEditar = (plano) => {
    setPlanoEditando(plano);
    setFormModal({
      nome: plano.nome,
      descricao: plano.descricao,
      preco: String(plano.preco),
      servicoIds: plano.servicoIds,
      stripePriceId: plano.stripePriceId
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setPlanoEditando(null);
  };

  const salvar = async () => {
    const nome = (formModal.nome || '').trim();
    const preco = Number(formModal.preco);
    if (!nome) {
      alert(t('planos.nomeObrigatorio'));
      return;
    }
    if (!preco || preco <= 0) {
      alert(t('planos.precoObrigatorio'));
      return;
    }
    if ((formModal.servicoIds || []).length === 0) {
      alert(t('planos.semServicoAviso'));
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        nome,
        descricao: (formModal.descricao || '').trim() || null,
        preco,
        stripe_price_id_cartao: (formModal.stripePriceId || '').trim() || null
      };

      let planoId = planoEditando?.id;
      if (planoEditando) {
        const { error } = await supabase.from('planos_assinatura').update(payload).eq('id', planoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('planos_assinatura').insert([payload]).select('id').single();
        if (error) throw error;
        planoId = data.id;
      }

      // Sincroniza os serviços cobertos: remove tudo e reinsere a seleção
      // atual — mais simples e seguro que calcular o diff, e o volume é
      // baixo (poucos serviços por plano).
      const { error: errDel } = await supabase.from('planos_assinatura_servicos').delete().eq('plano_id', planoId);
      if (errDel) throw errDel;

      const linhas = (formModal.servicoIds || []).map(servico_id => ({ plano_id: planoId, servico_id }));
      if (linhas.length > 0) {
        const { error: errIns } = await supabase.from('planos_assinatura_servicos').insert(linhas);
        if (errIns) throw errIns;
      }

      fecharModal();
      await buscarPlanos();
    } catch (error) {
      alert(t('planos.erroSalvar', { msg: error.message }));
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (plano) => {
    const novoValor = !plano.ativo;
    if (novoValor === false && !window.confirm(t('planos.confirmarDesativar', { nome: plano.nome }))) return;
    const { error } = await supabase.from('planos_assinatura').update({ ativo: novoValor }).eq('id', plano.id);
    if (error) {
      alert(t('planos.erroSalvar', { msg: error.message }));
      return;
    }
    await buscarPlanos();
  };

  const nomeServico = (id) => servicos.find(s => s.id === id)?.nome || '?';

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>{t('planos.titulo')}</h2>
        <button
          onClick={abrirNovo}
          style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', padding: '10px 16px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          + {t('planos.novoPlano')}
        </button>
      </div>

      <p style={{ color: '#999', fontSize: '13px', background: '#2d2d2d', border: '1px solid #404040', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
        {t('planos.comoFunciona')}
      </p>

      {carregando ? (
        <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
      ) : planos.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999' }}>{t('planos.nenhum')}</p>
      ) : (
        planos.map(p => (
          <div
            key={p.id}
            style={{
              background: '#1a1a1a',
              border: `1px solid ${p.ativo ? '#404040' : '#f87171'}`,
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ color: '#e8e8e8', fontSize: '15px' }}>{p.nome}</strong>
                {!p.ativo && (
                  <span style={{ marginLeft: '8px', color: '#f87171', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f87171', borderRadius: '4px', padding: '2px 6px' }}>
                    {t('planos.inativo')}
                  </span>
                )}
                {!p.stripePriceId && (
                  <span style={{ marginLeft: '8px', color: '#f97316', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f97316', borderRadius: '4px', padding: '2px 6px' }}>
                    {t('planos.semStripeBadge')}
                  </span>
                )}
                {p.descricao && <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>{p.descricao}</div>}
              </div>
              <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '15px', whiteSpace: 'nowrap' }}>
                ¥{p.preco.toLocaleString('ja-JP')}{t('planos.porMes')}
              </span>
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
              {t('planos.servicosInclusos')}: {p.servicoIds.length > 0 ? p.servicoIds.map(nomeServico).join(', ') : '-'}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => abrirEditar(p)}
                style={{ background: 'transparent', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                ✏️ {t('comum.editar')}
              </button>
              <button
                onClick={() => toggleAtivo(p)}
                style={{ background: 'transparent', border: '1px solid #666', color: '#999', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                {p.ativo ? `🚫 ${t('planos.desativar')}` : `♻️ ${t('planos.reativar')}`}
              </button>
            </div>
          </div>
        ))
      )}

      {modalAberto && (
        <div
          onClick={fecharModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top))', overflowY: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '10px',
              padding: '24px', maxWidth: '460px', width: '100%', maxHeight: '88vh', overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ color: '#d4af37', margin: 0 }}>
                {planoEditando ? t('planos.editarPlano') : t('planos.novoPlano')}
              </h3>
              <button
                onClick={fecharModal}
                style={{ background: 'transparent', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ {t('comum.cancelar')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text" placeholder={t('planos.nomeCampo')}
                value={formModal.nome || ''} onChange={(e) => setFormModal(prev => ({ ...prev, nome: e.target.value }))}
                style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
              />
              <textarea
                placeholder={t('planos.descricaoCampo')}
                value={formModal.descricao || ''} onChange={(e) => setFormModal(prev => ({ ...prev, descricao: e.target.value }))}
                style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px', minHeight: '50px', fontFamily: 'inherit', resize: 'vertical' }}
              />

              <label style={{ fontSize: '12px', color: '#999' }}>{t('planos.precoCampo')}</label>
              <input
                type="number" placeholder="¥"
                value={formModal.preco ?? ''} onChange={(e) => setFormModal(prev => ({ ...prev, preco: e.target.value }))}
                style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px' }}
              />

              <label style={{ fontSize: '12px', color: '#999' }}>{t('planos.servicosCampo')}</label>
              <p style={{ margin: '-6px 0 0', fontSize: '11px', color: '#777' }}>{t('planos.servicosCampoAjuda')}</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {servicos.map(s => {
                  const marcado = (formModal.servicoIds || []).includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormModal(prev => {
                        const atual = prev.servicoIds || [];
                        const novo = atual.includes(s.id) ? atual.filter(id => id !== s.id) : [...atual, s.id];
                        return { ...prev, servicoIds: novo };
                      })}
                      style={{
                        padding: '8px 10px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                        border: '1px solid #d4af37',
                        background: marcado ? '#d4af37' : 'transparent',
                        color: marcado ? '#1a1a1a' : '#d4af37',
                        fontWeight: 'bold'
                      }}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>

              <label style={{ fontSize: '12px', color: '#999' }}>{t('planos.stripePriceIdCampo')}</label>
              <p style={{ margin: '-6px 0 0', fontSize: '11px', color: '#777' }}>{t('planos.stripePriceIdAjuda')}</p>
              <input
                type="text" placeholder="price_..."
                value={formModal.stripePriceId || ''} onChange={(e) => setFormModal(prev => ({ ...prev, stripePriceId: e.target.value }))}
                style={{ padding: '10px', background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #404040', borderRadius: '4px', fontSize: '14px', fontFamily: 'monospace' }}
              />

              <button
                onClick={salvar}
                disabled={salvando}
                style={{ background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', padding: '12px', fontWeight: 'bold', cursor: salvando ? 'wait' : 'pointer', marginTop: '8px' }}
              >
                {salvando ? t('comum.salvando') : t('comum.salvar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Planos;
