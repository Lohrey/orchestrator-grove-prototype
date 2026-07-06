// src/systems/dog-system.js
// Dog/pet system: dog fetch popup UI, fetch commands, praise/reject, memory normalization.
// Part of the Game class composition root — installed via installDogSystem(Game, deps).
//
// Dependencies (passed via deps):
//   DOG_FETCH_SEARCH_RADIUS, DOG_FETCH_PRAISE_TARGET, itemLabel, clamp, distXY, escapeHtml, nearest.

import { clamp, distXY, escapeHtml, nearest } from '../utils.js';

export function installDogSystem(Game, deps) {
  const {
    DOG_FETCH_SEARCH_RADIUS,
    DOG_FETCH_PRAISE_TARGET,
    itemLabel
  } = deps;

  Object.assign(Game.prototype, {
    normalizeDogFetchMemory(memory = null) {
      const praiseCounts = Object.fromEntries(Object.entries(memory?.praiseCounts || memory?.praises || {})
        .map(([type, count]) => [this.normalizeItemType(type, null), Math.max(0, Math.floor(Number(count) || 0))])
        .filter(([type]) => !!type));
      const preferredType = this.normalizeItemType(memory?.preferredType || memory?.lastTargetType || memory?.targetType || null, null);
      const lastTargetType = this.normalizeItemType(memory?.lastTargetType || memory?.targetType || null, null);
      return { praiseCounts, preferredType, lastTargetType };
    },

    normalizeDogFetchState(state = null) {
      if (!state || typeof state !== 'object') return null;
      const requestedType = this.normalizeItemType(state.requestedType || state.targetType || null, null);
      const targetType = this.normalizeItemType(state.targetType || requestedType || null, null);
      const targetItemId = Number.isFinite(Number(state.targetItemId)) ? Number(state.targetItemId) : null;
      return {
        requestedText: String(state.requestedText || state.command || '').trim(),
        requestedType,
        targetType,
        targetItemId,
        awaitingReward: !!state.awaitingReward,
        source: String(state.source || 'dog menu').trim() || 'dog menu'
      };
    },

    spawnStarterDog(x, y) {
      const dog = this.createBot(x, y, 'dog_fetch', true);
      if (!dog) return null;
      dog.kind = 'dog';
      dog.knowledgePacks = ['dog_fetch'];
      dog.dogFetchMemory = this.normalizeDogFetchMemory(dog.dogFetchMemory);
      dog.dogFetchState = null;
      dog.program = 'dog_fetch';
      dog.state = 'dog_fetch';
      dog.name = 'Dog';
      dog.message = 'Following the player.';
      dog.dogFetchState = null;
      this.syncBotDrawerUi?.(true);
      return dog;
    },

    showDogPopup(bot, mode = null) {
      if (!bot) return;
      this.dogPopupState = { botId: bot.id, mode: mode || (bot.inventory ? 'reward' : 'progress') };
      this.syncDogPopupUi(true);
    },

    isDogFetchPraiseAllowed(bot) {
      if (!bot || !bot.inventory) return false;
      const request = this.normalizeDogFetchState(bot.dogFetchState);
      if (!request?.requestedType) return true;
      return bot.inventory.type === request.requestedType;
    },

    dogFetchPraiseProgress(bot) {
      const memory = this.normalizeDogFetchMemory(bot?.dogFetchMemory);
      const entries = Object.entries(memory.praiseCounts || {}).filter(([, count]) => Number(count) > 0).sort((a, b) => b[1] - a[1]);
      return entries.map(([type, count]) => ({ type, count, ratio: Math.min(1, count / DOG_FETCH_PRAISE_TARGET) }));
    },

    closeDogPopup() {
      window.voiceInputDebug?.clearVoiceTargetInput?.();
      if (this.dom.dogPopup) this.dom.dogPopup.hidden = true;
      this.dogPopupState = null;
    },

    placeDogPopup(el, bot, { above = 52 } = {}) {
      const point = this.worldToScreen(bot.x, bot.y - (bot.r || 11) - above);
      const pad = 12;
      const width = Math.min(320, Math.max(240, el.offsetWidth || 280));
      const height = Math.min(340, Math.max(120, el.offsetHeight || 160));
      const x = clamp(point.x, width / 2 + pad, Math.max(width / 2 + pad, window.innerWidth - width / 2 - pad));
      const y = clamp(point.y, height + pad, Math.max(height + pad, window.innerHeight - pad));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = 'translate(-50%, -100%)';
    },

    dogPopupRenderKey(bot, mode) {
      const request = this.normalizeDogFetchState(bot?.dogFetchState);
      const praiseCounts = bot?.dogFetchMemory?.praiseCounts || {};
      return JSON.stringify({
        botId: bot?.id || null,
        mode,
        carrying: !!bot?.inventory,
        itemType: bot?.inventory?.type || null,
        requestedType: request?.requestedType || null,
        targetType: request?.targetType || null,
        praiseCounts
      });
    },

    renderDogPopup(bot, mode = 'progress') {
      const el = this.dom.dogPopup;
      if (!el || !bot) return;
      const carrying = !!bot.inventory;
      const requestedType = this.normalizeDogFetchState(bot.dogFetchState)?.requestedType || null;
      const currentType = bot.inventory?.type || null;
      const isReward = mode === 'reward' && carrying;
      const progress = this.dogFetchPraiseProgress(bot);
      const draft = bot.dogCommandDraft || '';
      const currentLabel = currentType ? itemLabel(currentType) : '';
      const requestedLabel = requestedType ? itemLabel(requestedType) : '';
      const progressSummary = progress.length
        ? progress.map(entry => `<div class="dog-progress-row"><span>${escapeHtml(itemLabel(entry.type))}</span><span>${entry.count}/${DOG_FETCH_PRAISE_TARGET}</span><div class="dog-progress-bar"><i style="width:${Math.round(entry.ratio * 100)}%"></i></div></div>`).join('')
        : '<p class="dog-popup-empty">No fetches praised yet.</p>';
      const rewardSummary = requestedType
        ? `Requested ${escapeHtml(requestedLabel)}. Brought ${escapeHtml(currentLabel)}.`
        : `Brought ${escapeHtml(currentLabel)}.`;
      el.innerHTML = isReward
        ? `<div class="dog-popup-panel dog-popup-reward" data-dog-popup-panel><header><b>Good dog?</b><span>${escapeHtml(currentLabel)}</span></header><p class="dog-popup-summary">${rewardSummary}</p><div class="dog-popup-buttons"><button type="button" class="dog-popup-button is-yes" data-dog-popup-praise${this.isDogFetchPraiseAllowed(bot) ? '' : ' data-disabled="true" aria-disabled="true"'} aria-label="Praise dog">✓</button><button type="button" class="dog-popup-button is-no" data-dog-popup-reject aria-label="Reject dog">✕</button></div><p class="dog-popup-hint">${requestedType ? `Praise only works for ${escapeHtml(requestedLabel)}.` : 'Praise increases the learned chance for this item type.'}</p></div>`
        : `<div class="dog-popup-panel dog-popup-progress" data-dog-popup-panel><header><b>Dog fetch</b><span>Learning progress</span></header><label class="dog-fetch-input dog-popup-input"><span>Teach command</span><input data-dog-fetch-command placeholder="go fetch me a stick" value="${escapeHtml(draft)}" autocomplete="off"></label><div class="dog-popup-actions"><button type="button" data-dog-fetch-submit>Send</button><button type="button" data-dog-popup-mic aria-label="Dictate command">Mic</button></div><p class="dog-popup-hint">The dog follows you, picks up nearby items, then comes back for praise.</p><div class="dog-popup-progress-list">${progressSummary}</div><p class="dog-popup-hint">10 praises for one item type makes it a guaranteed choice when that item is available.</p></div>`;
      el.dataset.dogPopupKey = this.dogPopupRenderKey(bot, mode);
      if (!el.dataset.dogPopupBound) {
        el.dataset.dogPopupBound = 'true';
      }
      const handleRewardAction = action => {
        const state = this.dogPopupState;
        const currentBot = state?.botId ? this.findBot(state.botId) : null;
        if (!currentBot) return;
        if (action === 'praise') {
          if (!this.isDogFetchPraiseAllowed(currentBot)) {
            const btn = el.querySelector('[data-dog-popup-praise]');
            if (btn) {
              btn.classList.remove('is-wobble');
              void btn.offsetWidth;
              btn.classList.add('is-wobble');
              setTimeout(() => btn.classList.remove('is-wobble'), 280);
            }
            currentBot.message = 'Not possible.';
            this.emitSound('ui_error', { cooldownKey: `dog:not_possible:${currentBot.id}`, minGapMs: 150 });
            this.renderDogPopup(currentBot, 'reward');
            return;
          }
          const res = this.praiseDogFetch(currentBot);
          if (res.ok) this.closeDogPopup();
          return;
        }
        if (action === 'reject') {
          const res = this.rejectDogFetch(currentBot);
          if (res.ok) this.closeDogPopup();
        }
      };
      el.querySelector('[data-dog-popup-praise]')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handleRewardAction('praise');
      });
      el.querySelector('[data-dog-popup-reject]')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handleRewardAction('reject');
      });
      el.querySelector('[data-dog-popup-praise]')?.addEventListener('pointerdown', event => event.stopPropagation());
      el.querySelector('[data-dog-popup-reject]')?.addEventListener('pointerdown', event => event.stopPropagation());
      this.placeDogPopup(el, bot, { above: isReward ? 58 : 54 });
      el.hidden = false;
      requestAnimationFrame(() => {
        const input = el.querySelector('[data-dog-fetch-command]');
        if (input) {
          input.focus({ preventScroll: true });
          input.setSelectionRange(0, input.value.length);
        }
      });
    },

    syncDogPopupUi(force = false) {
      const el = this.dom.dogPopup;
      if (!el) return;
      const state = this.dogPopupState;
      const bot = state?.botId ? this.findBot(state.botId) : this.bots.find(entry => entry.kind === 'dog' && entry.inventory && distXY(entry.x, entry.y, this.player.x, this.player.y) <= 64) || this.bots.find(entry => entry.kind === 'dog') || null;
      if (!bot || (!state && !bot.inventory)) { if (!force) el.hidden = true; return; }
      const carrying = !!bot.inventory;
      const nearPlayer = carrying && distXY(bot.x, bot.y, this.player.x, this.player.y) <= 72;
      const mode = carrying && nearPlayer ? 'reward' : (state?.mode || 'progress');
      if (!carrying && mode === 'reward') {
        el.hidden = true;
        return;
      }
      this.dogPopupState = { botId: bot.id, mode };
      const renderKey = this.dogPopupRenderKey(bot, mode);
      const shouldRender = force || el.hidden || el.dataset.dogPopupKey !== renderKey;
      if (shouldRender) this.renderDogPopup(bot, mode);
      else if (mode !== 'reward') this.placeDogPopup(el, bot, { above: carrying ? 58 : 54 });
      if (!shouldRender) return;
      el.querySelector('[data-dog-fetch-submit]')?.addEventListener('click', () => {
        const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
        const res = this.setDogFetchCommand(bot, text);
        if (res.ok) this.renderDogPopup(bot, 'progress');
      });
      el.querySelector('[data-dog-fetch-command]')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
          const res = this.setDogFetchCommand(bot, text);
          if (res.ok) this.renderDogPopup(bot, 'progress');
        }
      });
      el.querySelector('[data-dog-popup-mic]')?.addEventListener('click', async () => {
        const input = el.querySelector('[data-dog-fetch-command]');
        if (!input) return;
        const voice = window.voiceInputDebug;
        if (!voice) return;
        if (voice.isRecording?.()) {
          await voice.stopVoice?.();
          voice.clearVoiceTargetInput?.();
        } else {
          voice.setVoiceTargetInput?.(input);
          await voice.startVoice?.();
        }
      });
    },

    extractDogRequestedItemType(text) {
      const lower = String(text || '').toLowerCase();
      const candidates = ['arrow pack', 'log', 'plank', 'pole', 'stick', 'stone', 'tree seed', 'hemp seed', 'hemp', 'crude axe', 'crude pickaxe', 'crude shovel', 'crude hammer', 'wooden sword', 'wooden shield', 'bow'];
      for (const candidate of candidates) {
        if (new RegExp(`\\b${candidate.replace(/ /g, '\\s+')}\\b`).test(lower)) {
          const type = this.normalizeItemType(candidate, null);
          if (type && !this.isEquipmentItem(type)) return type;
        }
      }
      return null;
    },

    chooseDogFetchTargetType(bot, requestedType = null) {
      const nearbyItems = this.items.filter(item => distXY(bot.x, bot.y, item.x, item.y) <= DOG_FETCH_SEARCH_RADIUS && (!item.reservedBy || item.reservedBy === bot.id) && !this.isEquipmentItem(item.type));
      if (!nearbyItems.length) return null;
      if (requestedType) {
        const exactItems = nearbyItems.filter(item => item.type === requestedType);
        if (exactItems.length) return exactItems[0].type;
      }
      const memory = this.normalizeDogFetchMemory(bot.dogFetchMemory);
      const praiseCounts = memory.praiseCounts || {};
      const countsByType = nearbyItems.reduce((acc, item) => {
        acc[item.type] = Math.max(acc[item.type] || 0, praiseCounts[item.type] || 0);
        return acc;
      }, {});
      const sorted = Object.entries(countsByType).sort((a, b) => b[1] - a[1]);
      const [bestType, bestCount] = sorted[0] || [];
      if (bestType && bestCount > 0) {
        const chance = Math.min(1, bestCount / DOG_FETCH_PRAISE_TARGET);
        if (chance >= 1 || Math.random() < chance) return bestType;
      }
      return nearbyItems[Math.floor(Math.random() * nearbyItems.length)]?.type || null;
    },

    setDogFetchCommand(botRef, text) {
      const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
      if (!bot) return { ok: false, error: `Bot ${botRef} not found` };
      if (bot.inventory) return { ok: false, error: 'Dog must have empty paws before a new fetch command.' };
      if (!this.isDogBot(bot)) return { ok: false, error: 'Only the starter dog can learn fetch commands.' };
      const requestedText = String(text || '').trim();
      const requestedType = this.extractDogRequestedItemType(requestedText);
      const targetType = this.chooseDogFetchTargetType(bot, requestedType);
      bot.dogCommandDraft = requestedText;
      bot.dogFetchState = this.normalizeDogFetchState({ requestedText, requestedType, targetType, targetItemId: null, awaitingReward: false, source: 'dog menu' });
      bot.program = 'dog_fetch';
      bot.state = 'dog_fetch';
      bot.message = targetType ? `Fetching ${itemLabel(targetType)}.` : 'No nearby item to fetch.';
      this.releaseReservation(bot);
      this.syncDogPopupUi?.(true);
      this.syncBotDrawerUi?.(true);
      return { ok: true, bot, targetType };
    },

    praiseDogFetch(botRef) {
      const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
      if (!bot || !this.isDogBot(bot) || !bot.inventory) return { ok: false, error: 'Dog has no fetched item to praise.' };
      const type = bot.dogFetchState?.targetType || bot.inventory.type;
      bot.dogFetchMemory = this.normalizeDogFetchMemory(bot.dogFetchMemory);
      bot.dogFetchMemory.praiseCounts[type] = (bot.dogFetchMemory.praiseCounts[type] || 0) + 1;
      bot.dogFetchMemory.preferredType = type;
      bot.dogFetchMemory.lastTargetType = type;
      if (this.canPlayerAcceptItem(type)) {
        this.player.inventory = { type, count: bot.inventory.count || 1 };
        this.addFloat(`Good dog: ${itemLabel(type)} delivered`, bot.x, bot.y - 34, '#9abf8f');
      } else {
        this.spawnItem(type, bot.x + 8, bot.y + 8, bot.inventory.count || 1);
        this.addFloat(`Good dog: dropped ${itemLabel(type)}`, bot.x, bot.y - 34, '#9abf8f');
      }
      bot.inventory = null;
      bot.dogFetchState = null;
      bot.target = null;
      this.releaseReservation(bot);
      bot.message = 'Awaiting fetch command.';
      this.closeDogPopup();
      this.syncBotDrawerUi?.(true);
      return { ok: true, bot, type, praiseCount: bot.dogFetchMemory.praiseCounts[type] };
    },

    rejectDogFetch(botRef) {
      const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
      if (!bot || !this.isDogBot(bot) || !bot.inventory) return { ok: false, error: 'Dog has no fetched item to reject.' };
      const type = bot.inventory.type;
      this.spawnItem(type, bot.x + 8, bot.y + 8, bot.inventory.count || 1);
      bot.inventory = null;
      bot.dogFetchState = null;
      bot.target = null;
      this.releaseReservation(bot);
      bot.message = `Rejected ${itemLabel(type)}.`;
      this.addFloat(`Dog dropped ${itemLabel(type)}`, bot.x, bot.y - 34, '#c86b5f');
      this.closeDogPopup();
      this.syncBotDrawerUi?.(true);
      return { ok: true, bot, type };
    }
  });
}
