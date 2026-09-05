import React, { useEffect, useState } from 'react';
import { suportaPush, buscarInscricaoAtual, ativarNotificacoesPush, desativarNotificacoesPush } from '../config/pushNotificacoes';

// Painel do botão "Mais" do menu inferior. Reúne as telas que não têm
// espaço fixo na barra (Dashboard, Profissionais, Comandas, Fidelidade,
// Ordem de Chegada) + idioma, notificações push e logout — o que antes
// vivia espalhado na barra lateral longa.
function MenuMais({ itens, aoSelecionarItem, t, SeletorIdioma, perfil, sessionUser, aoSair }) {
  const [inscricaoAtiva, setInscricaoAtiva] = useState(false);
  const [carregandoInscricao, setCarregandoInscricao] = useState(true);
  const [processandoPush, setProcessandoPush] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!suportaPush()) {
      setCarregandoInscricao(false);
      return;
    }
    buscarInscricaoAtual().then(inscricao => {
      if (!cancelado) {
        setInscricaoAtiva(!!inscricao);
        setCarregandoInscricao(false);
      }
    });
    return () => { cancelado = true; };
  }, []);

  const handleAtivarPush = async () => {
    setProcessandoPush(true);
    try {
      await ativarNotificacoesPush(sessionUser?.id);
      setInscricaoAtiva(true);
    } catch (erro) {
      if (erro.message === 'SEM_SUPORTE') alert(t('notificacoes.push.naoSuportado'));
      else if (erro.message === 'PERMISSAO_NEGADA') alert(t('notificacoes.push.permissaoNegada'));
      else alert(t('notificacoes.push.erro', { msg: erro.message }));
    } finally {
      setProcessandoPush(false);
    }
  };

  const handleDesativarPush = async () => {
    setProcessandoPush(true);
    try {
      await desativarNotificacoesPush();
      setInscricaoAtiva(false);
    } catch (erro) {
      alert(t('notificacoes.push.erro', { msg: erro.message }));
    } finally {
      setProcessandoPush(false);
    }
  };

  return (
    <div className="menu-mais-lista page-container">
      <h2>{t('menu.titulo')}</h2>

      <div className="menu-mais-grid">
        {itens.map(item => (
          <button
            key={item.key}
            type="button"
            className="menu-mais-card"
            onClick={() => aoSelecionarItem(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!carregandoInscricao && suportaPush() && (
        <div className="menu-mais-push-card">
          <h3 style={{ color: '#d4af37', fontSize: '14px', margin: '0 0 6px' }}>🔔 {t('notificacoes.push.titulo')}</h3>
          <p style={{ color: '#999', fontSize: '12px', margin: '0 0 10px' }}>{t('notificacoes.push.descricao')}</p>
          {inscricaoAtiva ? (
            <>
              <p style={{ color: '#4ade80', fontSize: '12px', margin: '0 0 10px' }}>{t('notificacoes.push.ativado')}</p>
              <button type="button" className="menu-mais-push-btn desativar" onClick={handleDesativarPush} disabled={processandoPush}>
                {t('notificacoes.push.desativar')}
              </button>
            </>
          ) : (
            <button type="button" className="menu-mais-push-btn" onClick={handleAtivarPush} disabled={processandoPush}>
              {processandoPush ? t('notificacoes.push.ativando') : t('notificacoes.push.ativar')}
            </button>
          )}
        </div>
      )}

      <div className="menu-mais-rodape">
        <SeletorIdioma estilo={{ marginBottom: '16px' }} />

        <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>
          {t('sidebar.logadoComo')} <strong>{perfil?.nome || sessionUser?.email}</strong>
        </p>
        <p style={{ color: '#999', fontSize: '11px', marginBottom: '14px' }}>
          {t('sidebar.acesso')} <strong>{perfil?.role === 'admin' ? t('sidebar.acessoCompleto') : t('sidebar.acessoRestrito')}</strong>
        </p>

        <button
          onClick={aoSair}
          style={{
            width: '100%',
            padding: '12px',
            background: '#f87171',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {t('sidebar.logout')}
        </button>
      </div>
    </div>
  );
}

export default MenuMais;
