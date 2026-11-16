// ============================================================================
// Exporta um roteiro do Kaizen Reels Engine para MP4 (1080x1920, 30fps),
// com trilha de efeitos sonoros sincronizada aos cortes.
//
// Uso (a partir da raiz do repositório):
//   node marketing/reels/render.mjs                       -> roteiro 01
//   node marketing/reels/render.mjs roteiros/02-x.js      -> outro roteiro
//   node marketing/reels/render.mjs roteiros/02-x.js --fps 60 --sem-audio
//
// Requer: Node 18+, ffmpeg no PATH e o pacote "playwright" com Chromium.
// Saída: marketing/reels/out/<nome>.mp4 (+ <nome>-sem-som.mp4)
// ============================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gerarTrilha, salvarWav } from './engine/trilha-epica.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const args = process.argv.slice(2);
const roteiro = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) || 'roteiros/01-agenda-online.js';
const FPS = Number(args[args.indexOf('--fps') + 1]) || 30;
const SEM_AUDIO = args.includes('--sem-audio');
const SAIDA = path.join(AQUI, 'out');
fs.mkdirSync(SAIDA, { recursive: true });

// ---------- servidor estático (raiz do repo) ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const servidor = http.createServer((req, res) => {
  const p = path.normalize(path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(RAIZ) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const porta = servidor.address().port;

function rodar(cmd, argv, stdinFn) {
  return new Promise((ok, erro) => {
    const pr = spawn(cmd, argv, { stdio: [stdinFn ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let log = ''; pr.stderr.on('data', d => { log += d; });
    pr.on('close', c => c === 0 ? ok() : erro(new Error(`${cmd} falhou (${c}):\n${log.slice(-2000)}`)));
    if (stdinFn) stdinFn(pr.stdin);
  });
}

// ---------- vídeo ----------
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
pagina.on('pageerror', e => console.error('Erro na página:', e.message));
await pagina.goto(`http://127.0.0.1:${porta}/marketing/reels/engine/stage.html?roteiro=../${roteiro}`);
const info = await pagina.evaluate(() => window.pronto);
const iCapa = args.indexOf('--capa');
if (iCapa >= 0) {
  // capa: um único quadro em PNG, no instante pedido (padrão 2 s, com tudo já na tela)
  const T = Number(args[iCapa + 1]) || 2;
  await pagina.evaluate(T => window.desenhar(T), T);
  const png = path.join(SAIDA, `${info.nome}.png`);
  await pagina.locator('#c').screenshot({ path: png });
  console.log('Capa:', path.relative(RAIZ, png));
  await navegador.close(); servidor.close(); process.exit(0);
}
const total = Math.round(info.duracao * FPS);
console.log(`Roteiro "${info.nome}": ${info.duracao.toFixed(2)}s, ${info.cenas.length} cenas, ${total} frames`);

const mudo = path.join(SAIDA, `${info.nome}-sem-som.mp4`);
await rodar('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mudo], async (stdin) => {
  for (let f = 0; f < total; f++) {
    const url = await pagina.evaluate(T => window.desenhar(T), f / FPS);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!stdin.write(buf)) await new Promise(ok => stdin.once('drain', ok));
    if (f % FPS === 0) process.stdout.write(`\r  frames ${f}/${total}`);
  }
  stdin.end();
});
console.log(`\r  frames ${total}/${total} ✓`);
await navegador.close(); servidor.close();

// ---------- áudio: batida + whoosh nos cortes + impactos ----------
if (!SEM_AUDIO && info.audio) {
  // Roteiro com voz própria + trilha épica: a música "abaixa" sozinha quando a voz fala (sidechain)
  const trilha = gerarTrilha({ duracao: info.duracao, ...info.audio.trilha });
  const trilhaPath = path.join(SAIDA, `${info.nome}-trilha.wav`);
  salvarWav(trilhaPath, trilha, fs);
  const voz = path.join(AQUI, info.audio.voz);
  const final = path.join(SAIDA, `${info.nome}.mp4`);
  await rodar('ffmpeg', ['-y', '-loglevel', 'error', '-i', mudo, '-i', voz, '-i', trilhaPath, '-filter_complex',
    '[1:a]aformat=channel_layouts=stereo,asplit=2[v1][vsc];' +
    `[2:a]volume=${info.audio.volumeTrilha ?? 0.55}[m];` +
    '[m][vsc]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[mduck];' +
    '[v1][mduck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final]);
  fs.renameSync(trilhaPath, path.join(SAIDA, `${info.nome}-so-musica.wav`));
  console.log('Pronto:', path.relative(RAIZ, final));
} else if (!SEM_AUDIO) {
  const SR = 44100, N = Math.ceil((info.duracao + 0.3) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  let seed = 1; const ruido = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan); R[i] += v * (1 + pan); } };

  const BPM = 124, beat = 60 / BPM;
  for (let b = 0; b * beat < info.duracao; b++) {
    const t0 = Math.round(b * beat * SR);
    // kick
    let fase = 0;
    for (let i = 0; i < 0.32 * SR; i++) {
      const tt = i / SR, f = 45 + 110 * Math.exp(-tt * 30);
      fase += 2 * Math.PI * f / SR; add(t0 + i, Math.sin(fase) * Math.exp(-tt * 9) * 0.9);
    }
    // clap nos tempos 2 e 4
    if (b % 2 === 1) for (let i = 0; i < 0.16 * SR; i++) { const tt = i / SR; add(t0 + i, ruido() * Math.exp(-tt * 28) * 0.28, (b % 4 === 1 ? -0.2 : 0.2)); }
    // chimbal no contratempo
    const th = t0 + Math.round(beat / 2 * SR); let ant = 0;
    for (let i = 0; i < 0.05 * SR; i++) { const n = ruido(); add(th + i, (n - ant) * Math.exp(-(i / SR) * 90) * 0.12, 0.3); ant = n; }
  }
  // whoosh antes de cada corte + impacto nas cenas marcadas
  info.cortes.forEach((c, k) => {
    if (k > 0) {
      const ini = Math.round((c - 0.22) * SR), len = Math.round(0.42 * SR); let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, env = x < 0.53 ? Math.pow(x / 0.53, 2) : Math.exp(-(x - 0.53) * 9);
        const a = 0.02 + 0.5 * env; lp += a * (ruido() - lp);
        add(ini + i, lp * env * 0.9, Math.sin(x * Math.PI) * 0.5 - 0.25);
      }
    }
  });
  // impactos: cenas com impacto/flash
  info.cenas.forEach((cena, k) => {
    if (!cena.impacto) return;
    const t0 = Math.round(info.cortes[k] * SR); let fase = 0;
    for (let i = 0; i < 0.6 * SR; i++) {
      const tt = i / SR; fase += 2 * Math.PI * (38 + 60 * Math.exp(-tt * 12)) / SR;
      add(t0 + i, Math.sin(fase) * Math.exp(-tt * 5) * 0.8 + ruido() * Math.exp(-tt * 22) * 0.35);
    }
  });
  // normaliza com saturação suave
  let pico = 0; for (let i = 0; i < N; i++) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]));
  const wav = Buffer.alloc(44 + N * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    wav.writeInt16LE(Math.round(Math.tanh(L[i] / pico * 1.3) * 0.85 * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(Math.tanh(R[i] / pico * 1.3) * 0.85 * 32767), 46 + i * 4);
  }
  const wavPath = path.join(SAIDA, `${info.nome}-trilha.wav`);
  fs.writeFileSync(wavPath, wav);
  const final = path.join(SAIDA, `${info.nome}.mp4`);
  await rodar('ffmpeg', ['-y', '-loglevel', 'error', '-i', mudo, '-i', wavPath, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final]);
  fs.unlinkSync(wavPath);
  console.log('Pronto:', path.relative(RAIZ, final));
}
console.log('Sem som (para usar áudio do Instagram ou sua voz):', path.relative(RAIZ, mudo));
