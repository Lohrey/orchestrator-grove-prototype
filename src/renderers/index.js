import { createCanvas2dRenderer } from './canvas2d-renderer.js?v=t_health_system_0628';

export async function createRenderBackend({ canvas, mode = 'pixi', capture = false, settings = null } = {}) {
  const normalized = String(mode || 'pixi').toLowerCase();
  if (normalized === 'pixi') {
    try {
      const { createPixiRenderer } = await import('./pixi-renderer.js?v=grove_pixi_fixes_0628');
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

  // Main-thread Canvas2D path (always used for canvas2d mode).
  // The OffscreenCanvas worker path was removed — it caused multiple bugs:
  // frozen canvas dimensions (broke resize/zoom), race conditions on
  // viewport change (devtools open → permanent black screen), silent error
  // swallowing, and fragile worker module loading. Main-thread Canvas2D
  // with the sprite cache is fast enough and far more reliable.
  return createCanvas2dRenderer({ canvas });
}
