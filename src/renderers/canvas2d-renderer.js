import { drawWorld } from '../canvas-renderer.js?v=t_health_system_0628';
import { initSpriteCache } from './shared/sprite-cache.js?v=t_sprite_cache_0628';

export function createCanvas2dRenderer({ canvas }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  // Kick off async sprite cache init (non-blocking; drawBot falls back to vector until ready)
  initSpriteCache();
  return {
    kind: 'canvas2d',
    text: 'Canvas 2D fallback',
    webgpu: false,
    ctx,
    resize() {},
    draw(renderState) {
      drawWorld(renderState, ctx);
    },
    destroy() {}
  };
}
