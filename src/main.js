import { PROGRAMS, PROGRAM_TEMPLATES, DSL_ACTION_WIKI, ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT, ALLOWED_OPS, formatDslActionWiki, getActionStepChainRows } from './data.js?v=t_building_kits_0618';
import { createChatController } from './chat.js?v=20260613-player-tools';
import { createAudioController } from './audio.js?v=t_3ef6c5ab_menu_polish';
import { Game } from './world.js?v=t_building_kits_0618';
import { createSaveGameManager, GAME_MODE_LABELS, normalizeGameMode } from './savegames.js?v=t_777178b3';
import { createMultiplayerController } from './multiplayer.js?v=t_f62dde4d_modes';
import { probeRenderer, startGameLoop } from './browser-runtime.js?v=t_76822d1f';
import { createRenderBackend } from './renderers/index.js?v=t_building_kits_0618';
import { createSimWorkerClient } from './sim/sim-worker-client.js?v=t_building_kits_0618';
import { LOCAL_AI_PROVIDERS, buildOllamaRequestBody, buildOpenAiCompatibleRequestBody, defaultOllamaEndpoint, formatOllamaFinalPrompt, getDefaultProviderConfig, normalizeAssistantLoadout, normalizeAssistantKnowledgePack, normalizeAssistantPackCatalog, parseAssistantRequest, parseWithOllama, parseWithOpenAiCompatible, refreshLocalAiModels, summarizeAssistantLoadout, validateDslAssignments, validateToolCalls } from './assistant.js?v=t_building_kits_0618';
import { escapeHtml } from './utils.js?v=20260613-player-tools';

