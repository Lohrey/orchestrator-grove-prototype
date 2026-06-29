/**
 * campaign-intro-cinematic.js — Canvas-rendered Stardew-Valley-inspired cinematic intro.
 *
 * Replaces the static HTML text-card overlay with an animated, self-contained canvas cinematic.
 * The cinematic manages its own rAF loop (independent of the game loop), draws animated scenes
 * on the game canvas, handles keyboard/mouse input for advancement, and calls back on
 * completion or skip.
 *
 * Factory:
 *   createCampaignIntroCinematic({ canvas, audio, scenes, onComplete, onSkip })
 *
 * Lifecycle:
 *   const cine = createCampaignIntroCinematic({ canvas, audio, scenes, onComplete, onSkip });
 *   cine.start();        // begins the cinematic (letterbox animates in)
 *   // … user watches …
 *   // onComplete(reason='finished') or onSkip(reason='skip') is called
 *   cine.destroy();      // safe to call any time — cancels rAF + removes listeners
 */

// ── Helpers ────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutQuad = t => 1 - (1 - t) * (1 - t);

/** Deterministic pseudo-random based on a seed — used for stable per-scene particle layouts. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Transition system ──────────────────────────────────────────────────

const TRANSITION_OUT_MS = 600; // fade to black
const TRANSITION_IN_MS = 400;  // fade from black
const POST_TEXT_HOLD_MS = 1500; // auto-advance delay after last scene text reveals

// ── Scene palettes & layer definitions ────────────────────────────────

/**
 * Each scene definition includes:
 *   palette:  color stops and accent colors
 *   layers:   array of (ctx, t, W, H, progress) => void  — draw parallax/animation
 *   textReveal: { style, speed, delay } — how body text reveals
 *   audioCue: string passed to audio.play() on scene enter
 */

// Scene 1: City noise — oppressive, claustrophobic
function scene1Layers() {
  const rand = seededRandom(42);
  const buildings = Array.from({ length: 14 }, () => ({
    x: rand(),
    w: 0.05 + rand() * 0.08,
    h: 0.30 + rand() * 0.45,
    shade: 0.25 + rand() * 0.2,
    windows: Math.floor(3 + rand() * 8),
    windowSeed: Math.floor(rand() * 10000)
  }));
  const rainDrops = Array.from({ length: 80 }, () => ({ x: rand(), y: rand(), spd: 0.4 + rand() * 0.6, len: 0.01 + rand() * 0.02 }));
  const headlights = Array.from({ length: 5 }, () => ({ x: rand(), spd: 0.03 + rand() * 0.05, dir: rand() > 0.5 ? 1 : -1 }));

  return [
    // Sky gradient — foggy gray
    (ctx, t, W, H) => {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#2a2d33');
      grad.addColorStop(0.5, '#3a3d42');
      grad.addColorStop(1, '#1c1e22');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    },
    // Fog layer
    (ctx, t, W, H) => {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#888';
      for (let i = 0; i < 3; i++) {
        const y = H * (0.3 + i * 0.15) + Math.sin(t * 0.3 + i) * 10;
        ctx.beginPath();
        ctx.ellipse(W * (0.3 + Math.sin(t * 0.2 + i * 2) * 0.15), y, W * 0.5, H * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    // Building silhouettes rising + slow zoom
    (ctx, t, W, H, progress) => {
      const zoom = 1 + progress * 0.12;
      ctx.save();
      ctx.translate(W / 2, H);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H);

      for (const b of buildings) {
        const riseT = clamp(progress * 2 - b.x, 0, 1);
        const rise = easeOutCubic(riseT);
        const bx = b.x * W;
        const bw = b.w * W;
        const bh = b.h * H * rise;
        ctx.fillStyle = `rgba(${Math.floor(30 + b.shade * 40)}, ${Math.floor(32 + b.shade * 40)}, ${Math.floor(38 + b.shade * 40)}, 0.97)`;
        ctx.fillRect(bx, H - bh, bw, bh);

        // Window lights
        const winRand = seededRandom(b.windowSeed);
        const cols = Math.ceil(bw / 14);
        const rows = Math.floor(bh / 18);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lit = winRand() > 0.55;
            if (!lit) continue;
            const flicker = 0.5 + 0.5 * Math.sin(t * 3 + r * 7 + c * 3);
            if (flicker < 0.3) continue;
            ctx.fillStyle = `rgba(255, 240, 180, ${0.25 + flicker * 0.35})`;
            ctx.fillRect(bx + 4 + c * 14, H - bh + 8 + r * 18, 6, 8);
          }
        }
      }
      ctx.restore();
    },
    // Rain
    (ctx, t, W, H) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(160, 170, 190, 0.25)';
      ctx.lineWidth = 1;
      for (const d of rainDrops) {
        const x = ((d.x + t * d.spd * 0.1) % 1) * W;
        const y = ((d.y + t * d.spd) % 1) * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + d.len * H);
        ctx.stroke();
      }
      ctx.restore();
    },
    // Distant headlights
    (ctx, t, W, H) => {
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (const hl of headlights) {
        const x = ((hl.x + t * hl.spd * hl.dir) % 1 + 1) % 1 * W;
        const y = H * 0.92;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 20);
        grad.addColorStop(0, 'rgba(255,240,200,0.6)');
        grad.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - 20, y - 20, 40, 40);
      }
      ctx.restore();
    }
  ];
}

