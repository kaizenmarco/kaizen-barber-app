import React, { useState } from 'react';
import { supabaseSaaS } from '../config/supabaseClientSaaS';
import { IDIOMAS_ADMIN, IDIOMA_ADMIN_PADRAO, idiomaAdminPorNavegador, traduzirAdmin } from '../config/traducoesAdmin';

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
//
// Idioma: detecta automaticamente pt-BR / en / ja pelo idioma do navegador
// na primeira visita; depois disso, a escolha manual (seletor no topo) tem
// prioridade e fica salva no localStorage.

const CHAVE_IDIOMA_STORAGE = 'kaizen_cadastro_idioma';

const PRECO_ADICIONAL = { brl: 9.90, jpy: 1800 };
const MAXIMO_PROFISSIONAIS_ADICIONAIS = 50;

function formatarPreco(valor, moeda) {
  if (moeda === 'jpy') return `¥${valor.toLocaleString('ja-JP')}`;
  return `R$${valor.toFixed(2).replace('.', ',')}`;
}

const estilos = {
  pagina: { minHeight: '100vh', background: '#1a1a1a', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', padding: '40px 20px' },
  container: { maxWidth: '820px', margin: '0 auto' },
  seletorIdioma: { display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' },
  botaoIdioma: { padding: '4px 10px', borderRadius: '999px', border: '1px solid #d4af37', background: 'transparent', color: '#d4af37', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' },
  botaoIdiomaAtivo: { background: '#d4af37', color: '#1a1a1a' },
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
  const [idioma, setIdioma] = useState(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_IDIOMA_STORAGE);
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
      localStorage.setItem(CHAVE_IDIOMA_STORAGE, novoIdioma);
    } catch {
      // sem localStorage, só não persiste entre sessões.
    }
  };

  const PAISES = [
    { moeda: 'brl', bandeira: '🇧🇷', label: t('cadastroSaas.paisBrasil') },
    { moeda: 'jpy', bandeira: '🇯🇵', label: t('cadastroSaas.paisJapao') },
  ];

  const PLANOS = [
    {
      id: 'basico',
      nome: t('cadastroSaas.planoBasicoNome'),
      preco: { brl: 49.90, jpy: 3900 },
      permiteAdicional: true,
      destaque: false,
      itens: [t('cadastroSaas.planoBasicoItem1'), t('cadastroSaas.planoBasicoItem2'), t('cadastroSaas.planoBasicoItem3')],
    },
    {
      id: 'intermediario',
      nome: t('cadastroSaas.planoIntermediarioNome'),
      preco: { brl: 99.90, jpy: 9900 },
      permiteAdicional: true,
      destaque: true,
      itens: [t('cadastroSaas.planoIntermediarioItem1'), t('cadastroSaas.planoIntermediarioItem2'), t('cadastroSaas.planoIntermediarioItem3')],
    },
    {
      id: 'completo',
      nome: t('cadastroSaas.planoCompletoNome'),
      preco: { brl: 169.90, jpy: 14900 },
      permiteAdicional: false,
      destaque: false,
      itens: [t('cadastroSaas.planoCompletoItem1'), t('cadastroSaas.planoCompletoItem2'), t('cadastroSaas.planoCompletoItem3'), t('cadastroSaas.planoCompletoItem4')],
    },
  ];

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [telefone, setTelefone] = useState('');
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

    if (!nomeEmpresa.trim() || !emailContato.trim() || !telefone.trim()) {
      setErro(t('cadastroSaas.erroCamposObrigatorios'));
      return;
    }

    setEnviando(true);
    const { data, error } = await supabaseSaaS.functions.invoke('criar-checkout-session', {
      body: {
        nome_empresa: nomeEmpresa.trim(),
        email_contato: emailContato.trim(),
        telefone: telefone.trim(),
        plano,
        moeda,
        profissionais_adicionais: permiteAdicional ? profissionaisAdicionais : 0,
      },
    });
    setEnviando(false);

    if (error) {
      setErro(t('cadastroSaas.erroIniciarPagamento'));
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
      setErro(t('cadastroSaas.erroRespostaInesperada'));
    }
  };

  return (
    <div style={estilos.pagina}>
      <div style={estilos.container}>
        <div style={estilos.seletorIdioma}>
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

        <h1 style={estilos.titulo}>{t('cadastroSaas.titulo')}</h1>
        <p style={estilos.subtitulo}>{t('cadastroSaas.subtitulo')}</p>

        <form style={estilos.cartao} onSubmit={handleSubmit}>
          <label style={estilos.label}>{t('cadastroSaas.nomeBarbearia')}</label>
          <input
            style={estilos.input}
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            placeholder={t('cadastroSaas.nomeBarbeariaPlaceholder')}
          />

          <label style={estilos.label}>{t('cadastroSaas.emailContato')}</label>
          <input
            style={estilos.input}
            type="email"
            value={emailContato}
            onChange={(e) => setEmailContato(e.target.value)}
            placeholder={t('cadastroSaas.emailPlaceholder')}
          />

          <label style={estilos.label}>{t('cadastroSaas.telefone')}</label>
          <input
            style={estilos.input}
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder={t('cadastroSaas.telefonePlaceholder')}
          />

          <label style={estilos.label}>{t('cadastroSaas.paisMoeda')}</label>
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

          <label style={estilos.label}>{t('cadastroSaas.escolhaPlano')}</label>
          <div style={estilos.gradePlanos}>
            {PLANOS.map((p) => (
              <div
                key={p.id}
                style={{ ...estilos.cardPlano, ...(plano === p.id ? estilos.cardPlanoSelecionado : {}) }}
                onClick={() => handleSelecionarPlano(p.id)}
              >
                <div style={estilos.nomePlano}>{p.nome} {p.destaque ? '★' : ''}</div>
                <div style={estilos.precoPlano}>{formatarPreco(p.preco[moeda], moeda)}{t('cadastroSaas.porMes')}</div>
                {p.itens.map((item) => (
                  <div key={item} style={estilos.itemPlano}>• {item}</div>
                ))}
              </div>
            ))}
          </div>

          {permiteAdicional && (
            <>
              <label style={estilos.label}>{t('cadastroSaas.profissionaisAdicionais')}</label>
              <div style={estilos.linhaAdicional}>
                <input
                  type="number"
                  min="0"
                  max={MAXIMO_PROFISSIONAIS_ADICIONAIS}
                  style={estilos.inputAdicional}
                  value={profissionaisAdicionais}
                  onChange={(e) => handleAdicionaisChange(e.target.value)}
                />
                <span>{t('cadastroSaas.adicionalPorMes', { preco: formatarPreco(precoAdicionalUnitario, moeda) })}</span>
              </div>
              <p style={estilos.ajudaAdicional}>
                {t('cadastroSaas.ajudaAdicional', { plano: planoSelecionado.nome })}
              </p>
            </>
          )}

          <p style={estilos.resumoTotal}>
            {t('cadastroSaas.total')} <span style={estilos.resumoTotalValor}>{formatarPreco(precoTotal, moeda)}{t('cadastroSaas.porMes')}</span>
          </p>

          <button
            type="submit"
            style={{ ...estilos.botao, ...(enviando ? estilos.botaoDesabilitado : {}) }}
            disabled={enviando}
          >
            {enviando ? t('cadastroSaas.redirecionando') : t('cadastroSaas.continuarPagamento')}
          </button>

          {erro && <p style={estilos.erro}>{erro}</p>}
        </form>
      </div>
    </div>
  );
}
