import React, { useState, useEffect } from 'react';
import { IDIOMA_ADMIN_PADRAO, LOCALE_POR_IDIOMA_ADMIN, traduzirAdmin } from '../config/traducoesAdmin';
import { buscarClientesAusentes, LIMITE_DIAS_AUSENTE } from '../config/clientesAusentes';

// Aba "Clientes Ausentes" (menu Mais) — indicador de retenção: lista quem
// passou de 30 dias sem um atendimento REALIZADO, do mais ausente pro mais
// recente. O e-mail de reativação (disparado automaticamente pelo banco,
// 1x por dia) e o desconto de 15% por recorrência no mesmo dia são
// cuidados separados — aqui é só o painel de visibilidade pro Admin.
function ClientesAusentes({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));
  const locale = LOCALE_POR_IDIOMA_ADMIN[idioma] || 'pt-BR';

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      setClientes(await buscarClientesAusentes());
      setCarregando(false);
    })();
  }, []);

  const formatarData = (iso) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="page-container">
      <h2>{t('clientesAusentes.titulo')}</h2>

      <p style={{ color: '#999', fontSize: '13px', background: '#2d2d2d', border: '1px solid #404040', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
        {t('clientesAusentes.comoFunciona', { n: LIMITE_DIAS_AUSENTE })}
      </p>

      {carregando ? (
        <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
      ) : clientes.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999' }}>{t('clientesAusentes.nenhum')}</p>
      ) : (
        clientes.map(c => {
          const destaque = c.diasAusente >= LIMITE_DIAS_AUSENTE * 2;
          return (
            <div
              key={c.clienteId}
              style={{
                background: destaque ? 'rgba(248, 113, 113, 0.08)' : '#1a1a1a',
                border: `1px solid ${destaque ? '#f87171' : '#404040'}`,
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ color: '#e8e8e8', fontSize: '15px' }}>{c.nome}</strong>
                  {c.bloqueado && (
                    <span style={{ marginLeft: '8px', color: '#f87171', fontSize: '11px', fontWeight: 'bold', border: '1px solid #f87171', borderRadius: '4px', padding: '2px 6px' }}>
                      🚫 {t('reincidentes.bloqueado')}
                    </span>
                  )}
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                    {c.telefone && <span>📞 {c.telefone}</span>}
                    {c.telefone && c.email && <span> · </span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
                <span
                  style={{
                    color: destaque ? '#f87171' : '#d4af37',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    border: `1px solid ${destaque ? '#f87171' : '#d4af37'}`,
                    borderRadius: '6px',
                    padding: '4px 10px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t('clientesAusentes.diasAusente', { n: c.diasAusente })}
                </span>
              </div>

              <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                {t('clientesAusentes.ultimoAtendimento', { data: formatarData(c.ultimoRealizado) })}
                {c.emailJaEnviado && (
                  <span style={{ marginLeft: '8px', color: '#4ade80' }}>✉️ {t('clientesAusentes.emailJaEnviado')}</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default ClientesAusentes;