export async function startGame() {
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('game'), gameStage: $('gameStage'), chatLog: $('chatLog'), chatForm: $('chatForm'), chatInput: $('chatInput'), micButton: $('micButton'), asrStatus: $('asrStatus'), quickCommands: $('quickCommands'), drawZoneButton: $('drawZoneButton'),
    botList: $('botList'), statline: $('statline'), rendererStatus: $('rendererStatus'), targetFps: $('targetFps'), targetFpsValue: $('targetFpsValue'), maxBots: $('maxBots'), maxBotsValue: $('maxBotsValue'), performanceProfile: $('performanceProfile'), applyAutoPerformance: $('applyAutoPerformance'), fogOfWarToggle: $('fogOfWarToggle'), lightingEffects: $('lightingEffects'), dynamicShadows: $('dynamicShadows'), showFpsOverlay: $('showFpsOverlay'), detectedGpu: $('detectedGpu'), detectedVram: $('detectedVram'), detectedProfile: $('detectedProfile'), recommendedBots: $('recommendedBots'), recommendedFps: $('recommendedFps'), performanceNotes: $('performanceNotes'),
    teachPanel: $('teachPanel'), teachCloseBtn: $('teachCloseBtn'), teachRecordBtn: $('teachRecordBtn'), teachAssignBtn: $('teachAssignBtn'), teachBotId: $('teachBotId'), teachStatus: $('teachStatus'), teachSteps: $('teachSteps'),
    sawLogs: $('sawLogs'), sawPlanks: $('sawPlanks'), sawPoles: $('sawPoles'), factoryPlanks: $('factoryPlanks'), factoryRecipe: $('factoryRecipe'), looseLogs: $('looseLogs'), loosePlanks: $('loosePlanks'), looseBase: $('looseBase'), paletteItems: $('paletteItems'), programSelect: $('programSelect'), programView: $('programView'),
    llmMode: $('llmMode'), templateRouting: $('templateRouting'), ollamaEndpoint: $('ollamaEndpoint'), ollamaModel: $('ollamaModel'), refreshModels: $('refreshModels'), benchmarkBtn: $('benchmarkBtn'), ollamaStatus: $('ollamaStatus'), llmProviderLabel: $('llmProviderLabel'), serverOllamaBtn: $('serverOllamaBtn'), localOllamaBtn: $('localOllamaBtn'), localTabbyBtn: $('localTabbyBtn'), localOllamaWindowsHelp: $('localOllamaWindowsHelp'), localTabbyHelp: $('localTabbyHelp'), asrMode: $('asrMode'), asrModeHelp: $('asrModeHelp'),
    buildPanel: $('buildPanel'), buildStatus: $('buildStatus'), buildDrawer: $('buildDrawer'), buildDrawerToggle: $('buildDrawerToggle'), zonesPanel: $('zonesPanel'), zonesDrawer: $('zonesDrawer'), zonesDrawerToggle: $('zonesDrawerToggle'), zoneList: $('zoneList'), drawZoneDrawerButton: $('drawZoneDrawerButton'), botMenu: $('botMenu'), structureMenu: $('structureMenu'), templateDrawer: $('templateDrawer'), templateDrawerToggle: $('templateDrawerToggle'), templateSaveForm: $('templateSaveForm'), templateName: $('templateName'), templateStatus: $('templateStatus'), templateList: $('templateList'),
    settingsOverlay: $('settingsOverlay'), settingsClose: $('settingsClose'), chatOverlay: $('chatOverlay'), chatToggle: $('chatToggle'), chatCollapse: $('chatCollapse'), assignmentToast: $('assignmentToast'),
    aiLog: $('aiLog'), dslWikiView: $('dslWikiView'), botDrawer: $('botDrawer'), botDrawerToggle: $('botDrawerToggle'), botSearch: $('botSearch'), botTeamForm: $('botTeamForm'), botTeamName: $('botTeamName'), botTeamColor: $('botTeamColor'), botTeamCreate: $('botTeamCreate'),
    multiplayerDrawer: $('multiplayerDrawer'), multiplayerDrawerToggle: $('multiplayerDrawerToggle'), multiplayerHostBtn: $('multiplayerHostBtn'), multiplayerJoinCode: $('multiplayerJoinCode'), multiplayerJoinBtn: $('multiplayerJoinBtn'), multiplayerSaveBtn: $('multiplayerSaveBtn'), multiplayerStatus: $('multiplayerStatus'), multiplayerSessionLink: $('multiplayerSessionLink'),
    mainMenuOverlay: $('mainMenuOverlay'), mainMenuCampaignBtn: $('mainMenuCampaignBtn'), mainMenuNewBtn: $('mainMenuNewBtn'), mainMenuModeChoices: $('mainMenuModeChoices'), mainMenuModeLayer: $('mainMenuModeLayer'), mainMenuOnlineLayer: $('mainMenuOnlineLayer'), mainMenuHostLayer: $('mainMenuHostLayer'), mainMenuStartSelectedBtn: $('mainMenuStartSelectedBtn'), mainMenuLoadBtn: $('mainMenuLoadBtn'), mainMenuBackBtn: $('mainMenuBackBtn'), mainMenuLocalAiBtn: $('mainMenuLocalAiBtn'), mainMenuHostBtn: $('mainMenuHostBtn'), mainMenuOnlineHostBtn: $('mainMenuOnlineHostBtn'), mainMenuOnlineBackBtn: $('mainMenuOnlineBackBtn'), mainMenuHostNewBtn: $('mainMenuHostNewBtn'), mainMenuHostLoadBtn: $('mainMenuHostLoadBtn'), mainMenuHostBackBtn: $('mainMenuHostBackBtn'), mainMenuJoinCode: $('mainMenuJoinCode'), mainMenuJoinBtn: $('mainMenuJoinBtn'), mainMenuStatus: $('mainMenuStatus'),
    campaignIntroOverlay: $('campaignIntroOverlay'), campaignIntroKicker: $('campaignIntroKicker'), campaignIntroTitle: $('campaignIntroTitle'), campaignIntroText: $('campaignIntroText'), campaignIntroSceneNo: $('campaignIntroSceneNo'), campaignIntroNextBtn: $('campaignIntroNextBtn'), campaignIntroSkipBtn: $('campaignIntroSkipBtn'),
    resumeGameBtn: $('resumeGameBtn'), pauseGameBtn: $('pauseGameBtn'), saveGameBtn: $('saveGameBtn'), loadGameBtn: $('loadGameBtn'), quitToMainMenuBtn: $('quitToMainMenuBtn'), quitSavePrompt: $('quitSavePrompt'), saveAndQuitBtn: $('saveAndQuitBtn'), quitWithoutSaveBtn: $('quitWithoutSaveBtn'), cancelQuitBtn: $('cancelQuitBtn'), saveGameStatus: $('saveGameStatus'), saveSlotSelect: $('saveSlotSelect'), saveSlotName: $('saveSlotName'), saveName: $('saveName'), saveEntrySelect: $('saveEntrySelect'), renameSlotBtn: $('renameSlotBtn'), deleteSlotBtn: $('deleteSlotBtn'), renameSaveBtn: $('renameSaveBtn'), deleteSaveBtn: $('deleteSaveBtn'), deleteKeepCount: $('deleteKeepCount'), deleteOldSavesBtn: $('deleteOldSavesBtn'),
    knowledgePackList: $('knowledgePackList'), knowledgePackStatus: $('knowledgePackStatus'), assistantLoadoutView: $('assistantLoadoutView'), assistantBasePromptView: $('assistantBasePromptView'), assistantPromptPreview: $('assistantPromptPreview'), resetKnowledgePacks: $('resetKnowledgePacks'), actionStepChainTable: $('actionStepChainTable'), customPackId: $('customPackId'), customPackName: $('customPackName'), customPackContextVariables: $('customPackContextVariables'), customPackConcepts: $('customPackConcepts'), customPackVocabulary: $('customPackVocabulary'), customPackExamples: $('customPackExamples'), customPackActionList: $('customPackActionList'), saveCustomPack: $('saveCustomPack'), clearCustomPackForm: $('clearCustomPackForm'),
    audioSfxToggle: $('audioSfxToggle'), audioSfxVolume: $('audioSfxVolume'), audioSfxTest: $('audioSfxTest'),
    widgetRoster: $('widgetRoster'), widgetRosterHandle: $('widgetRosterHandle'), radioWidgetToggle: $('radioWidgetToggle'), radioWidgetPanel: $('radioWidgetPanel'), radioStationButtons: $('radioStationButtons'), audioMusicStart: $('radioMusicStart'), audioMusicStop: $('radioMusicStop'), audioMusicVolume: $('radioMusicVolume'), audioMusicStatus: $('radioMusicStatus'),
    mobileControls: $('mobileControls'), mobileSettingsBtn: $('mobileSettingsBtn'), mobileBuildBtn: $('mobileBuildBtn'), mobileChatBtn: $('mobileChatBtn'), mobileInteractBtn: $('mobileInteractBtn'), mobileDropBtn: $('mobileDropBtn'), mobileZoomInBtn: $('mobileZoomInBtn'), mobileZoomOutBtn: $('mobileZoomOutBtn')
  };

  function addChat(kind, html) {
    const d = document.createElement('div');
    const labels = { user: 'You', assistant: 'Orchestrator', system: 'System', error: 'Error' };
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    d.className = `message ${kind}`;
    d.innerHTML = `<div class="message-meta"><span>${labels[kind] || kind}</span><time>${time}</time></div><div class="message-body">${html}</div>`;
    dom.chatLog.appendChild(d);
    dom.chatLog.scrollTop = dom.chatLog.scrollHeight;
  }
  function stringifyLog(value) {
    try { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
    catch { return String(value); }
  }
  function sentFinalPrompt(sent) {
    return sent?.finalPrompt || (sent?.body?.messages ? formatOllamaFinalPrompt(sent.body.messages) : 'Not available.');
  }
  function responseRawText(returned) {
    if (!returned) return '';
    if (returned.rawResponse !== undefined) return returned.rawResponse;
    if (returned.content !== undefined) return returned.content;
    if (returned.rawHttpBody !== undefined) return returned.rawHttpBody;
    return stringifyLog(returned);
  }
  function parsedOrError(returned) {
    if (!returned) return 'No returned data.';
    if (returned.parsed !== undefined) return returned.parsed;
    return { error: returned.error || returned.parseError || 'No parsed JSON.', parseError: returned.parseError || null, validationErrors: returned.validationErrors || null };
  }
  function logChatAi({ mode, sent, returned }) {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { time: stamp, mode, sent, returned };
    console.info('[Orchestrator chat AI]', entry);
    if (!dom.aiLog) return;
    const block = `[${stamp}] ${mode}\nRequest:\n${stringifyLog(sent?.request || sent?.body || sent)}\nFinal prompt:\n${sentFinalPrompt(sent)}\nLLM answer:\n${responseRawText(returned) || '(no raw LLM answer; mock parser result below)'}\nParsed JSON / error:\n${stringifyLog(parsedOrError(returned))}\n\n`;
    const previous = dom.aiLog.textContent === 'No chat requests yet.' ? '' : (dom.aiLog.textContent || '');
    dom.aiLog.textContent = `${block}${previous}`.slice(0, 100000);
  }
  const ASR_MODE_KEY = 'orchestratorGrove.asrMode';
  const TEMPLATE_ROUTING_KEY = 'orchestratorGrove.templateRoutingEnabled';
  const ASSISTANT_LOADOUT_KEY = 'orchestratorGrove.assistantLoadout.v1';
  const CUSTOM_ACTION_PACKS_KEY = 'orchestratorGrove.customActionPacks.v1';
  const SETTINGS_KEY = 'orchestratorGrove.settings.v1';
  const SAVE_KEY = 'orchestratorGrove.save.v1';
  const SAVE_LIBRARY_KEY = 'orchestratorGrove.saveLibrary.v2';
  const RECENT_SAVE_MS = 30000;
  const CAMPAIGN_INTRO_SCENES = [
    {
      kicker: 'City noise',
      title: 'Paul had stopped seeing the sun.',
      text: 'He loved AI early, when it still felt like a secret door to the future. But the big city was all sirens, calendars, office lights, and daylight spent behind glass.'
    },
    {
      kicker: 'A late-night spark',
      title: 'Then the gadget videos found him.',
      text: 'One evening, after too many tabs and too much noise, a YouTube rabbit hole showed him a smaller kind of freedom: simple tools, portable power, and a life that could move.'
    },
    {
      kicker: 'The escape kit',
      title: 'He bought only what could help him build.',
      text: 'A plain white camper van. A hammock. An ultrabook. Solar panels, a power station, a portable 3D printer and assembler, plus boxes of DIY robotics parts.'
    },
    {
      kicker: 'No return commute',
      title: 'Paul quit the office and closed the apartment door.',
      text: 'No dramatic speech. Just a final email, a cancelled lease, and the quiet click of a key left behind. The city kept rushing. Paul drove away from it.'
    },
    {
      kicker: 'The old lake',
      title: 'He went back to where nature had once felt endless.',
      text: 'Out in the countryside waited the lake his father had taken him to as a child. This time Paul arrived with a van full of tools, ready to grow a gentler world with little robotic helpers.'
    }
  ];
  let campaignIntroActive = false;
  let campaignIntroSceneIndex = 0;
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
    }
  };
  const storageGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const storageSet = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
  const readJson = (key, fallback = null) => {
    const raw = storageGet(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };
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
  function saveBrowserSettings() {
    const settings = {
      llmMode: dom.llmMode?.value || 'mock',
      templateRouting: getTemplateRoutingEnabled(),
      asrMode: getAsrMode(),
      performanceProfile: dom.performanceProfile?.value || 'auto',
      targetFps: Number(dom.targetFps?.value || game?.targetFps || 60),
      maxBots: Number(dom.maxBots?.value || game?.maxBots || 12),
      fogOfWar: getFogOfWarEnabled(),
      lightingEffects: getLightingEffectsEnabled(),
      dynamicShadows: getDynamicShadowsEnabled(),
      showFpsOverlay: getShowFpsOverlayEnabled(),
      ai: getCurrentLocalAiConfig()
    };
    return storageSet(SETTINGS_KEY, JSON.stringify(settings));
  }
  const clampBotLimit = value => {
    const min = Number(dom.maxBots?.min || 4);
    const max = Number(dom.maxBots?.max || 1000);
    return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
  };
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
  function setMaxBotsUiLimit(limit) {
    if (!dom.maxBots) return;
    const safeLimit = Math.max(Number(dom.maxBots.min || 4), Math.min(1000, Math.round(Number(limit) || 1000)));
    dom.maxBots.max = String(safeLimit);
    dom.maxBots.step = '1';
    if (Number(dom.maxBots.value) > safeLimit) dom.maxBots.value = String(safeLimit);
    if (game && Number(game.maxBots) > safeLimit) game.maxBots = safeLimit;
  }
  function setPerformanceProfileValue(profile) {
    if (!dom.performanceProfile) return;
    dom.performanceProfile.value = dom.performanceProfile.querySelector(`option[value="${profile}"]`) ? profile : 'custom';
  }
  function syncPerformanceUi(message = '') {
    const recommendation = getRendererRecommendation();
    setMaxBotsUiLimit(recommendation.maxBotsCap);
    if (dom.targetFpsValue) dom.targetFpsValue.textContent = String(game.targetFps);
    if (dom.maxBotsValue) dom.maxBotsValue.textContent = String(game.maxBots);
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
  function applyPerformancePreset(profile, { save = true } = {}) {
    const recommendation = getRendererRecommendation();
    const targetProfile = profile === 'auto' ? recommendation.profile : profile;
    const preset = PERFORMANCE_PRESETS[targetProfile] || PERFORMANCE_PRESETS.balanced;
    const nextFps = profile === 'auto' ? recommendation.recommendedTargetFps : preset.targetFps;
    const baseBots = profile === 'auto' ? recommendation.recommendedMaxBots : preset.maxBots;
    game.targetFps = Number(nextFps);
    setMaxBotsUiLimit(recommendation.maxBotsCap);
    game.maxBots = clampBotLimit(Math.min(baseBots, recommendation.maxBotsCap));
    if (dom.targetFps) dom.targetFps.value = String(game.targetFps);
    if (dom.maxBots) dom.maxBots.value = String(game.maxBots);
    setPerformanceProfileValue(profile);
    syncPerformanceUi(profile === 'auto' ? 'Applied hardware-based performance recommendation.' : `Applied ${preset.label.toLowerCase()} preset.`);
    if (save) saveBrowserSettings();
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
    updateAssistantPromptPreview();
    saveBrowserSettings();
  }
  function splitPackText(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
  }
  function packIdFromName(name = '') {
    return `custom_${String(name || 'action_pack').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'action_pack'}`;
  }
  function readCustomActionPacks() {
    const raw = storageGet(CUSTOM_ACTION_PACKS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      return Object.fromEntries(entries
        .map(pack => normalizeAssistantKnowledgePack({ ...pack, custom: true }))
        .filter(pack => pack.id && !ASSISTANT_KNOWLEDGE_PACKS[pack.id])
        .map(pack => [pack.id, pack]));
    } catch {
      return {};
    }
  }
  let customActionPacks = readCustomActionPacks();
  function getActionPackCatalog() {
    return normalizeAssistantPackCatalog({ ...ASSISTANT_KNOWLEDGE_PACKS, ...customActionPacks });
  }
  function persistCustomActionPacks(message = 'Custom action packs saved to this browser.') {
    const ok = storageSet(CUSTOM_ACTION_PACKS_KEY, JSON.stringify(Object.values(customActionPacks)));
    assistantLoadout = normalizeAssistantLoadout(assistantLoadout, getActionPackCatalog());
    storageSet(ASSISTANT_LOADOUT_KEY, JSON.stringify(assistantLoadout));
    renderKnowledgePackSelector(ok ? message : 'Custom action pack changed, but browser storage is unavailable.');
    game?.setManagerKnowledgePackCatalog?.(getActionPackCatalog());
    return customActionPacks;
  }
  function readAssistantLoadout() {
    const raw = storageGet(ASSISTANT_LOADOUT_KEY);
    if (!raw) return normalizeAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT, getActionPackCatalog());
    try { return normalizeAssistantLoadout(JSON.parse(raw), getActionPackCatalog()); }
    catch { return normalizeAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT, getActionPackCatalog()); }
  }
  let assistantLoadout = readAssistantLoadout();
  const getAssistantLoadout = () => assistantLoadout.slice();
  function getAssistantLoadoutDebug() {
    const catalog = getActionPackCatalog();
    const summary = summarizeAssistantLoadout(assistantLoadout, catalog);
    return {
      selectedPackIds: summary.ids,
      selectedPackNames: summary.names,
      unlockedOps: summary.unlockedOps,
      optionalContext: summary.optionalContext,
      vocabulary: summary.vocabulary,
      concepts: summary.concepts,
      packs: summary.packs
    };
  }
  function updateAssistantPromptPreview() {
    if (!dom.assistantPromptPreview) return '';
    if (!game) {
      dom.assistantPromptPreview.textContent = 'Prompt preview will appear after the world loads.';
      return dom.assistantPromptPreview.textContent;
    }
    const requestText = (dom.chatInput?.value || '').trim() || '[current user request will appear here]';
    const { provider, model } = getCurrentLocalAiConfig();
    const knowledgePacks = getActionPackCatalog();
    const { prompt } = provider === 'tabbyapi'
      ? buildOpenAiCompatibleRequestBody(requestText, game, { model, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks, temperature: 0.1 })
      : buildOllamaRequestBody(requestText, game, { model, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks });
    if (dom.assistantBasePromptView) dom.assistantBasePromptView.textContent = prompt.systemPrompt;
    if (dom.assistantLoadoutView) dom.assistantLoadoutView.textContent = JSON.stringify(prompt.knowledge, null, 2);
    dom.assistantPromptPreview.textContent = prompt.finalPrompt;
    return prompt.finalPrompt;
  }
  function updateAssistantLoadoutDebug(message = '') {
    const debug = getAssistantLoadoutDebug();
    if (dom.assistantLoadoutView && !game) dom.assistantLoadoutView.textContent = JSON.stringify(debug, null, 2);
    updateAssistantPromptPreview();
    if (dom.knowledgePackStatus) dom.knowledgePackStatus.textContent = message || `${debug.selectedPackIds.length} knowledge/action pack(s) equipped · ${debug.unlockedOps.length} DSL op(s) unlocked.`;
    return debug;
  }
  function renderCustomPackActionSelector(selectedOps = []) {
    if (!dom.customPackActionList) return;
    const selected = new Set(selectedOps);
    const rows = getActionStepChainRows();
    dom.customPackActionList.innerHTML = rows.map(row => `
      <label class="checkline" title="${escapeHtml(row.description || row.promptSignature || row.op)}">
        <input type="checkbox" data-action-pack-op="${escapeHtml(row.op)}" ${selected.has(row.op) ? 'checked' : ''} />
        <span><b>${escapeHtml(row.label)}</b> <code>${escapeHtml(row.op)}</code><br><small>${escapeHtml((row.args || []).length ? `args: ${row.args.join(', ')}` : 'no args')}</small></span>
      </label>
    `).join('');
  }
  function clearCustomPackForm(pack = {}) {
    if (dom.customPackId) dom.customPackId.value = pack.id || '';
    if (dom.customPackName) dom.customPackName.value = pack.name || '';
    if (dom.customPackContextVariables) dom.customPackContextVariables.value = (pack.contextVariables || pack.optionalContext || []).join('\n');
    if (dom.customPackConcepts) dom.customPackConcepts.value = (pack.concepts || []).join('\n');
    if (dom.customPackVocabulary) dom.customPackVocabulary.value = (pack.vocabulary || []).join('\n');
    if (dom.customPackExamples) dom.customPackExamples.value = Array.isArray(pack.examples) ? pack.examples.map(example => typeof example === 'string' ? example : JSON.stringify(example)).join('\n') : '';
    renderCustomPackActionSelector(pack.unlockedOps || []);
  }
  function readCustomPackForm() {
    const name = String(dom.customPackName?.value || '').trim();
    const rawId = String(dom.customPackId?.value || '').trim();
    const id = (rawId || packIdFromName(name)).toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
    const unlockedOps = [...(dom.customPackActionList?.querySelectorAll('[data-action-pack-op]:checked') || [])].map(input => input.dataset.actionPackOp);
    return normalizeAssistantKnowledgePack({
      id,
      name: name || id,
      custom: true,
      unlockedOps,
      contextVariables: splitPackText(dom.customPackContextVariables?.value || ''),
      concepts: splitPackText(dom.customPackConcepts?.value || ''),
      vocabulary: splitPackText(dom.customPackVocabulary?.value || ''),
      examples: splitPackText(dom.customPackExamples?.value || '')
    });
  }
  function upsertCustomActionPack(input) {
    const rawId = input.id || packIdFromName(input.name);
    const id = String(rawId || '').toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
    const pack = normalizeAssistantKnowledgePack({ ...input, custom: true, id });
    if (!pack.id) throw new Error('Custom action pack needs an id or name.');
    if (ASSISTANT_KNOWLEDGE_PACKS[pack.id]) throw new Error(`Custom action pack id ${pack.id} conflicts with a built-in pack.`);
    if (!pack.unlockedOps.length) throw new Error('Select at least one valid action step for the custom pack.');
    customActionPacks = { ...customActionPacks, [pack.id]: pack };
    persistCustomActionPacks(`Saved custom action pack ${pack.name}.`);
    return pack;
  }
  function deleteCustomActionPack(id) {
    if (!customActionPacks[id]) return false;
    const { [id]: _removed, ...rest } = customActionPacks;
    customActionPacks = rest;
    assistantLoadout = assistantLoadout.filter(packId => packId !== id);
    persistCustomActionPacks(`Deleted custom action pack ${id}.`);
    clearCustomPackForm();
    return true;
  }
  function renderKnowledgePackSelector(message = '') {
    if (!dom.knowledgePackList) return updateAssistantLoadoutDebug(message);
    if (dom.customPackActionList && !dom.customPackActionList.children.length) renderCustomPackActionSelector();
    const selected = new Set(assistantLoadout);
    const catalog = getActionPackCatalog();
    dom.knowledgePackList.innerHTML = Object.values(catalog).map(pack => `
      <article class="knowledge-pack-card" data-knowledge-card="${escapeHtml(pack.id)}">
        <label class="checkline knowledge-pack-title">
          <input type="checkbox" data-knowledge-pack="${escapeHtml(pack.id)}" ${selected.has(pack.id) ? 'checked' : ''} />
          <span><b>${escapeHtml(pack.name)}</b> <code>${escapeHtml(pack.id)}</code> <span class="knowledge-pack-kind">${pack.custom ? 'custom action pack' : 'built-in'}</span></span>
        </label>
        <p class="small"><b>Concepts:</b> ${escapeHtml((pack.concepts || []).join(' · '))}</p>
        <p class="small"><b>Vocabulary:</b> ${escapeHtml((pack.vocabulary || []).join(', '))}</p>
        <p class="small"><b>Context variables:</b> ${escapeHtml((pack.contextVariables || pack.optionalContext || []).join(', ') || 'none')}</p>
        <p class="small"><b>Ops:</b> ${pack.unlockedOps.map(op => `<code>${escapeHtml(op)}</code>`).join(' ')}</p>
        <p class="small"><b>Injected action details:</b> ${(pack.actions || []).map(action => `<code>${escapeHtml(`${action.op} ${action.dslSnippet}`)}</code>`).join(' ')}</p>
        ${pack.custom ? `<div class="knowledge-pack-actions"><button type="button" data-edit-custom-pack="${escapeHtml(pack.id)}">Edit</button><button type="button" data-delete-custom-pack="${escapeHtml(pack.id)}">Delete</button></div>` : ''}
      </article>
    `).join('');
    return updateAssistantLoadoutDebug(message);
  }
  function inlineList(items = [], empty = 'none') {
    const values = items.filter(Boolean);
    return values.length ? values.map(value => `<code>${escapeHtml(value)}</code>`).join(' ') : `<span class="muted-cell">${escapeHtml(empty)}</span>`;
  }
  function renderActionStepChainTable() {
    if (!dom.actionStepChainTable) return [];
    const rows = getActionStepChainRows();
    dom.actionStepChainTable.innerHTML = `
      <table class="action-step-chain-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>DSL args</th>
            <th>DSL snippet</th>
            <th>Backend</th>
            <th>Packs</th>
            <th>Templates</th>
            <th>Recorder</th>
            <th>UI card</th>
            <th>Prompt signature</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td><b>${escapeHtml(row.label)}</b><code>${escapeHtml(row.op)}</code>${row.notes ? `<small>${escapeHtml(row.notes)}</small>` : ''}</td>
              <td>${inlineList(row.args, 'none')}</td>
              <td><code>${escapeHtml(row.dslSnippet || '')}</code></td>
              <td>${escapeHtml(row.backend)}</td>
              <td>${inlineList(row.packs, 'not exposed')}</td>
              <td>${inlineList(row.templates, 'none')}</td>
              <td>${row.recordable ? '<span class="chain-ok">recordable</span>' : '<span class="muted-cell">not recorded</span>'}</td>
              <td>${escapeHtml(row.uiCard || 'generic DSL card')}</td>
              <td><code>${escapeHtml(row.promptSignature || 'not in prompt')}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return rows;
  }
  function persistAssistantLoadout(nextLoadout) {
    assistantLoadout = normalizeAssistantLoadout(nextLoadout, getActionPackCatalog());
    const ok = storageSet(ASSISTANT_LOADOUT_KEY, JSON.stringify(assistantLoadout));
    renderKnowledgePackSelector(ok ? 'Knowledge pack loadout saved to this browser.' : 'Knowledge pack loadout changed, but browser storage is unavailable.');
    game?.setManagerKnowledgePackCatalog?.(getActionPackCatalog());
    return assistantLoadout;
  }
  const getAsrMode = () => (ASR_MODES[dom.asrMode?.value] ? dom.asrMode.value : 'zipformer_whisper');
  const getTemplateRoutingEnabled = () => dom.templateRouting?.checked === true;
  const getFogOfWarEnabled = () => dom.fogOfWarToggle?.checked !== false;
  const getLightingEffectsEnabled = () => dom.lightingEffects?.checked !== false;
  const getDynamicShadowsEnabled = () => dom.dynamicShadows?.checked === true;
  const getShowFpsOverlayEnabled = () => dom.showFpsOverlay?.checked !== false;
  function syncAsrModeUi() {
    const cfg = ASR_MODES[getAsrMode()];
    if (dom.asrStatus) dom.asrStatus.textContent = cfg.status;
    if (dom.asrModeHelp) dom.asrModeHelp.textContent = cfg.help;
  }

  let game;
  const params = new URLSearchParams(window.location.search);
  const storedSettings = readJson(SETTINGS_KEY, null);
  const storedPerformanceProfile = storedSettings?.performanceProfile || 'auto';
  const storedAsrMode = storedSettings?.asrMode || storageGet(ASR_MODE_KEY);
  if (ASR_MODES[storedAsrMode] && dom.asrMode) dom.asrMode.value = storedAsrMode;
  if (dom.templateRouting) dom.templateRouting.checked = typeof storedSettings?.templateRouting === 'boolean' ? storedSettings.templateRouting : storageGet(TEMPLATE_ROUTING_KEY) === 'true';
  syncAsrModeUi();
  const chat = createChatController({ chatInput: dom.chatInput, chatForm: dom.chatForm, micButton: dom.micButton, asrStatus: dom.asrStatus, quickCommands: dom.quickCommands, getAsrMode, onSubmit: text => handleAssistant(text) });
  const rendererMode = params.get('renderer') || storedSettings?.rendererMode || 'pixi';
  const renderBackend = await createRenderBackend({ canvas: dom.canvas, mode: rendererMode });
  game = new Game({ canvas: dom.canvas, chat, dom, isChatActive: () => isChatOpen(), renderBackend });
  game.setManagerKnowledgePackCatalog(getActionPackCatalog());
  game.getDefaultManagerKnowledgePacks = () => getAssistantLoadout();
  game.managerMessageHandler = ({ manager, sender, message }) => handleManagerMessage(manager, message, { source: 'delegate_to_manager', sender });
  game.renderer = { text: renderBackend.text || renderBackend.kind || 'Renderer ready', webgpu: false, reason: 'active backend', backend: renderBackend.kind };
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
  const audio = createAudioController();
  const saveGames = createSaveGameManager({ storageGet, storageSet, libraryKey: SAVE_LIBRARY_KEY, legacyKey: SAVE_KEY });
  let selectedMainMenuMode = 'test';
  let mainMenuAudioUnlocked = false;
  game.audio = audio;
  setPerformanceProfileValue(storedPerformanceProfile);
  probeRenderer().then(renderer => {
    game.renderer = { ...renderer, text: `${renderBackend.text || 'Renderer'} · ${renderer.text || ''}`.trim(), backend: renderBackend.kind };
    if (storedSettings?.targetFps || storedSettings?.maxBots) {
      syncPerformanceUi('Loaded performance settings from this browser.');
      return;
    }
    applyPerformancePreset(storedPerformanceProfile === 'custom' ? 'auto' : storedPerformanceProfile, { save: true });
  }).catch(err => {
    game.renderer = { text: `${renderBackend.text || 'Renderer'} · probe failed`, webgpu: false, reason: err.message, backend: renderBackend.kind };
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
      setBuildDrawerOpen(false); setBotDrawerOpen(false); setTemplateDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.cancelPlacement(); game.cancelZoneDrawing(false); game.hideMenus(); syncSaveUi(); dom.settingsClose.focus();
    } else if (!game.multiplayer?.enabled) {
      game.setPaused(false);
      syncSaveUi();
    }
  }
  function toggleSettings() { setSettingsOpen(dom.settingsOverlay.hidden); }
  function setSettingsTab(name) {
    document.querySelectorAll('[data-settings-tab]').forEach(btn => {
      const active = btn.dataset.settingsTab === name;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-settings-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.settingsPanel === name));
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
    const selectedSlotId = preserve ? dom.saveSlotSelect?.value : '';
    const selectedSaveId = preserve ? dom.saveEntrySelect?.value : '';
    const slots = saveGames.listSlots(mode);
    if (dom.saveSlotSelect) {
      dom.saveSlotSelect.innerHTML = '<option value="">+ New slot from typed name</option>' + slots.map(slot => `<option value="${escapeHtml(slot.id)}">${escapeHtml(slot.name)} (${slot.saves.length})</option>`).join('');
      const slotExists = slots.some(slot => slot.id === selectedSlotId);
      dom.saveSlotSelect.value = slotExists ? selectedSlotId : (slots[0]?.id || '');
    }
    const slot = slots.find(entry => entry.id === dom.saveSlotSelect?.value) || null;
    if (dom.saveSlotName && !dom.saveSlotName.value) dom.saveSlotName.value = slot?.name || '';
    const saves = slot?.saves || [];
    if (dom.saveEntrySelect) {
      dom.saveEntrySelect.innerHTML = saves.length ? saves.map(save => `<option value="${escapeHtml(save.id)}">${escapeHtml(save.name)} · ${escapeHtml(formatSaveTime(save.savedAt))}</option>`).join('') : '<option value="">No savegames in this slot</option>';
      const saveExists = saves.some(save => save.id === selectedSaveId);
      dom.saveEntrySelect.value = saveExists ? selectedSaveId : (saves[0]?.id || '');
    }
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
    if (dom.campaignIntroOverlay) {
      dom.campaignIntroOverlay.hidden = true;
      dom.campaignIntroOverlay.classList.add('is-hidden');
    }
    if (resume && !game.multiplayer?.enabled) game.setPaused(false);
    syncSaveUi(message);
    return true;
  }
  function finishCampaignIntro(reason = 'finished') {
    const message = reason === 'skip' ? 'Campaign intro skipped. Welcome to the old lake.' : 'Campaign intro complete. Welcome to the old lake.';
    return closeCampaignIntro({ resume: true, message });
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
    renderCampaignIntroScene();
    dom.campaignIntroOverlay.hidden = false;
    dom.campaignIntroOverlay.classList.remove('is-hidden');
    syncSaveUi('Campaign intro playing. Press Esc to skip.');
    setTimeout(() => dom.campaignIntroNextBtn?.focus(), 0);
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
  function saveGameToCache({ slotId = dom.saveSlotSelect?.value || '', slotName = dom.saveSlotName?.value || '', saveName = dom.saveName?.value || '' } = {}) {
    const payload = game.exportSave();
    const mode = normalizeGameMode(payload.mode || currentSaveMode());
    const saved = saveGames.save(mode, payload, { slotId, slotName, saveName });
    const ok = !!saved;
    if (ok) {
      storageSet(SAVE_KEY, JSON.stringify(saved.save.payload));
      lastSuccessfulSaveAt = Date.parse(saved.save.savedAt) || Date.now();
      setQuitSavePromptOpen(false);
      if (dom.saveSlotName) dom.saveSlotName.value = saved.slot.name;
      if (dom.saveName) dom.saveName.value = '';
      renderSaveManagerUi({ message: `Saved ${modeLabel(mode)} → ${saved.slot.name} / ${saved.save.name} at ${formatSaveTime(saved.save.savedAt)}.`, preserve: false });
      if (dom.saveSlotSelect) dom.saveSlotSelect.value = saved.slot.id;
      if (dom.saveEntrySelect) dom.saveEntrySelect.value = saved.save.id;
    }
    syncSaveUi(ok ? `Saved ${modeLabel(mode)} savegame at ${formatSaveTime(saved.save.savedAt)}.` : 'Save failed: browser cache unavailable.');
    return ok ? saved.save.payload : null;
  }
  function loadGameFromCache({ closeMenus = true, mode = currentSaveMode(), slotId = dom.saveSlotSelect?.value || '', saveId = dom.saveEntrySelect?.value || '', asHost = false } = {}) {
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
      const message = `Generated DSL for <b>Bot ${assignment.botId}</b>: <code>${escapeHtml(res.program.name)}</code>${dslStepsHtml(res.steps)}`;
      addChat('assistant', message);
      showAssignmentToast(`Generated DSL for <b>Bot ${assignment.botId}</b>.`);
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
    if (dom.llmMode.value === 'ollama' || dom.llmMode.value === 'tabbyapi') {
      const { provider, endpoint, model } = getCurrentLocalAiConfig();
      const parsed = provider === 'tabbyapi'
        ? await parseWithOpenAiCompatible(text, game, { endpoint, model, providerLabel: LOCAL_AI_PROVIDERS.tabbyapi.backendLabel, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() })
        : await parseWithOllama(text, game, { endpoint, model, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
      const { debug, ...parsedForLog } = parsed;
      logChatAi({ mode: provider === 'tabbyapi' ? LOCAL_AI_PROVIDERS.tabbyapi.backendLabel : 'ollama', sent: debug?.sent || { endpoint, model, text, loadout: getAssistantLoadout() }, returned: debug?.returned || parsedForLog });
      return handleParsed(parsed);
    } else {
      const parsed = parseAssistantRequest(text, game, { enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
      logChatAi({ mode: 'mock parser', sent: { text, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout() }, returned: parsed });
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
    const managerText = `Manager ${game.botDisplayName(manager)} (${manager.ref}, status manager) received a delegation from ${sender ? game.botDisplayName(sender) : source}: ${clean}`;
    addChat('user', `<b>${escapeHtml(game.botDisplayName(manager))} manager:</b> ${escapeHtml(clean)}`);
    let parsed;
    if (dom.llmMode.value === 'ollama' || dom.llmMode.value === 'tabbyapi') {
      const { provider, endpoint, model } = getCurrentLocalAiConfig();
      parsed = provider === 'tabbyapi'
        ? await parseWithOpenAiCompatible(managerText, game, { endpoint, model, providerLabel: `${LOCAL_AI_PROVIDERS.tabbyapi.backendLabel} manager`, enableTemplates: getTemplateRoutingEnabled(), loadout, knowledgePacks: getActionPackCatalog() })
        : await parseWithOllama(managerText, game, { endpoint, model, enableTemplates: getTemplateRoutingEnabled(), loadout, knowledgePacks: getActionPackCatalog() });
      const { debug, ...parsedForLog } = parsed;
      logChatAi({ mode: provider === 'tabbyapi' ? `${LOCAL_AI_PROVIDERS.tabbyapi.backendLabel} manager` : 'ollama manager', sent: debug?.sent || { endpoint, model, text: managerText, loadout }, returned: debug?.returned || parsedForLog });
    } else {
      parsed = parseAssistantRequest(managerText, game, { enableTemplates: getTemplateRoutingEnabled(), loadout, knowledgePacks: getActionPackCatalog() });
      logChatAi({ mode: 'mock manager parser', sent: { text: managerText, loadout, managerBotId: manager.id }, returned: parsed });
    }
    const results = handleParsed(parsed);
    manager.lastManagerMessage = { text: clean, source, at: Date.now(), loadout };
    return { ok: true, managerId: manager.id, loadout, parsed, results };
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
  dom.chatInput?.addEventListener('input', updateAssistantPromptPreview);
  dom.asrMode?.addEventListener('change', () => { storageSet(ASR_MODE_KEY, getAsrMode()); syncAsrModeUi(); saveBrowserSettings(); });
  dom.templateRouting?.addEventListener('change', () => { storageSet(TEMPLATE_ROUTING_KEY, String(getTemplateRoutingEnabled())); updateAssistantPromptPreview(); saveBrowserSettings(); });
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
      const parsed = provider === 'tabbyapi'
        ? await parseWithOpenAiCompatible('Bot 1 chop wood', game, { endpoint, model, providerLabel: LOCAL_AI_PROVIDERS.tabbyapi.backendLabel, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() })
        : await parseWithOllama('Bot 1 chop wood', game, { endpoint, model, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
      dom.ollamaStatus.textContent = `${parsed.meta || 'Benchmark'} valid calls=${parsed.calls?.length || 0}, total=${Math.round(performance.now()-started)}ms`;
    } catch (e) {
      dom.ollamaStatus.textContent = `Benchmark failed: ${e.message}`;
    }
  });
  if (!dom.ollamaEndpoint.value) dom.ollamaEndpoint.value = defaultOllamaEndpoint();
  syncProviderUi();
  updateAssistantPromptPreview();
  dom.settingsClose.addEventListener('click', () => setSettingsOpen(false));
  dom.resumeGameBtn?.addEventListener('click', () => setSettingsOpen(false));
  dom.pauseGameBtn?.addEventListener('click', () => { if (!game.multiplayer?.enabled) { game.setPaused(true); syncSaveUi('Game paused.'); } });
  dom.saveGameBtn?.addEventListener('click', () => saveGameToCache());
  dom.loadGameBtn?.addEventListener('click', () => loadGameFromCache());
  dom.saveSlotSelect?.addEventListener('change', () => { dom.saveSlotName && (dom.saveSlotName.value = ''); renderSaveManagerUi(); });
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
    const ok = saveGames.renameSave(currentSaveMode(), dom.saveSlotSelect?.value || '', dom.saveEntrySelect?.value || '', dom.saveName?.value || '');
    if (dom.saveName) dom.saveName.value = '';
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
  window.getCameraState = () => ({ camera: { ...game.camera }, player: { x: game.player.x, y: game.player.y, target: game.player.target ? { ...game.player.target } : null }, map: { ...game.map } });
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
    movePlayerTo: (x, y) => { game.player.x = x; game.player.y = y; game.player.target = null; return window.getGameState(); },
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
  window.validateAssistantToolCalls = raw => validateToolCalls(raw, game, { loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
  window.validateAssistantDslAssignments = raw => validateDslAssignments(raw, game, { loadout: getAssistantLoadout(), knowledgePacks: getActionPackCatalog() });
  window.voiceInputDebug = { applyStreamingTranscript: chat.applyTranscript, insertTextAtChatCursor: chat.insertAtCursor, defaultAsrWsUrl: chat.wsUrl, transcribeUrl: chat.transcribeUrl, getChatSelection: chat.getSelection, getAsrMode };
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

  window.uiDebug = { toggleSettings, setSettingsOpen, toggleChat, setChatOpen, setSettingsTab, toggleBotDrawer, setBotDrawerOpen, toggleBuildDrawer, setBuildDrawerOpen, toggleZonesDrawer, setZonesDrawerOpen, toggleMultiplayerDrawer, setMultiplayerDrawerOpen, setRadioWidgetOpen, setBuildTab, setFogOfWar: value => { if (dom.fogOfWarToggle) dom.fogOfWarToggle.checked = !!value; game.fogOfWar.enabled = !!value; game._lastFogSignature = ''; saveBrowserSettings(); return game.fogOfWar.enabled; }, setLightingEffects: value => { if (dom.lightingEffects) dom.lightingEffects.checked = !!value; game.lightingEffectsEnabled = !!value; saveBrowserSettings(); return game.lightingEffectsEnabled; }, setDynamicShadows: value => { if (dom.dynamicShadows) dom.dynamicShadows.checked = !!value; game.dynamicShadowsEnabled = !!value; saveBrowserSettings(); return game.dynamicShadowsEnabled; }, setFpsOverlay: value => { if (dom.showFpsOverlay) dom.showFpsOverlay.checked = !!value; game.showFpsOverlay = !!value; saveBrowserSettings(); return game.showFpsOverlay; }, showAssignmentToast, hideAssignmentToast };

  addChat('assistant', 'Ready. Desktop: WASD/arrows pan, wheel zooms. Mobile: tap the map to move/select, long-press for context actions, drag-pan, pinch or ＋/－ zoom. Main menu offers Campaign mode, Test mode, Local vs AI, and Online Multiplayer.');
  game.syncBuildUi(); game.syncTeachUi(); game.syncZonesUi?.(); game.syncBotDrawerUi?.(); syncSaveUi();
  if (!params.get('multiplayer')) setMainMenuOpen(true);
  startGameLoop(game);
}
