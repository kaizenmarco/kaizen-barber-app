// ============================================================================
// Kaizen Reels Engine
// Motor de vídeo vertical (1080x1920) no estilo "kinetic typography + objetos
// 3D + raios de velocidade + cortes rápidos". Tudo é desenhado num <canvas>
// a partir de um ROTEIRO (lista de cenas). Cada frame é determinístico:
// renderFrame(t) desenha exatamente o instante t (em segundos), o que permite
// exportar o vídeo frame a frame com o render.mjs.
// ============================================================================
(() => {
  const W = 1080, H = 1920;
  const COR = {
    lime: '#B8F22A', limeClaro: '#D8FF6B', limeEscuro: '#6FA300',
    preto: '#0A0C09', branco: '#F5F5F0', cinza: '#C9CCC3', cinzaEscuro: '#55594F',
    vermelho: '#E3342C', whats: '#25D366',
  };

  // ---------- utilidades ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOutCubic = k => 1 - Math.pow(1 - clamp(k), 3);
  const easeInCubic = k => Math.pow(clamp(k), 3);
  const easeOutBack = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const easeOutElastic = k => { k = clamp(k); if (k === 0 || k === 1) return k; return Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
  const prog = (t, ini, dur) => clamp((t - ini) / dur);
  // pseudo-aleatório determinístico (mesmo frame = mesmo desenho)
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- carregamento de imagens ----------
  const IMG = {};
  async function carregarImagens(mapa) {
    await Promise.all(Object.entries(mapa).map(([nome, src]) => new Promise((ok, erro) => {
      const im = new Image();
      im.onload = () => { IMG[nome] = im; ok(); };
      im.onerror = () => erro(new Error('Imagem não carregou: ' + src));
      im.src = src;
    })));
  }

  // ======================= FUNDOS =======================
  function grade(ctx, T, cor, alpha) {
    // chão quadriculado em perspectiva, andando em direção à câmera
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = cor; ctx.lineWidth = 2;
    const hor = H * 0.62, vx = W / 2;
    for (let i = -14; i <= 14; i++) {
      ctx.beginPath(); ctx.moveTo(vx + i * 18, hor); ctx.lineTo(vx + i * 260, H + 40); ctx.stroke();
    }
    const off = (T * 0.9) % 1;
    for (let j = 0; j < 14; j++) {
      const z = (j + off) / 14; const y = hor + Math.pow(z, 2.2) * (H - hor + 60);
      ctx.globalAlpha = alpha * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
    // névoa no horizonte
    const g = ctx.createLinearGradient(0, hor - 160, 0, hor + 220);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(184,242,42,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, hor - 160, W, 380);
  }

  function raios(ctx, T, t, cor1, cor2, intens = 1) {
    // "hyperspace": raios saindo do centro
    const cx = W / 2, cy = H * 0.5;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 220; i++) {
      const ang = rnd(i) * Math.PI * 2;
      const vel = 0.6 + rnd(i + 99) * 1.4;
      const fase = (rnd(i + 7) + T * vel * 0.9) % 1;
      const r0 = 60 + Math.pow(fase, 1.7) * 1300;
      const len = (40 + rnd(i + 3) * 260) * (0.4 + fase) * intens;
      ctx.globalAlpha = clamp(fase * 1.6) * (0.35 + rnd(i + 5) * 0.65);
      ctx.strokeStyle = rnd(i + 11) > 0.45 ? cor1 : cor2;
      ctx.lineWidth = 1.5 + rnd(i + 13) * 4 * fase;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len));
      ctx.stroke();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.15, 'rgba(216,255,107,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  const FUNDOS = {
    escuro(ctx, T) {
      const g = ctx.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.5, 1300);
      g.addColorStop(0, '#24331A'); g.addColorStop(0.55, '#0C1109'); g.addColorStop(1, '#030403');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      grade(ctx, T, COR.lime, 0.28);
    },
    lime(ctx) {
      const g = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.5, 1250);
      g.addColorStop(0, '#E2FF7A'); g.addColorStop(0.6, '#B8F22A'); g.addColorStop(1, '#8CC00C');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // sombra suave de "chão"
      const s = ctx.createRadialGradient(W / 2, H * 0.8, 10, W / 2, H * 0.8, 600);
      s.addColorStop(0, 'rgba(60,90,0,0.25)'); s.addColorStop(1, 'rgba(60,90,0,0)');
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
    },
    claro(ctx) {
      const g = ctx.createRadialGradient(W / 2, H * 0.4, 80, W / 2, H * 0.5, 1300);
      g.addColorStop(0, '#FBFBF8'); g.addColorStop(0.7, '#E4E5DF'); g.addColorStop(1, '#C9CBC3');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    raios(ctx, T, t) {
      ctx.fillStyle = '#050605'; ctx.fillRect(0, 0, W, H);
      raios(ctx, T, t, '#FFFFFF', COR.lime, 1);
    },
    raiosLime(ctx, T, t) {
      FUNDOS.lime(ctx);
      raios(ctx, T, t, '#FFFFFF', '#5E8C00', 0.8);
    },
    vermelho(ctx) {
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 60, W / 2, H * 0.5, 1300);
      g.addColorStop(0, '#B3241C'); g.addColorStop(0.6, '#5C0B07'); g.addColorStop(1, '#200302');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    foto(ctx, T, t, cena) {
      // foto real ao fundo, com zoom lento e escurecida
      const im = IMG[cena.fotoFundo];
      const k = 1.08 + t * 0.04;
      const esc = Math.max(W / im.width, H / im.height) * k;
      ctx.drawImage(im, W / 2 - im.width * esc / 2, H / 2 - im.height * esc / 2, im.width * esc, im.height * esc);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.45, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
  };

  // ======================= TEXTO =======================
  // estilos de linha: branco | lime | cinza | preto | bloco (lime c/ texto preto) | blocoPreto (preto c/ texto lime)
  function desenharLinha(ctx, linha, y, t, atraso) {
    const p = prog(t, atraso, 0.2);
    if (p <= 0) return 0;
    let tam = linha.tam || 120;
    ctx.font = `${tam}px Anton`;
    let larg = ctx.measureText(linha.txt).width;
    const max = W - (linha.estilo && linha.estilo.startsWith('bloco') ? 170 : 110);
    if (larg > max) { tam = tam * max / larg; ctx.font = `${tam}px Anton`; larg = ctx.measureText(linha.txt).width; }
    const alturaLinha = tam * 1.08 + (linha.estilo && linha.estilo.startsWith('bloco') ? 24 : 0);
    const cy = y + alturaLinha / 2;
    const esc = lerp(1.7, 1, easeOutCubic(p));
    const blur = (1 - p);

    ctx.save();
    ctx.translate(W / 2, cy); ctx.scale(esc, esc);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    const desenhar = (alpha) => {
      ctx.globalAlpha = alpha;
      const e = linha.estilo || 'branco';
      if (e === 'bloco' || e === 'blocoPreto') {
        ctx.fillStyle = e === 'bloco' ? COR.lime : COR.preto;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
        ctx.fillRect(-larg / 2 - 30, -alturaLinha / 2, larg + 60, alturaLinha); ctx.restore();
        ctx.fillStyle = e === 'bloco' ? COR.preto : COR.lime;
        ctx.fillText(linha.txt, 0, tam * 0.04);
      } else if (e === 'lime') {
        ctx.save(); ctx.shadowColor = 'rgba(184,242,42,0.75)'; ctx.shadowBlur = 45;
        const g = ctx.createLinearGradient(0, -tam / 2, 0, tam / 2);
        g.addColorStop(0, COR.limeClaro); g.addColorStop(1, '#8FD000');
        ctx.fillStyle = g; ctx.fillText(linha.txt, 0, 0); ctx.restore();
      } else if (e === 'preto') {
        ctx.fillStyle = COR.preto; ctx.fillText(linha.txt, 0, 0);
      } else {
        // branco / cinza: degradê metálico como no vídeo de referência
        const g = ctx.createLinearGradient(0, -tam / 2, 0, tam / 2);
        if (e === 'cinza') { g.addColorStop(0, '#E9EBE4'); g.addColorStop(1, '#8E9289'); }
        else { g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#C9CCC3'); }
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
        ctx.fillStyle = g; ctx.fillText(linha.txt, 0, 0); ctx.restore();
      }
    };
    // "motion blur" de entrada: cópias fantasma
    if (blur > 0.05) {
      for (let k = 3; k >= 1; k--) {
        ctx.save(); ctx.scale(1 + blur * 0.12 * k, 1 + blur * 0.12 * k); desenhar(0.18 * p); ctx.restore();
      }
    }
    desenhar(p);
    ctx.restore();
    return alturaLinha + tam * 0.1;
  }

  function desenharTexto(ctx, cena, t) {
    let y = cena.textoY ?? 300;
    const passo = cena.passoTexto ?? 0.14;
    (cena.linhas || []).forEach((linha, i) => {
      const atraso = linha.em ?? i * passo;
      const h = desenharLinha(ctx, linha, y, t, atraso);
      y += h || ((linha.tam || 120) * 1.08 + 8);
    });
  }

  // ======================= OBJETOS 3D (PNG recortado) =======================
  function desenharObjeto(ctx, ob, t) {
    const im = IMG[ob.img]; if (!im) return;
    const ini = ob.em ?? 0.1;
    const p = prog(t, ini, ob.anim === 'zoom' ? 0.45 : 0.4);
    if (p <= 0) return;
    let esc = 1, rot = (ob.rot || 0) * Math.PI / 180, dx = 0, dy = 0, alpha = 1;
    const viva = t - ini;
    switch (ob.anim) {
      case 'zoom': esc = lerp(0.05, 1, easeOutCubic(p)); rot += (1 - easeOutCubic(p)) * -1.2; alpha = clamp(p * 3); break;
      case 'tremer': esc = easeOutBack(p); rot += Math.sin(viva * 55) * 0.07 * clamp(viva * 2); dx = Math.sin(viva * 70) * 6; break;
      case 'girar': esc = easeOutBack(p); rot += viva * 1.6; break;
      case 'cair': esc = 1; dy = lerp(-1300, 0, easeOutElastic(p)); break;
      default: esc = easeOutBack(p); // 'pop'
    }
    dy += Math.sin(viva * 2.4) * 14; // flutuação
    const h = ob.h || 700, w = h * im.width / im.height;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ob.x ?? W / 2, (ob.y ?? H * 0.6) + dy); ctx.translate(dx, 0);
    ctx.rotate(rot); ctx.scale(esc, esc);
    if (ob.brilho) { ctx.shadowColor = 'rgba(184,242,42,0.85)'; ctx.shadowBlur = 90; }
    else { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 40; }
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ======================= WIDGETS (telas desenhadas) =======================
  const WIDGETS = {
    // celular com a tela de agendamento
    celular(ctx, t, o) {
      const p = easeOutBack(prog(t, o.em ?? 0.15, 0.45));
      if (p <= 0) return;
      const cw = 560, ch = 1080;
      ctx.save();
      ctx.translate(W / 2, (o.y ?? 1220) + Math.sin(t * 2.2) * 10);
      ctx.rotate((-6 + Math.sin(t * 1.5) * 1.5) * Math.PI / 180); ctx.scale(p, p);
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 50;
      rr(ctx, -cw / 2, -ch / 2, cw, ch, 70); ctx.fillStyle = '#111'; ctx.fill();
      ctx.shadowColor = 'transparent';
      rr(ctx, -cw / 2 + 18, -ch / 2 + 18, cw - 36, ch - 36, 54); ctx.fillStyle = '#FAFAF7'; ctx.fill();
      ctx.save(); rr(ctx, -cw / 2 + 18, -ch / 2 + 18, cw - 36, ch - 36, 54); ctx.clip();
      // cabeçalho
      ctx.fillStyle = COR.preto; ctx.fillRect(-cw / 2, -ch / 2, cw, 230);
      if (IMG.logo) { ctx.save(); ctx.beginPath(); ctx.arc(-cw / 2 + 95, -ch / 2 + 140, 52, 0, 7); ctx.clip(); ctx.drawImage(IMG.logo, -cw / 2 + 43, -ch / 2 + 88, 104, 104); ctx.restore(); }
      ctx.fillStyle = '#fff'; ctx.font = '800 36px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('Kaizen Barber', -cw / 2 + 165, -ch / 2 + 125);
      ctx.fillStyle = COR.lime; ctx.font = '400 26px Inter'; ctx.fillText('Agendar horário', -cw / 2 + 165, -ch / 2 + 165);
      // data
      ctx.fillStyle = COR.preto; ctx.font = '800 30px Inter'; ctx.fillText('Escolha o horário', -cw / 2 + 50, -ch / 2 + 300);
      const horas = ['09:00', '10:00', '11:00', '13:45', '15:00', '16:00', '17:00', '18:00', '19:00'];
      const escolhido = 4;
      const sel = prog(t, (o.em ?? 0.15) + 0.55, 0.15);
      horas.forEach((h, i) => {
        const col = i % 3, lin = Math.floor(i / 3);
        const x = -cw / 2 + 50 + col * 160, y = -ch / 2 + 350 + lin * 100;
        const ativo = i === escolhido && sel > 0;
        rr(ctx, x, y, 140, 76, 22);
        ctx.fillStyle = ativo ? COR.lime : '#EDEEE8'; ctx.fill();
        ctx.fillStyle = COR.preto; ctx.font = '800 28px Inter'; ctx.textAlign = 'center';
        ctx.fillText(h, x + 70, y + 40);
        ctx.textAlign = 'left';
      });
      // toque
      if (sel > 0 && sel < 1) {
        const x = -cw / 2 + 50 + 1 * 160 + 70, y = -ch / 2 + 350 + 1 * 100 + 38;
        ctx.beginPath(); ctx.arc(x, y, 30 + sel * 60, 0, 7); ctx.strokeStyle = `rgba(0,0,0,${0.4 * (1 - sel)})`; ctx.lineWidth = 6; ctx.stroke();
      }
      // botão
      const ok = prog(t, (o.em ?? 0.15) + 0.9, 0.12);
      const by = ch / 2 - 230;
      rr(ctx, -cw / 2 + 50, by, cw - 100, 110, 30); ctx.fillStyle = ok > 0 ? COR.lime : COR.preto; ctx.fill();
      ctx.fillStyle = ok > 0 ? COR.preto : '#fff'; ctx.font = '800 36px Inter'; ctx.textAlign = 'center';
      ctx.fillText(ok > 0 ? '✓ AGENDADO' : 'CONFIRMAR', 0, by + 57);
      ctx.restore(); ctx.restore();
    },

    // três cartões com fotos reais dos profissionais
    barbeiros(ctx, t, o) {
      const lista = o.pessoas;
      lista.forEach((p, i) => {
        const k = easeOutBack(prog(t, (o.em ?? 0.15) + i * 0.12, 0.4));
        if (k <= 0) return;
        const cw = 296, ch = 440;
        const x = W / 2 + (i - 1) * 318, y = (o.y ?? 1180) + (i === 1 ? -50 : 30) + Math.sin(t * 2 + i) * 10;
        const destaque = o.destaque === i && t > (o.em ?? 0.15) + 0.7;
        ctx.save(); ctx.translate(x, y); ctx.rotate((i - 1) * 6 * Math.PI / 180); ctx.scale(k * (destaque ? 1.08 : 1), k * (destaque ? 1.08 : 1));
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 25;
        rr(ctx, -cw / 2, -ch / 2, cw, ch, 30); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
        if (destaque) { ctx.lineWidth = 10; ctx.strokeStyle = COR.preto; ctx.stroke(); }
        const im = IMG[p.img];
        ctx.save(); rr(ctx, -cw / 2 + 16, -ch / 2 + 16, cw - 32, ch - 130, 20); ctx.clip();
        const e = Math.max((cw - 32) / im.width, (ch - 130) / im.height);
        ctx.drawImage(im, -im.width * e / 2, -ch / 2 + 16 + (ch - 130) / 2 - im.height * e / 2 - (p.offY || 0), im.width * e, im.height * e);
        ctx.restore();
        ctx.fillStyle = COR.preto; ctx.textAlign = 'center'; ctx.font = '42px Anton';
        ctx.fillText(p.nome, 0, ch / 2 - 72);
        ctx.fillStyle = COR.cinzaEscuro; ctx.font = '400 22px Inter'; ctx.fillText(p.cargo, 0, ch / 2 - 34);
        if (destaque) {
          rr(ctx, cw / 2 - 90, -ch / 2 - 30, 110, 60, 30); ctx.fillStyle = COR.preto; ctx.fill();
          ctx.fillStyle = COR.lime; ctx.font = '800 30px Inter'; ctx.fillText('✓', cw / 2 - 35, -ch / 2 + 2);
        }
        ctx.restore();
      });
    },

    // cardápio de serviços aparecendo linha a linha
    servicos(ctx, t, o) {
      const k = easeOutBack(prog(t, o.em ?? 0.1, 0.4)); if (k <= 0) return;
      const cw = 860, linhaH = 118, ch = 120 + o.itens.length * linhaH;
      ctx.save(); ctx.translate(W / 2, (o.y ?? 1220)); ctx.rotate(-2 * Math.PI / 180); ctx.scale(k, k);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
      rr(ctx, -cw / 2, -ch / 2, cw, ch, 36); ctx.fillStyle = '#FAFAF7'; ctx.fill(); ctx.shadowColor = 'transparent';
      rr(ctx, -cw / 2, -ch / 2, cw, 100, 36); ctx.fillStyle = COR.preto; ctx.fill(); ctx.fillRect(-cw / 2, -ch / 2 + 60, cw, 40);
      ctx.fillStyle = COR.lime; ctx.font = '50px Anton'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(o.titulo || 'SERVIÇOS', -cw / 2 + 40, -ch / 2 + 52);
      o.itens.forEach((it, i) => {
        const a = prog(t, (o.em ?? 0.1) + 0.3 + i * 0.12, 0.18); if (a <= 0) return;
        const y = -ch / 2 + 110 + i * linhaH + linhaH / 2;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(lerp(60, 0, easeOutCubic(a)), 0);
        if (it.destaque) { rr(ctx, -cw / 2 + 20, y - linhaH / 2 + 10, cw - 40, linhaH - 20, 22); ctx.fillStyle = COR.lime; ctx.fill(); }
        ctx.fillStyle = COR.preto; ctx.font = '800 40px Inter'; ctx.textAlign = 'left';
        ctx.fillText(it.nome, -cw / 2 + 50, y - 10);
        ctx.fillStyle = COR.cinzaEscuro; ctx.font = '400 26px Inter'; ctx.fillText(it.dur, -cw / 2 + 50, y + 28);
        ctx.fillStyle = COR.preto; ctx.font = '50px Anton'; ctx.textAlign = 'right'; ctx.fillText(it.preco, cw / 2 - 50, y + 4);
        ctx.restore();
      });
      ctx.restore();
    },

    // bolha de WhatsApp com lembrete
    whatsapp(ctx, t, o) {
      const k = easeOutBack(prog(t, o.em ?? 0.15, 0.4)); if (k <= 0) return;
      ctx.save(); ctx.translate(W / 2, (o.y ?? 1250) + Math.sin(t * 2) * 10); ctx.rotate(3 * Math.PI / 180); ctx.scale(k, k);
      const cw = 820, ch = 470;
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
      rr(ctx, -cw / 2, -ch / 2, cw, ch, 44); ctx.fillStyle = '#ECE5DD'; ctx.fill(); ctx.shadowColor = 'transparent';
      rr(ctx, -cw / 2, -ch / 2, cw, 110, 44); ctx.fillStyle = '#075E54'; ctx.fill(); ctx.fillRect(-cw / 2, -ch / 2 + 70, cw, 40);
      if (IMG.logo) { ctx.save(); ctx.beginPath(); ctx.arc(-cw / 2 + 75, -ch / 2 + 55, 36, 0, 7); ctx.clip(); ctx.drawImage(IMG.logo, -cw / 2 + 39, -ch / 2 + 19, 72, 72); ctx.restore(); }
      ctx.fillStyle = '#fff'; ctx.font = '800 32px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('Kaizen Barber Shop', -cw / 2 + 130, -ch / 2 + 55);
      const digitando = t < (o.em ?? 0.15) + 0.7;
      const bx = -cw / 2 + 40, by = -ch / 2 + 150;
      if (digitando) {
        rr(ctx, bx, by, 170, 90, 30); ctx.fillStyle = '#fff'; ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(bx + 50 + i * 35, by + 45 + Math.sin(t * 14 + i) * 6, 10, 0, 7); ctx.fillStyle = '#9AA0A6'; ctx.fill(); }
      } else {
        const a = prog(t, (o.em ?? 0.15) + 0.7, 0.15);
        ctx.globalAlpha = a;
        rr(ctx, bx, by, cw - 80, 250, 30); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = '800 34px Inter'; ctx.fillText(o.linha1, bx + 36, by + 60);
        ctx.font = '400 32px Inter'; ctx.fillText(o.linha2, bx + 36, by + 115);
        ctx.fillText(o.linha3, bx + 36, by + 165);
        ctx.fillStyle = '#34B7F1'; ctx.font = '400 26px Inter'; ctx.textAlign = 'right'; ctx.fillText('09:00 ✓✓', bx + cw - 116, by + 220);
      }
      ctx.restore();
    },

    // número gigante "3D" (extrusão)
    numero(ctx, t, o) {
      const k = easeOutBack(prog(t, o.em ?? 0.1, 0.45)); if (k <= 0) return;
      ctx.save(); ctx.translate(W / 2, o.y ?? 1150); ctx.scale(k, k); ctx.rotate(Math.sin(t * 2) * 0.05);
      ctx.font = `${o.tam || 760}px Anton`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let d = 40; d > 0; d -= 2) { ctx.fillStyle = d > 4 ? '#3C5A00' : '#2A3F00'; ctx.fillText(o.txt, d * 0.9, d); }
      const g = ctx.createLinearGradient(0, -300, 0, 300); g.addColorStop(0, COR.limeClaro); g.addColorStop(1, '#8FD000');
      ctx.shadowColor = 'rgba(184,242,42,0.7)'; ctx.shadowBlur = 80; ctx.fillStyle = g; ctx.fillText(o.txt, 0, 0);
      ctx.restore();
      // ícones orbitando
      (o.orbita || []).forEach((nome, i, arr) => {
        const im = IMG[nome]; if (!im) return;
        const a = (i / arr.length) * Math.PI * 2 + t * 1.3;
        const r = 400 * k, h = 220;
        ctx.save(); ctx.translate(W / 2 + Math.cos(a) * r, (o.y ?? 1150) + Math.sin(a) * r * 0.55);
        ctx.rotate(Math.sin(t * 3 + i) * 0.2);
        ctx.drawImage(im, -h * im.width / im.height / 2, -h / 2, h * im.width / im.height, h); ctx.restore();
      });
    },

    // etiqueta de preço
    preco(ctx, t, o) {
      const k = easeOutElastic(prog(t, o.em ?? 0.35, 0.6)); if (k <= 0) return;
      ctx.save(); ctx.translate(o.x ?? W / 2, o.y ?? 1620); ctx.rotate((o.rot ?? -6) * Math.PI / 180); ctx.scale(k, k);
      ctx.font = '96px Anton'; const lw = ctx.measureText(o.txt).width + 90;
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
      rr(ctx, -lw / 2, -75, lw, 150, 30); ctx.fillStyle = o.cor === 'lime' ? COR.lime : COR.preto; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = o.cor === 'lime' ? COR.preto : COR.lime; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.txt, 0, 6); ctx.restore();
    },

    // cartão de link com botão sendo tocado
    link(ctx, t, o) {
      const k = easeOutBack(prog(t, o.em ?? 0.15, 0.4)); if (k <= 0) return;
      ctx.save(); ctx.translate(W / 2, (o.y ?? 1230) + Math.sin(t * 2) * 8); ctx.rotate(-2 * Math.PI / 180); ctx.scale(k, k);
      const cw = 860, ch = 560;
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 35;
      rr(ctx, -cw / 2, -ch / 2, cw, ch, 44); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.lineWidth = 6; ctx.strokeStyle = '#E3E4DE'; ctx.stroke();
      if (IMG.logo) { ctx.save(); ctx.beginPath(); ctx.arc(-cw / 2 + 105, -ch / 2 + 105, 60, 0, 7); ctx.clip(); ctx.drawImage(IMG.logo, -cw / 2 + 45, -ch / 2 + 45, 120, 120); ctx.restore(); }
      ctx.fillStyle = COR.preto; ctx.font = '66px Anton'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(o.titulo, -cw / 2 + 195, -ch / 2 + 90);
      ctx.fillStyle = COR.cinzaEscuro; ctx.font = '400 28px Inter'; ctx.fillText(o.sub, -cw / 2 + 197, -ch / 2 + 145);
      rr(ctx, -cw / 2 + 45, -ch / 2 + 220, cw - 90, 100, 26); ctx.fillStyle = '#F2F3EE'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = COR.lime; ctx.stroke();
      ctx.fillStyle = '#333'; ctx.font = '800 30px Inter'; ctx.fillText('🔗  ' + o.url, -cw / 2 + 80, -ch / 2 + 272);
      const toque = prog(t, (o.em ?? 0.15) + 0.75, 0.12);
      rr(ctx, -cw / 2 + 45, ch / 2 - 175, cw - 90, 130, 32); ctx.fillStyle = toque > 0 ? COR.preto : COR.lime; ctx.fill();
      ctx.fillStyle = toque > 0 ? COR.lime : COR.preto; ctx.font = '64px Anton'; ctx.textAlign = 'center';
      ctx.fillText(toque > 0 ? o.botaoDepois : o.botao, 0, ch / 2 - 106);
      // dedo/toque
      const mao = prog(t, (o.em ?? 0.15) + 0.35, 0.4);
      if (mao > 0) {
        const hx = lerp(420, 330, easeOutCubic(mao)), hy = lerp(ch / 2 + 260, ch / 2 - 60, easeOutCubic(mao));
        ctx.beginPath(); ctx.arc(hx, hy, 46, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
        if (toque > 0 && toque < 1) { ctx.beginPath(); ctx.arc(hx, hy, 46 + toque * 90, 0, 7); ctx.strokeStyle = `rgba(184,242,42,${1 - toque})`; ctx.lineWidth = 10; ctx.stroke(); }
      }
      ctx.restore();
    },

    // logo grande (fechamento)
    logo(ctx, t, o) {
      const k = easeOutBack(prog(t, o.em ?? 0.1, 0.5)); if (k <= 0 || !IMG.logo) return;
      const s = (o.tam || 640) * k;
      ctx.save(); ctx.translate(W / 2, o.y ?? 1100);
      ctx.shadowColor = 'rgba(184,242,42,0.6)'; ctx.shadowBlur = 90;
      ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fillStyle = '#000'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, s / 2 - 6, 0, 7); ctx.clip(); ctx.drawImage(IMG.logo, -s / 2, -s / 2, s, s); ctx.restore();
      ctx.lineWidth = 10; ctx.strokeStyle = COR.lime; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.stroke();
      ctx.restore();
    },
  };

  // selo no topo, tipo "SKILL 1 DE 11"
  function desenharSelo(ctx, txt, t) {
    const p = easeOutBack(prog(t, 0, 0.25)); if (p <= 0) return;
    ctx.save(); ctx.translate(W / 2, 205); ctx.scale(p, p);
    ctx.font = '40px Anton'; const lw = ctx.measureText(txt).width + 70;
    rr(ctx, -lw / 2, -34, lw, 68, 34); ctx.fillStyle = 'rgba(10,12,9,0.85)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = COR.lime; ctx.stroke();
    ctx.fillStyle = COR.lime; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 3);
    ctx.restore();
  }

  // partículas/faíscas em volta do objeto (impacto)
  function faiscas(ctx, t, cor, cy) {
    const p = prog(t, 0.1, 0.6); if (p <= 0 || p >= 1) return;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = rnd(i * 3.3) * Math.PI * 2, r1 = 260 + easeOutCubic(p) * 300 * (0.6 + rnd(i) * 0.6);
      ctx.globalAlpha = 1 - p; ctx.strokeStyle = cor; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(W / 2 + Math.cos(a) * (r1 + 60), cy + Math.sin(a) * (r1 + 60)); ctx.stroke();
    }
    ctx.restore();
  }

  // ======================= MONTAGEM =======================
  let ROTEIRO = null, INICIOS = [], DURACAO = 0;

  function prepararRoteiro(r) {
    ROTEIRO = r; INICIOS = []; let acc = 0;
    r.cenas.forEach(c => { INICIOS.push(acc); acc += c.dur; });
    DURACAO = acc;
    return { duracao: DURACAO, cortes: INICIOS.slice(), cenas: r.cenas.map(c => ({ dur: c.dur, impacto: !!(c.impacto || c.flash) })) };
  }

  function renderFrame(ctx, T) {
    let i = INICIOS.length - 1;
    while (i > 0 && INICIOS[i] > T) i--;
    const cena = ROTEIRO.cenas[i], t = T - INICIOS[i];
    ctx.save();
    // transição de entrada: zoom-punch + leve tremida
    const ent = 1 - easeOutCubic(prog(t, 0, 0.18));
    const shake = cena.impacto ? Math.sin(t * 90) * 14 * Math.max(0, 1 - t * 4) : 0;
    ctx.translate(W / 2 + shake, H / 2 + shake * 0.6); ctx.scale(1 + ent * 0.14, 1 + ent * 0.14); ctx.translate(-W / 2, -H / 2);

    (FUNDOS[cena.fundo] || FUNDOS.escuro)(ctx, T, t, cena);
    if (cena.faiscas) faiscas(ctx, t, cena.faiscas, cena.objetos?.[0]?.y ?? 1150);
    (cena.objetos || []).forEach(ob => desenharObjeto(ctx, ob, t));
    (cena.widgets || []).forEach(wd => WIDGETS[wd.tipo](ctx, t, wd));
    desenharTexto(ctx, cena, t);
    if (cena.selo) desenharSelo(ctx, cena.selo, t);
    ctx.restore();

    // flash branco no corte (quando a cena pede)
    if (cena.flash) {
      const f = 1 - prog(t, 0, 0.12);
      if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${0.55 * f})`; ctx.fillRect(0, 0, W, H); }
    }
    // vinheta
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  window.KaizenReels = { W, H, carregarImagens, prepararRoteiro, renderFrame };
})();
