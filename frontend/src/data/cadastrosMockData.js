// ============================================================================
// Dados MOCKADOS do módulo de Cadastros (Serviços / Produtos / Pacotes).
//
// Propositalmente separados da camada de UI (Cadastros.jsx) — nenhuma dessas
// listas vem do Supabase ainda. Servem só pra prototipar a tela; quando
// quiser conectar de verdade, é só trocar os useState(...MOCK) por buscas
// reais (ex: supabase.from('produtos').select(...)) sem mexer nos
// componentes visuais.
// ============================================================================

export const SERVICOS_MOCK = [
  { id: 's1', nome: 'Corte', descricao: 'Corte de cabelo masculino tradicional', preco: 4000, duracaoMinutos: 40, ativo: true },
  { id: 's2', nome: 'Corte + Barba', descricao: 'Corte completo com modelagem profissional de barba', preco: 6500, duracaoMinutos: 60, ativo: true },
  { id: 's3', nome: 'Corte + Sobrancelhas', descricao: 'Corte completo com design de sobrancelhas', preco: 4500, duracaoMinutos: 45, ativo: true },
  { id: 's4', nome: 'Coloração', descricao: 'Coloração profissional com tratamento capilar', preco: 15000, duracaoMinutos: 180, ativo: true },
  { id: 's5', nome: 'Alisamento', descricao: 'Alisamento e tratamento capilar', preco: 15000, duracaoMinutos: 180, ativo: false },
];

export const PRODUTOS_MOCK = [
  { id: 'p1', nome: 'Pomada Modeladora', descricao: 'Fixação forte, acabamento fosco', preco: 3200, estoque: 14 },
  { id: 'p2', nome: 'Óleo para Barba', descricao: 'Hidratação e brilho, 30ml', preco: 2800, estoque: 6 },
  { id: 'p3', nome: 'Shampoo Anticaspa', descricao: 'Uso profissional, 300ml', preco: 2500, estoque: 0 },
  { id: 'p4', nome: 'Cera Modeladora', descricao: 'Efeito matte, longa duração', preco: 2900, estoque: 21 },
];

export const MEUS_PACOTES_MOCK = [
  { id: 'pk1', nome: 'Pacote 4 Cortes', descricao: '4 cortes com 10% de desconto', preco: 14400, quantidadeSessoes: 4, validadeDias: 90, ativo: true },
  { id: 'pk2', nome: 'Pacote Barba Ilimitada', descricao: 'Barba ilimitada por 1 mês', preco: 12000, quantidadeSessoes: null, validadeDias: 30, ativo: true },
  { id: 'pk3', nome: 'Pacote Casal', descricao: '2 cortes + 2 barbas', preco: 18000, quantidadeSessoes: 4, validadeDias: 60, ativo: false },
];

export const VENDAS_PACOTES_MOCK = [
  { id: 'v1', cliente: 'Flavio Yanagizawa', pacote: 'Pacote 4 Cortes', dataVenda: '2026-08-20', sessoesRestantes: 3 },
  { id: 'v2', cliente: 'Kenji Tanaka', pacote: 'Pacote Barba Ilimitada', dataVenda: '2026-08-15', sessoesRestantes: null },
  { id: 'v3', cliente: 'Marco Kaizen', pacote: 'Pacote 4 Cortes', dataVenda: '2026-07-30', sessoesRestantes: 1 },
];
