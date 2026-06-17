import { drawWorld } from '../canvas-renderer.js?v=t_pixi_worker_wasm';

export function createCanvas2dRenderer({ canvas }) {
  const ctx = canvas.getContext('2d');
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
