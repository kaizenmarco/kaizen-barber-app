import React, { useState } from 'react';
import './App.css';
import translations from './translations/translations.json';
import Agendamentos from './pages/Agendamentos';
import Clientes from './pages/Clientes';
import Profissionais from './pages/Profissionais';
import Caixa from './pages/Caixa';
import Comandas from './pages/Comandas';
import Fidelidade from './pages/Fidelidade';
import OrdemChegada from './pages/OrdemChegada';
import ClientePublico from './pages/ClientePublico';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [idioma, setIdioma] = useState('pt-BR');
  const [paginaAtual, setPaginaAtual] = useState('dashboard');
  const [mostraLogin, setMostraLogin] = useState(false);

  const t = (chave) => translations[idioma]?.[chave] || chave;

  const handleLogin = (e) => {
    e.preventDefault();
    if (email && senha) {
      setUsuario({ nome: 'Marco', email, role: 'ADMIN' });
      setPaginaAtual('dashboard');
    }
  };

  const handleLogout = () => {
    setUsuario(null);
    setEmail('');
    setSenha('');
    setPaginaAtual('dashboard');
    setMostraLogin(false);
  };

  // Se não está logado e quer ver a página de login
  if (!usuario && mostraLogin) {
    return (
      <div className="login-container" style={{
        backgroundImage: 'linear-gradient(rgba(26, 26, 26, 0.85), rgba(26, 26, 26, 0.85)), url(/images/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
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

          <img src="/images/logo.png" alt="Kaizen Barber Shop" className="login-logo" />
          <h1>Kaizen Barber Shop</h1>
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
            Demo: marco@kaizen.com.br / 123
          </p>

          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => setMostraLogin(false)} style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-gold)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px'
            }}>
              ← Voltar ao início
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Se não está logado, mostra a página pública
  if (!usuario) {
    return (
      <>
        <ClientePublico />
        <div style={{ textAlign: 'center', padding: '20px', background: 'var(--secondary-dark)', borderTop: '2px solid var(--accent-gold)' }}>
          <button onClick={() => setMostraLogin(true)} style={{
            background: 'var(--accent-gold)',
            color: 'var(--primary-dark)',
            border: 'none',
            padding: '12px 30px',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
            🔐 Acesso Profissional
          </button>
        </div>
      </>
    );
  }

  // Se está logado, mostra o app admin
  return (
    <div className="dashboard-container">
      <header className="header">
        <div className="header-left">
          <img src="/images/logo.png" alt="Kaizen" className="header-logo" />
          <h1>Kaizen Barber Shop</h1>
        </div>
        <div className="header-controls">
          <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className="idioma-select">
            <option value="pt-BR">🇧🇷 Português</option>
            <option value="ja">🇯🇵 日本語</option>
            <option value="en">🇺🇸 English</option>
          </select>
          <span className="usuario-info">{usuario.nome}</span>
        </div>
      </header>

      <nav className="navbar">
        <a href="#dashboard" onClick={() => setPaginaAtual('dashboard')} className={paginaAtual === 'dashboard' ? 'ativo' : ''}>
          {t('nav.dashboard')}
        </a>
        <a href="#agendamentos" onClick={() => setPaginaAtual('agendamentos')} className={paginaAtual === 'agendamentos' ? 'ativo' : ''}>
          {t('nav.agendamentos')}
        </a>
        <a href="#clientes" onClick={() => setPaginaAtual('clientes')} className={paginaAtual === 'clientes' ? 'ativo' : ''}>
          {t('nav.clientes')}
        </a>
        <a href="#profissionais" onClick={() => setPaginaAtual('profissionais')} className={paginaAtual === 'profissionais' ? 'ativo' : ''}>
          {t('nav.profissionais')}
        </a>
        <a href="#caixa" onClick={() => setPaginaAtual('caixa')} className={paginaAtual === 'caixa' ? 'ativo' : ''}>
          Caixa
        </a>
        <a href="#comandas" onClick={() => setPaginaAtual('comandas')} className={paginaAtual === 'comandas' ? 'ativo' : ''}>
          Comandas
        </a>
        <a href="#fidelidade" onClick={() => setPaginaAtual('fidelidade')} className={paginaAtual === 'fidelidade' ? 'ativo' : ''}>
          Fidelidade
        </a>
        <a href="#ordem-chegada" onClick={() => setPaginaAtual('ordem-chegada')} className={paginaAtual === 'ordem-chegada' ? 'ativo' : ''}>
          Ordem de Chegada
        </a>
        <a href="#logout" onClick={handleLogout}>
          {t('botao.sair')}
        </a>
      </nav>

      <main className="main-content">
        {paginaAtual === 'dashboard' && (
          <>
            <section className="cards-container">
              <div className="card">
                <h3>{t('dashboard.receita_hoje')}</h3>
                <p className="numero">¥25.000</p>
              </div>
              <div className="card">
                <h3>{t('dashboard.agendamentos_hoje')}</h3>
                <p className="numero">5</p>
              </div>
              <div className="card">
                <h3>{t('dashboard.profissionais_online')}</h3>
                <p className="numero">3</p>
              </div>
            </section>

            <section className="content-area">
              <h2>{t('dashboard.titulo')}</h2>
              <p>{t('dashboard.bem_vindo')}</p>
            </section>
          </>
        )}

        {paginaAtual === 'agendamentos' && <Agendamentos t={t} />}

        {paginaAtual === 'clientes' && <Clientes t={t} />}

        {paginaAtual === 'profissionais' && <Profissionais t={t} />}

        {paginaAtual === 'caixa' && <Caixa t={t} />}

        {paginaAtual === 'comandas' && <Comandas t={t} />}

        {paginaAtual === 'fidelidade' && <Fidelidade t={t} />}

        {paginaAtual === 'ordem-chegada' && <OrdemChegada t={t} />}
      </main>
    </div>
  );
}

export default App;