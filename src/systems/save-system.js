// src/systems/save-system.js
// Save/load: serialize and deserialize the full game state.
// Part of the Game class composition root — installed via installSaveSystem(Game, deps).
//
// Dependencies (passed via deps):
//   WORLD_MAP_SIZE, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM, FOG_CELL_SIZE, DEFAULT_WORLD_ZONES,
//   DEFAULT_MANAGER_KNOWLEDGE_PACKS, DEFAULT_BOT_COMBAT_MODE,
//   createFogOfWar, normalizeFogOfWar, serializeFogOfWar,
//   createEquipment, ensureEquipment, clone.

export function installSaveSystem(Game, deps) {
  const {
    WORLD_MAP_SIZE,
    CAMERA_MIN_ZOOM,
    CAMERA_MAX_ZOOM,
    FOG_CELL_SIZE,
    DEFAULT_WORLD_ZONES,
    DEFAULT_MANAGER_KNOWLEDGE_PACKS,
    DEFAULT_BOT_COMBAT_MODE,
    createFogOfWar,
    normalizeFogOfWar,
    serializeFogOfWar,
    createEquipment,
    ensureEquipment,
    clone
  } = deps;

  Object.assign(Game.prototype, {
    exportSave() {
      return {
        schema: 'orchestrator-grove-save-v1',
        savedAt: new Date().toISOString(),
        worldTime: this.worldTime || 0,
        dayNight: this.getDayNightState(),
        fogOfWar: serializeFogOfWar(this.fogOfWar),
        nightSpawns: clone(this.nightSpawns || {}),
        mode: this.gameMode || (this.multiplayer?.enabled ? 'multiplayer' : 'solo'),
        map: clone(this.map),
        camera: clone(this.camera),
        player: clone(this.player),
        assistant: clone(this.assistant),
        multiplayer: clone(this.multiplayer),
        mapFeatures: clone(this.mapFeatures || []),
        recorder: clone(this.recorder),
        recordedLoop: clone(this.recordedLoop),
        customTemplates: clone(this.customTemplates || []),
        botTeams: clone(this.botTeams),
        zones: clone(this.zones),
        idleDepot: clone(this.idleDepot),
        trees: clone(this.trees), hempPlants: clone(this.hempPlants), rocks: clone(this.rocks), holes: clone(this.holes), items: clone(this.items), bots: clone(this.bots), structures: clone(this.structures), monsters: clone(this.monsters), projectiles: clone(this.projectiles),
        counters: { nextItemId: this.nextItemId, nextRockId: this.nextRockId, nextHoleId: this.nextHoleId, nextTreeId: this.nextTreeId, nextHempId: this.nextHempId, nextMonsterId: this.nextMonsterId, nextProjectileId: this.nextProjectileId, nextBotId: this.nextBotId, nextStructureId: this.nextStructureId, nextZoneId: this.nextZoneId, nextBotTeamId: this.nextBotTeamId, nextCustomTemplateId: this.nextCustomTemplateId },
        settings: { maxBots: this.maxBots, targetFps: this.targetFps }
      };
    },

    loadSave(payload) {
      if (!payload || payload.schema !== 'orchestrator-grove-save-v1') throw new Error('Unsupported save format');
      this.map = { ...WORLD_MAP_SIZE, ...(payload.map || {}) };
      this.gameMode = payload.mode || (payload.multiplayer?.enabled ? 'multiplayer' : 'test');
      this.camera = { x: 0, y: 0, speed: 520, fastMultiplier: 2.35, zoom: 1, minZoom: CAMERA_MIN_ZOOM, maxZoom: CAMERA_MAX_ZOOM, ...(payload.camera || {}) };
      this.player = { x: 480, y: 410, r: 13, speed: 170, target: null, targetQueue: [], inventory: null, equipment: createEquipment(), attackCooldown: 0, hp: 10, maxHp: 10, ...(payload.player || {}) };
      ensureEquipment(this.player);
      this.assistant = { x: 452, y: 392, ...(payload.assistant || {}) };
      this.multiplayer = { enabled: false, sessionId: null, role: 'solo', playerId: 'p1', status: 'Solo prototype', players: {}, winner: null, syncTimer: 0, ...(payload.multiplayer || {}) };
      this.worldTime = Number(payload.worldTime || 0);
      this.fogOfWar = normalizeFogOfWar(payload.fogOfWar || {}, { cellSize: FOG_CELL_SIZE });
      this.nightSpawns = { active: false, timer: 1.5, spawnedThisNight: 0, ...(payload.nightSpawns || {}) };
      this.mapFeatures = clone(payload.mapFeatures || []);
      this.recorder = { recording: false, steps: [], lastAssignedBotId: null, targetBotId: null, status: '', ...(payload.recorder || {}) };
      this.recordedLoop = clone(payload.recordedLoop || []);
      this.customTemplates = clone(payload.customTemplates || []);
      this.nextCustomTemplateId = Math.max(1, ...this.customTemplates.map(template => Number(template.numericId || String(template.id || '').replace(/^template:/, '')) || 0)) + 1;
      this.botTeams = clone(payload.botTeams || []);
      this.nextBotTeamId = Math.max(1, ...this.botTeams.map(team => Number(team.numericId || String(team.id || '').replace(/^team:/, '')) || 0)) + 1;
      this.zones = clone(payload.zones || DEFAULT_WORLD_ZONES);
      this.idleDepot = { x: 115, y: 245, label: 'idle depot', ...(payload.idleDepot || {}) };
      this.trees = clone(payload.trees || []); this.hempPlants = clone(payload.hempPlants || []); this.rocks = clone(payload.rocks || []); this.holes = clone(payload.holes || []); this.items = clone(payload.items || []); this.bots = clone(payload.bots || []); this.structures = clone(payload.structures || []); this.monsters = clone(payload.monsters || []); this.projectiles = clone(payload.projectiles || []); this.floaters = [];
      for (const bot of this.bots) { ensureEquipment(bot); bot.name = bot.name || `Bot ${bot.id}`; bot.kind = bot.kind === 'dog' ? 'dog' : 'bot'; bot.status = bot.status === 'manager' ? 'manager' : 'worker'; bot.taughtLoopRepeat = bot.taughtLoopRepeat !== false; bot.managerKnowledgePacks = this.normalizeManagerKnowledgePacks(bot.managerKnowledgePacks || bot.knowledgePacks || [], bot.status === 'manager' ? DEFAULT_MANAGER_KNOWLEDGE_PACKS : []); bot.knowledgePacks = bot.kind === 'dog' ? (Array.isArray(bot.knowledgePacks) && bot.knowledgePacks.length ? bot.knowledgePacks : ['dog_fetch']) : (Array.isArray(bot.knowledgePacks) ? bot.knowledgePacks : bot.managerKnowledgePacks); bot.dogFetchMemory = this.normalizeDogFetchMemory(bot.dogFetchMemory); bot.dogFetchState = this.normalizeDogFetchState(bot.dogFetchState); if (!bot.combatMode) bot.combatMode = DEFAULT_BOT_COMBAT_MODE; if (!bot.combatEngaged) bot.combatEngaged = false; if (bot.teamId && !this.findBotTeam(bot.teamId)) bot.teamId = null; }
      const counters = payload.counters || {};
      this.nextItemId = Number(counters.nextItemId || 1); this.nextRockId = Number(counters.nextRockId || 1); this.nextHoleId = Number(counters.nextHoleId || 1); this.nextTreeId = Number(counters.nextTreeId || 1); this.nextHempId = Number(counters.nextHempId || 1); this.nextMonsterId = Number(counters.nextMonsterId || 1); this.nextProjectileId = Number(counters.nextProjectileId || 1); this.nextBotId = Number(counters.nextBotId || 1); this.nextStructureId = Number(counters.nextStructureId || 1); this.nextZoneId = Number(counters.nextZoneId || 1); this.nextBotTeamId = Number(counters.nextBotTeamId || this.nextBotTeamId || 1); this.nextCustomTemplateId = Number(counters.nextCustomTemplateId || this.nextCustomTemplateId || 1);
      if (payload.settings?.maxBots) this.maxBots = Number(payload.settings.maxBots);
      if (payload.settings?.targetFps) this.targetFps = Number(payload.settings.targetFps);
      this.placementType = null; this.zoneDraft = null; this.zoneDrag = null; this.justDrewZone = false; this.justDraggedZone = false;
      this.clampCamera();
      this.syncBuildUi(); this.syncTeachUi?.(); this.syncZonesUi?.(); this.syncTemplateDrawerUi?.(); this.syncBotDrawerUi?.(); this.updateHover();
      return this.getState();
    }
  });
}
