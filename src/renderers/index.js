import { createCanvas2dRenderer } from './canvas2d-renderer.js?v=t_building_kits_0618';

export async function createRenderBackend({ canvas, mode = 'pixi', capture = false, settings = null } = {}) {
  const normalized = String(mode || 'pixi').toLowerCase();
  if (normalized === 'pixi' || normalized === 'auto') {
    try {
      const { createPixiRenderer } = await import('./pixi-renderer.js?v=t_building_kits_0618');
      return await createPixiRenderer({ canvas, capture, settings });
    } catch (err) {
      console.warn('Pixi renderer failed; falling back to Canvas2D', err);
    }
  }
  return createCanvas2dRenderer({ canvas });
}
