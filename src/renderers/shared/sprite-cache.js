// ── Sprite cache: pre-render vector draw functions into ImageBitmaps at init ──
// This eliminates per-frame path-fill canvas API calls for bots and static objects.
// Falls back gracefully if OffscreenCanvas/ImageBitmap unavailable.

const SPRITE_SIZE = 48; // base sprite canvas size for bots
const SPRITE_HALF = SPRITE_SIZE / 2;

let cachePromise = null;
let cache = null;
let _initStarted = false;

// ── Generic offscreen canvas creator (works in browser + Node test env) ──
function makeOffscreenCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  throw new Error('No canvas implementation available');
}

/**
 * Pre-render a draw function onto an offscreen canvas.
 * @param {Function} drawFn - receives (ctx) to draw into a w×h canvas
 * @param {number} w
 * @param {number} h
 * @returns {{ canvas, ctx }} canvas + its 2d context
 */
export function preRender(drawFn, w, h) {
  const canvas = makeOffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  drawFn(ctx);
  return { canvas, ctx };
}

/**
 * Asynchronously convert a canvas/image to ImageBitmap for GPU-resident caching.
 * Falls back to the canvas itself if createImageBitmap is unavailable.
 * @param {HTMLCanvasElement|OffscreenCanvas|ImageBitmap} source
 * @returns {Promise<ImageBitmap|HTMLCanvasElement|OffscreenCanvas>}
 */
async function toBitmap(source) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(source); } catch { /* fall through */ }
  }
  return source;
}

/**
 * Generic pre-render + bitmap utility.
 * @param {Function} drawFn - receives (ctx, w, h)
 * @param {number} w
 * @param {number} h
 * @returns {Promise<ImageBitmap|HTMLCanvasElement|OffscreenCanvas>}
 */
export async function preRenderToBitmap(drawFn, w, h) {
  const { canvas } = preRender(ctx => drawFn(ctx, w, h), w, h);
  return toBitmap(canvas);
}

// ── Bot color palette (mirrors bot-system.js) ──
const BOT_COLORS = ['#80a9c9', '#9abf8f', '#d3a95f', '#c7b683', '#8fb9b5'];

// ── Draw a default bot body onto a ctx at center (SPRITE_HALF, SPRITE_HALF) ──
function drawBotBodyToCtx(ctx, color, radius, hover) {
  const cx = SPRITE_HALF;
  const cy = SPRITE_HALF;
  const pulse = hover ? 1.5 : 0;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius + 5, radius + 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = color;
  ctx.strokeStyle = hover ? '#fff4d0' : '#0e1512';
  ctx.lineWidth = hover ? 4 : 2;
  const bx = cx - radius - 2 - pulse;
  const by = cy - radius - 2 - pulse;
  const bw = (radius + 2 + pulse) * 2;
  const bh = bw;
  roundRectPath(ctx, bx, by, bw, bh, 8);
  ctx.fill(); ctx.stroke();
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  roundRectPath(ctx, cx - radius + 2, cy - radius + 2, radius * 1.4, radius * 0.58, 5);
  ctx.fill();
}

// ── Draw a dog bot body onto a ctx ──
function drawDogBodyToCtx(ctx, radius, facingRight) {
  const cx = SPRITE_HALF;
  const cy = SPRITE_HALF;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius + 6, radius + 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = '#8a6246';
  ctx.strokeStyle = '#3c281f';
  ctx.lineWidth = 2;
  roundRectPath(ctx, cx - radius - 3, cy - radius + 2, (radius + 3) * 2, radius * 1.45, 8);
  ctx.fill(); ctx.stroke();
  // Head
  ctx.fillStyle = '#9d7457';
  ctx.beginPath();
  ctx.ellipse(cx, cy - radius * 0.2, radius * 0.95, radius * 0.78, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Ears
  const earSide = facingRight ? 1 : -1;
  ctx.fillStyle = '#6f4b35';
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.45 * earSide, cy - radius * 0.75);
  ctx.lineTo(cx - radius * 0.8 * earSide, cy - radius * 1.35);
  ctx.lineTo(cx - radius * 0.15 * earSide, cy - radius * 1.05);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + radius * 0.18 * earSide, cy - radius * 0.7);
  ctx.lineTo(cx + radius * 0.55 * earSide, cy - radius * 1.25);
  ctx.lineTo(cx + radius * 0.02 * earSide, cy - radius * 0.96);
  ctx.closePath(); ctx.fill();
  // Eyes
  ctx.fillStyle = '#1b120f';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.22 * earSide, cy - radius * 0.15, 1.8, 0, Math.PI * 2);
  ctx.arc(cx + radius * 0.16 * earSide, cy - radius * 0.15, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Nose
  ctx.fillStyle = '#e5ece8';
  ctx.beginPath();
  ctx.arc(cx + radius * 0.42 * earSide, cy - radius * 0.02, 2.7, 0, Math.PI * 2);
  ctx.fill();
}

