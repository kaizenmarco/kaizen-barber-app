import React, { useEffect, useState, useCallback } from 'react';
import { supabaseSaaS } from '../config/supabaseClientSaaS';

// Painel de controle do Marco sobre TODAS as barbearias clientes do SaaS.
// Só quem tem role='super_admin' na tabela usuarios (projeto kaizen-saas)
// consegue ver isso — reforçado tanto aqui (esconde a tela) quanto no banco
// (RLS: só super_admin lê/edita a tabela empresas por completo).

const VALOR_PLANO = { basico: 5000, intermediario: 12000, completo: 20000 };
const NOME_PLANO = { basico: 'Básico', intermediario: 'Intermediário', completo: 'Completo' };
const NOME_STATUS = { trial: 'Teste', ativo: 'Ativo', inadimplente: 'Inadimplente', cancelado: 'Cancelado' };
const COR_STATUS = {
  trial: { bg: '#3b3320', cor: '#e8c86a' },
  ativo: { bg: '#1f3d2b', cor: '#4ade80' },
  inadimplente: { bg: '#3d241f', cor: '#f87171' },
  cancelado: { bg: '#2d2d2d', cor: '#888' },
};

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif' },
  centralizado: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' },
  cartaoLogin: { background: '#2d2d2d', border: '2px solid #d4af37', borderRadius: '12px', padding: '40px', maxWidth: '380px', width: '100%' },
  input: { width: '100%', padding: '12px', marginBottom: '14px', background: '#1a1a1a', border: '1px solid #d4af37', borderRadius: '6px', color: '#e8e8e8', boxSizing: 'border-box' },
  botao: { width: '100%', padding: '12px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  botaoSecundario: { padding: '8px 14px', background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  header: { padding: '20px 28px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  conteudo: { padding: '28px', maxWidth: '1100px', margin: '0 auto' },
  gradeStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' },
  cardStat: { background: '#2d2d2d', border: '1px solid #333', borderRadius: '10px', padding: '18px' },
  labelStat: { fontSize: '12px', color: '#999', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  valorStat: { fontSize: '26px', fontWeight: 'bold', color: '#d4af37' },
  tabela: { width: '100%', borderCollapse: 'collapse', background: '#2d2d2d', borderRadius: '10px', overflow: 'hidden' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: '12px', color: '#999', textTransform: 'uppercase', borderBottom: '1px solid #333' },
  td: { padding: '12px 14px', borderBottom: '1px solid #333', fontSize: '14px' },
  badge: { padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' },
  selectStatus: { background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #444', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' },
};

function TelaAcessoRestrito({ email, aoSair }) {
  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartaoLogin}>
        <h2 style={{ color: '#f87171', marginBottom: '10px' }}>Acesso restrito</h2>
        <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '20px' }}>
          A conta <strong>{email}</strong> não tem permissão de Super Admin no Kaizen Flow App.
          Se você acha que deveria ter, peça para o Marco liberar seu acesso.
        </p>
        <button style={estilos.botao} onClick={aoSair}>Sair</button>
      </div>
    </div>
  );
}

