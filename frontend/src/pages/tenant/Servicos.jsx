import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClientTenant';

// Cadastro de serviços MULTI-TENANT: cada empresa cadastra seu próprio
// catálogo (nome, preço, duração) — empresa_id é preenchido automaticamente
// pelo banco (default private.empresa_atual()), isolado por RLS, mesmo
// padrão de Profissionais/Clientes. É esse catálogo que a Agenda vai usar
// (etapa seguinte) em vez do arquivo fixo config/servicos.js do app
// original de UMA barbearia só.
//
// Preço aceita uma faixa (mínimo/máximo) em vez de um valor único — o banco
// já foi desenhado assim (preco_minimo obrigatório, preco_maximo opcional)
// pra cobrir serviços tipo "coloração" cujo preço varia conforme o cabelo.
// Se só o mínimo for preenchido, mostra como valor fixo.
//
// Preço é mostrado/editado na moeda que a empresa escolheu no cadastro
// (empresas.moeda: 'brl' ou 'jpy') — cada barbearia só opera numa moeda por
// enquanto. Se no futuro surgir empresa com profissionais em países/moedas
// diferentes dentro da mesma conta, isso pode virar um seletor por serviço;
// por ora um catálogo por empresa já resolve, já que moeda é definida por
// empresa lá no /cadastro.

const SIMBOLO_MOEDA = { brl: 'R$', jpy: '¥' };

function formatarValor(valor, moeda) {
  if (moeda === 'jpy') return `¥${Number(valor).toLocaleString('ja-JP')}`;
  return `R$${Number(valor).toFixed(2).replace('.', ',')}`;
}

function formatarPreco(servico, moeda) {
  const min = Number(servico.preco_minimo);
  const max = servico.preco_maximo != null ? Number(servico.preco_maximo) : null;
  if (max != null && max > min) return `${formatarValor(min, moeda)} - ${formatarValor(max, moeda)}`;
  return formatarValor(min, moeda);
}

function Servicos({ empresa }) {
  const moeda = empresa?.moeda === 'jpy' ? 'jpy' : 'brl';
  const simbolo = SIMBOLO_MOEDA[moeda];
  const casasDecimais = moeda === 'jpy' ? '1' : '0.01';
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({
    nome: '',
    descricao: '',
    preco_minimo: '',
    preco_maximo: '',
    duracao_minutos: '',
  });

  useEffect(() => {
    buscarServicos();
  }, []);

  const buscarServicos = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, descricao, preco_minimo, preco_maximo, duracao_minutos, criado_em')
        .eq('eh_pacote', false)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      setServicos(data || []);
    } catch (e) {
      setErro(`Não consegui carregar os serviços: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovo({ ...novo, [name]: value });
  };

  const handleAdicionar = async (e) => {
    e.preventDefault();
    if (!novo.nome.trim()) {
      setErro('Preencha ao menos o nome do serviço.');
      return;
    }
    if (novo.preco_minimo === '' || Number(novo.preco_minimo) < 0) {
      setErro('Informe o preço do serviço.');
      return;
    }
    if (novo.preco_maximo !== '' && Number(novo.preco_maximo) < Number(novo.preco_minimo)) {
      setErro('O preço máximo não pode ser menor que o preço mínimo.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const { error } = await supabase.from('servicos').insert([
        {
          nome: novo.nome.trim(),
          descricao: novo.descricao.trim() || null,
          preco_minimo: Number(novo.preco_minimo),
          preco_maximo: novo.preco_maximo !== '' ? Number(novo.preco_maximo) : null,
          duracao_minutos: novo.duracao_minutos !== '' ? Number(novo.duracao_minutos) : null,
        },
      ]);
      if (error) throw error;
      setNovo({ nome: '', descricao: '', preco_minimo: '', preco_maximo: '', duracao_minutos: '' });
      buscarServicos();
    } catch (e) {
      setErro(`Não consegui adicionar: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id) => {
    if (!window.confirm('Remover este serviço?')) return;
    try {
      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (error) throw error;
      buscarServicos();
    } catch (e) {
      setErro(`Não consegui remover: ${e.message}`);
    }
  };

  return (
    <div className="page-container">
      <h2>Serviços</h2>

      <section className="form-section">
        <h3>Adicionar serviço</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          Cadastre aqui os serviços que sua barbearia oferece (corte, barba, coloração
          etc.). É esse catálogo que vai aparecer na Agenda.
        </p>
        <form onSubmit={handleAdicionar}>
          <input
            type="text"
            name="nome"
            placeholder="Nome do serviço"
            value={novo.nome}
            onChange={handleInputChange}
            required
          />
          <input
            type="text"
            name="descricao"
            placeholder="Descrição (opcional)"
            value={novo.descricao}
            onChange={handleInputChange}
          />
          <input
            type="number"
            name="preco_minimo"
            placeholder={`Preço (${simbolo})`}
            min="0"
            step={casasDecimais}
            value={novo.preco_minimo}
            onChange={handleInputChange}
            required
          />
          <input
            type="number"
            name="preco_maximo"
            placeholder={`Preço máximo em ${simbolo} (opcional, se variar)`}
            min="0"
            step={casasDecimais}
            value={novo.preco_maximo}
            onChange={handleInputChange}
          />
          <input
            type="number"
            name="duracao_minutos"
            placeholder="Duração em minutos (opcional)"
            min="0"
            value={novo.duracao_minutos}
            onChange={handleInputChange}
          />
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Adicionar serviço'}
          </button>
        </form>
        {erro && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '10px' }}>{erro}</p>}
      </section>

      <section className="list-section">
        <h3>Seus serviços</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>Carregando...</p>
        ) : servicos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum serviço cadastrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Preço ({simbolo})</th>
                  <th>Duração</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 'bold' }}>{s.nome}</td>
                    <td>{s.descricao || '-'}</td>
                    <td>{formatarPreco(s, moeda)}</td>
                    <td>{s.duracao_minutos ? `${s.duracao_minutos} min` : '-'}</td>
                    <td>
                      <button className="btn-delete" onClick={() => handleDeletar(s.id)}>
                        🗑️ Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Servicos;
