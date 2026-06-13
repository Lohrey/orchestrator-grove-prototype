import { PROGRAMS, PROGRAM_TEMPLATES, DSL_ACTION_WIKI, formatDslActionWiki } from './data.js?v=t_fc028066';
import { createChatController } from './chat.js?v=20260613-player-tools';
import { Game } from './world.js?v=t_fc028066';
import { createMultiplayerController } from './multiplayer.js?v=t_0fefe6da';
import { probeRenderer, startGameLoop } from './browser-runtime.js?v=t_76822d1f';
import { defaultOllamaEndpoint, parseAssistantRequest, parseWithOllama, refreshOllamaModels, validateToolCalls } from './assistant.js?v=t_c08afb05';
import { escapeHtml } from './utils.js?v=20260613-player-tools';

export function startGame() {
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('game'), chatLog: $('chatLog'), chatForm: $('chatForm'), chatInput: $('chatInput'), micButton: $('micButton'), asrStatus: $('asrStatus'), quickCommands: $('quickCommands'), drawZoneButton: $('drawZoneButton'),
    botList: $('botList'), statline: $('statline'), rendererStatus: $('rendererStatus'), targetFps: $('targetFps'), targetFpsValue: $('targetFpsValue'), maxBots: $('maxBots'), maxBotsValue: $('maxBotsValue'),
    teachPanel: $('teachPanel'), teachRecordBtn: $('teachRecordBtn'), teachAssignBtn: $('teachAssignBtn'), teachBotId: $('teachBotId'), teachStatus: $('teachStatus'), teachSteps: $('teachSteps'),
    sawLogs: $('sawLogs'), sawPlanks: $('sawPlanks'), sawPoles: $('sawPoles'), factoryPlanks: $('factoryPlanks'), factoryRecipe: $('factoryRecipe'), looseLogs: $('looseLogs'), loosePlanks: $('loosePlanks'), looseBase: $('looseBase'), paletteItems: $('paletteItems'), programSelect: $('programSelect'), programView: $('programView'),
    llmMode: $('llmMode'), templateRouting: $('templateRouting'), ollamaEndpoint: $('ollamaEndpoint'), ollamaModel: $('ollamaModel'), refreshModels: $('refreshModels'), benchmarkBtn: $('benchmarkBtn'), ollamaStatus: $('ollamaStatus'), serverOllamaBtn: $('serverOllamaBtn'), localOllamaBtn: $('localOllamaBtn'), localOllamaWindowsHelp: $('localOllamaWindowsHelp'), asrMode: $('asrMode'), asrModeHelp: $('asrModeHelp'),
    buildPanel: $('buildPanel'), buildStatus: $('buildStatus'), buildDrawer: $('buildDrawer'), buildDrawerToggle: $('buildDrawerToggle'), zonesPanel: $('zonesPanel'), zonesDrawer: $('zonesDrawer'), zonesDrawerToggle: $('zonesDrawerToggle'), zoneList: $('zoneList'), drawZoneDrawerButton: $('drawZoneDrawerButton'), botMenu: $('botMenu'), structureMenu: $('structureMenu'),
    settingsOverlay: $('settingsOverlay'), settingsClose: $('settingsClose'), chatOverlay: $('chatOverlay'), chatToggle: $('chatToggle'), chatCollapse: $('chatCollapse'), assignmentToast: $('assignmentToast'),
    aiLog: $('aiLog'), dslWikiView: $('dslWikiView'), botDrawer: $('botDrawer'), botDrawerToggle: $('botDrawerToggle'),
    multiplayerHostBtn: $('multiplayerHostBtn'), multiplayerJoinCode: $('multiplayerJoinCode'), multiplayerJoinBtn: $('multiplayerJoinBtn'), multiplayerSaveBtn: $('multiplayerSaveBtn'), multiplayerStatus: $('multiplayerStatus'), multiplayerSessionLink: $('multiplayerSessionLink')
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
  function logChatAi({ mode, sent, returned }) {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { time: stamp, mode, sent, returned };
    console.info('[Orchestrator chat AI]', entry);
    if (!dom.aiLog) return;
    const block = `[${stamp}] ${mode}\nSent:\n${stringifyLog(sent)}\nReturned:\n${stringifyLog(returned)}\n\n`;
    const previous = dom.aiLog.textContent === 'No chat requests yet.' ? '' : (dom.aiLog.textContent || '');
    dom.aiLog.textContent = `${block}${previous}`.slice(0, 12000);
  }
  const ASR_MODE_KEY = 'orchestratorGrove.asrMode';
  const TEMPLATE_ROUTING_KEY = 'orchestratorGrove.templateRoutingEnabled';
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
  const storageSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
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
  probeRenderer().then(renderer => { game.renderer = renderer; }).catch(err => { game.renderer = { text: 'Canvas 2D fallback', webgpu: false, reason: err.message }; });
  const multiplayer = createMultiplayerController({ game, dom, addChat });

  function setSettingsOpen(open) {
    dom.settingsOverlay.hidden = !open;
    dom.settingsOverlay.setAttribute('aria-hidden', String(!open));
    if (open) { setBuildDrawerOpen(false); setBotDrawerOpen(false); setZonesDrawerOpen(false); game.cancelPlacement(); game.cancelZoneDrawing(false); game.hideMenus(); dom.settingsClose.focus(); }
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
  function setBotDrawerOpen(open) {
    dom.botDrawer?.classList.toggle('is-collapsed', !open);
    dom.botDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setBuildDrawerOpen(false); setZonesDrawerOpen(false); game.hideMenus(); }
  }
  function toggleBotDrawer() { setBotDrawerOpen(dom.botDrawer?.classList.contains('is-collapsed')); }
  function setBuildDrawerOpen(open) {
    dom.buildDrawer?.classList.toggle('is-collapsed', !open);
    dom.buildDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setZonesDrawerOpen(false); game.hideMenus(); }
  }
  function toggleBuildDrawer() { setBuildDrawerOpen(dom.buildDrawer?.classList.contains('is-collapsed')); }
  function setZonesDrawerOpen(open) {
    dom.zonesDrawer?.classList.toggle('is-collapsed', !open);
    dom.zonesDrawerToggle?.setAttribute('aria-expanded', String(open));
    if (open) { setSettingsOpen(false); setBotDrawerOpen(false); setBuildDrawerOpen(false); game.hideMenus(); game.syncZonesUi?.(); }
  }
  function toggleZonesDrawer() { setZonesDrawerOpen(dom.zonesDrawer?.classList.contains('is-collapsed')); }
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

  function handleParsed(parsed) {
    if (parsed.meta) dom.ollamaStatus.textContent = parsed.meta;
    if (parsed.help) return addChat('assistant', parsed.meta ? escapeHtml(parsed.meta) : `Available: ${PROGRAMS.map(p => `<code>${p}</code>`).join(', ')}. Click bots to inspect DSL. Right-click buildings to add their name to chat.`);
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
      const parsed = await parseWithOllama(text, game, { endpoint, model: dom.ollamaModel.value, enableTemplates: getTemplateRoutingEnabled() });
      const { debug, ...parsedForLog } = parsed;
      logChatAi({ mode: 'ollama', sent: debug?.sent || { endpoint, model: dom.ollamaModel.value, text }, returned: debug?.returned || parsedForLog });
      handleParsed(parsed);
    } else {
      const parsed = parseAssistantRequest(text, game, { enableTemplates: getTemplateRoutingEnabled() });
      logChatAi({ mode: 'mock parser', sent: { text, enableTemplates: getTemplateRoutingEnabled() }, returned: parsed });
      handleParsed(parsed);
    }
  }

  function syncLocalOllamaHelp() {
    const endpoint = (dom.ollamaEndpoint.value || '').trim().replace(/\/$/, '');
    const isLocalOllama = dom.llmMode.value === 'ollama' && endpoint === 'http://127.0.0.1:11434';
    if (dom.localOllamaWindowsHelp) dom.localOllamaWindowsHelp.hidden = !isLocalOllama;
  }

  for (const id of PROGRAMS) { const o = document.createElement('option'); o.value = id; o.textContent = id; dom.programSelect.appendChild(o); }
  const renderProgram = () => dom.programView.textContent = JSON.stringify(PROGRAM_TEMPLATES[dom.programSelect.value], null, 2);
  dom.programSelect.addEventListener('change', renderProgram); renderProgram();
  if (dom.dslWikiView) dom.dslWikiView.textContent = formatDslActionWiki();

  dom.buildPanel.addEventListener('click', e => {
    const tab = e.target.closest('[data-build-tab]');
    if (tab) { setBuildTab(tab.dataset.buildTab); return; }
    const b = e.target.closest('[data-build]');
    if (b) { game.setPlacement(b.dataset.build); setBuildDrawerOpen(false); return; }
    if (e.target.closest('[data-cancel-build]')) { game.cancelPlacement(); setBuildDrawerOpen(false); }
  });
  dom.teachRecordBtn?.addEventListener('click', () => { const botId = Number(dom.teachBotId?.value || game.recorder.targetBotId || 1); game.recorder.recording ? game.stopTeachRecording() : game.startTeachRecording(botId); });
  dom.teachAssignBtn?.addEventListener('click', () => {
    const botId = Number(dom.teachBotId?.value || 1);
    const res = game.assignRecordedLoopToBot(botId);
    if (res.ok) showAssignmentToast(`Assigned recorded loop to <b>Bot ${botId}</b>.`);
    else if (dom.teachStatus) dom.teachStatus.textContent = res.error;
  });
  dom.targetFps.addEventListener('input', () => { game.targetFps = Number(dom.targetFps.value); dom.targetFpsValue.textContent = String(game.targetFps); });
  dom.maxBots.addEventListener('input', () => { game.maxBots = Number(dom.maxBots.value); dom.maxBotsValue.textContent = String(game.maxBots); });
  dom.refreshModels.addEventListener('click', async () => { try { await refreshOllamaModels({ endpointInput: dom.ollamaEndpoint, modelSelect: dom.ollamaModel, statusEl: dom.ollamaStatus }); } catch (e) { dom.ollamaStatus.textContent = `Could not load models: ${e.message}`; } });
  dom.llmMode.addEventListener('change', syncLocalOllamaHelp);
  dom.ollamaEndpoint.addEventListener('input', syncLocalOllamaHelp);
  dom.asrMode?.addEventListener('change', () => { storageSet(ASR_MODE_KEY, getAsrMode()); syncAsrModeUi(); });
  dom.templateRouting?.addEventListener('change', () => { storageSet(TEMPLATE_ROUTING_KEY, String(getTemplateRoutingEnabled())); });
  dom.serverOllamaBtn?.addEventListener('click', () => {
    const serverProxy = location.hostname === 'docs.pau1.cloud' ? '/ollama-proxy' : 'https://docs.pau1.cloud/ollama-proxy';
    dom.llmMode.value = 'ollama';
    dom.ollamaEndpoint.value = serverProxy;
    dom.ollamaStatus.textContent = 'Server proxy selected. Click Refresh to load VPS Ollama models.';
    syncLocalOllamaHelp();
  });
  dom.localOllamaBtn?.addEventListener('click', () => {
    dom.llmMode.value = 'ollama';
    dom.ollamaEndpoint.value = 'http://127.0.0.1:11434';
    dom.ollamaStatus.textContent = 'Local Ollama selected. Start Ollama on your machine with CORS for https://docs.pau1.cloud, then click Refresh.';
    syncLocalOllamaHelp();
  });
  dom.benchmarkBtn.addEventListener('click', async () => { const endpoint = (dom.ollamaEndpoint.value.trim().replace(/\/$/, '') || defaultOllamaEndpoint()); const started = performance.now(); try { const parsed = await parseWithOllama('Bot 1 chop wood', game, { endpoint, model: dom.ollamaModel.value, enableTemplates: getTemplateRoutingEnabled() }); dom.ollamaStatus.textContent = `${parsed.meta || 'Benchmark'} valid calls=${parsed.calls?.length || 0}, total=${Math.round(performance.now()-started)}ms`; } catch (e) { dom.ollamaStatus.textContent = `Benchmark failed: ${e.message}`; } });
  dom.ollamaEndpoint.value = defaultOllamaEndpoint();
  syncLocalOllamaHelp();
  dom.settingsClose.addEventListener('click', () => setSettingsOpen(false));
  dom.settingsOverlay.addEventListener('click', e => { if (e.target === dom.settingsOverlay) setSettingsOpen(false); });
  document.querySelector('.settings-tabs')?.addEventListener('click', e => { const tab = e.target.closest('[data-settings-tab]'); if (tab) setSettingsTab(tab.dataset.settingsTab); });
  dom.chatToggle.addEventListener('click', toggleChat);
  dom.chatCollapse.addEventListener('click', () => setChatOpen(false));
  dom.botDrawerToggle?.addEventListener('click', toggleBotDrawer);
  dom.buildDrawerToggle?.addEventListener('click', toggleBuildDrawer);
  dom.zonesDrawerToggle?.addEventListener('click', toggleZonesDrawer);
  dom.drawZoneButton.addEventListener('click', beginDrawZone);
  dom.drawZoneDrawerButton?.addEventListener('click', beginDrawZone);
  setSettingsTab('controls');
  setBuildTab('production');

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); if (isChatOpen()) setChatOpen(false); else toggleSettings(); return; }
    if (k === 'enter' && !chat.isTypingTarget(e.target) && dom.settingsOverlay.hidden) { e.preventDefault(); if (!isChatOpen()) { setBuildDrawerOpen(false); setZonesDrawerOpen(false); game.hideMenus(); setChatOpen(true); } else dom.chatInput.focus(); return; }
    if ((k === 'l') && !chat.isTypingTarget(e.target)) { e.preventDefault(); toggleChat(); return; }
    if ((k === 'b') && !chat.isTypingTarget(e.target)) { e.preventDefault(); toggleBuildDrawer(); return; }
    if (chat.isTypingTarget(e.target) || !dom.settingsOverlay.hidden) return;
    if (k === 'q') { e.preventDefault(); if (!e.repeat) game.manualDropItem(); return; }
    if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','e'].includes(k)) e.preventDefault();
    game.keys.add(k);
    if (k === 'e' && !e.repeat) game.interact();
  });
  window.addEventListener('keyup', e => { if (!chat.isTypingTarget(e.target)) game.keys.delete(e.key.toLowerCase()); });
  window.addEventListener('click', e => { if (!e.target.closest('.entity-menu') && e.target !== dom.canvas) game.hideMenus(); });

  window.multiplayerDebug = multiplayer;
  window.assignBotProgram = args => game.assignBotProgram(args);
  window.programTemplates = PROGRAM_TEMPLATES;
  window.dslActionWiki = DSL_ACTION_WIKI;
  window.dslActionWikiText = formatDslActionWiki();
  window.allowedProgramOps = [...new Set(Object.values(PROGRAM_TEMPLATES).flatMap(t => t.steps.map(s => s.op)))];
  window.validateDslProgram = p => game.validateDslProgram(p);
  window.getGameState = () => game.getState();
  window.getCameraState = () => ({ camera: { ...game.camera }, player: { x: game.player.x, y: game.player.y, target: game.player.target ? { ...game.player.target } : null }, map: { ...game.map } });
  window.getWorldObjects = () => game.getObjectRegistry();
  window.getHoverState = () => game.getHoverState();
  window.beginZoneDrawing = () => game.beginZoneDrawing();
  window.teachDebug = {
    start: botId => game.startTeachRecording(botId),
    stop: () => game.stopTeachRecording(),
    state: () => game.getRecorderState(),
    deleteStep: index => game.deleteTeachStep(index),
    moveStep: (index, delta) => game.moveTeachStep(index, delta),
    editStepLocation: (index, mode = 'select_zone') => game.beginTeachLocationEdit(index, mode),
    applyLocation: (x, y) => game.applyTeachLocationSelection(x, y),
    interact: () => game.interact(),
    assignToBot: botId => game.assignRecordedLoopToBot(botId),
    pauseBot: botId => { const bot = game.findBot(botId); if (!bot) return null; bot.paused = true; return window.getGameState(); },
    movePlayerTo: (x, y) => { game.player.x = x; game.player.y = y; game.player.target = null; return window.getGameState(); },
    setInventory: type => { game.player.inventory = type ? { type, count: 1 } : null; return window.getGameState(); },
    placeStructure: (type, x, y) => game.addStructure(type, x, y),
    startMultiplayer: (sessionId = 'test-session', playerId = 'p1') => game.startMultiplayerSession({ sessionId, role: playerId === 'p1' ? 'host' : 'client', playerId }),
    attackThrone: structureId => game.damageThrone(game.structures.find(s => s.id === Number(structureId))),
    pickupNearest: type => game.manualPickupNearest(type),
    dropHeld: () => game.manualDropItem(),
    setTargetFps: value => { game.targetFps = Number(value); return window.getGameState(); },
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
    tickCombat: seconds => { game.updateRangedAttackStructures(Number(seconds) || 0); game.updateProjectiles(Number(seconds) || 0); return window.getGameState(); },
    tickWorld: seconds => { game.update(Number(seconds) || 0); return window.getGameState(); }
  };
  window.validateAssistantToolCalls = raw => validateToolCalls(raw, game);
  window.voiceInputDebug = { applyStreamingTranscript: chat.applyTranscript, insertTextAtChatCursor: chat.insertAtCursor, defaultAsrWsUrl: chat.wsUrl, transcribeUrl: chat.transcribeUrl, getChatSelection: chat.getSelection, getAsrMode };

  window.uiDebug = { toggleSettings, setSettingsOpen, toggleChat, setChatOpen, setSettingsTab, toggleBotDrawer, setBotDrawerOpen, toggleBuildDrawer, setBuildDrawerOpen, toggleZonesDrawer, setZonesDrawerOpen, setBuildTab, showAssignmentToast, hideAssignmentToast };

  addChat('assistant', 'Ready. WASD/arrows pan the camera, mouse wheel zooms around your cursor. Use Multiplayer to host a separate Socket.IO session; Player 1 starts bottom-left, Player 2 top-right, and each must destroy the enemy throne.');
  game.syncBuildUi(); game.syncTeachUi(); game.syncZonesUi?.(); startGameLoop(game);
}
