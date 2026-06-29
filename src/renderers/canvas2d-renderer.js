import { drawWorld } from '../canvas-renderer.js?v=grove_sprite_fix_0629';
import { initSpriteCache } from './shared/sprite-cache.js?v=grove_sprite_fix_0629';
import { initTinySwordsSprites } from './canvas2d/entities-layer.js?v=grove_sprite_fix_0629';

export function createCanvas2dRenderer({ canvas }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  // Kick off async sprite cache init (non-blocking; drawBot falls back to vector until ready)
  initSpriteCache();
  // Kick off Tiny Swords atlas load (non-blocking; entities fall back to procedural until ready)
  initTinySwordsSprites().catch(err => console.warn('[canvas2d] Tiny Swords atlas init failed:', err));
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
