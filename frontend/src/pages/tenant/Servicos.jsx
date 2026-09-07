import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClientTenant';
import { enviarImagemTenant } from '../../config/uploadImagemTenant';

// Cadastro de serviços MULTI-TENANT: cada empresa cadastra seu próprio
// catálogo (nome, preço, duração, foto) — empresa_id é preenchido
// automaticamente pelo banco (default private.empresa_atual()), isolado por
// RLS, mesmo padrão de Profissionais/Clientes. É esse catálogo que a Agenda
// vai usar (etapa seguinte) em vez do arquivo fixo config/servicos.js do app
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
//
// Foto (imagem_url) vai pro bucket compartilhado "empresas-imagens",
// isolado por empresa — mesmo mecanismo já usado no app original pra
// Serviços/Produtos/Pacotes.
//
// Pacotes (ex: "5 cortes por ¥15.000, válido por 90 dias") NÃO são uma
// tabela separada — são linhas desta MESMA tabela servicos, com
// eh_pacote=true e mais 2 campos (quantidade_sessoes, validade_dias) — é
// exatamente como o app original já funcionava (ver config/servicos.js,
// buscarPacotesAtivos). Por isso o formulário abaixo tem um checkbox "É um
// pacote?" em vez de uma tela separada.

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

const NOVO_VAZIO = {
  nome: '',
  descricao: '',
  preco_minimo: '',
  preco_maximo: '',
  duracao_minutos: '',
  eh_pacote: false,
  quantidade_sessoes: '',
  validade_dias: '',
};

