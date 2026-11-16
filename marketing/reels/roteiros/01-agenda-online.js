// ============================================================================
// ROTEIRO 01: "Agenda online da Kaizen"
// Cada cena tem: dur (segundos), fundo, linhas de texto, objetos 3D e widgets.
//
// fundos:   escuro | lime | claro | raios | raiosLime | vermelho | foto
// estilos:  branco | cinza | lime | preto | bloco | blocoPreto
// objetos:  tesoura | maquina | poste | relogio | navalha   (assets/*.png)
//           anim: pop | zoom | tremer | girar | cair
// widgets:  celular | barbeiros | servicos | whatsapp | numero | preco | link | logo
// extras:   selo ("MAIS PEDIDO #1"), impacto (tremida), flash, faiscas (cor)
//
// Para criar um vídeo novo: copie este arquivo, troque os textos e rode
//   node marketing/reels/render.mjs roteiros/02-meu-video.js
// ============================================================================
window.ROTEIRO = {
  nome: 'kaizen-01-agenda-online',
  cenas: [
    { // GANCHO
      dur: 1.7, fundo: 'raios', flash: true,
      linhas: [
        { txt: 'SE VOCÊ AINDA', estilo: 'cinza', tam: 110 },
        { txt: 'MANDA MENSAGEM', estilo: 'lime', tam: 150 },
        { txt: 'PRA MARCAR CORTE', estilo: 'branco', tam: 110 },
      ],
      objetos: [{ img: 'poste', anim: 'zoom', y: 1230, h: 720, rot: -8, brilho: true }],
    },
    { // DOR
      dur: 1.3, fundo: 'claro', impacto: true,
      linhas: [
        { txt: 'VOCÊ TÁ', estilo: 'preto', tam: 120 },
        { txt: 'PERDENDO TEMPO', estilo: 'bloco', tam: 140 },
      ],
      objetos: [{ img: 'relogio', anim: 'tremer', y: 1180, h: 640 }],
      faiscas: '#E3342C',
    },
    { // VIRADA
      dur: 1.7, fundo: 'escuro',
      linhas: [
        { txt: 'NA KAIZEN', estilo: 'branco', tam: 110 },
        { txt: 'VOCÊ AGENDA', estilo: 'lime', tam: 150 },
        { txt: 'PELO CELULAR', estilo: 'branco', tam: 110 },
      ],
      widgets: [{ tipo: 'celular', y: 1290 }],
    },
    {
      dur: 1.6, fundo: 'lime',
      linhas: [
        { txt: 'ESCOLHE', estilo: 'preto', tam: 120 },
        { txt: 'SEU BARBEIRO', estilo: 'blocoPreto', tam: 140 },
      ],
      widgets: [{
        tipo: 'barbeiros', y: 1200, destaque: 1, pessoas: [
          { img: 'marco', nome: 'MARCO', cargo: 'Cortes e barba', offY: -20 },
          { img: 'gabriel', nome: 'GABRIEL', cargo: 'Cortes e permanente' },
          { img: 'neia', nome: 'NEIA', cargo: 'Coloração e estética' },
        ],
      }],
    },
    {
      dur: 1.8, fundo: 'escuro',
      linhas: [
        { txt: 'O SERVIÇO', estilo: 'branco', tam: 120 },
        { txt: 'E O HORÁRIO', estilo: 'lime', tam: 150 },
      ],
      widgets: [{
        tipo: 'servicos', y: 1230, titulo: 'SERVIÇOS', itens: [
          { nome: 'Corte', dur: '45 min', preco: '¥4.000' },
          { nome: 'Corte + Barba', dur: '60 min', preco: '¥6.500', destaque: true },
          { nome: 'Barba', dur: '40 min', preco: '¥4.000' },
          { nome: 'Corte + Sobrancelha', dur: '45 min', preco: '¥4.500' },
        ],
      }],
    },
    {
      dur: 1.7, fundo: 'claro',
      linhas: [
        { txt: 'E AINDA RECEBE', estilo: 'preto', tam: 110 },
        { txt: 'LEMBRETE', estilo: 'bloco', tam: 150 },
        { txt: 'NO WHATSAPP', estilo: 'preto', tam: 110 },
      ],
      widgets: [{
        tipo: 'whatsapp', y: 1330,
        linha1: 'Lembrete do seu horário ✂️',
        linha2: 'Amanhã às 15:00 com o Gabriel.',
        linha3: 'Te esperamos na Kaizen!',
      }],
    },
    { // PADRÃO "E NÃO É SÓ UM..."
      dur: 1.0, fundo: 'raios', flash: true,
      linhas: [
        { txt: 'E NÃO É SÓ', estilo: 'branco', tam: 130 },
        { txt: 'CORTE.', estilo: 'lime', tam: 230 },
      ],
    },
    {
      dur: 1.5, fundo: 'escuro', impacto: true,
      linhas: [{ txt: 'SÃO', estilo: 'lime', tam: 150 }],
      widgets: [{ tipo: 'numero', txt: '9', y: 1080, orbita: ['tesoura', 'maquina', 'navalha', 'poste'] },
                { tipo: 'preco', txt: 'SERVIÇOS', y: 1640, rot: -4, cor: 'lime', em: 0.4 }],
    },
    { // LISTA RÁPIDA
      dur: 1.15, fundo: 'lime', selo: 'MAIS PEDIDO #3',
      linhas: [{ txt: 'CORTE', estilo: 'blocoPreto', tam: 200 }],
      objetos: [{ img: 'tesoura', anim: 'girar', y: 1150, h: 680, rot: -10 }],
      widgets: [{ tipo: 'preco', txt: '¥4.000', y: 1640 }],
    },
    {
      dur: 1.15, fundo: 'escuro', selo: 'MAIS PEDIDO #2',
      linhas: [{ txt: 'BARBA', estilo: 'lime', tam: 220 }],
      objetos: [{ img: 'navalha', anim: 'pop', y: 1150, h: 680, rot: 8, brilho: true }],
      widgets: [{ tipo: 'preco', txt: '¥4.000', y: 1640, cor: 'lime' }],
    },
    {
      dur: 1.4, fundo: 'raiosLime', selo: 'MAIS PEDIDO #1', impacto: true, flash: true,
      linhas: [
        { txt: 'CORTE + BARBA', estilo: 'blocoPreto', tam: 160 },
      ],
      objetos: [{ img: 'maquina', anim: 'zoom', y: 1150, h: 760, rot: -12 }],
      widgets: [{ tipo: 'preco', txt: '¥6.500', y: 1640, rot: 5 }],
      faiscas: '#0A0C09',
    },
    { // CTA
      dur: 2.3, fundo: 'claro',
      linhas: [
        { txt: 'AGENDA AGORA', estilo: 'preto', tam: 140 },
        { txt: 'LINK NA BIO', estilo: 'bloco', tam: 150 },
      ],
      widgets: [{
        tipo: 'link', y: 1250, titulo: 'KAIZEN BARBER', sub: 'Agendamento online',
        url: 'kaizenbarbershop.com', botao: 'AGENDAR HORÁRIO', botaoDepois: '✓ HORÁRIO MARCADO',
      }],
    },
    { // ASSINATURA
      dur: 1.6, fundo: 'raios', flash: true,
      linhas: [
        { txt: 'KAIZEN', estilo: 'lime', tam: 210 },
        { txt: 'BARBER SHOP', estilo: 'branco', tam: 120 },
      ],
      widgets: [{ tipo: 'logo', y: 1230, tam: 600, em: 0.2 }],
    },
  ],
};
