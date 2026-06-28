// src/ui/performance-ui.js — performance HUD, presets, and bot-limit clamping.
// v=ui_fix_boot_0628

export function createPerformanceUi({ dom, getGame, PERFORMANCE_PRESETS }) {
  const game = () => getGame && getGame();
  const clampBotLimit = value => {
    const min = Number(dom.maxBots?.min || 4);
    const max = Number(dom.maxBots?.max || 1000);
    return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
  };

  function setMaxBotsUiLimit(limit) {
    if (!dom.maxBots) return;
    const safeLimit = Math.max(Number(dom.maxBots.min || 4), Math.min(1000, Math.round(Number(limit) || 1000)));
    dom.maxBots.max = String(safeLimit);
    dom.maxBots.step = '1';
    if (Number(dom.maxBots.value) > safeLimit) dom.maxBots.value = String(safeLimit);
    const g = game();
    if (g && Number(g.maxBots) > safeLimit) g.maxBots = safeLimit;
  }

  function setPerformanceProfileValue(profile) {
    if (!dom.performanceProfile) return;
    dom.performanceProfile.value = dom.performanceProfile.querySelector(`option[value="${profile}"]`) ? profile : 'custom';
  }

  function syncPerformanceUi(message = '', getRendererRecommendation) {
    const g = game();
    const recommendation = typeof getRendererRecommendation === 'function' ? getRendererRecommendation() : {};
    setMaxBotsUiLimit(recommendation.maxBotsCap);
    if (!g) return;
    if (dom.targetFpsValue) dom.targetFpsValue.textContent = String(g.targetFps);
    if (dom.maxBotsValue) dom.maxBotsValue.textContent = String(g.maxBots);
    if (dom.rendererStatus) dom.rendererStatus.textContent = `Renderer: ${recommendation.rendererText}`;
    if (dom.detectedGpu) dom.detectedGpu.textContent = recommendation.gpuText;
    if (dom.detectedVram) dom.detectedVram.textContent = recommendation.inferredVramGb ? `~${recommendation.inferredVramGb} GB` : 'Unknown / browser not exposed';
    if (dom.detectedProfile) dom.detectedProfile.textContent = recommendation.profile.replace(/_/g, ' ');
    if (dom.recommendedBots) dom.recommendedBots.textContent = `${recommendation.recommendedMaxBots} (cap ${recommendation.maxBotsCap})`;
    if (dom.recommendedFps) dom.recommendedFps.textContent = String(recommendation.recommendedTargetFps);
    if (dom.performanceNotes) {
      const noteText = recommendation.notes.filter(Boolean).join(' ');
      dom.performanceNotes.textContent = message || noteText || `Using a ${recommendation.confidence}-confidence hardware heuristic.`;
    }
  }

  function applyPerformancePreset(profile, { save = true, getRendererRecommendation, syncPerformanceUi: syncPerf, saveBrowserSettings } = {}) {
    const g = game();
    if (!g) return;
    const recommendation = typeof getRendererRecommendation === 'function' ? getRendererRecommendation() : {};
    const targetProfile = profile === 'auto' ? recommendation.profile : profile;
    const preset = PERFORMANCE_PRESETS[targetProfile] || PERFORMANCE_PRESETS.balanced;
    const nextFps = profile === 'auto' ? recommendation.recommendedTargetFps : preset.targetFps;
    const baseBots = profile === 'auto' ? recommendation.recommendedMaxBots : preset.maxBots;
    g.targetFps = Number(nextFps);
    setMaxBotsUiLimit(recommendation.maxBotsCap);
    g.maxBots = clampBotLimit(Math.min(baseBots, recommendation.maxBotsCap));
    if (dom.targetFps) dom.targetFps.value = String(g.targetFps);
    if (dom.maxBots) dom.maxBots.value = String(g.maxBots);
    setPerformanceProfileValue(profile);
    if (typeof syncPerf === 'function') {
      syncPerf(profile === 'auto' ? 'Applied hardware-based performance recommendation.' : `Applied ${preset.label.toLowerCase()} preset.`);
    }
    if (save && typeof saveBrowserSettings === 'function') saveBrowserSettings();
  }

  return {
    clampBotLimit,
    setMaxBotsUiLimit,
    setPerformanceProfileValue,
    syncPerformanceUi,
    applyPerformancePreset
  };
}