// ── Draw player character body onto a ctx ──
function drawPlayerBodyToCtx(ctx, radius, lowHp) {
  const cx = SPRITE_HALF;
  const cy = SPRITE_HALF;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius + 5, radius + 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body circle
  ctx.fillStyle = lowHp ? '#f5d8d4' : '#eef5ef';
  ctx.strokeStyle = '#26322d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Eye
  ctx.fillStyle = '#76b77f';
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 3, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ── Rounded rect path helper (inline to avoid import cycle in worker context) ──
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); return; }
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}

// ── Build the complete sprite cache ──
async function buildCache() {
  const out = {};
  const radius = 11; // matches bot-system default r:11

  // Bot sprites: one per color (5 colors), no hover variant (hover uses vector fallback)
  for (let i = 0; i < BOT_COLORS.length; i++) {
    const key = `bot_${i}`;
    const { canvas } = preRender(ctx => {
      drawBotBodyToCtx(ctx, BOT_COLORS[i], radius, false);
    }, SPRITE_SIZE, SPRITE_SIZE);
    out[key] = await toBitmap(canvas);
  }

  // Dog bot sprites: facing left + facing right
  for (const facing of [true, false]) {
    const key = `dog_${facing ? 'right' : 'left'}`;
    const { canvas } = preRender(ctx => {
      drawDogBodyToCtx(ctx, 12, facing);
    }, SPRITE_SIZE, SPRITE_SIZE);
    out[key] = await toBitmap(canvas);
  }

  // Player character sprites: normal + low-hp
  for (const [label, lowHp] of [['normal', false], ['lowhp', true]]) {
    const key = `player_${label}`;
    const { canvas } = preRender(ctx => {
      drawPlayerBodyToCtx(ctx, 13, lowHp);
    }, SPRITE_SIZE, SPRITE_SIZE);
    out[key] = await toBitmap(canvas);
  }

  return out;
}

/**
 * Initialize the sprite cache. Call once at startup.
 * Returns a promise resolving to the cache object.
 */
export function initSpriteCache() {
  if (!cachePromise) {
    cachePromise = buildCache().then(c => { cache = c; return c; }).catch(err => {
      console.warn('[sprite-cache] Failed to build sprite cache:', err);
      cache = null;
      return null;
    });
  }
  return cachePromise;
}

/**
 * Get the current sprite cache (or null if not yet built).
 */
export function getSpriteCache() {
  return cache;
}

/**
 * Check if sprite cache is initialized and ready.
 */
export function isSpriteCacheReady() {
  return cache !== null;
}

/**
 * Get a bot sprite key from its color.
 * Maps bot color to the pre-rendered sprite index.
 */
export function botSpriteKey(bot) {
  if (bot.kind === 'dog') {
    const facingRight = (bot.facingX ?? 1) >= 0;
    return `dog_${facingRight ? 'right' : 'left'}`;
  }
  const color = bot.color || BOT_COLORS[0];
  const idx = BOT_COLORS.indexOf(color);
  return `bot_${idx >= 0 ? idx : 0}`;
}

/**
 * Player sprite key.
 */
export function playerSpriteKey(player) {
  const hpRatio = Math.max(0, Math.min(1, (player.hp ?? 10) / Math.max(1, player.maxHp || 10)));
  return hpRatio <= 0.3 ? 'player_lowhp' : 'player_normal';
}

export { SPRITE_SIZE, SPRITE_HALF, BOT_COLORS };
