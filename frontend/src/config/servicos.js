// ============================================================================
// Catálogo central de serviços da Kaizen Barber (preço, duração e quais
// profissionais realizam cada um). Fonte única de verdade — tanto a agenda
// pública (ClientePublico.jsx) quanto o painel administrativo (Agendamentos.jsx)
// leem daqui, para nunca mais ficarem dessincronizados (ex: durações diferentes
// em cada tela, causando conflitos de horário não detectados).
//
// profissionaisIds usa os mesmos ids de config/profissionais mais abaixo
// (1 = Marco Kaizen, 2 = Gabriel Little Kaizen, 3 = Neia).
// ============================================================================

export const SERVICOS = [
  { id: 1, uuid: '3f905b1f-61b6-4749-870a-cbe485e39fec', nome: 'Corte', preco: 4000, duracao: '40 min', duracaoMinutos: 40, descricao: 'Corte de cabelo masculino', imagem: '/images/servico_corte.jpg', profissionaisIds: [1, 2] },
  { id: 2, uuid: '68b86906-5816-4532-a4ac-6487531f872f', nome: 'Corte + Sobrancelhas', preco: 4500, duracao: '45 min', duracaoMinutos: 45, descricao: 'Corte completo com design de sobrancelhas', imagem: '/images/servico_corte_sobrancelhas.jpg', profissionaisIds: [1, 2] },
  { id: 3, uuid: 'b38f864d-e4f6-44e3-a03b-4706c7984306', nome: 'Corte + Barba', preco: 6500, duracao: '60 min', duracaoMinutos: 60, descricao: 'Corte e modelagem profissional de barba', imagem: '/images/servico_corte_barba.jpg', profissionaisIds: [1, 2] },
  { id: 4, uuid: '21a0d4eb-ee51-4124-a84b-34c3bdf307dc', nome: 'Coloração', preco: 15000, duracao: '180 min', duracaoMinutos: 180, descricao: 'Coloração profissional com tratamento', imagem: '/images/servico_coloracao.jpg', profissionaisIds: [1, 3] },
  { id: 5, uuid: '2f4ab333-ba87-40f5-9c3a-3dd911104130', nome: 'Alisamento', preco: 15000, duracao: '180 min', duracaoMinutos: 180, descricao: 'Alisamento e tratamento capilar', imagem: '/images/servico_alisamento.jpg', profissionaisIds: [3] },
  { id: 6, uuid: '3ccdf5fc-eda5-4c09-9d19-19bcb7ee044a', nome: 'Corte Feminino', preco: 4000, duracao: '45 min', duracaoMinutos: 45, descricao: 'Corte moderno feminino', imagem: '/images/servico_corte_feminino.jpg', profissionaisIds: [3] },
  { id: 7, uuid: '47d96756-2f6c-48ed-82f6-da80e0166b96', nome: 'Permanente', preco: 6000, duracao: '150 min', duracaoMinutos: 150, descricao: 'Permanente enrolado profissional', imagem: '/images/servico_permanente.jpg', profissionaisIds: [2, 3] },
  { id: 8, uuid: '1b3d936d-e4ff-4ab0-8bb5-78c6139230c2', nome: 'Limpeza de Pele', preco: 5000, duracao: '45 min', duracaoMinutos: 45, descricao: 'Limpeza facial profunda', imagem: '/images/servico_limpeza_pele.jpg', profissionaisIds: [3] },
];

export const getServicoPorNome = (nome) => SERVICOS.find(s => s.nome === nome);
export const getServicoPorUuid = (uuid) => SERVICOS.find(s => s.uuid === uuid);
