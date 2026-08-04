import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import Agendamentos from './Agendamentos';
import Clientes from './Clientes';
import Profissionais from './Profissionais';
import Caixa from './Caixa';
import Comandas from './Comandas';
import Fidelidade from './Fidelidade';
import OrdemChegada from './OrdemChegada';

function AdminLogin() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(JSON.parse(localStorage.getItem('usuario')) || null);
  const [mostraLogin, setMostraLogin] = useState(!usuario);
  const [abaSelecionada, setAbaSelecionada] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const t = (chave) => {
    const traducoes = {
      'nav.agendamentos': 'Agendamentos',
      'nav.clientes': 'Clientes',
      'nav.profissionais': 'Profissionais',
      'nav.caixa': 'Caixa',
      'nav.comandas': 'Comandas',
      'nav.fidelidade': 'Fidelidade',
      'nav.ordem': 'Ordem de Chegada'
    };
    return traducoes[chave] || chave;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'marco@kaizen.com.br' && senha === '123') {
      const usuarioData = { nome: 'Marco', email };
      setUsuario(usuarioData);
      localStorage.setItem('usuario', JSON.stringify(usuarioData));
      setMostraLogin(false);
      setAbaSelecionada('dashboard');
    } else {
      alert('❌ Email ou senha incorretos!');
    }
  };

  const handleLogout = () => {
    setUsuario(null);
    localStorage.removeItem('usuario');
    setEmail('');
    setSenha('');
    setMostraLogin(true);
  };

  // Tela de Login
  if (!usuario || mostraLogin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)'
      }}>
        <div style={{
          background: '#2d2d2d',
          border: '2px solid #d4af37',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '30px' }}>
            🔐 Login Admin
          </h2>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '15px',
                background: '#1a1a1a',
                border: '1px solid #d4af37',
                borderRadius: '6px',
                color: '#e8e8e8',
                boxSizing: 'border-box'
              }}
              required
            />
            <input
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '20px',
                background: '#1a1a1a',
                border: '1px solid #d4af37',
                borderRadius: '6px',
                color: '#e8e8e8',
                boxSizing: 'border-box'
              }}
              required
            />
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: '#d4af37',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginBottom: '15px'
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                width: '100%',
                padding: '12px',
                background: '#404040',
                color: '#d4af37',
                border: '1px solid #d4af37',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Voltar para Página Pública
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard Admin
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a1a' }}>
      {/* Sidebar */}
      <aside style={{
        width: '250px',
        background: '#1a1a1a',
        borderRight: '2px solid #d4af37',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h2 style={{ color: '#d4af37', marginBottom: '10px' }}>🏺 Kaizen</h2>
          <p style={{ color: '#999', fontSize: '12px' }}>Admin Panel</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => setAbaSelecionada('dashboard')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'dashboard' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'dashboard' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            📊 Dashboard
          </button>

          <button
            onClick={() => setAbaSelecionada('agendamentos')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'agendamentos' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'agendamentos' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            📅 Agendamentos
          </button>

          <button
            onClick={() => setAbaSelecionada('clientes')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'clientes' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'clientes' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            👥 Clientes
          </button>

          <button
            onClick={() => setAbaSelecionada('profissionais')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'profissionais' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'profissionais' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            💈 Profissionais
          </button>

          <button
            onClick={() => setAbaSelecionada('caixa')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'caixa' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'caixa' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            💰 Caixa
          </button>

          <button
            onClick={() => setAbaSelecionada('comandas')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'comandas' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'comandas' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            📋 Comandas
          </button>

          <button
            onClick={() => setAbaSelecionada('fidelidade')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'fidelidade' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'fidelidade' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🎁 Fidelidade
          </button>

          <button
            onClick={() => setAbaSelecionada('ordem')}
            style={{
              padding: '12px',
              background: abaSelecionada === 'ordem' ? '#d4af37' : '#2d2d2d',
              color: abaSelecionada === 'ordem' ? '#1a1a1a' : '#d4af37',
              border: '1px solid #d4af37',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            📍 Ordem de Chegada
          </button>

          <div style={{ borderTop: '1px solid #d4af37', marginTop: '20px', paddingTop: '20px' }}>
            <p style={{ color: '#999', fontSize: '12px', marginBottom: '10px' }}>
              Logado como: <strong>{usuario.nome}</strong>
            </p>
            <button
              onClick={() => {
                handleLogout();
                navigate('/');
              }}
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
              🚪 Logout
            </button>
          </div>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {abaSelecionada === 'dashboard' && <Dashboard />}
        {abaSelecionada === 'agendamentos' && <Agendamentos t={t} />}
        {abaSelecionada === 'clientes' && <Clientes t={t} />}
        {abaSelecionada === 'profissionais' && <Profissionais t={t} />}
        {abaSelecionada === 'caixa' && <Caixa t={t} />}
        {abaSelecionada === 'comandas' && <Comandas t={t} />}
        {abaSelecionada === 'fidelidade' && <Fidelidade t={t} />}
        {abaSelecionada === 'ordem' && <OrdemChegada t={t} />}
      </main>
    </div>
  );
}

export default AdminLogin;