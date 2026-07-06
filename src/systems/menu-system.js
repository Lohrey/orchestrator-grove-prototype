// src/systems/menu-system.js
// Context-menu and drawer UI: bot menu, bot drawer, bot program edit,
// structure/tree/hole/zone menus, zone list, bot drawer controls.
// Part of the Game class composition root — installed via installMenuSystem(Game, deps).
//
// Dependencies (passed via deps):
//   BUILDING_TYPES, BUILDING_KIT_ITEM_TYPES, DEFAULT_MANAGER_KNOWLEDGE_PACKS,
//   DEFAULT_RESOURCE_RADIUS, DEFENSE_TOWER_ATTACK, DOG_FETCH_PRAISE_TARGET,
//   STORAGE_STRUCTURE_TYPES, STRUCTURE_INFO, THRONE_HP, WORKBENCH_TOOL_RECIPES,
//   assemblerRecipe, buildingTypeFromKitItem, clone, escapeHtml, itemLabel,
//   smitheryRecipe, structureRecipeText, workbenchRecipe.

import { escapeHtml } from '../utils.js';

export function installMenuSystem(Game, deps) {
  const {
    BUILDING_TYPES,
    BUILDING_KIT_ITEM_TYPES,
    DEFAULT_MANAGER_KNOWLEDGE_PACKS,
    DEFAULT_RESOURCE_RADIUS,
    DEFENSE_TOWER_ATTACK,
    DOG_FETCH_PRAISE_TARGET,
    STORAGE_STRUCTURE_TYPES,
    STRUCTURE_INFO,
    THRONE_HP,
    WORKBENCH_TOOL_RECIPES,
    assemblerRecipe,
    buildingTypeFromKitItem,
    clone,
    itemLabel,
    smitheryRecipe,
    structureRecipeText,
    workbenchRecipe
  } = deps;

  Object.assign(Game.prototype, {
    renderBotDrawerCard(bot) {
      const team = this.botTeam(bot);
      const name = this.botDisplayName(bot);
      const color = this.teamColor(team?.color || '#101413');
      const teamText = team ? team.name : 'No team';
      const roleLabel = this.isDogBot(bot) ? 'dog' : (bot.status === 'manager' ? 'manager' : 'worker');
      return `<article class="bot-card bot-team-card" draggable="true" data-bot-card data-bot-id="${bot.id}" style="--team-color:${escapeHtml(color)}"><button type="button" class="bot-badge bot-card-menu-button" data-open-bot-menu="${bot.id}" aria-label="Open ${escapeHtml(name)} menu">#${bot.id}</button><div class="bot-card-body"><div class="bot-card-topline"><label class="bot-name-edit">Name <input data-bot-name-input="${bot.id}" value="${escapeHtml(name)}" maxlength="32" /></label><button type="button" class="bot-card-inline-action" data-open-bot-menu="${bot.id}">Open menu</button></div><p><span class="program">${escapeHtml(bot.program)}</span> · ${escapeHtml(teamText)} · ${escapeHtml(roleLabel)}</p><p>${escapeHtml(bot.message)}</p></div></article>`;
    },

    renderBotDrawerTeam(team, bots) {
      const color = this.teamColor(team.color);
      const body = bots.length ? bots.map(bot => this.renderBotDrawerCard(bot)).join('') : '<p class="empty">Drop bot cards here to assign this team.</p>';
      return `<section class="bot-team-section" data-team-dropzone data-team-id="${escapeHtml(team.id)}" style="--team-color:${escapeHtml(color)}"><header><span class="team-color-dot" aria-hidden="true"></span><b>${escapeHtml(team.name)}</b><small>${bots.length} bot${bots.length === 1 ? '' : 's'}</small><label class="team-color-edit">Color <input type="color" data-team-color-input="${escapeHtml(team.id)}" value="${escapeHtml(color)}"></label></header><div class="bot-team-cards">${body}</div></section>`;
    },

    syncBotDrawerUi(force = false) {
      const list = this.dom.botList;
      if (!list || (this.botDrawerDragging && !force)) return;
      const active = document.activeElement;
      if (!force && active?.matches?.('[data-bot-name-input]')) return;
      const query = String(this.botSearchQuery || this.dom.botSearch?.value || '').trim().toLowerCase();
      const matches = bot => !query || this.botDisplayName(bot).toLowerCase().includes(query);
      const bots = this.bots.filter(matches);
      const sections = this.botTeams.map(team => this.renderBotDrawerTeam(team, bots.filter(bot => bot.teamId === team.id)));
      const unassigned = bots.filter(bot => !this.findBotTeam(bot.teamId));
      const unassignedBody = unassigned.length ? unassigned.map(bot => this.renderBotDrawerCard(bot)).join('') : `<p class="empty">${query ? 'No unassigned bots match this search.' : 'No unassigned bots.'}</p>`;
      const emptySearch = query && !bots.length ? '<p class="empty bot-search-empty">No bots match that name.</p>' : '';
      const teamHint = this.botTeams.length ? '' : '<p class="empty bot-team-hint">Create a team above, then drag bot cards into it.</p>';
      list.innerHTML = `${emptySearch}${teamHint}${sections.join('')}<section class="bot-team-section bot-team-unassigned" data-team-dropzone data-team-id=""><header><span class="team-color-dot" aria-hidden="true"></span><b>No team</b><small>${unassigned.length} bot${unassigned.length === 1 ? '' : 's'}</small></header><div class="bot-team-cards">${unassignedBody}</div></section>`;
    },

    bindBotDrawerControls() {
      this.dom.botSearch?.addEventListener('input', () => { this.botSearchQuery = this.dom.botSearch.value; this.syncBotDrawerUi(); });
      this.dom.botTeamForm?.addEventListener('submit', event => {
        event.preventDefault();
        const team = this.createBotTeam(this.dom.botTeamName?.value, this.dom.botTeamColor?.value);
        if (this.dom.botTeamName) this.dom.botTeamName.value = '';
        if (this.dom.botTeamColor) this.dom.botTeamColor.value = team.color;
      });
      this.dom.botList?.addEventListener('change', event => {
        const nameInput = event.target.closest('[data-bot-name-input]');
        if (nameInput) { this.setBotName(nameInput.dataset.botNameInput, nameInput.value); return; }
        const colorInput = event.target.closest('[data-team-color-input]');
        if (colorInput) this.setBotTeamColor(colorInput.dataset.teamColorInput, colorInput.value);
      });
      this.dom.botList?.addEventListener('keydown', event => {
        const input = event.target.closest('[data-bot-name-input]');
        if (input && event.key === 'Enter') { event.preventDefault(); input.blur(); this.setBotName(input.dataset.botNameInput, input.value); }
      });
      this.dom.botList?.addEventListener('click', event => {
        const button = event.target.closest('[data-open-bot-menu]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const card = button.closest('[data-bot-card]');
        const bot = this.findBot(Number(button.dataset.openBotMenu || card?.dataset.botId || 0));
        if (!bot || !card) return;
        const rect = card.getBoundingClientRect();
        this.showBotMenu(bot, rect.right - 8, rect.top + Math.min(rect.height * 0.5, 40), { refreshEdit: true });
      });
      this.dom.botList?.addEventListener('dragstart', event => {
        const card = event.target.closest('[data-bot-card]');
        if (!card) return;
        this.botDrawerDragging = true;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.dataset.botId);
        card.classList.add('is-dragging');
      });
      this.dom.botList?.addEventListener('dragend', event => {
        event.target.closest('[data-bot-card]')?.classList.remove('is-dragging');
        this.botDrawerDragging = false;
        this.dom.botList?.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
        this.syncBotDrawerUi(true);
      });
      this.dom.botList?.addEventListener('dragover', event => {
        const zone = event.target.closest('[data-team-dropzone]');
        if (!zone) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        zone.classList.add('is-drop-target');
      });
      this.dom.botList?.addEventListener('dragleave', event => {
        const zone = event.target.closest('[data-team-dropzone]');
        if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('is-drop-target');
      });
      this.dom.botList?.addEventListener('drop', event => {
        const zone = event.target.closest('[data-team-dropzone]');
        if (!zone) return;
        event.preventDefault();
        const botId = event.dataTransfer.getData('text/plain');
        this.assignBotToTeam(botId, zone.dataset.teamId || null);
        this.botDrawerDragging = false;
        zone.classList.remove('is-drop-target');
        this.syncBotDrawerUi(true);
      });
    },

    editableBotProgramFrom(bot) {
      const current = this.getBotProgram(bot);
      const steps = clone(current.resolvedSteps || current.steps || []);
      return {
        id: current.id || `${bot.program || 'bot'}_editable`,
        name: current.name || `Bot ${bot.id} editable loop`,
        description: current.description || 'Editable bot DSL program from the bot context menu.',
        steps
      };
    },

    ensureBotMenuEdit(bot, { refresh = false } = {}) {
      const nextProgram = this.editableBotProgramFrom(bot);
      const sameBot = this.botMenuEdit?.botId === bot.id;
      const shouldRefresh = refresh || !sameBot || JSON.stringify(this.botMenuEdit?.program || null) !== JSON.stringify(nextProgram);
      if (shouldRefresh) {
        this.botMenuEdit = {
          botId: bot.id,
          program: nextProgram,
          status: sameBot ? this.botMenuEdit.status : '',
          nameStatus: sameBot ? this.botMenuEdit.nameStatus : '',
          nameEditing: sameBot ? this.botMenuEdit.nameEditing : false,
          nameDraft: sameBot ? this.botMenuEdit.nameDraft : ''
        };
      }
      return this.botMenuEdit;
    },

    renderBotProgramEditSteps(steps = []) {
      if (!steps.length) return '<li class="empty">No DSL steps yet.</li>';
      return steps.map((step, index) => this.renderStepCard(step, index, { mode: 'bot-edit' })).join('');
    },

    syncBotMenuEditSurface(root) {
      const edit = this.botMenuEdit;
      if (root) this.botMenuEditRoot = root;
      if (!root || !edit) return;
      const json = root.querySelector('[data-bot-json-editor]');
      if (json && document.activeElement !== json) json.value = JSON.stringify(edit.program, null, 2);
      const list = root.querySelector('[data-bot-program-steps]');
      if (list) list.innerHTML = this.renderBotProgramEditSteps(edit.program.steps || []);
      const status = root.querySelector('[data-bot-edit-status]');
      if (status) status.textContent = edit.status || 'Edit JSON, or adjust the DSL cards and accept them.';
    },

    setBotMenuEditSteps(steps, status = 'DSL cards edited. Accept card flow to activate.') {
      if (!this.botMenuEdit) return false;
      const nextSteps = clone(steps || []);
      for (const step of nextSteps) step.text = this.stepText(step);
      this.botMenuEdit.program = { ...this.botMenuEdit.program, steps: nextSteps };
      if (status !== null) this.botMenuEdit.status = status;
      return true;
    },

    updateBotMenuEditStep(index, patch) {
      if (!this.botMenuEdit) return false;
      const steps = clone(this.botMenuEdit.program.steps || []);
      const step = steps[index];
      if (!step) return false;
      Object.assign(step, patch);
      if (patch.type === '') delete step.type;
      if (patch.name === '') delete step.name;
      if (patch.target === '') { delete step.target; delete step.botId; delete step.botName; delete step.targetName; }
      if (patch.recipient === '') { delete step.recipient; delete step.recipientBotId; delete step.recipientName; }
      if (patch.message === '') delete step.message;
      step.text = this.stepText(step);
      return this.setBotMenuEditSteps(steps);
    },

    moveBotMenuEditStep(index, delta) {
      if (!this.botMenuEdit) return false;
      const steps = clone(this.botMenuEdit.program.steps || []);
      const to = index + delta;
      if (index < 0 || to < 0 || index >= steps.length || to >= steps.length) return false;
      [steps[index], steps[to]] = [steps[to], steps[index]];
      return this.setBotMenuEditSteps(steps);
    },

    deleteBotMenuEditStep(index) {
      if (!this.botMenuEdit) return false;
      const steps = clone(this.botMenuEdit.program.steps || []);
      if (index < 0 || index >= steps.length) return false;
      steps.splice(index, 1);
      return this.setBotMenuEditSteps(steps);
    },

    addBotMenuEditLoopStep() {
      if (!this.botMenuEdit) return false;
      const steps = clone(this.botMenuEdit.program.steps || []);
      if (steps.some(step => step.op === 'loop')) this.botMenuEdit.status = 'This DSL already has a loop step.';
      else {
        steps.push({ op: 'loop', text: 'loop' });
        this.setBotMenuEditSteps(steps);
      }
      return true;
    },

    saveBotMenuJson(bot, text) {
      this.ensureBotMenuEdit(bot);
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (err) { this.botMenuEdit.status = `JSON error: ${err.message}`; return { ok: false, error: err.message }; }
      const program = parsed?.program || parsed;
      const checked = this.validateDslProgram(program);
      if (!checked.ok) { this.botMenuEdit.status = `Validation failed: ${checked.error}`; return checked; }
      const nextProgram = { ...program, id: checked.program.id, name: checked.program.name, steps: checked.program.steps };
      const res = this.assignCustomDslProgram({ botId: bot.id, program: nextProgram, reason: 'Edited from bot menu JSON.' });
      this.botMenuEdit = { botId: bot.id, program: clone(res.program || nextProgram), status: res.ok ? `Saved JSON and refreshed Bot ${bot.id}.` : `Save failed: ${res.error}` };
      return res;
    },

    acceptBotMenuDslCards(bot) {
      const edit = this.ensureBotMenuEdit(bot);
      const checked = this.validateDslProgram(edit.program);
      if (!checked.ok) { edit.status = `Validation failed: ${checked.error}`; return checked; }
      const res = this.assignCustomDslProgram({ botId: bot.id, program: { ...edit.program, steps: checked.program.steps }, reason: 'Accepted DSL card flow from bot menu.' });
      this.botMenuEdit = { botId: bot.id, program: clone(res.program || checked.program), status: res.ok ? `Accepted card flow and refreshed Bot ${bot.id}.` : `Accept failed: ${res.error}` };
      return res;
    },

    bindBotProgramEditControls(el, bot, x, y) {
      el.querySelector('[data-save-json]')?.addEventListener('click', () => {
        const res = this.saveBotMenuJson(bot, el.querySelector('[data-bot-json-editor]')?.value || '{}');
        if (res.ok) this.showBotMenu(bot, x, y);
        else this.syncBotMenuEditSurface(el);
      });
      el.querySelector('[data-accept-dsl-cards]')?.addEventListener('click', () => {
        const res = this.acceptBotMenuDslCards(bot);
        if (res.ok) this.showBotMenu(bot, x, y);
        else this.syncBotMenuEditSurface(el);
      });
      el.querySelector('[data-add-loop-step]')?.addEventListener('click', () => { this.addBotMenuEditLoopStep(); this.syncBotMenuEditSurface(el); });
      el.addEventListener('click', event => {
        const location = event.target.closest('[data-bot-step-location]');
        if (location) {
          const index = Number(location.dataset.botStepLocation);
          if (Number.isFinite(index)) this.beginTeachLocationEdit(index, 'select_zone', 'bot-edit');
          return;
        }
        const button = event.target.closest('[data-bot-step-up], [data-bot-step-down], [data-bot-step-delete]');
        if (!button) return;
        const index = Number(button.dataset.botStepUp ?? button.dataset.botStepDown ?? button.dataset.botStepDelete);
        if (!Number.isFinite(index)) return;
        if ('botStepUp' in button.dataset) this.moveBotMenuEditStep(index, -1);
        else if ('botStepDown' in button.dataset) this.moveBotMenuEditStep(index, 1);
        else this.deleteBotMenuEditStep(index);
        this.syncBotMenuEditSurface(el);
      });
      el.addEventListener('change', event => {
        const op = event.target.closest('[data-bot-step-op]');
        const type = event.target.closest('[data-bot-step-type]');
        const name = event.target.closest('[data-bot-step-name]');
        const target = event.target.closest('[data-bot-step-target]');
        const packs = event.target.closest('[data-bot-step-packs]');
        const recipient = event.target.closest('[data-bot-step-recipient]');
        const message = event.target.closest('[data-bot-step-message]');
        const locationMenu = event.target.closest('select[data-bot-step-location-menu]');
        if (op) this.updateBotMenuEditStep(Number(op.dataset.botStepOp), { op: op.value });
        if (type) this.updateBotMenuEditStep(Number(type.dataset.botStepType), { type: type.value.trim() });
        if (name) this.updateBotMenuEditStep(Number(name.dataset.botStepName), { name: name.value.trim() });
        if (target) this.updateBotMenuEditStep(Number(target.dataset.botStepTarget), { target: target.value.trim() });
        if (packs) this.updateBotMenuEditStep(Number(packs.dataset.botStepPacks), { knowledgePacks: this.normalizeManagerKnowledgePacks(packs.value) });
        if (recipient) this.updateBotMenuEditStep(Number(recipient.dataset.botStepRecipient), { recipient: recipient.value.trim() });
        if (message) this.updateBotMenuEditStep(Number(message.dataset.botStepMessage), { message: this.sanitizeManagerMessage(message.value) });
        if (locationMenu) {
          const index = Number(locationMenu.dataset.botStepLocationMenu);
          const mode = locationMenu.value;
          locationMenu.value = '';
          if (Number.isFinite(index) && mode) this.beginTeachLocationEdit(index, mode, 'bot-edit');
        }
        if (op || type || name || target || packs || recipient || message || locationMenu) this.syncBotMenuEditSurface(el);
      });
      el.addEventListener('dragstart', event => {
        const card = event.target.closest('[data-bot-step-index]');
        if (!card) return;
        this.draggedBotProgramStepIndex = Number(card.dataset.botStepIndex);
        event.dataTransfer?.setData('text/plain', String(this.draggedBotProgramStepIndex));
      });
      el.addEventListener('dragover', event => { if (event.target.closest('[data-bot-step-index]')) event.preventDefault(); });
      el.addEventListener('drop', event => {
        const card = event.target.closest('[data-bot-step-index]');
        const from = Number(event.dataTransfer?.getData('text/plain') || this.draggedBotProgramStepIndex);
        const to = Number(card?.dataset.botStepIndex);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from === to || !this.botMenuEdit) return;
        event.preventDefault();
        const steps = clone(this.botMenuEdit.program.steps || []);
        const [moved] = steps.splice(from, 1);
        steps.splice(to, 0, moved);
        this.setBotMenuEditSteps(steps);
        this.syncBotMenuEditSurface(el);
      });
    },

    renderManagerPackControls(bot) {
      const catalog = this.managerKnowledgePackCatalog || {};
      const selected = new Set(bot.managerKnowledgePacks?.length ? bot.managerKnowledgePacks : DEFAULT_MANAGER_KNOWLEDGE_PACKS);
      const ids = Object.keys(catalog).length ? Object.keys(catalog) : DEFAULT_MANAGER_KNOWLEDGE_PACKS;
      return ids.map(id => {
        const pack = catalog[id] || { id, name: id };
        return `<label class="manager-pack-option"><input type="checkbox" data-manager-pack="${escapeHtml(id)}"${selected.has(id) ? ' checked' : ''}> ${escapeHtml(pack.name || id)}</label>`;
      }).join('');
    },

    showBotMenu(bot, x, y, { refreshEdit = false } = {}) {
      if (this.isDogBot(bot)) {
        this.showDogPopup(bot, bot.inventory ? 'reward' : 'progress');
        return;
      }
      const el = this.dom.botMenu;
      const edit = this.ensureBotMenuEdit(bot, { refresh: refreshEdit });
      const tpl = JSON.stringify(edit.program, null, 2);
      const steps = this.activeTeachSteps();
      const teachSteps = this.renderTeachSteps(steps);
      const editSteps = this.renderBotProgramEditSteps(edit.program.steps || []);
      const recordLabel = this.recorder.recording ? 'Stop recording' : 'Start recording';
      const assignDisabled = (this.recordedLoop.length || this.recorder.steps.length) ? '' : ' disabled';
      const hasWorkflow = !!bot.program && bot.program !== 'idle';
      const stopLabel = bot.paused ? 'Resume workflow' : 'Stop workflow';
      const displayName = this.botDisplayName(bot);
      const statusLabel = this.isManagerBot(bot) ? 'manager' : ((this.isDogBot(bot) || bot.program === 'dog_fetch') ? 'dog' : (bot.status || 'worker'));
      const promoteButton = this.isManagerBot(bot) ? '' : '<button type="button" data-promote-manager>Promote to Manager</button>';
      const managerSection = this.isManagerBot(bot) ? `<section class="manager-menu" data-manager-section><b>Manager controls</b><p>Status: <code>manager</code> · Known packs: <span data-manager-pack-summary>${escapeHtml((bot.managerKnowledgePacks || []).join(', ') || 'none')}</span></p><div class="manager-pack-list">${this.renderManagerPackControls(bot)}</div><label class="manager-message-input">Message manager <textarea data-manager-message rows="3" placeholder="make bot 2 chop trees"></textarea></label><button type="button" data-send-manager-message>Send to Manager</button><p class="manager-message-status" data-manager-status></p></section>` : '';
      const dogPackSummary = `<span>${escapeHtml((bot.knowledgePacks || []).join(', ') || 'dog_fetch')}</span>`;
      const dogSection = (() => {
        if (!this.isDogBot(bot) && bot.program !== 'dog_fetch') return '';
        const fetchedType = bot.inventory?.type ? itemLabel(bot.inventory.type) : '';
        const praiseCount = bot.inventory?.type ? (bot.dogFetchMemory?.praiseCounts?.[bot.inventory.type] || 0) : 0;
        const dogControls = bot.inventory
          ? `<div class="dog-reward-buttons" data-dog-reward-buttons><button type="button" class="dog-reward-button is-yes" data-dog-praise aria-label="Praise dog and take item">&#10003;</button><button type="button" class="dog-reward-button is-no" data-dog-reject aria-label="Reject fetched item">&#10007;</button></div><p class="dog-reward-hint">Right now: ${escapeHtml(fetchedType)} · praises ${praiseCount}/${DOG_FETCH_PRAISE_TARGET}</p>`
          : `<label class="dog-fetch-input"><span>Fetch command</span><input data-dog-fetch-command placeholder="go fetch me a stick" value="${escapeHtml(edit.dogCommandDraft || '')}"></label><button type="button" data-dog-fetch-submit>Fetch</button><p class="dog-reward-hint">Dog pack: pick up + follow. Assigned pack: ${dogPackSummary}</p>`;
        return `<section class="dog-menu" data-dog-section><b>Dog fetch</b><p>Status: <code>dog</code> · Assigned pack: ${dogPackSummary}</p>${dogControls}</section>`;
      })();
      const nameStatus = edit.nameStatus ? `<p class="bot-menu-name-status" data-bot-name-status>${escapeHtml(edit.nameStatus)}</p>` : '';
      const nameEditor = edit.nameEditing ? `<label class="bot-menu-name-edit">Bot name <input data-menu-bot-name value="${escapeHtml(edit.nameDraft || displayName)}" maxlength="32"></label>` : '';
      const workflowButton = hasWorkflow ? `<button data-stop-workflow>${stopLabel}</button>` : '';
      // ── Combat toggle (Patrick) ──
      // Aggressive (DEFAULT): auto-attack enemies within 500px, pausing the loop while fighting.
      // Passive: never auto-attack.
      const combatMode = bot.combatMode === 'passive' ? 'passive' : 'aggressive';
      const combatToggleLabel = combatMode === 'aggressive' ? 'Combat: Aggressive (switch to Passive)' : 'Combat: Passive (switch to Aggressive)';
      const combatSection = this.isDogBot(bot) ? '' : `<section class="bot-combat-toggle"><b>Combat mode</b><p>Current: <code>${escapeHtml(combatMode)}</code>${bot.combatEngaged ? ' · <b>engaged</b>' : ''}</p><button type="button" data-toggle-combat>${combatToggleLabel}</button></section>`;
      el.innerHTML = `<div class="bot-menu-title"><div class="bot-menu-title-row"><b>${escapeHtml(displayName)}</b><button type="button" data-edit-bot-name aria-label="Edit bot name">Edit</button></div>${nameStatus}${nameEditor}</div><button data-close>×</button><p>${escapeHtml(bot.message)}</p><p><b>Status:</b> ${escapeHtml(statusLabel)}</p><p><b>Program:</b> ${escapeHtml(bot.program)}</p><p><b>Ref:</b> <code>${escapeHtml(bot.ref)}</code></p>${promoteButton}${managerSection}${dogSection}${workflowButton}${combatSection}<section class="teach-menu"><b>Teach by doing</b><p>${escapeHtml(this.recorder.recording ? `Recording ${this.recorder.steps.length} steps for Bot ${this.recorder.targetBotId || bot.id}…` : this.recorder.status)}</p><ol class="teach-steps menu-teach-steps">${teachSteps}</ol><button data-teach-record>${recordLabel}</button><button data-assign-taught${assignDisabled}>Assign to ${escapeHtml(displayName)}</button></section><section class="bot-program-editor"><b>Assigned JSON</b><p data-bot-edit-status>${escapeHtml(edit.status || 'Edit JSON, or adjust the DSL cards and accept them.')}</p><textarea data-bot-json-editor spellcheck="false">${escapeHtml(tpl)}</textarea><button type="button" data-save-json>Save JSON + refresh Bot ${bot.id}</button><div class="bot-card-flow-head"><b>DSL card flow</b><button type="button" data-add-loop-step>Add loop</button></div><ol class="teach-steps bot-program-steps" data-bot-program-steps>${editSteps}</ol><button type="button" data-accept-dsl-cards>Accept card flow + refresh Bot ${bot.id}</button></section><button data-add>Add bot to chat</button>`;
      this.placeMenu(el,x,y);
      this.bindTeachStepControls(el.querySelector('.menu-teach-steps'));
      this.bindBotProgramEditControls(el, bot, x, y);
      el.querySelector('[data-close]').onclick=()=>this.hideMenus();
      el.querySelector('[data-promote-manager]')?.addEventListener('click', event => {
        event.stopPropagation();
        this.promoteBotToManager(bot, bot.managerKnowledgePacks?.length ? bot.managerKnowledgePacks : (this.getDefaultManagerKnowledgePacks?.() || DEFAULT_MANAGER_KNOWLEDGE_PACKS));
        this.showBotMenu(bot, x, y, { refreshEdit: true });
      });
      el.querySelectorAll('[data-manager-pack]')?.forEach(input => input.addEventListener('change', () => {
        const ids = [...el.querySelectorAll('[data-manager-pack]:checked')].map(box => box.dataset.managerPack);
        this.setManagerKnowledgePacks(bot.id, ids);
        const summary = el.querySelector('[data-manager-pack-summary]');
        if (summary) summary.textContent = (bot.managerKnowledgePacks || []).join(', ') || 'none';
      }));
      el.querySelector('[data-send-manager-message]')?.addEventListener('click', () => {
        const text = el.querySelector('[data-manager-message]')?.value || '';
        const res = this.delegateMessageToManager(bot, bot.id, text, { throttleKey: `manual:${bot.id}:${this.sanitizeManagerMessage(text)}` });
        const status = el.querySelector('[data-manager-status]');
        if (status) status.textContent = res.ok ? `Sent to ${this.botDisplayName(bot)}.` : res.error;
      });
      el.querySelector('[data-dog-fetch-submit]')?.addEventListener('click', () => {
        const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
        const res = this.setDogFetchCommand(bot, text);
        if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
      });
      el.querySelector('[data-dog-fetch-command]')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
          const res = this.setDogFetchCommand(bot, text);
          if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
        }
      });
      el.querySelector('[data-dog-praise]')?.addEventListener('click', () => {
        const res = this.praiseDogFetch(bot);
        if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
      });
      el.querySelector('[data-dog-reject]')?.addEventListener('click', () => {
        const res = this.rejectDogFetch(bot);
        if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
      });
      el.querySelector('[data-edit-bot-name]')?.addEventListener('click', () => this.beginBotMenuNameEdit(bot, x, y));
      el.querySelector('[data-menu-bot-name]')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); this.saveBotMenuName(bot, x, y, el.querySelector('[data-menu-bot-name]')?.value || ''); } });
      el.querySelector('[data-add]').onclick=()=>{this.chat.insertAtCursor(`Bot ${bot.id} `);};
      el.querySelector('[data-stop-workflow]')?.addEventListener('click',()=>{ bot.paused = !bot.paused; bot.message = bot.paused ? `Paused ${bot.program} workflow.` : `Resumed ${bot.program} workflow.`; this.showBotMenu(bot, x, y); });
      el.querySelector('[data-toggle-combat]')?.addEventListener('click', () => { this.toggleBotCombatMode(bot); this.showBotMenu(bot, x, y); });
      el.querySelector('[data-teach-record]').onclick=()=>{ this.recorder.recording ? this.stopTeachRecording() : this.startTeachRecording(bot.id); this.showBotMenu(bot, x, y); };
      el.querySelector('[data-assign-taught]')?.addEventListener('click',()=>{ this.assignRecordedLoopToBot(bot.id); this.showBotMenu(bot, x, y, { refreshEdit: true }); });
      if (edit.nameEditing) requestAnimationFrame(() => {
        const input = el.querySelector('[data-menu-bot-name]');
        if (!input) return;
        input.focus();
        input.select();
      });
    },
    showStructureMenu(s, x, y) {
      const el = this.dom.structureMenu;
      const processing = s.processing ? `<br>processing ${escapeHtml(s.processing.label)} · ${Math.max(0, s.processing.remaining).toFixed(1)}s left` : '';
      const storage = (s.type === 'throne' ? `<br>owner ${s.ownerLabel || s.ownerId || 'none'} · HP ${Math.max(0, s.hp || 0)}/${s.maxHp || THRONE_HP}` : s.type === 'defensetower' ? `<br>range ${s.rangedAttack?.range || DEFENSE_TOWER_ATTACK.range} · damage ${s.rangedAttack?.damage || 1} · cooldown ${s.rangedAttack?.cooldown || 1}s${s.rangedAttack?.targetRef ? ` · target ${s.rangedAttack.targetRef}` : ''}` : STORAGE_STRUCTURE_TYPES.includes(s.type) ? `<br>locked type ${s.storageType || 'empty/unlocked'} · stored ${s.stored || 0}/${s.capacity || 0}` : s.type === 'workbench' ? `<br>sticks ${s.sticks||0} · stones ${s.stones||0} · output ${escapeHtml(itemLabel(workbenchRecipe(s)))} · made A${s.axes||0} P${s.pickaxes||0} S${s.shovels||0} H${s.hammers||0}` : s.type === 'smithery' ? `<br>sticks ${s.sticks||0} · planks ${s.planks||0} · mode ${escapeHtml(itemLabel(smitheryRecipe(s)))} · made swords ${s.swords||0} shields ${s.shields||0}` : s.type === 'bowmaker' ? `<br>sticks ${s.sticks||0}/2 · hemp ${s.hemps||0}/3 · made bows ${s.bows||0}` : s.type === 'arrowmaker' ? `<br>sticks ${s.sticks||0}/1 · stones ${s.stones||0}/1 · arrow packs ${s.arrow_packs||0}` : s.type === 'factory' ? `<br>logs ${s.logs||0} · planks ${s.planks||0} · poles ${s.poles||0} · seeds ${s.tree_seeds||0}` : s.type === 'assembler' ? `<br>planks ${s.planks||0}/2 · poles ${s.poles||0}/1 · output ${escapeHtml(itemLabel(assemblerRecipe(s)))}` : `<br>logs ${s.logs||0} · planks ${s.planks||0} · poles ${s.poles||0}`) + processing;
      const insertButton = STORAGE_STRUCTURE_TYPES.includes(s.type) ? '<button data-insert-nearby>Insert nearby item</button>' : '<button data-add-radius>Add small radius</button>';
      const demolishButton = this.canDemolishStructure(s) ? '<button data-demolish-structure>Demolish with hammer</button>' : '';
      const disassembleButton = this.canDisassembleStructure(s) ? '<button data-disassemble-structure>Disassemble into kit</button>' : '';
      const selectedRecipe = workbenchRecipe(s);
      const selector = s.type === 'workbench' ? `<section class="tool-selector" aria-label="Tool bench output"><b>Produce:</b> ${WORKBENCH_TOOL_RECIPES.map(type => `<button type="button" data-select-tool="${type}"${type === selectedRecipe ? ' aria-pressed="true" class="is-active"' : ' aria-pressed="false"'}>${escapeHtml(itemLabel(type))}</button>`).join('')}</section>` : s.type === 'smithery' ? `<section class="tool-selector" aria-label="Smithery production mode"><b>Production mode:</b> <button type="button" data-switch-smithery>${escapeHtml(itemLabel(smitheryRecipe(s)))} (switch)</button></section>` : s.type === 'assembler' ? `<section class="tool-selector" aria-label="Assembler building kit output"><b>Assemble:</b> ${BUILDING_KIT_ITEM_TYPES.map(type => `<button type="button" data-select-kit="${type}"${type === assemblerRecipe(s) ? ' aria-pressed="true" class="is-active"' : ' aria-pressed="false"'}>${escapeHtml(itemLabel(type))}</button>`).join('')}</section>` : '';
      const info = STRUCTURE_INFO[s.type] || 'Building.';
      const visibleType = BUILDING_TYPES[s.type]?.category || s.type;
      el.innerHTML = `<b>${escapeHtml(s.name)}</b><button data-close>×</button><p>${escapeHtml(s.label)} · type <code>${escapeHtml(visibleType)}</code> · ref <code>${escapeHtml(s.ref)}</code>${storage}<br><b>Info:</b> ${escapeHtml(info)}<br><b>Recipe:</b> ${escapeHtml(structureRecipeText(s))}</p>${selector}${demolishButton}${disassembleButton}<button data-add-name>Add name</button><button data-add-ref>Add ref</button>${insertButton}`;
      this.placeMenu(el,x,y);
      el.querySelector('[data-close]').onclick=()=>this.hideMenus();
      el.querySelectorAll('[data-select-tool]').forEach(btn => btn.addEventListener('click', () => {
        if (this.setWorkbenchRecipe(s, btn.dataset.selectTool)) this.showStructureMenu(s, x, y);
      }));
      el.querySelectorAll('[data-select-kit]').forEach(btn => btn.addEventListener('click', () => {
        if (this.setAssemblerRecipe(s, btn.dataset.selectKit)) this.showStructureMenu(s, x, y);
      }));
      el.querySelector('[data-switch-smithery]')?.addEventListener('click', () => {
        if (this.switchSmitheryRecipe(s)) this.showStructureMenu(s, x, y);
      });
      el.querySelector('[data-demolish-structure]')?.addEventListener('click', () => { this.queuePlayerDemolishStructure(s) || this.manualDemolishStructure(s); this.hideMenus(); });
      el.querySelector('[data-disassemble-structure]')?.addEventListener('click', () => { this.queuePlayerDisassembleStructure(s); this.hideMenus(); });
      el.querySelector('[data-add-name]').onclick=()=>{this.chat.insertAtCursor(s.name); this.hideMenus();};
      el.querySelector('[data-add-ref]').onclick=()=>{this.chat.insertAtCursor(s.ref); this.hideMenus();};
      el.querySelector('[data-add-radius]')?.addEventListener('click',()=>{this.chat.insertAtCursor(`small area around ${s.name}`); this.hideMenus();});
      el.querySelector('[data-insert-nearby]')?.addEventListener('click',()=>{this.acceptNearestItemForPalette(s); this.hideMenus();});
    },
    showBuildingKitItemMenu(item, x, y) {
      const el = this.dom.structureMenu;
      const kitType = this.normalizeBuildingKitItemType(item?.type);
      const buildingType = buildingTypeFromKitItem(kitType);
      const buildingLabel = BUILDING_TYPES[buildingType]?.label || buildingType || 'building';
      el.innerHTML = `<b>${escapeHtml(itemLabel(kitType || item?.type || 'kit'))}</b><button data-close>×</button><p>Building kit item · ref <code>${escapeHtml(item?.ref || '')}</code><br>Deploys into ${escapeHtml(buildingLabel)}.</p><button data-kit-pickup>Pick up kit</button><button data-kit-deploy>Deploy here</button>`;
      this.placeMenu(el, x, y);
      el.querySelector('[data-close]').onclick = () => this.hideMenus();
      el.querySelector('[data-kit-pickup]')?.addEventListener('click', () => { this.queuePlayerItemPickup(item); this.hideMenus(); });
      el.querySelector('[data-kit-deploy]')?.addEventListener('click', () => { this.queuePlayerDeployLooseKit(item); this.hideMenus(); });
    },
    showTreeMenu(tree, x, y) {
      const el = this.dom.structureMenu;
      const displayName = this.treeDisplayName(tree);
      const searchState = tree.searchReservedBy ? `reserved by ${tree.searchReservedBy}` : 'unreserved';
      const hpLine = tree.stump ? 'stump' : `HP ${Math.max(0, tree.hp || 0)}/${tree.maxHp || 1}`;
      el.innerHTML = `<b>${escapeHtml(displayName)}</b><button data-close>×</button><p>Resource type <code>tree</code> · ref <code>${escapeHtml(tree.ref || `tree:${tree.id}`)}</code><br>${escapeHtml(hpLine)} · stage ${escapeHtml(tree.growthStage || 'grown_tree')}<br>search ${escapeHtml(searchState)}</p><button data-add-tree-name>Add name</button><button data-add-tree-ref>Add ref</button><button data-add-tree-radius>Add small radius</button>`;
      this.placeMenu(el, x, y);
      el.querySelector('[data-close]').onclick = () => this.hideMenus();
      el.querySelector('[data-add-tree-name]')?.addEventListener('click', () => {
        this.chat.insertAtCursor(displayName);
        this.hideMenus();
      });
      el.querySelector('[data-add-tree-ref]')?.addEventListener('click', () => {
        this.chat.insertAtCursor(tree.ref || `tree:${tree.id}`);
        this.hideMenus();
      });
      el.querySelector('[data-add-tree-radius]')?.addEventListener('click', () => {
        this.chat.insertAtCursor(`small area around ${displayName}`);
        this.hideMenus();
      });
    },
    showHoleMenu(hole, x, y) {
      const el = this.dom.structureMenu;
      const canPlant = this.player.inventory?.type === 'tree_seed' && !hole.planted;
      el.innerHTML = `<b>${escapeHtml(hole.planted ? 'planted hole' : 'dug hole')}</b><button data-close>×</button><p>Resource type <code>dug_hole</code> · ref <code>${escapeHtml(hole.ref || `hole:${hole.id}`)}</code><br>${hole.planted ? 'already planted' : 'open for tree seed'}${hole.reservedBy ? ` · reserved by ${escapeHtml(String(hole.reservedBy))}` : ''}</p>${canPlant ? '<button data-plant-seed>Plant tree seed</button>' : ''}<button data-add-hole-name>Add name</button><button data-add-hole-ref>Add ref</button><button data-add-hole-radius>Add small radius</button>`;
      this.placeMenu(el, x, y);
      el.querySelector('[data-close]').onclick = () => this.hideMenus();
      el.querySelector('[data-plant-seed]')?.addEventListener('click', () => {
        this.queuePlayerPlantSeedAtHole(hole);
        this.hideMenus();
      });
      el.querySelector('[data-add-hole-name]')?.addEventListener('click', () => {
        this.chat.insertAtCursor(hole.planted ? 'planted hole' : 'dug hole');
        this.hideMenus();
      });
      el.querySelector('[data-add-hole-ref]')?.addEventListener('click', () => {
        this.chat.insertAtCursor(hole.ref || `hole:${hole.id}`);
        this.hideMenus();
      });
      el.querySelector('[data-add-hole-radius]')?.addEventListener('click', () => {
        this.chat.insertAtCursor(`small area around ${hole.ref || `hole:${hole.id}`}`);
        this.hideMenus();
      });
    },
    syncZonesUi() {
      const list = this.dom.zoneList;
      if (!list) return;
      if (!this.zones.length) { list.innerHTML = '<p class="empty">No zones yet.</p>'; return; }
      list.innerHTML = this.zones.map(z => `<div class="zone-card${z.hidden ? ' is-hidden' : ''}" data-zone-id="${escapeHtml(z.id)}"><div><b>${escapeHtml(z.name)}</b><p>${escapeHtml(z.id)} · ${escapeHtml(z.kind === 'radius' ? `radius ${Math.round(z.radius || DEFAULT_RESOURCE_RADIUS)}px` : `${Math.round(z.w || 0)}×${Math.round(z.h || 0)}`)}${z.hidden ? ' · hidden' : ''}</p></div><div class="zone-card-actions"><button type="button" data-rename-zone="${escapeHtml(z.id)}">Rename</button><button type="button" data-toggle-zone-hidden="${escapeHtml(z.id)}">${z.hidden ? 'Show' : 'Hide'}</button><button type="button" data-add-zone-name="${escapeHtml(z.id)}">Add name</button></div></div>`).join('');
      list.querySelectorAll('[data-rename-zone]').forEach(btn => btn.addEventListener('click', () => this.promptRenameZone(this.zones.find(z => z.id === btn.dataset.renameZone))));
      list.querySelectorAll('[data-toggle-zone-hidden]').forEach(btn => btn.addEventListener('click', () => { const z = this.zones.find(zone => zone.id === btn.dataset.toggleZoneHidden); if (z) this.setZoneHidden(z, !z.hidden); }));
      list.querySelectorAll('[data-add-zone-name]').forEach(btn => btn.addEventListener('click', () => { const z = this.zones.find(zone => zone.id === btn.dataset.addZoneName); if (z) this.chat.insertAtCursor(z.name); }));
    },
    promptRenameZone(z) { const next = z ? window.prompt('Rename zone', z.name) : null; if (next != null) this.renameZone(z, next); },
    renameZone(z, name) {
      const next = String(name || '').trim();
      if (!z || !next) return false;
      z.name = next;
      this.syncZonesUi();
      { const p = this.zoneAnchorPoint(z); this.addFloat(`Renamed ${z.id} to ${z.name}`, p.x, p.y - 8, '#d3a95f'); }
      return true;
    },
    setZoneHidden(z, hidden) {
      if (!z) return false;
      z.hidden = Boolean(hidden);
      if (z.hidden && this.mouse.hoverZone === z) this.mouse.hoverZone = null;
      this.syncZonesUi();
      { const p = this.zoneAnchorPoint(z); this.addFloat(`${z.hidden ? 'Hid' : 'Showed'} ${z.name}`, p.x, p.y - 8, z.hidden ? '#c7b683' : '#9abf8f'); }
      return true;
    },
    showZoneMenu(z, x, y) {
      const el = this.dom.structureMenu;
      const text = this.zoneText(z);
      const size = z.kind === 'radius' ? `radius ${Math.round(z.radius || DEFAULT_RESOURCE_RADIUS)} px` : `${Math.round(z.w || 0)}×${Math.round(z.h || 0)} px`;
      el.innerHTML = `<b>${escapeHtml(z.name)}</b><button data-close>×</button><p>Zone ref <code>${escapeHtml(z.id)}</code><br>${escapeHtml(size)}<br><code>${escapeHtml(text)}</code></p><button data-add-rect>Add zone coords</button><button data-add-name>Add zone name</button><button data-add-ref>Add zone ref</button><button data-rename-zone>Rename</button><button data-hide-zone>Hide zone</button>`;
      this.placeMenu(el,x,y);
      el.querySelector('[data-close]').onclick=()=>this.hideMenus();
      el.querySelector('[data-add-rect]').onclick=()=>{this.chat.insertAtCursor(text); this.hideMenus();};
      el.querySelector('[data-add-name]').onclick=()=>{this.chat.insertAtCursor(z.name); this.hideMenus();};
      el.querySelector('[data-add-ref]').onclick=()=>{this.chat.insertAtCursor(z.id); this.hideMenus();};
      el.querySelector('[data-rename-zone]').onclick=()=>{this.promptRenameZone(z); this.showZoneMenu(z, x, y);};
      el.querySelector('[data-hide-zone]').onclick=()=>{this.setZoneHidden(z, true); this.hideMenus();};
    }
  });
}
