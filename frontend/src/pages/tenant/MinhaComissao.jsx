import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../../config/traducoesAdmin';

// Visão do profissional: igual ao cálculo de "Comissão por Profissional" que
// já existe em tenant/Caixa.jsx (faturado × percentual), só que filtrado
// para UM profissional só — o que está logado — sem mostrar os colegas nem
// as outras telas de Caixa (abrir/fechar caixa, lançar movimentação).

const formatarValor = (valor, moeda) => {
  const num = Number(valor) || 0;
  if (moeda === 'jpy') return `¥${num.toLocaleString('ja-JP')}`;
  return `R$${num.toFixed(2).replace('.', ',')}`;
};

const inicioDaSemana = (data) => {
  const d = new Date(data);
  const diaSemana = d.getDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

const fimDaSemana = (data) => {
  const inicio = new Date(inicioDaSemana(data));
  inicio.setDate(inicio.getDate() + 6);
  return inicio.toISOString().split('T')[0];
};

function MinhaComissao({ t: tProp, idioma: idiomaProp, empresa, empresaId, profissionalId }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const moeda = empresa?.moeda === 'jpy' ? 'jpy' : 'brl';

  // Mesma trava de plano que a Caixa já usa — comissão é recurso do
  // Intermediário/Completo, não do Básico.
  const planoBasico = empresa?.plano === 'basico';

  const hoje = new Date();
  const mesAtualStr = hoje.toISOString().split('T')[0].substring(0, 7);

  const [carregando, setCarregando] = useState(true);
  const [percentual, setPercentual] = useState(40);
  const [movimentacoesRecentes, setMovimentacoesRecentes] = useState([]); // últimos 90 dias

  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr);
  const [movimentacoesDoMes, setMovimentacoesDoMes] = useState([]);
  const [carregandoMes, setCarregandoMes] = useState(false);

  useEffect(() => {
    if (planoBasico || !profissionalId) { setCarregando(false); return; }
    (async () => {
      setCarregando(true);
      try {
        const desde = new Date();
        desde.setDate(desde.getDate() - 90);
        const desdeStr = desde.toISOString().split('T')[0];

        const [profResp, movResp] = await Promise.all([
          supabase.from('profissionais').select('comissao_percentual').eq('id', profissionalId).eq('empresa_id', empresaId).maybeSingle(),
          supabase.from('caixa_movimentacoes').select('*').eq('empresa_id', empresaId).eq('profissional_id', profissionalId).gte('data', desdeStr).order('data', { ascending: false }),
        ]);
        if (profResp.error) throw profResp.error;
        if (movResp.error) throw movResp.error;

        setPercentual(profResp.data?.comissao_percentual != null ? Number(profResp.data.comissao_percentual) : 40);
        setMovimentacoesRecentes(movResp.data || []);
      } catch (error) {
        alert(t('minhaComissao.erroCarregar', { msg: error.message }));
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoBasico, profissionalId, empresaId]);

  useEffect(() => {
    if (planoBasico || !profissionalId) return;
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
          .eq('empresa_id', empresaId)
          .eq('profissional_id', profissionalId)
          .gte('data', inicio)
          .lte('data', fim);

        if (error) throw error;
        setMovimentacoesDoMes(data || []);
      } catch (error) {
        alert(t('minhaComissao.erroCarregarMes', { msg: error.message }));
      } finally {
        setCarregandoMes(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado, planoBasico, profissionalId, empresaId]);

  const semanaInicio = inicioDaSemana(hoje);
  const semanaFim = fimDaSemana(hoje);
  const movimentosSemana = useMemo(
    () => movimentacoesRecentes.filter(m => m.data >= semanaInicio && m.data <= semanaFim),
    [movimentacoesRecentes, semanaInicio, semanaFim]
  );

  const calcular = (movimentos) => {
    const faturado = movimentos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
    return { faturado, comissao: faturado * (percentual / 100) };
  };
  const semanal = calcular(movimentosSemana);
  const mensal = calcular(movimentacoesDoMes);

  if (planoBasico) {
    return (
      <div className="page-container">
        <h2>🔒 {t('minhaComissao.titulo')}</h2>
        <p style={{ color: '#999' }}>{t('minhaComissao.bloqueadoPlanoBasico')}</p>
      </div>
    );
  }

  if (!profissionalId) {
    return (
      <div className="page-container">
        <h2>{t('minhaComissao.titulo')}</h2>
        <p style={{ color: '#999' }}>{t('minhaComissao.semVinculo')}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h2>{t('minhaComissao.titulo')}</h2>

      {carregando ? (
        <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
      ) : (
        <>
          <section className="list-section">
            <h3>{t('caixa.semanaAtual', { inicio: semanaInicio, fim: semanaFim })}</h3>
            <p>{t('caixa.faturado')} <strong>{formatarValor(semanal.faturado, moeda)}</strong></p>
            <p>{t('caixa.comissaoPercentual')} <strong>{percentual}%</strong></p>
            <p>{t('caixa.comissaoDevida')} <strong style={{ color: '#d4af37', fontSize: '18px' }}>{formatarValor(semanal.comissao, moeda)}</strong></p>
          </section>

          <section className="form-section">
            <h3>{t('caixa.mesSelecionado', { mes: mesSelecionado })}</h3>
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
                <p>{t('caixa.faturado')} <strong>{formatarValor(mensal.faturado, moeda)}</strong></p>
                <p>{t('caixa.comissaoDevida')} <strong style={{ color: '#d4af37', fontSize: '18px' }}>{formatarValor(mensal.comissao, moeda)}</strong></p>
              </>
            )}
          </section>

          <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            {t('caixa.comissaoDefinidaEm')}
          </p>
        </>
      )}
    </div>
  );
}

export default MinhaComissao;
