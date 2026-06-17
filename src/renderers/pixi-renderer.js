import { drawWorld } from '../canvas-renderer.js?v=t_pixi_worker_wasm';

export async function createPixiRenderer({ canvas }) {
  const PIXI = await import('../../vendor/pixi/pixi.mjs');
  const app = new PIXI.Application();
  await app.init({
    canvas,
    backgroundAlpha: 1,
    antialias: false,
    autoDensity: false,
    resolution: 1,
    preference: 'webgl'
  });
  app.ticker.stop();

  const buffer = document.createElement('canvas');
  buffer.width = Math.max(1, canvas.width || 1);
  buffer.height = Math.max(1, canvas.height || 1);
  const ctx = buffer.getContext('2d', { alpha: false });
  const texture = PIXI.Texture.from(buffer);
  const sprite = new PIXI.Sprite(texture);
  sprite.x = 0;
  sprite.y = 0;
  app.stage.addChild(sprite);

  function resizeBuffer(width, height) {
    const w = Math.max(1, Math.round(width || canvas.width || 1));
    const h = Math.max(1, Math.round(height || canvas.height || 1));
    if (buffer.width !== w) buffer.width = w;
    if (buffer.height !== h) buffer.height = h;
    app.renderer.resize(w, h);
    sprite.width = w;
    sprite.height = h;
  }

  resizeBuffer(canvas.width, canvas.height);

  return {
    kind: 'pixi',
    text: 'PixiJS WebGL renderer (Canvas parity bridge)',
    webgpu: false,
    app,
    resize({ width, height } = {}) {
      resizeBuffer(width, height);
    },
    draw(renderState) {
      resizeBuffer(renderState.W, renderState.H);
      drawWorld(renderState, ctx);
      texture.source.update();
      app.renderer.render(app.stage);
    },
    destroy() {
      app.destroy(false);
    }
  };
}
