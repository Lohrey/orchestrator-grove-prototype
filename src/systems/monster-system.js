// src/systems/monster-system.js
// Monster spawning, damage, night spawns, and monster behavior helpers.
// Part of the Game class composition root — installed via installMonsterSystem(Game, deps).

import { clamp, distXY, nearest, rand, rectDistance } from '../utils.js?v=grove_pixi_fixes_0628';

/** Center point of an axis-aligned rect (structure), matching world.js's local helper. */
const rectCenter = z => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });

export function installMonsterSystem(Game, deps) {
  const {
    NIGHT_MONSTER_CONFIG,
    MONSTER_AVOID_STRUCTURE_RADIUS,
    MONSTER_ROAM_RADIUS
  } = deps;

  Object.assign(Game.prototype, {
    playerOwnedStructures() {
      const playerId = this.multiplayer?.playerId || 'p1';
      return this.structures.filter(s => (s.hp ?? 1) > 0 && (!s.ownerId || s.ownerId === playerId || s.ownerId === 'neutral'));
    },
    nightMonsterDistanceToBuildings(point) {
      const buildings = this.playerOwnedStructures();
      if (!buildings.length) return Infinity;
      return Math.min(...buildings.map(s => rectDistance(point.x, point.y, s)));
    },
    findNightMonsterSpawnPoint() {
      const structures = this.playerOwnedStructures();
      const origin = structures.length ? rectCenter(structures[0]) : this.player;
      let best = null;
      for (let i = 0; i < 80; i++) {
        const angle = rand(0, Math.PI * 2);
        const distance = rand(NIGHT_MONSTER_CONFIG.minDistanceFromPlayer, Math.max(NIGHT_MONSTER_CONFIG.minDistanceFromPlayer + 80, NIGHT_MONSTER_CONFIG.minDistanceFromStructures * 2.2));
        const point = { x: clamp(origin.x + Math.cos(angle) * distance, 40, this.map.width - 40), y: clamp(origin.y + Math.sin(angle) * distance, 40, this.map.height - 40) };
        const buildingDistance = this.nightMonsterDistanceToBuildings(point);
        const playerDistance = distXY(point.x, point.y, this.player.x, this.player.y);
        const score = Math.min(buildingDistance, playerDistance);
        if (!best || score > best.score) best = { ...point, score };
        if (buildingDistance >= NIGHT_MONSTER_CONFIG.minDistanceFromStructures && playerDistance >= NIGHT_MONSTER_CONFIG.minDistanceFromPlayer) return point;
      }
      return best || { x: clamp(this.player.x + 900, 40, this.map.width - 40), y: clamp(this.player.y + 650, 40, this.map.height - 40) };
    },
    spawnNightMonster() {
      const point = this.findNightMonsterSpawnPoint();
      // TODO(sprites): Night enemies should use a goblin spritesheet for rendering.
      // The sprite wiring subagent is handling this in pixi-entities.js (createMonsterView/updateMonsterView)
      // and sprite-cache.js. When wired, set monster.spriteKey = 'goblin' and pass it through
      // the renderer. Currently these monsters render as procedural vectors.
      const monster = this.spawnMonster(point.x, point.y, {
        kind: 'night_monster', type: 'night_monster', name: 'night monster', passive: false, hostile: true, ownerId: 'wild', ownerLabel: 'Night', hp: 12, maxHp: 12,
        speed: rand(42, 58), roamRadius: NIGHT_MONSTER_CONFIG.roamRadius, avoidRadius: NIGHT_MONSTER_CONFIG.avoidRadius, aggroRange: 130
      });
      monster.spawnedAtNight = true;
      monster.homeX = point.x; monster.homeY = point.y;
      this.emitSound('monster_spawn', { cooldownKey: 'night_spawn', minGapMs: 200 });
      return monster;
    },
    updateNightMonsterSpawns(dt) {
      const night = this.isNightTime();
      const state = this.nightSpawns ||= { active: false, timer: 1.5, spawnedThisNight: 0 };
      if (!night) {
        if (state.active) this.emitSound('dawn', { cooldownKey: 'dawn', minGapMs: 9999 });
        state.active = false; state.timer = 1.5; state.spawnedThisNight = 0; return;
      }
      if (!state.active) { state.active = true; state.timer = Math.min(state.timer ?? 1.5, 1.5); state.spawnedThisNight = 0; this.emitSound('night_fall', { cooldownKey: 'night_fall', minGapMs: 9999 }); }
      state.timer = (state.timer ?? NIGHT_MONSTER_CONFIG.spawnEverySeconds) - dt;
      if (state.timer > 0) return;
      const activeNightMonsters = this.monsters.filter(m => (m.hp || 0) > 0 && m.type === 'night_monster').length;
      if (activeNightMonsters < NIGHT_MONSTER_CONFIG.maxActive && state.spawnedThisNight < NIGHT_MONSTER_CONFIG.maxPerNight) {
        this.spawnNightMonster();
        state.spawnedThisNight++;
      }
      state.timer += NIGHT_MONSTER_CONFIG.spawnEverySeconds;
    },
    damageMonster(monster, damage = 1) {
      if (!monster || (monster.hp || 0) <= 0) return false;
      monster.hp = Math.max(0, (monster.hp || monster.maxHp || 1) - damage);
      this.addFloat(`${monster.name || 'enemy'} -${damage} HP`, monster.x, monster.y - 34, monster.hp <= 0 ? '#c86b5f' : '#d3a95f');
      if (monster.hp <= 0) this.addFloat(`${monster.name || 'enemy'} defeated`, monster.x, monster.y - 50, '#9abf8f');
      this.emitSound(monster.hp <= 0 ? 'victory' : 'hit', { cooldownKey: `hit:${monster.ref || monster.id}`, minGapMs: 130 });
      return true;
    },
    monsterStructureDistance(monster, structure) { return structure ? Math.max(0, rectDistance(monster.x, monster.y, structure) - (monster.radius || 18)) : Infinity; },
    nearestStructureToMonster(monster) { return nearest(this.structures, monster.x, monster.y, () => true); },
    monsterTargetAwayFromStructure(monster, structure) {
      const dx = monster.x - structure.x, dy = monster.y - structure.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: clamp(monster.x + dx / len * monster.avoidRadius, 30, this.map.width - 30), y: clamp(monster.y + dy / len * monster.avoidRadius, 30, this.map.height - 30) };
    },
    pickMonsterWanderTarget(monster) {
      for (let i = 0; i < 14; i++) {
        const angle = rand(0, Math.PI * 2);
        const distance = rand(45, monster.roamRadius);
        const target = { x: clamp(monster.homeX + Math.cos(angle) * distance, 30, this.map.width - 30), y: clamp(monster.homeY + Math.sin(angle) * distance, 30, this.map.height - 30) };
        const nearStructure = nearest(this.structures, target.x, target.y, () => true);
        if (!nearStructure || rectDistance(target.x, target.y, nearStructure) >= monster.avoidRadius) return target;
      }
      return { x: clamp(monster.homeX, 30, this.map.width - 30), y: clamp(monster.homeY, 30, this.map.height - 30) };
    },
  });
}
