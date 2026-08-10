import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { SERVICOS } from '../config/servicos';
import { PROFISSIONAIS } from '../config/profissionais';

function Comandas({ t }) {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];

  const [caixaHoje, setCaixaHoje] = useState(null);
  const [comandasAbertas, setComandasAbertas] = useState([]);
  const [realizadosHoje, setRealizadosHoje] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [novoItem, setNovoItem] = useState({
    cliente: '',
    servico: '',
    valor: '',
    profissional: ''
  });

  const caixaAberto = caixaHoje?.status === 'aberto';

  const profissionaisDoServico = novoItem.servico
    ? PROFISSIONAIS.filter(p => {
        const s = SERVICOS.find(sv => sv.nome === novoItem.servico);
        return s ? s.profissionaisIds.includes(p.id) : true;
      })
    : PROFISSIONAIS;

  const buscarTudo = useCallback(async () => {
    setCarregando(true);
    try {
      const [caixaResp, abertasResp, realizadasResp] = await Promise.all([
        supabase.from('caixa_dias').select('*').eq('data', hojeStr).maybeSingle(),
        supabase
          .from('agendamentos')
          .select(`
            id, cliente_id, profissional_id, servico_id, data_hora, status, preco_final,
            clientes(id, nome),
            profissionais:profissional_id(id, nome),
            servicos:servico_id(id, nome)
          `)
          .gte('data_hora', `${hojeStr}T00:00:00`)
          .lte('data_hora', `${hojeStr}T23:59:59`)
          .in('status', ['AGENDADO', 'CONFIRMADO'])
          .order('data_hora', { ascending: true }),
        supabase
          .from('agendamentos')
          .select(`
            id, cliente_id, profissional_id, servico_id, data_hora, status, preco_final,
            clientes(id, nome),
            profissionais:profissional_id(id, nome),
            servicos:servico_id(id, nome)
          `)
          .gte('data_hora', `${hojeStr}T00:00:00`)
          .lte('data_hora', `${hojeStr}T23:59:59`)
          .eq('status', 'REALIZADO')
          .order('data_hora', { ascending: false }),
      ]);

      if (caixaResp.error) throw caixaResp.error;
      if (abertasResp.error) throw abertasResp.error;
      if (realizadasResp.error) throw realizadasResp.error;

      const formatar = (a) => ({
        id: a.id,
        clienteId: a.cliente_id,
        profissionalId: a.profissional_id,
        servicoId: a.servico_id,
        cliente: a.clientes?.nome || 'Desconhecido',
        servico: a.servicos?.nome || 'N/A',
        profissional: a.profissionais?.nome || 'N/A',
        valor: a.preco_final || 0,
        hora: a.data_hora?.split('T')[1]?.substring(0, 5) || '',
      });

      setCaixaHoje(caixaResp.data);
      setComandasAbertas(abertasResp.data.map(formatar));
      setRealizadosHoje(realizadasResp.data.map(formatar));
    } catch (error) {
      alert('❌ Erro ao buscar comandas: ' + error.message);
    } finally {
      setCarregando(false);
    }
  }, [hojeStr]);

  useEffect(() => {
    buscarTudo();
  }, [buscarTudo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const atualizado = { ...novoItem, [name]: value };
    if (name === 'servico') {
      const s = SERVICOS.find(sv => sv.nome === value);
      atualizado.valor = s ? String(s.preco) : '';
      atualizado.profissional = '';
    }
    setNovoItem(atualizado);
  };

  const registrarNoCaixa = async ({ descricao, valor, profissionalId, agendamentoId }) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const { error } = await supabase.from('caixa_movimentacoes').insert([{
      data: hojeStr,
      hora,
      tipo: 'entrada',
      descricao,
      valor,
      profissional_id: profissionalId,
      agendamento_id: agendamentoId,
    }]);
    if (error) throw error;
  };

  const handleFecharComanda = async (item) => {
    if (!caixaAberto) {
      alert('⚠️ O caixa de hoje ainda não foi aberto. Vá na aba Caixa e abra o caixa antes de fechar comandas.');
      return;
    }

    const servicoInfo = SERVICOS.find(s => s.uuid === item.servicoId);
    const sugestao = item.valor > 0 ? item.valor : (servicoInfo?.preco ?? 0);
    const valorStr = window.prompt(
      `Fechar "${item.servico}" de ${item.cliente} (${item.profissional}).\nValor final (¥):`,
      String(sugestao)
    );
    if (valorStr === null) return;
    const valor = parseFloat(valorStr);
    if (isNaN(valor) || valor < 0) {
      alert('⚠️ Valor inválido.');
      return;
    }

    try {
      const { error: erroUpdate } = await supabase
        .from('agendamentos')
        .update({ status: 'REALIZADO', preco_final: valor })
        .eq('id', item.id);
      if (erroUpdate) throw erroUpdate;

      await registrarNoCaixa({
        descricao: `${item.servico} - ${item.cliente}`,
        valor,
        profissionalId: item.profissionalId,
        agendamentoId: item.id,
      });

      alert('✅ Comanda fechada e lançada no caixa!');
      buscarTudo();
    } catch (error) {
      alert('❌ Erro ao fechar comanda: ' + error.message);
    }
  };

  const handleAdicionarItem = async (e) => {
    e.preventDefault();

    if (!caixaAberto) {
      alert('⚠️ O caixa de hoje ainda não foi aberto. Vá na aba Caixa e abra o caixa antes de lançar atendimentos avulsos.');
      return;
    }
    if (!novoItem.cliente || !novoItem.servico || !novoItem.valor || !novoItem.profissional) {
      alert('⚠️ Preencha todos os campos!');
      return;
    }

    try {
      const servicoInfo = SERVICOS.find(s => s.nome === novoItem.servico);
      const profInfo = PROFISSIONAIS.find(p => p.nome === novoItem.profissional);
      if (!servicoInfo || !profInfo) {
        alert('⚠️ Serviço ou profissional inválido.');
        return;
      }

      const { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', novoItem.cliente)
        .maybeSingle();

      let clienteId = clienteExistente?.id;
      if (!clienteId) {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes')
          .insert([{ nome: novoItem.cliente }])
          .select('id')
          .single();
        if (erroCliente) throw erroCliente;
        clienteId = novoCliente.id;
      }

      const valor = parseFloat(novoItem.valor);
      const { data: novoAgendamento, error: erroAgendamento } = await supabase
        .from('agendamentos')
        .insert([{
          cliente_id: clienteId,
          profissional_id: profInfo.uuid,
          servico_id: servicoInfo.uuid,
          data_hora: new Date().toISOString(),
          status: 'REALIZADO',
          preco_final: valor,
        }])
        .select('id')
        .single();
      if (erroAgendamento) throw erroAgendamento;

      await registrarNoCaixa({
        descricao: `${servicoInfo.nome} - ${novoItem.cliente}`,
        valor,
        profissionalId: profInfo.uuid,
        agendamentoId: novoAgendamento.id,
      });

      setNovoItem({ cliente: '', servico: '', valor: '', profissional: '' });
      alert('✅ Atendimento lançado na comanda e no caixa!');
      buscarTudo();
    } catch (error) {
      alert('❌ Erro ao adicionar: ' + error.message);
    }
  };

  const totalRealizadoHoje = realizadosHoje.reduce((sum, item) => sum + item.valor, 0);

  const nomeDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][hoje.getDay()];
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();

  return (
    <div className="page-container">
      <h2>📋 Comandas do Dia - {nomeDia}, {dia}/{mes}/{ano}</h2>

      <section className="caixa-status">
        <div className="status-card">
          <h3>Status do Caixa</h3>
          <p className={`status ${caixaAberto ? 'aberto' : 'fechado'}`}>
            {caixaAberto ? '✅ ABERTO' : '❌ FECHADO'}
          </p>
          {!caixaAberto && (
            <p style={{ fontSize: '13px', color: '#f87171' }}>
              Abra o caixa na aba Caixa para poder fechar comandas ou lançar atendimentos avulsos.
            </p>
          )}
        </div>

        <div className="status-card">
          <h3>Total Realizado Hoje</h3>
          <p>Atendimentos: <strong>{realizadosHoje.length}</strong></p>
          <p className="saldo-final">Total: <strong>¥{totalRealizadoHoje.toLocaleString('ja-JP')}</strong></p>
        </div>
      </section>

      <section className="list-section">
        <h3>🕓 Comandas Abertas (agendamentos de hoje)</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>⏳ Carregando...</p>
        ) : comandasAbertas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhuma comanda aberta para hoje</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Profissional</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {comandasAbertas.map((item) => (
                  <tr key={item.id}>
                    <td>{item.hora}</td>
                    <td>{item.cliente}</td>
                    <td>{item.servico}</td>
                    <td>{item.profissional}</td>
                    <td>
                      <button className="btn-primary" onClick={() => handleFecharComanda(item)}>
                        ✅ Fechar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {caixaAberto && (
        <section className="form-section">
          <h3>Lançar Atendimento Avulso</h3>
          <form onSubmit={handleAdicionarItem}>
            <input
              type="text"
              name="cliente"
              placeholder="Nome do Cliente"
              value={novoItem.cliente}
              onChange={handleInputChange}
              required
            />
            <select
              name="servico"
              value={novoItem.servico}
              onChange={handleInputChange}
              required
            >
              <option value="">Selecione um serviço</option>
              {SERVICOS.map((s) => (
                <option key={s.id} value={s.nome}>{s.nome} - ¥{s.preco.toLocaleString('ja-JP')}</option>
              ))}
            </select>
            <select
              name="profissional"
              value={novoItem.profissional}
              onChange={handleInputChange}
              required
            >
              <option value="">Selecione profissional</option>
              {profissionaisDoServico.map((p) => (
                <option key={p.uuid} value={p.nome}>{p.nome}</option>
              ))}
            </select>
            <input
              type="number"
              name="valor"
              placeholder="Valor (¥)"
              value={novoItem.valor}
              onChange={handleInputChange}
              required
            />
            <button type="submit" className="btn-primary">Adicionar Serviço</button>
          </form>
        </section>
      )}

      <section className="list-section">
        <h3>📊 Serviços Realizados Hoje</h3>

        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>⏳ Carregando...</p>
        ) : realizadosHoje.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum serviço realizado ainda hoje</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Profissional</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {realizadosHoje.map((item) => (
                  <tr key={item.id}>
                    <td>{item.hora}</td>
                    <td>{item.cliente}</td>
                    <td>{item.servico}</td>
                    <td>{item.profissional}</td>
                    <td style={{ fontWeight: 'bold', color: '#d4af37' }}>¥{item.valor.toLocaleString('ja-JP')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              Já lançados no caixa do dia — para corrigir um valor, ajuste diretamente na aba Caixa.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Comandas;
