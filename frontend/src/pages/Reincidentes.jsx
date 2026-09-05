import React, { useState, useEffect } from 'react';
import { IDIOMA_ADMIN_PADRAO, LOCALE_POR_IDIOMA_ADMIN, traduzirAdmin } from '../config/traducoesAdmin';
import { buscarClientesReincidentes, definirClienteBloqueado, LIMITE_REINCIDENTE } from '../config/reincidencias';

// Aba "Reincidentes" (menu Mais): lista clientes que já pediram cancelamento
// em cima da hora (menos de 2h de antecedência) e o Admin registrou isso ao
// cancelar pelo modal de Agendamentos. A partir de 3 ocorrências (ver
// LIMITE_REINCIDENTE), o card fica destacado em vermelho — sinal pra decidir
// se vale a pena continuar atendendo esse cliente. O botão "Bloquear" só
// marca um selo (clientes.bloqueado), exibido aqui e em Clientes; não impede
// agendamento novo automaticamente ainda.
function Reincidentes({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const locale = LOCALE_POR_IDIOMA_ADMIN[idioma] || 'pt-BR';

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoId, setAtualizandoId] = useState(null);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = async () => {
    setCarregando(true);
    try {
      const dados = await buscarClientesReincidentes();
      setClientes(dados);
    } finally {
      setCarregando(false);
    }
  };

  const handleToggleBloqueado = async (cliente) => {
    const novoValor = !cliente.bloqueado;
    const mensagemConfirmacao = novoValor
      ? t('reincidentes.confirmarBloquear', { nome: cliente.nome })
      : t('reincidentes.confirmarDesbloquear', { nome: cliente.nome });
    if (!window.confirm(mensagemConfirmacao)) return;

    setAtualizandoId(cliente.clienteId);
    try {
      await definirClienteBloqueado(cliente.clienteId, novoValor);
      setClientes(prev => prev.map(c => (c.clienteId === cliente.clienteId ? { ...c, bloqueado: novoValor } : c)));
    } catch (error) {
      alert(t('reincidentes.erroAtualizar', { msg: error.message }));
    } finally {
      setAtualizandoId(null);
    }
  };

  const formatarDataHora = (iso) => new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page-container">
      <h2>{t('reincidentes.titulo')}</h2>

      <p style={{ color: '#999', fontSize: '13px', background: '#2d2d2d', border: '1px solid #404040', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
        {t('reincidentes.comoFunciona', { n: LIMITE_REINCIDENTE })}
      </p>

      {carregando ? (
        <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
      ) : clientes.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999' }}>{t('reincidentes.nenhum')}</p>
      ) : (
        clientes.map(c => {
          const destaque = c.ocorrencias.length >= LIMITE_REINCIDENTE;
          return (
            <div
              key={c.clienteId}
              style={{
                background: destaque ? 'rgba(248, 113, 113, 0.12)' : '#1a1a1a',
                border: `1px solid ${destaque ? '#f87171' : '#404040'}`,
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ color: '#e8e8e8', fontSize: '15px' }}>{c.nome}</strong>
                  {c.bloqueado && (
                    <span style={{ marginLeft: '8px', color: '#f87171', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f87171', borderRadius: '4px', padding: '2px 6px' }}>
                      🚫 {t('reincidentes.bloqueado')}
                    </span>
                  )}
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                    {c.telefone && <span>📞 {c.telefone}</span>}
                    {c.telefone && c.email && <span> · </span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
                <span
                  style={{
                    color: destaque ? '#f87171' : '#d4af37',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    border: `1px solid ${destaque ? '#f87171' : '#d4af37'}`,
                    borderRadius: '6px',
                    padding: '4px 10px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t('reincidentes.ocorrencias', { n: c.ocorrencias.length })}
                </span>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {c.ocorrencias.map((o, idx) => (
                  <div key={idx} style={{ fontSize: '12px', color: '#999', borderTop: idx > 0 ? '1px solid #333' : 'none', paddingTop: idx > 0 ? '6px' : 0 }}>
                    <span style={{ color: '#e8e8e8' }}>{formatarDataHora(o.dataHora)}</span>
                    {o.servico && <span> — {o.servico}</span>}
                    {o.motivo && <div style={{ color: '#999', fontStyle: 'italic', marginTop: '2px' }}>"{o.motivo}"</div>}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => handleToggleBloqueado(c)}
                  disabled={atualizandoId === c.clienteId}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${c.bloqueado ? '#4ade80' : '#f87171'}`,
                    color: c.bloqueado ? '#4ade80' : '#f87171',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: atualizandoId === c.clienteId ? 'wait' : 'pointer'
                  }}
                >
                  {c.bloqueado ? t('reincidentes.desbloquear') : t('reincidentes.bloquear')}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default Reincidentes;
