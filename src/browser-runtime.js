// Browser runtime adapter for the game domain.
// Keeps requestAnimationFrame and WebGPU feature probing out of the Game engine.

const KNOWN_GPU_PROFILES = [
  { pattern: /\brtx\s*4090\b/i, label: 'NVIDIA GeForce RTX 4090', inferredVramGb: 24, preset: 'stress_test', recommendedTargetFps: 60, recommendedMaxBots: 400, maxBotsCap: 1000, confidence: 'high' },
  { pattern: /\brtx\s*4080\b/i, label: 'NVIDIA GeForce RTX 4080', inferredVramGb: 16, preset: 'stress_test', recommendedTargetFps: 60, recommendedMaxBots: 320, maxBotsCap: 900, confidence: 'high' },
  { pattern: /\brtx\s*4070\b/i, label: 'NVIDIA GeForce RTX 4070', inferredVramGb: 12, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 240, maxBotsCap: 700, confidence: 'high' },
  { pattern: /\brtx\s*4060\b/i, label: 'NVIDIA GeForce RTX 4060', inferredVramGb: 8, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 160, maxBotsCap: 500, confidence: 'high' },
  { pattern: /\brtx\s*3080\b/i, label: 'NVIDIA GeForce RTX 3080', inferredVramGb: 10, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 220, maxBotsCap: 650, confidence: 'high' },
  { pattern: /\brtx\s*3070\b/i, label: 'NVIDIA GeForce RTX 3070', inferredVramGb: 8, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 180, maxBotsCap: 540, confidence: 'high' },
  { pattern: /\brtx\s*3060\b/i, label: 'NVIDIA GeForce RTX 3060', inferredVramGb: 12, preset: 'balanced', recommendedTargetFps: 45, recommendedMaxBots: 140, maxBotsCap: 420, confidence: 'high' },
  { pattern: /\b(gtx\s*1660|rtx\s*2060)\b/i, label: 'Older NVIDIA midrange GPU', inferredVramGb: 6, preset: 'balanced', recommendedTargetFps: 45, recommendedMaxBots: 96, maxBotsCap: 260, confidence: 'medium' },
  { pattern: /\brx\s*7900\b/i, label: 'AMD Radeon RX 7900', inferredVramGb: 20, preset: 'stress_test', recommendedTargetFps: 60, recommendedMaxBots: 320, maxBotsCap: 900, confidence: 'high' },
  { pattern: /\brx\s*7800\b/i, label: 'AMD Radeon RX 7800', inferredVramGb: 16, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 220, maxBotsCap: 650, confidence: 'high' },
  { pattern: /\brx\s*6800\b/i, label: 'AMD Radeon RX 6800', inferredVramGb: 16, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 200, maxBotsCap: 600, confidence: 'high' },
  { pattern: /\bapple\s*m[1234]\b/i, label: 'Apple Silicon GPU', inferredVramGb: null, preset: 'high_density', recommendedTargetFps: 60, recommendedMaxBots: 160, maxBotsCap: 480, confidence: 'medium' },
  { pattern: /\b(arc\s*a7|intel arc)\b/i, label: 'Intel Arc GPU', inferredVramGb: 8, preset: 'balanced', recommendedTargetFps: 45, recommendedMaxBots: 110, maxBotsCap: 320, confidence: 'medium' },
  { pattern: /\b(iris xe|uhd graphics|radeon graphics|vega)\b/i, label: 'Integrated GPU', inferredVramGb: null, preset: 'battery_saver', recommendedTargetFps: 30, recommendedMaxBots: 48, maxBotsCap: 140, confidence: 'medium' }
];

const FALLBACK_GPU_PROFILES = {
  webgpu_unknown: { label: 'Unknown WebGPU-capable GPU', inferredVramGb: null, preset: 'balanced', recommendedTargetFps: 45, recommendedMaxBots: 96, maxBotsCap: 300, confidence: 'low' },
  no_webgpu: { label: 'WebGPU unavailable', inferredVramGb: null, preset: 'battery_saver', recommendedTargetFps: 30, recommendedMaxBots: 48, maxBotsCap: 120, confidence: 'low' }
};

function compactString(value) {
  return String(value || '').trim();
}

