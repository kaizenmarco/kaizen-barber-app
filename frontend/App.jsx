import React, { useState } from 'react';
import './App.css';
import translations from './translations/translations.json';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [idioma, setIdioma] = useState('pt-BR');

  const t = (chave) => translations[idioma]?.[chave] || chave;

  const handleLogin = (e) => {
    e.preventDefault();
    setUsuario({ nome: 'Marco', email });
  };

  if (usuario) {
    return (
      <div className="dashboard-container">
        <header className="header">
          <h1>🏳️ Kaizen Barber Shop</h1>
          <span className="usuario-info">{usuario.nome}</span>
        </header>
        <main className="main-content">
          <div className="cards-container">
            <div className="card">
              <h3>{t('dashboard.receita_hoje')}</h3>
              <p className="numero">¥25.000</p>
            </div>
            <div className="card">
              <h3>{t('dashboard.agendamentos_hoje')}</h3>
              <p className="numero">5</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="language-selector">
          <button onClick={() => setIdioma('pt-BR')} className={idioma === 'pt-BR' ? 'ativo' : ''}>
            🇧🇷 PT
          </button>
          <button onClick={() => setIdioma('ja')} className={idioma === 'ja' ? 'ativo' : ''}>
            🇯🇵 JA
          </button>
          <button onClick={() => setIdioma('en')} className={idioma === 'en' ? 'ativo' : ''}>
            🇺🇸 EN
          </button>
        </div>

        <h1>🏳️ Kaizen Barber Shop</h1>
        <p className="subtitle">{t('login.titulo')}</p>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder={t('login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder={t('login.senha')}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <button type="submit">{t('botao.entrar')}</button>
        </form>

        <p className="demo-hint">
          Demo: marco@kaizen.com.br / qualquer senha
        </p>
      </div>
    </div>
  );
}

export default App;