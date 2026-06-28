// src/ui/renderer-settings.js — renderer mode and quality settings UI helpers.
// v=ui_fix_boot_0628

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

  function getRendererModeFromUi() {
    return dom.useCanvas2dRenderer?.checked ? 'canvas2d' : 'pixi';
  }

  function syncRendererModeUi(mode = 'canvas2d') {
    const normalized = String(mode || 'canvas2d').toLowerCase();
    if (dom.useCanvas2dRenderer) dom.useCanvas2dRenderer.checked = normalized === 'canvas2d';
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
