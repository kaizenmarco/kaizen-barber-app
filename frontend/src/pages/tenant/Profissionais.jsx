import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClientTenant';

// Cadastro de profissionais MULTI-TENANT: cada empresa vê e gerencia só os
// seus próprios profissionais (empresa_id preenchido automaticamente pelo
// banco, isolado por RLS — mesmo padrão de Clientes/Dashboard). Ainda não
// cria um login separado para o profissional entrar sozinho no sistema —
// isso fica para uma etapa futura; por enquanto é só o cadastro (nome,
// telefone, comissão) que a Agenda/Comandas vão usar quando existirem.
//
// O limite de quantos profissionais podem ser cadastrados é amarrado ao
// que a empresa realmente contratou no Stripe: 1 profissional incluído no
// Básico/Intermediário + os adicionais pagos (profissionais_extras); o
// Completo não tem limite.

const PROFISSIONAIS_INCLUIDOS_POR_PLANO = {
  basico: 1,
  intermediario: 1,
  completo: Infinity,
};

function calcularLimite(empresa) {
  const incluidos = PROFISSIONAIS_INCLUIDOS_POR_PLANO[empresa?.plano] ?? 1;
  if (incluidos === Infinity) return Infinity;
  return incluidos + (empresa?.profissionais_extras || 0);
}

function Profissionais({ empresa }) {
  const [profissionais, setProfissionais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', telefone: '', comissao_percentual: '' });

  const limite = calcularLimite(empresa);
  const limiteAtingido = Number.isFinite(limite) && profissionais.length >= limite;

  useEffect(() => {
    buscarProfissionais();
  }, []);

  const buscarProfissionais = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data, error } = await supabase
        .from('profissionais')
        .select('id, nome, telefone, comissao_percentual, criado_em')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      setProfissionais(data || []);
    } catch (e) {
      setErro(`Não consegui carregar os profissionais: ${e.message}`);
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
      setErro('Preencha ao menos o nome do profissional.');
      return;
    }
    if (limiteAtingido) {
      setErro('Você já usou todas as vagas de profissionais do seu plano. Adicione mais vagas ou faça upgrade para cadastrar mais.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const { error } = await supabase.from('profissionais').insert([
        {
          nome: novo.nome.trim(),
          telefone: novo.telefone.trim() || null,
          comissao_percentual: novo.comissao_percentual ? Number(novo.comissao_percentual) : null,
        },
      ]);
      if (error) throw error;
      setNovo({ nome: '', telefone: '', comissao_percentual: '' });
      buscarProfissionais();
    } catch (e) {
      setErro(`Não consegui adicionar: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async (id) => {
    if (!window.confirm('Remover este profissional?')) return;
    try {
      const { error } = await supabase.from('profissionais').delete().eq('id', id);
      if (error) throw error;
      buscarProfissionais();
    } catch (e) {
      setErro(`Não consegui remover: ${e.message}`);
    }
  };

  return (
    <div className="page-container">
      <h2>Profissionais</h2>

      <section className="form-section">
        <h3>Adicionar profissional</h3>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          Cadastre aqui cada profissional que trabalha com você. Isso ainda não cria um
          login separado para ele — é só o registro que a Agenda e o Caixa vão usar mais
          adiante.
        </p>
        <p style={{ fontSize: '13px', color: limiteAtingido ? '#f87171' : '#d4af37', marginBottom: '10px' }}>
          {Number.isFinite(limite)
            ? `${profissionais.length} de ${limite} vaga(s) de profissionais usada(s)`
            : `${profissionais.length} profissional(is) cadastrado(s) — seu plano não tem limite`}
        </p>
        {Number.isFinite(limite) && (
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '14px', fontStyle: 'italic' }}>
            ⚠️ Atenção: essas vagas já contam você mesmo, caso também atenda clientes — não são
            vagas extras além do dono/comprador da assinatura. Ou seja, o limite de {limite} vaga(s)
            já inclui você, se for o caso (não soma +1 só por você ser o proprietário).
          </p>
        )}
        <form onSubmit={handleAdicionar}>
          <input
            type="text"
            name="nome"
            placeholder="Nome do profissional"
            value={novo.nome}
            onChange={handleInputChange}
            required
            disabled={limiteAtingido}
          />
          <input
            type="tel"
            name="telefone"
            placeholder="Telefone (opcional)"
            value={novo.telefone}
            onChange={handleInputChange}
            disabled={limiteAtingido}
          />
          <input
            type="number"
            name="comissao_percentual"
            placeholder="Comissão % (opcional)"
            min="0"
            max="100"
            value={novo.comissao_percentual}
            onChange={handleInputChange}
            disabled={limiteAtingido}
          />
          <button type="submit" className="btn-primary" disabled={salvando || limiteAtingido}>
            {salvando ? 'Salvando...' : 'Adicionar profissional'}
          </button>
        </form>
        {limiteAtingido && (
          <p style={{ color: '#f87171', fontSize: '13px', marginTop: '10px' }}>
            Você atingiu o limite de profissionais do seu plano atual. Para cadastrar mais,
            adicione vagas extras ou faça upgrade de plano.
          </p>
        )}
        {erro && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '10px' }}>{erro}</p>}
      </section>

      <section className="list-section">
        <h3>Seus profissionais</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#d4af37' }}>Carregando...</p>
        ) : profissionais.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>Nenhum profissional cadastrado ainda.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Comissão</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {profissionais.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 'bold' }}>{p.nome}</td>
                    <td>{p.telefone || '-'}</td>
                    <td>{p.comissao_percentual != null ? `${p.comissao_percentual}%` : '-'}</td>
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

export default Profissionais;
