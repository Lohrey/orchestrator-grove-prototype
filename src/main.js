import { PROGRAMS, PROGRAM_TEMPLATES, DSL_ACTION_WIKI, ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT, ALLOWED_OPS, formatDslActionWiki, getActionStepChainRows } from './data.js?v=t_building_kits_0618';
import { createChatController } from './chat.js?v=20260613-player-tools';
import { createAudioController } from './audio.js?v=t_3ef6c5ab_menu_polish';
import { createBrowserSttController, DEFAULT_BROWSER_STT_MODEL } from './browser-stt.js';
import { Game } from './world.js?v=t_building_kits_0618';
import { createSaveGameManager, GAME_MODE_LABELS, normalizeGameMode } from './savegames.js?v=t_777178b3';
import { createMultiplayerController } from './multiplayer.js?v=t_f62dde4d_modes';
import { probeRenderer, startGameLoop } from './browser-runtime.js?v=t_76822d1f';
import { createRenderBackend } from './renderers/index.js?v=t_building_kits_0618';
import { createSimWorkerClient } from './sim/sim-worker-client.js?v=t_building_kits_0618';
import { CAMPAIGN_INTRO_SCENES } from './campaign-scenes.js?v=t_campaign_scenes_0623';
import { createCampaignIntroCinematic } from './campaign-intro-cinematic.js?v=t_intro_cinematic_0627';
import { LOCAL_AI_PROVIDERS, defaultOllamaEndpoint, getDefaultProviderConfig, parseAssistantRequest, parseWithOllama, parseWithOpenAiCompatible, refreshLocalAiModels, validateDslAssignments, validateToolCalls } from './assistant.js?v=t_building_kits_0618';
import { escapeHtml } from './utils.js?v=20260613-player-tools';
// UI module imports — extracted from the monolithic startGame() closure
import { createDomHelpers } from './ui/dom-helpers.js?v=t_ui_refactor_0627';
import { createChatUi } from './ui/chat-ui.js?v=t_ui_refactor_0627';
import { createRendererSettings } from './ui/renderer-settings.js?v=t_ui_refactor_0627';
import { createPerformanceUi } from './ui/performance-ui.js?v=t_ui_refactor_0627';
import { createProviderUi } from './ui/provider-ui.js?v=t_ui_refactor_0627';
import { createFullscreenUi } from './ui/fullscreen-ui.js?v=t_ui_refactor_0627';
import { createAssistantUi } from './ui/assistant-ui.js?v=t_ui_refactor_0627';