function TelaLogin() {
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
    setMensagem('Conta criada! Verifique seu e-mail se a confirmação estiver ativada, ou tente entrar.');
    setModo('login');
  };

  return (
    <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
      <div style={estilos.cartaoLogin}>
        <h2 style={{ color: '#d4af37', textAlign: 'center', marginBottom: '4px' }}>Kaizen Flow App</h2>
        <p style={{ color: '#999', textAlign: 'center', fontSize: '13px', marginBottom: '24px' }}>Painel Super Admin</p>
        <form onSubmit={modo === 'login' ? handleLogin : handleCadastro}>
          {modo === 'cadastro' && (
            <input style={estilos.input} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          )}
          <input style={estilos.input} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={estilos.input} type="password" placeholder="Senha" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required />
          {erro && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{erro}</p>}
          {mensagem && <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '12px' }}>{mensagem}</p>}
          <button type="submit" style={estilos.botao} disabled={enviando}>
            {enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          <button
            type="button"
            style={{ ...estilos.botaoSecundario, width: '100%', boxSizing: 'border-box' }}
            onClick={() => { setModo(modo === 'login' ? 'cadastro' : 'login'); setErro(''); setMensagem(''); }}
          >
            {modo === 'login' ? 'Primeira vez? Criar conta' : 'Já tenho conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PainelEmpresas({ perfil, aoSair }) {
  const [empresas, setEmpresas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvandoId, setSalvandoId] = useState(null);

  const carregarEmpresas = useCallback(async () => {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabaseSaaS
      .from('empresas')
      .select('id, nome, email_contato, plano, status, criado_em, stripe_subscription_id')
      .order('criado_em', { ascending: false });
    if (error) setErro(error.message);
    else setEmpresas(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  const mudarStatus = async (empresaId, novoStatus) => {
    setSalvandoId(empresaId);
    const { error } = await supabaseSaaS.from('empresas').update({ status: novoStatus }).eq('id', empresaId);
    if (error) {
      alert('Não consegui salvar: ' + error.message);
    } else {
      setEmpresas((atual) => atual.map((emp) => (emp.id === empresaId ? { ...emp, status: novoStatus } : emp)));
    }
    setSalvandoId(null);
  };

  const total = empresas.length;
  const ativas = empresas.filter((e) => e.status === 'ativo').length;
  const trial = empresas.filter((e) => e.status === 'trial').length;
  const inadimplentes = empresas.filter((e) => e.status === 'inadimplente').length;
  const mrr = empresas
    .filter((e) => e.status === 'ativo')
    .reduce((soma, e) => soma + (VALOR_PLANO[e.plano] || 0), 0);

  return (
    <div style={estilos.pagina}>
      <header style={estilos.header}>
        <div>
          <strong style={{ color: '#d4af37', fontSize: '18px' }}>Kaizen Flow App · Super Admin</strong>
          <div style={{ color: '#999', fontSize: '13px' }}>{perfil?.nome || perfil?.email}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={estilos.botaoSecundario} onClick={carregarEmpresas}>Atualizar</button>
          <button style={estilos.botaoSecundario} onClick={aoSair}>Sair</button>
        </div>
      </header>

      <div style={estilos.conteudo}>
        <div style={estilos.gradeStats}>
          <div style={estilos.cardStat}>
            <div style={estilos.labelStat}>Empresas</div>
            <div style={estilos.valorStat}>{total}</div>
          </div>
          <div style={estilos.cardStat}>
            <div style={estilos.labelStat}>Ativas</div>
            <div style={{ ...estilos.valorStat, color: '#4ade80' }}>{ativas}</div>
          </div>
          <div style={estilos.cardStat}>
            <div style={estilos.labelStat}>Em teste</div>
            <div style={{ ...estilos.valorStat, color: '#e8c86a' }}>{trial}</div>
          </div>
          <div style={estilos.cardStat}>
            <div style={estilos.labelStat}>Inadimplentes</div>
            <div style={{ ...estilos.valorStat, color: '#f87171' }}>{inadimplentes}</div>
          </div>
          <div style={estilos.cardStat}>
            <div style={estilos.labelStat}>MRR estimado</div>
            <div style={estilos.valorStat}>¥{mrr.toLocaleString('pt-BR')}</div>
          </div>
        </div>

        {erro && <p style={{ color: '#f87171', marginBottom: '16px' }}>Erro ao carregar: {erro}</p>}

        {carregando ? (
          <p style={{ color: '#999' }}>Carregando empresas...</p>
        ) : empresas.length === 0 ? (
          <div style={{ ...estilos.cardStat, textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#999', marginBottom: '4px' }}>Nenhuma empresa cadastrada ainda.</p>
            <p style={{ color: '#666', fontSize: '13px' }}>
              Assim que o onboarding estiver pronto e a primeira barbearia assinar, ela aparece aqui.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={estilos.tabela}>
              <thead>
                <tr>
                  <th style={estilos.th}>Empresa</th>
                  <th style={estilos.th}>E-mail</th>
                  <th style={estilos.th}>Plano</th>
                  <th style={estilos.th}>Status</th>
                  <th style={estilos.th}>Desde</th>
                  <th style={estilos.th}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => {
                  const cor = COR_STATUS[empresa.status] || COR_STATUS.cancelado;
                  return (
                    <tr key={empresa.id}>
                      <td style={estilos.td}>{empresa.nome}</td>
                      <td style={estilos.td}>{empresa.email_contato}</td>
                      <td style={estilos.td}>{NOME_PLANO[empresa.plano] || empresa.plano}</td>
                      <td style={estilos.td}>
                        <span style={{ ...estilos.badge, background: cor.bg, color: cor.cor }}>
                          {NOME_STATUS[empresa.status] || empresa.status}
                        </span>
                      </td>
                      <td style={estilos.td}>{new Date(empresa.criado_em).toLocaleDateString('pt-BR')}</td>
                      <td style={estilos.td}>
                        <select
                          style={estilos.selectStatus}
                          value={empresa.status}
                          disabled={salvandoId === empresa.id}
                          onChange={(e) => mudarStatus(empresa.id, e.target.value)}
                        >
                          {Object.keys(NOME_STATUS).map((s) => (
                            <option key={s} value={s}>{NOME_STATUS[s]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SuperAdmin() {
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);

  useEffect(() => {
    supabaseSaaS.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregandoSessao(false);
    });
    const { data: listener } = supabaseSaaS.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setPerfil(null); return; }
    let cancelado = false;
    setCarregandoPerfil(true);
    supabaseSaaS
      .from('usuarios')
      .select('nome, email, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        setPerfil(data || { email: session.user.email, role: 'admin' });
        setCarregandoPerfil(false);
      });
    return () => { cancelado = true; };
  }, [session]);

  const handleSair = async () => {
    await supabaseSaaS.auth.signOut();
  };

  if (carregandoSessao || (session && carregandoPerfil)) {
    return (
      <div style={{ ...estilos.pagina, ...estilos.centralizado }}>
        <p style={{ color: '#d4af37' }}>Carregando...</p>
      </div>
    );
  }

  if (!session) return <TelaLogin />;

  if (perfil?.role !== 'super_admin') {
    return <TelaAcessoRestrito email={session.user.email} aoSair={handleSair} />;
  }

  return <PainelEmpresas perfil={perfil} aoSair={handleSair} />;
}

export default SuperAdmin;