// Scene 2: A late-night spark — screen glow in a dark room
function scene2Layers() {
  const sparks = Array.from({ length: 30 }, () => ({
    x: 0.5 + (Math.random() - 0.5) * 0.08,
    y: 0.5,
    spd: 0.02 + Math.random() * 0.03,
    drift: (Math.random() - 0.5) * 0.02,
    life: Math.random()
  }));
  const codeLines = [
    'npm install autonomies',
    'const helper = new Bot()',
    'helper.build(garden)',
    '> solar: 340W',
    '> battery: 88%',
    'await helper.assemble()',
    '# freedom.exe'
  ];

  return [
    // Dark room
    (ctx, t, W, H) => {
      ctx.fillStyle = '#08080c';
      ctx.fillRect(0, 0, W, H);
      // Room silhouette — a desk edge
      ctx.fillStyle = '#15151a';
      ctx.fillRect(0, H * 0.72, W, H * 0.28);
    },
    // Screen glow bloom — grows warmer over time
    (ctx, t, W, H, progress) => {
      const warmth = progress;
      const cx = W * 0.5, cy = H * 0.42;
      const radius = W * (0.22 + warmth * 0.08);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5);
      const r = Math.floor(255);
      const g = Math.floor(180 + warmth * 40);
      const b = Math.floor(80 + (1 - warmth) * 80);
      grad.addColorStop(0, `rgba(${r},${g},${b}, ${0.4 + warmth * 0.2})`);
      grad.addColorStop(0.3, `rgba(${r},${g},${b}, ${0.15 + warmth * 0.1})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    },
    // Screen rectangle with flickering code
    (ctx, t, W, H, progress) => {
      const sw = W * 0.22, sh = H * 0.28;
      const sx = W / 2 - sw / 2, sy = H * 0.42 - sh / 2;
      // Screen bezel
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(sx - 4, sy - 4, sw + 8, sh + 8);
      // Screen content
      ctx.fillStyle = `rgba(20, 18, 10, 0.95)`;
      ctx.fillRect(sx, sy, sw, sh);
      // Code text
      ctx.save();
      ctx.font = `${Math.max(8, Math.floor(sw * 0.06))}px monospace`;
      ctx.textBaseline = 'top';
      const visibleLines = Math.min(codeLines.length, Math.floor(t * 0.8) + 1);
      for (let i = 0; i < visibleLines; i++) {
        const flicker = 0.5 + 0.5 * Math.sin(t * 4 + i * 2.5);
        ctx.fillStyle = `rgba(180, 220, 140, ${0.4 + flicker * 0.4})`;
        ctx.fillText(codeLines[i], sx + 8, sy + 6 + i * (sh * 0.13));
      }
      // Cursor blink
      if (Math.sin(t * 4) > 0) {
        ctx.fillStyle = 'rgba(180, 220, 140, 0.7)';
        const cursorY = sy + 6 + (visibleLines - 1) * (sh * 0.13);
        ctx.fillRect(sx + 8 + ctx.measureText(codeLines[visibleLines - 1] || '').width + 3, cursorY, sw * 0.02, sh * 0.08);
      }
      ctx.restore();
    },
    // Light particles drifting up
    (ctx, t, W, H) => {
      ctx.save();
      for (const s of sparks) {
        s.life += s.spd * 0.016;
        if (s.life > 1) s.life = 0;
        const px = (s.x + Math.sin(t * 0.5 + s.life * 10) * s.drift) * W;
        const py = lerp(H * 0.42, H * 0.1, s.life);
        const alpha = (1 - s.life) * 0.5;
        ctx.fillStyle = `rgba(255, 200, 120, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  ];
}

// Scene 3: The escape kit — items appearing on a surface
function scene3Layers() {
  const items = [
    { name: 'Camper van', color: '#edf3ef', shape: 'van', x: 0.5, y: 0.35, delay: 0.0 },
    { name: 'Hammock', color: '#80a9c9', shape: 'hammock', x: 0.25, y: 0.55, delay: 0.12 },
    { name: 'Ultrabook', color: '#b7c2ba', shape: 'laptop', x: 0.75, y: 0.52, delay: 0.20 },
    { name: 'Solar panel', color: '#4b6f78', shape: 'solar', x: 0.30, y: 0.75, delay: 0.30 },
    { name: 'Power station', color: '#d3a95f', shape: 'box', x: 0.55, y: 0.68, delay: 0.38 },
    { name: '3D printer', color: '#d8ded9', shape: 'printer', x: 0.75, y: 0.75, delay: 0.48 },
    { name: 'Assembler', color: '#9abf8f', shape: 'assembler', x: 0.18, y: 0.40, delay: 0.58 },
    { name: 'Robotics parts', color: '#c7b683', shape: 'parts', x: 0.85, y: 0.38, delay: 0.66 }
  ];

  const drawItem = (ctx, item, x, y, scale, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = item.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;

    switch (item.shape) {
      case 'van':
        ctx.beginPath();
        ctx.roundRect(-22, -8, 44, 16, 3);
        ctx.fill(); ctx.stroke();
        // Cab
        ctx.fillStyle = '#cfd8d3';
        ctx.beginPath();
        ctx.roundRect(8, -14, 14, 10, 2);
        ctx.fill();
        ctx.fillStyle = '#80a9c9';
        ctx.fillRect(10, -12, 10, 5);
        break;
      case 'hammock':
        ctx.beginPath();
        ctx.moveTo(-18, -4);
        ctx.quadraticCurveTo(0, 8, 18, -4);
        ctx.lineWidth = 3;
        ctx.strokeStyle = item.color;
        ctx.stroke();
        break;
      case 'laptop':
        ctx.fillRect(-16, -2, 32, 10);
        ctx.strokeRect(-16, -2, 32, 10);
        ctx.fillStyle = '#8a958d';
        ctx.beginPath();
        ctx.moveTo(-20, 8); ctx.lineTo(20, 8); ctx.lineTo(18, 12); ctx.lineTo(-18, 12); ctx.closePath();
        ctx.fill();
        break;
      case 'solar':
        ctx.save();
        ctx.rotate(-0.15);
        ctx.fillRect(-18, -10, 36, 20);
        ctx.strokeRect(-18, -10, 36, 20);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 9, -10); ctx.lineTo(-18 + i * 9, 10); ctx.stroke(); }
        ctx.restore();
        break;
      case 'box':
        ctx.fillRect(-14, -12, 28, 24);
        ctx.strokeRect(-14, -12, 28, 24);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-14, -4, 28, 3);
        break;
      case 'printer':
        ctx.fillRect(-16, -6, 32, 16);
        ctx.strokeRect(-16, -6, 32, 16);
        ctx.fillStyle = '#94a09a';
        ctx.fillRect(-12, -2, 24, 6); // print bed
        break;
      case 'assembler':
        ctx.beginPath();
        ctx.roundRect(-15, -10, 30, 20, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6d7c62';
        ctx.fillRect(-8, -6, 16, 8);
        break;
      case 'parts':
        ctx.beginPath(); ctx.arc(-8, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(6, 2, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillRect(-3, -8, 6, 6);
        break;
    }
    ctx.restore();
  };

  return [
    // Warm golden background
    (ctx, t, W, H) => {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#2a1d10');
      grad.addColorStop(0.4, '#4a3318');
      grad.addColorStop(1, '#6b4a22');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // Warm light from top-left (sunlight through window)
      const lg = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, W * 0.6);
      lg.addColorStop(0, 'rgba(255, 200, 120, 0.3)');
      lg.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, H);
    },
    // Flat surface
    (ctx, t, W, H) => {
      ctx.fillStyle = 'rgba(60, 40, 20, 0.7)';
      ctx.fillRect(0, H * 0.82, W, H * 0.18);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, H * 0.82, W, 3);
    },
    // Items appearing one by one
    (ctx, t, W, H, progress) => {
      for (const item of items) {
        const itemProgress = clamp((progress - item.delay) / 0.15, 0, 1);
        if (itemProgress <= 0) continue;
        const eased = easeOutCubic(itemProgress);
        const scale = 0.5 + eased * 0.5;
        const alpha = eased;
        const yOff = lerp(20, 0, eased);
        drawItem(ctx, item, item.x * W, item.y * H + yOff, scale, alpha);
      }
    },
    // Floating dust motes in the light
    (ctx, t, W, H) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 220, 160, 0.3)';
      const rand = seededRandom(99);
      for (let i = 0; i < 25; i++) {
        const bx = (rand() + Math.sin(t * 0.2 + i) * 0.01) * W;
        const by = ((rand() + t * 0.01) % 1) * H * 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  ];
}

