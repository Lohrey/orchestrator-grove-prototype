// ── Character sprite loader: 8-frame walk-cycle PNGs ───────────────────
// Loads pre-rendered 8-frame walk cycles for bot, player, and dog characters
// from assets/sprites/processed/. Each character has frames _00.._07.png,
// 64×64 RGBA, played in sequence as a walk animation.
//
// The existing procedural sprite-cache entries (drawBotBodyToCtx etc.) remain
// the FALLBACK. If any PNG fails to load (404, network error, decode error),
// the loader marks that character as unavailable and the renderers continue
// using the procedural sprites. No old code is deleted.
//
// Cache keys added to the sprite cache by integrateIntoCache():
//   char_<name>_walk      → [ImageBitmap|Image × 8]  (walk frames 0..7)
//   char_<name>_walk_meta → { w:64, h:64, cx:32, cy:32, frames:8 }
//   char_<name>_ready     → boolean (true only if all 8 frames loaded)
//
// Names: 'bot', 'player', 'dog'.

const CHAR_SIZE = 64;       // sprite canvas dimension (power-of-2 grid)
const CHAR_HALF = CHAR_SIZE / 2;
const WALK_FRAMES = 8;      // 8-frame walk cycle
const FRAME_MS = 100;       // ~100ms per frame → 10fps walk cycle (~12.5 fps at 60)

// Base path for processed sprite PNGs. Relative to the page root so it works
// under both `python3 -m http.server` and the Node server.
const SPRITE_BASE = 'assets/sprites/processed';

// Per-character load state. `ready` flips true only when all 8 frames load.
const charState = {
  bot:    { frames: [], ready: false, error: null },
  player: { frames: [], ready: false, error: null },
  dog:    { frames: [], ready: false, error: null }
};

let _loadPromise = null;

/**
 * Load a single PNG as an Image (browser) or ImageBitmap (worker).
 * Returns a Promise<Image|ImageBitmap> that rejects on error/404.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    } else if (typeof fetch !== 'undefined') {
      // Worker / Node-ish fallback: fetch → ImageBitmap
      fetch(src)
        .then(r => r.ok ? r.blob() : Promise.reject(new Error(`${src} → ${r.status}`)))
        .then(b => (typeof createImageBitmap === 'function') ? createImageBitmap(b) : b)
        .then(resolve, reject);
    } else {
      reject(new Error('No image loading mechanism available'));
    }
  });
}

/**
 * Load all 8 walk-cycle frames for a character.
 * Sets charState[name].ready = true only if ALL frames load.
 * On any failure, marks the character unavailable (falls back to procedural).
 */
async function loadCharacter(name) {
  const st = charState[name];
  if (!st) return;
  const frames = [];
  for (let i = 0; i < WALK_FRAMES; i++) {
    const src = `${SPRITE_BASE}/${name}_${String(i).padStart(2, '0')}.png`;
    try {
      frames.push(await loadImage(src));
    } catch (err) {
      st.ready = false;
      st.error = err;
      // Don't spam the console for 404s when sprites simply aren't present.
      console.warn(`[character-sprites] ${name} walk-cycle unavailable, using procedural fallback:`, err.message);
      return;
    }
  }
  st.frames = frames;
  st.ready = frames.length === WALK_FRAMES;
}

/**
 * Load all character sprite sheets (bot, player, dog).
 * Idempotent — safe to call multiple times. Returns a promise that resolves
 * when the load attempt is complete (success or graceful failure).
 */
export function loadCharacterSprites() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    await Promise.allSettled([loadCharacter('bot'), loadCharacter('player'), loadCharacter('dog')]);
  })();
  return _loadPromise;
}

/**
 * Returns true if the 8-frame walk cycle is available for a character.
 */
export function isCharacterSpriteReady(name) {
  return !!(charState[name] && charState[name].ready);
}

/**
 * Get the walk-cycle frame array for a character, or null if not ready.
 * @param {string} name - 'bot', 'player', or 'dog'
 * @returns {Array<Image|ImageBitmap>|null}
 */
export function getCharacterFrames(name) {
  const st = charState[name];
  return st && st.ready ? st.frames : null;
}

/**
 * Compute the walk-cycle frame index for a moving entity.
 * @param {number} now - performance.now() timestamp
 * @param {number} idOffset - per-entity offset to desync animations (e.g. bot.id)
 * @returns {number} frame index 0..7
 */
export function walkFrameIndex(now, idOffset = 0) {
  return Math.floor((now / FRAME_MS + idOffset) % WALK_FRAMES);
}

/**
 * Get a specific walk-cycle frame for a character.
 * @param {string} name - 'bot', 'player', or 'dog'
 * @param {number} frameIndex - 0..7
 * @returns {Image|ImageBitmap|null}
 */
export function getCharacterWalkFrame(name, frameIndex) {
  const frames = getCharacterFrames(name);
  if (!frames) return null;
  const idx = ((frameIndex | 0) % WALK_FRAMES + WALK_FRAMES) % WALK_FRAMES;
  return frames[idx] || null;
}

/**
 * Integrate loaded character sprites into an existing sprite-cache object.
 * Adds char_<name>_walk (array) + char_<name>_walk_meta + char_<name>_ready
 * entries for each character that loaded successfully. Does NOT overwrite
 * existing procedural entries — only adds the walk-cycle keys.
 *
 * Call after buildCache() resolves, before first render.
 *
 * @param {object} cache - the sprite cache object from sprite-cache.js
 */
export function integrateIntoCache(cache) {
  if (!cache) return;
  for (const name of Object.keys(charState)) {
    const st = charState[name];
    cache[`char_${name}_ready`] = !!st.ready;
    if (st.ready && st.frames.length === WALK_FRAMES) {
      cache[`char_${name}_walk`] = st.frames.slice();
      cache[`char_${name}_walk_meta`] = {
        w: CHAR_SIZE, h: CHAR_SIZE, cx: CHAR_HALF, cy: CHAR_HALF, frames: WALK_FRAMES
      };
    }
  }
}

export { CHAR_SIZE, CHAR_HALF, WALK_FRAMES, FRAME_MS };
