// src/ui/provider-ui.js — local AI provider (Ollama / TabbyAPI) settings UI.
// v=t_ui_refactor_0627

import {
  LOCAL_AI_PROVIDERS,
  defaultOllamaEndpoint,
  getDefaultProviderConfig,
  normalizeAssistantLoadout
} from '../assistant.js?v=t_building_kits_0618';
import { DEFAULT_BROWSER_STT_MODEL } from '../browser-stt.js';

export function createProviderUi({ dom, game }) {
  function getSelectedProvider() {
    return dom.llmMode?.value === 'tabbyapi' ? 'tabbyapi' : 'ollama';
  }

  function getCurrentLocalAiConfig() {
    const provider = getSelectedProvider();
    const defaults = getDefaultProviderConfig(provider);
    return {
      provider,
      endpoint: (dom.ollamaEndpoint?.value || defaults.endpoint || '').trim().replace(/\/$/, '') || defaults.endpoint,
      model: dom.ollamaModel?.value || defaults.model
    };
  }

  function syncProviderUi() {
    const provider = getSelectedProvider();
    const providerConfig = LOCAL_AI_PROVIDERS[provider];
    if (dom.llmProviderLabel) dom.llmProviderLabel.textContent = `Provider: ${provider === 'tabbyapi' ? providerConfig.backendLabel : providerConfig.label}`;
    const endpoint = (dom.ollamaEndpoint.value || '').trim().replace(/\/$/, '');
    const isLocalOllama = provider === 'ollama' && endpoint === 'http://127.0.0.1:11434';
    if (dom.localOllamaWindowsHelp) dom.localOllamaWindowsHelp.hidden = !isLocalOllama;
    if (dom.localTabbyHelp) dom.localTabbyHelp.hidden = provider !== 'tabbyapi';
    if (dom.serverOllamaBtn) dom.serverOllamaBtn.disabled = provider === 'tabbyapi';
    if (dom.localOllamaBtn) dom.localOllamaBtn.disabled = provider === 'tabbyapi';
  }

  function setLocalAiProvider(provider, { endpoint, model, status } = {}) {
    const defaults = getDefaultProviderConfig(provider);
    dom.llmMode.value = provider;
    dom.ollamaEndpoint.value = (endpoint || defaults.endpoint || '').replace(/\/$/, '');
    dom.ollamaModel.value = model || defaults.model;
    if (status) dom.ollamaStatus.textContent = status;
    syncProviderUi();
    if (typeof game?._uiCallbacks?.updateAssistantPromptPreview === 'function') game._uiCallbacks.updateAssistantPromptPreview();
    if (typeof game?._uiCallbacks?.saveBrowserSettings === 'function') game._uiCallbacks.saveBrowserSettings();
  }

  function saveBrowserSettings(deps) {
    const {
      getRendererSettingsFromUi,
      getTemplateRoutingEnabled,
      getSemanticRoutingEnabled,
      getAsrMode,
      getFogOfWarEnabled,
      getLightingEffectsEnabled,
      getDynamicShadowsEnabled,
      getShowFpsOverlayEnabled,
      getRendererModeFromUi,
      storageSet,
      SETTINGS_KEY
    } = deps;
    const rendererSettings = getRendererSettingsFromUi();
    const settings = {
      llmMode: dom.llmMode?.value || 'mock',
      templateRouting: getTemplateRoutingEnabled(),
      semanticRouting: getSemanticRoutingEnabled(),
      asrMode: getAsrMode(),
      performanceProfile: dom.performanceProfile?.value || 'auto',
      targetFps: Number(dom.targetFps?.value || game?.targetFps || 60),
      maxBots: Number(dom.maxBots?.value || game?.maxBots || 12),
      fogOfWar: getFogOfWarEnabled(),
      lightingEffects: getLightingEffectsEnabled(),
      dynamicShadows: getDynamicShadowsEnabled(),
      showFpsOverlay: getShowFpsOverlayEnabled(),
      rendererMode: getRendererModeFromUi(),
      rendererSettings,
      browserSttModel: dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL,
      ai: getCurrentLocalAiConfig()
    };
    return storageSet(SETTINGS_KEY, JSON.stringify(settings));
  }

  return {
    getSelectedProvider,
    getCurrentLocalAiConfig,
    syncProviderUi,
    setLocalAiProvider,
    saveBrowserSettings
  };
}