// Scene 4: No return commute — road perspective, leaving the city
function scene4Layers() {
  const dashes = Array.from({ length: 20 }, (_, i) => ({ pos: i / 20 }));
  return [
    // Sky gradient: gray top → warm sunset bottom
    (ctx, t, W, H, progress) => {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      const warmth = progress;
      grad.addColorStop(0, `rgba(${Math.floor(60 + warmth * 80)}, ${Math.floor(65 + warmth * 30)}, ${Math.floor(75 + warmth * 20)}, 1)`);
      grad.addColorStop(0.5, `rgba(${Math.floor(120 + warmth * 100)}, ${Math.floor(90 + warmth * 60)}, ${Math.floor(80 + warmth * 20)}, 1)`);
      grad.addColorStop(1, `rgba(${Math.floor(200 + warmth * 30)}, ${Math.floor(120 + warmth * 50)}, ${Math.floor(90 + warmth * 30)}, 1)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // Sun glow at horizon
      const sg = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.3);
      sg.addColorStop(0, `rgba(255, 200, 130, ${0.2 + warmth * 0.2})`);
      sg.addColorStop(1, 'rgba(255, 200, 130, 0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    },
    // Shrinking city buildings on horizon
    (ctx, t, W, H, progress) => {
      ctx.save();
      ctx.globalAlpha = 1 - progress * 0.7;
      const rand = seededRandom(33);
      for (let i = 0; i < 10; i++) {
        const bx = rand() * W;
        const bw = 15 + rand() * 25;
        const bh = (20 + rand() * 50) * (1 - progress * 0.5);
        ctx.fillStyle = 'rgba(40, 35, 45, 0.8)';
        ctx.fillRect(bx, H * 0.5 - bh, bw, bh);
      }
      ctx.restore();
    },
    // Road perspective — converging lines + scrolling dashes
    (ctx, t, W, H) => {
      const vpx = W / 2, vpy = H * 0.52;
      const roadBottomW = W * 0.8;
      // Road surface
      ctx.fillStyle = 'rgba(30, 28, 32, 0.9)';
      ctx.beginPath();
      ctx.moveTo(vpx - 5, vpy);
      ctx.lineTo(vpx + 5, vpy);
      ctx.lineTo(W / 2 + roadBottomW / 2, H);
      ctx.lineTo(W / 2 - roadBottomW / 2, H);
      ctx.closePath();
      ctx.fill();
      // Road edges (perspective lines)
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vpx - 5, vpy); ctx.lineTo(W / 2 - roadBottomW / 2, H);
      ctx.moveTo(vpx + 5, vpy); ctx.lineTo(W / 2 + roadBottomW / 2, H);
      ctx.stroke();
      // Center dashes scrolling toward viewer
      ctx.strokeStyle = 'rgba(255, 220, 140, 0.5)';
      ctx.lineWidth = 3;
      for (const d of dashes) {
        d.pos = (d.pos + 0.008) % 1;
        const perspective = d.pos;
        const dashY = lerp(vpy, H, perspective);
        const dashW = lerp(4, 40, perspective);
        const dashLen = lerp(2, 16, perspective);
        ctx.globalAlpha = perspective;
        ctx.fillRect(vpx - dashW / 2, dashY, dashW, dashLen);
      }
      ctx.globalAlpha = 1;
    },
    // Vehicle silhouette moving away toward horizon
    (ctx, t, W, H, progress) => {
      const cx = lerp(W * 0.4, W * 0.5, progress);
      const cy = lerp(H * 0.85, H * 0.54, progress);
      const scale = lerp(1, 0.08, progress);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(20, 20, 25, 0.9)';
      // Van shape
      ctx.beginPath();
      ctx.roundRect(-30, -12, 60, 20, 4);
      ctx.fill();
      ctx.fillRect(10, -18, 18, 10);
      ctx.restore();
      // Taillight glow fading
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.4;
      const lg = ctx.createRadialGradient(cx, cy + 4, 0, cx, cy + 4, 15 * scale * 5);
      lg.addColorStop(0, 'rgba(255, 60, 30, 0.5)');
      lg.addColorStop(1, 'rgba(255, 60, 30, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(cx - 40, cy - 20, 80, 40);
      ctx.restore();
    },
    // Speed lines / motion blur
    (ctx, t, W, H, progress) => {
      if (progress < 0.3) return;
      ctx.save();
      ctx.globalAlpha = (progress - 0.3) * 0.3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      const rand = seededRandom(77);
      for (let i = 0; i < 15; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = 0.3 + rand() * 0.3;
        const cx = W / 2, cy = H * 0.55;
        const x1 = cx + Math.cos(angle) * dist * W;
        const y1 = cy + Math.sin(angle) * dist * H;
        const x2 = cx + Math.cos(angle) * (dist + 0.1) * W;
        const y2 = cy + Math.sin(angle) * (dist + 0.1) * H;
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }
  ];
}

// Scene 5: The old lake — vibrant nature, arrival, peace
function scene5Layers() {
  const birds = Array.from({ length: 5 }, () => ({
    x: Math.random(),
    y: 0.15 + Math.random() * 0.2,
    spd: 0.01 + Math.random() * 0.015,
    flap: Math.random() * Math.PI * 2
  }));
  const fireflies = Array.from({ length: 25 }, () => ({
    x: Math.random(),
    y: 0.55 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    drift: 0.001 + Math.random() * 0.003
  }));
  const trees = Array.from({ length: 8 }, () => ({
    x: Math.random(),
    h: 0.08 + Math.random() * 0.06,
    w: 0.03 + Math.random() * 0.02
  }));

  return [
    // Sky — soft blue
    (ctx, t, W, H) => {
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      grad.addColorStop(0, '#5a9fc7');
      grad.addColorStop(1, '#a8d4e8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H * 0.55);
    },
    // Lake water with ripples
    (ctx, t, W, H) => {
      const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      grad.addColorStop(0, '#3a8a7e');
      grad.addColorStop(0.5, '#2d6b62');
      grad.addColorStop(1, '#1f4a45');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);

      // Animated sine wave reflections
      ctx.save();
      ctx.strokeStyle = 'rgba(150, 220, 200, 0.15)';
      ctx.lineWidth = 1;
      for (let row = 0; row < 8; row++) {
        const y = H * (0.58 + row * 0.04);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const wave = Math.sin(x * 0.02 + t * 1.5 + row * 0.8) * (2 + row * 0.5);
          if (x === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
    // Glowing green lake aura (matching campaign_glow_lake feature)
    (ctx, t, W, H, progress) => {
      const cx = W * 0.5, cy = H * 0.65;
      const pulse = 0.7 + Math.sin(t * 0.8) * 0.1;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.35 * pulse);
      grad.addColorStop(0, `rgba(120, 255, 160, ${0.15 + progress * 0.1})`);
      grad.addColorStop(0.5, 'rgba(80, 200, 120, 0.05)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
    },
    // Tree silhouettes on shoreline
    (ctx, t, W, H) => {
      ctx.fillStyle = 'rgba(20, 40, 30, 0.85)';
      for (const tr of trees) {
        const tx = tr.x * W;
        const ty = H * 0.55;
        // Trunk
        ctx.fillRect(tx - 2, ty - tr.h * H * 0.4, 4, tr.h * H * 0.4);
        // Canopy
        ctx.beginPath();
        ctx.arc(tx, ty - tr.h * H * 0.5, tr.w * W * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    // Soft mist/fog over water
    (ctx, t, W, H) => {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#c8e8d8';
      for (let i = 0; i < 3; i++) {
        const y = H * (0.52 + i * 0.05) + Math.sin(t * 0.3 + i * 2) * 5;
        ctx.beginPath();
        ctx.ellipse(W * (0.3 + Math.sin(t * 0.15 + i) * 0.2), y, W * 0.6, H * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    // Birds drifting
    (ctx, t, W, H) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(40, 50, 45, 0.6)';
      ctx.lineWidth = 1.5;
      for (const b of birds) {
        b.x = (b.x + b.spd * 0.016) % 1;
        const px = b.x * W;
        const py = b.y * H;
        const flap = Math.sin(t * 4 + b.flap) * 4;
        ctx.beginPath();
        ctx.moveTo(px - 6, py + flap);
        ctx.quadraticCurveTo(px, py - 2, px + 6, py + flap);
        ctx.stroke();
      }
      ctx.restore();
    },
    // Fireflies
    (ctx, t, W, H) => {
      ctx.save();
      for (const f of fireflies) {
        f.x += Math.sin(t * 0.3 + f.phase) * f.drift;
        const px = ((f.x % 1) + 1) % 1 * W;
        const py = f.y * H + Math.sin(t * 0.5 + f.phase) * 8;
        const glow = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + f.phase));
        ctx.fillStyle = `rgba(180, 255, 140, ${glow * 0.6})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        // Soft glow halo
        const g = ctx.createRadialGradient(px, py, 0, px, py, 8);
        g.addColorStop(0, `rgba(180, 255, 140, ${glow * 0.15})`);
        g.addColorStop(1, 'rgba(180, 255, 140, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 8, py - 8, 16, 16);
      }
      ctx.restore();
    }
  ];
}

// ── Scene definitions ─────────────────────────────────────────────────

const SCENE_DEFS = [
  {
    palette: {
      textPrimary: 'rgba(190, 200, 215, 0.92)',
      textSecondary: 'rgba(150, 160, 180, 0.7)',
      accent: 'rgba(120, 130, 150, 0.8)'
    },
    layers: scene1Layers(),
    textReveal: { style: 'typewriter', speed: 35, delay: 0.8 },
    audioCue: 'ui_click'
  },
  {
    palette: {
      textPrimary: 'rgba(255, 210, 140, 0.92)',
      textSecondary: 'rgba(200, 160, 100, 0.7)',
      accent: 'rgba(255, 180, 80, 0.8)'
    },
    layers: scene2Layers(),
    textReveal: { style: 'typewriter', speed: 35, delay: 0.8 },
    audioCue: 'ui_hover'
  },
  {
    palette: {
      textPrimary: 'rgba(255, 240, 220, 0.92)',
      textSecondary: 'rgba(220, 190, 140, 0.7)',
      accent: 'rgba(255, 200, 120, 0.8)'
    },
    layers: scene3Layers(),
    textReveal: { style: 'typewriter', speed: 35, delay: 1.0 },
    audioCue: 'ui_click'
  },
  {
    palette: {
      textPrimary: 'rgba(255, 200, 170, 0.92)',
      textSecondary: 'rgba(220, 150, 120, 0.7)',
      accent: 'rgba(255, 140, 100, 0.8)'
    },
    layers: scene4Layers(),
    textReveal: { style: 'typewriter', speed: 35, delay: 0.8 },
    audioCue: 'menu_arrive'
  },
  {
    palette: {
      textPrimary: 'rgba(220, 245, 210, 0.92)',
      textSecondary: 'rgba(180, 220, 170, 0.7)',
      accent: 'rgba(140, 230, 160, 0.8)'
    },
    layers: scene5Layers(),
    textReveal: { style: 'typewriter', speed: 35, delay: 1.0 },
    audioCue: 'menu_arrive'
  }
];

// ── Cinematic controller ──────────────────────────────────────────────

/**
 * Create a campaign intro cinematic instance.
 * @param {Object} opts
 * @param {HTMLCanvasElement} opts.canvas — the game canvas to draw on
 * @param {Object} opts.audio — audio controller (from createAudioController), uses .play(name)
 * @param {Array} opts.scenes — CAMPAIGN_INTRO_SCENES array (kicker, title, text)
 * @param {Function} [opts.onComplete] — called when all scenes finish (reason='finished')
 * @param {Function} [opts.onSkip] — called when user skips (reason='skip')
 * @returns {{ start: Function, destroy: Function }}
 */
export function createCampaignIntroCinematic({ canvas, audio, scenes, onComplete, onSkip }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[campaign-intro-cinematic] canvas.getContext("2d") returned null. ' +
      'This canvas may already have a WebGL context. ' +
      'Pass a dedicated 2D canvas to the cinematic.');
    if (typeof onComplete === 'function') onComplete('skip');
    return { start() {}, destroy() {} };
  }
  const totalScenes = scenes.length;

  // State
  let rafId = null;
  let lastTime = 0;
  let cinematicTime = 0;      // total elapsed since start
  let letterboxProgress = 0;  // 0→1 animate in, 1→0 animate out
  let phase = 'enter';        // 'enter' | 'scene' | 'transition_out' | 'transition_in' | 'exit' | 'done'
  let sceneIndex = 0;
  let sceneStartTime = 0;
  let transitionTime = 0;
  let textRevealProgress = 0; // 0→1 for current scene's typewriter
  let textDone = false;
  let postTextTimer = 0;
  let finished = false;

  // Save previous canvas state for restore on destroy
  const prevImageSmoothingEnabled = ctx.imageSmoothingEnabled;

  // ── Input ──

  function onAdvance(e) {
    if (finished) return;
    if (e) {
      if (e.type === 'keydown') {
        if (e.key === 'Escape') { e.preventDefault(); doSkip(); return; }
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
      }
    }
    // If text is still typing, complete it instantly
    if (!textDone) {
      textRevealProgress = 1;
      textDone = true;
      return;
    }
    advanceScene();
  }

  function onClick(e) {
    if (finished) return;
    onAdvance(e);
  }

  function doSkip() {
    if (finished) return;
    cleanup();
    finished = true;
    if (typeof onSkip === 'function') onSkip('skip');
  }

  function advanceScene() {
    if (sceneIndex >= totalScenes - 1) {
      // Last scene → finish
      phase = 'exit';
      transitionTime = 0;
      return;
    }
    // Start transition out
    phase = 'transition_out';
    transitionTime = 0;
    try { audio?.play?.('ui_click'); } catch {}
  }

  // ── Helpers ──

  function getCanvasSize() {
    // Use the canvas's display size for DPR-aware rendering.
    // Also sync the backing buffer to match the CSS display size for crisp output.
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const needW = Math.round(cssW * dpr);
    const needH = Math.round(cssH * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: cssW, H: cssH };
  }

  function drawText(scene, sceneData, W, H, alpha) {
    const def = SCENE_DEFS[sceneIndex] || SCENE_DEFS[0];
    const pal = def.palette;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Text area is in the lower third, above letterbox bar
    const textTop = H * 0.42;
    const textLeft = W * 0.12;
    const textWidth = W * 0.76;

    // Kicker
    const kickerAlpha = clamp((cinematicTime - sceneStartTime) * 1.5, 0, 1);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = pal.accent;
    ctx.globalAlpha = alpha * kickerAlpha;
    drawLetterSpaced(ctx, sceneData.kicker.toUpperCase(), textLeft, textTop, 0.18);

    // Title — large serif, fade in
    const titleAlpha = clamp((cinematicTime - sceneStartTime - 0.3) * 1.2, 0, 1);
    ctx.globalAlpha = alpha * titleAlpha;
    const titleSize = Math.max(32, Math.min(56, W * 0.042));
    ctx.font = `${titleSize}px Georgia, serif`;
    ctx.fillStyle = pal.textPrimary;
    ctx.textBaseline = 'top';
    wrapText(ctx, sceneData.title, textLeft, textTop + 24, textWidth, titleSize * 1.3);

    // Body text — typewriter
    const fullText = sceneData.text;
    const reveal = def.textReveal;
    const delay = reveal.delay;
    const localT = cinematicTime - sceneStartTime - delay;
    if (reveal.style === 'typewriter') {
      const charsToShow = localT > 0 ? Math.floor(localT * reveal.speed) : 0;
      textRevealProgress = clamp(charsToShow / fullText.length, 0, 1);
      if (textRevealProgress >= 1 && !textDone) textDone = true;
    } else {
      textRevealProgress = clamp(localT * 0.8, 0, 1);
      if (textRevealProgress >= 1 && !textDone) textDone = true;
    }
    const shownText = fullText.slice(0, Math.ceil(textRevealProgress * fullText.length));
    const bodySize = Math.max(16, Math.min(22, W * 0.015));
    ctx.font = `${bodySize}px sans-serif`;
    ctx.fillStyle = pal.textSecondary;
    ctx.globalAlpha = alpha;
    wrapText(ctx, shownText, textLeft, textTop + 24 + titleSize * 1.3 + 16, textWidth, bodySize * 1.6);

    // Scene counter — bottom right
    ctx.font = '12px sans-serif';
    ctx.fillStyle = pal.textSecondary;
    ctx.globalAlpha = alpha * 0.6;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${sceneIndex + 1} / ${totalScenes}`, W - W * 0.06, H * 0.86);

    // Hint text — bottom center
    ctx.textAlign = 'center';
    ctx.globalAlpha = alpha * 0.4;
    ctx.font = '11px sans-serif';
    ctx.fillText('Space / click to advance  ·  Esc to skip', W / 2, H * 0.88);

    ctx.restore();
  }

  function drawLetterSpaced(ctx, text, x, y, spacing) {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing * 11;
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const testLine = line ? line + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function drawLetterbox(W, H) {
    const barHeight = H * 0.12 * letterboxProgress;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, barHeight);
    ctx.fillRect(0, H - barHeight, W, barHeight);
  }

  // ── Main loop ──

  function loop(timestamp) {
    if (finished) return;
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    cinematicTime += dt;

    const { W, H } = getCanvasSize();

    // Handle phase logic
    switch (phase) {
      case 'enter': {
        letterboxProgress = clamp(letterboxProgress + dt * 2.5, 0, 1);
        if (letterboxProgress >= 1) {
          phase = 'scene';
          sceneStartTime = cinematicTime;
          textDone = false;
          textRevealProgress = 0;
          try { audio?.play?.(SCENE_DEFS[sceneIndex]?.audioCue || 'ui_click'); } catch {}
        }
        break;
      }
      case 'scene': {
        const sceneElapsed = cinematicTime - sceneStartTime;
        // Draw the scene
        const def = SCENE_DEFS[sceneIndex] || SCENE_DEFS[0];
        const progress = clamp(sceneElapsed / 8, 0, 1); // 8s "full reveal" progress
        for (const layer of def.layers) {
          layer(ctx, sceneElapsed, W, H, progress);
        }
        // Text overlay
        drawText(sceneIndex, scenes[sceneIndex], W, H, 1);
        // Auto-advance on last scene after text done + hold
        if (textDone && sceneIndex >= totalScenes - 1) {
          postTextTimer += dt;
          if (postTextTimer > POST_TEXT_HOLD_MS / 1000) {
            phase = 'exit';
            transitionTime = 0;
          }
        }
        break;
      }
      case 'transition_out': {
        transitionTime += dt;
        const t = clamp(transitionTime / (TRANSITION_OUT_MS / 1000), 0, 1);
        // Draw current scene
        const def = SCENE_DEFS[sceneIndex] || SCENE_DEFS[0];
        const sceneElapsed = cinematicTime - sceneStartTime;
        const progress = clamp(sceneElapsed / 8, 0, 1);
        for (const layer of def.layers) {
          layer(ctx, sceneElapsed, W, H, progress);
        }
        drawText(sceneIndex, scenes[sceneIndex], W, H, 1 - t);
        // Black fade
        ctx.fillStyle = `rgba(0,0,0,${easeInOutQuad(t)})`;
        ctx.fillRect(0, 0, W, H);
        if (t >= 1) {
          sceneIndex++;
          phase = 'transition_in';
          transitionTime = 0;
          textDone = false;
          textRevealProgress = 0;
          postTextTimer = 0;
          try { audio?.play?.(SCENE_DEFS[sceneIndex]?.audioCue || 'ui_click'); } catch {}
        }
        break;
      }
      case 'transition_in': {
        transitionTime += dt;
        const t = clamp(transitionTime / (TRANSITION_IN_MS / 1000), 0, 1);
        // Draw new scene
        const def = SCENE_DEFS[sceneIndex] || SCENE_DEFS[0];
        const sceneElapsed = cinematicTime - sceneStartTime;
        const progress = clamp(sceneElapsed / 8, 0, 1);
        for (const layer of def.layers) {
          layer(ctx, sceneElapsed, W, H, progress);
        }
        // Text only after fade-in mostly done
        if (t > 0.6) {
          const textAlpha = clamp((t - 0.6) / 0.4, 0, 1);
          drawText(sceneIndex, scenes[sceneIndex], W, H, textAlpha);
        }
        // Black fade receding
        ctx.fillStyle = `rgba(0,0,0,${1 - easeInOutQuad(t)})`;
        ctx.fillRect(0, 0, W, H);
        if (t >= 1) {
          phase = 'scene';
          sceneStartTime = cinematicTime; // reset scene timer for progress calc
          textDone = false;
          textRevealProgress = 0;
        }
        break;
      }
      case 'exit': {
        letterboxProgress = clamp(letterboxProgress - dt * 2.5, 0, 1);
        const def = SCENE_DEFS[sceneIndex] || SCENE_DEFS[0];
        const sceneElapsed = cinematicTime - sceneStartTime;
        const progress = clamp(sceneElapsed / 8, 0, 1);
        for (const layer of def.layers) {
          layer(ctx, sceneElapsed, W, H, progress);
        }
        ctx.fillStyle = `rgba(0,0,0,${1 - letterboxProgress})`;
        ctx.fillRect(0, 0, W, H);
        if (letterboxProgress <= 0.01) {
          cleanup();
          finished = true;
          if (typeof onComplete === 'function') onComplete('finished');
          return;
        }
        break;
      }
    }

    // Draw letterbox bars on top of everything
    if (letterboxProgress > 0) {
      drawLetterbox(W, H);
    }

    rafId = requestAnimationFrame(loop);
  }

  // ── Cleanup ──

  function cleanup() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    canvas.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onAdvance);
    ctx.imageSmoothingEnabled = prevImageSmoothingEnabled;
  }

  // ── Public API ──

  function start() {
    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onAdvance);
    rafId = requestAnimationFrame(loop);
  }

  function destroy() {
    cleanup();
    finished = true;
  }

  return { start, destroy };
}

export default createCampaignIntroCinematic;
