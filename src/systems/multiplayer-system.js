// src/systems/multiplayer-system.js
// Multiplayer mode: throne-objective PvP, lane towers, AI creep waves,
// network state snapshots and remote-state application.
// Part of the Game class composition root — installed via installMultiplayerSystem(Game, deps).
//
// Dependencies (passed via deps):
//   MONSTER_MELEE_ATTACK, MONSTER_WAVE_CONFIG, MULTIPLAYER_LANE_TOWERS,
//   MULTIPLAYER_STARTS, ONLINE_MULTIPLAYER_FEATURES, THRONE_ATTACK_DAMAGE,
//   THRONE_HP, WORLD_MAP_SIZE, clone, createEquipment.

export function installMultiplayerSystem(Game, deps) {
  const {
    MONSTER_MELEE_ATTACK,
    MONSTER_WAVE_CONFIG,
    MULTIPLAYER_LANE_TOWERS,
    MULTIPLAYER_STARTS,
    ONLINE_MULTIPLAYER_FEATURES,
    THRONE_ATTACK_DAMAGE,
    THRONE_HP,
    WORLD_MAP_SIZE,
    clone,
    createEquipment
  } = deps;

  Object.assign(Game.prototype, {
    startLocalAiMatch({ sessionId = `local-ai-${Date.now().toString(36)}`, playerId = 'p1' } = {}) {
      const role = 'local_ai';
      const localStart = MULTIPLAYER_STARTS.p1;
      this.resetWorldCollections();
      this.gameMode = 'local_ai';
      this.map = { ...WORLD_MAP_SIZE };
        this.player.x = localStart.x; this.player.y = localStart.y; this.player.target = null; this.player.targetQueue = []; this.player.inventory = null; this.player.equipment = createEquipment(); this.player.ammunition = 0; this.player.hp = this.player.maxHp || 10; this.player.facingX = 1; this.player.facingY = 0;
        this.assistant.x = localStart.x - 30; this.assistant.y = localStart.y + 24; this.assistant.facingX = 1; this.assistant.facingY = 0;
      this.camera.x = localStart.x - (this.W / (this.camera.zoom || 1)) / 2;
      this.camera.y = localStart.y - (this.H / (this.camera.zoom || 1)) / 2;
      this.clampCamera();

      const p1 = { ...MULTIPLAYER_STARTS.p1, label: 'Player' };
      const p2 = { ...MULTIPLAYER_STARTS.p2, label: 'Enemy AI' };
      this.multiplayer = { enabled: true, sessionId, role, playerId, mapMode: 'local_ai', status: `Local vs AI ${sessionId}`, players: { p1, p2 }, winner: null, syncTimer: 0, aiWave: { enabled: true, enemyOwnerId: 'p2', targetOwnerId: 'p1', elapsed: 0, spawnTimer: MONSTER_WAVE_CONFIG.spawnEverySeconds, waveIndex: 0, lastWaveSize: 0 } };

      const throne1 = this.addStructure('throne', p1.throneX, p1.throneY);
      Object.assign(throne1, { name: 'bottom-left throne', ownerId: 'p1', ownerLabel: 'Player', hp: THRONE_HP, maxHp: THRONE_HP });
      const throne2 = this.addStructure('throne', p2.throneX, p2.throneY);
      Object.assign(throne2, { name: 'top-right throne', ownerId: 'p2', ownerLabel: 'Enemy AI', hp: THRONE_HP, maxHp: THRONE_HP });
      this.buildMultiplayerLane();
      const homeSide = 1;
      this.idleDepot = { x: throne1.x + homeSide * 86, y: throne1.y + 10, label: 'own throne' };

      [[720,1880],[920,2050],[1180,1740],[2440,520],[2680,380],[2940,690],[1720,1040],[1940,1260]].forEach(([x,y]) => this.spawnTree(x, y));
      [[820,1760],[1050,1940],[2380,620],[2820,760],[1840,1120]].forEach(([x,y]) => this.spawnHemp(x, y));
      [[940,1660],[1240,1900],[2280,720],[2800,560],[1780,1260]].forEach(([x,y]) => this.spawnStoneDeposit(x, y));
      this.addStructure('sawbench', localStart.x + 120, localStart.y - 120);
      this.addStructure('workbench', localStart.x + 230, localStart.y - 120);
      this.createBot(this.idleDepot.x - homeSide * 22, this.idleDepot.y - 24, 'idle', true);
      this.createBot(this.idleDepot.x + homeSide * 18, this.idleDepot.y + 18, 'idle', true);
      this.spawnStarterDog(localStart.x + 28, localStart.y + 34);
      this.spawnItem('crude_axe', localStart.x + 95, localStart.y + 80, 2);
      this.spawnItem('stick', localStart.x + 130, localStart.y + 86, 4);
      this.spawnItem('stone', localStart.x + 160, localStart.y + 75, 2);
      this.syncBuildUi(); this.syncZonesUi?.(); this.updateHover();
      return this.getMultiplayerSnapshot();
    },

    startMultiplayerSession({ sessionId = `grove-${Date.now().toString(36)}`, role = 'host', playerId = 'p1', players = null } = {}) {
      const localStart = MULTIPLAYER_STARTS[playerId] || MULTIPLAYER_STARTS.p1;
      this.resetWorldCollections();
      this.gameMode = 'online_lakes';
      this.map = { ...WORLD_MAP_SIZE };
      this.mapFeatures = clone(ONLINE_MULTIPLAYER_FEATURES);
        this.player.x = localStart.x; this.player.y = localStart.y; this.player.target = null; this.player.targetQueue = []; this.player.inventory = null; this.player.equipment = createEquipment(); this.player.ammunition = 0; this.player.hp = this.player.maxHp || 10; this.player.facingX = 1; this.player.facingY = 0;
        this.assistant.x = localStart.x - 30; this.assistant.y = localStart.y + 24; this.assistant.facingX = 1; this.assistant.facingY = 0;
      this.camera.x = localStart.x - (this.W / (this.camera.zoom || 1)) / 2;
      this.camera.y = localStart.y - (this.H / (this.camera.zoom || 1)) / 2;
      this.clampCamera();

      const p1 = { ...MULTIPLAYER_STARTS.p1, label: 'Player 1', ...(players?.p1 || {}) };
      const p2 = { ...MULTIPLAYER_STARTS.p2, label: 'Player 2', ...(players?.p2 || {}) };
      this.multiplayer = { enabled: true, sessionId, role, playerId, mapMode: 'online_lakes', status: `${role === 'host' ? 'Hosting' : 'Joined'} online lake camp ${sessionId}`, players: { p1, p2 }, winner: null, syncTimer: 0, aiWave: { enabled: false }, mapFeatures: clone(this.mapFeatures) };

      const camper = this.mapFeatures.find(feature => feature.type === 'camper_van' && feature.ownerId === playerId) || localStart;
      const homeSide = playerId === 'p2' ? -1 : 1;
      this.idleDepot = { x: camper.x + homeSide * 86, y: camper.y + 12, label: 'camper van' };

      [[720,1880],[940,2020],[1180,1740],[2460,520],[2700,390],[2940,690],[1720,1040],[1940,1260]].forEach(([x,y]) => this.spawnTree(x, y));
      [[820,1760],[1050,1940],[2380,620],[2820,760],[1840,1120]].forEach(([x,y]) => this.spawnHemp(x, y));
      [[940,1660],[1240,1900],[2280,720],[2800,560],[1780,1260]].forEach(([x,y]) => this.spawnStoneDeposit(x, y));
      this.addStructure('sawbench', localStart.x + (playerId === 'p1' ? 120 : -120), localStart.y - (playerId === 'p1' ? 120 : -80));
      this.addStructure('workbench', localStart.x + (playerId === 'p1' ? 230 : -230), localStart.y - (playerId === 'p1' ? 120 : -80));
      this.createBot(this.idleDepot.x - homeSide * 22, this.idleDepot.y - 24, 'idle', true);
      this.createBot(this.idleDepot.x + homeSide * 18, this.idleDepot.y + 18, 'idle', true);
      this.spawnStarterDog(localStart.x + 28, localStart.y + 34);
      this.spawnItem('crude_axe', localStart.x + 95, localStart.y + 80, 2);
      this.spawnItem('stick', localStart.x + 130, localStart.y + 86, 4);
      this.spawnItem('stone', localStart.x + 160, localStart.y + 75, 2);
      this.syncBuildUi(); this.syncZonesUi?.(); this.updateHover();
      return this.getMultiplayerSnapshot();
    },
    isEnemyThrone(s) { return !!(this.multiplayer?.enabled && s?.type === 'throne' && s.ownerId && s.ownerId !== this.multiplayer.playerId && (s.hp || 0) > 0); },
    damageThrone(s, damage = THRONE_ATTACK_DAMAGE) {
      if (!s || s.type !== 'throne' || (s.hp || 0) <= 0) return false;
      s.hp = Math.max(0, (s.hp || s.maxHp || THRONE_HP) - damage);
      this.addFloat(`${s.name} -${damage} HP`, s.x, s.y - 55, s.ownerId === 'p1' ? '#80a9c9' : '#c86b5f');
      this.emitSound('hit', { cooldownKey: `throne:${s.id}`, minGapMs: 150 });
      if (s.hp <= 0) {
        this.multiplayer.winner = s.ownerId === 'p1' ? 'p2' : 'p1';
        this.multiplayer.status = `${this.multiplayer.winner === this.multiplayer.playerId ? 'Victory' : 'Defeat'}: ${s.name} destroyed`;
        this.addFloat(this.multiplayer.status, this.player.x, this.player.y - 45, '#fff4d0');
        this.emitSound('victory', { cooldownKey: 'throne-victory', minGapMs: 1000 });
      }
      if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
      return true;
    },
    getLocalPlayerNetState() {
      return { sessionId: this.multiplayer?.sessionId, playerId: this.multiplayer?.playerId, x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, maxHp: this.player.maxHp, inventory: this.player.inventory, equipment: this.equipmentSummary(this.player), thrones: this.structures.filter(s => s.type === 'throne').map(s => ({ id: s.id, ownerId: s.ownerId, hp: s.hp, maxHp: s.maxHp })), winner: this.multiplayer?.winner || null };
    },
    applyRemoteMultiplayerState(state = {}) {
      if (!this.multiplayer?.enabled || !state.playerId || state.playerId === this.multiplayer.playerId) return false;
      const current = this.multiplayer.players[state.playerId] || { id: state.playerId, label: state.playerId };
      this.multiplayer.players[state.playerId] = { ...current, x: Number(state.x ?? current.x), y: Number(state.y ?? current.y), hp: Number(state.hp ?? current.hp ?? 10), maxHp: Number(state.maxHp ?? current.maxHp ?? 10), inventory: state.inventory || null, equipment: state.equipment || current.equipment || null, disconnected: false, lastSeenAt: Date.now() };
      for (const remoteThrone of state.thrones || []) {
        const local = this.structures.find(s => s.type === 'throne' && s.ownerId === remoteThrone.ownerId);
        if (local) local.hp = remoteThrone.hp;
      }
      if (state.winner) this.multiplayer.winner = state.winner;
      return true;
    },
    updateMultiplayer(dt) {
      if (!this.multiplayer?.enabled) return;
      const local = this.multiplayer.players[this.multiplayer.playerId] || MULTIPLAYER_STARTS[this.multiplayer.playerId] || MULTIPLAYER_STARTS.p1;
      this.multiplayer.players[this.multiplayer.playerId] = { ...local, x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, maxHp: this.player.maxHp, inventory: this.player.inventory || null, equipment: this.equipmentSummary(this.player) };
      this.multiplayer.syncTimer = (this.multiplayer.syncTimer || 0) + dt;
      if (this.multiplayer.syncTimer >= 0.12) {
        this.multiplayer.syncTimer = 0;
        if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
      }
    },
    getMultiplayerSnapshot() {
      return { ...(this.multiplayer || {}), players: { ...(this.multiplayer?.players || {}) }, mapFeatures: clone(this.mapFeatures || this.multiplayer?.mapFeatures || []), thrones: this.structures.filter(s => s.type === 'throne').map(s => ({ id: s.id, ref: s.ref, name: s.name, ownerId: s.ownerId, ownerLabel: s.ownerLabel, hp: s.hp, maxHp: s.maxHp, x: Math.round(s.x), y: Math.round(s.y) })), towers: this.structures.filter(s => s.type === 'defensetower' && s.ownerId).map(s => ({ id: s.id, ref: s.ref, name: s.name, ownerId: s.ownerId, ownerLabel: s.ownerLabel, hp: s.hp, maxHp: s.maxHp, x: Math.round(s.x), y: Math.round(s.y), range: s.rangedAttack?.range, damage: s.rangedAttack?.damage })) };
    },
    addMultiplayerTower(ownerId, point) {
      const tower = this.addStructure('defensetower', point.x, point.y);
      Object.assign(tower, { name: point.name, ownerId, ownerLabel: ownerId === 'p1' ? 'Player 1' : 'Enemy AI', hp: 20, maxHp: 20 });
      return tower;
    },
    buildMultiplayerLane() {
      for (const point of MULTIPLAYER_LANE_TOWERS.p1) this.addMultiplayerTower('p1', point);
      for (const point of MULTIPLAYER_LANE_TOWERS.p2) this.addMultiplayerTower('p2', point);
    },
    spawnEnemyWave(ownerId = 'p2', targetOwnerId = 'p1') {
      const ai = this.multiplayer?.aiWave;
      const source = this.structures.find(s => s.type === 'throne' && s.ownerId === ownerId);
      const target = this.structures.find(s => s.type === 'throne' && s.ownerId === targetOwnerId);
      if (!source || !target) return [];
      const waveIndex = (ai.waveIndex || 0) + 1;
      const size = Math.min(MONSTER_WAVE_CONFIG.maxWaveSize, 1 + Math.floor((ai.elapsed || 0) / MONSTER_WAVE_CONFIG.extraMonsterEverySeconds));
      ai.waveIndex = waveIndex; ai.lastWaveSize = size;
      const spawned = [];
      for (let i = 0; i < size; i++) {
        const offset = (i - (size - 1) / 2) * 28;
        spawned.push(this.spawnMonster(source.x - 58 - offset, source.y + 72 + offset, { name: `AI creep ${waveIndex}.${i + 1}`, type: 'lane_creep', kind: 'lane_creep', ownerId, ownerLabel: 'Enemy AI', hostile: true, passive: false, speed: 50, hp: 10, maxHp: 10, roamRadius: 9999, avoidRadius: 0, aggroRange: 155, laneTargetRef: target.ref, autoAttack: MONSTER_MELEE_ATTACK }));
      }
      this.addFloat(`Enemy wave ${waveIndex}: ${size}`, source.x, source.y + 86, '#c86b5f');
      return spawned;
    },
    updateAiWaves(dt) {
      const ai = this.multiplayer?.aiWave;
      if (!this.multiplayer?.enabled || !ai?.enabled || this.multiplayer.winner) return;
      ai.elapsed = (ai.elapsed || 0) + dt;
      ai.spawnTimer = (ai.spawnTimer ?? MONSTER_WAVE_CONFIG.spawnEverySeconds) - dt;
      while (ai.spawnTimer <= 0) {
        this.spawnEnemyWave(ai.enemyOwnerId || 'p2', ai.targetOwnerId || 'p1');
        ai.spawnTimer += MONSTER_WAVE_CONFIG.spawnEverySeconds;
      }
    },
    exportMultiplayerSave() { return { schema: 'orchestrator-grove-multiplayer-session-v1', exportedAt: new Date().toISOString(), session: this.getMultiplayerSnapshot(), state: this.getState() }; }
  });
}