export async function startGame() {
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('game'), gameStage: $('gameStage'), chatLog: $('chatLog'), chatForm: $('chatForm'), chatInput: $('chatInput'), micButton: $('micButton'), asrStatus: $('asrStatus'), quickCommands: $('quickCommands'), drawZoneButton: $('drawZoneButton'),
    botList: $('botList'), statline: $('statline'), rendererStatus: $('rendererStatus'), targetFps: $('targetFps'), targetFpsValue: $('targetFpsValue'), maxBots: $('maxBots'), maxBotsValue: $('maxBotsValue'), performanceProfile: $('performanceProfile'), applyAutoPerformance: $('applyAutoPerformance'), fogOfWarToggle: $('fogOfWarToggle'), lightingEffects: $('lightingEffects'), dynamicShadows: $('dynamicShadows'), showFpsOverlay: $('showFpsOverlay'), useCanvas2dRenderer: $('useCanvas2dRenderer'), pixiHighResolution: $('pixiHighResolution'), pixiAntialias: $('pixiAntialias'), detectedGpu: $('detectedGpu'), detectedVram: $('detectedVram'), detectedProfile: $('detectedProfile'), recommendedBots: $('recommendedBots'), recommendedFps: $('recommendedFps'), performanceNotes: $('performanceNotes'),
    teachPanel: $('teachPanel'), teachCloseBtn: $('teachCloseBtn'), teachRecordBtn: $('teachRecordBtn'), teachAssignBtn: $('teachAssignBtn'), teachBotId: $('teachBotId'), teachStatus: $('teachStatus'), teachSteps: $('teachSteps'),
    sawLogs: $('sawLogs'), sawPlanks: $('sawPlanks'), sawPoles: $('sawPoles'), factoryPlanks: $('factoryPlanks'), factoryRecipe: $('factoryRecipe'), looseLogs: $('looseLogs'), loosePlanks: $('loosePlanks'), looseBase: $('looseBase'), paletteItems: $('paletteItems'), programSelect: $('programSelect'), programView: $('programView'),
    llmMode: $('llmMode'), templateRouting: $('templateRouting'), semanticRouting: $('semanticRouting'), semanticRouterStatus: $('semanticRouterStatus'), semanticRouterPackSelect: $('semanticRouterPackSelect'), semanticRouterTrainBtn: $('semanticRouterTrainBtn'), ollamaEndpoint: $('ollamaEndpoint'), ollamaModel: $('ollamaModel'), refreshModels: $('refreshModels'), benchmarkBtn: $('benchmarkBtn'), ollamaStatus: $('ollamaStatus'), llmProviderLabel: $('llmProviderLabel'), serverOllamaBtn: $('serverOllamaBtn'), localOllamaBtn: $('localOllamaBtn'), localTabbyBtn: $('localTabbyBtn'), localOllamaWindowsHelp: $('localOllamaWindowsHelp'), localTabbyHelp: $('localTabbyHelp'), asrMode: $('asrMode'), asrModeHelp: $('asrModeHelp'), browserSttModel: $('browserSttModel'), browserSttDownloadBtn: $('browserSttDownloadBtn'), browserSttUnloadBtn: $('browserSttUnloadBtn'), browserSttStatus: $('browserSttStatus'), browserSttProgress: $('browserSttProgress'), browserSttProgressText: $('browserSttProgressText'),
    buildPanel: $('buildPanel'), buildStatus: $('buildStatus'), buildDrawer: $('buildDrawer'), buildDrawerToggle: $('buildDrawerToggle'), zonesPanel: $('zonesPanel'), zonesDrawer: $('zonesDrawer'), zonesDrawerToggle: $('zonesDrawerToggle'), zoneList: $('zoneList'), drawZoneDrawerButton: $('drawZoneDrawerButton'), botMenu: $('botMenu'), dogPopup: $('dogPopup'), structureMenu: $('structureMenu'), templateDrawer: $('templateDrawer'), templateDrawerToggle: $('templateDrawerToggle'), templateSaveForm: $('templateSaveForm'), templateName: $('templateName'), templateStatus: $('templateStatus'), templateList: $('templateList'),
    settingsOverlay: $('settingsOverlay'), settingsClose: $('settingsClose'), openSettingsTabBtn: $('openSettingsTabBtn'), settingsMainPanel: $('settingsMainPanel'), chatOverlay: $('chatOverlay'), chatToggle: $('chatToggle'), chatCollapse: $('chatCollapse'), assignmentToast: $('assignmentToast'),
    aiLog: $('aiLog'), dslWikiView: $('dslWikiView'), botDrawer: $('botDrawer'), botDrawerToggle: $('botDrawerToggle'), botSearch: $('botSearch'), botTeamForm: $('botTeamForm'), botTeamName: $('botTeamName'), botTeamColor: $('botTeamColor'), botTeamCreate: $('botTeamCreate'),
    multiplayerDrawer: $('multiplayerDrawer'), multiplayerDrawerToggle: $('multiplayerDrawerToggle'), multiplayerHostBtn: $('multiplayerHostBtn'), multiplayerJoinCode: $('multiplayerJoinCode'), multiplayerJoinBtn: $('multiplayerJoinBtn'), multiplayerSaveBtn: $('multiplayerSaveBtn'), multiplayerStatus: $('multiplayerStatus'), multiplayerSessionLink: $('multiplayerSessionLink'),
    mainMenuOverlay: $('mainMenuOverlay'), mainMenuCampaignBtn: $('mainMenuCampaignBtn'), mainMenuNewBtn: $('mainMenuNewBtn'), mainMenuModeChoices: $('mainMenuModeChoices'), mainMenuModeLayer: $('mainMenuModeLayer'), mainMenuOnlineLayer: $('mainMenuOnlineLayer'), mainMenuHostLayer: $('mainMenuHostLayer'), mainMenuStartSelectedBtn: $('mainMenuStartSelectedBtn'), mainMenuLoadBtn: $('mainMenuLoadBtn'), mainMenuBackBtn: $('mainMenuBackBtn'), mainMenuLocalAiBtn: $('mainMenuLocalAiBtn'), mainMenuHostBtn: $('mainMenuHostBtn'), mainMenuOnlineHostBtn: $('mainMenuOnlineHostBtn'), mainMenuOnlineBackBtn: $('mainMenuOnlineBackBtn'), mainMenuHostNewBtn: $('mainMenuHostNewBtn'), mainMenuHostLoadBtn: $('mainMenuHostLoadBtn'), mainMenuHostBackBtn: $('mainMenuHostBackBtn'), mainMenuJoinCode: $('mainMenuJoinCode'), mainMenuJoinBtn: $('mainMenuJoinBtn'), mainMenuStatus: $('mainMenuStatus'),
    campaignIntroOverlay: $('campaignIntroOverlay'), campaignIntroKicker: $('campaignIntroKicker'), campaignIntroTitle: $('campaignIntroTitle'), campaignIntroText: $('campaignIntroText'), campaignIntroSceneNo: $('campaignIntroSceneNo'), campaignIntroNextBtn: $('campaignIntroNextBtn'), campaignIntroSkipBtn: $('campaignIntroSkipBtn'),
    resumeGameBtn: $('resumeGameBtn'), pauseGameBtn: $('pauseGameBtn'), fullscreenToggleBtn: $('fullscreenToggleBtn'), fullscreenStatus: $('fullscreenStatus'), saveGameBtn: $('saveGameBtn'), loadGameBtn: $('loadGameBtn'), quitToMainMenuBtn: $('quitToMainMenuBtn'), quitSavePrompt: $('quitSavePrompt'), saveAndQuitBtn: $('saveAndQuitBtn'), quitWithoutSaveBtn: $('quitWithoutSaveBtn'), cancelQuitBtn: $('cancelQuitBtn'), saveGameStatus: $('saveGameStatus'), saveGameManager: $('saveGameManager'), saveFlowPlaceholder: $('saveFlowPlaceholder'), saveSlotSelect: $('saveSlotSelect'), saveSlotSelectLoad: $('saveSlotSelectLoad'), saveSlotName: $('saveSlotName'), saveName: $('saveName'), saveNameLoad: $('saveNameLoad'), saveEntrySelect: $('saveEntrySelect'), renameSlotBtn: $('renameSlotBtn'), deleteSlotBtn: $('deleteSlotBtn'), renameSaveBtn: $('renameSaveBtn'), deleteSaveBtn: $('deleteSaveBtn'), deleteKeepCount: $('deleteKeepCount'), deleteOldSavesBtn: $('deleteOldSavesBtn'),
    knowledgePackList: $('knowledgePackList'), knowledgePackStatus: $('knowledgePackStatus'), knowledgePackTokenSummary: $('knowledgePackTokenSummary'), assistantLoadoutView: $('assistantLoadoutView'), assistantBasePromptView: $('assistantBasePromptView'), assistantPromptPreview: $('assistantPromptPreview'), assistantPromptTokenSummary: $('assistantPromptTokenSummary'), resetKnowledgePacks: $('resetKnowledgePacks'), actionStepChainTable: $('actionStepChainTable'), customPackId: $('customPackId'), customPackName: $('customPackName'), customPackContextVariables: $('customPackContextVariables'), customPackConcepts: $('customPackConcepts'), customPackVocabulary: $('customPackVocabulary'), customPackExamples: $('customPackExamples'), customPackActionList: $('customPackActionList'), customPackAliasEditor: $('customPackAliasEditor'), saveCustomPack: $('saveCustomPack'), clearCustomPackForm: $('clearCustomPackForm'),
    audioSfxToggle: $('audioSfxToggle'), audioSfxVolume: $('audioSfxVolume'), audioSfxTest: $('audioSfxTest'),
    widgetRoster: $('widgetRoster'), widgetRosterHandle: $('widgetRosterHandle'), radioWidgetToggle: $('radioWidgetToggle'), radioWidgetPanel: $('radioWidgetPanel'), radioStationButtons: $('radioStationButtons'), audioMusicStart: $('radioMusicStart'), audioMusicStop: $('radioMusicStop'), audioMusicVolume: $('radioMusicVolume'), audioMusicStatus: $('radioMusicStatus'),
    mobileControls: $('mobileControls'), mobileSettingsBtn: $('mobileSettingsBtn'), mobileBuildBtn: $('mobileBuildBtn'), mobileChatBtn: $('mobileChatBtn'), mobileInteractBtn: $('mobileInteractBtn'), mobileDropBtn: $('mobileDropBtn'), mobileZoomInBtn: $('mobileZoomInBtn'), mobileZoomOutBtn: $('mobileZoomOutBtn')
  };

  // ── UI module factory invocations (pure helpers, no game dependency) ───
  const { storageGet, storageSet, readJson, formatRendererStatus, stringifyLog, parseJsonPreview } = createDomHelpers();
  const { addChat, formatTokenCount, formatAssistantPromptPreview, logChatAi, responseRawText, parsedOrError, sentFinalPrompt } = createChatUi({ dom });
  const { fullscreenElement, syncFullscreenUi, toggleFullscreen } = createFullscreenUi({ dom });
  const assistantModule = createAssistantUi({ dom });
  const semanticRouter = assistantModule.semanticRouter;

  const ASR_MODE_KEY = 'orchestratorGrove.asrMode';
  const TEMPLATE_ROUTING_KEY = 'orchestratorGrove.templateRoutingEnabled';
  const SEMANTIC_ROUTING_KEY = 'orchestratorGrove.semanticRoutingEnabled';
  const ASSISTANT_LOADOUT_KEY = 'orchestratorGrove.assistantLoadout.v1';
  const CUSTOM_ACTION_PACKS_KEY = 'orchestratorGrove.customActionPacks.v1';
  const SETTINGS_KEY = 'orchestratorGrove.settings.v1';
  // ── Constants & config (kept in main.js as the orchestrator) ──────────
  const SAVE_KEY = 'orchestratorGrove.save.v1';
  const SAVE_LIBRARY_KEY = 'orchestratorGrove.saveLibrary.v2';
  const RECENT_SAVE_MS = 30000;
  let campaignIntroActive = false;
  let campaignIntroSceneIndex = 0;
  let campaignCinematic = null;
  const PERFORMANCE_PRESETS = {
    battery_saver: { label: 'Battery saver', targetFps: 30, maxBots: 48 },
    balanced: { label: 'Balanced', targetFps: 45, maxBots: 96 },
    high_density: { label: 'High density', targetFps: 60, maxBots: 180 },
    stress_test: { label: 'Stress test', targetFps: 60, maxBots: 320 }
  };
  const ASR_MODES = {
    zipformer_whisper: {
      status: 'Voice: Zipformer live partials + Whisper finalizer.',
      help: 'Live partial text while speaking, then Whisper-tiny final text when you stop.'
    },
    whisper_direct: {
      status: 'Voice: Sherpa Whisper direct. No Zipformer, final transcript after stop.',
      help: 'Bypasses Zipformer completely. No live partials; press the mic again to stop and commit the Whisper transcript.'
    },
    faster_whisper: {
      status: 'Voice: faster-whisper server STT. Browser recording uploads after stop.',
      help: 'Records in the browser with MediaRecorder, uploads the audio to /asr/transcribe?mode=faster_whisper, then inserts the returned final transcript.'
    },
    browser_whisper: {
      status: 'Voice: browser Whisper local inference. Download once, then transcribe on-device.',
      help: 'download once into the browser cache, then record locally and run inference on your machine with no server upload.'
    }
  };

  // ── Wire UI modules with shared dependencies ──────────────────────────
  let game = null;

  // Renderer settings: re-create with real game + PERFORMANCE_PRESETS after game exists
  const rendererModule = createRendererSettings({ dom, game: null, PERFORMANCE_PRESETS });
  const { DEFAULT_RENDERER_SETTINGS, normalizeRendererSettings, getRendererSettingsFromUi, getRendererModeFromUi, syncRendererModeUi, syncRendererSettingsUi } = rendererModule;
  const perfModule = createPerformanceUi({ dom, game: null, PERFORMANCE_PRESETS });
  const { clampBotLimit, setMaxBotsUiLimit, setPerformanceProfileValue } = perfModule;
  const providerModule = createProviderUi({ dom, game: null });
  const { getSelectedProvider, getCurrentLocalAiConfig } = providerModule;

  // Wrapper functions that adapt module factories to the closure pattern.
  // These are assigned after game is created; they bridge modules and closure scope.

  function getRendererRecommendation() {
    return rendererModule.getRendererRecommendation();
  }
  function applyRendererSettings(settings, opts = {}) {
    return rendererModule.applyRendererSettings(settings, { ...opts, syncPerformanceUi: msg => syncPerformanceUi(msg), saveBrowserSettings: () => saveBrowserSettings() });
  }
  function syncPerformanceUi(message = '') {
    perfModule.syncPerformanceUi(message, () => getRendererRecommendation());
  }
  function applyPerformancePreset(profile, { save = true } = {}) {
    perfModule.applyPerformancePreset(profile, { save, getRendererRecommendation: () => getRendererRecommendation(), syncPerformanceUi: msg => syncPerformanceUi(msg), saveBrowserSettings: () => saveBrowserSettings() });
  }
  function syncProviderUi() {
    providerModule.syncProviderUi();
  }
  function setLocalAiProvider(provider, opts) {
    providerModule.setLocalAiProvider(provider, opts);
    updateAssistantPromptPreview();
    saveBrowserSettings();
  }
  function saveBrowserSettings() {
    return providerModule.saveBrowserSettings({
      getRendererSettingsFromUi,
      getTemplateRoutingEnabled: () => assistantModule.getTemplateRoutingEnabled(),
      getSemanticRoutingEnabled: () => assistantModule.getSemanticRoutingEnabled(),
      getAsrMode,
      getFogOfWarEnabled,
      getLightingEffectsEnabled,
      getDynamicShadowsEnabled,
      getShowFpsOverlayEnabled,
      getRendererModeFromUi,
      storageSet,
      SETTINGS_KEY
    });
  }

  // Assistant module wiring
  function getActionPackCatalog() { return assistantModule.getActionPackCatalog(); }
  function getAssistantLoadout() { return assistantModule.getAssistantLoadout(); }
  function getAssistantLoadoutDebug() { return assistantModule.getAssistantLoadoutDebug(); }
  function getSemanticRoutingEnabled() { return assistantModule.getSemanticRoutingEnabled(); }
  function getTemplateRoutingEnabled() { return assistantModule.getTemplateRoutingEnabled(); }
  function getChatDraftText() { return assistantModule.getChatDraftText(); }
  function getRoutedAssistantLoadout(text, opts) { return assistantModule.getRoutedAssistantLoadout(text, opts); }
  function updateSemanticRouterUi(route) { return assistantModule.updateSemanticRouterUi(route); }
  function scheduleSemanticRoutePreview() { return assistantModule.scheduleSemanticRoutePreview({ updateAssistantPromptPreview: () => updateAssistantPromptPreview() })(); }
  function renderActionStepChainTable() { return assistantModule.renderActionStepChainTable(); }
  function readCustomPackForm() { return assistantModule.readCustomPackForm(); }
  function clearCustomPackForm(pack) { return assistantModule.clearCustomPackForm(pack); }
  function renderCustomPackActionSelector(ops) { return assistantModule.renderCustomPackActionSelector(ops); }
  function renderCustomPackAliasEditor(ops, src) { return assistantModule.renderCustomPackAliasEditor(ops, src); }
  function readCustomPackAliasEditor(ops) { return assistantModule.readCustomPackAliasEditor(ops); }
  function defaultPackActionAliases(ops, src) { return assistantModule.defaultPackActionAliases(ops, src); }
  function actionRowsByOp() { return assistantModule.actionRowsByOp(); }
  function flattenPartAliases(aliases) { return assistantModule.flattenPartAliases(aliases); }

  function updateAssistantPromptPreview() {
    return assistantModule.updateAssistantPromptPreview({
      game, getCurrentLocalAiConfig,
      getTemplateRoutingEnabled: () => getTemplateRoutingEnabled(),
      formatAssistantPromptPreview
    })();
  }
  function updateAssistantLoadoutDebug(message) {
    return assistantModule.updateAssistantLoadoutDebug({
      game, updateAssistantPromptPreview: () => updateAssistantPromptPreview()
    })(message);
  }
  function renderKnowledgePackSelector(message) {
    return assistantModule.renderKnowledgePackSelector({
      game, updateAssistantLoadoutDebug: msg => updateAssistantLoadoutDebug(msg)
    })(message);
  }
  function persistAssistantLoadout(nextLoadout) {
    return assistantModule.persistAssistantLoadout({
      storageSet, renderKnowledgePackSelector: msg => renderKnowledgePackSelector(msg),
      game, updateSemanticRouterUi: route => updateSemanticRouterUi(route)
    })(nextLoadout);
  }
  function persistCustomActionPacks(message) {
    return assistantModule.persistCustomActionPacks({
      storageGet, storageSet,
      renderKnowledgePackSelector: msg => renderKnowledgePackSelector(msg),
      game, updateSemanticRouterUi: route => updateSemanticRouterUi(route)
    })(message);
  }
  function upsertCustomActionPack(input) {
    return assistantModule.upsertCustomActionPack({ persistFn: msg => persistCustomActionPacks(msg) })(input);
  }
  function deleteCustomActionPack(id) {
    return assistantModule.deleteCustomActionPack({
      persistFn: msg => persistCustomActionPacks(msg),
      clearForm: () => clearCustomPackForm()
    })(id);
  }

  const getAsrMode = () => (ASR_MODES[dom.asrMode?.value] ? dom.asrMode.value : 'zipformer_whisper');
  const getFogOfWarEnabled = () => dom.fogOfWarToggle?.checked !== false;
  const getLightingEffectsEnabled = () => dom.lightingEffects?.checked !== false;
  const getDynamicShadowsEnabled = () => dom.dynamicShadows?.checked !== false;
  const getShowFpsOverlayEnabled = () => dom.showFpsOverlay?.checked !== false;

  // Initialize assistant module state (loads custom packs, loadout from storage)
  assistantModule.init({ storageGet, storageSet, game: null });
  function syncAsrModeUi() {
    const cfg = ASR_MODES[getAsrMode()];
    if (dom.asrStatus) dom.asrStatus.textContent = cfg.status;
    if (dom.asrModeHelp) dom.asrModeHelp.textContent = cfg.help;
    syncBrowserSttUi();
  }
  function syncBrowserSttUi(message = '') {
    if (!browserStt) return;
    const state = browserStt.getState?.() || {};
    const model = state.model || browserStt.getModel?.(state.modelId || DEFAULT_BROWSER_STT_MODEL) || { label: state.modelId || DEFAULT_BROWSER_STT_MODEL, sizeMb: 0 };
    const isActiveMode = getAsrMode() === 'browser_whisper';
    if (dom.browserSttModel) dom.browserSttModel.disabled = state.status === 'downloading' || state.status === 'processing';
    if (dom.browserSttDownloadBtn) dom.browserSttDownloadBtn.textContent = state.status === 'downloading' ? 'Downloading...' : (browserStt.hasLoadedModel?.(state.modelId) ? 'Reload model' : 'Download model');
    if (dom.browserSttDownloadBtn) dom.browserSttDownloadBtn.disabled = state.status === 'downloading' || state.status === 'processing';
    if (dom.browserSttUnloadBtn) dom.browserSttUnloadBtn.disabled = !browserStt.hasLoadedModel?.(state.modelId) || state.status === 'downloading';
    if (dom.browserSttStatus) {
      const base = message || state.message || (browserStt.hasLoadedModel?.(state.modelId) ? `${model.label} loaded.` : `${model.label} not loaded yet.`);
      dom.browserSttStatus.textContent = isActiveMode ? base : `${base} Switch Voice mode to Browser Whisper to use it from the mic button.`;
    }
    if (dom.browserSttProgress) {
      dom.browserSttProgress.value = Number(state.progress || 0);
      dom.browserSttProgress.max = 100;
    }
    if (dom.browserSttProgressText) {
      dom.browserSttProgressText.textContent = state.status === 'downloading'
        ? `${Number(state.progress || 0)}%`
        : browserStt.hasLoadedModel?.(state.modelId)
          ? 'ready'
          : '0%';
    }
  }

  const params = new URLSearchParams(window.location.search);
  const storedSettings = readJson(SETTINGS_KEY, null);
  const storedRendererMode = String(storedSettings?.rendererMode || 'canvas2d').toLowerCase();
  const storedRendererSettings = normalizeRendererSettings(storedSettings?.rendererSettings);
  const storedPerformanceProfile = storedSettings?.performanceProfile || 'auto';
  const storedAsrMode = storedSettings?.asrMode || storageGet(ASR_MODE_KEY);
  const storedBrowserSttModel = storedSettings?.browserSttModel || DEFAULT_BROWSER_STT_MODEL;
  if (ASR_MODES[storedAsrMode] && dom.asrMode) dom.asrMode.value = storedAsrMode;
  if (dom.browserSttModel) dom.browserSttModel.value = dom.browserSttModel.querySelector(`option[value="${storedBrowserSttModel}"]`) ? storedBrowserSttModel : DEFAULT_BROWSER_STT_MODEL;
  if (dom.templateRouting) dom.templateRouting.checked = typeof storedSettings?.templateRouting === 'boolean' ? storedSettings.templateRouting : storageGet(TEMPLATE_ROUTING_KEY) === 'true';
  if (dom.semanticRouting) dom.semanticRouting.checked = typeof storedSettings?.semanticRouting === 'boolean' ? storedSettings.semanticRouting : storageGet(SEMANTIC_ROUTING_KEY) !== 'false';
  const browserStt = createBrowserSttController({ defaultModelId: dom.browserSttModel?.value || storedBrowserSttModel });
  syncAsrModeUi();
  browserStt.onStateChange(() => syncBrowserSttUi());
  const chat = createChatController({
    chatInput: dom.chatInput,
    chatForm: dom.chatForm,
    micButton: dom.micButton,
    asrStatus: dom.asrStatus,
    quickCommands: dom.quickCommands,
    getAsrMode,
    getBrowserSttModel: () => dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL,
    browserStt,
    onSubmit: text => handleAssistant(text)
  });
  const rendererMode = params.get('renderer') || storedRendererMode || 'canvas2d';
  syncRendererModeUi(rendererMode);
  syncRendererSettingsUi(storedRendererSettings);
  const renderBackend = await createRenderBackend({ canvas: dom.canvas, mode: rendererMode, settings: storedRendererSettings });
  game = new Game({ canvas: dom.canvas, chat, dom, isChatActive: () => isChatOpen(), renderBackend });
  game.setManagerKnowledgePackCatalog(getActionPackCatalog());
  semanticRouter.syncCatalog(getActionPackCatalog(), getAssistantLoadout()).then(() => updateSemanticRouterUi(semanticRouter.getLastRoute?.())).catch(error => {
    if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = `Semantic router unavailable: ${error.message}`;
  });
  game.getDefaultManagerKnowledgePacks = () => getAssistantLoadout();
  game.managerMessageHandler = ({ manager, sender, message }) => handleManagerMessage(manager, message, { source: 'delegate_to_manager', sender });
  game.renderer = {
    text: formatRendererStatus(renderBackend.text || renderBackend.kind || 'Renderer ready'),
    webgpu: false,
    reason: 'active backend',
    backend: renderBackend.kind
  };
  const simWorker = createSimWorkerClient({ enabled: params.get('simWorker') !== '0' });
  const isMobileControlsDevice = () => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const narrow = window.matchMedia?.('(max-width: 780px)').matches;
    return !!(coarse || narrow || navigator.maxTouchPoints > 0);
  };
  dom.gameStage?.classList.toggle('is-mobile-device', isMobileControlsDevice());
  window.addEventListener('resize', () => dom.gameStage?.classList.toggle('is-mobile-device', isMobileControlsDevice()), { passive: true });
  game.fogOfWar.enabled = storedSettings?.fogOfWar !== false;
  game.lightingEffectsEnabled = storedSettings?.lightingEffects !== false;
  game.dynamicShadowsEnabled = storedSettings?.dynamicShadows === true;
  game.showFpsOverlay = storedSettings?.showFpsOverlay !== false;
  if (dom.fogOfWarToggle) dom.fogOfWarToggle.checked = game.fogOfWar.enabled;
  if (dom.lightingEffects) dom.lightingEffects.checked = game.lightingEffectsEnabled;
  if (dom.dynamicShadows) dom.dynamicShadows.checked = game.dynamicShadowsEnabled;
  if (dom.showFpsOverlay) dom.showFpsOverlay.checked = game.showFpsOverlay;
  syncRendererSettingsUi(renderBackend.getSettings?.() || storedRendererSettings);
  const audio = createAudioController();
  const saveGames = createSaveGameManager({ storageGet, storageSet, libraryKey: SAVE_LIBRARY_KEY, legacyKey: SAVE_KEY });
  let selectedMainMenuMode = 'test';
  let mainMenuAudioUnlocked = false;
  game.audio = audio;
  setPerformanceProfileValue(storedPerformanceProfile);
  probeRenderer().then(renderer => {
    game.renderer = {
      ...renderer,
      text: formatRendererStatus(renderBackend.text || 'Renderer', renderer),
      backend: renderBackend.kind
    };
    if (storedSettings?.targetFps || storedSettings?.maxBots) {
      syncPerformanceUi('Loaded performance settings from this browser.');
      return;
    }
    applyPerformancePreset(storedPerformanceProfile === 'custom' ? 'auto' : storedPerformanceProfile, { save: true });
  }).catch(err => {
    game.renderer = {
      text: formatRendererStatus(renderBackend.text || 'Renderer', { text: 'GPU probe failed' }),
      webgpu: false,
      reason: err.message,
      backend: renderBackend.kind
    };
    syncPerformanceUi('Renderer probe failed; using conservative fallback heuristics.');
  });
  const multiplayer = createMultiplayerController({ game, dom, addChat });
  if (storedSettings?.targetFps && dom.targetFps) {
    game.targetFps = Number(storedSettings.targetFps);
    dom.targetFps.value = String(game.targetFps);
    dom.targetFpsValue.textContent = String(game.targetFps);
  }
  if (storedSettings?.maxBots && dom.maxBots) {
    game.maxBots = Number(storedSettings.maxBots);
    dom.maxBots.value = String(game.maxBots);
    dom.maxBotsValue.textContent = String(game.maxBots);
  }
  syncPerformanceUi(storedSettings?.targetFps || storedSettings?.maxBots ? 'Loaded performance settings from this browser.' : '');
  if (storedSettings?.ai?.provider || storedSettings?.llmMode === 'tabbyapi') {
    const provider = storedSettings.ai?.provider || 'tabbyapi';
    const defaults = getDefaultProviderConfig(provider);
    dom.llmMode.value = storedSettings.llmMode || provider;
    dom.ollamaEndpoint.value = (storedSettings.ai?.endpoint || defaults.endpoint || '').replace(/\/$/, '');
    dom.ollamaModel.value = storedSettings.ai?.model || defaults.model;
  }

  function setSettingsOpen(open) {
    dom.settingsOverlay.hidden = !open;
    dom.settingsOverlay.setAttribute('aria-hidden', String(!open));
    if (open) {
      setMainMenuOpen(false, { keepPaused: true });
      if (!game.multiplayer?.enabled) game.setPaused(true);
      setBuildDrawerOpen(false); setBotDrawerOpen(false); setTemplateDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.cancelPlacement(); game.cancelZoneDrawing(false); game.hideMenus(); syncSaveUi(); setSettingsView('menu'); dom.settingsClose.focus();
    } else if (!game.multiplayer?.enabled) {
      game.setPaused(false);
      syncSaveUi();
    }
  }
  function toggleSettings() { setSettingsOpen(dom.settingsOverlay.hidden); }
  let saveLoadMode = '';
  let settingsView = 'menu';
  function syncSettingsViewUi() {
    const menuVisible = settingsView !== 'tabs';
    dom.settingsMainPanel?.classList.toggle('is-active', menuVisible);
    if (dom.settingsMainPanel) dom.settingsMainPanel.hidden = !menuVisible;
    document.querySelectorAll('.settings-tabs, .settings-tab-panel').forEach(el => {
      el.hidden = menuVisible;
    });
    if (dom.openSettingsTabBtn) dom.openSettingsTabBtn.textContent = 'Settings';
  }
  function setSettingsView(view = 'menu') {
    settingsView = view === 'tabs' ? 'tabs' : 'menu';
    syncSettingsViewUi();
    if (settingsView === 'tabs') {
      setSettingsTab(document.querySelector('[data-settings-tab].is-active')?.dataset.settingsTab || 'controls');
      dom.settingsClose.focus();
    }
  }
  function syncSaveLoadModeUi() {
    const buttons = document.querySelectorAll('[data-save-flow-mode]');
    const panels = document.querySelectorAll('[data-save-flow-panel]');
    const active = saveLoadMode === 'save' || saveLoadMode === 'load' ? saveLoadMode : '';
    buttons.forEach(button => {
      const selected = button.dataset.saveFlowMode === active;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    panels.forEach(panel => {
      const panelMode = panel.dataset.saveFlowPanel;
      const visible = !!active && panelMode === active;
      panel.hidden = !visible;
    });
    dom.saveGameManager?.classList.toggle('is-step-selected', !!active);
    if (dom.saveFlowPlaceholder) dom.saveFlowPlaceholder.hidden = !!active;
  }
  function setSaveLoadMode(mode) {
    const next = mode === 'save' || mode === 'load' ? mode : '';
    if (saveLoadMode === next) {
      syncSaveLoadModeUi();
      return;
    }
    saveLoadMode = next;
    syncSaveLoadModeUi();
    renderSaveManagerUi();
  }
  function setSettingsTab(name) {
    settingsView = 'tabs';
    syncSettingsViewUi();
    document.querySelectorAll('[data-settings-tab]').forEach(btn => {
      const active = btn.dataset.settingsTab === name;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-settings-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.settingsPanel === name));
    if (name === 'save-load') syncSaveLoadModeUi();
  }
  function setChatOpen(open) {
    dom.chatOverlay.classList.toggle('is-collapsed', !open);
    dom.chatToggle.setAttribute('aria-expanded', String(open));
    dom.chatToggle.textContent = open ? 'Hide Chat' : 'Chat';
    if (open) hideAssignmentToast();
    if (open) setTimeout(() => dom.chatInput.focus(), 0);
  }
  function toggleChat() { setChatOpen(dom.chatOverlay.classList.contains('is-collapsed')); }
  function isChatOpen() { return !dom.chatOverlay.classList.contains('is-collapsed'); }
  function zoomCameraFromMobile(factor) {
    const anchorX = dom.canvas?.width ? dom.canvas.width / 2 : game.W / 2;
    const anchorY = dom.canvas?.height ? dom.canvas.height / 2 : game.H / 2;
    game.setCameraZoom((game.camera.zoom || 1) * factor, anchorX, anchorY);
  }
  function bindPressAndHoldKey(button, key) {
    if (!button || !key) return;
    const release = () => { game.keys.delete(key); button.classList.remove('is-held'); };
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      game.keys.add(key);
      button.classList.add('is-held');
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('click', event => event.preventDefault());
  }
  function initMobileControls() {
    dom.mobileSettingsBtn?.addEventListener('click', () => setSettingsOpen(true));
    dom.mobileBuildBtn?.addEventListener('click', () => toggleBuildDrawer());
    dom.mobileChatBtn?.addEventListener('click', () => toggleChat());
    dom.mobileInteractBtn?.addEventListener('click', () => game.interact());
    dom.mobileDropBtn?.addEventListener('click', () => game.manualDropItem());
    dom.mobileZoomInBtn?.addEventListener('click', () => zoomCameraFromMobile(1.16));
    dom.mobileZoomOutBtn?.addEventListener('click', () => zoomCameraFromMobile(1 / 1.16));
    dom.mobileControls?.querySelectorAll('[data-mobile-pan]').forEach(button => bindPressAndHoldKey(button, button.dataset.mobilePan));
  }
  let assignmentToastTimer = 0;
  function hideAssignmentToast() {
    if (!dom.assignmentToast) return;
    clearTimeout(assignmentToastTimer);
    dom.assignmentToast.classList.remove('is-visible');
    assignmentToastTimer = setTimeout(() => { dom.assignmentToast.hidden = true; }, 170);
  }
  function showAssignmentToast(html) {
    if (!dom.assignmentToast || isChatOpen()) return;
    clearTimeout(assignmentToastTimer);
    dom.assignmentToast.innerHTML = html;
    dom.assignmentToast.hidden = false;
    requestAnimationFrame(() => dom.assignmentToast.classList.add('is-visible'));
    assignmentToastTimer = setTimeout(hideAssignmentToast, 2600);
  }
  function syncDrawerStack() {
    const open = [dom.botDrawer, dom.templateDrawer, dom.buildDrawer, dom.zonesDrawer, dom.multiplayerDrawer].some(drawer => drawer && !drawer.classList.contains('is-collapsed'));
    dom.gameStage?.classList.toggle('has-open-drawer', open);
  }
  function setBotDrawerOpen(open) {
    dom.botDrawer?.classList.toggle('is-collapsed', !open);
    dom.botDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setTemplateDrawerOpen(false); setBuildDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); }
    syncDrawerStack();
  }
  function toggleBotDrawer() { setBotDrawerOpen(dom.botDrawer?.classList.contains('is-collapsed')); }
  function setTemplateDrawerOpen(open) {
    dom.templateDrawer?.classList.toggle('is-collapsed', !open);
    dom.templateDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setBuildDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); game.syncTemplateDrawerUi?.(); }
    syncDrawerStack();
  }
  function toggleTemplateDrawer() { setTemplateDrawerOpen(dom.templateDrawer?.classList.contains('is-collapsed')); }
  function setBuildDrawerOpen(open) {
    dom.buildDrawer?.classList.toggle('is-collapsed', !open);
    dom.buildDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setTemplateDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); }
    syncDrawerStack();
  }
  function toggleBuildDrawer() { setBuildDrawerOpen(dom.buildDrawer?.classList.contains('is-collapsed')); }
  function setZonesDrawerOpen(open) {
    dom.zonesDrawer?.classList.toggle('is-collapsed', !open);
    dom.zonesDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setTemplateDrawerOpen(false); setBuildDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); game.syncZonesUi?.(); }
    syncDrawerStack();
  }
  function toggleZonesDrawer() { setZonesDrawerOpen(dom.zonesDrawer?.classList.contains('is-collapsed')); }
  function setMultiplayerDrawerOpen(open) {
    dom.multiplayerDrawer?.classList.toggle('is-collapsed', !open);
    dom.multiplayerDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setTemplateDrawerOpen(false); setBuildDrawerOpen(false); setZonesDrawerOpen(false); game.hideMenus(); }
    syncDrawerStack();
  }
  function toggleMultiplayerDrawer() { setMultiplayerDrawerOpen(dom.multiplayerDrawer?.classList.contains('is-collapsed')); }
  function closeOpenUiPanels() {
    let closed = false;
    if (dom.teachPanel && !dom.teachPanel.hidden) {
      game.closeTeachPanel();
      closed = true;
    }
    if (dom.botMenu && !dom.botMenu.hidden) {
      game.hideMenus();
      closed = true;
    }
    if (dom.dogPopup && !dom.dogPopup.hidden) {
      game.hideMenus();
      closed = true;
    }
    if (dom.structureMenu && !dom.structureMenu.hidden) {
      game.hideMenus();
      closed = true;
    }
    if (isChatOpen()) {
      setChatOpen(false);
      closed = true;
    }
    if (dom.botDrawer && !dom.botDrawer.classList.contains('is-collapsed')) {
      setBotDrawerOpen(false);
      closed = true;
    }
    if (dom.templateDrawer && !dom.templateDrawer.classList.contains('is-collapsed')) {
      setTemplateDrawerOpen(false);
      closed = true;
    }
    if (dom.buildDrawer && !dom.buildDrawer.classList.contains('is-collapsed')) {
      setBuildDrawerOpen(false);
      closed = true;
    }
    if (dom.zonesDrawer && !dom.zonesDrawer.classList.contains('is-collapsed')) {
      setZonesDrawerOpen(false);
      closed = true;
    }
    if (dom.multiplayerDrawer && !dom.multiplayerDrawer.classList.contains('is-collapsed')) {
      setMultiplayerDrawerOpen(false);
      closed = true;
    }
    if (dom.radioWidgetPanel && !dom.radioWidgetPanel.hidden) {
      setRadioWidgetOpen(false);
      closed = true;
    }
    if (dom.settingsOverlay && !dom.settingsOverlay.hidden) {
      setSettingsOpen(false);
      closed = true;
    }
    return closed;
  }
  function currentSaveMode() { return normalizeGameMode(game.gameMode || game.multiplayer?.mapMode || (game.multiplayer?.enabled ? 'online_lakes' : 'test')); }
  function modeLabel(mode) { return GAME_MODE_LABELS[normalizeGameMode(mode)] || 'Game mode'; }
  function hasSavedGame(mode = currentSaveMode()) { return saveGames.hasSaves(mode); }
  let lastSuccessfulSaveAt = 0;
  function getLastSaveAgeMs() { return lastSuccessfulSaveAt ? Date.now() - lastSuccessfulSaveAt : Infinity; }
  function wasSavedRecently() { return getLastSaveAgeMs() <= RECENT_SAVE_MS; }
  function setQuitSavePromptOpen(open) {
    if (!dom.quitSavePrompt) return;
    dom.quitSavePrompt.hidden = !open;
    dom.quitSavePrompt.classList.toggle('is-open', open);
    if (open) setTimeout(() => dom.saveAndQuitBtn?.focus(), 0);
  }
  function formatSaveTime(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? 'unknown time' : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }
  function renderSaveManagerUi({ message = '', preserve = true } = {}) {
    const mode = currentSaveMode();
    const selectedSlotId = preserve ? (dom.saveSlotSelect?.value || dom.saveSlotSelectLoad?.value || '') : '';
    const selectedSaveId = preserve ? dom.saveEntrySelect?.value : '';
    const slots = saveGames.listSlots(mode);
    if (dom.saveSlotSelect) {
      dom.saveSlotSelect.innerHTML = '<option value="">+ New slot from typed name</option>' + slots.map(slot => `<option value="${escapeHtml(slot.id)}">${escapeHtml(slot.name)} (${slot.saves.length})</option>`).join('');
      const slotExists = slots.some(slot => slot.id === selectedSlotId);
      dom.saveSlotSelect.value = slotExists ? selectedSlotId : (slots[0]?.id || '');
    }
    if (dom.saveSlotSelectLoad) {
      dom.saveSlotSelectLoad.innerHTML = dom.saveSlotSelect?.innerHTML || '<option value="">+ New slot from typed name</option>';
      dom.saveSlotSelectLoad.value = dom.saveSlotSelect?.value || '';
    }
    const slot = slots.find(entry => entry.id === (dom.saveSlotSelectLoad?.value || dom.saveSlotSelect?.value)) || null;
    if (dom.saveSlotName && !dom.saveSlotName.value) dom.saveSlotName.value = slot?.name || '';
    if (dom.saveNameLoad && !dom.saveNameLoad.value) dom.saveNameLoad.value = dom.saveName?.value || '';
    const saves = slot?.saves || [];
    if (dom.saveEntrySelect) {
      dom.saveEntrySelect.innerHTML = saves.length ? saves.map(save => `<option value="${escapeHtml(save.id)}">${escapeHtml(save.name)} · ${escapeHtml(formatSaveTime(save.savedAt))}</option>`).join('') : '<option value="">No savegames in this slot</option>';
      const saveExists = saves.some(save => save.id === selectedSaveId);
      dom.saveEntrySelect.value = saveExists ? selectedSaveId : (saves[0]?.id || '');
    }
    if (dom.saveSlotSelectLoad) dom.saveSlotSelectLoad.disabled = !slots.length;
    if (dom.saveNameLoad) dom.saveNameLoad.disabled = !slot;
    if (dom.loadGameBtn) dom.loadGameBtn.disabled = !slot || !saves.length;
    if (dom.renameSlotBtn) dom.renameSlotBtn.disabled = !slot;
    if (dom.deleteSlotBtn) dom.deleteSlotBtn.disabled = !slot;
    if (dom.renameSaveBtn) dom.renameSaveBtn.disabled = !slot || !saves.length;
    if (dom.deleteSaveBtn) dom.deleteSaveBtn.disabled = !slot || !saves.length;
    if (dom.deleteOldSavesBtn) dom.deleteOldSavesBtn.disabled = !slot || saves.length < 2;
    const pausedText = game.paused ? 'Paused' : 'Running';
    const status = message || `${pausedText}. Managing ${modeLabel(mode)} savegames (${slots.reduce((sum, entry) => sum + entry.saves.length, 0)} saves across ${slots.length} slots).`;
    if (dom.saveGameStatus) dom.saveGameStatus.textContent = status;
  }
  function syncMainMenuStatus(message = '') {
    const mode = normalizeGameMode(selectedMainMenuMode);
    const latest = saveGames.latest(mode);
    if (dom.mainMenuLoadBtn) dom.mainMenuLoadBtn.disabled = !latest;
    if (dom.mainMenuHostLoadBtn) dom.mainMenuHostLoadBtn.disabled = !saveGames.latest('online_lakes');
    if (dom.mainMenuStatus) dom.mainMenuStatus.textContent = message || (latest ? `${modeLabel(mode)} save available: ${latest.slotName} / ${latest.name}.` : `No ${modeLabel(mode)} savegames yet.`);
  }
  function syncSaveUi(message = '') {
    renderSaveManagerUi({ message });
    if (dom.pauseGameBtn) dom.pauseGameBtn.disabled = !!game.multiplayer?.enabled || game.paused;
    if (dom.resumeGameBtn) dom.resumeGameBtn.disabled = !!game.multiplayer?.enabled || !game.paused;
    syncMainMenuStatus(message && dom.mainMenuOverlay && !dom.mainMenuOverlay.hidden ? message : '');
  }
  function playMainMenuCue(name = 'menu_whoosh', { force = false } = {}) {
    if (!dom.mainMenuOverlay || dom.mainMenuOverlay.hidden) return false;
    if (force) return audio.play(name, { cooldownKey: `main-menu:${name}`, minGapMs: name === 'ui_hover' ? 120 : 0 });
    const firstGesture = !mainMenuAudioUnlocked;
    mainMenuAudioUnlocked = true;
    const cue = firstGesture ? 'menu_arrive' : name;
    return audio.play(cue, { cooldownKey: `main-menu:${cue}`, minGapMs: cue === 'ui_hover' ? 120 : 0 });
  }
  function initMainMenuAudiovisuals() {
    if (!dom.mainMenuOverlay) return;
    dom.mainMenuOverlay.addEventListener('mouseover', e => {
      if (e.target.closest('button, a, input')) playMainMenuCue('ui_hover', { force: true });
    });
    dom.mainMenuOverlay.addEventListener('focusin', e => {
      if (e.target.closest('button, a, input')) playMainMenuCue('ui_hover', { force: true });
    });
    dom.mainMenuOverlay.addEventListener('click', e => {
      const target = e.target.closest('button, a');
      if (!target) return;
      const label = (target.textContent || '').toLowerCase();
      const cue = label.includes('back') ? 'menu_back' : (label.includes('start') || label.includes('host') || label.includes('join') || label.includes('load') ? 'menu_confirm' : 'menu_whoosh');
      playMainMenuCue(cue);
    }, true);
  }
  function setMainMenuLayer(layer = 'modes', mode = selectedMainMenuMode) {
    selectedMainMenuMode = normalizeGameMode(mode);
    if (dom.mainMenuModeChoices) dom.mainMenuModeChoices.hidden = layer !== 'modes';
    if (dom.mainMenuModeLayer) dom.mainMenuModeLayer.hidden = layer !== 'mode-actions';
    if (dom.mainMenuOnlineLayer) dom.mainMenuOnlineLayer.hidden = layer !== 'online-actions';
    if (dom.mainMenuHostLayer) dom.mainMenuHostLayer.hidden = layer !== 'host-actions';
    if (dom.mainMenuStartSelectedBtn) dom.mainMenuStartSelectedBtn.textContent = `Start new ${modeLabel(selectedMainMenuMode)}`;
    if (dom.mainMenuLoadBtn) dom.mainMenuLoadBtn.textContent = `Load ${modeLabel(selectedMainMenuMode)} save`;
    syncMainMenuStatus(layer === 'modes' ? 'Choose a game mode first.' : '');
  }
  function renderCampaignIntroScene() {
    if (!dom.campaignIntroOverlay) return;
    const scene = CAMPAIGN_INTRO_SCENES[campaignIntroSceneIndex] || CAMPAIGN_INTRO_SCENES[0];
    if (dom.campaignIntroKicker) dom.campaignIntroKicker.textContent = scene.kicker;
    if (dom.campaignIntroTitle) dom.campaignIntroTitle.textContent = scene.title;
    if (dom.campaignIntroText) dom.campaignIntroText.textContent = scene.text;
    if (dom.campaignIntroSceneNo) dom.campaignIntroSceneNo.textContent = `Scene ${campaignIntroSceneIndex + 1} / ${CAMPAIGN_INTRO_SCENES.length}`;
    if (dom.campaignIntroNextBtn) dom.campaignIntroNextBtn.textContent = campaignIntroSceneIndex >= CAMPAIGN_INTRO_SCENES.length - 1 ? 'Begin at the lake' : 'Next';
  }
  function closeCampaignIntro({ resume = false, message = '' } = {}) {
    campaignIntroActive = false;
    if (campaignCinematic) { campaignCinematic.destroy(); campaignCinematic = null; }
    if (dom.campaignIntroOverlay) {
      dom.campaignIntroOverlay.hidden = true;
      dom.campaignIntroOverlay.classList.add('is-hidden');
    }
    if (resume && !game.multiplayer?.enabled) game.setPaused(false);
    syncSaveUi(message);
    return true;
  }
  function finishCampaignIntro(reason = 'finished') {
    if (reason === 'skip') {
      const message = 'Campaign intro skipped. Camper van arriving.';
      closeCampaignIntro({ resume: false, message });
      setChatOpen(false);
      game.beginCampaignArrival?.();
      syncSaveUi(message);
      return true;
    }
    const message = 'Campaign intro complete. Camper van arriving.';
    closeCampaignIntro({ resume: false, message });
    setChatOpen(false);
    game.beginCampaignArrival?.();
    syncSaveUi(message);
    return true;
  }
  function advanceCampaignIntro() {
    if (!campaignIntroActive) return false;
    if (campaignIntroSceneIndex >= CAMPAIGN_INTRO_SCENES.length - 1) return finishCampaignIntro('finished');
    campaignIntroSceneIndex += 1;
    renderCampaignIntroScene();
    dom.campaignIntroNextBtn?.focus();
    return true;
  }
  function showCampaignIntro() {
    if (!dom.campaignIntroOverlay) { game.setPaused(false); return false; }
    campaignIntroActive = true;
    campaignIntroSceneIndex = 0;
    game.setPaused(true);
    // Hide the static HTML overlay — cinematic draws directly on canvas
    dom.campaignIntroOverlay.hidden = true;
    dom.campaignIntroOverlay.classList.add('is-hidden');
    // Clean up any previous cinematic instance
    if (campaignCinematic) { campaignCinematic.destroy(); campaignCinematic = null; }
    // Create and start the canvas cinematic
    campaignCinematic = createCampaignIntroCinematic({
      canvas: game.canvas,
      audio: audio,
      scenes: CAMPAIGN_INTRO_SCENES,
      onComplete: (reason) => { campaignCinematic = null; finishCampaignIntro(reason === 'skip' ? 'skip' : 'finished'); },
      onSkip: () => { campaignCinematic = null; finishCampaignIntro('skip'); }
    });
    campaignCinematic.start();
    syncSaveUi('Campaign intro cinematic playing. Press Esc to skip.');
    return true;
  }
  function setMainMenuOpen(open, { keepPaused = false } = {}) {
    if (!dom.mainMenuOverlay) return;
    dom.mainMenuOverlay.hidden = !open;
    dom.mainMenuOverlay.classList.toggle('is-hidden', !open);
    if (open) {
      closeCampaignIntro({ resume: false });
      setSettingsOpen(false); setTemplateDrawerOpen(false); setBuildDrawerOpen(false); setBotDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus();
      game.setPaused(true);
      setMainMenuLayer('modes');
      syncSaveUi();
      setTimeout(() => (dom.mainMenuCampaignBtn || dom.mainMenuNewBtn)?.focus(), 0);
    } else if (!keepPaused && !game.multiplayer?.enabled) {
      game.setPaused(false);
      syncSaveUi();
    }
  }
  function saveGameToCache({ slotId = dom.saveSlotSelect?.value || dom.saveSlotSelectLoad?.value || '', slotName = dom.saveSlotName?.value || '', saveName = saveLoadMode === 'load' ? (dom.saveNameLoad?.value || dom.saveName?.value || '') : (dom.saveName?.value || dom.saveNameLoad?.value || '') } = {}) {
    const payload = game.exportSave();
    const mode = normalizeGameMode(payload.mode || currentSaveMode());
    const saved = saveGames.save(mode, payload, { slotId, slotName, saveName });
    const ok = !!saved;
    if (ok) {
      storageSet(SAVE_KEY, JSON.stringify(saved.save.payload));
      lastSuccessfulSaveAt = Date.parse(saved.save.savedAt) || Date.now();
      setQuitSavePromptOpen(false);
      if (dom.saveSlotName) dom.saveSlotName.value = saved.slot.name;
      if (dom.saveSlotSelectLoad) dom.saveSlotSelectLoad.value = saved.slot.id;
      if (dom.saveName) dom.saveName.value = '';
      if (dom.saveNameLoad) dom.saveNameLoad.value = '';
      renderSaveManagerUi({ message: `Saved ${modeLabel(mode)} → ${saved.slot.name} / ${saved.save.name} at ${formatSaveTime(saved.save.savedAt)}.`, preserve: false });
      if (dom.saveSlotSelect) dom.saveSlotSelect.value = saved.slot.id;
      if (dom.saveSlotSelectLoad) dom.saveSlotSelectLoad.value = saved.slot.id;
      if (dom.saveEntrySelect) dom.saveEntrySelect.value = saved.save.id;
    }
    syncSaveUi(ok ? `Saved ${modeLabel(mode)} savegame at ${formatSaveTime(saved.save.savedAt)}.` : 'Save failed: browser cache unavailable.');
    return ok ? saved.save.payload : null;
  }
  function loadGameFromCache({ closeMenus = true, mode = currentSaveMode(), slotId = dom.saveSlotSelectLoad?.value || dom.saveSlotSelect?.value || '', saveId = dom.saveEntrySelect?.value || '', asHost = false } = {}) {
    const normalizedMode = normalizeGameMode(mode);
    const found = saveGames.load(normalizedMode, slotId, saveId);
    if (!found) { syncSaveUi(`No ${modeLabel(normalizedMode)} savegame in browser cache.`); return null; }
    try {
      const parsedSave = found.payload;
      const state = game.loadSave(parsedSave);
      if (asHost && game.multiplayer) {
        game.multiplayer.enabled = true;
        game.multiplayer.role = 'host';
        game.multiplayer.mapMode = 'online_lakes';
        game.multiplayer.status = `Hosting loaded save ${found.slotName} / ${found.save.name}`;
      }
      lastSuccessfulSaveAt = Date.parse(parsedSave.savedAt) || Date.parse(found.save.savedAt) || 0;
      setQuitSavePromptOpen(false);
      if (dom.targetFps) dom.targetFps.value = String(game.targetFps);
      if (dom.maxBots) dom.maxBots.value = String(game.maxBots);
      setPerformanceProfileValue('custom');
      syncPerformanceUi(`Loaded ${modeLabel(normalizedMode)} savegame.`);
      if (closeMenus) { setMainMenuOpen(false); setSettingsOpen(false); }
      game.setPaused(false);
      syncSaveUi(`Loaded ${modeLabel(normalizedMode)} savegame: ${found.slotName} / ${found.save.name}.`);
      return state;
    } catch (err) {
      syncSaveUi(`Load failed: ${err.message}`);
      return null;
    }
  }
  function startNewGameFromMenu(mode = selectedMainMenuMode) {
    const normalizedMode = normalizeGameMode(mode);
    if (normalizedMode === 'campaign') return startCampaignFromMenu();
    if (normalizedMode === 'local_ai') return startLocalAiFromMainMenu();
    if (normalizedMode === 'online_lakes') return hostFromMainMenu({ loadSave: false });
    game.resetSoloWorld();
    lastSuccessfulSaveAt = 0;
    setQuitSavePromptOpen(false);
    setMainMenuOpen(false);
    game.setPaused(false);
    syncSaveUi('Started Test mode on the current solo play map.');
  }
  function startCampaignFromMenu() {
    game.startCampaignMode();
    lastSuccessfulSaveAt = 0;
    setQuitSavePromptOpen(false);
    setMainMenuOpen(false, { keepPaused: true });
    showCampaignIntro();
  }
  function quitToMainMenu({ saveFirst = false, force = false } = {}) {
    if (!force && !saveFirst && !wasSavedRecently()) {
      setQuitSavePromptOpen(true);
      syncSaveUi('Save before quitting? Last save is older than 30 seconds.');
      return false;
    }
    if (saveFirst && !saveGameToCache()) return false;
    setQuitSavePromptOpen(false);
    setSettingsOpen(false);
    setMainMenuOpen(true);
    syncSaveUi(saveFirst ? 'Saved and returned to main menu.' : 'Returned to main menu.');
    return true;
  }
  function startLocalAiFromMainMenu() {
    setMainMenuOpen(false);
    game.setPaused(false);
    game.startLocalAiMatch({ sessionId: `local-ai-${Date.now().toString(36)}` });
    syncSaveUi('Local vs AI started: Dota-like throne lane with AI creep waves.');
  }
  async function hostFromMainMenu({ loadSave = false } = {}) {
    if (loadSave) {
      const loaded = loadGameFromCache({ mode: 'online_lakes', slotId: '', saveId: '', asHost: true });
      if (loaded) syncSaveUi('Online multiplayer host loaded from saved game.');
      return loaded;
    }
    setMainMenuOpen(false);
    game.setPaused(false);
    await multiplayer.hostSession({ openSeparate: true });
    syncSaveUi('Online multiplayer host started on the lake-camp map.');
  }
  async function joinFromMainMenu() {
    const id = (dom.mainMenuJoinCode?.value || dom.multiplayerJoinCode?.value || '').trim();
    if (dom.multiplayerJoinCode && id) dom.multiplayerJoinCode.value = id;
    setMainMenuOpen(false);
    game.setPaused(false);
    await multiplayer.joinSession(id);
    syncSaveUi(`Joined multiplayer ${id || multiplayer.state.sessionId}.`);
  }
  function beginDrawZone() {
    setZonesDrawerOpen(false);
    setChatOpen(true);
    game.beginZoneDrawing();
    dom.asrStatus.textContent = 'Zone: drag a rectangle on the map; its rect(x,y,w,h) coordinates will be inserted into the command.';
  }
  function setBuildTab(name) {
    dom.buildPanel?.querySelectorAll('[data-build-tab]').forEach(btn => {
      const active = btn.dataset.buildTab === name;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    dom.buildPanel?.querySelectorAll('[data-build-category]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.buildCategory === name));
  }

  function dslStepsHtml(steps = []) {
    return `<ol class="dsl-steps">${steps.map(step => `<li><code>${escapeHtml(step.op)}</code>${step.type ? ` <b>${escapeHtml(step.type)}</b>` : ''}${step.structureName ? ` → ${escapeHtml(step.structureName)}` : ''}</li>`).join('')}</ol>`;
  }
  function rawModelResponseDetailsHtml(parsed) {
    const raw = parsed?.debug?.returned?.rawResponse ?? parsed?.debug?.returned?.content ?? parsed?.debug?.returned?.rawHttpBody;
    if (!raw) return '';
    const rawText = String(raw).slice(0, 4000);
    return `<details class="raw-llm-response"><summary>Raw model response</summary><pre><code>${escapeHtml(rawText)}</code></pre></details>`;
  }
  function handleParsed(parsed) {
    const results = [];
    if (parsed.meta) dom.ollamaStatus.textContent = parsed.meta;
    if (parsed.help) { addChat('assistant', `${parsed.meta ? escapeHtml(parsed.meta) : `Available: ${PROGRAMS.map(p => `<code>${p}</code>`).join(', ')}. Click bots to inspect DSL. Right-click buildings to add their name to chat.`}${rawModelResponseDetailsHtml(parsed)}`); return results; }
    for (const assignment of parsed.dslAssignments || []) {
      const res = game.assignCustomDslProgram(assignment);
      results.push({ type: 'dsl', assignment, result: res });
      if (!res.ok) {
        addChat('error', escapeHtml(res.error));
        continue;
      }
      const assignedBotId = res.bot?.id || assignment.botId;
      const message = `Generated DSL for <b>Bot ${assignedBotId}</b>: <code>${escapeHtml(res.program.name)}</code>${dslStepsHtml(res.steps)}`;
      addChat('assistant', message);
      showAssignmentToast(`Generated DSL for <b>Bot ${assignedBotId}</b>.`);
    }
    for (const assignment of parsed.templateAssignments || []) {
      const res = game.assignTemplateToBot(assignment.arguments.botId, assignment.arguments.templateName, assignment.arguments);
      results.push({ type: 'template', assignment, result: res });
      if (!res.ok) {
        addChat('error', escapeHtml(res.error));
        continue;
      }
      const message = `Assigned <b>${escapeHtml(game.botDisplayName?.(res.bot) || `Bot ${res.bot.id}`)}</b> → template <code>${escapeHtml(res.template.name)}</code>.`;
      addChat('assistant', message);
      showAssignmentToast(message);
    }
    for (const call of parsed.calls || []) {
      const res = game.assignBotProgram(call.arguments);
      results.push({ type: 'tool_call', call, result: res });
      if (!res.ok) {
        addChat('error', escapeHtml(res.error));
        continue;
      }
      const bits = [`Assigned <b>Bot ${call.arguments.botId}</b> → <code>${call.arguments.program}</code>`];
      if (res.sourceLabel) bits.push(`source <b>${escapeHtml(res.sourceLabel)}</b>`);
      if (res.targetLabel) bits.push(`target <b>${escapeHtml(res.targetLabel)}</b>`);
      if (res.zoneLabel && res.zoneLabel !== 'anywhere') bits.push(`zone <b>${escapeHtml(res.zoneLabel)}</b>`);
      const message = `${bits.join(' · ')}.`;
      addChat('assistant', message);
      showAssignmentToast(message);
    }
    return results;
  }

  async function handleAssistant(text) {
    addChat('user', escapeHtml(text));
    const knowledgePacks = getActionPackCatalog();
    const routed = await getRoutedAssistantLoadout(text, { loadout: getAssistantLoadout(), knowledgePacks });
    const assistantLoadoutForRequest = routed.loadout;
    const semanticRoute = routed.route;
    if (dom.llmMode.value === 'ollama' || dom.llmMode.value === 'tabbyapi') {
      const { provider, endpoint, model } = getCurrentLocalAiConfig();
      const parsed = provider === 'tabbyapi'
        ? await parseWithOpenAiCompatible(text, game, { endpoint, model, providerLabel: LOCAL_AI_PROVIDERS.tabbyapi.backendLabel, enableTemplates: getTemplateRoutingEnabled(), loadout: assistantLoadoutForRequest, knowledgePacks })
        : await parseWithOllama(text, game, { endpoint, model, enableTemplates: getTemplateRoutingEnabled(), loadout: assistantLoadoutForRequest, knowledgePacks });
      const { debug, ...parsedForLog } = parsed;
      logChatAi({ mode: provider === 'tabbyapi' ? LOCAL_AI_PROVIDERS.tabbyapi.backendLabel : 'ollama', sent: debug?.sent || { endpoint, model, text, loadout: assistantLoadoutForRequest, semanticRoute }, returned: debug?.returned || parsedForLog });
      return handleParsed(parsed);
    } else {
      const parsed = parseAssistantRequest(text, game, { enableTemplates: getTemplateRoutingEnabled(), loadout: assistantLoadoutForRequest, knowledgePacks });
      logChatAi({ mode: 'mock parser', sent: { text, enableTemplates: getTemplateRoutingEnabled(), loadout: assistantLoadoutForRequest, semanticRoute }, returned: parsed });
      return handleParsed(parsed);
    }
  }

  async function handleManagerMessage(managerRef, message, { source = 'manual', sender = null } = {}) {
    const manager = typeof managerRef === 'object' ? managerRef : game.resolveBotReference(managerRef);
    if (!manager) return { ok: false, error: `Manager ${managerRef} not found` };
    if (!game.isManagerBot?.(manager)) return { ok: false, error: `${game.botDisplayName(manager)} is not a manager` };
    const clean = game.sanitizeManagerMessage?.(message) || String(message || '').trim();
    if (!clean) return { ok: false, error: 'Manager message is empty' };
    const loadout = game.normalizeManagerKnowledgePacks(manager.managerKnowledgePacks || manager.knowledgePacks || [], ['starter_automation']);
    const routed = await getRoutedAssistantLoadout(clean, { loadout, knowledgePacks: getActionPackCatalog() });
    const managerLoadoutForRequest = routed.loadout;
    const semanticRoute = routed.route;
    const managerText = `Manager ${game.botDisplayName(manager)} (${manager.ref}, status manager) received a delegation from ${sender ? game.botDisplayName(sender) : source}: ${clean}`;
    addChat('user', `<b>${escapeHtml(game.botDisplayName(manager))} manager:</b> ${escapeHtml(clean)}`);
    let parsed;
    if (dom.llmMode.value === 'ollama' || dom.llmMode.value === 'tabbyapi') {
      const { provider, endpoint, model } = getCurrentLocalAiConfig();
      parsed = provider === 'tabbyapi'
        ? await parseWithOpenAiCompatible(managerText, game, { endpoint, model, providerLabel: `${LOCAL_AI_PROVIDERS.tabbyapi.backendLabel} manager`, enableTemplates: getTemplateRoutingEnabled(), loadout: managerLoadoutForRequest, knowledgePacks: getActionPackCatalog() })
        : await parseWithOllama(managerText, game, { endpoint, model, enableTemplates: getTemplateRoutingEnabled(), loadout: managerLoadoutForRequest, knowledgePacks: getActionPackCatalog() });
      const { debug, ...parsedForLog } = parsed;
      logChatAi({ mode: provider === 'tabbyapi' ? `${LOCAL_AI_PROVIDERS.tabbyapi.backendLabel} manager` : 'ollama manager', sent: debug?.sent || { endpoint, model, text: managerText, loadout: managerLoadoutForRequest, semanticRoute }, returned: debug?.returned || parsedForLog });
    } else {
      parsed = parseAssistantRequest(managerText, game, { enableTemplates: getTemplateRoutingEnabled(), loadout: managerLoadoutForRequest, knowledgePacks: getActionPackCatalog() });
      logChatAi({ mode: 'mock manager parser', sent: { text: managerText, loadout: managerLoadoutForRequest, managerBotId: manager.id, semanticRoute }, returned: parsed });
    }
    const results = handleParsed(parsed);
    manager.lastManagerMessage = { text: clean, source, at: Date.now(), loadout: managerLoadoutForRequest };
    return { ok: true, managerId: manager.id, loadout: managerLoadoutForRequest, parsed, results };
  }

  function setRadioWidgetOpen(open) {
    if (!dom.radioWidgetPanel || !dom.radioWidgetToggle) return;
    dom.radioWidgetPanel.hidden = !open;
    dom.radioWidgetToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    dom.widgetRoster?.classList.toggle('has-open-widget', open);
    dom.widgetRosterHandle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setWidgetRosterOpen(true);
  }

  function setWidgetRosterOpen(open) {
    dom.widgetRoster?.classList.toggle('is-roster-open', !!open);
    dom.widgetRosterHandle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function syncAudioUi(message = '') {
    if (dom.audioSfxToggle) dom.audioSfxToggle.checked = audio.state.enabled;
    if (dom.audioSfxVolume) dom.audioSfxVolume.value = String(audio.state.sfxVolume);
    if (dom.audioMusicVolume) dom.audioMusicVolume.value = String(audio.state.musicVolume);
    if (dom.radioStationButtons) {
      dom.radioStationButtons.querySelectorAll('[data-radio-station]').forEach(button => {
        const selected = button.dataset.radioStation === audio.state.station;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }
    if (dom.audioMusicStatus) {
      const station = audio.stations[audio.state.station];
      const playing = audio.isMusicPlaying();
      dom.audioMusicStatus.textContent = message || `${playing ? 'Playing' : 'Selected'} ${station?.label || audio.state.station}. ${playing ? '' : 'Press Play to start.'}`;
    }
  }

  function initAudioUi() {
    if (dom.radioStationButtons) {
      dom.radioStationButtons.innerHTML = Object.entries(audio.stations).map(([id, station]) => `
        <button type="button" class="radio-station-button" data-radio-station="${escapeHtml(id)}" aria-pressed="false">
          <b>${escapeHtml(station.label)}</b>
          <small>${escapeHtml(station.vibe || station.source || '')}</small>
        </button>
      `).join('');
    }
    syncAudioUi();
    dom.audioSfxToggle?.addEventListener('change', () => syncAudioUi(audio.setSfxEnabled(dom.audioSfxToggle.checked) ? 'Sound effects enabled.' : 'Sound effects muted.'));
    dom.audioSfxVolume?.addEventListener('input', () => { audio.setSfxVolume(dom.audioSfxVolume.value); syncAudioUi(); });
    dom.audioSfxTest?.addEventListener('click', () => { audio.play('craft_done', { cooldownKey: 'ui_test', minGapMs: 0 }); syncAudioUi('Played generated test chime.'); });
    const openWidgetRoster = event => {
      event?.preventDefault?.();
      setWidgetRosterOpen(true);
    };
    dom.widgetRosterHandle?.addEventListener('pointerenter', openWidgetRoster);
    dom.widgetRosterHandle?.addEventListener('pointerdown', openWidgetRoster);
    dom.widgetRosterHandle?.addEventListener('click', openWidgetRoster);
    dom.widgetRoster?.addEventListener('pointerenter', () => setWidgetRosterOpen(true));
    dom.radioWidgetToggle?.addEventListener('mouseenter', () => audio.play('ui_hover', { cooldownKey: 'radio:hover-toggle', minGapMs: 140 }));
    dom.radioWidgetToggle?.addEventListener('click', () => { audio.play('ui_click', { cooldownKey: 'radio:toggle', minGapMs: 0 }); setRadioWidgetOpen(dom.radioWidgetPanel?.hidden !== false); });
    dom.widgetRoster?.addEventListener('mouseleave', () => { if (dom.radioWidgetPanel?.hidden) { setWidgetRosterOpen(false); audio.play('ui_hover', { cooldownKey: 'radio:hover-roster', minGapMs: 260 }); } });
    dom.radioStationButtons?.addEventListener('mouseover', e => { if (e.target.closest('[data-radio-station]')) audio.play('ui_hover', { cooldownKey: 'radio:hover-station', minGapMs: 120 }); });
    dom.radioStationButtons?.addEventListener('click', async e => {
      const button = e.target.closest('[data-radio-station]');
      if (!button) return;
      audio.play('switch', { cooldownKey: 'radio:station', minGapMs: 0 });
      const station = audio.setMusicStation(button.dataset.radioStation);
      syncAudioUi(`Selected ${station.label}.`);
      if (audio.isMusicPlaying()) {
        try {
          const started = await audio.startMusic(button.dataset.radioStation);
          syncAudioUi(`Playing ${started.label}. Low-bandwidth AAC stream.`);
        } catch (err) {
          syncAudioUi(`Could not switch radio: ${err.message}`);
        }
      }
    });
    dom.audioMusicVolume?.addEventListener('input', () => { audio.setMusicVolume(dom.audioMusicVolume.value); syncAudioUi(); });
    dom.audioMusicStart?.addEventListener('mouseenter', () => audio.play('ui_hover', { cooldownKey: 'radio:hover-play', minGapMs: 120 }));
    dom.audioMusicStop?.addEventListener('mouseenter', () => audio.play('ui_hover', { cooldownKey: 'radio:hover-stop', minGapMs: 120 }));
    dom.audioMusicStart?.addEventListener('click', async () => {
      audio.play('ui_click', { cooldownKey: 'radio:play', minGapMs: 0 });
      try {
        const station = await audio.startMusic(audio.state.station);
        syncAudioUi(`Playing ${station.label}. Low-bandwidth AAC stream.`);
      } catch (err) {
        syncAudioUi(`Could not start radio: ${err.message}`);
      }
    });
    dom.audioMusicStop?.addEventListener('click', () => { audio.play('ui_click', { cooldownKey: 'radio:stop', minGapMs: 0 }); audio.stopMusic(); syncAudioUi('Cozy radio stopped.'); });
    audio.state.music.addEventListener('waiting', () => syncAudioUi('Radio buffering… trying to keep the stream warm.'));
    audio.state.music.addEventListener('playing', () => syncAudioUi());
    audio.state.music.addEventListener('stalled', () => syncAudioUi('Radio stream stalled. Try another low-bandwidth station.'));
    audio.state.music.addEventListener('error', () => syncAudioUi('Radio stream error. Pick another station or press Play again.'));
  }

  for (const id of PROGRAMS) { const o = document.createElement('option'); o.value = id; o.textContent = id; dom.programSelect.appendChild(o); }
  const renderProgram = () => dom.programView.textContent = JSON.stringify(PROGRAM_TEMPLATES[dom.programSelect.value], null, 2);
  dom.programSelect.addEventListener('change', renderProgram); renderProgram();
  if (dom.dslWikiView) dom.dslWikiView.textContent = formatDslActionWiki();
  renderKnowledgePackSelector();
  updateSemanticRouterUi(semanticRouter.getLastRoute?.());
  renderActionStepChainTable();
  game.syncTemplateDrawerUi?.();
  initAudioUi();
  initMobileControls();
  if (isMobileControlsDevice()) setChatOpen(false);
  initMainMenuAudiovisuals();

  dom.templateDrawerToggle?.addEventListener('click', toggleTemplateDrawer);
  dom.templateSaveForm?.addEventListener('submit', e => {
    e.preventDefault();
    const res = game.saveRecordedLoopAsTemplate(dom.templateName?.value || '');
    if (dom.templateStatus) dom.templateStatus.textContent = res.ok ? `Saved template ${res.template.name}.` : res.error;
    if (res.ok && dom.templateName) dom.templateName.value = '';
  });
  dom.templateList?.addEventListener('click', e => {
    const assign = e.target.closest('[data-assign-template]');
    const del = e.target.closest('[data-delete-template]');
    if (assign) {
      const id = assign.dataset.assignTemplate;
      const botInput = dom.templateList.querySelector(`[data-template-bot-id="${CSS.escape(id)}"]`);
      const res = game.assignTemplateToBot(botInput?.value || 1, id);
      if (dom.templateStatus) dom.templateStatus.textContent = res.ok ? `Assigned ${res.template.name} to ${game.botDisplayName?.(res.bot) || `Bot ${res.bot.id}`}.` : res.error;
    }
    if (del) {
      const res = game.deleteCustomTemplate(del.dataset.deleteTemplate);
      if (dom.templateStatus) dom.templateStatus.textContent = res.ok ? `Deleted template ${res.template.name}.` : res.error;
    }
  });
  dom.buildPanel.addEventListener('click', e => {
    const tab = e.target.closest('[data-build-tab]');
    if (tab) { setBuildTab(tab.dataset.buildTab); return; }
    const b = e.target.closest('[data-build]');
    if (b) { game.setPlacement(b.dataset.build); setBuildDrawerOpen(false); return; }
    if (e.target.closest('[data-cancel-build]')) { game.cancelPlacement(); setBuildDrawerOpen(false); }
  });
  dom.teachCloseBtn?.addEventListener('click', () => game.closeTeachPanel());
  dom.teachRecordBtn?.addEventListener('click', () => { const botId = Number(dom.teachBotId?.value || game.recorder.targetBotId || 1); game.recorder.recording ? game.stopTeachRecording() : game.startTeachRecording(botId); });
  dom.teachAssignBtn?.addEventListener('click', () => {
    const botId = Number(dom.teachBotId?.value || 1);
    const res = game.assignRecordedLoopToBot(botId);
    if (res.ok) showAssignmentToast(`Assigned recorded loop to <b>Bot ${botId}</b>.`);
    else if (dom.teachStatus) dom.teachStatus.textContent = res.error;
  });
  dom.targetFps.addEventListener('input', () => {
    game.targetFps = Number(dom.targetFps.value);
    setPerformanceProfileValue('custom');
    syncPerformanceUi('Saved a custom performance profile to this browser.');
    saveBrowserSettings();
  });
  dom.maxBots.addEventListener('input', () => {
    game.maxBots = clampBotLimit(dom.maxBots.value);
    dom.maxBots.value = String(game.maxBots);
    setPerformanceProfileValue('custom');
    syncPerformanceUi('Saved a custom performance profile to this browser.');
    saveBrowserSettings();
  });
  dom.fogOfWarToggle?.addEventListener('change', () => {
    game.fogOfWar.enabled = getFogOfWarEnabled();
    game._lastFogSignature = '';
    syncPerformanceUi(game.fogOfWar.enabled ? 'Fog of war enabled.' : 'Fog of war disabled for maximum performance.');
    saveBrowserSettings();
  });
  dom.lightingEffects?.addEventListener('change', () => {
    game.lightingEffectsEnabled = getLightingEffectsEnabled();
    syncPerformanceUi(game.lightingEffectsEnabled ? 'Lighting effects enabled.' : 'Lighting effects disabled for smoother performance.');
    saveBrowserSettings();
  });
  dom.dynamicShadows?.addEventListener('change', () => {
    game.dynamicShadowsEnabled = getDynamicShadowsEnabled();
    syncPerformanceUi(game.dynamicShadowsEnabled ? 'Dynamic light shadows enabled. Disable for better performance.' : 'Dynamic light shadows disabled for smoother performance.');
    saveBrowserSettings();
  });
  dom.showFpsOverlay?.addEventListener('change', () => {
    game.showFpsOverlay = getShowFpsOverlayEnabled();
    syncPerformanceUi(game.showFpsOverlay ? 'FPS meter visible in the top-right HUD.' : 'FPS meter hidden.');
    saveBrowserSettings();
  });
  dom.useCanvas2dRenderer?.addEventListener('change', () => {
    const mode = getRendererModeFromUi();
    syncPerformanceUi(mode === 'canvas2d' ? 'Canvas 2D renderer selected. Reload the page to switch from Pixi.' : 'Pixi renderer selected. Reload the page to switch from Canvas 2D.');
    saveBrowserSettings();
  });
  dom.pixiHighResolution?.addEventListener('change', () => {
    applyRendererSettings(getRendererSettingsFromUi(), {
      save: true,
      message: dom.pixiHighResolution.checked ? 'High-resolution Pixi output enabled.' : 'High-resolution Pixi output disabled for lower GPU cost.'
    });
  });
  dom.pixiAntialias?.addEventListener('change', () => {
    applyRendererSettings(getRendererSettingsFromUi(), {
      save: true,
      message: dom.pixiAntialias.checked ? 'Pixi antialiasing enabled.' : 'Pixi antialiasing disabled for lower GPU cost.'
    });
  });
  dom.performanceProfile?.addEventListener('change', () => {
    const selected = dom.performanceProfile.value;
    if (selected === 'custom') {
      syncPerformanceUi('Custom profile selected. Adjust the sliders to save exact values.');
      saveBrowserSettings();
      return;
    }
    applyPerformancePreset(selected, { save: true });
  });
  dom.applyAutoPerformance?.addEventListener('click', () => applyPerformancePreset('auto', { save: true }));
  dom.refreshModels.addEventListener('click', async () => { try { await refreshLocalAiModels({ provider: getSelectedProvider(), endpointInput: dom.ollamaEndpoint, modelSelect: dom.ollamaModel, statusEl: dom.ollamaStatus }); updateAssistantPromptPreview(); saveBrowserSettings(); } catch (e) { dom.ollamaStatus.textContent = `Could not load models: ${e.message}`; } });
  dom.llmMode.addEventListener('change', () => {
    const provider = getSelectedProvider();
    const defaults = getDefaultProviderConfig(provider);
    if (provider === 'tabbyapi') {
      dom.ollamaEndpoint.value = LOCAL_AI_PROVIDERS.tabbyapi.baseUrl;
      dom.ollamaModel.value = LOCAL_AI_PROVIDERS.tabbyapi.defaultModel;
    } else {
      if (!dom.ollamaEndpoint.value || dom.ollamaEndpoint.value === LOCAL_AI_PROVIDERS.tabbyapi.baseUrl) dom.ollamaEndpoint.value = defaults.endpoint;
      if (!dom.ollamaModel.value || dom.ollamaModel.value === LOCAL_AI_PROVIDERS.tabbyapi.defaultModel) dom.ollamaModel.value = defaults.model;
    }
    syncProviderUi();
    updateAssistantPromptPreview();
    saveBrowserSettings();
  });
  dom.ollamaEndpoint.addEventListener('input', () => { syncProviderUi(); updateAssistantPromptPreview(); saveBrowserSettings(); });
  dom.ollamaModel?.addEventListener('change', () => { updateAssistantPromptPreview(); saveBrowserSettings(); });
  dom.chatInput?.addEventListener('input', () => { updateAssistantPromptPreview(); scheduleSemanticRoutePreview(); });
  dom.asrMode?.addEventListener('change', () => { storageSet(ASR_MODE_KEY, getAsrMode()); syncAsrModeUi(); saveBrowserSettings(); });
  dom.browserSttModel?.addEventListener('change', () => {
    browserStt.setSelectedModel(dom.browserSttModel.value);
    syncBrowserSttUi();
    saveBrowserSettings();
  });
  dom.browserSttDownloadBtn?.addEventListener('click', async () => {
    try {
      browserStt.setSelectedModel(dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL);
      syncBrowserSttUi('Loading browser STT model...');
      await browserStt.loadModel(dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL, { backend: 'auto' });
      syncBrowserSttUi();
      saveBrowserSettings();
    } catch (e) {
      syncBrowserSttUi(`Could not load browser STT model: ${e.message}`);
    }
  });
  dom.browserSttUnloadBtn?.addEventListener('click', () => {
    browserStt.unload(dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL);
    syncBrowserSttUi();
    saveBrowserSettings();
  });
  dom.templateRouting?.addEventListener('change', () => { storageSet(TEMPLATE_ROUTING_KEY, String(getTemplateRoutingEnabled())); updateAssistantPromptPreview(); saveBrowserSettings(); });
  dom.semanticRouting?.addEventListener('change', () => { storageSet(SEMANTIC_ROUTING_KEY, String(getSemanticRoutingEnabled())); updateSemanticRouterUi(semanticRouter.getLastRoute?.()); updateAssistantPromptPreview(); scheduleSemanticRoutePreview(); saveBrowserSettings(); });
  dom.semanticRouterPackSelect?.addEventListener('change', () => updateSemanticRouterUi(semanticRouter.getLastRoute?.()));
  dom.semanticRouterTrainBtn?.addEventListener('click', async () => {
    const text = getChatDraftText();
    const packId = dom.semanticRouterPackSelect?.value || semanticRouter.getLastRoute?.()?.bestId || assistantLoadout[0];
    if (!text) {
      if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = 'Type a request in chat before training the semantic router.';
      return;
    }
    if (!packId) {
      if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = 'No pack is available to train.';
      return;
    }
    try {
      const result = await semanticRouter.train(text, packId, { knowledgePacks: getActionPackCatalog(), loadout: getAssistantLoadout() });
      updateSemanticRouterUi(semanticRouter.getLastRoute?.());
      updateAssistantPromptPreview();
      if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = `Trained "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}" into ${result.packName}.`;
    } catch (error) {
      if (dom.semanticRouterStatus) dom.semanticRouterStatus.textContent = `Semantic router training failed: ${error.message}`;
    }
  });
  dom.customPackActionList?.addEventListener('change', e => {
    if (!e.target.matches('[data-action-pack-op]')) return;
    customPackAliasDraft = readCustomPackAliasEditor();
    const selectedOps = [...dom.customPackActionList.querySelectorAll('[data-action-pack-op]:checked')].map(input => input.dataset.actionPackOp);
    customPackAliasDraft = defaultPackActionAliases(selectedOps, customPackAliasDraft);
    renderCustomPackAliasEditor(selectedOps, customPackAliasDraft);
  });
  dom.customPackAliasEditor?.addEventListener('input', () => {
    customPackAliasDraft = readCustomPackAliasEditor();
  });
  dom.knowledgePackList?.addEventListener('change', e => {
    if (!e.target.matches('[data-knowledge-pack]')) return;
    const ids = [...dom.knowledgePackList.querySelectorAll('[data-knowledge-pack]:checked')].map(input => input.dataset.knowledgePack);
    persistAssistantLoadout(ids);
  });
  dom.knowledgePackList?.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit-custom-pack]');
    if (edit) {
      const pack = customActionPacks[edit.dataset.editCustomPack];
      if (pack) clearCustomPackForm(pack);
      return;
    }
    const del = e.target.closest('[data-delete-custom-pack]');
    if (del) deleteCustomActionPack(del.dataset.deleteCustomPack);
  });
  dom.saveCustomPack?.addEventListener('click', () => {
    try {
      const pack = upsertCustomActionPack(readCustomPackForm());
      if (!assistantLoadout.includes(pack.id)) persistAssistantLoadout([...assistantLoadout, pack.id]);
      clearCustomPackForm(pack);
    } catch (err) {
      if (dom.knowledgePackStatus) dom.knowledgePackStatus.textContent = err.message;
    }
  });
  dom.clearCustomPackForm?.addEventListener('click', () => clearCustomPackForm());
  dom.resetKnowledgePacks?.addEventListener('click', () => persistAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT));
  dom.serverOllamaBtn?.addEventListener('click', () => {
    const serverProxy = location.hostname === 'docs.pau1.cloud' ? '/ollama-proxy' : 'https://docs.pau1.cloud/ollama-proxy';
    setLocalAiProvider('ollama', { endpoint: serverProxy, status: 'Server proxy selected. Click Refresh to load VPS Ollama models.' });
  });
  dom.fullscreenToggleBtn?.addEventListener('click', () => { toggleFullscreen(); });
  document.addEventListener('fullscreenchange', () => syncFullscreenUi());
  document.addEventListener('webkitfullscreenchange', () => syncFullscreenUi());
  dom.localOllamaBtn?.addEventListener('click', () => {
    setLocalAiProvider('ollama', { endpoint: 'http://127.0.0.1:11434', status: 'Local Ollama selected. Start Ollama on your machine with CORS for https://docs.pau1.cloud, then click Refresh.' });
  });
  dom.localTabbyBtn?.addEventListener('click', () => {
    setLocalAiProvider('tabbyapi', { endpoint: LOCAL_AI_PROVIDERS.tabbyapi.baseUrl, model: LOCAL_AI_PROVIDERS.tabbyapi.defaultModel, status: 'Local TabbyAPI selected. Requests go to the OpenAI-compatible /v1/chat/completions endpoint.' });
  });
  dom.benchmarkBtn.addEventListener('click', async () => {
    const { provider, endpoint, model } = getCurrentLocalAiConfig();
    const started = performance.now();
    try {
      const benchmarkRoute = await getRoutedAssistantLoadout('Bot 1 chop wood', { loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
      const parsed = provider === 'tabbyapi'
        ? await parseWithOpenAiCompatible('Bot 1 chop wood', game, { endpoint, model, providerLabel: LOCAL_AI_PROVIDERS.tabbyapi.backendLabel, enableTemplates: getTemplateRoutingEnabled(), loadout: benchmarkRoute.loadout, knowledgePacks: getActionPackCatalog() })
        : await parseWithOllama('Bot 1 chop wood', game, { endpoint, model, enableTemplates: getTemplateRoutingEnabled(), loadout: benchmarkRoute.loadout, knowledgePacks: getActionPackCatalog() });
      dom.ollamaStatus.textContent = `${parsed.meta || 'Benchmark'} valid calls=${parsed.calls?.length || 0}, total=${Math.round(performance.now()-started)}ms`;
    } catch (e) {
      dom.ollamaStatus.textContent = `Benchmark failed: ${e.message}`;
    }
  });
  if (!dom.ollamaEndpoint.value) dom.ollamaEndpoint.value = defaultOllamaEndpoint();
  syncProviderUi();
  syncFullscreenUi();
  updateAssistantPromptPreview();
  dom.settingsClose.addEventListener('click', () => setSettingsOpen(false));
  dom.openSettingsTabBtn?.addEventListener('click', () => setSettingsView('tabs'));
  dom.resumeGameBtn?.addEventListener('click', () => setSettingsOpen(false));
  dom.pauseGameBtn?.addEventListener('click', () => { if (!game.multiplayer?.enabled) { game.setPaused(true); syncSaveUi('Game paused.'); } });
  dom.saveGameBtn?.addEventListener('click', () => saveGameToCache());
  dom.loadGameBtn?.addEventListener('click', () => loadGameFromCache());
  dom.saveSlotSelect?.addEventListener('change', () => {
    if (dom.saveSlotSelectLoad) dom.saveSlotSelectLoad.value = dom.saveSlotSelect.value;
    if (dom.saveSlotName) dom.saveSlotName.value = '';
    renderSaveManagerUi();
  });
  dom.saveSlotSelectLoad?.addEventListener('change', () => {
    if (dom.saveSlotSelect) dom.saveSlotSelect.value = dom.saveSlotSelectLoad.value;
    if (dom.saveSlotName) dom.saveSlotName.value = '';
    renderSaveManagerUi();
  });
  document.querySelectorAll('[data-save-flow-mode]').forEach(button => {
    button.addEventListener('click', () => setSaveLoadMode(button.dataset.saveFlowMode));
  });
  syncSettingsViewUi();
  syncSaveLoadModeUi();
  dom.saveEntrySelect?.addEventListener('change', () => renderSaveManagerUi());
  dom.renameSlotBtn?.addEventListener('click', () => {
    const ok = saveGames.renameSlot(currentSaveMode(), dom.saveSlotSelect?.value || '', dom.saveSlotName?.value || '');
    syncSaveUi(ok ? 'Save slot renamed.' : 'Choose a slot and type a new slot name first.');
  });
  dom.deleteSlotBtn?.addEventListener('click', () => {
    const ok = saveGames.deleteSlot(currentSaveMode(), dom.saveSlotSelect?.value || '');
    if (dom.saveSlotName) dom.saveSlotName.value = '';
    syncSaveUi(ok ? 'Save slot deleted.' : 'Choose a slot to delete.');
  });
  dom.renameSaveBtn?.addEventListener('click', () => {
    const ok = saveGames.renameSave(currentSaveMode(), dom.saveSlotSelectLoad?.value || dom.saveSlotSelect?.value || '', dom.saveEntrySelect?.value || '', dom.saveNameLoad?.value || dom.saveName?.value || '');
    if (dom.saveName) dom.saveName.value = '';
    if (dom.saveNameLoad) dom.saveNameLoad.value = '';
    syncSaveUi(ok ? 'Savegame renamed.' : 'Choose a savegame and type a new save name first.');
  });
  dom.deleteSaveBtn?.addEventListener('click', () => {
    const ok = saveGames.deleteSave(currentSaveMode(), dom.saveSlotSelect?.value || '', dom.saveEntrySelect?.value || '');
    syncSaveUi(ok ? 'Savegame deleted.' : 'Choose a savegame to delete.');
  });
  dom.deleteOldSavesBtn?.addEventListener('click', () => {
    const removed = saveGames.deleteOldSaves(currentSaveMode(), dom.saveSlotSelect?.value || '', dom.deleteKeepCount?.value || 1);
    syncSaveUi(`Deleted ${removed} old savegame${removed === 1 ? '' : 's'} from this slot.`);
  });
  dom.quitToMainMenuBtn?.addEventListener('click', () => quitToMainMenu());
  dom.saveAndQuitBtn?.addEventListener('click', () => quitToMainMenu({ saveFirst: true }));
  dom.quitWithoutSaveBtn?.addEventListener('click', () => quitToMainMenu({ force: true }));
  dom.cancelQuitBtn?.addEventListener('click', () => { setQuitSavePromptOpen(false); syncSaveUi('Quit cancelled.'); });
  dom.mainMenuCampaignBtn?.addEventListener('click', () => setMainMenuLayer('mode-actions', 'campaign'));
  dom.mainMenuNewBtn?.addEventListener('click', () => setMainMenuLayer('mode-actions', 'test'));
  dom.mainMenuLocalAiBtn?.addEventListener('click', () => setMainMenuLayer('mode-actions', 'local_ai'));
  dom.mainMenuHostBtn?.addEventListener('click', () => setMainMenuLayer('online-actions', 'online_lakes'));
  dom.mainMenuStartSelectedBtn?.addEventListener('click', () => startNewGameFromMenu(selectedMainMenuMode));
  dom.mainMenuLoadBtn?.addEventListener('click', () => loadGameFromCache({ mode: selectedMainMenuMode, slotId: '', saveId: '' }));
  dom.mainMenuBackBtn?.addEventListener('click', () => setMainMenuLayer('modes'));
  dom.mainMenuOnlineHostBtn?.addEventListener('click', () => setMainMenuLayer('host-actions', 'online_lakes'));
  dom.mainMenuOnlineBackBtn?.addEventListener('click', () => setMainMenuLayer('modes'));
  dom.mainMenuHostNewBtn?.addEventListener('click', () => hostFromMainMenu({ loadSave: false }));
  dom.mainMenuHostLoadBtn?.addEventListener('click', () => hostFromMainMenu({ loadSave: true }));
  dom.mainMenuHostBackBtn?.addEventListener('click', () => setMainMenuLayer('online-actions', 'online_lakes'));
  dom.mainMenuJoinBtn?.addEventListener('click', () => joinFromMainMenu());
  dom.campaignIntroNextBtn?.addEventListener('click', advanceCampaignIntro);
  dom.campaignIntroSkipBtn?.addEventListener('click', () => finishCampaignIntro('skip'));
  dom.settingsOverlay.addEventListener('click', e => { if (e.target === dom.settingsOverlay) setSettingsOpen(false); });
  document.querySelector('.settings-tabs')?.addEventListener('click', e => { const tab = e.target.closest('[data-settings-tab]'); if (tab) setSettingsTab(tab.dataset.settingsTab); });
  dom.chatToggle.addEventListener('click', toggleChat);
  dom.chatCollapse.addEventListener('click', () => setChatOpen(false));
  dom.botDrawerToggle?.addEventListener('click', toggleBotDrawer);
  dom.buildDrawerToggle?.addEventListener('click', toggleBuildDrawer);
  dom.zonesDrawerToggle?.addEventListener('click', toggleZonesDrawer);
  dom.multiplayerDrawerToggle?.addEventListener('click', toggleMultiplayerDrawer);
  dom.drawZoneButton.addEventListener('click', beginDrawZone);
  dom.drawZoneDrawerButton?.addEventListener('click', beginDrawZone);
  setSettingsTab('controls');
  setBuildTab('production');
  saveBrowserSettings();

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (campaignIntroActive) {
      if (k === 'escape') { e.preventDefault(); finishCampaignIntro('skip'); return; }
      if (k === 'enter' || k === ' ' || k === 'spacebar') { e.preventDefault(); advanceCampaignIntro(); return; }
    }
    if (game.campaignArrival?.active) {
      e.preventDefault();
      return;
    }
    if (k === 'escape') {
      e.preventDefault();
      if (closeOpenUiPanels()) return;
      setSettingsOpen(true);
      return;
    }
    if (k === 'enter' && !chat.isTypingTarget(e.target) && dom.settingsOverlay.hidden) { e.preventDefault(); if (!isChatOpen()) { setBuildDrawerOpen(false); setZonesDrawerOpen(false); game.hideMenus(); setChatOpen(true); } else dom.chatInput.focus(); return; }
    if ((k === 'l') && !chat.isTypingTarget(e.target)) { e.preventDefault(); toggleChat(); return; }
    if ((k === 'b') && !chat.isTypingTarget(e.target)) { e.preventDefault(); toggleBuildDrawer(); return; }
    if (chat.isTypingTarget(e.target) || !dom.settingsOverlay.hidden) return;
    if (k === 'q') { e.preventDefault(); if (!e.repeat) game.manualDropItem(); return; }
    if (k === 'f') { e.preventDefault(); if (!e.repeat) game.switchWeaponSet(); return; }
    if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','e','f','shift'].includes(k)) e.preventDefault();
    game.keys.add(k);
    if (k === 'e' && !e.repeat) game.interact();
  });
  window.addEventListener('keyup', e => { if (!chat.isTypingTarget(e.target)) game.keys.delete(e.key.toLowerCase()); });
  window.addEventListener('click', e => { if (!e.target.closest('.entity-menu') && e.target !== dom.canvas) game.hideMenus(); });

  window.multiplayerDebug = multiplayer;
  window.assignBotProgram = args => game.assignBotProgram(args);
  window.assignCustomDslProgram = args => game.assignCustomDslProgram(args);
  window.programTemplates = PROGRAM_TEMPLATES;
  Object.defineProperty(window, 'assistantKnowledgePacks', { get: () => getActionPackCatalog(), configurable: true });
  Object.defineProperty(window, 'actionPackCatalog', { get: () => getActionPackCatalog(), configurable: true });
  Object.defineProperty(window, 'assistantLoadout', { get: () => getAssistantLoadout(), configurable: true });
  window.getAssistantLoadout = getAssistantLoadout;
  window.getAssistantLoadoutDebug = getAssistantLoadoutDebug;
  window.getAssistantLoadoutText = () => JSON.stringify(getAssistantLoadoutDebug(), null, 2);
  window.getAssistantPromptPreview = updateAssistantPromptPreview;
  window.setAssistantLoadout = ids => persistAssistantLoadout(ids);
  window.semanticRouterDebug = {
    getState: () => semanticRouter.getStatus(),
    getLastRoute: () => semanticRouter.getLastRoute?.(),
    route: (text, options = {}) => semanticRouter.route(text, { knowledgePacks: options.knowledgePacks || getActionPackCatalog(), loadout: options.loadout || getAssistantLoadout() }),
    train: (text, packId, options = {}) => semanticRouter.train(text, packId, { knowledgePacks: options.knowledgePacks || getActionPackCatalog(), loadout: options.loadout || getAssistantLoadout() }),
    syncCatalog: () => semanticRouter.syncCatalog(getActionPackCatalog(), getAssistantLoadout())
  };
  window.getCustomActionPacks = () => JSON.parse(JSON.stringify(customActionPacks));
  window.createCustomActionPack = pack => upsertCustomActionPack(pack);
  window.updateCustomActionPack = (id, patch = {}) => upsertCustomActionPack({ ...(customActionPacks[id] || {}), ...patch, id });
  window.deleteCustomActionPack = deleteCustomActionPack;
  window.clearCustomActionPacks = () => { customActionPacks = {}; persistCustomActionPacks('Cleared custom action packs.'); return {}; };
  window.getActionPackCatalog = getActionPackCatalog;
  window.renderKnowledgePackSelector = renderKnowledgePackSelector;
  window.generateAssistantDsl = (text, options = {}) => parseAssistantRequest(text, game, { enableTemplates: options.enableTemplates ?? true, loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
  window.dslActionWiki = DSL_ACTION_WIKI;
  window.dslActionWikiText = formatDslActionWiki();
  window.actionStepChainRows = getActionStepChainRows();
  window.allowedProgramOps = ALLOWED_OPS.slice();
  window.validateDslProgram = p => game.validateDslProgram(p);
  window.sendManagerMessage = (botId, message, options = {}) => handleManagerMessage(botId, message, options);
  window.managerDebug = {
    promote: (botId, packs = getAssistantLoadout()) => game.promoteBotToManager(botId, packs),
    getPacks: botId => (game.resolveBotReference(botId)?.managerKnowledgePacks || []).slice(),
    setPacks: (botId, packs) => game.setManagerKnowledgePacks(botId, packs),
    sendMessage: (botId, message, options = {}) => handleManagerMessage(botId, message, options),
    log: () => JSON.parse(JSON.stringify(game.managerMessageLog || []))
  };
  window.getGameState = () => game.getState();
  window.gameMenuDebug = { save: saveGameToCache, load: loadGameFromCache, saveLibrary: () => saveGames.snapshot(), selectMenuMode: mode => setMainMenuLayer(normalizeGameMode(mode) === 'online_lakes' ? 'online-actions' : 'mode-actions', mode), startCampaign: startCampaignFromMenu, startTest: () => startNewGameFromMenu('test'), startNew: startNewGameFromMenu, openMainMenu: () => setMainMenuOpen(true), closeMainMenu: () => setMainMenuOpen(false), quitToMainMenu, showQuitSavePrompt: () => setQuitSavePromptOpen(true), hideQuitSavePrompt: () => setQuitSavePromptOpen(false), hasSavedGame, wasSavedRecently, getLastSaveAgeMs, setLastSaveAgeSeconds: seconds => { lastSuccessfulSaveAt = Number.isFinite(Number(seconds)) ? Date.now() - (Number(seconds) * 1000) : 0; return getLastSaveAgeMs(); }, isPaused: () => !!game.paused, campaignIntroActive: () => campaignIntroActive, campaignIntroScene: () => ({ active: campaignIntroActive, index: campaignIntroSceneIndex, total: CAMPAIGN_INTRO_SCENES.length }), advanceCampaignIntro, skipCampaignIntro: () => finishCampaignIntro('skip') };
  window.getCameraState = () => ({ camera: { ...game.camera }, player: { x: game.player.x, y: game.player.y, target: game.player.target ? { ...game.player.target } : null, targetQueue: (game.player.targetQueue || []).map(target => ({ ...target })) }, map: { ...game.map } });
  window.getWorldObjects = () => game.getObjectRegistry();
  window.getHoverState = () => game.getHoverState();
  window.beginZoneDrawing = () => game.beginZoneDrawing();
  window.teachDebug = {
    start: botId => game.startTeachRecording(botId),
    stop: () => game.stopTeachRecording(),
    close: () => game.closeTeachPanel(),
    state: () => game.getRecorderState(),
    deleteStep: index => game.deleteTeachStep(index),
    moveStep: (index, delta) => game.moveTeachStep(index, delta),
    editStepLocation: (index, mode = 'select_zone') => game.beginTeachLocationEdit(index, mode),
    applyLocation: (x, y) => game.applyTeachLocationSelection(x, y),
    interact: () => game.interact(),
    recordStep: step => { game.recordTeachStep(step); return game.getRecorderState(); },
    assignToBot: botId => game.assignRecordedLoopToBot(botId),
    saveTemplate: name => game.saveRecordedLoopAsTemplate(name),
    assignTemplate: (botId, templateName) => game.assignTemplateToBot(botId, templateName),
    deleteTemplate: nameOrId => game.deleteCustomTemplate(nameOrId),
    pauseBot: botId => { const bot = game.findBot(botId); if (!bot) return null; bot.paused = true; return window.getGameState(); },
    openBotMenu: botId => { const bot = game.findBot(botId); if (!bot) return null; game.showBotMenu(bot, 320, 240, { refreshEdit: true }); return window.getGameState(); },
    openStructureMenu: structureId => { const s = game.structures.find(entry => entry.id === Number(structureId) || entry.ref === structureId); if (!s) return null; game.showStructureMenu(s, 320, 240); return window.getGameState(); },
    setBotName: (botId, name) => { game.setBotName(botId, name); return window.getGameState(); },
    promoteManager: (botId, packs = getAssistantLoadout()) => { game.promoteBotToManager(botId, packs); return window.getGameState(); },
    setManagerPacks: (botId, packs) => { game.setManagerKnowledgePacks(botId, packs); return window.getGameState(); },
    sendManagerMessage: (botId, message) => handleManagerMessage(botId, message),
    createBotTeam: (name, color) => game.createBotTeam(name, color),
    assignBotTeam: (botId, teamId) => { game.assignBotToTeam(botId, teamId); return window.getGameState(); },
    setBotInventory: (botId, type) => { const bot = game.findBot(botId); if (!bot) return null; bot.inventory = type ? { type, count: 1 } : null; return window.getGameState(); },
    setBotEquipment: (botId, type) => { const bot = game.findBot(botId); if (!bot) return null; if (type) game.equipActor(bot, type); else bot.equipment = null; return window.getGameState(); },
    movePlayerTo: (x, y) => { game.player.x = x; game.player.y = y; game.player.target = null; game.player.targetQueue = []; return window.getGameState(); },
    setInventory: type => { game.player.inventory = type ? { type, count: 1 } : null; return window.getGameState(); },
    equipPlayer: type => { if (type) game.equipActor(game.player, type); else game.player.equipment = null; return window.getGameState(); },
    spawnItem: (type, x, y, count = 1) => { game.spawnItem(type, x, y, count); return window.getGameState(); },
    switchWeapon: () => { game.switchWeaponSet(); return window.getGameState(); },
    placeStructure: (type, x, y) => game.addStructure(type, x, y, { placed: true }),
    startMultiplayer: (sessionId = 'test-session', playerId = 'p1') => game.startMultiplayerSession({ sessionId, role: playerId === 'p1' ? 'host' : 'client', playerId }),
    startLocalAi: (sessionId = 'local-ai-test') => game.startLocalAiMatch({ sessionId }),
    attackThrone: structureId => game.damageThrone(game.structures.find(s => s.id === Number(structureId))),
    pickupNearest: type => game.manualPickupNearest(type),
    dropHeld: () => game.manualDropItem(),
    setTargetFps: value => { game.targetFps = Number(value); return window.getGameState(); },
    getBotRuntime: botId => { const bot = game.findBot(botId); return bot?.runtime ? JSON.parse(JSON.stringify(bot.runtime)) : null; },
    getWorldTime: () => game.worldTime || 0,
    digHole: (x, y) => game.spawnHole(x ?? game.player.x, y ?? game.player.y),
    plantNearest: () => game.manualPlantSeed(),
    depositToStructure: structureId => game.manualDepositToStructure(game.structures.find(s => s.id === Number(structureId))),
    queueDepositToStructure: structureId => game.queuePlayerStructureDeposit(game.structures.find(s => s.id === Number(structureId))),
    setWorkbenchRecipe: (structureId, recipe) => game.setWorkbenchRecipe(game.structures.find(s => s.id === Number(structureId)), recipe),
    setSmitheryRecipe: (structureId, recipe) => game.setSmitheryRecipe(game.structures.find(s => s.id === Number(structureId)), recipe),
    spawnHemp: (x, y) => game.spawnHemp(x, y),
    spawnMonster: (x, y, options = {}) => game.spawnMonster(x, y, options),
    tickPlayer: seconds => { game.updatePlayer(Number(seconds) || 0); return window.getGameState(); },
    tickProduction: seconds => { game.updateProductionStructures(Number(seconds) || 0); return window.getGameState(); },
    tickCombat: seconds => { game.updatePlayer(Number(seconds) || 0); game.updateRangedAttackStructures(Number(seconds) || 0); game.updateProjectiles(Number(seconds) || 0); return window.getGameState(); },
    tickWorld: seconds => { game.update(Number(seconds) || 0); return window.getGameState(); }
  };
  window.dogDebug = {
    fetch: (botId, text) => game.setDogFetchCommand(botId, text),
    praise: botId => game.praiseDogFetch(botId),
    reject: botId => game.rejectDogFetch(botId)
  };
  window.validateAssistantToolCalls = raw => validateToolCalls(raw, game, { loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
  window.validateAssistantDslAssignments = raw => validateDslAssignments(raw, game, { loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
  window.voiceInputDebug = {
    applyStreamingTranscript: chat.applyTranscript,
    insertTextAtChatCursor: chat.insertAtCursor,
    defaultAsrWsUrl: chat.wsUrl,
    transcribeUrl: chat.transcribeUrl,
    getChatSelection: chat.getSelection,
    getAsrMode,
    isRecording: chat.isRecording,
    startVoice: chat.startVoice,
    stopVoice: chat.stopVoice,
    toggleVoice: chat.toggleVoice,
    setVoiceTargetInput: chat.setVoiceTargetInput,
    clearVoiceTargetInput: chat.clearVoiceTargetInput,
    getBrowserSttState: () => browserStt.getState?.(),
    loadBrowserSttModel: (modelId = dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL) => browserStt.loadModel(modelId, { backend: 'auto' }),
    transcribeBrowserAudio: (audio, sampleRate = 16000, modelId = dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL) => browserStt.transcribe(audio, sampleRate, { modelId, backend: 'auto' })
  };
  window.browserSttDebug = {
    getCatalog: () => browserStt.getCatalog?.(),
    getState: () => browserStt.getState?.(),
    loadModel: (modelId = dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL) => browserStt.loadModel(modelId, { backend: 'auto' }),
    unload: (modelId = dom.browserSttModel?.value || DEFAULT_BROWSER_STT_MODEL) => browserStt.unload(modelId),
    setModel: modelId => browserStt.setSelectedModel(modelId),
    describeModel: modelId => browserStt.describeModel?.(modelId),
    concatAudio: chunks => browserStt.concatAudio?.(chunks)
  };
  window.audioDebug = { controller: audio, play: name => audio.play(name, { cooldownKey: `debug:${name}`, minGapMs: 0 }), startMusic: station => audio.startMusic(station), stopMusic: () => audio.stopMusic(), state: () => ({ enabled: audio.state.enabled, sfxVolume: audio.state.sfxVolume, musicVolume: audio.state.musicVolume, station: audio.state.station, musicPlaying: audio.isMusicPlaying(), stations: Object.keys(audio.stations) }) };

  const simWorkerLabel = () => simWorker.ready ? 'Rust/WASM sim worker ready' : `sim worker ${simWorker.status || 'pending'}`;
  const emitUiState = () => window.dispatchEvent(new CustomEvent('orchestrator:ui-state', { detail: { renderer: game.renderer?.text || 'renderer pending', simStatus: simWorkerLabel() } }));
  const liveItems = () => game.getObjectRegistry().filter(entry => entry.kind === 'item');
  window.simWorkerDebug = {
    client: simWorker,
    ping: () => simWorker.ping(),
    nearestLiveItem: (type = 'log', x = game.player.x, y = game.player.y) => simWorker.nearestItem(liveItems(), { type, x, y }),
    pathfind: (tx = game.player.x, ty = game.player.y, x = game.player.x, y = game.player.y) => simWorker.pathfind({ x, y, tx, ty }),
    chunkForPoint: (x = game.player.x, y = game.player.y, chunkSize = 256) => simWorker.chunkForPoint({ x, y, chunkSize }),
    botTick: (x = game.player.x, y = game.player.y, tx = game.player.x + 10, ty = game.player.y, dt = 0.1, speed = 100, close = 4) => simWorker.botTick({ x, y, tx, ty, dt, speed, close }),
    status: () => ({ enabled: simWorker.enabled, ready: simWorker.ready, status: simWorker.status, version: simWorker.version })
  };
  simWorker.readyPromise?.then(() => {
    syncPerformanceUi(`Simulation worker ${simWorker.ready ? 'ready' : 'fallback'}: ${simWorker.status}.`);
    emitUiState();
  });
  window.orchestratorUiBridge = {
    setSettingsOpen,
    toggleSettings,
    setSettingsTab,
    setChatOpen,
    toggleChat,
    setRadioWidgetOpen,
    getRendererLabel: () => game.renderer?.text || 'renderer pending',
    getSimWorkerStatus: () => simWorkerLabel(),
    getGameState: () => game.getState()
  };
  window.dispatchEvent(new CustomEvent('orchestrator:ui-ready', { detail: window.orchestratorUiBridge }));

  window.uiDebug = { toggleSettings, setSettingsOpen, toggleChat, setChatOpen, setSettingsTab, toggleBotDrawer, setBotDrawerOpen, toggleBuildDrawer, setBuildDrawerOpen, toggleZonesDrawer, setZonesDrawerOpen, toggleMultiplayerDrawer, setMultiplayerDrawerOpen, setRadioWidgetOpen, setBuildTab, setFogOfWar: value => { if (dom.fogOfWarToggle) dom.fogOfWarToggle.checked = !!value; game.fogOfWar.enabled = !!value; game._lastFogSignature = ''; saveBrowserSettings(); return game.fogOfWar.enabled; }, setLightingEffects: value => { if (dom.lightingEffects) dom.lightingEffects.checked = !!value; game.lightingEffectsEnabled = !!value; saveBrowserSettings(); return game.lightingEffectsEnabled; }, setDynamicShadows: value => { if (dom.dynamicShadows) dom.dynamicShadows.checked = !!value; game.dynamicShadowsEnabled = !!value; saveBrowserSettings(); return game.dynamicShadowsEnabled; }, setFpsOverlay: value => { if (dom.showFpsOverlay) dom.showFpsOverlay.checked = !!value; game.showFpsOverlay = !!value; saveBrowserSettings(); return game.showFpsOverlay; }, setPixiHighResolution: value => applyRendererSettings({ ...getRendererSettingsFromUi(), highResolution: !!value }, { save: true }).settings.highResolution, setPixiAntialias: value => applyRendererSettings({ ...getRendererSettingsFromUi(), antialias: !!value }, { save: true }).settings.antialias, showAssignmentToast, hideAssignmentToast };

  addChat('assistant', 'Ready. Desktop: WASD/arrows pan, wheel zooms. Mobile: tap the map to move/select, long-press for context actions, drag-pan, pinch or ＋/－ zoom. Main menu offers Campaign mode, Test mode, Local vs AI, and Online Multiplayer.');
  game.syncBuildUi(); game.syncTeachUi(); game.syncZonesUi?.(); game.syncBotDrawerUi?.(); syncSaveUi();
  if (!params.get('multiplayer')) setMainMenuOpen(true);
  startGameLoop(game);
}

