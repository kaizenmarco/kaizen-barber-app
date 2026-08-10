import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Dashboard from './Dashboard';
import Agendamentos from './Agendamentos';
import Clientes from './Clientes';
import Profissionais from './Profissionais';
import Caixa from './Caixa';
import Comandas from './Comandas';
import Fidelidade from './Fidelidade';
import OrdemChegada from './OrdemChegada';

// Cada aba diz se aparece para quem tem acesso completo (admin) e/ou
// restrito (profissional_restrito). Qualquer conta nova nasce restrita —
// só vira admin manualmente (via SQL Editor do Supabase).
const ABAS = [
  { key: 'dashboard', label: '📊 Dashboard', admin: true, restrito: false },
  { key: 'agendamentos', label: '📅 Agendamentos', admin: true, restrito: true },
  { key: 'clientes', label: '👥 Clientes', admin: true, restrito: false },
  { key: 'profissionais', label: '💈 Profissionais', admin: true, restrito: false },
  { key: 'caixa', label: '💰 Caixa', admin: true, restrito: false },
  { key: 'comandas', label: '📋 Comandas', admin: true, restrito: true },
  { key: 'fidelidade', label: '🎁 Fidelidade', admin: true, restrito: false },
  { key: 'ordem', label: '📍 Ordem de Chegada', admin: true, restrito: true },
];

const inputStyle = {
  width: '100%',
  padding: '12px',
  marginBottom: '15px',
  background: '#1a1a1a',
  border: '1px solid #d4af37',
  borderRadius: '6px',
  color: '#e8e8e8',
  boxSizing: 'border-box'
};

const botaoPrimario = {
  width: '100%',
  padding: '12px',
  background: '#d4af37',
  color: '#1a1a1a',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginBottom: '15px'
};

const botaoSecundario = {
  width: '100%',
  padding: '12px',
  background: '#404040',
  color: '#d4af37',
  border: '1px solid #d4af37',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer'
};

function AdminLogin() {
  const navigate = useNavigate();
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);

  const [modoTela, setModoTela] = useState('login'); // 'login' | 'cadastro'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [abaSelecionada, setAbaSelecionada] = useState(null);

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

  // Sessão do Supabase Auth: carrega a atual e escuta login/logout.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregandoSessao(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Assim que há sessão, busca o papel (role) da pessoa na tabela perfis.
  useEffect(() => {
    if (!session?.user) {
      setPerfil(null);
      return;
    }

    let cancelado = false;
    setCarregandoPerfil(true);

    const buscarPerfil = async (tentativa = 0) => {
      const { data, error } = await supabase
        .from('perfis')
        .select('nome, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelado) return;

      if (!error && data) {
        setPerfil(data);
        setCarregandoPerfil(false);
      } else if (tentativa < 3) {
        // o trigger que cria o perfil roda logo após o cadastro; se ainda
        // não tiver terminado, tenta de novo em instantes.
        setTimeout(() => buscarPerfil(tentativa + 1), 800);
      } else {
        setPerfil({ nome: session.user.email, role: 'profissional_restrito' });
        setCarregandoPerfil(false);
      }
    };

    buscarPerfil();
    return () => { cancelado = true; };
  }, [session]);

  const abasVisiveis = ABAS.filter(a => (perfil?.role === 'admin' ? a.admin : a.restrito));

  useEffect(() => {
    if (abasVisiveis.length > 0 && !abasVisiveis.some(a => a.key === abaSelecionada)) {
      setAbaSelecionada(abasVisiveis[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    }
    setEnviando(false);
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    setEnviando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    if (data.session) {
      // login automático (confirmação de e-mail desativada no projeto)
      return;
    }
    setMensagem('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
    setModoTela('login');
  };

  const handleEsqueciSenha = async () => {
    if (!email) {
      setErro('Digite seu e-mail acima primeiro, depois clique em "Esqueci minha senha".');
      return;
    }
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setEnviando(false);
    if (error) {
      setErro(error.message);
    } else {
      setMensagem('Enviamos um link de redefinição de senha para o seu e-mail.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail('');
    setSenha('');
    setNome('');
    setModoTela('login');
  };

  if (carregandoSessao || (session && carregandoPerfil)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a1a1a', color: '#d4af37' }}>
        Carregando...
      </div>
    );
  }

  // Tela de Login / Cadastro
  if (!session) {
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
          <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '10px' }}>
            {modoTela === 'login' ? '🔐 Login Admin' : '📝 Criar conta'}
          </h2>
          <p style={{ color: '#999', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>
            {modoTela === 'login'
              ? 'Entre com o e-mail e senha da sua conta.'
              : 'Toda conta nova começa com acesso restrito. Peça para promoverem sua conta a acesso completo, se precisar.'}
          </p>

          <form onSubmit={modoTela === 'login' ? handleLogin : handleCadastro}>
            {modoTela === 'cadastro' && (
              <input
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={inputStyle}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />
            <input
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={inputStyle}
              minLength={6}
              required
            />

            {erro && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '15px' }}>{erro}</p>}
            {mensagem && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '15px' }}>{mensagem}</p>}

            <button type="submit" style={botaoPrimario} disabled={enviando}>
              {enviando ? 'Aguarde...' : (modoTela === 'login' ? 'Entrar' : 'Criar conta')}
            </button>

            {modoTela === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={handleEsqueciSenha}
                  style={{ ...botaoSecundario, marginBottom: '10px' }}
                  disabled={enviando}
                >
                  Esqueci minha senha
                </button>
                <button
                  type="button"
                  onClick={() => { setModoTela('cadastro'); setErro(''); setMensagem(''); }}
                  style={{ ...botaoSecundario, marginBottom: '10px' }}
                >
                  Criar uma conta
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setModoTela('login'); setErro(''); setMensagem(''); }}
                style={{ ...botaoSecundario, marginBottom: '10px' }}
              >
                Já tenho conta
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/')}
              style={botaoSecundario}
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
    <div className="admin-shell" style={{ minHeight: '100vh', background: '#1a1a1a' }}>
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{
        background: '#1a1a1a',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h2 style={{ color: '#d4af37', marginBottom: '10px' }}>🏺 Kaizen</h2>
          <p style={{ color: '#999', fontSize: '12px' }}>Admin Panel</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {abasVisiveis.map(aba => (
            <button
              key={aba.key}
              onClick={() => setAbaSelecionada(aba.key)}
              style={{
                padding: '12px',
                background: abaSelecionada === aba.key ? '#d4af37' : '#2d2d2d',
                color: abaSelecionada === aba.key ? '#1a1a1a' : '#d4af37',
                border: '1px solid #d4af37',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {aba.label}
            </button>
          ))}

          <div style={{ borderTop: '1px solid #d4af37', marginTop: '20px', paddingTop: '20px' }}>
            <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>
              Logado como: <strong>{perfil?.nome || session.user.email}</strong>
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginBottom: '10px' }}>
              Acesso: <strong>{perfil?.role === 'admin' ? 'Completo' : 'Restrito'}</strong>
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
      <main className="admin-main" style={{ overflow: 'auto' }}>
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
