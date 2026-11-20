// Gera uma cópia quadrada e pequena (padrão 240px) de uma imagem para o
// carimbo do cartão fidelidade. O cartão repete o carimbo em cada selo; uma
// logo de 1000px+ deixaria o cartão lento no celular.
// Aceita um File (upload) ou uma URL pública (logo já cadastrada — o
// storage do Supabase responde com CORS liberado). Devolve um File PNG.
export async function reduzirImagemQuadrada(origem, lado = 240) {
  const url = typeof origem === 'string' ? origem : URL.createObjectURL(origem);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      el.src = url;
    });
    const menor = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = lado;
    canvas.height = lado;
    canvas.getContext('2d').drawImage(
      img,
      (img.naturalWidth - menor) / 2, (img.naturalHeight - menor) / 2, menor, menor,
      0, 0, lado, lado,
    );
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png',
    ));
    return new File([blob], 'carimbo.png', { type: 'image/png' });
  } finally {
    if (typeof origem !== 'string') URL.revokeObjectURL(url);
  }
}
