// ============================================================================
// Trilha "épica" sintetizada (sem samples, sem rede): pad cinematográfico,
// baixo pulsante, bateria híbrida (bumbo, caixa, tons, chimbal), "braams",
// impactos e risers. A estrutura é guiada por SEÇÕES (com intensidade) e
// MARCOS (impactos em momentos exatos da fala).
//
//   gerarTrilha({ duracao, bpm, secoes, impactos, risers, braams }) -> {L, R, SR}
//
// secoes:   [{ ini, nivel }]  nivel 0 = só pad, 1 = + baixo, 2 = + bumbo/chimbal,
//                             3 = groove completo com tons, -1 = "quebra" (tensão)
// impactos: [segundos]      boom grave + ruído
// braams:   [segundos]      acorde grave distorcido, longo (momentos de virada)
// risers:   [{ ini, fim }]  subida de ruído/tom antes de uma virada
// ============================================================================
export function gerarTrilha({ duracao, bpm = 100, secoes = [], impactos = [], braams = [], risers = [] }) {
  const SR = 44100, N = Math.ceil((duracao + 2.5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  let seed = 7; const ruido = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan); R[i] += v * (1 + pan); } };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const nivelEm = t => { let n = 0; for (const s of secoes) if (s.ini <= t) n = s.nivel; return n; };
  const beat = 60 / bpm;

  // progressão em Lá menor: Am  F  C  G  (2 compassos cada acorde)
  const acordes = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
  const baixos = [33, 29, 36, 31];
  const compasso = beat * 4;

  // ---------- PAD (serras desafinadas, filtro passa-baixa) ----------
  {
    const fases = new Float64Array(12); let lpL = 0, lpR = 0;
    for (let i = 0; i < N; i++) {
      const t = i / SR, idx = Math.floor(t / (compasso * 2)) % 4;
      const n = nivelEm(t);
      const notas = n === -1 ? [57, 58, 64] : acordes[idx]; // quebra: cluster tenso
      let sL = 0, sR = 0;
      notas.forEach((m, k) => {
        for (let d = 0; d < 4; d++) {
          const j = k * 4 + d, det = [-0.11, -0.04, 0.05, 0.12][d];
          fases[j] += hz(m + det) / SR; fases[j] -= Math.floor(fases[j]);
          const v = 2 * fases[j] - 1;
          if (d % 2) sL += v; else sR += v;
        }
      });
      const corte = 0.02 + 0.05 * Math.min(1, Math.max(0, n) / 3) + 0.01 * Math.sin(t * 0.7);
      lpL += corte * (sL - lpL); lpR += corte * (sR - lpR);
      const amp = (n === -1 ? 0.07 : 0.05) * Math.min(1, t / 2);
      L[i] += lpL * amp; R[i] += lpR * amp;
    }
  }

  // ---------- BAIXO pulsante (colcheias) ----------
  for (let b = 0; b * beat / 2 < duracao; b++) {
    const t0 = b * beat / 2, n = nivelEm(t0); if (n < 1) continue;
    const idx = Math.floor(t0 / (compasso * 2)) % 4, f = hz(baixos[idx]);
    const i0 = Math.round(t0 * SR), len = Math.round(beat / 2 * SR * 0.9);
    let fase = 0, lp = 0;
    for (let i = 0; i < len; i++) {
      fase += f / SR; fase -= Math.floor(fase);
      const v = (2 * fase - 1) * 0.6 + Math.sin(2 * Math.PI * fase) * 0.8;
      lp += 0.08 * (v - lp);
      add(i0 + i, lp * 0.22 * Math.exp(-i / SR * 6) * (b % 2 ? 0.75 : 1));
    }
  }

  // ---------- BATERIA ----------
  const bumbo = (t0, g = 1) => { const i0 = Math.round(t0 * SR); let fase = 0;
    for (let i = 0; i < 0.45 * SR; i++) { const tt = i / SR; fase += 2 * Math.PI * (42 + 120 * Math.exp(-tt * 28)) / SR; add(i0 + i, Math.sin(fase) * Math.exp(-tt * 7) * 0.85 * g); } };
  const caixa = (t0, g = 1) => { const i0 = Math.round(t0 * SR); let fase = 0;
    for (let i = 0; i < 0.3 * SR; i++) { const tt = i / SR; fase += 2 * Math.PI * 190 / SR;
      add(i0 + i, (ruido() * Math.exp(-tt * 16) * 0.45 + Math.sin(fase) * Math.exp(-tt * 30) * 0.3) * g, 0.1); } };
  const tom = (t0, f = 110, g = 1, pan = 0) => { const i0 = Math.round(t0 * SR); let fase = 0;
    for (let i = 0; i < 0.5 * SR; i++) { const tt = i / SR; fase += 2 * Math.PI * (f * (1 + 0.6 * Math.exp(-tt * 20))) / SR;
      add(i0 + i, Math.sin(fase) * Math.exp(-tt * 6) * 0.5 * g + ruido() * Math.exp(-tt * 40) * 0.1 * g, pan); } };
  const chimbal = (t0, g = 1) => { const i0 = Math.round(t0 * SR); let ant = 0;
    for (let i = 0; i < 0.04 * SR; i++) { const n = ruido(); add(i0 + i, (n - ant) * Math.exp(-i / SR * 110) * 0.09 * g, 0.35); ant = n; } };

  for (let s = 0; s * beat / 4 < duracao; s++) {
    const t0 = s * beat / 4, n = nivelEm(t0), pos = s % 16;
    if (n >= 2) {
      if (pos === 0 || pos === 8 || (n >= 3 && (pos === 10 || pos === 3))) bumbo(t0);
      if (pos === 4 || pos === 12) caixa(t0, n >= 3 ? 1 : 0.7);
      if (pos % 2 === 0) chimbal(t0, pos % 4 === 2 ? 1.2 : 0.7);
      if (n >= 3 && (pos === 14 || pos === 15)) tom(t0, pos === 14 ? 140 : 105, 0.8, pos === 14 ? -0.4 : 0.4);
    } else if (n === 1 && pos === 0) {
      tom(t0, 70, 0.9); // pulso grave de "tambor de guerra"
    } else if (n === -1 && pos % 4 === 0) {
      chimbal(t0, 1.8); // tique-taque de tensão
    }
  }

  // ---------- RISERS ----------
  for (const r of risers) {
    const i0 = Math.round(r.ini * SR), len = Math.round((r.fim - r.ini) * SR); let lp = 0, fase = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len, env = Math.pow(x, 2.2);
      lp += (0.03 + 0.5 * x) * (ruido() - lp);
      fase += 2 * Math.PI * (200 + 1400 * x * x) / SR;
      add(i0 + i, (lp * 0.6 + Math.sin(fase) * 0.12) * env * 0.7, Math.sin(x * 12) * 0.3);
    }
  }

  // ---------- BRAAMS ----------
  for (const t0 of braams) {
    const i0 = Math.round(t0 * SR), len = Math.round(2.6 * SR);
    const notas = [33, 40, 45, 48];
    const fases = new Float64Array(notas.length * 3); let lp = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR; let s = 0;
      notas.forEach((m, k) => { for (let d = 0; d < 3; d++) { const j = k * 3 + d;
        fases[j] += hz(m + (d - 1) * 0.08) / SR; fases[j] -= Math.floor(fases[j]); s += 2 * fases[j] - 1; } });
      lp += (0.015 + 0.12 * Math.exp(-tt * 1.5)) * (s - lp);
      const env = Math.min(1, tt / 0.02) * Math.exp(-tt * 1.1);
      add(i0 + i, Math.tanh(lp * 0.9) * env * 0.55);
    }
    bumbo(t0, 1.2);
  }

  // ---------- IMPACTOS ----------
  for (const t0 of impactos) {
    const i0 = Math.round(t0 * SR); let fase = 0, lp = 0;
    for (let i = 0; i < 1.4 * SR; i++) {
      const tt = i / SR; fase += 2 * Math.PI * (32 + 70 * Math.exp(-tt * 9)) / SR;
      lp += 0.2 * (ruido() - lp);
      add(i0 + i, Math.sin(fase) * Math.exp(-tt * 3.2) * 0.9 + lp * Math.exp(-tt * 9) * 0.6);
    }
  }

  // ---------- reverb simples (Schroeder) para dar "sala" ----------
  const combs = [1557, 1617, 1491, 1422], alls = [225, 556];
  const wet = (x) => {
    const out = new Float32Array(N);
    for (const d of combs) { const buf = new Float32Array(d); let p = 0;
      for (let i = 0; i < N; i++) { const y = buf[p]; buf[p] = x[i] + y * 0.8; p = (p + 1) % d; out[i] += y * 0.25; } }
    for (const d of alls) { const buf = new Float32Array(d); let p = 0;
      for (let i = 0; i < N; i++) { const b = buf[p], y = -out[i] + b; buf[p] = out[i] + b * 0.5; p = (p + 1) % d; out[i] = y; } }
    return out;
  };
  const wL = wet(L), wR = wet(R);
  for (let i = 0; i < N; i++) { L[i] += wL[i] * 0.22; R[i] += wR[i] * 0.22; }

  // normalização com saturação suave + fade-out final
  let pico = 0; for (let i = 0; i < N; i++) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]));
  const fimFade = duracao + 2.0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, fade = t > duracao ? Math.max(0, 1 - (t - duracao) / (fimFade - duracao)) : 1;
    L[i] = Math.tanh(L[i] / pico * 1.4) * 0.8 * fade; R[i] = Math.tanh(R[i] / pico * 1.4) * 0.8 * fade;
  }
  return { L, R, SR };
}

export function salvarWav(caminho, { L, R, SR }, fs) {
  const N = L.length, wav = Buffer.alloc(44 + N * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(caminho, wav);
}
