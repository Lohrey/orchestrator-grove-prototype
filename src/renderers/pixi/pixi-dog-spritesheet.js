/**
 * Golden Retriever spritesheet asset loader.
 *
 * Loads the 16-frame walk-cycle spritesheet via PixiJS Assets API and slices
 * it into individual frame textures for AnimatedSprite or manual frame cycling.
 *
 * Falls back gracefully (returns null) if the texture cannot be loaded, so the
 * caller can use the vector-drawn dog instead.
 *
 * Spritesheet: assets/golden_retriever_walk_16f.png
 *   4×4 grid, 1024×1024 total, 256×256 per frame, 16 frames.
 * Runtime:     assets/golden_retriever_walk_16f_512.png
 *   4×4 grid, 512×512 total, 128×128 per frame.
 */

const DOG_FRAME_COUNT = 16;
const DOG_GRID_COLS = 4;
const DOG_GRID_ROWS = 4;

/** Runtime frame size in the 512×512 sheet (128×128 per frame). */
const DOG_FRAME_SIZE = 128;

/** Animation speed (frames per tick at 60fps → ~12fps visible). */
const DOG_ANIMATION_SPEED = 0.2;

/** Bottom-center-ish anchor for ground entities. */
const DOG_ANCHOR = { x: 0.5, y: 0.85 };

/** Sprite draw scale relative to in-game bot radius. */
const DOG_SPRITE_SCALE = 0.38;

let _dogAssetPromise = null;
let _dogAssets = null;

/**
 * Preload the dog spritesheet and return sliced frame textures.
 * Returns null on any failure so callers can fall back to vector rendering.
 *
 * @param {typeof import('../../../vendor/pixi/pixi.mjs')} PIXI
 * @returns {Promise<{textures: Array, frameCount: number, animationSpeed: number, anchor: {x:number,y:number}, scale: number} | null>}
 */
export async function loadDogSpriteSheet(PIXI) {
  // Avoid duplicate loads
  if (_dogAssets) return _dogAssets;
  if (_dogAssetPromise) return _dogAssetPromise;

  const runtimeUrl = 'assets/golden_retriever_walk_16f_512.png';

  _dogAssetPromise = (async () => {
    try {
      const texture = await PIXI.Assets.load(runtimeUrl);
      const source = texture.source || texture.baseTexture;
      const textures = [];

      for (let row = 0; row < DOG_GRID_ROWS; row++) {
        for (let col = 0; col < DOG_GRID_COLS; col++) {
          const frame = new PIXI.Rectangle(
            col * DOG_FRAME_SIZE,
            row * DOG_FRAME_SIZE,
            DOG_FRAME_SIZE,
            DOG_FRAME_SIZE
          );
          const frameTexture = new PIXI.Texture({ source, frame });
          textures.push(frameTexture);
        }
      }

      if (textures.length !== DOG_FRAME_COUNT) {
        throw new Error(`Expected ${DOG_FRAME_COUNT} frames, got ${textures.length}`);
      }

      _dogAssets = {
        textures,
        frameCount: DOG_FRAME_COUNT,
        animationSpeed: DOG_ANIMATION_SPEED,
        anchor: DOG_ANCHOR,
        scale: DOG_SPRITE_SCALE,
        ready: true
      };

      // Expose debug hook
      if (typeof window !== 'undefined') {
        window.dogAnimationDebug = {
          loaded: true,
          frameCount: DOG_FRAME_COUNT,
          frameSize: DOG_FRAME_SIZE,
          grid: `${DOG_GRID_COLS}×${DOG_GRID_ROWS}`,
          animationSpeed: DOG_ANIMATION_SPEED,
          anchor: DOG_ANCHOR,
          scale: DOG_SPRITE_SCALE,
          sourceUrl: runtimeUrl,
          textures: _dogAssets.textures,
          getFrameTexture(index) {
            return _dogAssets?.textures?.[index % DOG_FRAME_COUNT] || null;
          }
        };
      }

      return _dogAssets;
    } catch (error) {
      console.warn('[dog-spritesheet] Failed to load golden retriever spritesheet; using vector fallback.', error);

      // Expose debug hook even on failure
      if (typeof window !== 'undefined') {
        window.dogAnimationDebug = {
          loaded: false,
          error: String(error?.message || error),
          frameCount: DOG_FRAME_COUNT,
          grid: `${DOG_GRID_COLS}×${DOG_GRID_ROWS}`,
          sourceUrl: runtimeUrl
        };
      }
      _dogAssets = null;
      return null;
    } finally {
      _dogAssetPromise = null;
    }
  })();

  return _dogAssetPromise;
}

/**
 * Check if dog sprite assets are loaded and ready.
 * @returns {boolean}
 */
export function isDogSpriteReady() {
  return !!(_dogAssets && _dogAssets.ready);
}

/**
 * Get the loaded dog assets (or null if not loaded).
 * @returns {{textures: Array, frameCount: number, animationSpeed: number, anchor: {x:number,y:number}, scale: number, ready: boolean} | null}
 */
export function getDogSpriteAssets() {
  return _dogAssets;
}

/**
 * Get the appropriate frame texture for a dog at a given animation time.
 *
 * @param {object} dogSprite - The PIXI sprite/container with _dogAnimState
 * @param {object} assets - Loaded dog assets
 * @param {boolean} isMoving - Whether the dog is currently moving
 * @param {number} now - performance.now()
 * @returns {object|null} The texture for the current frame
 */
export function getDogFrameTexture(dogSprite, assets, isMoving, now) {
  if (!assets || !assets.textures || assets.textures.length === 0) return null;

  const textures = assets.textures;
  const frameCount = textures.length;

  // Initialize per-sprite animation state
  if (!dogSprite._dogAnimState) {
    dogSprite._dogAnimState = { key: null, startedAt: 0, frameIndex: 0 };
  }
  const state = dogSprite._dogAnimState;

  const stateKey = isMoving ? 'walk' : 'idle';
  if (state.key !== stateKey) {
    state.key = stateKey;
    state.startedAt = now;
    state.frameIndex = isMoving ? 0 : 0;
  }

  if (isMoving) {
    // Cycle through all 16 frames at animationSpeed
    const frameDuration = Math.max(40, 1000 / 12); // 12fps
    state.frameIndex = Math.floor((now - state.startedAt) / frameDuration) % frameCount;
  } else {
    // Idle: hold on frame 0 (or gentle bob between frames 0-1)
    state.frameIndex = 0;
  }

  return textures[state.frameIndex] || textures[0];
}
