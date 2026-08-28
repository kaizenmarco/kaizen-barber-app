import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, LOCALE_POR_IDIOMA_ADMIN, traduzirAdmin } from '../config/traducoesAdmin';

// Aba "Aniversariantes": mostra quem faz aniversário este mês (destaque pra
// hoje) e quem tem o desconto de 40% ainda disponível. A concessão do
// desconto + o e-mail de parabéns são automáticos (cron diário no Supabase,
// ver migração "desconto_aniversario_cron" e a função conceder_desconto_aniversario).
// Aqui é só a visão + o botão pra marcar o desconto como usado depois que o
// Admin aplicar os 40% manualmente ao fechar a comanda do cliente.
function Aniversariantes({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const locale = LOCALE_POR_IDIOMA_ADMIN[idioma] || 'pt-BR';

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, telefone, data_nascimento, desconto_aniversario_disponivel, desconto_aniversario_expira_em')
        .not('data_nascimento', 'is', null);

      if (error) throw error;
      setClientes(data || []);
    } catch (erro) {
      alert(t('aniversariantes.erroBuscar', { msg: erro.message }));
    } finally {
      setCarregando(false);
    }
  };

  const marcarComoUsado = async (clienteId) => {
    if (!window.confirm(t('aniversariantes.confirmarUsarDesconto'))) return;
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ desconto_aniversario_disponivel: false })
        .eq('id', clienteId);

      if (error) throw error;
      buscar();
    } catch (erro) {
      alert(t('aniversariantes.erroAtualizar', { msg: erro.message }));
    }
  };

  const hoje = new Date();
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const hojeISO = hojeSemHora.toISOString().split('T')[0];

  // Calcula, pra cada cliente, a próxima data em que ele faz aniversário
  // (este ano, ou ano que vem se já passou), quantos dias faltam, e se o
  // desconto de 40% dele ainda está válido.
  const comProximoAniversario = clientes.map(c => {
    const nascimento = new Date(`${c.data_nascimento}T00:00:00`);
    const mes = nascimento.getMonth();
    const dia = nascimento.getDate();

    let proximo = new Date(hojeSemHora.getFullYear(), mes, dia);
    if (proximo < hojeSemHora) {
      proximo = new Date(hojeSemHora.getFullYear() + 1, mes, dia);
    }

    const diasFaltando = Math.round((proximo - hojeSemHora) / 86400000);
    const ehHoje = diasFaltando === 0;
    const descontoAtivo = !!c.desconto_aniversario_disponivel
      && (!c.desconto_aniversario_expira_em || c.desconto_aniversario_expira_em >= hojeISO);

    return { ...c, mes, dia, proximo, diasFaltando, ehHoje, descontoAtivo };
  }).sort((a, b) => a.diasFaltando - b.diasFaltando);

  const aniversariantesDoMes = comProximoAniversario
    .filter(c => c.mes === hoje.getMonth())
    .sort((a, b) => a.dia - b.dia);

  const formatarDiaMes = (data) => data.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  const formatarDataCurta = (dataStr) => new Date(`${dataStr}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const CardCliente = ({ c }) => (
    <div
      style={{
        background: c.ehHoje ? 'rgba(212, 175, 55, 0.12)' : '#1a1a1a',
        border: `1px solid ${c.ehHoje ? '#d4af37' : '#404040'}`,
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '10px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <strong style={{ color: '#e8e8e8' }}>{c.nome}</strong>
          <div style={{ color: '#999', fontSize: '12px', marginTop: '2px' }}>
            🎂 {formatarDiaMes(c.proximo)}
            {' — '}
            {c.ehHoje ? (
              <span style={{ color: '#d4af37', fontWeight: 'bold' }}>{t('aniversariantes.hoje')}</span>
            ) : c.diasFaltando === 1 ? (
              t('aniversariantes.amanha')
            ) : (
              t('aniversariantes.diasFaltam', { n: c.diasFaltando })
            )}
          </div>
          {(c.telefone || c.email) && (
            <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
              {c.telefone && <span>📞 {c.telefone}</span>}
              {c.telefone && c.email && <span> · </span>}
              {c.email && <span>✉️ {c.email}</span>}
            </div>
          )}
        </div>
      </div>

      {c.descontoAtivo && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '12px' }}>
            {t('aniversariantes.descontoDisponivel', { data: formatarDataCurta(c.desconto_aniversario_expira_em) })}
          </span>
          <button
            onClick={() => marcarComoUsado(c.id)}
            style={{ background: 'transparent', border: '1px solid #4ade80', color: '#4ade80', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {t('aniversariantes.marcarUsado')}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-container">
      <h2>{t('aniversariantes.titulo')}</h2>

      <p style={{ color: '#999', fontSize: '13px', background: '#2d2d2d', border: '1px solid #404040', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
        {t('aniversariantes.comoFunciona')}
      </p>

      <section className="list-section" style={{ marginBottom: '20px' }}>
        <h3>{t('aniversariantes.aniversariantesDoMes')}</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
        ) : aniversariantesDoMes.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('aniversariantes.nenhumEsteMes')}</p>
        ) : (
          aniversariantesDoMes.map(c => <CardCliente key={c.id} c={c} />)
        )}
      </section>

      <section className="list-section">
        <h3>{t('aniversariantes.proximos')}</h3>
        {carregando ? null : comProximoAniversario.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('aniversariantes.nenhumCadastrado')}</p>
        ) : (
          comProximoAniversario.map(c => <CardCliente key={c.id} c={c} />)
        )}
      </section>
    </div>
  );
}

export default Aniversariantes;
