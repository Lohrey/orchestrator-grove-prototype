import { createCanvas2dRenderer } from './canvas2d-renderer.js?v=t_pixi_worker_wasm';

export async function createRenderBackend({ canvas, mode = 'pixi' } = {}) {
  const normalized = String(mode || 'pixi').toLowerCase();
  if (normalized === 'pixi' || normalized === 'auto') {
    try {
      const { createPixiRenderer } = await import('./pixi-renderer.js?v=t_pixi_worker_wasm');
      return await createPixiRenderer({ canvas });
    } catch (err) {
      console.warn('Pixi renderer failed; falling back to Canvas2D', err);
    }
  }
  return createCanvas2dRenderer({ canvas });
}
