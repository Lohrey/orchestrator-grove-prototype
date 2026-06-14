import { PROGRAMS, PROGRAM_TEMPLATES, DSL_ACTION_WIKI, ASSISTANT_KNOWLEDGE_PACKS, DEFAULT_ASSISTANT_LOADOUT, formatDslActionWiki } from './data.js?v=t_c4955ba2_player_storage';
import { createChatController } from './chat.js?v=20260613-player-tools';
import { createAudioController } from './audio.js?v=t_cb4d09e8_audio';
import { Game } from './world.js?v=t_f62dde4d_modes';
import { createMultiplayerController } from './multiplayer.js?v=t_f62dde4d_modes';
import { probeRenderer, startGameLoop } from './browser-runtime.js?v=t_76822d1f';
import { buildOllamaRequestBody, defaultOllamaEndpoint, formatOllamaFinalPrompt, normalizeAssistantLoadout, parseAssistantRequest, parseWithOllama, refreshOllamaModels, summarizeAssistantLoadout, validateDslAssignments, validateToolCalls } from './assistant.js?v=t_6481763f_use_held_item';
import { escapeHtml } from './utils.js?v=20260613-player-tools';

export function startGame() {
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('game'), gameStage: $('gameStage'), chatLog: $('chatLog'), chatForm: $('chatForm'), chatInput: $('chatInput'), micButton: $('micButton'), asrStatus: $('asrStatus'), quickCommands: $('quickCommands'), drawZoneButton: $('drawZoneButton'),
    botList: $('botList'), statline: $('statline'), rendererStatus: $('rendererStatus'), targetFps: $('targetFps'), targetFpsValue: $('targetFpsValue'), maxBots: $('maxBots'), maxBotsValue: $('maxBotsValue'),
    teachPanel: $('teachPanel'), teachCloseBtn: $('teachCloseBtn'), teachRecordBtn: $('teachRecordBtn'), teachAssignBtn: $('teachAssignBtn'), teachBotId: $('teachBotId'), teachStatus: $('teachStatus'), teachSteps: $('teachSteps'),
    sawLogs: $('sawLogs'), sawPlanks: $('sawPlanks'), sawPoles: $('sawPoles'), factoryPlanks: $('factoryPlanks'), factoryRecipe: $('factoryRecipe'), looseLogs: $('looseLogs'), loosePlanks: $('loosePlanks'), looseBase: $('looseBase'), paletteItems: $('paletteItems'), programSelect: $('programSelect'), programView: $('programView'),
    llmMode: $('llmMode'), templateRouting: $('templateRouting'), ollamaEndpoint: $('ollamaEndpoint'), ollamaModel: $('ollamaModel'), refreshModels: $('refreshModels'), benchmarkBtn: $('benchmarkBtn'), ollamaStatus: $('ollamaStatus'), serverOllamaBtn: $('serverOllamaBtn'), localOllamaBtn: $('localOllamaBtn'), localOllamaWindowsHelp: $('localOllamaWindowsHelp'), asrMode: $('asrMode'), asrModeHelp: $('asrModeHelp'),
    buildPanel: $('buildPanel'), buildStatus: $('buildStatus'), buildDrawer: $('buildDrawer'), buildDrawerToggle: $('buildDrawerToggle'), zonesPanel: $('zonesPanel'), zonesDrawer: $('zonesDrawer'), zonesDrawerToggle: $('zonesDrawerToggle'), zoneList: $('zoneList'), drawZoneDrawerButton: $('drawZoneDrawerButton'), botMenu: $('botMenu'), structureMenu: $('structureMenu'),
    settingsOverlay: $('settingsOverlay'), settingsClose: $('settingsClose'), chatOverlay: $('chatOverlay'), chatToggle: $('chatToggle'), chatCollapse: $('chatCollapse'), assignmentToast: $('assignmentToast'),
    aiLog: $('aiLog'), dslWikiView: $('dslWikiView'), botDrawer: $('botDrawer'), botDrawerToggle: $('botDrawerToggle'), botSearch: $('botSearch'), botTeamForm: $('botTeamForm'), botTeamName: $('botTeamName'), botTeamColor: $('botTeamColor'), botTeamCreate: $('botTeamCreate'),
    multiplayerDrawer: $('multiplayerDrawer'), multiplayerDrawerToggle: $('multiplayerDrawerToggle'), multiplayerHostBtn: $('multiplayerHostBtn'), multiplayerJoinCode: $('multiplayerJoinCode'), multiplayerJoinBtn: $('multiplayerJoinBtn'), multiplayerSaveBtn: $('multiplayerSaveBtn'), multiplayerStatus: $('multiplayerStatus'), multiplayerSessionLink: $('multiplayerSessionLink'),
    mainMenuOverlay: $('mainMenuOverlay'), mainMenuNewBtn: $('mainMenuNewBtn'), mainMenuLoadBtn: $('mainMenuLoadBtn'), mainMenuLocalAiBtn: $('mainMenuLocalAiBtn'), mainMenuHostBtn: $('mainMenuHostBtn'), mainMenuJoinCode: $('mainMenuJoinCode'), mainMenuJoinBtn: $('mainMenuJoinBtn'), mainMenuStatus: $('mainMenuStatus'),
    resumeGameBtn: $('resumeGameBtn'), pauseGameBtn: $('pauseGameBtn'), saveGameBtn: $('saveGameBtn'), loadGameBtn: $('loadGameBtn'), quitToMainMenuBtn: $('quitToMainMenuBtn'), quitSavePrompt: $('quitSavePrompt'), saveAndQuitBtn: $('saveAndQuitBtn'), quitWithoutSaveBtn: $('quitWithoutSaveBtn'), cancelQuitBtn: $('cancelQuitBtn'), saveGameStatus: $('saveGameStatus'),
    knowledgePackList: $('knowledgePackList'), knowledgePackStatus: $('knowledgePackStatus'), assistantLoadoutView: $('assistantLoadoutView'), assistantBasePromptView: $('assistantBasePromptView'), assistantPromptPreview: $('assistantPromptPreview'), resetKnowledgePacks: $('resetKnowledgePacks'),
    audioSfxToggle: $('audioSfxToggle'), audioSfxVolume: $('audioSfxVolume'), audioSfxTest: $('audioSfxTest'), audioStation: $('audioStation'), audioMusicStart: $('audioMusicStart'), audioMusicStop: $('audioMusicStop'), audioMusicVolume: $('audioMusicVolume'), audioMusicStatus: $('audioMusicStatus')
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
  const SAVE_KEY = 'orchestratorGrove.save.v1';
  const RECENT_SAVE_MS = 30000;
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
  function readAssistantLoadout() {
    const raw = storageGet(ASSISTANT_LOADOUT_KEY);
    if (!raw) return normalizeAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT);
    try { return normalizeAssistantLoadout(JSON.parse(raw)); }
    catch { return normalizeAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT); }
  }
  let assistantLoadout = readAssistantLoadout();
  const getAssistantLoadout = () => assistantLoadout.slice();
  function getAssistantLoadoutDebug() {
    const summary = summarizeAssistantLoadout(assistantLoadout);
    return {
      selectedPackIds: summary.ids,
      selectedPackNames: summary.names,
      unlockedOps: summary.unlockedOps,
      optionalContext: summary.optionalContext,
      vocabulary: summary.vocabulary,
      concepts: summary.concepts,
      packs: summary.ids.map(id => {
        const pack = ASSISTANT_KNOWLEDGE_PACKS[id];
        return { id: pack.id, name: pack.name, concepts: pack.concepts, vocabulary: pack.vocabulary, optionalContext: pack.optionalContext || [], unlockedOps: pack.unlockedOps };
      })
    };
  }
  function updateAssistantPromptPreview() {
    if (!dom.assistantPromptPreview) return '';
    if (!game) {
      dom.assistantPromptPreview.textContent = 'Prompt preview will appear after the world loads.';
      return dom.assistantPromptPreview.textContent;
    }
    const requestText = (dom.chatInput?.value || '').trim() || '[current user request will appear here]';
    const model = dom.ollamaModel?.value || 'gemma4:12b';
    const { prompt } = buildOllamaRequestBody(requestText, game, { model, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout() });
    if (dom.assistantBasePromptView) dom.assistantBasePromptView.textContent = prompt.systemPrompt;
    if (dom.assistantLoadoutView) dom.assistantLoadoutView.textContent = JSON.stringify(prompt.knowledge, null, 2);
    dom.assistantPromptPreview.textContent = prompt.finalPrompt;
    return prompt.finalPrompt;
  }
  function updateAssistantLoadoutDebug(message = '') {
    const debug = getAssistantLoadoutDebug();
    if (dom.assistantLoadoutView && !game) dom.assistantLoadoutView.textContent = JSON.stringify(debug, null, 2);
    updateAssistantPromptPreview();
    if (dom.knowledgePackStatus) dom.knowledgePackStatus.textContent = message || `${debug.selectedPackIds.length} knowledge pack(s) equipped · ${debug.unlockedOps.length} DSL op(s) unlocked.`;
    return debug;
  }
  function renderKnowledgePackSelector(message = '') {
    if (!dom.knowledgePackList) return updateAssistantLoadoutDebug(message);
    const selected = new Set(assistantLoadout);
    dom.knowledgePackList.innerHTML = Object.values(ASSISTANT_KNOWLEDGE_PACKS).map(pack => `
      <article class="knowledge-pack-card">
        <label class="checkline knowledge-pack-title">
          <input type="checkbox" data-knowledge-pack="${escapeHtml(pack.id)}" ${selected.has(pack.id) ? 'checked' : ''} />
          <span><b>${escapeHtml(pack.name)}</b> <code>${escapeHtml(pack.id)}</code></span>
        </label>
        <p class="small"><b>Concepts:</b> ${escapeHtml(pack.concepts.join(' · '))}</p>
        <p class="small"><b>Vocabulary:</b> ${escapeHtml(pack.vocabulary.join(', '))}</p>
        <p class="small"><b>Optional runtime context:</b> ${escapeHtml((pack.optionalContext || []).join(', ') || 'none')}</p>
        <p class="small"><b>Ops:</b> ${pack.unlockedOps.map(op => `<code>${escapeHtml(op)}</code>`).join(' ')}</p>
      </article>
    `).join('');
    return updateAssistantLoadoutDebug(message);
  }
  function persistAssistantLoadout(nextLoadout) {
    assistantLoadout = normalizeAssistantLoadout(nextLoadout);
    const ok = storageSet(ASSISTANT_LOADOUT_KEY, JSON.stringify(assistantLoadout));
    renderKnowledgePackSelector(ok ? 'Knowledge pack loadout saved to this browser.' : 'Knowledge pack loadout changed, but browser storage is unavailable.');
    return assistantLoadout;
  }
  const getAsrMode = () => (ASR_MODES[dom.asrMode?.value] ? dom.asrMode.value : 'zipformer_whisper');
  const getTemplateRoutingEnabled = () => dom.templateRouting?.checked === true;
  function syncAsrModeUi() {
    const cfg = ASR_MODES[getAsrMode()];
    if (dom.asrStatus) dom.asrStatus.textContent = cfg.status;
    if (dom.asrModeHelp) dom.asrModeHelp.textContent = cfg.help;
  }

  let game;
  const storedAsrMode = storageGet(ASR_MODE_KEY);
  if (ASR_MODES[storedAsrMode] && dom.asrMode) dom.asrMode.value = storedAsrMode;
  if (dom.templateRouting) dom.templateRouting.checked = storageGet(TEMPLATE_ROUTING_KEY) === 'true';
  syncAsrModeUi();
  const chat = createChatController({ chatInput: dom.chatInput, chatForm: dom.chatForm, micButton: dom.micButton, asrStatus: dom.asrStatus, quickCommands: dom.quickCommands, getAsrMode, onSubmit: text => handleAssistant(text) });
  game = new Game({ canvas: dom.canvas, chat, dom, isChatActive: () => isChatOpen() });
  const audio = createAudioController();
  game.audio = audio;
  probeRenderer().then(renderer => { game.renderer = renderer; }).catch(err => { game.renderer = { text: 'Canvas 2D fallback', webgpu: false, reason: err.message }; });
  const multiplayer = createMultiplayerController({ game, dom, addChat });

  function setSettingsOpen(open) {
    dom.settingsOverlay.hidden = !open;
    dom.settingsOverlay.setAttribute('aria-hidden', String(!open));
    if (open) {
      setMainMenuOpen(false, { keepPaused: true });
      if (!game.multiplayer?.enabled) game.setPaused(true);
      setBuildDrawerOpen(false); setBotDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.cancelPlacement(); game.cancelZoneDrawing(false); game.hideMenus(); syncSaveUi(); dom.settingsClose.focus();
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
    const open = [dom.botDrawer, dom.buildDrawer, dom.zonesDrawer, dom.multiplayerDrawer].some(drawer => drawer && !drawer.classList.contains('is-collapsed'));
    dom.gameStage?.classList.toggle('has-open-drawer', open);
  }
  function setBotDrawerOpen(open) {
    dom.botDrawer?.classList.toggle('is-collapsed', !open);
    dom.botDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setBuildDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); }
    syncDrawerStack();
  }
  function toggleBotDrawer() { setBotDrawerOpen(dom.botDrawer?.classList.contains('is-collapsed')); }
  function setBuildDrawerOpen(open) {
    dom.buildDrawer?.classList.toggle('is-collapsed', !open);
    dom.buildDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); }
    syncDrawerStack();
  }
  function toggleBuildDrawer() { setBuildDrawerOpen(dom.buildDrawer?.classList.contains('is-collapsed')); }
  function setZonesDrawerOpen(open) {
    dom.zonesDrawer?.classList.toggle('is-collapsed', !open);
    dom.zonesDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setBuildDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus(); game.syncZonesUi?.(); }
    syncDrawerStack();
  }
  function toggleZonesDrawer() { setZonesDrawerOpen(dom.zonesDrawer?.classList.contains('is-collapsed')); }
  function setMultiplayerDrawerOpen(open) {
    dom.multiplayerDrawer?.classList.toggle('is-collapsed', !open);
    dom.multiplayerDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setBuildDrawerOpen(false); setZonesDrawerOpen(false); game.hideMenus(); }
    syncDrawerStack();
  }
  function toggleMultiplayerDrawer() { setMultiplayerDrawerOpen(dom.multiplayerDrawer?.classList.contains('is-collapsed')); }
  function hasSavedGame() { return !!storageGet(SAVE_KEY); }
  let lastSuccessfulSaveAt = 0;
  function getLastSaveAgeMs() { return lastSuccessfulSaveAt ? Date.now() - lastSuccessfulSaveAt : Infinity; }
  function wasSavedRecently() { return getLastSaveAgeMs() <= RECENT_SAVE_MS; }
  function setQuitSavePromptOpen(open) {
    if (!dom.quitSavePrompt) return;
    dom.quitSavePrompt.hidden = !open;
    dom.quitSavePrompt.classList.toggle('is-open', open);
    if (open) setTimeout(() => dom.saveAndQuitBtn?.focus(), 0);
  }
  function syncSaveUi(message = '') {
    const hasSave = hasSavedGame();
    dom.mainMenuLoadBtn && (dom.mainMenuLoadBtn.disabled = !hasSave);
    dom.loadGameBtn && (dom.loadGameBtn.disabled = !hasSave);
    const pausedText = game.paused ? 'Paused' : 'Running';
    if (dom.pauseGameBtn) dom.pauseGameBtn.disabled = !!game.multiplayer?.enabled || game.paused;
    if (dom.resumeGameBtn) dom.resumeGameBtn.disabled = !!game.multiplayer?.enabled || !game.paused;
    const status = message || (hasSave ? `${pausedText}. Browser-cache save available.` : `${pausedText}. No browser-cache save yet.`);
    if (dom.saveGameStatus) dom.saveGameStatus.textContent = status;
    if (dom.mainMenuStatus) dom.mainMenuStatus.textContent = hasSave ? 'Saved game found in this browser cache.' : 'No saved game in this browser cache yet.';
  }
  function setMainMenuOpen(open, { keepPaused = false } = {}) {
    if (!dom.mainMenuOverlay) return;
    dom.mainMenuOverlay.hidden = !open;
    dom.mainMenuOverlay.classList.toggle('is-hidden', !open);
    if (open) {
      setSettingsOpen(false); setBuildDrawerOpen(false); setBotDrawerOpen(false); setZonesDrawerOpen(false); setMultiplayerDrawerOpen(false); game.hideMenus();
      game.setPaused(true);
      syncSaveUi();
      setTimeout(() => dom.mainMenuNewBtn?.focus(), 0);
    } else if (!keepPaused && !game.multiplayer?.enabled) {
      game.setPaused(false);
      syncSaveUi();
    }
  }
  function saveGameToCache() {
    const payload = game.exportSave();
    const ok = storageSet(SAVE_KEY, JSON.stringify(payload));
    if (ok) {
      lastSuccessfulSaveAt = Date.parse(payload.savedAt) || Date.now();
      setQuitSavePromptOpen(false);
    }
    syncSaveUi(ok ? `Saved to browser cache at ${new Date(payload.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Save failed: browser cache unavailable.');
    return ok ? payload : null;
  }
  function loadGameFromCache({ closeMenus = true } = {}) {
    const raw = storageGet(SAVE_KEY);
    if (!raw) { syncSaveUi('No saved game in browser cache.'); return null; }
    try {
      const parsedSave = JSON.parse(raw);
      const state = game.loadSave(parsedSave);
      lastSuccessfulSaveAt = Date.parse(parsedSave.savedAt) || 0;
      setQuitSavePromptOpen(false);
      if (dom.targetFps) { dom.targetFps.value = String(game.targetFps); dom.targetFpsValue.textContent = String(game.targetFps); }
      if (dom.maxBots) { dom.maxBots.value = String(game.maxBots); dom.maxBotsValue.textContent = String(game.maxBots); }
      if (closeMenus) { setMainMenuOpen(false); setSettingsOpen(false); }
      game.setPaused(false);
      syncSaveUi('Loaded saved game from browser cache.');
      return state;
    } catch (err) {
      syncSaveUi(`Load failed: ${err.message}`);
      return null;
    }
  }
  function startNewGameFromMenu() {
    game.resetSoloWorld();
    lastSuccessfulSaveAt = 0;
    setQuitSavePromptOpen(false);
    setMainMenuOpen(false);
    game.setPaused(false);
    syncSaveUi('Started a new single-player game.');
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
  async function hostFromMainMenu() {
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
    if (parsed.meta) dom.ollamaStatus.textContent = parsed.meta;
    if (parsed.help) return addChat('assistant', `${parsed.meta ? escapeHtml(parsed.meta) : `Available: ${PROGRAMS.map(p => `<code>${p}</code>`).join(', ')}. Click bots to inspect DSL. Right-click buildings to add their name to chat.`}${rawModelResponseDetailsHtml(parsed)}`);
    for (const assignment of parsed.dslAssignments || []) {
      const res = game.assignCustomDslProgram(assignment);
      if (!res.ok) {
        addChat('error', escapeHtml(res.error));
        continue;
      }
      const message = `Generated DSL for <b>Bot ${assignment.botId}</b>: <code>${escapeHtml(res.program.name)}</code>${dslStepsHtml(res.steps)}`;
      addChat('assistant', message);
      showAssignmentToast(`Generated DSL for <b>Bot ${assignment.botId}</b>.`);
    }
    for (const call of parsed.calls || []) {
      const res = game.assignBotProgram(call.arguments);
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
  }

  async function handleAssistant(text) {
    addChat('user', escapeHtml(text));
    if (dom.llmMode.value === 'ollama') {
      const endpoint = (dom.ollamaEndpoint.value.trim().replace(/\/$/, '') || defaultOllamaEndpoint());
      const parsed = await parseWithOllama(text, game, { endpoint, model: dom.ollamaModel.value, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout() });
      const { debug, ...parsedForLog } = parsed;
      logChatAi({ mode: 'ollama', sent: debug?.sent || { endpoint, model: dom.ollamaModel.value, text, loadout: getAssistantLoadout() }, returned: debug?.returned || parsedForLog });
      handleParsed(parsed);
    } else {
      const parsed = parseAssistantRequest(text, game, { enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout() });
      logChatAi({ mode: 'mock parser', sent: { text, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout() }, returned: parsed });
      handleParsed(parsed);
    }
  }

  function syncLocalOllamaHelp() {
    const endpoint = (dom.ollamaEndpoint.value || '').trim().replace(/\/$/, '');
    const isLocalOllama = dom.llmMode.value === 'ollama' && endpoint === 'http://127.0.0.1:11434';
    if (dom.localOllamaWindowsHelp) dom.localOllamaWindowsHelp.hidden = !isLocalOllama;
  }

  function syncAudioUi(message = '') {
    if (dom.audioSfxToggle) dom.audioSfxToggle.checked = audio.state.enabled;
    if (dom.audioSfxVolume) dom.audioSfxVolume.value = String(audio.state.sfxVolume);
    if (dom.audioMusicVolume) dom.audioMusicVolume.value = String(audio.state.musicVolume);
    if (dom.audioStation) dom.audioStation.value = audio.state.station;
    if (dom.audioMusicStatus) {
      const station = audio.stations[audio.state.station];
      const playing = audio.isMusicPlaying();
      dom.audioMusicStatus.textContent = message || `${audio.state.enabled ? 'SFX on' : 'SFX off'} · ${playing ? `Playing ${station?.label || audio.state.station}` : 'Cozy radio stopped'}.`;
    }
  }

  function initAudioUi() {
    if (dom.audioStation) {
      dom.audioStation.innerHTML = Object.entries(audio.stations).map(([id, station]) => `<option value="${escapeHtml(id)}">${escapeHtml(station.label)}</option>`).join('');
      dom.audioStation.value = audio.state.station;
    }
    syncAudioUi();
    dom.audioSfxToggle?.addEventListener('change', () => syncAudioUi(audio.setSfxEnabled(dom.audioSfxToggle.checked) ? 'Sound effects enabled.' : 'Sound effects muted.'));
    dom.audioSfxVolume?.addEventListener('input', () => { audio.setSfxVolume(dom.audioSfxVolume.value); syncAudioUi(); });
    dom.audioSfxTest?.addEventListener('click', () => { audio.play('craft_done', { cooldownKey: 'ui_test', minGapMs: 0 }); syncAudioUi('Played generated test chime.'); });
    dom.audioStation?.addEventListener('change', () => { audio.state.station = dom.audioStation.value; syncAudioUi(); });
    dom.audioMusicVolume?.addEventListener('input', () => { audio.setMusicVolume(dom.audioMusicVolume.value); syncAudioUi(); });
    dom.audioMusicStart?.addEventListener('click', async () => {
      try {
        const station = await audio.startMusic(dom.audioStation?.value || audio.state.station);
        syncAudioUi(`Playing ${station.label}. Stream: ${station.url}`);
      } catch (err) {
        syncAudioUi(`Could not start radio: ${err.message}`);
      }
    });
    dom.audioMusicStop?.addEventListener('click', () => { audio.stopMusic(); syncAudioUi('Cozy radio stopped.'); });
  }

  for (const id of PROGRAMS) { const o = document.createElement('option'); o.value = id; o.textContent = id; dom.programSelect.appendChild(o); }
  const renderProgram = () => dom.programView.textContent = JSON.stringify(PROGRAM_TEMPLATES[dom.programSelect.value], null, 2);
  dom.programSelect.addEventListener('change', renderProgram); renderProgram();
  if (dom.dslWikiView) dom.dslWikiView.textContent = formatDslActionWiki();
  renderKnowledgePackSelector();
  initAudioUi();

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
  dom.targetFps.addEventListener('input', () => { game.targetFps = Number(dom.targetFps.value); dom.targetFpsValue.textContent = String(game.targetFps); });
  dom.maxBots.addEventListener('input', () => { game.maxBots = Number(dom.maxBots.value); dom.maxBotsValue.textContent = String(game.maxBots); });
  dom.refreshModels.addEventListener('click', async () => { try { await refreshOllamaModels({ endpointInput: dom.ollamaEndpoint, modelSelect: dom.ollamaModel, statusEl: dom.ollamaStatus }); updateAssistantPromptPreview(); } catch (e) { dom.ollamaStatus.textContent = `Could not load models: ${e.message}`; } });
  dom.llmMode.addEventListener('change', () => { syncLocalOllamaHelp(); updateAssistantPromptPreview(); });
  dom.ollamaEndpoint.addEventListener('input', () => { syncLocalOllamaHelp(); updateAssistantPromptPreview(); });
  dom.ollamaModel?.addEventListener('change', updateAssistantPromptPreview);
  dom.chatInput?.addEventListener('input', updateAssistantPromptPreview);
  dom.asrMode?.addEventListener('change', () => { storageSet(ASR_MODE_KEY, getAsrMode()); syncAsrModeUi(); });
  dom.templateRouting?.addEventListener('change', () => { storageSet(TEMPLATE_ROUTING_KEY, String(getTemplateRoutingEnabled())); updateAssistantPromptPreview(); });
  dom.knowledgePackList?.addEventListener('change', e => {
    if (!e.target.matches('[data-knowledge-pack]')) return;
    const ids = [...dom.knowledgePackList.querySelectorAll('[data-knowledge-pack]:checked')].map(input => input.dataset.knowledgePack);
    persistAssistantLoadout(ids);
  });
  dom.resetKnowledgePacks?.addEventListener('click', () => persistAssistantLoadout(DEFAULT_ASSISTANT_LOADOUT));
  dom.serverOllamaBtn?.addEventListener('click', () => {
    const serverProxy = location.hostname === 'docs.pau1.cloud' ? '/ollama-proxy' : 'https://docs.pau1.cloud/ollama-proxy';
    dom.llmMode.value = 'ollama';
    dom.ollamaEndpoint.value = serverProxy;
    dom.ollamaStatus.textContent = 'Server proxy selected. Click Refresh to load VPS Ollama models.';
    syncLocalOllamaHelp();
    updateAssistantPromptPreview();
  });
  dom.localOllamaBtn?.addEventListener('click', () => {
    dom.llmMode.value = 'ollama';
    dom.ollamaEndpoint.value = 'http://127.0.0.1:11434';
    dom.ollamaStatus.textContent = 'Local Ollama selected. Start Ollama on your machine with CORS for https://docs.pau1.cloud, then click Refresh.';
    syncLocalOllamaHelp();
    updateAssistantPromptPreview();
  });
  dom.benchmarkBtn.addEventListener('click', async () => { const endpoint = (dom.ollamaEndpoint.value.trim().replace(/\/$/, '') || defaultOllamaEndpoint()); const started = performance.now(); try { const parsed = await parseWithOllama('Bot 1 chop wood', game, { endpoint, model: dom.ollamaModel.value, enableTemplates: getTemplateRoutingEnabled(), loadout: getAssistantLoadout() }); dom.ollamaStatus.textContent = `${parsed.meta || 'Benchmark'} valid calls=${parsed.calls?.length || 0}, total=${Math.round(performance.now()-started)}ms`; } catch (e) { dom.ollamaStatus.textContent = `Benchmark failed: ${e.message}`; } });
  dom.ollamaEndpoint.value = defaultOllamaEndpoint();
  syncLocalOllamaHelp();
  updateAssistantPromptPreview();
  dom.settingsClose.addEventListener('click', () => setSettingsOpen(false));
  dom.resumeGameBtn?.addEventListener('click', () => setSettingsOpen(false));
  dom.pauseGameBtn?.addEventListener('click', () => { if (!game.multiplayer?.enabled) { game.setPaused(true); syncSaveUi('Game paused.'); } });
  dom.saveGameBtn?.addEventListener('click', saveGameToCache);
  dom.loadGameBtn?.addEventListener('click', () => loadGameFromCache());
  dom.quitToMainMenuBtn?.addEventListener('click', () => quitToMainMenu());
  dom.saveAndQuitBtn?.addEventListener('click', () => quitToMainMenu({ saveFirst: true }));
  dom.quitWithoutSaveBtn?.addEventListener('click', () => quitToMainMenu({ force: true }));
  dom.cancelQuitBtn?.addEventListener('click', () => { setQuitSavePromptOpen(false); syncSaveUi('Quit cancelled.'); });
  dom.mainMenuNewBtn?.addEventListener('click', startNewGameFromMenu);
  dom.mainMenuLoadBtn?.addEventListener('click', () => loadGameFromCache());
  dom.mainMenuLocalAiBtn?.addEventListener('click', startLocalAiFromMainMenu);
  dom.mainMenuHostBtn?.addEventListener('click', () => hostFromMainMenu());
  dom.mainMenuJoinBtn?.addEventListener('click', () => joinFromMainMenu());
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

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      e.preventDefault();
      if (dom.teachPanel && !dom.teachPanel.hidden) { game.closeTeachPanel(); return; }
      if (isChatOpen()) setChatOpen(false);
      toggleSettings();
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
  window.assistantKnowledgePacks = ASSISTANT_KNOWLEDGE_PACKS;
  Object.defineProperty(window, 'assistantLoadout', { get: () => getAssistantLoadout(), configurable: true });
  window.getAssistantLoadout = getAssistantLoadout;
  window.getAssistantLoadoutDebug = getAssistantLoadoutDebug;
  window.getAssistantLoadoutText = () => JSON.stringify(getAssistantLoadoutDebug(), null, 2);
  window.getAssistantPromptPreview = updateAssistantPromptPreview;
  window.setAssistantLoadout = ids => persistAssistantLoadout(ids);
  window.generateAssistantDsl = (text, options = {}) => parseAssistantRequest(text, game, { enableTemplates: options.enableTemplates ?? true, loadout: getAssistantLoadout() });
  window.dslActionWiki = DSL_ACTION_WIKI;
  window.dslActionWikiText = formatDslActionWiki();
  window.allowedProgramOps = [...new Set(Object.values(PROGRAM_TEMPLATES).flatMap(t => t.steps.map(s => s.op)))];
  window.validateDslProgram = p => game.validateDslProgram(p);
  window.getGameState = () => game.getState();
  window.gameMenuDebug = { save: saveGameToCache, load: loadGameFromCache, startNew: startNewGameFromMenu, openMainMenu: () => setMainMenuOpen(true), closeMainMenu: () => setMainMenuOpen(false), quitToMainMenu, showQuitSavePrompt: () => setQuitSavePromptOpen(true), hideQuitSavePrompt: () => setQuitSavePromptOpen(false), hasSavedGame, wasSavedRecently, getLastSaveAgeMs, setLastSaveAgeSeconds: seconds => { lastSuccessfulSaveAt = Number.isFinite(Number(seconds)) ? Date.now() - (Number(seconds) * 1000) : 0; return getLastSaveAgeMs(); }, isPaused: () => !!game.paused };
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
    assignToBot: botId => game.assignRecordedLoopToBot(botId),
    pauseBot: botId => { const bot = game.findBot(botId); if (!bot) return null; bot.paused = true; return window.getGameState(); },
    openBotMenu: botId => { const bot = game.findBot(botId); if (!bot) return null; game.showBotMenu(bot, 320, 240); return window.getGameState(); },
    setBotName: (botId, name) => { game.setBotName(botId, name); return window.getGameState(); },
    createBotTeam: (name, color) => game.createBotTeam(name, color),
    assignBotTeam: (botId, teamId) => { game.assignBotToTeam(botId, teamId); return window.getGameState(); },
    setBotInventory: (botId, type) => { const bot = game.findBot(botId); if (!bot) return null; bot.inventory = type ? { type, count: 1 } : null; return window.getGameState(); },
    setBotEquipment: (botId, type) => { const bot = game.findBot(botId); if (!bot) return null; if (type) game.equipActor(bot, type); else bot.equipment = null; return window.getGameState(); },
    movePlayerTo: (x, y) => { game.player.x = x; game.player.y = y; game.player.target = null; return window.getGameState(); },
    setInventory: type => { game.player.inventory = type ? { type, count: 1 } : null; return window.getGameState(); },
    equipPlayer: type => { if (type) game.equipActor(game.player, type); else game.player.equipment = null; return window.getGameState(); },
    spawnItem: (type, x, y, count = 1) => { game.spawnItem(type, x, y, count); return window.getGameState(); },
    switchWeapon: () => { game.switchWeaponSet(); return window.getGameState(); },
    placeStructure: (type, x, y) => game.addStructure(type, x, y),
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
  window.validateAssistantToolCalls = raw => validateToolCalls(raw, game, { loadout: getAssistantLoadout() });
  window.validateAssistantDslAssignments = raw => validateDslAssignments(raw, game, { loadout: getAssistantLoadout() });
  window.voiceInputDebug = { applyStreamingTranscript: chat.applyTranscript, insertTextAtChatCursor: chat.insertAtCursor, defaultAsrWsUrl: chat.wsUrl, transcribeUrl: chat.transcribeUrl, getChatSelection: chat.getSelection, getAsrMode };
  window.audioDebug = { controller: audio, play: name => audio.play(name, { cooldownKey: `debug:${name}`, minGapMs: 0 }), startMusic: station => audio.startMusic(station), stopMusic: () => audio.stopMusic(), state: () => ({ enabled: audio.state.enabled, sfxVolume: audio.state.sfxVolume, musicVolume: audio.state.musicVolume, station: audio.state.station, musicPlaying: audio.isMusicPlaying(), stations: Object.keys(audio.stations) }) };

  window.uiDebug = { toggleSettings, setSettingsOpen, toggleChat, setChatOpen, setSettingsTab, toggleBotDrawer, setBotDrawerOpen, toggleBuildDrawer, setBuildDrawerOpen, toggleZonesDrawer, setZonesDrawerOpen, toggleMultiplayerDrawer, setMultiplayerDrawerOpen, setBuildTab, showAssignmentToast, hideAssignmentToast };

  addChat('assistant', 'Ready. WASD/arrows pan the camera, mouse wheel zooms around your cursor. Main menu now offers Local vs AI for the throne-lane creep map, or Online Multiplayer for the lake-camp map.');
  game.syncBuildUi(); game.syncTeachUi(); game.syncZonesUi?.(); game.syncBotDrawerUi?.(); syncSaveUi();
  const params = new URLSearchParams(window.location.search);
  if (!params.get('multiplayer')) setMainMenuOpen(true);
  startGameLoop(game);
}
