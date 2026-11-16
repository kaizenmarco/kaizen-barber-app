# Kaizen Reels

Motor que gera Reels verticais (1080x1920) no estilo "texto animado + objetos 3D +
raios de velocidade + cortes rápidos", com as cores lime/preto.

## Gerar um vídeo

```bash
node marketing/reels/render.mjs                        # roteiro 01
node marketing/reels/render.mjs roteiros/02-novo.js    # outro roteiro
```

Saída em `marketing/reels/out/`:
- `<nome>.mp4`: com batida e efeitos sonoros (whoosh nos cortes, impactos)
- `<nome>-sem-som.mp4`: para colocar áudio em alta do Instagram ou a sua voz

Prévia ao vivo no navegador: sirva a raiz do repositório e abra
`/marketing/reels/engine/stage.html?previa&roteiro=../roteiros/01-agenda-online.js`.

## Criar um vídeo novo

1. Copie `roteiros/01-agenda-online.js` para `roteiros/02-....js`.
2. Troque `nome`, os textos (`linhas`), fundos, objetos e widgets de cada cena.
   A lista de opções está no topo do arquivo.
3. Rode o render.

Regras que fazem o estilo funcionar:
- Cada cena tem de 1 a 2 segundos e no máximo 3 linhas de texto.
- Alterne os fundos (escuro → claro → lime) para cada corte "estalar".
- Primeira cena é o gancho, sempre com `raios` + `flash`.
- Texto fica no terço de cima; objeto no meio; nada abaixo de y=1700
  (a interface do Instagram cobre o rodapé).

## Arquivos

- `engine/engine.js`: fundos, texto animado, objetos e widgets (celular, cartões
  de barbeiros, cardápio, WhatsApp, número 3D, preço, link, logo)
- `engine/stage.html`: página que carrega fontes, imagens e o roteiro
- `assets/*.png`: objetos 3D recortados (tesoura, máquina, poste, relógio, navalha)
- Fotos reais vêm de `frontend/public/images/`
- `fonts/`: Anton e Inter (licença OFL)
