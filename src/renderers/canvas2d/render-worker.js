// ── Render worker: runs drawWorld() off the main thread via OffscreenCanvas ──
//
// Message protocol:
//   Main → Worker: { type: 'init', canvas: OffscreenCanvas, width, height }
//   Main → Worker: { type: 'render', state, camera, viewport }
//   Main → Worker: { type: 'resize', width, height }
//   Worker → Main: { type: 'frame_done', stats: { drawCalls, duration } }
//   Worker → Main: { type: 'ready' }
//   Worker → Main: { type: 'error', message }

import { drawWorld } from '../../canvas-renderer.js?v=t_health_system_0628';
import { initSpriteCache } from '../shared/sprite-cache.js?v=t_sprite_cache_0628';

let offscreenCanvas = null;
let ctx = null;
let spriteCacheInitDone = false;

self.onmessage = async function(e) {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'ping': {
      // Worker loaded successfully — respond so main thread knows it's safe to transfer canvas
      // Init sprite cache in background (non-blocking)
      if (!spriteCacheInitDone) {
        spriteCacheInitDone = true;
        initSpriteCache().catch(() => {});
      }
      self.postMessage({ type: 'ready' });
      break;
    }

    case 'init': {
      try {
        offscreenCanvas = msg.canvas;
        ctx = offscreenCanvas.getContext('2d', { alpha: false });
        if (msg.width && msg.height) {
          offscreenCanvas.width = msg.width;
          offscreenCanvas.height = msg.height;
        }
      } catch (err) {
        self.postMessage({ type: 'error', message: String(err.message || err) });
      }
      break;
    }

    case 'render': {
      if (!ctx) {
        self.postMessage({ type: 'frame_done', stats: { drawCalls: 0, duration: 0, skipped: true } });
        return;
      }
      const start = performance.now();
      try {
        const state = msg.state;
        drawWorld(state, ctx);
        const duration = performance.now() - start;
        self.postMessage({ type: 'frame_done', stats: { drawCalls: 1, duration } });
      } catch (err) {
        self.postMessage({ type: 'error', message: String(err.message || err) });
      }
      break;
    }

    case 'resize': {
      if (offscreenCanvas && msg.width && msg.height) {
        offscreenCanvas.width = msg.width;
        offscreenCanvas.height = msg.height;
      }
      break;
    }
  }
};