function Servicos({ empresa, empresaId }) {
  const moeda = empresa?.moeda === 'jpy' ? 'jpy' : 'brl';
  const simbolo = SIMBOLO_MOEDA[moeda];
  const casasDecimais = moeda === 'jpy' ? '1' : '0.01';

  const [servicos, setServicos] = useState([]);
  const [pacotes, setPacotes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState(NOVO_VAZIO);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [trocandoFotoId, setTrocandoFotoId] = useState(null);

  useEffect(() => {
    buscarCatalogo();
  }, []);

  const buscarCatalogo = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [{ data: dadosServicos, error: erroServicos }, { data: dadosPacotes, error: erroPacotes }] = await Promise.all([
        supabase
          .from('servicos')
          .select('id, nome, descricao, preco_minimo, preco_maximo, duracao_minutos, imagem_url, criado_em')
          .eq('eh_pacote', false)
          .order('criado_em', { ascending: false }),
        supabase
          .from('servicos')
          .select('id, nome, descricao, preco_minimo, quantidade_sessoes, validade_dias, ativo, imagem_url, criado_em')
          .eq('eh_pacote', true)
          .order('criado_em', { ascending: false }),
      ]);
      if (erroServicos) throw erroServicos;
      if (erroPacotes) throw erroPacotes;
      setServicos(dadosServicos || []);
      setPacotes(dadosPacotes || []);
    } catch (e) {
      setErro(`Não consegui carregar os serviços: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNovo({ ...novo, [name]: type === 'checkbox' ? checked : value });
  };

  const handleAdicionar = async (e) => {
    e.preventDefault();
    if (!novo.nome.trim()) {
      setErro('Preencha ao menos o nome do serviço.');
      return;
    }
    if (novo.preco_minimo === '' || Number(novo.preco_minimo) < 0) {
      setErro('Informe o preço.');
      return;
    }
    if (!novo.eh_pacote && novo.preco_maximo !== '' && Number(novo.preco_maximo) < Number(novo.preco_minimo)) {
      setErro('O preço máximo não pode ser menor que o preço mínimo.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      let imagemUrl = null;
      if (arquivoImagem) {
        imagemUrl = await enviarImagemTenant(empresaId, arquivoImagem, 'servicos');
      }

      const linha = novo.eh_pacote
        ? {
            nome: novo.nome.trim(),
            descricao: novo.descricao.trim() || null,
            preco_minimo: Number(novo.preco_minimo),
            duracao_minutos: null,
            eh_pacote: true,
            ativo: true,
            quantidade_sessoes: novo.quantidade_sessoes !== '' ? Number(novo.quantidade_sessoes) : null,
            validade_dias: novo.validade_dias !== '' ? Number(novo.validade_dias) : null,
            imagem_url: imagemUrl,
          }
        : {
            nome: novo.nome.trim(),
            descricao: novo.descricao.trim() || null,
            preco_minimo: Number(novo.preco_minimo),
            preco_maximo: novo.preco_maximo !== '' ? Number(novo.preco_maximo) : null,
            duracao_minutos: novo.duracao_minutos !== '' ? Number(novo.duracao_minutos) : null,
            imagem_url: imagemUrl,
          };

      const { error } = await supabase.from('servicos').insert([linha]);
      if (error) throw error;
      setNovo(NOVO_VAZIO);
      setArquivoImagem(null);
      buscarCatalogo();
    } catch (e) {
      setErro(`Não consegui adicionar: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleTrocarFoto = async (id, arquivo) => {
    if (!arquivo) return;
    setTrocandoFotoId(id);
    setErro('');
    try {
      const imagemUrl = await enviarImagemTenant(empresaId, arquivo, 'servicos');
      const { error } = await supabase.from('servicos').update({ imagem_url: imagemUrl }).eq('id', id);
      if (error) throw error;
      buscarCatalogo();
    } catch (e) {
      setErro(`Não consegui trocar a foto: ${e.message}`);
    } finally {
      setTrocandoFotoId(null);
    }
  };

  const handleDeletar = async (id) => {
    if (!window.confirm('Remover este item?')) return;
    try {
      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (error) throw error;
      buscarCatalogo();
    } catch (e) {
      setErro(`Não consegui remover: ${e.message}`);
    }
  };

  const handleAlternarAtivoPacote = async (id, ativoAtual) => {
    try {
      const { error } = await supabase.from('servicos').update({ ativo: !ativoAtual }).eq('id', id);
      if (error) throw error;
      buscarCatalogo();
    } catch (e) {
      setErro(`Não consegui atualizar o pacote: ${e.message}`);
    }
  };

  return (
    <div className="page-container">
      <h2>Serviços</h2>

      <section className="form-section">
        <h3>Adicionar</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          Cadastre aqui os serviços que sua barbearia oferece (corte, barba, coloração
          etc.), ou marque a caixa abaixo para cadastrar um pacote (ex: "5 cortes por
          {` ${simbolo}15.000`}, válido por 90 dias"). É esse catálogo que aparece na
          Agenda e no site público de agendamento.
        </p>
        <form onSubmit={handleAdicionar}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#d4af37', marginBottom: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="eh_pacote"
              checked={novo.eh_pacote}
              onChange={handleInputChange}
            />
            É um pacote?
          </label>
          <input
            type="text"
            name="nome"
            placeholder={novo.eh_pacote ? 'Nome do pacote' : 'Nome do serviço'}
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
          {novo.eh_pacote ? (
            <>
              <input
                type="number"
                name="quantidade_sessoes"
                placeholder="Quantidade de sessões (vazio = ilimitado)"
                min="0"
                value={novo.quantidade_sessoes}
                onChange={handleInputChange}
              />
              <input
                type="number"
                name="validade_dias"
                placeholder="Validade em dias (opcional)"
                min="0"
                value={novo.validade_dias}
                onChange={handleInputChange}
              />
            </>
          ) : (
            <>
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
            </>
          )}
          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginTop: '10px', marginBottom: '4px' }}>
            Foto (opcional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setArquivoImagem(e.target.files?.[0] || null)}
          />
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : (novo.eh_pacote ? 'Adicionar pacote' : 'Adicionar serviço')}
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
                  <th>Foto</th>
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
                    <td>
                      {s.imagem_url ? (
                        <img
                          src={s.imagem_url}
                          alt={s.nome}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                      />
                      ) : (
                        <span style={{ color: '#666', fontSize: '12px' }}>-</span>
                      )}
                      <br />
                      <label style={{ fontSize: '11px', color: '#d4af37', cursor: 'pointer' }}>
                        {trocandoFotoId === s.id ? 'Enviando...' : 'Trocar foto'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={trocandoFotoId === s.id}
                          onChange={(e) => handleTrocarFoto(s.id, e.target.files?.[0])}
                        />
                      </label>
                    </td>
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

      <section className="list-section">
        <h3>Seus pacotes</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>Carregando...</p>
        ) : pacotes.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum pacote cadastrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Preço ({simbolo})</th>
                  <th>Sessões</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {pacotes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.imagem_url ? (
                        <img
                          src={p.imagem_url}
                          alt={p.nome}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      ) : (
                        <span style={{ color: '#666', fontSize: '12px' }}>-</span>
                      )}
                      <br />
                      <label style={{ fontSize: '11px', color: '#d4af37', cursor: 'pointer' }}>
                        {trocandoFotoId === p.id ? 'Enviando...' : 'Trocar foto'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={trocandoFotoId === p.id}
                          onChange={(e) => handleTrocarFoto(p.id, e.target.files?.[0])}
                        />
                      </label>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{p.nome}</td>
                    <td>{p.descricao || '-'}</td>
                    <td>{formatarValor(p.preco_minimo, moeda)}</td>
                    <td>{p.quantidade_sessoes == null ? 'Ilimitado' : p.quantidade_sessoes}</td>
                    <td>{p.validade_dias == null ? '-' : `${p.validade_dias} dias`}</td>
                    <td>
                      <button
                        onClick={() => handleAlternarAtivoPacote(p.id, p.ativo)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${p.ativo ? '#4ade80' : '#666'}`,
                          color: p.ativo ? '#4ade80' : '#999',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {p.ativo ? 'Ativo' : 'Pausado'}
                      </button>
                    </td>
                    <td>
                      <button className="btn-delete" onClick={() => handleDeletar(p.id)}>
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
