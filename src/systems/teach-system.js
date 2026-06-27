// src/systems/teach-system.js
// Teach-by-doing recorder, DSL step helpers, step text rendering, recorded loop management.
// Part of the Game class composition root — installed via installTeachSystem(Game, deps).
//
// NOTE: validateDslProgram and assignCustomDslProgram remain in world.js because they are
// large and deeply interconnected with zone/structure/item normalization. The action-step
// chain integrity test checks for these in the world.js + system files combined source.

import { escapeHtml } from '../utils.js?v=20260613-player-tools';

export function installTeachSystem(Game, deps) {
  const {
    ALLOWED_OPS,
    DEFAULT_RESOURCE_RADIUS,
    DIG_ZONE_RADIUS,
    clone,
    itemLabel
  } = deps;

  Object.assign(Game.prototype, {
    clearTeachConcreteLocation(step) {
      for (const key of ['structureId', 'structureRef', 'structureType', 'structureName', 'holeId', 'holeRef', 'holeName', 'treeId', 'treeRef', 'treeName', 'hempId', 'hempRef', 'hempName', 'rockId', 'rockRef', 'rockName', 'target']) delete step[key];
    },
    clearTeachZoneLocation(step) { delete step.zoneId; delete step.zoneSpec; delete step.zoneLabel; },
    resourceRadiusStep(op, resource, label = 'resource', radius = DEFAULT_RESOURCE_RADIUS) {
      const x = Math.round(resource?.x || this.player.x), y = Math.round(resource?.y || this.player.y);
      const zoneSpec = { kind: 'radius', x, y, radius, name: `${radius}px radius around ${label}` };
      return { op, zoneSpec, zoneLabel: zoneSpec.name };
    },
    digRadiusStep(x = this.player.x, y = this.player.y, radius = DIG_ZONE_RADIUS) {
      const zoneSpec = { kind: 'radius', x: Math.round(x), y: Math.round(y), radius, name: `${radius}px dig radius` };
      return { op: 'dig_hole', zoneSpec, zoneLabel: zoneSpec.name };
    },
    dropItemStep(typeOrX = this.player.x, xOrY = this.player.y, yMaybe = null) {
      const hasExplicitType = typeof typeOrX === 'string' && typeof xOrY === 'number';
      const x = hasExplicitType ? xOrY : typeOrX;
      const y = hasExplicitType ? (typeof yMaybe === 'number' ? yMaybe : this.player.y) : xOrY;
      const zoneSpec = { kind: 'radius', x: Math.round(x), y: Math.round(y), radius: 64, name: 'drop zone' };
      return { op: 'drop_item', zoneSpec, zoneLabel: zoneSpec.name };
    },
    deployBuildingKitStep(type, x = this.player.x, y = this.player.y) {
      const kitType = this.normalizeBuildingKitItemType(type);
      const label = itemLabel(kitType || type);
      const zoneSpec = { kind: 'radius', x: Math.round(x), y: Math.round(y), radius: 64, name: `deployment zone for ${label}` };
      return { op: 'deploy_building_kit', type: kitType || type, zoneSpec, zoneLabel: zoneSpec.name };
    },
    stepText(step) {
      const where = step.zoneLabel ? ` in ${step.zoneLabel}` : '';
      if (step.op === 'pick_up') return `pick up nearest ${itemLabel(step.type)}${where}`;
      if (step.op === 'pick_up_from_storage') return `pick up ${itemLabel(step.type)} from ${step.structureName || step.target || 'storage'}`;
      if (step.op === 'move_to_structure') return `move_to ${step.structureName || step.target || 'structure'}`;
      if (step.op === 'deposit_to_structure') return `move to ${step.structureName || step.target || 'structure'} and deposit ${itemLabel(step.type)}`;
      if (step.op === 'deposit_to_player') return `bring ${itemLabel(step.type)} to player`;
      if (step.op === 'take_from_player') return `take ${itemLabel(step.type)} from player`;
      if (step.op === 'drop_item') return `drop item in hand on ground${where}`;
      if (step.op === 'deploy_building_kit') return `deploy ${itemLabel(step.type)}${where}`;
      if (step.op === 'disassemble_building_to_kit') return `disassemble ${step.structureName || step.target || 'building'} into kit`;
      if (step.op === 'plant_seed') return step.holeName ? `plant tree seed in ${step.holeName}` : `plant tree seed in dug hole${where}`;
      if (step.op === 'dig_hole') return `dig hole${where}`;
      if (step.op === 'chop_tree') return step.treeName ? `chop ${step.treeName}` : `chop nearest tree${where}`;
      if (step.op === 'search_tree') return step.treeName ? `move to ${step.treeName} and search for sticks and seeds` : `search trees${where} for sticks and seeds`;
      if (step.op === 'chop_hemp') return step.hempName ? `chop ${step.hempName}` : `chop nearest hemp${where}`;
      if (step.op === 'search_hemp') return step.hempName ? `move to ${step.hempName} and search for hemp seed` : `search hemp${where} for seeds`;
      if (step.op === 'mine_stone') return step.rockName ? `mine ${step.rockName}` : `mine nearest stone deposit${where}`;
      if (step.op === 'assign_template') return `assign ${step.botName || (step.botId ? `Bot ${step.botId}` : 'bot')} template ${step.templateName || 'template'}`;
      if (step.op === 'rename_bot') return `rename ${step.targetName || step.botName || (step.botId ? `Bot ${step.botId}` : 'this bot')} to ${step.name || 'name'}`;
      if (step.op === 'promote_to_manager') return `promote ${step.targetName || (step.botId ? `Bot ${step.botId}` : 'this bot')} to manager`;
      if (step.op === 'delegate_to_manager') return `delegate to ${step.recipientName || step.recipient || 'manager'}: ${step.message || 'message'}`;
      if (step.op === 'follow') return `follow ${step.targetName || step.target || step.targetRef || 'player'}${step.distance ? ` at ${step.distance}px` : ''}`;
      if (step.op === 'attack') return `attack ${step.targetName || step.target || step.type || 'hostiles'}${where}${step.radius ? ` within ${step.radius}px` : ''}`;
      return step.op;
    },
    activeTeachSteps() { return this.recorder.steps.length ? this.recorder.steps : this.recordedLoop; },
    openTeachPanel(botId = null) {
      if (botId != null) this.recorder.targetBotId = Number(botId);
      this.teachPanelOpened = true;
      if (this.dom?.teachPanel) this.dom.teachPanel.hidden = false;
      if (this.dom?.teachBotId && this.recorder.targetBotId) this.dom.teachBotId.value = String(this.recorder.targetBotId);
    },
    closeTeachPanel() {
      this.teachPanelOpened = false;
      if (this.dom?.teachPanel) this.dom.teachPanel.hidden = true;
      this.syncTeachUi();
      return this.getRecorderState();
    },
    teachStepLocationText(step) {
      if (step.zoneLabel) return step.zoneLabel;
      if (step.structureName) return step.structureName;
      if (step.holeName) return step.holeName;
      if (step.treeName) return step.treeName;
      if (step.hempName) return step.hempName;
      if (step.rockName) return step.rockName;
      return 'nearest';
    },
    renderStepLocationControls(index, prefix = 'step', step = {}) {
      const attr = prefix === 'bot-step' ? 'bot-step-location' : 'step-location';
      const menuAttr = prefix === 'bot-step' ? 'bot-step-location-menu' : 'step-location-menu';
      const options = '<option value="">Location…</option><option value="select_zone">Select zone</option><option value="draw_zone">Draw zone</option><option value="draw_radius">Draw radius</option><option value="nearest">Nearest</option>';
      return `<button class="step-location-pill" type="button" data-${attr}="${index}">${escapeHtml(this.teachStepLocationText(step))}</button><select aria-label="Location mode" data-${menuAttr}="${index}">${options}</select>`;
    },
    renderStepCard(step, index, { mode = 'teach' } = {}) {
      const botEdit = mode === 'bot-edit';
      const cardIndexAttr = botEdit ? `data-bot-step-index="${index}"` : `data-step-index="${index}"`;
      const prefix = botEdit ? 'bot-step' : 'step';
      const locationControls = this.renderStepLocationControls(index, prefix, step);
      const opOptions = botEdit ? ALLOWED_OPS.map(op => `<option value="${escapeHtml(op)}"${op === step.op ? ' selected' : ''}>${escapeHtml(op)}</option>`).join('') : '';
      const type = botEdit && step.op !== 'drop_item' ? (step.type || step.itemType || step.item || step.resource || '') : '';
      const renameFields = botEdit && step.op === 'rename_bot'
        ? `<label>name <input data-bot-step-name="${index}" value="${escapeHtml(step.name || '')}" placeholder="2-32 chars"></label><label>target <input data-bot-step-target="${index}" value="${escapeHtml(step.target || step.botId || '')}" placeholder="optional bot"></label>`
        : '';
      const managerFields = botEdit && step.op === 'promote_to_manager'
        ? `<label>packs <input data-bot-step-packs="${index}" value="${escapeHtml((step.knowledgePacks || []).join(', '))}" placeholder="woodworking, combat"></label><label>target <input data-bot-step-target="${index}" value="${escapeHtml(step.target || step.botId || '')}" placeholder="optional bot"></label>`
        : botEdit && step.op === 'delegate_to_manager'
          ? `<label>recipient <input data-bot-step-recipient="${index}" value="${escapeHtml(step.recipient || step.recipientBotId || '')}" placeholder="manager bot"></label><label>message <input data-bot-step-message="${index}" value="${escapeHtml(step.message || '')}" placeholder="instruction"></label>`
          : '';
      const editFields = botEdit ? `<label>op <select data-bot-step-op="${index}">${opOptions}</select></label>${step.op !== 'drop_item' ? `<label>type <input data-bot-step-type="${index}" value="${escapeHtml(type)}" placeholder="optional"></label>` : ''}${renameFields}${managerFields}` : '';
      const up = botEdit ? `data-bot-step-up="${index}" aria-label="Move DSL step up"` : `data-step-up="${index}" aria-label="Move step up"`;
      const down = botEdit ? `data-bot-step-down="${index}" aria-label="Move DSL step down"` : `data-step-down="${index}" aria-label="Move step down"`;
      const del = botEdit ? `data-bot-step-delete="${index}" aria-label="Delete DSL step"` : `data-delete-step="${index}" aria-label="Delete step"`;
      return `<li class="teach-step-card${botEdit ? ' bot-program-step-card' : ''}" draggable="true" ${cardIndexAttr}><div class="step-card-main"><b class="step-card-number">${index + 1}.</b>${editFields}<code>${escapeHtml(this.stepText(step))}</code></div><div class="step-card-actions">${locationControls}<button type="button" ${up}>↑</button><button type="button" ${down}>↓</button><button type="button" ${del}>Delete</button></div></li>`;
    },
    renderTeachSteps(steps) {
      if (!steps.length) return '<li class="empty">No recorded steps yet.</li>';
      return steps.map((s, i) => this.renderStepCard(s, i, { mode: 'teach' })).join('');
    },
    syncTeachStepList(root, steps = this.activeTeachSteps()) {
      if (!root) return;
      root.innerHTML = this.renderTeachSteps(steps);
      this.bindTeachStepControls(root);
    },
    syncTeachUi() {
      if (!this.dom?.teachStatus) return;
      const steps = this.activeTeachSteps();
      const targetBotText = this.recorder.targetBotId ? ` for Bot ${this.recorder.targetBotId}` : '';
      const status = this.recorder.recording ? `Recording ${this.recorder.steps.length} step${this.recorder.steps.length === 1 ? '' : 's'}${targetBotText}…` : this.recorder.status;
      this.dom.teachStatus.textContent = status;
      if (this.dom.teachPanel) this.dom.teachPanel.hidden = !this.teachPanelOpened;
      if (this.dom.teachRecordBtn) this.dom.teachRecordBtn.textContent = this.recorder.recording ? 'Stop Recording' : 'Record Loop';
      if (this.dom.teachBotId && this.recorder.targetBotId) this.dom.teachBotId.value = String(this.recorder.targetBotId);
      this.syncTeachStepList(this.dom.teachSteps, steps);
      this.dom.botMenu?.querySelectorAll('.menu-teach-steps').forEach(list => this.syncTeachStepList(list, steps));
    },
    startTeachRecording(botId = null) {
      this.openTeachPanel(botId);
      this.recorder.recording = true;
      this.recorder.steps = [];
      this.recordedLoop = [];
      this.recorder.status = `Recording${this.recorder.targetBotId ? ` for Bot ${this.recorder.targetBotId}` : ''}: right-click items/resources/buildings or press E near things.`;
      this.addFloat('Recording loop', this.player.x, this.player.y - 34, '#d3a95f');
      this.emitSound('teach_start', { cooldownKey: 'teach_start', minGapMs: 120 });
      this.syncTeachUi();
      return this.getRecorderState();
    },
    stopTeachRecording() {
      this.recorder.recording = false;
      this.recordedLoop = clone(this.recorder.steps);
      this.recorder.status = this.recordedLoop.length ? `Recorded ${this.recordedLoop.length} steps. Assign to a bot.` : 'Recording stopped with no steps.';
      this.addFloat(this.recorder.status, this.player.x, this.player.y - 34, this.recordedLoop.length ? '#9abf8f' : '#c86b5f');
      this.emitSound('teach_stop', { cooldownKey: 'teach_stop', minGapMs: 120 });
      this.syncTeachUi();
      return this.getRecorderState();
    },
    recordTeachStep(step) {
      if (!this.recorder.recording) return;
      const normalized = { ...step, text: this.stepText(step) };
      const last = this.recorder.steps[this.recorder.steps.length - 1];
      if (last && last.text === normalized.text) return;
      this.recorder.steps.push(normalized);
      this.recorder.status = normalized.text;
      this.addFloat(`Recorded: ${normalized.text}`, this.player.x, this.player.y - 42, '#d3a95f');
      this.syncTeachUi();
    },
    recordMoveToStructure(s) {
      if (!s) return;
      this.recordTeachStep({ op: 'move_to_structure', structureId: s.id, structureRef: s.ref, structureType: s.type, structureName: s.name, target: s.name });
    },
    setTeachSteps(steps) {
      if (this.recorder.recording) this.recorder.steps = steps;
      else this.recordedLoop = steps;
      for (const step of steps) step.text = this.stepText(step);
      this.syncTeachUi();
    },
    deleteTeachStep(index) { const steps = clone(this.activeTeachSteps()); if (index < 0 || index >= steps.length) return; steps.splice(index, 1); this.setTeachSteps(steps); },
    moveTeachStep(index, delta) { const steps = clone(this.activeTeachSteps()); const to = index + delta; if (index < 0 || to < 0 || index >= steps.length || to >= steps.length) return; [steps[index], steps[to]] = [steps[to], steps[index]]; this.setTeachSteps(steps); },
    beginTeachLocationEdit(index, mode = 'select_zone', source = 'teach') {
      if (mode === 'nearest') return this.clearTeachStepLocation(index, source);
      this.teachLocationEdit = { index, mode, source };
      if (mode === 'draw_zone' || mode === 'draw_radius') {
        this.cancelPlacement();
        if (source !== 'bot-edit') this.hideMenus();
        this.zoneDraft = { active: true, started: false, kind: mode === 'draw_radius' ? 'radius' : 'rect', x1: 0, y1: 0, x2: 0, y2: 0, radius: DEFAULT_RESOURCE_RADIUS };
        this.addFloat(mode === 'draw_radius' ? 'Drag a radius for this step' : 'Drag a zone for this step', this.player.x, this.player.y - 44, '#d3a95f');
        return true;
      }
      this.addFloat('Click an existing zone for this step', this.player.x, this.player.y - 44, '#d3a95f');
      return true;
    },
    getLocationEditableSteps(source = this.teachLocationEdit?.source || 'teach') {
      return source === 'bot-edit' ? clone(this.botMenuEdit?.program?.steps || []) : clone(this.activeTeachSteps());
    },
    setLocationEditableSteps(steps, source = this.teachLocationEdit?.source || 'teach', status = null) {
      if (source === 'bot-edit') {
        const ok = this.setBotMenuEditSteps(steps, status);
        this.syncBotMenuEditSurface(this.botMenuEditRoot);
        return ok;
      }
      this.setTeachSteps(steps);
      return true;
    },
    clearTeachStepLocation(index, source = this.teachLocationEdit?.source || 'teach') {
      const steps = this.getLocationEditableSteps(source);
      const step = steps[index];
      if (!step) return false;
      this.clearTeachConcreteLocation(step); this.clearTeachZoneLocation(step); delete step.zone; delete step.area;
      step.text = this.stepText(step);
      this.teachLocationEdit = null;
      this.setLocationEditableSteps(steps, source, source === 'bot-edit' ? `Step ${index + 1} location cleared to nearest.` : null);
      this.addFloat(`Step ${index + 1}: nearest`, this.player.x, this.player.y - 36, '#9abf8f');
      return true;
    },
    applyTeachZoneToStep(zone) {
      const source = this.teachLocationEdit?.source || 'teach';
      const steps = this.getLocationEditableSteps(source);
      const index = this.teachLocationEdit?.index;
      const step = steps[index];
      if (!step || !zone) { this.teachLocationEdit = null; return false; }
      this.clearTeachConcreteLocation(step);
      this.clearTeachZoneLocation(step);
      if (zone.id) Object.assign(step, { zoneId: zone.id, zoneSpec: null, zoneLabel: zone.name });
      else Object.assign(step, { zoneSpec: zone, zoneLabel: this.zoneLabel(zone) });
      step.text = this.stepText(step);
      this.teachLocationEdit = null;
      this.setLocationEditableSteps(steps, source, source === 'bot-edit' ? `Step ${index + 1} location set to ${zone.name || this.zoneLabel(zone)}.` : null);
      this.addFloat(`Updated step ${index + 1} location`, zone.x || this.player.x, (zone.y || this.player.y) - 22, '#9abf8f');
      return true;
    },
    applyTeachLocationSelection(x, y) {
      const source = this.teachLocationEdit?.source || 'teach';
      const steps = this.getLocationEditableSteps(source);
      const index = this.teachLocationEdit?.index;
      const step = steps[index];
      if (!step) { this.teachLocationEdit = null; return false; }
      const z = this.zoneAt(x, y);
      if (!z) return false;
      this.clearTeachConcreteLocation(step);
      this.clearTeachZoneLocation(step);
      Object.assign(step, { zoneId: z.id, zoneSpec: null, zoneLabel: z.name });
      step.text = this.stepText(step);
      this.teachLocationEdit = null;
      this.setLocationEditableSteps(steps, source, source === 'bot-edit' ? `Step ${index + 1} location set to ${z.name}.` : null);
      this.addFloat(`Updated step ${index + 1} location`, x, y - 22, '#9abf8f');
      return true;
    },
    bindTeachStepControls(root) {
      if (!root || root.dataset.boundTeachSteps === '1') return;
      root.dataset.boundTeachSteps = '1';
      root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const n = Number(b.dataset.deleteStep ?? b.dataset.stepUp ?? b.dataset.stepDown ?? b.dataset.stepLocation); if (!Number.isFinite(n)) return; if ('deleteStep' in b.dataset) this.deleteTeachStep(n); else if ('stepUp' in b.dataset) this.moveTeachStep(n, -1); else if ('stepDown' in b.dataset) this.moveTeachStep(n, 1); else this.beginTeachLocationEdit(n, 'select_zone'); });
      root.addEventListener('change', e => { const menu = e.target.closest('select[data-step-location-menu]'); if (!menu) return; const n = Number(menu.dataset.stepLocationMenu); const mode = menu.value; menu.value = ''; if (Number.isFinite(n) && mode) this.beginTeachLocationEdit(n, mode); });
      root.addEventListener('dragstart', e => { const card = e.target.closest('[data-step-index]'); if (!card) return; this.draggedTeachStepIndex = Number(card.dataset.stepIndex); e.dataTransfer?.setData('text/plain', String(this.draggedTeachStepIndex)); });
      root.addEventListener('dragover', e => { if (e.target.closest('[data-step-index]')) e.preventDefault(); });
      root.addEventListener('drop', e => { const card = e.target.closest('[data-step-index]'); const from = Number(e.dataTransfer?.getData('text/plain') || this.draggedTeachStepIndex); const to = Number(card?.dataset.stepIndex); if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return; e.preventDefault(); const steps = clone(this.activeTeachSteps()); const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved); this.setTeachSteps(steps); });
    },
    getRecorderState() { return { recording: this.recorder.recording, steps: clone(this.recorder.steps), recordedLoop: clone(this.recordedLoop), status: this.recorder.status, lastAssignedBotId: this.recorder.lastAssignedBotId, targetBotId: this.recorder.targetBotId }; },
    resolveRecordedStructure(step, from) {
      const byId = step.structureId ? this.structures.find(s => s.id === step.structureId && (!step.structureType || s.type === step.structureType)) : null;
      if (byId) return byId;
      const name = String(step.structureName || step.target || '').toLowerCase();
      return this.structures.find(s => (!step.structureType || s.type === step.structureType) && s.name.toLowerCase() === name) || this.nearestStructure(step.structureType || 'sawbench', from.x, from.y);
    },
    assignRecordedLoopToBot(botId) {
      const bot = this.findBot(botId);
      if (!bot) return { ok: false, error: `Bot ${botId} not found` };
      if (this.recorder.recording) this.stopTeachRecording();
      const source = this.recordedLoop.length ? this.recordedLoop : this.recorder.steps;
      if (!source.length) return { ok: false, error: 'No recorded loop to assign' };
      bot.paused = false; bot.program = 'taught_loop'; bot.state = 'taught_loop'; bot.message = 'Assigned recorded teach-by-doing loop.'; bot.customTemplateName = ''; bot.taughtLoop = clone(source); bot.taughtLoopRepeat = true; bot.runtime = { pc: 0, memory: {}, wait: 0 }; bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0;
      this.recorder.lastAssignedBotId = bot.id;
      this.recorder.status = `Assigned recorded loop to Bot ${bot.id}.`;
      this.addFloat(`Bot ${bot.id}: taught loop`, bot.x, bot.y - 22, '#d3a95f');
      this.syncTeachUi();
      return { ok: true, bot, steps: clone(bot.taughtLoop) };
    },
  });
}
