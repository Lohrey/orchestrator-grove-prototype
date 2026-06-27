// src/systems/spawn-system.js
// Entity spawning: trees, items, hemp, monsters, stone deposits, holes, produced items, seeds.
// Part of the Game class composition root — installed via installSpawnSystem(Game, deps).

import { clamp, rand } from '../utils.js?v=20260613-player-tools';

export function installSpawnSystem(Game, deps) {
  const {
    HOLE_VISUAL_RADIUS,
    HOLE_BLOCK_RADIUS,
    TREE_GROWTH,
    BUILDING_TYPES,
    MONSTER_AVOID_STRUCTURE_RADIUS,
    MONSTER_ROAM_RADIUS,
    MONSTER_MELEE_ATTACK,
    createAutoAttackComponent
  } = deps;

  Object.assign(Game.prototype, {
    spawnTree(x, y, options = {}) {
      const stage = options.growthStage || 'grown_tree';
      const stats = TREE_GROWTH[stage] || TREE_GROWTH.grown_tree;
      const id = this.nextTreeId++;
      const tree = {
        id, ref: `tree:${id}`, x, y,
        hp: options.hp ?? stats.maxHp,
        maxHp: options.maxHp ?? stats.maxHp,
        stump: false, regrow: 0,
        radius: options.radius ?? (stage === 'grown_tree' ? rand(17, 24) : stats.radius),
        planted: !!options.planted,
        growthStage: stage,
        growTimer: options.growTimer ?? stats.growSeconds
      };
      this.trees.push(tree);
      return tree;
    },
    spawnItem(type, x, y, count = 1) { for (let i=0;i<count;i++) { const id = this.nextItemId++; this.items.push({ id, ref: `item:${id}`, type, x: x + rand(-13,13), y: y + rand(-10,10), reservedBy: null, bob: rand(0, Math.PI*2) }); } this.emitSound('drop', { cooldownKey: `spawn:${type}`, minGapMs: 160 }); },
    spawnHemp(x, y) { const id = this.nextHempId++; const plant = { id, ref: `hemp:${id}`, type: 'hemp_plant', x, y, radius: rand(12, 16), searched: false, harvested: false, searchReservedBy: null }; this.hempPlants.push(plant); return plant; },
    spawnMonster(x, y, options = {}) {
      const id = this.nextMonsterId++;
      const monster = {
        id, ref: `monster:${id}`, kind: options.kind || 'passive_monster', type: options.type || 'passive_monster', name: options.name || `passive monster ${id}`,
        x: clamp(x, 30, this.map.width - 30), y: clamp(y, 30, this.map.height - 30),
        homeX: options.homeX ?? x, homeY: options.homeY ?? y, radius: options.radius ?? rand(17, 21),
        hp: options.hp ?? 10, maxHp: options.maxHp ?? 10, passive: options.passive ?? true, hostile: options.hostile ?? true, ownerId: options.ownerId || 'neutral', ownerLabel: options.ownerLabel || null, speed: options.speed ?? rand(38, 52),
        roamRadius: options.roamRadius ?? MONSTER_ROAM_RADIUS, avoidRadius: options.avoidRadius ?? MONSTER_AVOID_STRUCTURE_RADIUS,
        laneTargetRef: options.laneTargetRef || null, aggroRange: options.aggroRange ?? 140, autoAttack: createAutoAttackComponent(options.autoAttack || MONSTER_MELEE_ATTACK),
        wanderTarget: null, phase: rand(0, Math.PI * 2)
      };
      this.monsters.push(monster);
      return monster;
    },
    spawnStoneDeposit(x, y) { const id = this.nextRockId++; const maxHp = 5; this.rocks.push({ id, ref: `rock:${id}`, type: 'stone_deposit', x, y, hp: maxHp, maxHp, radius: rand(14,20), respawn: 0 }); return this.rocks[this.rocks.length - 1]; },
    spawnHole(x, y) {
      const id = this.nextHoleId++;
      const hole = { id, ref: `hole:${id}`, kind: 'dug_hole', x: clamp(x, 12, this.map.width - 12), y: clamp(y, 12, this.map.height - 12), radius: HOLE_VISUAL_RADIUS, blockRadius: HOLE_BLOCK_RADIUS, planted: false, reservedBy: null, treeId: null };
      this.holes.push(hole);
      return hole;
    },
    dropProducedItem(structure, type, count = 1) {
      if (!structure) return;
      const w = structure.w || BUILDING_TYPES[structure.type]?.w || 80;
      const h = structure.h || BUILDING_TYPES[structure.type]?.h || 50;
      const x = clamp(structure.x + w / 2 + 24, 16, this.map.width - 16);
      const y = clamp(structure.y + h / 2 + 18, 16, this.map.height - 16);
      this.spawnItem(type, x, y, count);
    },
    plantSeedInHole(hole, actor = null) {
      if (!hole || hole.planted) return false;
      this.spawnTree(hole.x, hole.y, { planted: true, growthStage: 'sapling' });
      this.holes = this.holes.filter(h => h.id !== hole.id);
      this.addFloat('Planted tree seed', hole.x, hole.y - 18, '#9abf8f');
      this.emitSound('plant', { cooldownKey: 'plant', minGapMs: 120 });
      if (actor) actor.targetHoleId = null;
      return true;
    },
  });
}
