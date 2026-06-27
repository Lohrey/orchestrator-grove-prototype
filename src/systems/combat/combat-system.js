import { clamp, distXY, nearest, rectDistance } from '../../utils.js?v=20260613-player-tools';
import {
  BOW_ATTACK,
  DEFENSE_TOWER_ATTACK,
  IDLE_BOT_AUTO_ATTACK_RANGE,
  MELEE_ATTACK_RANGE,
  MELEE_AUTO_ATTACK,
  MONSTER_MELEE_ATTACK
} from './combat-config.js?v=t_combat_system_0627';

function ensureAutoAttackState(actor, defaults = {}) {
  if (!actor) return null;
  if (!actor.autoAttack) actor.autoAttack = { cooldownRemaining: 0, targetRef: null };
  if (!Number.isFinite(actor.autoAttack.cooldownRemaining)) actor.autoAttack.cooldownRemaining = 0;
  if (!Object.prototype.hasOwnProperty.call(actor.autoAttack, 'targetRef')) actor.autoAttack.targetRef = null;
  for (const [key, value] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(actor.autoAttack, key)) actor.autoAttack[key] = value;
  }
  return actor.autoAttack;
}

function equipmentFor(game, actor) {
  if (!actor?.ref?.startsWith('monster:')) game.activeWeaponSet(actor);
  return actor?.equipment || null;
}

