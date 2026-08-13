import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { IDIOMA_ADMIN_PADRAO, traduzirAdmin } from '../config/traducoesAdmin';

function Fidelidade({ t: tProp, idioma: idiomaProp }) {
  const idioma = idiomaProp || IDIOMA_ADMIN_PADRAO;
  const t = tProp || ((chave, valores) => traduzirAdmin(idioma, chave, valores));

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState('');

  useEffect(() => {
    buscarClientesComPontos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarClientesComPontos = async () => {
    setCarregando(true);
    try {
      // Buscar todos os clientes
      const { data: clientesData, error: erroClientes } = await supabase
        .from('clientes')
        .select('id, nome, email, criado_em')
        .order('nome', { ascending: true });

      if (erroClientes) throw erroClientes;

      // Para cada cliente, calcular pontos
      const clientesComPontos = await Promise.all(
        clientesData.map(async (cliente) => {
          // Buscar agendamentos REALIZADOS deste cliente
          const { data: agendamentos, error: erroAgendamentos } = await supabase
            .from('agendamentos')
            .select('id, status, preco_final, data_hora')
            .eq('cliente_id', cliente.id)
            .eq('status', 'REALIZADO');

          if (erroAgendamentos) throw erroAgendamentos;

          // Calcular pontos: 2 pontos por serviço realizado
          const totalPontos = (agendamentos?.length || 0) * 2;
          const pontosPodersResgatados = Math.floor(totalPontos / 10) * 10;
          const pontosDisponíveis = totalPontos - pontosPodersResgatados;

          return {
            id: cliente.id,
            nome: cliente.nome,
            email: cliente.email,
            dataInscricao: cliente.criado_em?.split('T')[0] || '-',
            totalAgendamentos: agendamentos?.length || 0,
            totalPontos: totalPontos,
            pontosPodersResgatados: pontosPodersResgatados,
            pontosDisponíveis: pontosDisponíveis,
            desconto: (Math.floor(totalPontos / 10) * 500).toLocaleString('ja-JP')
          };
        })
      );

      setClientes(clientesComPontos);
    } catch (error) {
      alert(t('fidelidade.erroBuscar', { msg: error.message }));
    } finally {
      setCarregando(false);
    }
  };

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(filtroCliente.toLowerCase())
  );

  // Totais gerais
  const totalPontosGeral = clientes.reduce((sum, c) => sum + c.totalPontos, 0);
  const totalDescontos = clientes.reduce((sum, c) => sum + Math.floor(c.totalPontos / 10) * 500, 0);

  return (
    <div className="page-container">
      <h2>{t('fidelidade.titulo')}</h2>

      {/* RESUMO */}
      <section className="caixa-status">
        <div className="status-card">
          <h3>{t('fidelidade.totalPontos')}</h3>
          <p style={{ fontSize: '32px', color: '#d4af37', fontWeight: 'bold', margin: '10px 0' }}>
            {totalPontosGeral}
          </p>
          <p style={{ fontSize: '12px', color: '#999' }}>{t('fidelidade.emTodaBase')}</p>
        </div>

        <div className="status-card">
          <h3>{t('fidelidade.clientesAtivos')}</h3>
          <p style={{ fontSize: '32px', color: '#4ade80', fontWeight: 'bold', margin: '10px 0' }}>
            {clientes.length}
          </p>
          <p style={{ fontSize: '12px', color: '#999' }}>{t('fidelidade.comAgendamentos')}</p>
        </div>

        <div className="status-card">
          <h3>{t('fidelidade.descontosResgatados')}</h3>
          <p style={{ fontSize: '28px', color: '#60a5fa', fontWeight: 'bold', margin: '10px 0' }}>
            ¥{totalDescontos.toLocaleString('ja-JP')}
          </p>
          <p style={{ fontSize: '12px', color: '#999' }}>{t('fidelidade.valorTotalResgatado')}</p>
        </div>

        <div className="status-card">
          <h3>{t('fidelidade.regrasPrograma')}</h3>
          <p style={{ fontSize: '12px', color: '#e8e8e8', lineHeight: '1.6' }}>
            {t('fidelidade.regra1')}<br/>
            {t('fidelidade.regra2')}<br/>
            {t('fidelidade.regra3')}<br/>
            {t('fidelidade.regra4')}
          </p>
        </div>
      </section>

      {/* LISTA DE CLIENTES */}
      <section className="list-section">
        <h3>{t('fidelidade.clientesSaldoPontos')}</h3>

        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder={t('fidelidade.buscarClientePlaceholder')}
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #d4af37',
              background: '#2d2d2d',
              color: '#e8e8e8',
              width: '300px'
            }}
          />
        </div>

        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>{t('comum.carregando')}</p>
        ) : clientesFiltrados.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>{t('fidelidade.nenhumEncontrado')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('comum.cliente')}</th>
                  <th>{t('comum.email')}</th>
                  <th>{t('fidelidade.dataInscricao')}</th>
                  <th>{t('fidelidade.agendamentos')}</th>
                  <th>{t('fidelidade.pontosDisponiveis')}</th>
                  <th>{t('fidelidade.pontosResgatar')}</th>
                  <th>{t('fidelidade.descontoIene')}</th>
                  <th>{t('comum.status')}</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id}>
                    <td style={{ fontWeight: 'bold' }}>{cliente.nome}</td>
                    <td style={{ fontSize: '12px', color: '#999' }}>{cliente.email}</td>
                    <td>{cliente.dataInscricao}</td>
                    <td style={{ textAlign: 'center', color: '#d4af37', fontWeight: 'bold' }}>
                      {cliente.totalAgendamentos}
                    </td>
                    <td style={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#4ade80',
                      background: '#2d3d2d',
                      borderRadius: '4px',
                      padding: '8px'
                    }}>
                      {cliente.pontosDisponíveis}
                    </td>
                    <td style={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#60a5fa',
                      background: '#2d3d4d',
                      borderRadius: '4px',
                      padding: '8px'
                    }}>
                      {cliente.pontosPodersResgatados}
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#d4af37' }}>
                      {cliente.pontosPodersResgatados > 0 ? `¥${cliente.desconto}` : '-'}
                    </td>
                    <td>
                      <span style={{
                        background: cliente.totalPontos > 0 ? '#4ade80' : '#999',
                        color: '#1a1a1a',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {cliente.totalPontos > 0 ? t('fidelidade.ativo') : t('fidelidade.semPontos')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* INFORMAÇÕES */}
      <section style={{ background: '#2d2d2d', border: '1px solid #d4af37', borderRadius: '12px', padding: '20px', marginTop: '30px' }}>
        <h3 style={{ color: '#d4af37', marginBottom: '15px' }}>{t('fidelidade.comoFunciona')}</h3>
        <div style={{ color: '#e8e8e8', lineHeight: '1.8' }}>
          <p><strong>{t('fidelidade.objetivo')}</strong> {t('fidelidade.objetivoTexto')}</p>
          <p><strong>{t('fidelidade.pontosLabel')}</strong> {t('fidelidade.pontosTexto')}</p>
          <p><strong>{t('fidelidade.resgate')}</strong> {t('fidelidade.resgateTexto')}</p>
          <p><strong>{t('fidelidade.validade')}</strong> {t('fidelidade.validadeTexto')}</p>
          <p><strong>{t('fidelidade.intransferivel')}</strong> {t('fidelidade.intransferivelTexto')}</p>
          <p><strong>{t('fidelidade.rastreamento')}</strong> {t('fidelidade.rastreamentoTexto')}</p>
        </div>
      </section>
    </div>
  );
}

export default Fidelidade;
