import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { DIAS_SEMANA_ADMIN, IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../../config/traducoesAdmin';

const COMISSAO_PADRAO = 40;

// Preço na moeda da empresa (brl/jpy) — mesmo padrão de tenant/Agenda.jsx.
// Diferente do formatarPreco usado lá, aqui SEMPRE mostra número (inclusive
// zero), porque saldo/entradas/saídas do dia zerados são um valor válido,
// não "sem preço ainda".
const formatarValor = (valor, moeda) => {
  const num = Number(valor) || 0;
  if (moeda === 'jpy') return `¥${num.toLocaleString('ja-JP')}`;
  return `R$${num.toFixed(2).replace('.', ',')}`;
};

// Segunda-feira da semana que contém `data`.
const inicioDaSemana = (data) => {
  const d = new Date(data);
  const diaSemana = d.getDay(); // 0=domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

const fimDaSemana = (data) => {
  const inicio = new Date(inicioDaSemana(data));
  inicio.setDate(inicio.getDate() + 6);
  return inicio.toISOString().split('T')[0];
};

function Caixa({ t: tProp, idioma: idiomaProp, empresa }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const diasNomes = DIAS_SEMANA_ADMIN[idioma] || DIAS_SEMANA_ADMIN['pt-BR'];
  const moeda = empresa?.moeda === 'jpy' ? 'jpy' : 'brl';

  // Plano Básico só vê o dia (abrir/fechar caixa, lançar e listar movimentos
  // de hoje) — histórico dos últimos 90 dias, fechamento mensal e comissão
  // por profissional são recursos do Intermediário/Completo. Em vez de
  // simplesmente esconder, mostramos uma oferta (popup) quando o dono do
  // Básico tenta acessar — decisão de Marco em 2026-09-07.
  const planoBasico = empresa?.plano === 'basico';
  const [popupUpgradeAberto, setPopupUpgradeAberto] = useState(false);

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const mesAtualStr = hojeStr.substring(0, 7); // AAAA-MM

  const [carregando, setCarregando] = useState(true);
  const [caixaHoje, setCaixaHoje] = useState(null);
  const [movimentacoesHoje, setMovimentacoesHoje] = useState([]);
  const [movimentacoesRecentes, setMovimentacoesRecentes] = useState([]); // últimos 90 dias
  const [diasHistorico, setDiasHistorico] = useState([]); // caixa_dias últimos 90 dias
  const [profissionaisLista, setProfissionaisLista] = useState([]); // {uuid, nome, percentual}

  const [saldoInicialInput, setSaldoInicialInput] = useState('0');
  const [novaMovimentacao, setNovaMovimentacao] = useState({ tipo: 'entrada', descricao: '', valor: '' });
  const [dataExpandida, setDataExpandida] = useState(null);

  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr);
  const [movimentacoesDoMes, setMovimentacoesDoMes] = useState([]);
  const [carregandoMes, setCarregandoMes] = useState(false);

  const caixaAberto = caixaHoje?.status === 'aberto';

  // Dados do dia: sempre carregados, em todos os planos.
  const buscarDadosDoDia = useCallback(async () => {
    setCarregando(true);
    try {
      const [caixaResp, movResp] = await Promise.all([
        supabase.from('caixa_dias').select('*').eq('data', hojeStr).maybeSingle(),
        supabase.from('caixa_movimentacoes').select('*').eq('data', hojeStr).order('hora', { ascending: true }),
      ]);
      if (caixaResp.error) throw caixaResp.error;
      if (movResp.error) throw movResp.error;

      setCaixaHoje(caixaResp.data);
      setMovimentacoesHoje(movResp.data || []);
      setSaldoInicialInput(String(caixaResp.data?.saldo_inicial ?? '0'));
    } catch (error) {
      alert(t('caixa.erroCarregar', { msg: error.message }));
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojeStr]);

  useEffect(() => {
    buscarDadosDoDia();
  }, [buscarDadosDoDia]);

  // Histórico (90 dias) + comissão: só busca pra quem tem acesso (Intermediário
  // e Completo) — evita consulta à toa pro plano Básico, que nunca mostra isso.
  useEffect(() => {
    if (planoBasico) return;
    (async () => {
      try {
        const desde = new Date();
        desde.setDate(desde.getDate() - 90);
        const desdeStr = desde.toISOString().split('T')[0];

        const [movResp, diasResp, profResp] = await Promise.all([
          supabase.from('caixa_movimentacoes').select('*').gte('data', desdeStr).order('data', { ascending: false }),
          supabase.from('caixa_dias').select('*').gte('data', desdeStr).order('data', { ascending: false }),
          supabase.from('profissionais').select('id, nome, comissao_percentual').order('nome', { ascending: true }),
        ]);
        if (movResp.error) throw movResp.error;
        if (diasResp.error) throw diasResp.error;
        if (profResp.error) throw profResp.error;

        setMovimentacoesRecentes(movResp.data || []);
        setDiasHistorico(diasResp.data || []);
        setProfissionaisLista((profResp.data || []).map(p => ({
          uuid: p.id,
          nome: p.nome,
          percentual: p.comissao_percentual != null ? Number(p.comissao_percentual) : COMISSAO_PADRAO,
        })));
      } catch (error) {
        alert(t('caixa.erroCarregar', { msg: error.message }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoBasico]);

  // Movimento do mês selecionado — mesma trava de plano.
  useEffect(() => {
    if (planoBasico) return;
    (async () => {
      setCarregandoMes(true);
      try {
        const inicio = `${mesSelecionado}-01`;
        const [ano, mes] = mesSelecionado.split('-').map(Number);
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const fim = `${mesSelecionado}-${String(ultimoDia).padStart(2, '0')}`;

        const { data, error } = await supabase
          .from('caixa_movimentacoes')
          .select('*')
          .gte('data', inicio)
          .lte('data', fim);

        if (error) throw error;
        setMovimentacoesDoMes(data || []);
      } catch (error) {
        alert(t('caixa.erroCarregarMes', { msg: error.message }));
      } finally {
        setCarregandoMes(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado, planoBasico]);

  const handleAbrirCaixa = async () => {
    try {
      const saldoInicial = parseFloat(saldoInicialInput || '0');
      if (caixaHoje) {
        const { error } = await supabase
          .from('caixa_dias')
          .update({ status: 'aberto', aberto_em: new Date().toISOString() })
          .eq('id', caixaHoje.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('caixa_dias')
          .insert([{ data: hojeStr, status: 'aberto', saldo_inicial: saldoInicial, aberto_em: new Date().toISOString() }]);
        if (error) throw error;
      }
      buscarDadosDoDia();
    } catch (error) {
      alert(t('caixa.erroAbrir', { msg: error.message }));
    }
  };

  const handleFecharCaixa = async () => {
    if (!window.confirm(t('caixa.confirmarFechar'))) return;
    try {
      const { error } = await supabase
        .from('caixa_dias')
        .update({ status: 'fechado', fechado_em: new Date().toISOString() })
        .eq('id', caixaHoje.id);
      if (error) throw error;
      buscarDadosDoDia();
    } catch (error) {
      alert(t('caixa.erroFechar', { msg: error.message }));
    }
  };

  const handleAdicionarMovimentacao = async (e) => {
    e.preventDefault();
    if (!novaMovimentacao.descricao || !novaMovimentacao.valor) return;
    try {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
      const { error } = await supabase.from('caixa_movimentacoes').insert([{
        data: hojeStr,
        hora,
        tipo: novaMovimentacao.tipo,
        descricao: novaMovimentacao.descricao,
        valor: parseFloat(novaMovimentacao.valor),
      }]);
      if (error) throw error;
      setNovaMovimentacao({ tipo: 'entrada', descricao: '', valor: '' });
      buscarDadosDoDia();
    } catch (error) {
      alert(t('caixa.erroAdicionarMov', { msg: error.message }));
    }
  };

  const handleDeletarMovimentacao = async (mov) => {
    if (!window.confirm(t('caixa.confirmarRemoverMov'))) return;
    try {
      const { error } = await supabase.from('caixa_movimentacoes').delete().eq('id', mov.id);
      if (error) throw error;
      buscarDadosDoDia();
    } catch (error) {
      alert(t('caixa.erroRemoverMov', { msg: error.message }));
    }
  };

  const totalEntradasHoje = movimentacoesHoje.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const totalSaidasHoje = movimentacoesHoje.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldoFinalHoje = Number(caixaHoje?.saldo_inicial || 0) + totalEntradasHoje - totalSaidasHoje;

  const historicoComTotais = useMemo(() => {
    return diasHistorico.map(dia => {
      const movsDoDia = movimentacoesRecentes.filter(m => m.data === dia.data);
      const entradas = movsDoDia.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
      const saidas = movsDoDia.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
      return {
        ...dia,
        entradas,
        saidas,
        saldoFinal: Number(dia.saldo_inicial || 0) + entradas - saidas,
        movimentos: movsDoDia,
      };
    });
  }, [diasHistorico, movimentacoesRecentes]);

  const totalMes = useMemo(() => {
    const entradas = movimentacoesDoMes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
    const saidas = movimentacoesDoMes.filter(m => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [movimentacoesDoMes]);

  const comissaoPorProfissional = (movimentos) => {
    return profissionaisLista.map(p => {
      const faturado = movimentos
        .filter(m => m.tipo === 'entrada' && m.profissional_id === p.uuid)
        .reduce((s, m) => s + Number(m.valor), 0);
      const comissao = faturado * (p.percentual / 100);
      return { ...p, faturado, comissao };
    });
  };

  const semanaInicio = inicioDaSemana(hoje);
  const semanaFim = fimDaSemana(hoje);
  const movimentosSemana = movimentacoesRecentes.filter(m => m.data >= semanaInicio && m.data <= semanaFim);
  const comissaoSemanal = comissaoPorProfissional(movimentosSemana);
  const comissaoMensal = comissaoPorProfissional(movimentacoesDoMes);

  const nomeDia = diasNomes[hoje.getDay()];
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();

  if (carregando) {
    return <div className="page-container"><p style={{ textAlign: 'center', color: '#d4af37' }}>{t('caixa.carregando')}</p></div>;
  }

  return (
    <div className="page-container">
      <h2>{t('caixa.titulo', { dia: nomeDia, data: `${dia}/${mes}/${ano}` })}</h2>

      <section className="caixa-status">
        <div className="status-card">
          <h3>{t('caixa.statusCaixa')}</h3>
          <p className={`status ${caixaAberto ? 'aberto' : 'fechado'}`}>
            {caixaAberto ? t('caixa.aberto') : t('caixa.fechado')}
          </p>
          {!caixaAberto ? (
            <>
              <input
                type="number"
                placeholder={t('caixa.saldoInicialPlaceholder')}
                value={saldoInicialInput}
                onChange={(e) => setSaldoInicialInput(e.target.value)}
              />
              <button className="btn-primary" onClick={handleAbrirCaixa}>
                {caixaHoje ? t('caixa.reabrirCaixa') : t('caixa.abrirCaixa')}
              </button>
            </>
          ) : (
            <button className="btn-danger" onClick={handleFecharCaixa}>
              {t('caixa.fecharCaixa')}
            </button>
          )}
        </div>

        <div className="status-card">
          <h3>{t('caixa.resumoDia')}</h3>
          <p>{t('caixa.saldoInicial')} <strong>{formatarValor(caixaHoje?.saldo_inicial, moeda)}</strong></p>
          <p>{t('caixa.entradas')} <strong style={{ color: '#4caf50' }}>{formatarValor(totalEntradasHoje, moeda)}</strong></p>
          <p>{t('caixa.saidas')} <strong style={{ color: '#f44336' }}>{formatarValor(totalSaidasHoje, moeda)}</strong></p>
          <p className="saldo-final">{t('caixa.saldoFinal')} <strong>{formatarValor(saldoFinalHoje, moeda)}</strong></p>
        </div>
      </section>

      {caixaAberto && (
        <section className="form-section">
          <h3>{t('caixa.novaMovimentacao')}</h3>
          <form onSubmit={handleAdicionarMovimentacao}>
            <select
              value={novaMovimentacao.tipo}
              onChange={(e) => setNovaMovimentacao({ ...novaMovimentacao, tipo: e.target.value })}
            >
              <option value="entrada">{t('caixa.entrada')}</option>
              <option value="saida">{t('caixa.saida')}</option>
            </select>
            <input
              type="text"
              placeholder={t('caixa.descricaoPlaceholder')}
              value={novaMovimentacao.descricao}
              onChange={(e) => setNovaMovimentacao({ ...novaMovimentacao, descricao: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder={t('caixa.valorPlaceholder')}
              value={novaMovimentacao.valor}
              onChange={(e) => setNovaMovimentacao({ ...novaMovimentacao, valor: e.target.value })}
              required
            />
            <button type="submit" className="btn-primary">{t('comum.adicionar')}</button>
          </form>
        </section>
      )}

      <section className="list-section">
        <h3>{t('caixa.movimentacoesHoje')}</h3>
        {movimentacoesHoje.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('caixa.nenhumaMovimentacao')}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('comum.hora')}</th>
                <th>{t('caixa.tipo')}</th>
                <th>{t('caixa.descricao')}</th>
                <th>{t('comum.valor')}</th>
                <th>{t('comum.acao')}</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoesHoje.map((mov) => (
                <tr key={mov.id} className={mov.tipo}>
                  <td>{mov.hora?.substring(0, 5)}</td>
                  <td>
                    <span className={`badge ${mov.tipo}`}>
                      {mov.tipo === 'entrada' ? t('caixa.entradaTag') : t('caixa.saidaTag')}
                    </span>
                  </td>
                  <td>{mov.descricao}{mov.agendamento_id && <span style={{ color: '#999', fontSize: '11px' }}> {t('caixa.comanda')}</span>}</td>
                  <td>{formatarValor(mov.valor, moeda)}</td>
                  <td>
                    {!mov.agendamento_id && (
                      <button className="btn-delete" onClick={() => handleDeletarMovimentacao(mov)}>
                        {t('comum.deletar')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {planoBasico ? (
        <section className="list-section" style={{ textAlign: 'center' }}>
          <h3>🔒 {t('caixa.comissaoPorProfissional')}</h3>
          <p style={{ color: '#999', fontSize: '13px', marginBottom: '14px' }}>
            Histórico dos últimos 90 dias, fechamento mensal e comissão automática por profissional
            estão disponíveis a partir do plano Intermediário.
          </p>
          <button className="btn-primary" onClick={() => setPopupUpgradeAberto(true)}>
            Ver o que você ganha no Intermediário
          </button>
        </section>
      ) : (
        <>
          <section className="list-section">
            <h3>{t('caixa.historicoDias')}</h3>
            {historicoComTotais.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999' }}>{t('caixa.nenhumDiaRegistrado')}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('comum.data')}</th>
                      <th>{t('comum.status')}</th>
                      <th>{t('caixa.entradas').replace(':', '')}</th>
                      <th>{t('caixa.saidas').replace(':', '')}</th>
                      <th>{t('caixa.saldoFinal').replace(':', '')}</th>
                      <th>{t('comum.acao')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoComTotais.map((dia) => (
                      <React.Fragment key={dia.id}>
                        <tr>
                          <td>{dia.data}</td>
                          <td>{dia.status === 'aberto' ? t('caixa.aberto') : t('caixa.fechado')}</td>
                          <td style={{ color: '#4caf50' }}>{formatarValor(dia.entradas, moeda)}</td>
                          <td style={{ color: '#f44336' }}>{formatarValor(dia.saidas, moeda)}</td>
                          <td style={{ fontWeight: 'bold', color: '#d4af37' }}>{formatarValor(dia.saldoFinal, moeda)}</td>
                          <td>
                            <button
                              className="btn-primary"
                              onClick={() => setDataExpandida(dataExpandida === dia.data ? null : dia.data)}
                            >
                              {dataExpandida === dia.data ? t('comum.ocultar') : t('comum.detalhes')}
                            </button>
                          </td>
                        </tr>
                        {dataExpandida === dia.data && (
                          <tr>
                            <td colSpan={6}>
                              {dia.movimentos.length === 0 ? (
                                <p style={{ color: '#999' }}>{t('caixa.semMovimentacoesNesseDia')}</p>
                              ) : (
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>{t('comum.hora')}</th>
                                      <th>{t('caixa.tipo')}</th>
                                      <th>{t('caixa.descricao')}</th>
                                      <th>{t('comum.valor')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dia.movimentos.map(m => (
                                      <tr key={m.id}>
                                        <td>{m.hora?.substring(0, 5)}</td>
                                        <td>{m.tipo === 'entrada' ? '➕' : '➖'}</td>
                                        <td>{m.descricao}</td>
                                        <td>{formatarValor(m.valor, moeda)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="form-section">
            <h3>{t('caixa.movimentoMes')}</h3>
            <input
              type="month"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              style={{ marginBottom: '12px' }}
            />
            {carregandoMes ? (
              <p style={{ color: '#d4af37' }}>{t('comum.carregando')}</p>
            ) : (
              <>
                <p>{t('caixa.entradas')} <strong style={{ color: '#4caf50' }}>{formatarValor(totalMes.entradas, moeda)}</strong></p>
                <p>{t('caixa.saidas')} <strong style={{ color: '#f44336' }}>{formatarValor(totalMes.saidas, moeda)}</strong></p>
                <p className="saldo-final">{t('caixa.movimentoLiquido')} <strong>{formatarValor(totalMes.saldo, moeda)}</strong></p>
              </>
            )}
          </section>

          <section className="list-section">
            <h3>{t('caixa.comissaoPorProfissional')}</h3>

            <h4 style={{ color: '#d4af37', marginTop: '10px' }}>{t('caixa.semanaAtual', { inicio: semanaInicio, fim: semanaFim })}</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('comum.profissional')}</th>
                  <th>{t('caixa.faturado')}</th>
                  <th>{t('caixa.comissaoPercentual')}</th>
                  <th>{t('caixa.comissaoDevida')}</th>
                </tr>
              </thead>
              <tbody>
                {comissaoSemanal.map(p => (
                  <tr key={p.uuid}>
                    <td>{p.nome}</td>
                    <td>{formatarValor(p.faturado, moeda)}</td>
                    <td>{p.percentual}%</td>
                    <td style={{ fontWeight: 'bold', color: '#d4af37' }}>{formatarValor(p.comissao, moeda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ color: '#d4af37', marginTop: '18px' }}>{t('caixa.mesSelecionado', { mes: mesSelecionado })}</h4>
            {carregandoMes ? (
              <p style={{ color: '#d4af37' }}>{t('comum.carregando')}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('comum.profissional')}</th>
                    <th>{t('caixa.faturado')}</th>
                    <th>{t('caixa.comissaoPercentual')}</th>
                    <th>{t('caixa.comissaoDevida')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comissaoMensal.map(p => (
                    <tr key={p.uuid}>
                      <td>{p.nome}</td>
                      <td>{formatarValor(p.faturado, moeda)}</td>
                      <td>{p.percentual}%</td>
                      <td style={{ fontWeight: 'bold', color: '#d4af37' }}>{formatarValor(p.comissao, moeda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              {t('caixa.comissaoDefinidaEm')}
            </p>
          </section>
        </>
      )}

      {popupUpgradeAberto && (
        <div
          onClick={() => setPopupUpgradeAberto(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1100, padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top))', overflowY: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '10px', padding: '24px', maxWidth: '420px', width: '100%' }}
          >
            <h3 style={{ color: '#d4af37', marginTop: 0 }}>Plano Intermediário</h3>
            <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6' }}>
              Com o Intermediário você libera, além de tudo do Básico: histórico completo dos
              últimos 90 dias de caixa, fechamento mensal automático, e o cálculo de comissão de
              cada profissional (semanal e mensal) calculado sozinho a partir do que cada um vendeu.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => setPopupUpgradeAberto(false)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Caixa;
