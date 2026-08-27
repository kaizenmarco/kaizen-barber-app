import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { IDIOMAS_ADMIN, IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';
import Dashboard from './Dashboard';
import Agendamentos from './Agendamentos';
import Clientes from './Clientes';
import Profissionais from './Profissionais';
import Caixa from './Caixa';
import Comandas from './Comandas';
import Fidelidade from './Fidelidade';
import OrdemChegada from './OrdemChegada';
import BottomNavigation from '../components/BottomNavigation';
import MenuMais from '../components/MenuMais';

// As 3 abas com espaço fixo no menu inferior. Tudo que não estiver aqui
// (Dashboard, Profissionais, Comandas, Fidelidade, Ordem de Chegada) mora
// dentro do botão "Mais" — ver components/BottomNavigation.jsx.
const CHAVES_PRIMARIAS = ['agendamentos', 'caixa', 'clientes'];

const CHAVE_IDIOMA_ADMIN_STORAGE = 'kaizen_admin_idioma';

// Cada aba diz se aparece para quem tem acesso completo (admin) e/ou
// restrito (profissional_restrito). Qualquer conta nova nasce restrita —
// só vira admin manualmente (via SQL Editor do Supabase).
const CHAVES_ABAS = [
  { key: 'dashboard', labelChave: 'nav.dashboard', admin: true, restrito: false },
  { key: 'agendamentos', labelChave: 'nav.agendamentos', admin: true, restrito: true },
  { key: 'clientes', labelChave: 'nav.clientes', admin: true, restrito: false },
  { key: 'profissionais', labelChave: 'nav.profissionais', admin: true, restrito: false },
  { key: 'caixa', labelChave: 'nav.caixa', admin: true, restrito: false },
  { key: 'comandas', labelChave: 'nav.comandas', admin: true, restrito: true },
  { key: 'fidelidade', labelChave: 'nav.fidelidade', admin: true, restrito: false },
  { key: 'ordem', labelChave: 'nav.ordem', admin: true, restrito: true },
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
  const [mostrarMais, setMostrarMais] = useState(false);

  const [idioma, setIdioma] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_IDIOMA_ADMIN_STORAGE);
      if (salvo) return salvo;
    } catch {
      // localStorage indisponível — segue com o padrão.
    }
    return IDIOMA_ADMIN_PADRAO;
  });

  const t = (chave, valores) => traduzirAdmin(idioma, chave, valores);

  const mudarIdioma = (novoIdioma) => {
    setIdioma(novoIdioma);
    try {
      localStorage.setItem(CHAVE_IDIOMA_ADMIN_STORAGE, novoIdioma);
    } catch {
      // sem localStorage, só não persiste entre sessões.
    }
  };

  const ABAS = CHAVES_ABAS.map(a => ({ ...a, label: t(a.labelChave) }));

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
  const abasPrimariasVisiveis = abasVisiveis.filter(a => CHAVES_PRIMARIAS.includes(a.key));
  const abasSecundariasVisiveis = abasVisiveis.filter(a => !CHAVES_PRIMARIAS.includes(a.key));

  useEffect(() => {
    if (abasVisiveis.length > 0 && !abasVisiveis.some(a => a.key === abaSelecionada)) {
      // Abre direto na Agenda (não no Dashboard) — é a tela que a barbearia
      // olha assim que entra no app, sem precisar rolar nem navegar.
      const padrao = abasVisiveis.find(a => a.key === 'agendamentos') || abasVisiveis[0];
      setAbaSelecionada(padrao.key);
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
      setErro(error.message === 'Invalid login credentials' ? t('login.emailOuSenhaIncorretos') : error.message);
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
    setMensagem(t('login.contaCriada'));
    setModoTela('login');
  };

  const handleEsqueciSenha = async () => {
    if (!email) {
      setErro(t('login.digiteEmailPrimeiro'));
      return;
    }
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setEnviando(false);
    if (error) {
      setErro(error.message);
    } else {
      setMensagem(t('login.linkResetEnviado'));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail('');
    setSenha('');
    setNome('');
    setModoTela('login');
  };

  const SeletorIdioma = ({ estilo }) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px', ...estilo }}>
      {IDIOMAS_ADMIN.map(op => (
        <button
          key={op.codigo}
          type="button"
          onClick={() => mudarIdioma(op.codigo)}
          style={{
            padding: '4px 10px',
            borderRadius: '999px',
            border: '1px solid #d4af37',
            background: idioma === op.codigo ? '#d4af37' : 'transparent',
            color: idioma === op.codigo ? '#1a1a1a' : '#d4af37',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          {op.rotulo}
        </button>
      ))}
    </div>
  );

  if (carregandoSessao || (session && carregandoPerfil)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#1a1a1a', color: '#d4af37' }}>
        {t('login.carregando')}
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
          <SeletorIdioma />
          <img
            src="/images/logo.jpg"
            alt="Kaizen Barber Shop"
            style={{ width: '110px', height: '110px', borderRadius: '50%', display: 'block', margin: '0 auto 20px', boxShadow: '0 0 0 1px #d4af37' }}
          />
          <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '10px' }}>
            {modoTela === 'login' ? t('login.tituloLogin') : t('login.tituloCadastro')}
          </h2>
          <p style={{ color: '#999', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>
            {modoTela === 'login' ? t('login.subtituloLogin') : t('login.subtituloCadastro')}
          </p>

          <form onSubmit={modoTela === 'login' ? handleLogin : handleCadastro}>
            {modoTela === 'cadastro' && (
              <input
                type="text"
                placeholder={t('login.nome')}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={inputStyle}
                required
              />
            )}
            <input
              type="email"
              placeholder={t('login.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              required
            />
            <input
              type="password"
              placeholder={t('login.senha')}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={inputStyle}
              minLength={6}
              required
            />

            {erro && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '15px' }}>{erro}</p>}
            {mensagem && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '15px' }}>{mensagem}</p>}

            <button type="submit" style={botaoPrimario} disabled={enviando}>
              {enviando ? t('login.aguarde') : (modoTela === 'login' ? t('login.entrar') : t('login.criarConta'))}
            </button>

            {modoTela === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={handleEsqueciSenha}
                  style={{ ...botaoSecundario, marginBottom: '10px' }}
                  disabled={enviando}
                >
                  {t('login.esqueciSenha')}
                </button>
                <button
                  type="button"
                  onClick={() => { setModoTela('cadastro'); setErro(''); setMensagem(''); }}
                  style={{ ...botaoSecundario, marginBottom: '10px' }}
                >
                  {t('login.criarUmaConta')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setModoTela('login'); setErro(''); setMensagem(''); }}
                style={{ ...botaoSecundario, marginBottom: '10px' }}
              >
                {t('login.jaTenhoConta')}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/')}
              style={botaoSecundario}
            >
              {t('login.voltarPublico')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Painel Admin: menu inferior fixo (Agenda / Caixa / Clientes / Mais) no
  // lugar da barra lateral com 8 botões — ver components/BottomNavigation.jsx
  // e components/MenuMais.jsx. "Mais" reúne Dashboard, Profissionais,
  // Comandas, Fidelidade e Ordem de Chegada, que não precisam de espaço fixo.
  const telaSecundariaAberta = !mostrarMais && !CHAVES_PRIMARIAS.includes(abaSelecionada);

  return (
    <div className="admin-shell-mobile">
      <header className="admin-header-mobile">
        <img src="/images/logo.jpg" alt="Kaizen Barber Shop" className="admin-header-logo" />
        <span className="admin-header-titulo">Kaizen · {t('sidebar.adminPanel')}</span>
        {telaSecundariaAberta && (
          <button type="button" className="admin-header-voltar" onClick={() => setMostrarMais(true)}>
            ← {t('menu.titulo')}
          </button>
        )}
      </header>

      <main className="admin-main-mobile">
        {mostrarMais ? (
          <MenuMais
            itens={abasSecundariasVisiveis}
            aoSelecionarItem={(chave) => { setAbaSelecionada(chave); setMostrarMais(false); }}
            t={t}
            SeletorIdioma={SeletorIdioma}
            perfil={perfil}
            sessionUser={session.user}
            aoSair={() => { handleLogout(); navigate('/'); }}
          />
        ) : (
          <>
            {abaSelecionada === 'dashboard' && <Dashboard t={t} idioma={idioma} />}
            {abaSelecionada === 'agendamentos' && <Agendamentos t={t} idioma={idioma} />}
            {abaSelecionada === 'clientes' && <Clientes t={t} idioma={idioma} />}
            {abaSelecionada === 'profissionais' && <Profissionais t={t} idioma={idioma} />}
            {abaSelecionada === 'caixa' && <Caixa t={t} idioma={idioma} />}
            {abaSelecionada === 'comandas' && <Comandas t={t} idioma={idioma} />}
            {abaSelecionada === 'fidelidade' && <Fidelidade t={t} idioma={idioma} />}
            {abaSelecionada === 'ordem' && <OrdemChegada t={t} idioma={idioma} />}
          </>
        )}
      </main>

      <BottomNavigation
        abaAtiva={mostrarMais ? 'mais' : abaSelecionada}
        itemMaisEmDestaque={telaSecundariaAberta}
        chavesVisiveis={abasPrimariasVisiveis.map(a => a.key)}
        t={t}
        aoSelecionar={(chave) => {
          if (chave === 'mais') {
            setMostrarMais(true);
          } else {
            setMostrarMais(false);
            setAbaSelecionada(chave);
          }
        }}
      />
    </div>
  );
}

export default AdminLogin;
