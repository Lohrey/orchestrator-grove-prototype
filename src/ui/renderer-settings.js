// src/ui/renderer-settings.js — renderer mode and quality settings UI helpers.
// v=grove_webgl2_default_0706

export function createRendererSettings({ dom, game, PERFORMANCE_PRESETS }) {
  const DEFAULT_RENDERER_SETTINGS = Object.freeze({ highResolution: true, antialias: true });

  function normalizeRendererSettings(settings = null) {
    return {
      highResolution: settings?.highResolution !== false,
      antialias: settings?.antialias !== false
    };
  }

  function getRendererSettingsFromUi() {
    return normalizeRendererSettings({
      highResolution: dom.pixiHighResolution?.checked ?? DEFAULT_RENDERER_SETTINGS.highResolution,
      antialias: dom.pixiAntialias?.checked ?? DEFAULT_RENDERER_SETTINGS.antialias
    });
  }

  // Renderer mode selection is a 3-way choice (radio buttons in index.html):
  //   - webgl2 (default, highest performance)
  //   - pixi
  //   - canvas2d (legacy fallback)
  function getRendererModeFromUi() {
    if (dom.rendererWebgl2?.checked) return 'webgl2';
    if (dom.rendererPixi?.checked) return 'pixi';
    if (dom.rendererCanvas2d?.checked) return 'canvas2d';
    return 'webgl2';
  }

  function syncRendererModeUi(mode = 'webgl2') {
    const normalized = String(mode || 'webgl2').toLowerCase();
    if (dom.rendererWebgl2) dom.rendererWebgl2.checked = normalized === 'webgl2';
    if (dom.rendererPixi) dom.rendererPixi.checked = normalized === 'pixi';
    if (dom.rendererCanvas2d) dom.rendererCanvas2d.checked = normalized === 'canvas2d';
    return normalized;
  }

  function syncRendererSettingsUi(settings = DEFAULT_RENDERER_SETTINGS) {
    const normalized = normalizeRendererSettings(settings);
    if (dom.pixiHighResolution) dom.pixiHighResolution.checked = normalized.highResolution;
    if (dom.pixiAntialias) dom.pixiAntialias.checked = normalized.antialias;
    return normalized;
  }

  function getRendererRecommendation(renderer = game?.renderer) {
    const profile = renderer?.preset || 'balanced';
    const recommendedTargetFps = Number(renderer?.recommendedTargetFps || PERFORMANCE_PRESETS[profile]?.targetFps || PERFORMANCE_PRESETS.balanced.targetFps);
    const recommendedMaxBots = Number(renderer?.recommendedMaxBots || PERFORMANCE_PRESETS[profile]?.maxBots || PERFORMANCE_PRESETS.balanced.maxBots);
    const maxBotsCap = Math.max(recommendedMaxBots, Number(renderer?.maxBotsCap || 300));
    return {
      profile,
      gpuText: renderer?.gpuText || renderer?.label || renderer?.text || 'Unknown GPU',
      inferredVramGb: renderer?.inferredVramGb ?? null,
      recommendedTargetFps,
      recommendedMaxBots,
      maxBotsCap,
      notes: Array.isArray(renderer?.notes) ? renderer.notes : [],
      rendererText: renderer?.text || 'Canvas 2D fallback',
      webgpu: !!renderer?.webgpu,
      confidence: renderer?.confidence || 'low'
    };
  }

  function applyRendererSettings(settings, { save = true, message = '', syncPerformanceUi, saveBrowserSettings } = {}) {
    const normalized = syncRendererSettingsUi(settings);
    const result = game?.renderBackend?.updateSettings?.(normalized) || { settings: normalized, reloadRequired: false };
    if (message && typeof syncPerformanceUi === 'function') {
      syncPerformanceUi(result.reloadRequired ? `${message} Reload the page to apply the antialiasing change.` : message);
    }
    if (save && typeof saveBrowserSettings === 'function') saveBrowserSettings();
    return result;
  }

  return {
    DEFAULT_RENDERER_SETTINGS,
    normalizeRendererSettings,
    getRendererSettingsFromUi,
    getRendererModeFromUi,
    syncRendererModeUi,
    syncRendererSettingsUi,
    getRendererRecommendation,
    applyRendererSettings
  };
}