export function installCombatSystem(Game) {
  Object.assign(Game.prototype, {
    createArrowProjectile(source, target) {
      const id = this.nextProjectileId++;
      const attack = source?.rangedAttack || source?.equipment?.rangedAttack || DEFENSE_TOWER_ATTACK;
      return {
        id,
        ref: `projectile:${id}`,
        type: 'arrow',
        x: source.x,
        y: source.y,
        vx: 1,
        vy: 0,
        sourceStructureId: source.id,
        sourceRef: source.ref || source.ownerRef || 'player',
        targetRef: target.ref,
        targetKind: target.kind || target.type || 'monster',
        targetId: target.id,
        speed: attack.projectileSpeed || DEFENSE_TOWER_ATTACK.projectileSpeed,
        damage: attack.damage || 1,
        ttl: 2.4
      };
    },
    findProjectileTarget(projectile) {
      if (!projectile?.targetRef) return null;
      return this.findTargetByRef(projectile.targetRef);
    },
    hostileTargetsForStructure(structure) {
      const attack = structure?.rangedAttack || DEFENSE_TOWER_ATTACK;
      const owner = structure?.ownerId || null;
      if (!owner) return this.monsters.filter(m => (m.hp || 0) > 0 && m.ownerId && m.ownerId !== 'neutral' && rectDistance(m.x, m.y, structure) <= (attack.range || DEFENSE_TOWER_ATTACK.range));
      return this.monsters.filter(m => (m.hp || 0) > 0 && (!m.ownerId || m.ownerId !== owner) && rectDistance(m.x, m.y, structure) <= (attack.range || DEFENSE_TOWER_ATTACK.range));
    },
    nearestRangedTarget(structure) {
      return nearest(this.hostileTargetsForStructure(structure), structure.x, structure.y);
    },
    actorOwnerId(actor) {
      if (!actor) return null;
      if (actor === this.player || actor.ref === 'player:local') return this.multiplayer?.playerId || 'p1';
      if (actor.ref?.startsWith('bot:')) return actor.ownerId || this.multiplayer?.playerId || 'p1';
      return actor.ownerId || null;
    },
    targetDistance(actor, target) {
      return target?.ref?.startsWith('structure:') ? rectDistance(actor.x, actor.y, target) : distXY(actor.x, actor.y, target.x, target.y);
    },
    hostileTargetsForActor(actor, range = Infinity) {
      const owner = this.actorOwnerId(actor);
      const targets = [];
      if (actor?.ref?.startsWith('monster:')) {
        if (this.multiplayer?.enabled && (!owner || owner !== this.multiplayer.playerId)) {
          Object.assign(this.player, { ref: 'player:local', id: this.multiplayer.playerId || 'p1' });
          targets.push(this.player);
        }
        targets.push(...this.bots.filter(bot => (bot.hp ?? 1) > 0 && (!owner || this.actorOwnerId(bot) !== owner)));
        targets.push(...this.structures.filter(s => (s.hp ?? 1) > 0 && s.ownerId && (!owner || s.ownerId !== owner) && ['throne', 'defensetower'].includes(s.type)));
      } else {
        targets.push(...this.monsters.filter(m => (m.hp || 0) > 0 && m.hostile !== false && (!owner || !m.ownerId || m.ownerId !== owner)));
        if (this.multiplayer?.enabled) targets.push(...this.structures.filter(s => (s.hp ?? 1) > 0 && s.ownerId && (!owner || s.ownerId !== owner) && ['throne', 'defensetower'].includes(s.type)));
      }
      return targets.filter(target => this.targetDistance(actor, target) <= range);
    },
    nearestAutoAttackTarget(actor, range) {
      return nearest(this.hostileTargetsForActor(actor, range), actor.x, actor.y);
    },
    actorMeleeDamage(actor) {
      equipmentFor(this, actor);
      return actor?.equipment?.weapon === 'wooden_sword' ? 2 : 1;
    },
    fireActorBow(actor, target, attack) {
      if (!actor || !target || !attack) return false;
      if ((actor.ammunition || 0) <= 0) {
        actor.message = 'Out of arrows.';
        if (actor.x != null && actor.y != null) this.addFloat('Out of arrows', actor.x, actor.y - 34, '#c86b5f');
        return false;
      }
      this.projectiles.push(this.createArrowProjectile({ ...actor, ref: actor.ref || 'player:local', ownerRef: actor.ref || 'player:local', rangedAttack: attack }, target));
      actor.ammunition = Math.max(0, (actor.ammunition || 0) - 1);
      attack.cooldownRemaining = attack.cooldown || BOW_ATTACK.cooldown;
      attack.targetRef = target.ref;
      this.addFloat('Auto shot!', actor.x, actor.y - 34, '#d3a95f');
      return true;
    },
    updateActorAutoAttack(actor, dt, { searchRange = null } = {}) {
      if (!actor || (actor.hp ?? 1) <= 0) return false;
      const isMonster = actor.ref?.startsWith('monster:');
      const eq = isMonster ? null : equipmentFor(this, actor);
      const weapon = isMonster ? 'melee' : eq?.weapon;
      if (!isMonster && !weapon) return false;
      const ranged = weapon === 'bow';
      if (!isMonster && actor.manualAttackLock > 0) {
        actor.manualAttackLock = Math.max(0, actor.manualAttackLock - dt);
        return false;
      }
      const attack = isMonster
        ? ensureAutoAttackState(actor, MONSTER_MELEE_ATTACK)
        : (ranged ? eq.rangedAttack : ensureAutoAttackState(actor));
      if (!ranged) {
        const stats = isMonster ? MONSTER_MELEE_ATTACK : { ...MELEE_AUTO_ATTACK, damage: this.actorMeleeDamage(actor) };
        attack.range = stats.range;
        attack.damage = stats.damage;
        attack.cooldown = stats.cooldown;
      }
      attack.cooldownRemaining = Math.max(0, (attack.cooldownRemaining || 0) - dt);
      const acquisitionRange = Number.isFinite(searchRange) ? Math.max(0, searchRange) : (attack.range || MELEE_AUTO_ATTACK.range);
      const attackRange = attack.range || (ranged ? BOW_ATTACK.range : MELEE_AUTO_ATTACK.range);
      let target = this.findTargetByRef(attack.targetRef);
      if (!target || !this.hostileTargetsForActor(actor, acquisitionRange).includes(target)) target = this.nearestAutoAttackTarget(actor, acquisitionRange);
      if (!target) {
        attack.targetRef = null;
        return false;
      }
      attack.targetRef = target.ref;
      if (this.targetDistance(actor, target) > attackRange) {
        if (!Number.isFinite(searchRange) || acquisitionRange <= attackRange) {
          attack.targetRef = null;
          return false;
        }
        this.moveToward(actor, target.x, target.y, dt, actor.speed || 0, Math.max(18, attackRange * 0.8));
        return true;
      }
      if (attack.cooldownRemaining > 0) return true;
      if (ranged) return this.fireActorBow(actor, target, attack);
      this.damageAttackTarget(target, attack.damage || 1);
      attack.cooldownRemaining = attack.cooldown || MELEE_AUTO_ATTACK.cooldown;
      this.emitSound('hit', { cooldownKey: `auto:${actor.ref || actor.id}`, minGapMs: 160 });
      return true;
    },
    isHostileTarget(target) {
      if (!target || (target.hp ?? 1) <= 0) return false;
      if (target.ref?.startsWith('monster:')) return target.hostile !== false;
      if (target.ref?.startsWith('bot:')) return !!target.hostile;
      if (target.ref?.startsWith('player:')) return this.multiplayer?.enabled && target.id !== this.multiplayer.playerId;
      if (target.ref?.startsWith('structure:')) return !!target.hostile || this.isEnemyThrone(target);
      return !!target.hostile;
    },
    remotePlayerAt(x, y) {
      return nearest(
        Object.values(this.multiplayer?.players || {}),
        x,
        y,
        p => p && p.id !== this.multiplayer?.playerId && !p.disconnected && distXY(x, y, p.x, p.y) <= 24
      ) || null;
    },
    attackTargetAt(x, y) {
      const monster = this.monsterAt(x, y);
      if (monster && this.isHostileTarget(monster)) return monster;
      const bot = this.botAt(x, y);
      if (bot && this.isHostileTarget(bot)) return bot;
      const remote = this.remotePlayerAt(x, y);
      if (remote) return { ...remote, ref: `player:${remote.id}`, radius: 15, hostile: true };
      const structure = this.structureAt(x, y);
      if (structure && this.isHostileTarget(structure)) return structure;
      return null;
    },
    queuePlayerAttackTarget(target, { append = false } = {}) {
      if (!this.isHostileTarget(target)) return false;
      equipmentFor(this, this.player);
      if (this.player.equipment?.weapon === 'bow') return this.firePlayerBow(target);
      const dx = this.player.x - target.x;
      const dy = this.player.y - target.y;
      const len = Math.hypot(dx, dy) || 1;
      const reach = (target.radius || target.r || 16) + MELEE_ATTACK_RANGE;
      this.setPlayerDestination(
        target.x + dx / len * reach,
        target.y + dy / len * reach,
        { action: 'attack_target', targetRef: target.ref, floatText: `Attack ${target.name || target.ref || 'target'}` },
        { append }
      );
      return true;
    },
    firePlayerBow(target) {
      if (!this.isHostileTarget(target)) return false;
      equipmentFor(this, this.player);
      const attack = this.player.equipment.rangedAttack;
      if ((this.player.ammunition || 0) <= 0) {
        this.addFloat('Out of arrows', this.player.x, this.player.y - 34, '#c86b5f');
        return false;
      }
      if (attack.cooldownRemaining > 0) {
        this.addFloat('Bow reloading', this.player.x, this.player.y - 34, '#c7b683');
        return true;
      }
      if (distXY(this.player.x, this.player.y, target.x, target.y) > (attack.range || BOW_ATTACK.range)) {
        this.addFloat('Target out of bow range', target.x, target.y - 34, '#c86b5f');
        return true;
      }
      this.projectiles.push(this.createArrowProjectile({ ...this.player, ref: 'player:local', ownerRef: 'player:local', rangedAttack: attack }, target));
      this.player.ammunition = Math.max(0, (this.player.ammunition || 0) - 1);
      attack.cooldownRemaining = attack.cooldown || BOW_ATTACK.cooldown;
      this.player.manualAttackLock = Math.max(this.player.manualAttackLock || 0, attack.cooldownRemaining);
      attack.targetRef = target.ref;
      this.addFloat('Bow shot!', this.player.x, this.player.y - 36, '#d3a95f');
      return true;
    },
    playerAttackTargetByRef(ref) {
      const target = this.findTargetByRef(ref);
      if (!this.isHostileTarget(target)) return false;
      if (distXY(this.player.x, this.player.y, target.x, target.y) > (target.radius || target.r || 16) + MELEE_ATTACK_RANGE + 8) return false;
      return this.damageAttackTarget(target, this.playerMeleeDamage());
    },
    damageAttackTarget(target, damage = 1) {
      if (!target || (target.hp ?? 1) <= 0) return false;
      if (target.type === 'throne') return this.damageThrone(target, damage);
      target.hp = Math.max(0, (target.hp ?? target.maxHp ?? 1) - damage);
      this.addFloat(`${target.name || target.ref || 'target'} -${damage} HP`, target.x, target.y - 34, target.hp <= 0 ? '#c86b5f' : '#d3a95f');
      if (target.hp <= 0) this.addFloat(`${target.name || target.ref || 'target'} defeated`, target.x, target.y - 50, '#9abf8f');
      if (target.ref?.startsWith('player:')) this.emitSound('player_hurt', { cooldownKey: 'player_hurt', minGapMs: 150 });
      if (target.ref?.startsWith('bot:') && target.hp <= 0) this.emitSound('bot_defeat', { cooldownKey: `bot_defeat:${target.id}`, minGapMs: 200 });
      if (target.ref?.startsWith('player:') && typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
      return true;
    },
    fireRangedAttack(structure, target) {
      if (!structure?.rangedAttack || !target) return false;
      this.projectiles.push(this.createArrowProjectile(structure, target));
      structure.rangedAttack.cooldownRemaining = structure.rangedAttack.cooldown || DEFENSE_TOWER_ATTACK.cooldown;
      structure.rangedAttack.targetRef = target.ref;
      this.addFloat('Arrow!', structure.x, structure.y - 56, '#d3a95f');
      this.emitSound('arrow', { cooldownKey: `arrow:${structure.id}`, minGapMs: 180 });
      return true;
    },
    updateRangedAttackStructures(dt) {
      for (const structure of this.structures) {
        const attack = structure.rangedAttack;
        if (!attack) continue;
        attack.cooldownRemaining = Math.max(0, (attack.cooldownRemaining || 0) - dt);
        if (attack.cooldownRemaining > 0) continue;
        const target = this.nearestRangedTarget(structure);
        if (target) this.fireRangedAttack(structure, target);
        else attack.targetRef = null;
      }
    },
    updateProjectiles(dt) {
      const active = [];
      for (const projectile of this.projectiles) {
        projectile.ttl = (projectile.ttl ?? 2.4) - dt;
        const target = this.findProjectileTarget(projectile);
        if (!target || projectile.ttl <= 0) continue;
        const dx = target.x - projectile.x;
        const dy = target.y - projectile.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        projectile.vx = dx / distance;
        projectile.vy = dy / distance;
        const step = (projectile.speed || DEFENSE_TOWER_ATTACK.projectileSpeed) * dt;
        if (distance <= step + (target.radius || target.r || 16)) {
          this.damageAttackTarget(target, projectile.damage || 1);
          continue;
        }
        projectile.x = clamp(projectile.x + projectile.vx * step, 0, this.map.width);
        projectile.y = clamp(projectile.y + projectile.vy * step, 0, this.map.height);
        active.push(projectile);
      }
      this.projectiles = active;
    },
    attackTargetMatchesType(target, type = 'monster') {
      const normalizedType = this.normalizeAttackType(type);
      if (!target) return false;
      if (normalizedType === 'monster') return target.ref?.startsWith('monster:');
      if (normalizedType === 'structure') return target.ref?.startsWith('structure:');
      if (normalizedType === 'bot') return target.ref?.startsWith('bot:');
      const values = [target.type, target.kind, target.name, target.ref].map(value => String(value || '').toLowerCase().replace(/[\s-]+/g, '_'));
      return values.some(value => value === normalizedType || value.includes(normalizedType));
    },
    attackZoneForStep(step) {
      return step.zoneSpec || (step.zoneId ? this.zones.find(zone => zone.id === step.zoneId) : null);
    },
    attackTargetsForStep(bot, step) {
      const zone = this.attackZoneForStep(step);
      const type = this.normalizeAttackType(step.type || step.monsterType || 'monster');
      const targetRaw = step.targetRef || step.target || step.targetName || null;
      if (targetRaw) {
        const explicit = this.resolveActorReference(targetRaw, bot) || this.findTargetByRef(targetRaw);
        if (explicit && this.isHostileTarget(explicit) && this.objectInZone(explicit, zone, bot) && this.attackTargetMatchesType(explicit, type)) return [explicit];
      }
      return this.hostileTargetsForActor(bot, Infinity).filter(target => this.objectInZone(target, zone, bot) && this.attackTargetMatchesType(target, type));
    },
    nearestAttackTargetForStep(bot, step) {
      return nearest(this.attackTargetsForStep(bot, step), bot.x, bot.y);
    },
    updateLaneMonster(monster, dt) {
      const attack = ensureAutoAttackState(monster, MONSTER_MELEE_ATTACK);
      const engaged = this.updateActorAutoAttack(monster, dt);
      const current = this.findTargetByRef(attack.targetRef);
      if (engaged && current && this.targetDistance(monster, current) <= (attack.range || MONSTER_MELEE_ATTACK.range) + 2) return;
      const chase = this.nearestAutoAttackTarget(monster, monster.aggroRange || 140) || this.findTargetByRef(monster.laneTargetRef);
      if (!chase) return;
      this.moveToward(monster, chase.x, chase.y, dt, monster.speed || 50, (chase.radius || chase.r || 18) + (attack.range || MONSTER_MELEE_ATTACK.range) - 8);
    },
    updateMonster(monster, dt) {
      if (!monster || (monster.hp || 0) <= 0) return;
      if (monster.laneTargetRef) return this.updateLaneMonster(monster, dt);
      const nearestStructure = this.nearestStructureToMonster(monster);
      const structureDistance = this.monsterStructureDistance(monster, nearestStructure);
      if (nearestStructure && structureDistance < monster.avoidRadius) {
        monster.wanderTarget = this.monsterTargetAwayFromStructure(monster, nearestStructure);
      } else if (!monster.wanderTarget || distXY(monster.x, monster.y, monster.wanderTarget.x, monster.wanderTarget.y) < 10) {
        monster.wanderTarget = this.pickMonsterWanderTarget(monster);
      } else if (distXY(monster.x, monster.y, monster.homeX, monster.homeY) > monster.roamRadius * 1.35) {
        monster.wanderTarget = { x: monster.homeX, y: monster.homeY };
      }
      const target = monster.wanderTarget;
      if (!target) return;
      const dx = target.x - monster.x;
      const dy = target.y - monster.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) return;
      const step = Math.min(len, monster.speed * dt);
      monster.x = clamp(monster.x + dx / len * step, 30, this.map.width - 30);
      monster.y = clamp(monster.y + dy / len * step, 30, this.map.height - 30);
    },
    executeAttackTarget(bot, target, dt, label = 'area') {
      if (!bot || !this.isHostileTarget(target)) return false;
      equipmentFor(this, bot);
      const eq = bot.equipment;
      const ranged = eq.weapon === 'bow';
      const attack = ranged ? eq.rangedAttack : ensureAutoAttackState(bot);
      if (!ranged) {
        attack.range = MELEE_ATTACK_RANGE + (target.radius || target.r || 16);
        attack.damage = this.actorMeleeDamage(bot);
        attack.cooldown = MELEE_AUTO_ATTACK.cooldown;
      }
      attack.cooldownRemaining = Math.max(0, (attack.cooldownRemaining || 0) - dt);
      const range = ranged ? (attack.range || BOW_ATTACK.range) : (attack.range || MELEE_AUTO_ATTACK.range);
      if (this.targetDistance(bot, target) > range) {
        this.moveToward(bot, target.x, target.y, dt, bot.speed, Math.max(18, range * 0.8));
        bot.message = `Closing to attack ${target.name || target.ref || 'target'} in ${label}.`;
        return false;
      }
      attack.targetRef = target.ref;
      if (attack.cooldownRemaining > 0) {
        bot.message = `Attacking ${target.name || target.ref || 'target'}...`;
        return true;
      }
      if (ranged) this.fireActorBow(bot, target, attack);
      else {
        this.damageAttackTarget(target, attack.damage || 1);
        attack.cooldownRemaining = attack.cooldown || MELEE_AUTO_ATTACK.cooldown;
        this.emitSound('hit', { cooldownKey: `bot:attack:${bot.id}`, minGapMs: 160 });
      }
      bot.message = `Attacked ${target.name || target.ref || 'target'}.`;
      return (target.hp ?? 1) <= 0;
    },
    executeAttackStep(bot, step, dt) {
      const zone = this.attackZoneForStep(step);
      const target = this.nearestAttackTargetForStep(bot, step);
      if (!target) {
        const patrol = this.zoneCenter(zone, bot);
        if (zone && patrol && distXY(bot.x, bot.y, patrol.x, patrol.y) > 24 && zone.kind !== 'nearby') {
          this.moveToward(bot, patrol.x, patrol.y, dt, bot.speed, 20);
          bot.message = `Moving to attack zone ${this.zoneLabel(zone)}.`;
          return false;
        }
        bot.message = `No ${step.type || 'hostile target'} in ${this.zoneLabel(zone)}.`;
        return false;
      }
      return this.executeAttackTarget(bot, target, dt, this.zoneLabel(zone));
    },
    guardCenterForStep(bot, step) {
      if (!bot.runtime) bot.runtime = { pc: 0, memory: {}, wait: 0 };
      if (!bot.runtime.memory) bot.runtime.memory = {};
      const zone = this.attackZoneForStep(step);
      const zoneCenter = zone && zone.kind !== 'nearby' ? this.zoneCenter(zone, bot) : null;
      if (zoneCenter) return zoneCenter;
      const key = `guard:${step.zoneLabel || step.radius || 'current'}`;
      if (!bot.runtime.memory[key]) bot.runtime.memory[key] = { x: bot.x, y: bot.y };
      return bot.runtime.memory[key];
    },
    guardZoneForStep(bot, step) {
      const zone = this.attackZoneForStep(step);
      const radius = clamp(Number(step.radius || zone?.radius || 150), 40, 1200);
      if (zone && zone.kind !== 'nearby') return zone;
      const center = this.guardCenterForStep(bot, step);
      return { kind: 'radius', x: center.x, y: center.y, radius, name: step.zoneLabel || `${Math.round(radius)}px guard area` };
    },
    nearestGuardTargetForStep(bot, step) {
      const zone = this.guardZoneForStep(bot, step);
      const type = this.normalizeAttackType(step.type || 'monster');
      return nearest(this.hostileTargetsForActor(bot, Infinity), bot.x, bot.y, target => this.objectInZone(target, zone, null) && this.attackTargetMatchesType(target, type));
    },
    executeGuardAreaStep(bot, step, dt) {
      const zone = this.guardZoneForStep(bot, step);
      const target = this.nearestGuardTargetForStep(bot, step);
      if (target) return this.executeAttackTarget(bot, target, dt, this.zoneLabel(zone));
      const center = this.guardCenterForStep(bot, step);
      if (center && distXY(bot.x, bot.y, center.x, center.y) > 22) {
        this.moveToward(bot, center.x, center.y, dt, bot.speed, 14);
        bot.message = `Returning to guard center in ${this.zoneLabel(zone)}.`;
        return false;
      }
      bot.message = `Guarding ${this.zoneLabel(zone)}.`;
      return false;
    },
    executePatrolRouteStep(bot, step, dt) {
      if (!bot.runtime) bot.runtime = { pc: 0, memory: {}, wait: 0 };
      if (!bot.runtime.memory) bot.runtime.memory = {};
      const points = Array.isArray(step.points) ? step.points : [];
      if (points.length < 2) {
        bot.message = 'Patrol route needs at least two points.';
        return false;
      }
      const radius = clamp(Number(step.radius || 150), 40, 1200);
      const currentIndex = clamp(Number(bot.runtime.memory.patrolIndex || 0), 0, points.length - 1);
      const checkpoint = points[currentIndex] || points[0];
      const target = nearest(
        this.hostileTargetsForActor(bot, Infinity),
        bot.x,
        bot.y,
        candidate => this.attackTargetMatchesType(candidate, step.type || 'monster') && (distXY(bot.x, bot.y, candidate.x, candidate.y) <= radius || distXY(checkpoint.x, checkpoint.y, candidate.x, candidate.y) <= radius)
      );
      if (target) return this.executeAttackTarget(bot, target, dt, `patrol radius ${Math.round(radius)}`);
      if (this.moveToward(bot, checkpoint.x, checkpoint.y, dt, bot.speed, 18)) {
        bot.runtime.memory.patrolIndex = (currentIndex + 1) % points.length;
        bot.message = `Reached ${checkpoint.name || `checkpoint ${currentIndex + 1}`}; patrolling.`;
      } else {
        bot.message = `Patrolling to ${checkpoint.name || `checkpoint ${currentIndex + 1}`}.`;
      }
      return false;
    }
  });
}

export { IDLE_BOT_AUTO_ATTACK_RANGE };
