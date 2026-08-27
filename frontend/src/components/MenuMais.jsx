import React from 'react';

// Painel do botão "Mais" do menu inferior. Reúne as telas que não têm
// espaço fixo na barra (Dashboard, Profissionais, Comandas, Fidelidade,
// Ordem de Chegada) + idioma e logout — o que antes vivia espalhado na
// barra lateral longa.
function MenuMais({ itens, aoSelecionarItem, t, SeletorIdioma, perfil, sessionUser, aoSair }) {
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
