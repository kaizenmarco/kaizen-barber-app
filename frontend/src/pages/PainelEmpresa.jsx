import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseSaaS } from '../config/supabaseClientSaaS';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';
import Dashboard from './tenant/Dashboard';
import Clientes from './tenant/Clientes';
import Fidelidade from './tenant/Fidelidade';
import Aniversariantes from './tenant/Aniversariantes';
import Profissionais from './tenant/Profissionais';
import Servicos from './tenant/Servicos';

// Painel administrativo MULTI-TENANT do Kaizen Flow App — versão inicial,
// com as telas que já funcionam sem depender de cadastro de serviços /
// profissionais próprio (isso ainda vem hardcoded do app original e será
// resolvido numa próxima etapa). Agenda, Caixa, Comandas e Profissionais
// ainda não estão aqui.
//
// Login separado do /admin (que continua servindo só a barbearia do
// Marco, no projeto de produção antigo) — aqui a autenticação e os dados
// são sempre do projeto kaizen-saas, isolados por empresa via RLS.

const ABAS = [
  { key: 'dashboard', label: 'Dashboard', icone: '📊' },
  { key: 'clientes', label: 'Clientes', icone: '👥' },
  { key: 'fidelidade', label: 'Fidelidade', icone: '🎁' },
  { key: 'aniversariantes', label: 'Aniversários', icone: '🎂' },
  { key: 'profissionais', label: 'Profissionais', icone: '💈' },
  { key: 'servicos', label: 'Serviços', icone: '✂️' },
];

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif' },
  centralizado: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' },
  cartao: { background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '40px', maxWidth: '380px', width: '100%' },
  input: { width: '100%', padding: '12px', marginBottom: '14px', background: '#1a1a1a', border: '1px solid #d4af37', borderRadius: '6px', color: '#e8e8e8', boxSizing: 'border-box' },
  botao: { width: '100%', padding: '12px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  botaoSecundario: { width: '100%', padding: '12px', background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '6px', cursor: 'pointer' },
  header: { padding: '16px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  main: { paddingBottom: '76px' },
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#2d2d2d', borderTop: '1px solid #333' },
  navItem: { flex: 1, padding: '10px 4px', textAlign: 'center', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '11px' },
  navItemAtivo: { color: '#d4af37' },
  navIcone: { display: 'block', fontSize: '18px', marginBottom: '2px' },
};

function TelaCarregando() {
  return <div style={{ ...estilos.pagina, ...estilos.centralizado, color: '#d4af37' }}>Carregando...</div>;
}

function TelaAguardandoVinculo({ email, aoSair }) {
  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartao}>
        <h2 style={{ color: '#d4af37', marginBottom: '10px' }}>Conta ainda não vinculada</h2>
        <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
          A conta <strong>{email}</strong> foi criada, mas ainda não está ligada a nenhuma
          barbearia cadastrada. Isso é feito manualmente logo após a confirmação do
          pagamento — entre em contato com o suporte se estiver esperando há mais de
          algumas horas.
        </p>
        <button style={estilos.botao} onClick={aoSair}>Sair</button>
      </div>
    </div>
  );
}

function TelaAssinaturaCancelada({ empresa, aoSair }) {
  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartao}>
        <h2 style={{ color: '#f87171', marginBottom: '10px' }}>Assinatura cancelada</h2>
        <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
          O acesso da <strong>{empresa?.nome || 'sua barbearia'}</strong> foi suspenso porque a
          assinatura está cancelada{empresa?.observacao_status ? ` (${empresa.observacao_status})` : ''}.
          Renove o pagamento para voltar a usar o sistema.
        </p>
        <a href="/cadastro" style={{ ...estilos.botao, display: 'block', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
          Reativar assinatura
        </a>
        <button style={estilos.botaoSecundario} onClick={aoSair}>Sair</button>
      </div>
    </div>
  );
}

function TelaLogin() {
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
    setMensagem('Conta criada! Se pediu confirmação por e-mail, confirme e entre em seguida.');
    setModo('login');
  };

  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartao}>
        <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '4px' }}>Kaizen Flow App</h2>
        <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
          Painel da sua barbearia
        </p>
        <form onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
          {modo === 'cadastro' && (
            <input style={estilos.input} placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          )}
          <input style={estilos.input} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={estilos.input} type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />

          {erro && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '14px' }}>{erro}</p>}
          {mensagem && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '14px' }}>{mensagem}</p>}

          <button type="submit" style={estilos.botao} disabled={enviando}>
            {enviando ? 'Aguarde...' : (modo === 'login' ? 'Entrar' : 'Criar conta')}
          </button>
          <button type="button" style={estilos.botaoSecundario} onClick={() => { setModo(modo === 'login' ? 'cadastro' : 'login'); setErro(''); setMensagem(''); }}>
            {modo === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
          </button>
        </form>
        <button type="button" style={{ ...estilos.botaoSecundario, marginTop: '14px', border: 'none' }} onClick={() => navigate('/')}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}

function PainelPrincipal({ perfil, empresa, aoSair }) {
  const [abaSelecionada, setAbaSelecionada] = useState('dashboard');
  const t = (chave, valores) => traduzirAdmin(IDIOMA_ADMIN_PADRAO, chave, valores);

  return (
    <div style={estilos.pagina}>
      <header style={estilos.header}>
        <div>
          <strong style={{ color: '#d4af37' }}>{empresa?.nome || 'Kaizen Flow App'}</strong>
          <div style={{ fontSize: '12px', color: '#999' }}>{perfil.nome || perfil.email}</div>
        </div>
        <button type="button" style={{ ...estilos.botaoSecundario, width: 'auto', padding: '8px 14px', fontSize: '13px' }} onClick={aoSair}>
          Sair
        </button>
      </header>

      {empresa?.status === 'inadimplente' && (
        <div style={{ background: '#4a2b1a', color: '#fbbf24', fontSize: '13px', padding: '10px 20px', textAlign: 'center' }}>
          Pagamento pendente — regularize em breve para não perder o acesso ao sistema.
        </div>
      )}

      <main style={estilos.main}>
        {abaSelecionada === 'dashboard' && <Dashboard t={t} idioma={IDIOMA_ADMIN_PADRAO} />}
        {abaSelecionada === 'clientes' && <Clientes t={t} idioma={IDIOMA_ADMIN_PADRAO} />}
        {abaSelecionada === 'fidelidade' && <Fidelidade t={t} idioma={IDIOMA_ADMIN_PADRAO} />}
        {abaSelecionada === 'aniversariantes' && <Aniversariantes t={t} idioma={IDIOMA_ADMIN_PADRAO} />}
        {abaSelecionada === 'profissionais' && <Profissionais empresa={empresa} />}
        {abaSelecionada === 'servicos' && <Servicos empresa={empresa} />}
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

export default function PainelEmpresa() {
  const [carregando, setCarregando] = useState(true);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [empresa, setEmpresa] = useState(null);

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
          .select('nome, plano, moeda, status, profissionais_extras, observacao_status')
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

  if (carregando) return <TelaCarregando />;
  if (!session) return <TelaLogin />;
  if (!perfil) return <TelaCarregando />;
  if (!perfil.empresa_id) return <TelaAguardandoVinculo email={perfil.email} aoSair={handleSair} />;
  if (empresa?.status === 'cancelado') return <TelaAssinaturaCancelada empresa={empresa} aoSair={handleSair} />;

  return <PainelPrincipal perfil={perfil} empresa={empresa} aoSair={handleSair} />;
}
