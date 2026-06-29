import { loadTinySwordsAtlas, getTinySwordsAtlas, TROOP_CELL } from '../shared/tiny-swords-atlas.js?v=ts_fix2_0628';

const CHARACTER_FRAME_SIZE = { width: 96, height: 80 };
const CHARACTER_ANIMATION_NAMES = ['idle', 'run', 'attack1', 'attack2'];
export const CHARACTER_PATHS = {
  idle: 'IDLE',
  run: 'RUN',
  attack1: 'ATTACK 1',
  attack2: 'ATTACK 2'
};
const CHARACTER_SCALE = 1.38;
const CHARACTER_GROUND_OFFSET = 11;

// ── Bot (Pawn) sprite assets ──────────────────────────────────────
// Loaded from the same Tiny Swords atlas as the player (Warrior_Blue).
// Pawn_Blue is a 6×6 grid of 192×192 walk/idle cells.
let _botPawnAssets = null;

/**
 * Load Pawn_Blue bot sprites from the Tiny Swords atlas.
 * Returns null on failure; callers should use the vector fallback.
 *
 * @param {typeof import('../../../vendor/pixi/pixi.mjs')} PIXI
 * @returns {Promise<{ready:true, textures:Array, scale:number, yOffset:number}|null>}
 */
export async function loadBotPawnAssets(PIXI) {
  if (_botPawnAssets) return _botPawnAssets;
  const atlas = await loadTinySwordsAtlas();
  if (!atlas) return null;
  const pawnFrames = atlas.getSheetFrames('Pawn_Blue', TROOP_CELL);
  if (!pawnFrames || pawnFrames.length === 0) return null;
  const baseTexture = PIXI.BaseTexture.from(atlas.bitmap);
  const textures = pawnFrames.map(rect =>
    new PIXI.Texture({ source: baseTexture, frame: new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h) })
  );
  // Canvas2D path: drawSize = (bot.r||12) * 2.6 ≈ 31px. scale 0.16 → 192*0.16 ≈ 31px.
  // Pawn cells have empty space at the bottom; y-offset pushes sprite down to
  // sit on the shadow. ~30px empty / 192 * 31 ≈ 4.8 → round to 5.
  _botPawnAssets = {
    ready: true,
    textures,
    scale: 0.16,
    yOffset: 5
  };
  console.info(`[character-assets] Loaded ${textures.length} Pawn_Blue frames from Tiny Swords atlas`);
  return _botPawnAssets;
}

/**
 * Get the loaded bot pawn assets (or null if not loaded).
 * @returns {{ready:true, textures:Array, scale:number, yOffset:number}|null}
 */
export function getBotPawnAssets() {
  return _botPawnAssets;
}

/**
 * Get the appropriate frame texture for a bot pawn at a given animation time.
 *
 * @param {object} sprite - The PIXI sprite with _botAnimState
 * @param {object} assets - Loaded pawn assets
 * @param {boolean} isMoving - Whether the bot is currently moving
 * @param {number} now - performance.now()
 * @returns {object|null} The texture for the current frame
 */
export function getBotPawnFrameTexture(sprite, assets, isMoving, now) {
  if (!assets || !assets.textures || assets.textures.length === 0) return null;
  const textures = assets.textures;
  const frameCount = textures.length;
  if (!sprite._botAnimState) {
    sprite._botAnimState = { key: null, startedAt: 0, frameIndex: 0 };
  }
  const state = sprite._botAnimState;
  const stateKey = isMoving ? 'walk' : 'idle';
  if (state.key !== stateKey) {
    state.key = stateKey;
    state.startedAt = now;
    state.frameIndex = 0;
  }
  if (isMoving) {
    const frameDuration = Math.max(40, 1000 / 8); // 8fps walk cycle
    state.frameIndex = Math.floor((now - state.startedAt) / frameDuration) % frameCount;
  } else {
    state.frameIndex = 0;
  }
  return textures[state.frameIndex] || textures[0];
}

