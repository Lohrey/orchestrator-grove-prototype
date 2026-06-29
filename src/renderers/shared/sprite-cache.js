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

// ── Draw a rock body onto a ctx (simplified, no hover bar) ──
function drawRockBodyToCtx(ctx, radius, depleted) {
  const cx = (radius + 14);
  const cy = (radius + 14);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 0.72, radius * 1.15, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, depleted ? '#555c58' : '#a9b0aa');
  grad.addColorStop(1, depleted ? '#313733' : '#5d6761');
  ctx.fillStyle = grad;
  ctx.strokeStyle = depleted ? '#6c746f' : '#d2d8d3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy + 6);
  ctx.lineTo(cx - 9, cy - radius);
  ctx.lineTo(cx + 12, cy - radius + 2);
  ctx.lineTo(cx + radius, cy + 7);
  ctx.lineTo(cx + 4, cy + radius);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Highlight
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.moveTo(cx - 6, cy - radius + 5); ctx.lineTo(cx + 8, cy + 4); ctx.stroke();
}

// ── Draw a tree body onto a ctx (simplified, no hover/health bar) ──
function drawTreeBodyToCtx(ctx, radius, stage) {
  const cx = (radius + 12);
  const cy = (radius + 12);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 0.8, radius * 1.15, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  if (stage === 'sapling') {
    ctx.strokeStyle = '#9abf8f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy - 10); ctx.stroke();
    // Small leaf blobs
    treeLeafBlob(ctx, cx - 6, cy - 6, 6, '#78aa68');
    treeLeafBlob(ctx, cx + 6, cy - 8, 6, '#9ac887');
    return;
  }

  // Trunk
  const trunkW = stage === 'small_tree' ? 10 : 13;
  const trunkH = stage === 'small_tree' ? 25 : 34;
  const trunkGrad = ctx.createLinearGradient(cx - trunkW / 2, cy, cx + trunkW / 2, cy);
  trunkGrad.addColorStop(0, '#8e6437');
  trunkGrad.addColorStop(1, '#6a4622');
  ctx.fillStyle = trunkGrad;
  roundRectPath(ctx, cx - trunkW / 2, cy + 3, trunkW, trunkH, 4);
  ctx.fill();

  // Foliage blobs
  treeLeafBlob(ctx, cx - 10, cy - 2, radius * 0.82, '#2f5737');
  treeLeafBlob(ctx, cx + 13, cy - 4, radius * 0.74, '#426d42');
  treeLeafBlob(ctx, cx, cy - 17, radius * 0.9, stage === 'small_tree' ? '#4f824e' : '#37643b');
  treeLeafBlob(ctx, cx + 1, cy + 7, radius * 0.7, '#274b31');
}

function treeLeafBlob(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
  g.addColorStop(0, lightenHex(color, 0.18));
  g.addColorStop(1, darkenHex(color, 0.12));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ── Color helpers for tree foliage ──
function lightenHex(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amt))},${Math.min(255, Math.round(g + (255 - g) * amt))},${Math.min(255, Math.round(b + (255 - b) * amt))})`;
}
function darkenHex(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
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

  // ── World object sprites: trees and rocks ────────────────────────
  // Pre-render common variants so drawWorld can blit instead of
  // running per-frame vector paths.  Each entry is keyed by type+radius
  // so the render loop can look up the closest cached size.

  // Trees: grown_tree (r=22 default), small_tree (r=18), sapling (r=14)
  for (const [stage, treeRadius] of [['grown_tree', 22], ['small_tree', 18], ['sapling', 14]]) {
    const key = `tree_${stage}`;
    const size = (treeRadius + 12) * 2; // padding for foliage/leaves
    const { canvas } = preRender(ctx => {
      drawTreeBodyToCtx(ctx, treeRadius, stage);
    }, size, size);
    out[key] = await toBitmap(canvas);
    // Store metadata so the draw path knows the canvas size
    out[key + '_meta'] = { w: size, h: size, cx: size / 2, cy: size / 2 };
  }

  // Rocks: standard deposit (r=18 default)
  for (const [variant, rockRadius] of [['normal', 18], ['depleted', 18]]) {
    const key = `rock_${variant}`;
    const size = (rockRadius + 14) * 2;
    const { canvas } = preRender(ctx => {
      drawRockBodyToCtx(ctx, rockRadius, variant === 'depleted');
    }, size, size);
    out[key] = await toBitmap(canvas);
    out[key + '_meta'] = { w: size, h: size, cx: size / 2, cy: size / 2 };
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

/**
 * Get a tree sprite key from its growth stage.
 * Returns null for stumps (stumps should use procedural drawing).
 */
export function treeSpriteKey(tree) {
  if (tree.stump) return null;
  const stage = tree.growthStage || 'grown_tree';
  return `tree_${stage}`;
}

/**
 * Get a rock sprite key.
 */
export function rockSpriteKey(rock) {
  return rock.depleted ? 'rock_depleted' : 'rock_normal';
}

/**
 * Get the cached sprite and its draw metadata for a world object.
 * Returns { sprite, meta } or null if not cached.
 */
export function getWorldObjectSprite(key) {
  if (!cache) return null;
  const sprite = cache[key];
  const meta = cache[key + '_meta'];
  if (!sprite || !meta) return null;
  return { sprite, meta };
}

export { SPRITE_SIZE, SPRITE_HALF, BOT_COLORS };
