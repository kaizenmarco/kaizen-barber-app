import React, { useState } from 'react';
import { supabaseSaaS } from '../config/supabaseClientSaaS';

// Página pública de cadastro self-service: a barbearia escolhe o país (que
// define a moeda e os valores praticados nesse mercado), o plano e, se for
// o caso, quantos profissionais adicionais além do incluído no plano —
// preenche os dados e é levada direto pro checkout do Stripe. Quando o
// pagamento é confirmado, o webhook (stripe-webhook) marca a empresa como
// "ativo" automaticamente — ninguém do lado do Marco precisa fazer nada.
//
// Os valores são preço PRÓPRIO de cada mercado (não é conversão automática
// de câmbio) — Brasil e Japão têm tabelas de preço competitivas e
// independentes entre si.

const PAISES = [
  { moeda: 'brl', bandeira: '🇧🇷', label: 'Brasil (R$)' },
  { moeda: 'jpy', bandeira: '🇯🇵', label: 'Japão (¥)' },
];

const PLANOS = [
  {
    id: 'basico',
    nome: 'Básico',
    preco: { brl: 49.90, jpy: 3900 },
    permiteAdicional: true,
    destaque: false,
    itens: ['Agenda online', 'Cadastro de clientes', '1 profissional incluído'],
  },
  {
    id: 'intermediario',
    nome: 'Intermediário',
    preco: { brl: 99.90, jpy: 9900 },
    permiteAdicional: true,
    destaque: true,
    itens: ['Tudo do Básico', 'Controle de caixa', '1 profissional incluído'],
  },
  {
    id: 'completo',
    nome: 'Completo',
    preco: { brl: 169.90, jpy: 14900 },
    permiteAdicional: false,
    destaque: false,
    itens: ['Tudo do Intermediário', 'Vários profissionais incluídos', 'Relatórios completos', 'Suporte prioritário'],
  },
];

const PRECO_ADICIONAL = { brl: 9.90, jpy: 1800 };
const MAXIMO_PROFISSIONAIS_ADICIONAIS = 50;

function formatarPreco(valor, moeda) {
  if (moeda === 'jpy') return `¥${valor.toLocaleString('ja-JP')}`;
  return `R$${valor.toFixed(2).replace('.', ',')}`;
}

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', padding: '40px 20px' },
  container: { maxWidth: '820px', margin: '0 auto' },
  titulo: { fontSize: '28px', fontWeight: 'bold', color: '#d4af37', marginBottom: '6px', textAlign: 'center' },
  subtitulo: { color: '#999', textAlign: 'center', marginBottom: '36px' },
  cartao: { background: '#2d2d2d', border: '1px solid #333', borderRadius: '12px', padding: '28px', marginBottom: '28px' },
  label: { display: 'block', fontSize: '13px', color: '#ccc', marginBottom: '6px', marginTop: '16px' },
  input: { width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid #d4af37', borderRadius: '6px', color: '#e8e8e8', boxSizing: 'border-box' },
  gradePaises: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '10px' },
  cardPais: { background: '#1a1a1a', border: '2px solid #333', borderRadius: '10px', padding: '14px', cursor: 'pointer', textAlign: 'center', fontSize: '15px', transition: 'border-color 0.15s' },
  cardPaisSelecionado: { borderColor: '#d4af37' },
  gradePlanos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '10px' },
  cardPlano: { background: '#1a1a1a', border: '2px solid #333', borderRadius: '10px', padding: '20px', cursor: 'pointer', transition: 'border-color 0.15s' },
  cardPlanoSelecionado: { borderColor: '#d4af37' },
  nomePlano: { fontSize: '16px', fontWeight: 'bold', color: '#e8e8e8', marginBottom: '4px' },
  precoPlano: { fontSize: '22px', fontWeight: 'bold', color: '#d4af37', marginBottom: '12px' },
  itemPlano: { fontSize: '13px', color: '#aaa', marginBottom: '4px' },
  linhaAdicional: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' },
  inputAdicional: { width: '80px', padding: '10px', background: '#1a1a1a', border: '1px solid #d4af37', borderRadius: '6px', color: '#e8e8e8', boxSizing: 'border-box', textAlign: 'center' },
  ajudaAdicional: { fontSize: '12px', color: '#888', marginTop: '6px' },
  resumoTotal: { fontSize: '15px', color: '#ccc', marginTop: '20px', textAlign: 'right' },
  resumoTotalValor: { color: '#d4af37', fontWeight: 'bold', fontSize: '18px' },
  botao: { width: '100%', padding: '14px', background: '#d4af37', color: '#1a1a1a', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '24px' },
  botaoDesabilitado: { opacity: 0.6, cursor: 'not-allowed' },
  erro: { color: '#f87171', fontSize: '14px', marginTop: '14px' },
};

