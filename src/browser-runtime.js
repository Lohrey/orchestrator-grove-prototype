// Browser runtime adapter for the game domain.
// Keeps requestAnimationFrame and WebGPU feature probing out of the Game engine.
export async function probeRenderer({ userAgent = navigator.userAgent, gpu = navigator.gpu } = {}) {
  if (!gpu || /HeadlessChrome/.test(userAgent)) {
    return { text: 'Canvas 2D fallback', webgpu: false, reason: 'navigator.gpu unavailable or headless' };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('requestAdapter null');
    await adapter.requestDevice();
    return { text: 'Canvas 2D + WebGPU probe', webgpu: true, reason: 'ok' };
  } catch (e) {
    return { text: 'Canvas 2D fallback', webgpu: false, reason: e.message };
  }
}

export function startGameLoop(game, { requestFrame = requestAnimationFrame } = {}) {
  const frame = (now = 0) => {
    const min = 1000 / game.targetFps;
    if (now - game.lastFrame < min - 0.5) return requestFrame(frame);
    const dt = Math.min(0.05, (now - game.lastFrame) / 1000 || 0.016);
    game.lastFrame = now;
    game.update(dt);
    game.draw();
    game.fpsAcc += dt;
    game.frameCount++;
    if (game.fpsAcc >= 1) {
      game.fps = Math.round(game.frameCount / game.fpsAcc);
      game.fpsAcc = 0;
      game.frameCount = 0;
    }
    requestFrame(frame);
  };
  requestFrame(frame);
  return frame;
}