function joinGpuFields(fields = []) {
  return [...new Set(fields.map(compactString).filter(Boolean))].join(' / ');
}

async function readAdapterInfo(adapter) {
  try {
    if (typeof adapter?.requestAdapterInfo === 'function') return await adapter.requestAdapterInfo();
  } catch {}
  try {
    if (adapter?.info) return adapter.info;
  } catch {}
  return {};
}

function limitsSummary(limits = {}) {
  return {
    maxBufferSize: Number(limits.maxBufferSize || 0),
    maxStorageBufferBindingSize: Number(limits.maxStorageBufferBindingSize || 0),
    maxComputeInvocationsPerWorkgroup: Number(limits.maxComputeInvocationsPerWorkgroup || 0),
    maxComputeWorkgroupSizeX: Number(limits.maxComputeWorkgroupSizeX || 0)
  };
}

function inferGpuProfile(info = {}, webgpu = false) {
  const vendor = compactString(info.vendor);
  const architecture = compactString(info.architecture);
  const device = compactString(info.device);
  const description = compactString(info.description);
  const gpuText = joinGpuFields([description, device, architecture, vendor]);
  const known = KNOWN_GPU_PROFILES.find(entry => entry.pattern.test(gpuText));
  if (known) {
    return {
      ...known,
      gpuText: known.label,
      notes: [
        `Detected ${known.label}.`,
        known.inferredVramGb ? `VRAM is inferred from a known GPU profile: about ${known.inferredVramGb} GB.` : 'VRAM is not directly exposed by the browser for this GPU.',
        `Recommended preset is ${known.preset.replace(/_/g, ' ')} with about ${known.recommendedMaxBots} bots at ${known.recommendedTargetFps} FPS.`
      ]
    };
  }
  const fallback = webgpu ? FALLBACK_GPU_PROFILES.webgpu_unknown : FALLBACK_GPU_PROFILES.no_webgpu;
  return {
    ...fallback,
    gpuText: gpuText || fallback.label,
    notes: [
      gpuText ? `Detected GPU string: ${gpuText}.` : 'No GPU model string was exposed by the browser.',
      webgpu ? 'WebGPU is available, but the adapter does not match a known tuned profile yet.' : 'WebGPU is unavailable, so the fallback profile stays conservative.',
      'Exact VRAM is usually not available to browser code, so this recommendation is heuristic.'
    ]
  };
}

export async function probeRenderer({ userAgent = navigator.userAgent, gpu = navigator.gpu } = {}) {
  if (!gpu || /HeadlessChrome/.test(userAgent)) {
    const inferred = inferGpuProfile({}, false);
    return {
      text: 'WebGPU unavailable',
      webgpu: false,
      reason: 'navigator.gpu unavailable or headless',
      adapterInfo: {},
      limits: limitsSummary(),
      ...inferred
    };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('requestAdapter null');
    const adapterInfo = await readAdapterInfo(adapter);
    const limits = limitsSummary(adapter.limits || {});
    await adapter.requestDevice();
    const inferred = inferGpuProfile(adapterInfo, true);
    return {
      text: inferred.gpuText ? `WebGPU probe (${inferred.gpuText})` : 'WebGPU probe',
      webgpu: true,
      reason: 'ok',
      adapterInfo,
      limits,
      ...inferred
    };
  } catch (e) {
    const inferred = inferGpuProfile({}, false);
    return {
      text: 'WebGPU unavailable',
      webgpu: false,
      reason: e.message,
      adapterInfo: {},
      limits: limitsSummary(),
      ...inferred
    };
  }
}

export function startGameLoop(game, { requestFrame = requestAnimationFrame } = {}) {
  let lastTick = 0;
  let frameDebt = 0;
  const frame = (now = 0) => {
    const targetFps = Math.max(1, Number(game.targetFps || 60));
    const min = 1000 / targetFps;
    const elapsed = lastTick ? now - lastTick : min;
    lastTick = now;
    frameDebt += Math.max(0, Math.min(50, elapsed));
    if (frameDebt + 0.25 < min) return requestFrame(frame);
    const dt = Math.min(0.05, frameDebt / 1000);
    frameDebt %= min;
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
