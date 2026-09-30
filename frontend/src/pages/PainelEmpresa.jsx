import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseSaaS } from '../config/supabaseClientSaaS';
import { IDIOMAS_ADMIN, IDIOMA_ADMIN_PADRAO, idiomaAdminPorNavegador, traduzirAdmin } from '../config/traducoesAdmin';
import Dashboard from './tenant/Dashboard';
import Clientes from './tenant/Clientes';
import Fidelidade from './tenant/Fidelidade';
import Aniversariantes from './tenant/Aniversariantes';
import Profissionais from './tenant/Profissionais';
import Servicos from './tenant/Servicos';
import Visual from './tenant/Visual';
import HorariosProfissionais from './tenant/HorariosProfissionais';
import Agenda from './tenant/Agenda';
import Comandas from './tenant/Comandas';
import Caixa from './tenant/Caixa';

// Painel administrativo MULTI-TENANT do Kaizen Flow App — Dashboard,
// Clientes, Fidelidade, Aniversariantes, Profissionais, Serviços, Identidade
// Visual, Horário de Trabalho, Agenda, Comandas e Caixa já portados; falta
// OrdemChegada e a página pública de agendamento (slug/subdomínio).
//
// Login separado do /admin (que continua servindo só a barbearia do
// Marco, no projeto de produção antigo) — aqui a autenticação e os dados
// são sempre do projeto kaizen-saas, isolados por empresa via RLS.

const CHAVES_ABAS = [
  { key: 'dashboard', labelChave: 'nav.dashboard' },
  { key: 'clientes', labelChave: 'nav.clientes' },
  { key: 'fidelidade', labelChave: 'nav.fidelidade' },
  { key: 'aniversariantes', labelChave: 'nav.aniversariantes' },
  { key: 'profissionais', labelChave: 'nav.profissionais' },
  { key: 'servicos', labelChave: 'nav.servicos' },
  { key: 'visual', labelChave: 'nav.visual' },
  { key: 'horarios', labelChave: 'nav.horarios' },
  { key: 'agenda', labelChave: 'nav.agenda' },
  { key: 'comandas', labelChave: 'nav.comandas' },
  { key: 'caixa', labelChave: 'nav.caixa' },
];

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif' },
  centralizado: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' },
  cartao: { background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '40px', maxWidth: '380px', width: '100%' },
  input: { width: '100%', padding: '12px', marginBottom: '14px', background: '#1a1a1a', border: '1px solid #d4af37', borderRadius: '6px', color: '#e8e8e8', boxSizing: 'border-box' },
  botao: { width: '100%', padding: '12px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  botaoSecundario: { width: '100%', padding: '12px', background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '6px', cursor: 'pointer' },
  header: { padding: '16px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  seletorIdioma: { display: 'flex', justifyContent: 'center', gap: '6px', padding: '10px 0', borderBottom: '1px solid #333' },
  botaoIdioma: { padding: '4px 10px', borderRadius: '999px', border: '1px solid #d4af37', background: 'transparent', color: '#d4af37', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' },
  botaoIdiomaAtivo: { background: '#d4af37', color: '#1a1a1a' },
  main: { paddingBottom: '76px' },
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#2d2d2d', borderTop: '1px solid #333' },
  navItem: { flex: 1, padding: '10px 4px', textAlign: 'center', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '11px' },
  navItemAtivo: { color: '#d4af37' },
  navIcone: { display: 'block', fontSize: '18px', marginBottom: '2px' },
};

function SeletorIdioma({ idioma, mudarIdioma, estilo }) {
  return (
    <div style={{ ...estilos.seletorIdioma, ...estilo }}>
      {IDIOMAS_ADMIN.map((op) => (
        <button
          key={op.codigo}
          type="button"
          onClick={() => mudarIdioma(op.codigo)}
          style={{ ...estilos.botaoIdioma, ...(idioma === op.codigo ? estilos.botaoIdiomaAtivo : {}) }}
        >
          {op.rotulo}
        </button>
      ))}
    </div>
  );
}

function TelaCarregando({ t }) {
  return <div style={{ ...estilos.pagina, ...estilos.centralizado, color: '#d4af37' }}>{t('login.carregando')}</div>;
}

function TelaAguardandoVinculo({ email, aoSair, t }) {
  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartao}>
        <h2 style={{ color: '#d4af37', marginBottom: '10px' }}>{t('painel.vinculoTitulo')}</h2>
        <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
          {t('painel.vinculoCorpo', { email })}
        </p>
        <button style={estilos.botao} onClick={aoSair}>{t('painel.sair')}</button>
      </div>
    </div>
  );
}

