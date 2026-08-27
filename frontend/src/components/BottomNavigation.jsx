import React from 'react';

// Menu inferior fixo do Admin (estilo app de celular). Substitui a barra
// lateral longa por 4 botões sempre visíveis, iguais em todas as telas
// principais. O quarto botão ("Mais") abre um painel com o restante das
// abas (Dashboard, Profissionais, Comandas, Fidelidade, Ordem de Chegada)
// que não cabem — nem precisam caber — na barra.
const ITENS = [
  { key: 'agendamentos', icone: '📅', labelChave: 'nav.agendaCurta' },
  { key: 'caixa', icone: '💰', labelChave: 'nav.caixa' },
  { key: 'clientes', icone: '👥', labelChave: 'nav.clientesCurta' },
  { key: 'mais', icone: '☰', labelChave: 'nav.mais' },
];

function BottomNavigation({ abaAtiva, aoSelecionar, t, itemMaisEmDestaque, chavesVisiveis }) {
  // Contas com acesso restrito não veem Caixa/Clientes — filtra a barra
  // pelas chaves que o perfil realmente pode abrir, e sempre mantém "Mais".
  const itensVisiveis = chavesVisiveis
    ? ITENS.filter(item => item.key === 'mais' || chavesVisiveis.includes(item.key))
    : ITENS;

  return (
    <nav className="bottom-nav" role="navigation">
      {itensVisiveis.map(item => {
        // "Mais" fica destacado sempre que a aba ativa é uma das telas que
        // moram dentro dele (Dashboard, Profissionais, Comandas, etc.),
        // mesmo que o botão clicado não tenha sido ele diretamente.
        const ativo = item.key === 'mais'
          ? (abaAtiva === 'mais' || itemMaisEmDestaque)
          : abaAtiva === item.key;

        return (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav-item${ativo ? ' ativo' : ''}`}
            onClick={() => aoSelecionar(item.key)}
          >
            <span className="bottom-nav-icone">{item.icone}</span>
            <span className="bottom-nav-label">{t(item.labelChave)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNavigation;
