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

// nome/descricao continuam em pt-BR e são a chave usada para gravar no banco
// e casar seleção em todo o app (Admin, Comandas etc.) — não mexer nelas.
// nomeEn/nomeJa/descricaoEn/descricaoJa são só para exibição no App Público
// quando o cliente troca o idioma (ver getNomeServico/getDescricaoServico).
export const SERVICOS = [
  { id: 1, uuid: '3f905b1f-61b6-4749-870a-cbe485e39fec', nome: 'Corte', nomeEn: 'Haircut', nomeJa: 'カット', nomeEs: 'Corte', preco: 4000, duracao: '40 min', duracaoMinutos: 40, descricao: 'Corte de cabelo masculino', descricaoEn: "Men's haircut", descricaoJa: 'メンズカット', descricaoEs: 'Corte de cabello masculino', imagem: '/images/servico_corte.jpg', profissionaisIds: [1, 2] },
  { id: 2, uuid: '68b86906-5816-4532-a4ac-6487531f872f', nome: 'Corte + Sobrancelhas', nomeEn: 'Haircut + Eyebrows', nomeJa: 'カット+眉毛', nomeEs: 'Corte + Cejas', preco: 4500, duracao: '45 min', duracaoMinutos: 45, descricao: 'Corte completo com design de sobrancelhas', descricaoEn: 'Full haircut with eyebrow shaping', descricaoJa: '眉毛デザイン付きのフルカット', descricaoEs: 'Corte completo con diseño de cejas', imagem: '/images/servico_corte_sobrancelhas.jpg', profissionaisIds: [1, 2] },
  { id: 3, uuid: 'b38f864d-e4f6-44e3-a03b-4706c7984306', nome: 'Corte + Barba', nomeEn: 'Haircut + Beard', nomeJa: 'カット+ひげ', nomeEs: 'Corte + Barba', preco: 6500, duracao: '60 min', duracaoMinutos: 60, descricao: 'Corte e modelagem profissional de barba', descricaoEn: 'Haircut with professional beard styling', descricaoJa: 'プロによるひげ整え付きカット', descricaoEs: 'Corte y modelado profesional de barba', imagem: '/images/servico_corte_barba.jpg', profissionaisIds: [1, 2] },
  { id: 9, uuid: '952520f0-c52d-4c9e-b6c5-5a663051f0be', nome: 'Barba', nomeEn: 'Beard', nomeJa: 'ひげ', nomeEs: 'Barba', preco: 4000, duracao: '40 min', duracaoMinutos: 40, descricao: 'Modelagem e acabamento profissional de barba', descricaoEn: 'Professional beard styling and finishing', descricaoJa: 'プロによるひげ整え・仕上げ', descricaoEs: 'Modelado y acabado profesional de barba', imagem: '/images/servico_corte_barba.jpg', profissionaisIds: [1, 2] },
  { id: 4, uuid: '21a0d4eb-ee51-4124-a84b-34c3bdf307dc', nome: 'Coloração', nomeEn: 'Hair Coloring', nomeJa: 'カラーリング', nomeEs: 'Coloración', preco: 15000, duracao: '180 min', duracaoMinutos: 180, descricao: 'Coloração profissional com tratamento', descricaoEn: 'Professional coloring with treatment', descricaoJa: 'トリートメント付きプロのカラーリング', descricaoEs: 'Coloración profesional con tratamiento', imagem: '/images/servico_coloracao.jpg', profissionaisIds: [1, 3] },
  { id: 5, uuid: '2f4ab333-ba87-40f5-9c3a-3dd911104130', nome: 'Alisamento', nomeEn: 'Hair Straightening', nomeJa: '縮毛矯正', nomeEs: 'Alisado', preco: 15000, duracao: '180 min', duracaoMinutos: 180, descricao: 'Alisamento e tratamento capilar', descricaoEn: 'Straightening with hair treatment', descricaoJa: 'トリートメント付き縮毛矯正', descricaoEs: 'Alisado con tratamiento capilar', imagem: '/images/servico_alisamento.jpg', profissionaisIds: [3] },
  { id: 6, uuid: '3ccdf5fc-eda5-4c09-9d19-19bcb7ee044a', nome: 'Corte Feminino', nomeEn: "Women's Haircut", nomeJa: 'レディースカット', nomeEs: 'Corte Femenino', preco: 4000, duracao: '45 min', duracaoMinutos: 45, descricao: 'Corte moderno feminino', descricaoEn: "Modern women's haircut", descricaoJa: 'モダンなレディースカット', descricaoEs: 'Corte femenino moderno', imagem: '/images/servico_corte_feminino.jpg', profissionaisIds: [3] },
  { id: 7, uuid: '47d96756-2f6c-48ed-82f6-da80e0166b96', nome: 'Permanente', nomeEn: 'Perm', nomeJa: 'パーマ', nomeEs: 'Permanente', preco: 6000, duracao: '150 min', duracaoMinutos: 150, descricao: 'Permanente enrolado profissional', descricaoEn: 'Professional curl perm', descricaoJa: 'プロによる巻きパーマ', descricaoEs: 'Permanente rizado profesional', imagem: '/images/servico_permanente.jpg', profissionaisIds: [2, 3] },
  { id: 8, uuid: '1b3d936d-e4ff-4ab0-8bb5-78c6139230c2', nome: 'Limpeza de Pele', nomeEn: 'Skin Cleansing', nomeJa: '肌クレンジング', nomeEs: 'Limpieza Facial', preco: 5000, duracao: '45 min', duracaoMinutos: 45, descricao: 'Limpeza facial profunda', descricaoEn: 'Deep facial cleansing', descricaoJa: 'ディープフェイシャルクレンジング', descricaoEs: 'Limpieza facial profunda', imagem: '/images/servico_limpeza_pele.jpg', profissionaisIds: [3] },
];

export const getServicoPorNome = (nome) => SERVICOS.find(s => s.nome === nome);
export const getServicoPorUuid = (uuid) => SERVICOS.find(s => s.uuid === uuid);

// Nome/descrição exibidos no App Público, no idioma atual (o campo `nome`
// pt-BR continua sendo o valor real gravado no banco e usado para casar
// seleções — isto aqui é só para o texto que o cliente vê).
export const getNomeServico = (servico, idioma) => {
  if (idioma === 'en') return servico.nomeEn || servico.nome;
  if (idioma === 'ja') return servico.nomeJa || servico.nome;
  if (idioma === 'es') return servico.nomeEs || servico.nome;
  return servico.nome;
};

export const getDescricaoServico = (servico, idioma) => {
  if (idioma === 'en') return servico.descricaoEn || servico.descricao;
  if (idioma === 'ja') return servico.descricaoJa || servico.descricao;
  if (idioma === 'es') return servico.descricaoEs || servico.descricao;
  return servico.descricao;
};
