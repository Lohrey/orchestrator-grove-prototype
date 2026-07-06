import { drawWorld } from './canvas-renderer.js';
import { initSpriteCache } from './shared/sprite-cache.js';
import { initTinySwordsSprites } from './canvas2d/entities-layer.js';

export function createCanvas2dRenderer({ canvas }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  // Kick off async sprite cache init (non-blocking; drawBot falls back to vector until ready)
  initSpriteCache();
  // initTinySwordsSprites is now a no-op for player/bot (procedural offscreen
  // cache replaces the buggy Tiny Swords atlas path). Kept for backwards compat.
  initTinySwordsSprites().catch(() => {});
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
