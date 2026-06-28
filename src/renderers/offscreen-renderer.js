// ── OffscreenCanvas renderer: moves drawWorld into a Web Worker ──
//
// Feature detection: if OffscreenCanvas or transferControlToOffscreen is unavailable,
// or if the worker fails to load, this returns null and the caller falls back to
// the main-thread Canvas2D renderer.
//
// IMPORTANT: transferControlToOffscreen() is IRREVERSIBLE. We ping the worker first
// to verify it loaded its modules before transferring the canvas. If the worker fails
// to respond, we return null without touching the canvas, preserving the fallback.

let _workerSupported = null;

/**
 * Feature-detect OffscreenCanvas + transferControlToOffscreen + Worker support.
 * @returns {boolean}
 */
export function isOffscreenCanvasSupported() {
  if (_workerSupported !== null) return _workerSupported;
  try {
    _workerSupported = typeof OffscreenCanvas !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function' &&
      typeof Worker !== 'undefined';
  } catch {
    _workerSupported = false;
  }
  return _workerSupported;
}

/**
 * Create an OffscreenCanvas-based renderer that runs drawWorld in a worker.
 * Returns the renderer object, or null if unsupported / init failed.
 *
 * @param {{ canvas: HTMLCanvasElement }} opts
 * @returns {Promise<object|null>}
 */
export async function createOffscreenRenderer({ canvas }) {
  if (!isOffscreenCanvasSupported()) return null;

  // Step 1: Create worker and ping it BEFORE transferring the canvas
  let worker;
  try {
    worker = new Worker(new URL('./canvas2d/render-worker.js', import.meta.url), { type: 'module' });
  } catch (err) {
    console.warn('[offscreen-renderer] Worker creation failed:', err);
    return null;
  }

  // Step 2: Wait for worker to confirm it loaded modules (ping/pong)
  const pingOk = await new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; resolve(false); }
    }, 5000);

    worker.onmessage = (e) => {
      const msg = e.data;
      if (settled) return;
      if (msg && msg.type === 'ready') {
        settled = true;
        clearTimeout(timeout);
        resolve(true);
      } else if (msg && msg.type === 'error') {
        settled = true;
        clearTimeout(timeout);
        resolve(false);
      }
    };
    worker.onerror = () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(false); }
    };

    // Send ping — worker responds with 'ready' once its modules are loaded
    worker.postMessage({ type: 'ping' });
  });

  if (!pingOk) {
    try { worker.terminate(); } catch {}
    console.warn('[offscreen-renderer] Worker failed to initialize, falling back');
    return null;
  }

  // Step 3: NOW transfer the canvas (safe because worker is confirmed working)
  let offscreen;
  try {
    offscreen = canvas.transferControlToOffscreen();
  } catch (err) {
    console.warn('[offscreen-renderer] transferControlToOffscreen failed:', err);
    try { worker.terminate(); } catch {}
    return null;
  }

  // Step 4: Send init with canvas + dimensions
  worker.postMessage({
    type: 'init',
    canvas: offscreen,
    width: canvas.width,
    height: canvas.height
  }, [offscreen]);

  // Render state tracking
  let pendingFrame = null;
  let frameInFlight = false;

  worker.onmessage = (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;
    if (msg.type === 'frame_done') {
      frameInFlight = false;
      if (pendingFrame) {
        const next = pendingFrame;
        pendingFrame = null;
        doRender(next);
      }
    }
  };

  worker.onerror = (e) => {
    console.warn('[offscreen-renderer] worker runtime error:', e.message || e);
    frameInFlight = false;
  };

  function doRender(renderState) {
    if (frameInFlight) {
      pendingFrame = renderState;
      return;
    }
    frameInFlight = true;
    try {
      worker.postMessage({ type: 'render', state: renderState });
    } catch (err) {
      console.warn('[offscreen-renderer] postMessage render failed:', err);
      frameInFlight = false;
    }
  }

  return {
    kind: 'offscreen',
    text: 'Canvas 2D (OffscreenCanvas worker)',
    webgpu: false,
    ctx: null,
    isWorker: true,
    resize() {
      if (canvas.width && canvas.height) {
        worker.postMessage({ type: 'resize', width: canvas.width, height: canvas.height });
      }
    },
    draw(renderState) {
      doRender(renderState);
    },
    destroy() {
      try { worker.terminate(); } catch {}
    }
  };
}
