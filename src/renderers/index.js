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

  // Try OffscreenCanvas + worker path (Tier 2) — only for canvas2d mode
  // The offscreen renderer does its own feature detection and pings the worker
  // before transferring the canvas, so if it fails, the fallback Canvas2D path still works.
  if (normalized === 'canvas2d' && isOffscreenCanvasSupported()) {
    try {
      const offscreen = await createOffscreenRenderer({ canvas });
      if (offscreen) return offscreen;
    } catch (err) {
      console.warn('OffscreenCanvas renderer failed; falling back to main-thread Canvas2D', err);
    }
  }

  return createCanvas2dRenderer({ canvas });
}
