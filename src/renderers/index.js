import { createCanvas2dRenderer } from './canvas2d-renderer.js?v=t_health_system_0628';
import { createOffscreenRenderer, isOffscreenCanvasSupported } from './offscreen-renderer.js?v=t_offscreen_0628';

export async function createRenderBackend({ canvas, mode = 'canvas2d', capture = false, settings = null } = {}) {
  const normalized = String(mode || 'canvas2d').toLowerCase();
  if (normalized === 'pixi' || normalized === 'auto') {
    try {
      const { createPixiRenderer } = await import('./pixi-renderer.js?v=fog_fullmap_0628');
      return await createPixiRenderer({ canvas, capture, settings });
    } catch (err) {
      console.warn('Pixi renderer failed; falling back to Canvas2D', err);
    }
  }

  // WebGL2 path (Tier 3): highest performance for large sprite counts
  // Disabled by default — opt-in via ?renderer=webgl2 URL param or mode flag
  // The Canvas2D + OffscreenCanvas path is the default for canvas2d mode
  if (normalized === 'webgl2') {
    try {
      const { createWebGL2Renderer, isWebGL2Supported } = await import('./webgl2-renderer.js?v=t_webgl2_0628');
      if (isWebGL2Supported()) {
        const gl2 = await createWebGL2Renderer({ canvas });
        if (gl2) return gl2;
      }
    } catch (err) {
      console.warn('WebGL2 renderer failed; falling back', err);
    }
  }

  // OffscreenCanvas + worker path (Tier 2)
  if (normalized === 'canvas2d' && isOffscreenCanvasSupported()) {
    try {
      const offscreen = await createOffscreenRenderer({ canvas });
      if (offscreen) return offscreen;
    } catch (err) {
      console.warn('OffscreenCanvas renderer failed; falling back to main-thread Canvas2D', err);
    }
  }

  // Main-thread Canvas2D fallback (Tier 1)
  return createCanvas2dRenderer({ canvas });
}
