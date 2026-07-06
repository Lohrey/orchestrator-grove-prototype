// ── Renderer File Map ──────────────────────────────────────────────
// Entry:        src/renderers/index.js (this file — mode selection)
// WebGL2:       webgl2-renderer.js → webgl2/batcher.js + webgl2/shaders.js
// Canvas2D:     canvas2d-renderer.js → canvas-renderer.js (coordinator) →
//               canvas2d/background-layer.js, world-layer.js,
//               entities-layer.js, effects-layer.js, hud-layer.js, overlay-layer.js
// Pixi:         pixi-renderer.js → pixi/pixi-entities.js, pixi-character-assets.js,
//               pixi-layers.js, pixi-lighting.js, pixi-terrain.js, pixi-effects.js,
//               pixi-dog-spritesheet.js
// Shared:       shared/sprite-cache.js, shared/renderer-utils.js,
//               shared/character-sprite-loader.js, shared/lpc-terrain-loader.js,
//               shared/tiny-swords-atlas.js, shared/depth-sort.js,
//               shared/render-state.js, shared/fog-of-war.js
// ────────────────────────────────────────────────────────────────────

import { createCanvas2dRenderer } from './canvas2d-renderer.js';

// Default renderer mode. WebGL2 is now the default (Tier 3 — highest performance
// for large sprite counts with custom walk-cycle sprite support). Pixi and
// Canvas2D remain selectable in the settings UI as alternatives. If WebGL2 is
// not supported by the browser/GPU, selection gracefully falls through to
// Canvas2D (see below).
export async function createRenderBackend({ canvas, mode = 'webgl2', capture = false, settings = null } = {}) {
  const normalized = String(mode || 'webgl2').toLowerCase();

  if (normalized === 'pixi') {
    try {
      const { createPixiRenderer } = await import('./pixi-renderer.js');
      return await createPixiRenderer({ canvas, capture, settings });
    } catch (err) {
      console.warn('Pixi renderer failed; falling back to Canvas2D', err);
    }
  }

  // WebGL2 path (Tier 3): highest performance for large sprite counts.
  // This is the DEFAULT renderer. Falls back gracefully to Canvas2D if the
  // browser/GPU does not support WebGL2 or if renderer init fails.
  if (normalized === 'webgl2') {
    try {
      const { createWebGL2Renderer, isWebGL2Supported } = await import('./webgl2-renderer.js');
      if (isWebGL2Supported()) {
        const gl2 = await createWebGL2Renderer({ canvas });
        if (gl2) return gl2;
      }
    } catch (err) {
      console.warn('WebGL2 renderer failed; falling back to Canvas2D', err);
    }
  }

  // Main-thread Canvas2D path (always used for canvas2d mode, and as the final
  // fallback when WebGL2 or Pixi are unavailable or fail).
  // The OffscreenCanvas worker path was removed — it caused multiple bugs:
  // frozen canvas dimensions (broke resize/zoom), race conditions on
  // viewport change (devtools open → permanent black screen), silent error
  // swallowing, and fragile worker module loading. Main-thread Canvas2D
  // with the sprite cache is fast enough and far more reliable.
  return createCanvas2dRenderer({ canvas });
}