function TelaAssinaturaCancelada({ empresa, aoSair, t }) {
  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartao}>
        <h2 style={{ color: '#f87171', marginBottom: '10px' }}>{t('painel.canceladaTitulo')}</h2>
        <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
          {t('painel.canceladaCorpo', { empresa: empresa?.nome || 'sua barbearia' })}
          {empresa?.observacao_status ? ` (${empresa.observacao_status})` : ''}
        </p>
        <a href="/cadastro" style={{ ...estilos.botao, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
          {t('painel.reativarAssinatura')}
        </a>
        <button style={estilos.botaoSecundario} onClick={aoSair}>{t('painel.sair')}</button>
      </div>
    </div>
  );
}

function TelaLogin({ idioma, mudarIdioma, t }) {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro(''); setMensagem(''); setEnviando(true);
    const { error } = await supabaseSaaS.auth.signInWithPassword({ email, password: senha });
    if (error) setErro(error.message);
    setEnviando(false);
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    setErro(''); setMensagem(''); setEnviando(true);
    const { data, error } = await supabaseSaaS.auth.signUp({
      email, password: senha, options: { data: { nome } },
    });
    setEnviando(false);
    if (error) { setErro(error.message); return; }
    if (data.session) return;
    setMensagem(t('painel.mensagemContaCriada'));
    setModo('login');
  };

  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartao}>
        <SeletorIdioma idioma={idioma} mudarIdioma={mudarIdioma} estilo={{ borderBottom: 'none', padding: 0, marginBottom: '16px' }} />
        <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '4px' }}>Kaizen Flow App</h2>
        <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
          {t('painel.subtitulo')}
        </p>
        <form onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
          {modo === 'cadastro' && (
            <input style={estilos.input} placeholder={t('login.nome')} value={nome} onChange={(e) => setNome(e.target.value)} required />
          )}
          <input style={estilos.input} type="email" placeholder={t('login.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={estilos.input} type="password" placeholder={t('login.senha')} value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />

          {erro && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '14px' }}>{erro}</p>}
          {mensagem && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '14px' }}>{mensagem}</p>}

          <button type="submit" style={estilos.botao} disabled={enviando}>
            {enviando ? t('login.aguarde') : (modo === 'login' ? t('login.entrar') : t('login.criarConta'))}
          </button>
          <button type="button" style={estilos.botaoSecundario} onClick={() => { setModo(modo === 'login' ? 'cadastro' : 'login'); setErro(''); setMensagem(''); }}>
            {modo === 'login' ? t('login.criarUmaConta') : t('login.jaTenhoConta')}
          </button>
        </form>
        <button type="button" style={{ ...estilos.botaoSecundario, marginTop: '14px', border: 'none' }} onClick={() => navigate('/')}>
          {t('painel.voltar')}
        </button>
      </div>
    </div>
  );
}

