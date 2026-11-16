// Capa do Reel 01. Texto dentro da faixa central (o perfil do Instagram corta para 3:4).
window.ROTEIRO = {
  nome: 'capa-01-agenda',
  cenas: [{
    dur: 3, fundo: 'raios', textoY: 330,
    linhas: [
      { txt: 'PARE DE MARCAR', estilo: 'branco', tam: 130, em: 0 },
      { txt: 'CORTE', estilo: 'lime', tam: 300, em: 0 },
      { txt: 'POR MENSAGEM', estilo: 'bloco', tam: 130, em: 0 },
    ],
    objetos: [
      { img: 'tesoura', anim: 'pop', x: 290, y: 1170, h: 480, rot: -18, em: 0, brilho: true },
      { img: 'maquina', anim: 'pop', x: 790, y: 1160, h: 520, rot: 14, em: 0 },
    ],
    widgets: [{ tipo: 'preco', txt: 'AGENDE PELO CELULAR', y: 1470, rot: -3, em: 0, cor: 'lime' }],
  }],
};
