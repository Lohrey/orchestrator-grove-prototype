// src/systems/bot-system.js
// Bot creation, teams, display names, bot menu methods, bot drawer rendering.
// Part of the Game class composition root — installed via installBotSystem(Game, deps).

import { distXY, nearest } from '../utils.js?v=20260613-player-tools';

export function installBotSystem(Game, deps) {
  const {
    DEFAULT_MANAGER_KNOWLEDGE_PACKS,
    createEquipment,
    clone,
    itemLabel
  } = deps;

  Object.assign(Game.prototype, {
    createBot(x, y, program = 'idle', force = false) {
      if (!force && this.bots.length >= this.maxBots) { this.addFloat(`Max bots ${this.maxBots}`, x, y - 18, '#c86b5f'); return null; }
      const id = this.nextBotId++;
      const bot = { id, ref: `bot:${id}`, name: `Bot ${id}`, kind: 'bot', status: 'worker', managerKnowledgePacks: [], knowledgePacks: [], teamId: null, x, y, r: 11, speed: 118, program, state: program, message: 'Waiting for assistant.', inventory: null, equipment: createEquipment(), ammunition: 0, hp: 10, maxHp: 10, hostile: false, target: null, targetItemId: null, targetItemPurpose: null, targetHoleId: null, targetStructureId: null, sourceStructureId: null, sourcePaletteId: null, targetFactoryId: null, targetWorkbenchId: null, zoneId: null, zoneSpec: null, pickupItemType: 'log', taughtLoopRepeat: true, timer: 0, runtime: { pc: 0, memory: {}, wait: 0 }, dogFetchMemory: { praiseCounts: {}, preferredType: null, lastTargetType: null }, dogFetchState: null, color: ['#80a9c9','#9abf8f','#d3a95f','#c7b683','#8fb9b5'][id % 5] };
      this.bots.push(bot); this.addFloat(`Bot ${id} online`, x, y - 18, '#80a9c9'); this.emitSound('bot_online', { cooldownKey: 'bot_online', minGapMs: 120 }); return bot;
    },
    resolveBotReference(value) {
      if (value == null || value === '') return null;
      const raw = String(value).trim();
      const numeric = Number(raw.replace(/^bot[:#\s-]*/i, ''));
      if (Number.isFinite(numeric) && numeric > 0) return this.findBot(numeric);
      const lower = raw.toLowerCase();
      return this.bots.find(bot => String(bot.ref || '').toLowerCase() === lower || this.botDisplayName(bot).toLowerCase() === lower || String(bot.name || '').toLowerCase() === lower) || null;
    },
    findBot(id) { return this.bots.find(b => b.id === Number(String(id).replace(/^bot:/,''))); },
    botAt(x, y) { return this.bots.find(b => distXY(x, y, b.x, b.y) <= b.r + 7) || null; },
    botDisplayName(bot) {
      return String(bot?.name || `Bot ${bot?.id ?? ''}`).trim() || `Bot ${bot?.id ?? ''}`;
    },
    normalizeBotDisplayName(name, { fallback = '', minLength = 2, maxLength = 32 } = {}) {
      const cleaned = String(name ?? '')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/[<>`{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
        .trim();
      if (!cleaned || cleaned.length < minLength) return fallback;
      return cleaned;
    },
    teamColor(color) {
      return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color) : '#5d8063';
    },
    findBotTeam(teamId) {
      return this.botTeams.find(team => team.id === teamId) || null;
    },
    botTeam(bot) {
      return bot?.teamId ? this.findBotTeam(bot.teamId) : null;
    },
    setBotName(botOrId, name) {
      const bot = typeof botOrId === 'object' ? botOrId : this.findBot(botOrId);
      if (!bot) return { ok: false, error: 'Bot not found' };
      const fallback = `Bot ${bot.id}`;
      const next = this.normalizeBotDisplayName(name, { fallback, minLength: 1, maxLength: 32 });
      bot.name = next;
      this.addFloat(`Renamed ${fallback} to ${next}`, bot.x, bot.y - 30, '#d3a95f');
      this.syncBotDrawerUi();
      return { ok: true, bot };
    },
    beginBotMenuNameEdit(bot, x, y) {
      const edit = this.ensureBotMenuEdit(bot);
      edit.nameEditing = true;
      edit.nameDraft = this.botDisplayName(bot);
      edit.nameStatus = '';
      this.showBotMenu(bot, x, y, { refreshEdit: true });
      requestAnimationFrame(() => {
        const input = this.dom.botMenu?.querySelector('[data-menu-bot-name]');
        if (!input) return;
        input.focus();
        input.select();
      });
    },
    saveBotMenuName(bot, x, y, name) {
      const edit = this.ensureBotMenuEdit(bot);
      const res = this.setBotName(bot, name);
      edit.nameEditing = false;
      edit.nameDraft = '';
      edit.nameStatus = res.ok ? 'Name saved.' : `Name save failed: ${res.error}`;
      this.showBotMenu(bot, x, y, { refreshEdit: true });
      return res;
    },
    createBotTeam(name, color = '#5d8063') {
      const numericId = this.nextBotTeamId++;
      const team = { id: `team:${numericId}`, numericId, name: String(name || '').trim().replace(/\s+/g, ' ').slice(0, 28) || `Team ${numericId}`, color: this.teamColor(color) };
      this.botTeams.push(team);
      this.syncBotDrawerUi();
      this.addFloat(`Created ${team.name}`, this.player.x, this.player.y - 36, team.color);
      this.emitSound('team_create', { cooldownKey: 'team_create', minGapMs: 120 });
      return team;
    },
    setBotTeamColor(teamId, color) {
      const team = this.findBotTeam(teamId);
      if (!team) return false;
      team.color = this.teamColor(color);
      this.syncBotDrawerUi(true);
      return true;
    },
    assignBotToTeam(botId, teamId = null) {
      const bot = this.findBot(botId);
      if (!bot) return { ok: false, error: 'Bot not found' };
      const team = teamId ? this.findBotTeam(teamId) : null;
      if (teamId && !team) return { ok: false, error: 'Team not found' };
      bot.teamId = team?.id || null;
      this.addFloat(`${this.botDisplayName(bot)} → ${team?.name || 'No team'}`, bot.x, bot.y - 30, team?.color || '#c7b683');
      this.syncBotDrawerUi();
      return { ok: true, bot, team };
    },
    isStandardWorkerBot(bot) { return !!bot && bot.status !== 'manager'; },
    isIdleStandardWorkerBot(bot) { return this.isStandardWorkerBot(bot) && bot.program === 'idle' && !bot.paused; },
    findAnyEligibleWorkerBot() { return this.bots.find(bot => this.isIdleStandardWorkerBot(bot)) || null; },
    isManagerBot(bot) { return !!bot && bot.status === 'manager'; },
    isDogBot(bot) { return !!bot && bot.kind === 'dog'; },
    managerPackCatalogIds() {
      return this.managerKnowledgePackCatalog ? Object.keys(this.managerKnowledgePackCatalog) : DEFAULT_MANAGER_KNOWLEDGE_PACKS;
    },
    normalizeManagerKnowledgePacks(value, fallback = DEFAULT_MANAGER_KNOWLEDGE_PACKS) {
      const raw = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
      const catalogIds = new Set(this.managerPackCatalogIds());
      const ids = [...new Set(raw.map(id => String(id || '').trim()).filter(Boolean))]
        .filter(id => /^[a-z0-9_:-]{2,64}$/i.test(id))
        .filter(id => !catalogIds.size || catalogIds.has(id));
      const fallbackIds = Array.isArray(fallback) ? fallback : DEFAULT_MANAGER_KNOWLEDGE_PACKS;
      return ids.length ? ids : fallbackIds.filter(id => !catalogIds.size || catalogIds.has(id));
    },
    sanitizeManagerMessage(message) {
      return String(message || '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/[<>`{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    },
    setManagerKnowledgePackCatalog(catalog = null) { this.managerKnowledgePackCatalog = catalog && typeof catalog === 'object' ? catalog : null; return this.managerPackCatalogIds(); },
    setManagerKnowledgePacks(botRef, packs = DEFAULT_MANAGER_KNOWLEDGE_PACKS) {
      const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
      if (!bot) return { ok: false, error: `Bot ${botRef} not found` };
      if (!this.isManagerBot(bot)) return { ok: false, error: `${this.botDisplayName(bot)} is not a manager` };
      bot.managerKnowledgePacks = this.normalizeManagerKnowledgePacks(packs, bot.managerKnowledgePacks?.length ? bot.managerKnowledgePacks : DEFAULT_MANAGER_KNOWLEDGE_PACKS);
      bot.knowledgePacks = bot.managerKnowledgePacks;
      this.syncBotDrawerUi?.(true);
      return { ok: true, bot, knowledgePacks: bot.managerKnowledgePacks.slice() };
    },
    promoteBotToManager(botRef, knowledgePacks = DEFAULT_MANAGER_KNOWLEDGE_PACKS) {
      const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
      if (!bot) return { ok: false, error: `Bot ${botRef} not found` };
      bot.status = 'manager';
      bot.managerKnowledgePacks = this.normalizeManagerKnowledgePacks(knowledgePacks, bot.managerKnowledgePacks?.length ? bot.managerKnowledgePacks : DEFAULT_MANAGER_KNOWLEDGE_PACKS);
      bot.knowledgePacks = bot.managerKnowledgePacks;
      bot.message = `Manager online with packs: ${bot.managerKnowledgePacks.join(', ') || 'none'}.`;
      this.addFloat(`${this.botDisplayName(bot)} promoted to manager`, bot.x, bot.y - 34, '#9abf8f');
      this.emitSound('promote', { cooldownKey: `promote:${bot.id}`, minGapMs: 120 });
      this.syncBotDrawerUi?.(true);
      return { ok: true, bot, knowledgePacks: bot.managerKnowledgePacks.slice() };
    },
    localPlayerActor() { Object.assign(this.player, { ref: 'player:local', id: this.multiplayer?.playerId || 'p1' }); return this.player; },
    resolveActorReference(value, actor = null) {
      if (value == null || value === '') return null;
      const raw = String(value).trim();
      const lower = raw.toLowerCase();
      if (['me', 'player', 'my character', 'spieler', 'mir', 'mich'].includes(lower)) return this.localPlayerActor();
      if (['self', 'itself', 'this bot'].includes(lower)) return actor || null;
      const byRef = this.findTargetByRef(raw);
      if (byRef) return byRef;
      const bot = this.resolveBotReference(raw);
      if (bot) return bot;
      const monsterNumber = raw.match(/^monster[:#\s-]*(\d+)$/i)?.[1];
      if (monsterNumber) {
        const monster = this.monsters.find(m => m.id === Number(monsterNumber) && (m.hp || 0) > 0);
        if (monster) return monster;
      }
      const monster = this.monsters.find(m => (m.hp || 0) > 0 && (String(m.ref || '').toLowerCase() === lower || String(m.name || '').toLowerCase() === lower));
      if (monster) return monster;
      const remote = Object.values(this.multiplayer?.players || {}).find(p => p && (`player:${p.id}` === lower || String(p.name || '').toLowerCase() === lower));
      if (remote) return { ...remote, ref: `player:${remote.id}`, radius: 15, hostile: this.multiplayer?.enabled && remote.id !== this.multiplayer.playerId };
      return null;
    },
    actorLabel(actor) { return actor ? (actor === this.player || actor.ref === 'player:local' ? 'player' : actor.name || actor.ref || `Bot ${actor.id}`) : 'target'; },
    moveBotTo(bot, target, dt, close = 16) { if (!target) return false; return this.moveToward(bot, target.x, target.y, dt, bot.speed, close); },
  });
}