function PainelPrincipal({ perfil, empresa, aoSair, idioma, mudarIdioma, t }) {
  const [abaSelecionada, setAbaSelecionada] = useState('dashboard');
  const ABAS = CHAVES_ABAS.map((a) => ({ ...a, label: t(a.labelChave) }));

  return (
    <div style={estilos.pagina}>
      <SeletorIdioma idioma={idioma} mudarIdioma={mudarIdioma} />
      <header style={estilos.header}>
        <div>
          <strong style={{ color: '#d4af37' }}>{empresa?.nome || 'Kaizen Flow App'}</strong>
          <div style={{ fontSize: '12px', color: '#999' }}>{perfil.nome || perfil.email}</div>
        </div>
        <button type="button" style={{ ...estilos.botaoSecundario, width: 'auto', padding: '8px 14px', fontSize: '13px' }} onClick={aoSair}>
          {t('painel.sair')}
        </button>
      </header>

      {empresa?.status === 'inadimplente' && (
        <div style={{ background: '#4a2b1a', color: '#fbbf24', fontSize: '13px', padding: '10px 20px', textAlign: 'center' }}>
          {t('painel.pagamentoPendente')}
        </div>
      )}

      <main style={estilos.main}>
        {abaSelecionada === 'dashboard' && <Dashboard t={t} idioma={idioma} empresaId={perfil.empresa_id} />}
        {abaSelecionada === 'clientes' && <Clientes t={t} idioma={idioma} empresaId={perfil.empresa_id} />}
        {abaSelecionada === 'fidelidade' && <Fidelidade t={t} idioma={idioma} empresaId={perfil.empresa_id} />}
        {abaSelecionada === 'aniversariantes' && <Aniversariantes t={t} idioma={idioma} empresaId={perfil.empresa_id} />}
        {abaSelecionada === 'profissionais' && <Profissionais empresa={empresa} empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
        {abaSelecionada === 'servicos' && <Servicos empresa={empresa} empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
        {abaSelecionada === 'visual' && <Visual empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
        {abaSelecionada === 'horarios' && <HorariosProfissionais empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
        {abaSelecionada === 'agenda' && <Agenda empresa={empresa} empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
        {abaSelecionada === 'comandas' && <Comandas empresa={empresa} empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
        {abaSelecionada === 'caixa' && <Caixa empresa={empresa} empresaId={perfil.empresa_id} idioma={idioma} t={t} />}
      </main>

      <nav style={estilos.nav}>
        {ABAS.map((aba) => (
          <button
            key={aba.key}
            type="button"
            style={{ ...estilos.navItem, ...(abaSelecionada === aba.key ? estilos.navItemAtivo : {}) }}
            onClick={() => setAbaSelecionada(aba.key)}
          >
            <span style={estilos.navIcone}>{aba.icone}</span>
            {aba.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

const CHAVE_IDIOMA_PAINEL_STORAGE = 'kaizen_painel_idioma';

export default function PainelEmpresa() {
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [empresa, setEmpresa] = useState(null);

  // Idioma: detecta automaticamente pt-BR / en / ja pelo idioma do
  // navegador na primeira visita; depois disso, a escolha manual (seletor
  // no topo) tem prioridade e fica salva no localStorage. Vale tanto pra
  // tela de login quanto pro painel depois de entrar.
  const [idioma, setIdioma] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_IDIOMA_PAINEL_STORAGE);
      if (salvo) return salvo;
    } catch {
      // localStorage indisponível — segue pra detecção pelo navegador.
    }
    return idiomaAdminPorNavegador() || IDIOMA_ADMIN_PADRAO;
  });
  const t = (chave, valores) => traduzirAdmin(idioma, chave, valores);
  const mudarIdioma = (novoIdioma) => {
    setIdioma(novoIdioma);
    try {
      localStorage.setItem(CHAVE_IDIOMA_PAINEL_STORAGE, novoIdioma);
    } catch {
      // sem localStorage, só não persiste entre sessões.
    }
  };

  useEffect(() => {
    supabaseSaaS.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: listener } = supabaseSaaS.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setPerfil(null); setEmpresa(null); return; }

    let cancelado = false;
    (async () => {
      const { data: perfilData } = await supabaseSaaS
        .from('usuarios')
        .select('nome, email, role, empresa_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelado) return;
      setPerfil(perfilData);

      if (perfilData?.empresa_id) {
        const { data: empresaData } = await supabaseSaaS
          .from('empresas')
          .select('id, nome, plano, moeda, status, profissionais_extras, observacao_status')
          .eq('id', perfilData.empresa_id)
          .maybeSingle();
        if (!cancelado) setEmpresa(empresaData);
      }
    })();

    return () => { cancelado = true; };
  }, [session]);

  const handleSair = async () => {
    await supabaseSaaS.auth.signOut();
  };

  if (carregando) return <TelaCarregando t={t} />;
  if (!session) return <TelaLogin idioma={idioma} mudarIdioma={mudarIdioma} t={t} />;
  if (!perfil) return <TelaCarregando t={t} />;
  if (!perfil.empresa_id) return <TelaAguardandoVinculo email={perfil.email} aoSair={handleSair} t={t} />;
  if (empresa?.status === 'cancelado') return <TelaAssinaturaCancelada empresa={empresa} aoSair={handleSair} t={t} />;

  return <PainelPrincipal perfil={perfil} empresa={empresa} aoSair={handleSair} idioma={idioma} mudarIdioma={mudarIdioma} t={t} />;
}
