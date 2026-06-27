import { distXY, nearest, rectDistance } from '../../utils.js?v=20260613-player-tools';

export function installInventorySystem(Game, deps) {
  const {
    BOT_STORAGE_RETRY_SECONDS,
    EQUIPMENT_SHIELDS,
    EQUIPMENT_WEAPONS,
    MAX_WEAPON_SETS,
    STORAGE_STRUCTURE_TYPES,
    clone,
    createCarriedTool,
    ensureEquipment,
    itemLabel,
    productionInputCount,
    productionInputNeeds,
    syncActiveEquipmentSet
  } = deps;

  Object.assign(Game.prototype, {
    isEquipmentItem(type) { return EQUIPMENT_WEAPONS.includes(type) || EQUIPMENT_SHIELDS.includes(type) || type === 'arrow_pack'; },
    isToolItem(type) { return ['crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer'].includes(type); },
    actorAlreadyHasPickupType(actor, type) {
      const eq = ensureEquipment(actor || {});
      if (type === 'arrow_pack') return (actor?.ammunition || 0) >= 10;
      return actor?.inventory?.type === type || eq.weaponSets.some(set => set.weapon === type || set.shield === type);
    },
    pickupBlockedByHeldTool(actor) {
      if (!actor) return null;
      if (actor.inventory) return actor.inventory.type;
      return null;
    },
    carriedTool(actor) {
      return this.isToolItem(actor?.inventory?.type) ? actor.inventory : null;
    },
    carryToolItem(actor, type) {
      if (!actor || !this.isToolItem(type) || actor.inventory) return false;
      actor.inventory = createCarriedTool(type);
      return true;
    },
    equipmentSummary(actor = this.player) {
      const eq = ensureEquipment(actor);
      return { weapon: eq.weapon, shield: eq.shield, activeWeaponSetId: eq.activeWeaponSetId, weaponSets: clone(eq.weaponSets), ammunition: Number(actor?.ammunition || 0) };
    },
    dropEquipmentItem(actor, type, dx = 0, dy = 18) {
      if (!actor || !type) return;
      this.spawnItem(type, actor.x + dx, actor.y + dy, 1);
    },
    activeWeaponSet(actor) {
      return syncActiveEquipmentSet(ensureEquipment(actor));
    },
    createWeaponSet(eq, kind) {
      const id = `${kind}_${eq.nextWeaponSetId++}`;
      const set = { id, weapon: kind === 'bow' ? 'bow' : null, shield: null };
      eq.weaponSets.push(set);
      return set;
    },
    findMeleeWeaponSet(eq) {
      return eq.weaponSets.find(set => set.weapon !== 'bow') || null;
    },
    canEquipActor(actor, type) {
      if (!actor || !this.isEquipmentItem(type)) return false;
      const eq = ensureEquipment(actor);
      if (type === 'arrow_pack') return (actor.ammunition || 0) < 10;
      if (type === 'bow') return !eq.weaponSets.find(set => set.weapon === 'bow') && eq.weaponSets.length < MAX_WEAPON_SETS;
      const melee = this.findMeleeWeaponSet(eq);
      if (!melee) return eq.weaponSets.length < MAX_WEAPON_SETS;
      if (type === 'wooden_sword') return !melee.weapon;
      if (type === 'wooden_shield') return !melee.shield;
      return false;
    },
    equipActor(actor, type) {
      if (!actor || !this.isEquipmentItem(type)) return false;
      if (type === 'arrow_pack') {
        const currentAmmo = Number(actor.ammunition || 0);
        if (currentAmmo >= 10) return false;
        actor.ammunition = Math.min(10, currentAmmo + 10);
        return true;
      }
      const eq = ensureEquipment(actor);
      let set = null;
      if (type === 'bow') {
        if (eq.weaponSets.find(s => s.weapon === 'bow')) return false;
        if (eq.weaponSets.length >= MAX_WEAPON_SETS) return false;
        set = this.createWeaponSet(eq, 'bow');
      } else if (type === 'wooden_sword') {
        set = this.findMeleeWeaponSet(eq);
        if (!set) {
          if (eq.weaponSets.length >= MAX_WEAPON_SETS) return false;
          set = this.createWeaponSet(eq, 'melee');
        }
        if (set.weapon) return false;
        set.weapon = type;
      } else if (type === 'wooden_shield') {
        set = this.findMeleeWeaponSet(eq);
        if (!set) {
          if (eq.weaponSets.length >= MAX_WEAPON_SETS) return false;
          set = this.createWeaponSet(eq, 'melee');
        }
        if (set.shield) return false;
        set.shield = type;
      }
      eq.activeWeaponSetId = set?.id || eq.activeWeaponSetId;
      syncActiveEquipmentSet(eq);
      return true;
    },
    carryEquipmentItem(actor, type) {
      if (!actor || !this.isEquipmentItem(type) || actor.inventory) return false;
      actor.inventory = { type, count: 1 };
      return true;
    },
    dropActiveEquipmentItem(actor) {
      const eq = ensureEquipment(actor);
      const set = syncActiveEquipmentSet(eq);
      if (!set) return null;
      const dropType = set.shield || set.weapon;
      if (!dropType) return null;
      this.dropEquipmentItem(actor, dropType, dropType === 'wooden_shield' ? -10 : 10, 18);
      if (set.shield) set.shield = null;
      else set.weapon = null;
      syncActiveEquipmentSet(eq);
      return dropType;
    },
    switchWeaponSet(actor = this.player) {
      const eq = ensureEquipment(actor);
      syncActiveEquipmentSet(eq);
      if (eq.weaponSets.length < 2) {
        this.addFloat('No secondary weapon', actor.x, actor.y - 34, '#c7b683');
        return false;
      }
      const index = Math.max(0, eq.weaponSets.findIndex(set => set.id === eq.activeWeaponSetId));
      const next = eq.weaponSets[(index + 1) % eq.weaponSets.length];
      eq.activeWeaponSetId = next.id;
      syncActiveEquipmentSet(eq);
      this.addFloat(`Switched to ${next.weapon === 'bow' ? 'bow' : [next.weapon, next.shield].filter(Boolean).map(itemLabel).join(' + ')}`, actor.x, actor.y - 34, '#d3a95f');
      this.emitSound('switch', { cooldownKey: 'weapon:switch', minGapMs: 120 });
      return true;
    },
    equipActorFromGround(actor, item, reservedBy = null) {
      if (!actor || !item || !this.isEquipmentItem(item.type)) return false;
      if (reservedBy && item.reservedBy && item.reservedBy !== reservedBy) {
        this.addFloat(`${itemLabel(item.type)} is reserved`, actor.x, actor.y - 30, '#c86b5f');
        return false;
      }
      if (distXY(item.x, item.y, actor.x, actor.y) >= 44) return false;
      if (!this.equipActor(actor, item.type)) return false;
      this.items = this.items.filter(i => i.id !== item.id);
      this.addFloat(`Equipped ${itemLabel(item.type)}`, actor.x, actor.y - 30, '#d3a95f');
      return true;
    },
    playerMeleeDamage() {
      return ensureEquipment(this.player).weapon === 'wooden_sword' ? 2 : 1;
    },
    takeFromPalette(bot, type, dt, sourceId = null) {
      const palette = sourceId
        ? this.structures.find(s => STORAGE_STRUCTURE_TYPES.includes(s.type) && (s.id === sourceId || s.ref === sourceId || s.name === sourceId))
        : nearest(this.structures, bot.x, bot.y, s => STORAGE_STRUCTURE_TYPES.includes(s.type) && s.storageType === type && s.stored > 0);
      if (!palette) { bot.message = `No storage with ${itemLabel(type)}.`; return false; }
      if (palette.storageType !== type || palette.stored <= 0) { bot.message = `${palette.name} has no ${itemLabel(type)}.`; return false; }
      if (this.isToolItem(type) && bot.inventory) { bot.message = `Already carrying ${itemLabel(bot.inventory.type)}.`; return false; }
      if (!this.moveBotTo(bot, palette, dt, 34)) { bot.message = `Picking up ${itemLabel(type)} from ${palette.name}.`; return false; }
      palette.stored--;
      if (palette.stored <= 0) { palette.stored = 0; palette.storageType = null; }
      bot.inventory = this.isToolItem(type) ? createCarriedTool(type) : { type, count: 1 };
      bot.message = `Picked up ${itemLabel(type)} from ${palette.name}.`;
      return true;
    },
    findItemFor(bot, type) {
      const zone = this.getBotZone(bot);
      return nearest(this.items, bot.x, bot.y, item => item.type === type && (!item.reservedBy || item.reservedBy === bot.id) && this.objectInZone(item, zone, bot));
    },
    findItemNearStructureFor(bot, type, structure, radius = 150) {
      const zone = this.getBotZone(bot);
      return nearest(this.items, bot.x, bot.y, item => item.type === type && (!item.reservedBy || item.reservedBy === bot.id) && rectDistance(item.x, item.y, structure) <= radius && this.objectInZone(item, zone, bot));
    },
    pickItem(bot, item) {
      if (!bot || !item) return false;
      if (this.isToolItem(item.type)) {
        if (bot.inventory) { bot.message = `Already carrying ${itemLabel(bot.inventory.type)}.`; return false; }
        if (!this.carryToolItem(bot, item.type)) { bot.message = `Cannot pick up ${itemLabel(item.type)}.`; return false; }
        this.emitSound('pickup', { cooldownKey: `bot:pickup:${bot.id}`, minGapMs: 120 });
        bot.message = `Picked up ${itemLabel(item.type)}.`;
      } else if (this.isEquipmentItem(item.type)) {
        if (this.equipActor(bot, item.type)) bot.message = item.type === 'arrow_pack' ? `Loaded ${itemLabel(item.type)}.` : `Equipped ${itemLabel(item.type)}.`;
        else if (item.type === 'arrow_pack') { bot.message = 'Ammo already full.'; return false; }
        else if (this.carryEquipmentItem(bot, item.type)) bot.message = `Carrying ${itemLabel(item.type)}.`;
        else { bot.message = `Cannot pick up ${itemLabel(item.type)} while carrying ${itemLabel(bot.inventory?.type || 'item')}.`; return false; }
        this.emitSound('equip', { cooldownKey: `bot:equip:${bot.id}`, minGapMs: 120 });
      } else {
        if (bot.inventory) { bot.message = `Already carrying ${itemLabel(bot.inventory.type)}.`; return false; }
        bot.inventory = { type: item.type, count: 1 };
        this.emitSound('pickup', { cooldownKey: `bot:pickup:${bot.id}`, minGapMs: 120 });
      }
      this.items = this.items.filter(i => i.id !== item.id);
      bot.targetItemId = null;
      bot.targetItemPurpose = null;
      bot.target = null;
      if (bot.kind === 'dog') this.emitSound('dog_bark', { cooldownKey: `dog_bark:${bot.id}`, minGapMs: 400 });
      return true;
    },
    canStructureAcceptItemWhenIdle(s, type) {
      if (!s || !type) return false;
      if (s.type === 'player_storage') return this.canPlayerAcceptItem(type);
      if (STORAGE_STRUCTURE_TYPES.includes(s.type)) return (s.stored || 0) < (s.capacity || 0) && (!s.storageType || s.storageType === type);
      const needs = productionInputNeeds(s);
      if (!needs || !Object.prototype.hasOwnProperty.call(needs, type)) return false;
      return productionInputCount(s, type) < needs[type];
    },
    canStructureAcceptItem(s, type) {
      if (!s || !type || this.isStructureProcessing(s)) return false;
      return this.canStructureAcceptItemWhenIdle(s, type);
    },
    canPlayerAcceptItem(type) {
      return !!type && !this.player.inventory;
    },
    depositBotItemToPlayer(bot, type) {
      if (!bot?.inventory || bot.inventory.type !== type) return false;
      if (!this.canPlayerAcceptItem(type)) {
        if (this.botStorageRetryReady(bot, `player-deposit:${type}`, `Player storage is full for ${itemLabel(type)}.`, this.player.x, this.player.y)) {
          this.addFloat('Player storage full', this.player.x, this.player.y - 35, '#c86b5f');
          this.emitSound('ui_error', { cooldownKey: `bot:player-full:${bot.id}`, minGapMs: BOT_STORAGE_RETRY_SECONDS * 1000 });
        }
        return false;
      }
      this.player.inventory = { type, count: bot.inventory.count || 1 };
      bot.inventory = null;
      this.addFloat(`Player received ${itemLabel(type)}`, this.player.x, this.player.y - 35, '#d3a95f');
      this.emitSound('deposit', { cooldownKey: `bot:player-deposit:${bot.id}`, minGapMs: 120 });
      return true;
    },
    depositHeldItemToStructure(s, type, { worker = null } = {}) {
      if (!s || !type) return false;
      if (s.type === 'player_storage') return this.depositBotItemToPlayer(this.workerBot(worker), type);
      if (this.isStructureProcessing(s)) return false;
      if (!this.canStructureAcceptItemWhenIdle(s, type)) {
        const bot = this.workerBot(worker);
        if (bot && !this.botStorageRetryReady(bot, `deposit:${s.id}:${type}`, `${s.name} cannot take ${itemLabel(type)}.`, s.x, s.y)) return false;
        this.addFloat(`${s.name} cannot take ${itemLabel(type)}`, s.x, s.y - 35, '#c86b5f');
        this.emitSound('ui_error', { cooldownKey: bot ? `deposit-error:${bot.id}:${s.id}:${type}` : 'deposit-error', minGapMs: bot ? BOT_STORAGE_RETRY_SECONDS * 1000 : 120 });
        return false;
      }
      this.emitSound(STORAGE_STRUCTURE_TYPES.includes(s.type) ? 'storage' : 'deposit', { cooldownKey: `deposit:${s.id}`, minGapMs: 100 });
      if (STORAGE_STRUCTURE_TYPES.includes(s.type)) {
        s.storageType ||= type;
        s.stored = (s.stored || 0) + 1;
        this.addFloat(`${s.name}: ${s.stored}/${s.capacity} ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
        return true;
      }
      if (s.type === 'sawbench') {
        if (type === 'log') s.logs++;
        if (type === 'plank') s.planks++;
        this.addFloat(`+ ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
        this.maybeStartStructureProcessing(s, worker);
        return true;
      }
      if (s.type === 'workbench') {
        if (type === 'stick') s.sticks++;
        if (type === 'stone') s.stones++;
        this.addFloat(`${s.name}: ${s.sticks} sticks, ${s.stones} stones`, s.x, s.y - 35, '#d3a95f');
        this.maybeStartStructureProcessing(s, worker);
        return true;
      }
      if (s.type === 'smithery') {
        if (type === 'stick') s.sticks++;
        if (type === 'plank') s.planks++;
        this.addFloat(`+ ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
        this.maybeStartStructureProcessing(s, worker);
        return true;
      }
      if (s.type === 'arrowmaker') {
        if (type === 'stick') s.sticks++;
        if (type === 'stone') s.stones++;
        this.addFloat(`${s.name}: ${s.sticks} sticks, ${s.stones} stones`, s.x, s.y - 35, '#d3a95f');
        this.maybeStartStructureProcessing(s, worker);
        return true;
      }
      if (s.type === 'bowmaker' || s.type === 'factory' || s.type === 'assembler') {
        const key = `${type}s` in s ? `${type}s` : type;
        s[key]++;
        if (s.type === 'bowmaker') this.addFloat(`${s.name}: ${s.sticks || 0}/2 sticks, ${s.hemps || 0}/3 hemp`, s.x, s.y - 35, '#d3a95f');
        if (s.type === 'factory') this.addFloat(`+ ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
        if (s.type === 'assembler') this.addFloat(`${s.name}: ${s.planks || 0}/2 planks, ${s.poles || 0}/1 pole`, s.x, s.y - 35, '#d3a95f');
        this.maybeStartStructureProcessing(s, worker);
        return true;
      }
      return false;
    },
    depositToSawbench(s, type, options = {}) {
      return this.depositHeldItemToStructure(s, type, options);
    },
    takeLooseItemNearStructure(bot, type, dt, structure, radius = 150) {
      let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === type && rectDistance(i.x, i.y, structure) <= radius && this.objectInZone(i, this.getBotZone(bot), bot)) : null;
      if (!item) {
        item = this.findItemNearStructureFor(bot, type, structure, radius);
        if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'production_radius'; }
      }
      if (!item) { bot.message = `Waiting for loose ${itemLabel(type)}s around ${structure.name}.`; return false; }
      if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Picking up loose ${itemLabel(type)} near ${structure.name}.`; return false; }
      return this.pickItem(bot, item);
    },
    takeLooseItem(bot, type, dt) {
      let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === type && this.objectInZone(i, this.getBotZone(bot), bot)) : null;
      if (!item) {
        item = this.findItemFor(bot, type);
        if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'haul'; }
      }
      if (!item) { bot.message = `Waiting for ${itemLabel(type)}s in ${this.zoneLabel(this.getBotZone(bot))}.`; return false; }
      if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Picking up ${itemLabel(type)}.`; return false; }
      return this.pickItem(bot, item);
    },
    manualPickupItem(item) {
      if (!item) return false;
      if (item.reservedBy && item.reservedBy !== 'player') { this.addFloat(`${itemLabel(item.type)} is reserved`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      if (this.player.inventory && !this.isEquipmentItem(item.type)) { this.addFloat(`Carrying ${itemLabel(this.player.inventory.type)}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      if (this.isEquipmentItem(item.type)) {
        const equipped = this.equipActorFromGround(this.player, item, 'player');
        if (equipped) { this.recordTeachStep({ op: 'pick_up', type: item.type }); this.syncTeachUi(); }
        if (equipped) this.emitSound('equip', { cooldownKey: 'player:equip', minGapMs: 120 });
        if (equipped) return true;
        if (item.type === 'arrow_pack') { this.addFloat('Ammo already full', this.player.x, this.player.y - 30, '#c86b5f'); return false; }
        if (distXY(item.x, item.y, this.player.x, this.player.y) >= 44) return false;
        if (!this.carryEquipmentItem(this.player, item.type)) { this.addFloat(`Carrying ${itemLabel(this.player.inventory?.type || 'item')}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
        this.items = this.items.filter(i => i.id !== item.id);
        this.addFloat(`Carrying ${itemLabel(item.type)}`, this.player.x, this.player.y - 30, '#d3a95f');
        this.emitSound('pickup', { cooldownKey: 'player:pickup', minGapMs: 120 });
        this.recordTeachStep({ op: 'pick_up', type: item.type });
        this.syncTeachUi();
        return true;
      }
      if (distXY(item.x, item.y, this.player.x, this.player.y) >= 44) return false;
      this.player.inventory = { type: item.type, count: 1 };
      this.items = this.items.filter(i => i.id !== item.id);
      this.addFloat(`Picked up ${itemLabel(item.type)}`, this.player.x, this.player.y - 30, '#d3a95f');
      this.emitSound('pickup', { cooldownKey: 'player:pickup', minGapMs: 120 });
      this.recordTeachStep({ op: 'pick_up', type: item.type });
      this.syncTeachUi();
      return true;
    },
    manualPickupNearest(type = null) {
      const item = nearest(this.items, this.player.x, this.player.y, i => (!type || i.type === type) && (!i.reservedBy || i.reservedBy === 'player') && distXY(i.x, i.y, this.player.x, this.player.y) < 44);
      return this.manualPickupItem(item);
    },
    takeStoredItemFromStructure(bot, s, type, dt) {
      if (!s || !STORAGE_STRUCTURE_TYPES.includes(s.type) || s.storageType !== type || (s.stored || 0) <= 0 || (this.isToolItem(type) && bot.inventory)) return false;
      if (this.isEquipmentItem(type) && !this.canEquipActor(bot, type) && bot.inventory) return false;
      if (type === 'arrow_pack' && (bot.ammunition || 0) >= 10) { bot.message = 'Ammo already full.'; return false; }
      if (!this.moveBotTo(bot, s, dt, 32)) { bot.message = `Taught loop: pick up ${itemLabel(type)} from ${s.name}.`; return false; }
      s.stored--;
      if (s.stored <= 0) s.storageType = null;
      if (this.isEquipmentItem(type)) {
        if (!this.equipActor(bot, type)) {
          if (type === 'arrow_pack') { bot.message = 'Ammo already full.'; return false; }
          this.carryEquipmentItem(bot, type);
        }
      } else {
        bot.inventory = this.isToolItem(type) ? createCarriedTool(type) : { type, count: 1 };
      }
      bot.message = `Taught loop took ${itemLabel(type)} from ${s.name}.`;
      return true;
    },
    manualTakeFromPalette(s) {
      if (!s || !STORAGE_STRUCTURE_TYPES.includes(s.type)) return false;
      const type = s.storageType;
      if (this.player.inventory && !this.isEquipmentItem(type)) { this.addFloat(`Carrying ${itemLabel(this.player.inventory.type)}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      if (!type || (s.stored || 0) <= 0) { this.addFloat(`${s.name} is empty`, s.x, s.y - 35, '#c86b5f'); return false; }
      if (rectDistance(this.player.x, this.player.y, s) >= 45) return false;
      if (this.isEquipmentItem(type) && !this.canEquipActor(this.player, type) && this.player.inventory) { this.addFloat(`Carrying ${itemLabel(this.player.inventory.type)}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      if (type === 'arrow_pack' && (this.player.ammunition || 0) >= 10) { this.addFloat('Ammo already full', this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      s.stored--;
      if (s.stored <= 0) s.storageType = null;
      if (this.isEquipmentItem(type)) {
        if (!this.equipActor(this.player, type)) {
          if (type === 'arrow_pack') { this.addFloat('Ammo already full', this.player.x, this.player.y - 30, '#c86b5f'); return false; }
          this.carryEquipmentItem(this.player, type);
        }
      } else {
        this.player.inventory = { type, count: 1 };
      }
      this.addFloat(`${this.isEquipmentItem(type) && !this.player.inventory ? 'Equipped' : 'Took'} ${itemLabel(type)} from ${s.name}`, this.player.x, this.player.y - 30, '#d3a95f');
      this.emitSound(this.isEquipmentItem(type) && !this.player.inventory ? 'equip' : 'storage', { cooldownKey: 'player:storage', minGapMs: 120 });
      this.recordTeachStep({ op: 'pick_up_from_storage', type, structureId: s.id, structureRef: s.ref, structureType: s.type, structureName: s.name, target: s.name });
      this.syncTeachUi();
      return true;
    },
    manualDropItem() {
      const held = this.player.inventory;
      if (!held) {
        const droppedType = this.dropActiveEquipmentItem(this.player);
        if (!droppedType) { this.addFloat('Hands empty', this.player.x, this.player.y - 30, '#c86b5f'); return false; }
        this.addFloat(`Dropped ${itemLabel(droppedType)}`, this.player.x, this.player.y - 30, '#d3a95f');
        this.emitSound('drop', { cooldownKey: 'player:drop', minGapMs: 120 });
        this.recordTeachStep(this.dropItemStep(this.player.x, this.player.y + 18));
        this.syncTeachUi();
        return true;
      }
      const dropX = this.player.x;
      const dropY = this.player.y + 18;
      this.spawnItem(held.type, dropX, dropY, held.count || 1);
      this.player.inventory = null;
      this.addFloat(`Dropped ${itemLabel(held.type)}`, this.player.x, this.player.y - 30, '#d3a95f');
      this.emitSound('drop', { cooldownKey: 'player:drop', minGapMs: 120 });
      this.recordTeachStep(this.dropItemStep(dropX, dropY));
      this.syncTeachUi();
      return true;
    },
    manualDepositToStructure(s = null, { waitIfProcessing = false } = {}) {
      if (!this.player.inventory) return false;
      const target = s || this.structures.find(st => rectDistance(this.player.x, this.player.y, st) < 45 && [...STORAGE_STRUCTURE_TYPES, 'sawbench', 'workbench', 'factory', 'smithery', 'bowmaker', 'arrowmaker', 'assembler'].includes(st.type));
      if (!target) { this.addFloat(`No production building nearby for ${itemLabel(this.player.inventory.type)}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      const type = this.player.inventory.type;
      if (this.isStructureProcessing(target)) {
        if (!waitIfProcessing) this.addFloat(`${target.name} is processing`, target.x, target.y - 35, '#c7b683');
        return false;
      }
      if (!this.depositHeldItemToStructure(target, type, { worker: { kind: 'player' } })) return false;
      this.player.inventory = null;
      this.addFloat(`Deposited ${itemLabel(type)} into ${target.name}`, target.x, target.y - 35, '#d3a95f');
      this.emitSound('deposit', { cooldownKey: 'player:deposit', minGapMs: 120 });
      this.recordTeachStep({ op: 'deposit_to_structure', type, structureId: target.id, structureRef: target.ref, structureType: target.type, structureName: target.name, target: target.name });
      this.syncTeachUi();
      return true;
    }
  });
}
