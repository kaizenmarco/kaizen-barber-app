// ============================================================================
// Cadastro central dos profissionais (uuid real do Supabase, nome,
// especialidade, foto e comissão padrão). Fonte única de verdade — evita que
// ClientePublico.jsx, Agendamentos.jsx, Comandas.jsx, Caixa.jsx e
// Profissionais.jsx fiquem com listas soltas e desincronizadas entre si.
//
// `id` numérico (1/2/3) é o mesmo usado em config/servicos.js
// (profissionaisIds), só para facilitar o filtro de "quem faz esse serviço".
// `uuid` é o id real na tabela profissionais do Supabase.
// ============================================================================
import { supabase } from '../supabaseClient';

export const COMISSAO_PADRAO = 40;

export const PROFISSIONAIS = [
  {
    id: 1,
    uuid: '11c0c7fb-e020-4c49-ab0a-28a16109b35f',
    nome: 'Marco Kaizen',
    especialidade: 'Especialista em Cortes e Barba',
    especialidades: 'Cortes, Barba',
    imagem: '/images/marco.jpg',
  },
  {
    id: 2,
    uuid: '66266181-d06b-4f54-bcc9-12dccc100cb4',
    nome: 'Gabriel Little Kaizen',
    especialidade: 'Especialista em Cortes',
    especialidades: 'Cortes, Permanente',
    imagem: '/images/gabriel.jpg',
  },
  {
    id: 3,
    uuid: 'ad232428-9872-46db-82b3-27819ab353ff',
    nome: 'Neia',
    especialidade: 'Especialista em Coloração e Estética',
    especialidades: 'Corte Feminino, Coloração, Alisamento',
    imagem: '/images/neia.jpg',
  },
];

export const getProfissionalPorUuid = (uuid) => PROFISSIONAIS.find(p => p.uuid === uuid);
export const getProfissionalPorNome = (nome) => PROFISSIONAIS.find(p => p.nome === nome);

// Busca a comissão (%) de cada profissional, salva na coluna
// comissao_percentual da tabela profissionais (ver supabase_migracao_caixa.sql).
// Retorna um mapa { [uuid]: percentual }. Em erro, volta ao padrão pra todos.
export const buscarComissoes = async () => {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .select('id, comissao_percentual');

    if (error || !data) {
      throw error || new Error('sem dados');
    }

    const mapa = {};
    PROFISSIONAIS.forEach(p => { mapa[p.uuid] = COMISSAO_PADRAO; });
    data.forEach(row => {
      mapa[row.id] = row.comissao_percentual != null ? Number(row.comissao_percentual) : COMISSAO_PADRAO;
    });
    return mapa;
  } catch (erro) {
    console.error('Erro ao buscar comissões:', erro);
    const mapa = {};
    PROFISSIONAIS.forEach(p => { mapa[p.uuid] = COMISSAO_PADRAO; });
    return mapa;
  }
};

// Salva a comissão (%) de um profissional específico.
export const salvarComissao = async (uuid, percentual) => {
  const { error } = await supabase
    .from('profissionais')
    .update({ comissao_percentual: percentual })
    .eq('id', uuid);

  if (error) throw error;
};