export default function Cadastro() {
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [moeda, setMoeda] = useState('brl');
  const [plano, setPlano] = useState('intermediario');
  const [profissionaisAdicionais, setProfissionaisAdicionais] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const planoSelecionado = PLANOS.find((p) => p.id === plano);
  const permiteAdicional = planoSelecionado?.permiteAdicional ?? false;
  const precoBase = planoSelecionado ? planoSelecionado.preco[moeda] : 0;
  const precoAdicionalUnitario = PRECO_ADICIONAL[moeda];
  const totalAdicionais = permiteAdicional ? profissionaisAdicionais * precoAdicionalUnitario : 0;
  const precoTotal = precoBase + totalAdicionais;

  const handleSelecionarPlano = (idPlano) => {
    setPlano(idPlano);
    // Completo já inclui vários profissionais — não faz sentido manter um
    // valor de adicionais escolhido num plano anterior.
    if (idPlano === 'completo') setProfissionaisAdicionais(0);
  };

  const handleAdicionaisChange = (valor) => {
    let numero = Number.parseInt(valor, 10);
    if (!Number.isFinite(numero) || numero < 0) numero = 0;
    numero = Math.min(numero, MAXIMO_PROFISSIONAIS_ADICIONAIS);
    setProfissionaisAdicionais(numero);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (!nomeEmpresa.trim() || !emailContato.trim()) {
      setErro('Preencha o nome da barbearia e o e-mail de contato.');
      return;
    }

    setEnviando(true);
    const { data, error } = await supabaseSaaS.functions.invoke('criar-checkout-session', {
      body: {
        nome_empresa: nomeEmpresa.trim(),
        email_contato: emailContato.trim(),
        plano,
        moeda,
        profissionais_adicionais: permiteAdicional ? profissionaisAdicionais : 0,
      },
    });
    setEnviando(false);

    if (error) {
      setErro('Não consegui iniciar o pagamento. Tente novamente em instantes.');
      console.error(error);
      return;
    }
    if (data?.erro) {
      setErro(data.erro);
      return;
    }
    if (data?.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      setErro('Resposta inesperada ao criar o checkout. Tente novamente.');
    }
  };

  return (
    <div style={estilos.pagina}>
      <div style={estilos.container}>
        <h1 style={estilos.titulo}>Kaizen Flow App — Assine agora</h1>
        <p style={estilos.subtitulo}>Escolha o país, o plano da sua barbearia e comece hoje mesmo.</p>

        <form style={estilos.cartao} onSubmit={handleSubmit}>
          <label style={estilos.label}>Nome da barbearia</label>
          <input
            style={estilos.input}
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            placeholder="Ex: Barbearia Silva"
          />

          <label style={estilos.label}>E-mail de contato</label>
          <input
            style={estilos.input}
            type="email"
            value={emailContato}
            onChange={(e) => setEmailContato(e.target.value)}
            placeholder="contato@suabarbearia.com"
          />

          <label style={estilos.label}>País / moeda</label>
          <div style={estilos.gradePaises}>
            {PAISES.map((pais) => (
              <div
                key={pais.moeda}
                style={{ ...estilos.cardPais, ...(moeda === pais.moeda ? estilos.cardPaisSelecionado : {}) }}
                onClick={() => setMoeda(pais.moeda)}
              >
                {pais.bandeira} {pais.label}
              </div>
            ))}
          </div>

          <label style={estilos.label}>Escolha o plano</label>
          <div style={estilos.gradePlanos}>
            {PLANOS.map((p) => (
              <div
                key={p.id}
                style={{ ...estilos.cardPlano, ...(plano === p.id ? estilos.cardPlanoSelecionado : {}) }}
                onClick={() => handleSelecionarPlano(p.id)}
              >
                <div style={estilos.nomePlano}>{p.nome} {p.destaque ? '★' : ''}</div>
                <div style={estilos.precoPlano}>{formatarPreco(p.preco[moeda], moeda)}/mês</div>
                {p.itens.map((item) => (
                  <div key={item} style={estilos.itemPlano}>• {item}</div>
                ))}
              </div>
            ))}
          </div>

          {permiteAdicional && (
            <>
              <label style={estilos.label}>Profissionais adicionais</label>
              <div style={estilos.linhaAdicional}>
                <input
                  type="number"
                  min="0"
                  max={MAXIMO_PROFISSIONAIS_ADICIONAIS}
                  style={estilos.inputAdicional}
                  value={profissionaisAdicionais}
                  onChange={(e) => handleAdicionaisChange(e.target.value)}
                />
                <span>× {formatarPreco(precoAdicionalUnitario, moeda)}/mês cada</span>
              </div>
              <p style={estilos.ajudaAdicional}>
                O plano {planoSelecionado.nome} já inclui 1 profissional. Some aqui quantos profissionais a mais vão usar o sistema.
              </p>
            </>
          )}

          <p style={estilos.resumoTotal}>
            Total: <span style={estilos.resumoTotalValor}>{formatarPreco(precoTotal, moeda)}/mês</span>
          </p>

          <button
            type="submit"
            style={{ ...estilos.botao, ...(enviando ? estilos.botaoDesabilitado : {}) }}
            disabled={enviando}
          >
            {enviando ? 'Redirecionando para o pagamento...' : 'Continuar para pagamento'}
          </button>

          {erro && <p style={estilos.erro}>{erro}</p>}
        </form>
      </div>
    </div>
  );
}