/**
 * Load character spritesheet assets for the Pixi renderer.
 *
 * Primary path: Tiny Swords atlas (Warrior_Blue sub-sheet sliced into 192×192
 * cells).  This atlas is already loaded for the Canvas2D path and is guaranteed
 * to exist.
 *
 * Fallback path: individual per-direction PNG sprites under
 * /public/assets/character/Sprites/ (original design — currently no assets
 * deployed at this path, so all loads fail and we fall through).
 *
 * Returns a structure shaped as { ready, idle:{dir:{textures,scale,yOffset}},
 * run:{...}, attack1:{...}, attack2:{...} }.
 */
export async function loadCharacterAssets(PIXI) {
  // ── Primary: Tiny Swords Warrior_Blue atlas ──────────────────────
  const atlas = await loadTinySwordsAtlas();
  if (atlas) {
    const warriorFrames = atlas.getSheetFrames('Warrior_Blue', TROOP_CELL);
    if (warriorFrames && warriorFrames.length > 0) {
      // Create a PIXI BaseTexture from the atlas ImageBitmap
      const baseTexture = PIXI.BaseTexture.from(atlas.bitmap);
      const textures = warriorFrames.map(rect =>
        new PIXI.Texture({ source: baseTexture, frame: new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h) })
      );

      // Tiny Swords Warrior_Blue is a 6-col × 8-row sheet (48 cells).
      // We use the first few frames for idle, mid frames for walk, and
      // later frames for attack.  All directions share the same texture set;
      // left-facing is handled by flipping scale.x in the renderer.
      const frameCount = textures.length;
      const idleTextures = textures.slice(0, Math.min(6, frameCount));
      const runTextures = textures.slice(0, Math.min(24, frameCount));
      const attackTextures = textures.slice(Math.floor(frameCount * 0.5), frameCount);

      const makeAnim = texs => ({
        textures: texs.length > 0 ? texs : idleTextures,
        // 192px cells. Canvas2D path draws knight at (player.r||13)*3.0 ≈ 39px.
        // scale 0.22 → 192*0.22 ≈ 42px, matching the Canvas2D draw size.
        scale: 0.22,  // 192px cells scaled to ~42px in-world
        // Tiny Swords Warrior_Blue cells have ~40px of empty space at the
        // bottom (feet are above the cell bottom). Anchor (0.5, 1) puts the
        // anchor at the cell bottom, so the visual feet float above the
        // shadow. This y-offset pushes the sprite down so the feet touch the
        // ground/shadow.  In world units at scale 0.22: 40px/192 * 42 ≈ 8.75.
        yOffset: 9
      });

      const result = {
        ready: true,
        idle: { up: makeAnim(idleTextures), down: makeAnim(idleTextures), left: makeAnim(idleTextures), right: makeAnim(idleTextures) },
        run: { up: makeAnim(runTextures), down: makeAnim(runTextures), left: makeAnim(runTextures), right: makeAnim(runTextures) },
        attack1: { up: makeAnim(attackTextures), down: makeAnim(attackTextures), left: makeAnim(attackTextures), right: makeAnim(attackTextures) },
        attack2: { up: makeAnim(attackTextures), down: makeAnim(attackTextures), left: makeAnim(attackTextures), right: makeAnim(attackTextures) }
      };
      console.info(`[character-assets] Loaded ${frameCount} Warrior_Blue frames from Tiny Swords atlas`);
      return result;
    }
  }

  // ── Fallback: per-direction PNG sprites (original design) ────────
  const basePath = '/public/assets/character/Sprites';
  const entries = await Promise.all(CHARACTER_ANIMATION_NAMES.flatMap(name => ['up', 'down', 'left', 'right'].map(async direction => {
    const folder = CHARACTER_PATHS[name];
    const file = `${basePath}/${folder}/${name}_${direction}.png`;
    try {
      const image = await loadImage(file);
      const animation = sliceCharacterSheet(PIXI, image, CHARACTER_FRAME_SIZE);
      return [`${name}:${direction}`, animation];
    } catch {
      return [`${name}:${direction}`, null];
    }
  })));
  const byAction = {};
  let anyLoaded = false;
  for (const [key, frameTextures] of entries) {
    const [name, direction] = key.split(':');
    (byAction[name] ||= {})[direction] = frameTextures;
    if (frameTextures) anyLoaded = true;
  }
  if (!anyLoaded) {
    console.warn('[character-assets] No character sprites loaded (atlas + PNG paths both failed); using vector fallback');
    return { ready: false };
  }
  return {
    ready: true,
    ...byAction
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load character asset: ${src}`));
    image.src = src;
  });
}

function sliceCharacterSheet(PIXI, image, frameSize) {
  const bounds = findOpaqueBounds(image, frameSize);
  if (!bounds) return null;
  const frames = [];
  const columns = Math.max(1, Math.floor((image.width || 0) / frameSize.width));
  const rows = Math.max(1, Math.floor((image.height || 0) / frameSize.height));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const canvas = document.createElement('canvas');
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        col * frameSize.width + bounds.x,
        row * frameSize.height + bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      const texture = PIXI.Texture.from(canvas);
      frames.push(texture);
    }
  }
  return { textures: frames, scale: CHARACTER_SCALE, yOffset: CHARACTER_GROUND_OFFSET };
}

export function getCharacterAnimationFrame(characterAssets, actorState) {
  if (!characterAssets?.ready) return null;
  const facing = getFacingDirection(actorState.facingX, actorState.facingY);
  const action = getCharacterAction(actorState.action);
  const animationKey = action === 'attack' ? (Math.floor(performance.now() / 250) % 2 === 0 ? 'attack1' : 'attack2') : action;
  const animation = characterAssets[animationKey] || characterAssets.idle;
  const textures = animation?.[facing]?.textures || animation?.down?.textures;
  if (!Array.isArray(textures) || textures.length === 0) return null;
  const speed = action === 'run' ? 70 : action === 'attack' ? 55 : 110;
  return {
    textures,
    speed,
    scale: animation?.[facing]?.scale || animation?.down?.scale || CHARACTER_SCALE,
    yOffset: animation?.[facing]?.yOffset || animation?.down?.yOffset || CHARACTER_GROUND_OFFSET
  };
}

export function getCharacterFrameTexture(characterSprite, animation, actorState) {
  const textures = animation.textures || [];
  if (textures.length === 0) return null;
  const now = performance.now();
  const action = getCharacterAction(actorState.action);
  const stateKey = `${action}:${getFacingDirection(actorState.facingX, actorState.facingY)}:${textures.length}`;
  characterSprite._animState ||= { key: null, startedAt: 0, frameIndex: 0, lastFrameIndex: -1 };
  const animState = characterSprite._animState;
  if (animState.key !== stateKey) {
    animState.key = stateKey;
    animState.startedAt = now;
    animState.frameIndex = 0;
    animState.lastFrameIndex = -1;
  }
  if (action === 'attack') {
    const attackDuration = 280;
    const elapsed = now - animState.startedAt;
    const lastIndex = textures.length - 1;
    const nextIndex = elapsed >= attackDuration ? lastIndex : Math.min(lastIndex, Math.floor((elapsed / attackDuration) * textures.length));
    animState.frameIndex = nextIndex;
  } else {
    const frameDuration = Math.max(50, animation.speed || 100);
    animState.frameIndex = Math.floor((now - animState.startedAt) / frameDuration) % textures.length;
  }
  return textures[animState.frameIndex] || textures[0];
}

function findOpaqueBounds(image, frameSize) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const frameX = minX % frameSize.width;
  const frameY = minY % frameSize.height;
  const widthPx = Math.min(frameSize.width, maxX - minX + 1);
  const heightPx = Math.min(frameSize.height, maxY - minY + 1);
  return {
    x: frameX,
    y: frameY,
    width: widthPx,
    height: heightPx
  };
}

export function getCharacterAction(action) {
  const value = String(action || '').toLowerCase();
  if (value.includes('attack')) return 'attack';
  if (value.includes('run') || value.includes('move') || value.includes('walk') || value.includes('dash') || value.includes('target')) return 'run';
  if (value.includes('hurt') || value.includes('death') || value.includes('heal')) return 'idle';
  return 'idle';
}

export function getFacingDirection(facingX = 1, facingY = 0) {
  if (Math.abs(facingX) > Math.abs(facingY)) return facingX < 0 ? 'left' : 'right';
  return facingY < 0 ? 'up' : 'down';
}

export function inferPlayerAction(renderState) {
  if (renderState.player?.attackCooldown > 0) return 'attack';
  if (renderState.player?.target || (Array.isArray(renderState.player?.targetQueue) && renderState.player.targetQueue.length > 0)) return 'run';
  return 'idle';
}
