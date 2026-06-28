// src/systems/player-system.js
// Player target queue, movement, resource actions, deploy/demolish actions.
// Part of the Game class composition root — installed via installPlayerSystem(Game, deps).

import { clamp } from '../utils.js?v=20260613-player-tools';

export function installPlayerSystem(Game, deps) {
  const {
    itemLabel,
    STORAGE_STRUCTURE_TYPES,
    TREE_SEARCH_SECONDS,
    HEMP_SEARCH_SECONDS,
    HEMP_CHOP_SECONDS,
    RESOURCE_HIT_SECONDS,
    BUILDING_KIT_DEPLOY_SECONDS,
    BUILDING_DISASSEMBLE_SECONDS,
    isBuildingKitItemType,
    buildingTypeFromKitItem
  } = deps;

  Object.assign(Game.prototype, {
    normalizePlayerTarget(x, y, options = {}) {
      return { x: clamp(x, 20, this.map.width - 20), y: clamp(y, 20, this.map.height - 20), ...options };
    },
    announcePlayerTarget(target, floatText = 'Move target', color = '#80a9c9') {
      if (!target) return;
      this.addFloat(floatText, target.x, target.y - 18, color);
      this.emitSound(target.action || 'move', { cooldownKey: `player:${target.action || 'move'}`, minGapMs: 120 });
    },
    reservePlayerTarget(target) {
      if (target?.action === 'pickup_item' && target.itemId) {
        const item = this.items.find(i => i.id === target.itemId);
        if (item) item.reservedBy = 'player';
      } else if (target?.action === 'deploy_loose_building_kit' && target.itemId) {
        const item = this.items.find(i => i.id === target.itemId);
        if (item) item.reservedBy = 'player';
      } else if (target?.action === 'search_tree' && target.resourceId) {
        const tree = this.trees.find(t => t.id === target.resourceId);
        if (tree) tree.searchReservedBy = 'player';
      }
    },
    activatePlayerTarget(target, { floatText, color = '#80a9c9' } = {}) {
      this.player.target = target || null;
      if (!target) return null;
      const dx = target.x - this.player.x;
      const dy = target.y - this.player.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.001) { this.player.facingX = dx / len; this.player.facingY = dy / len; }
      this.reservePlayerTarget(target);
      this.announcePlayerTarget(target, floatText || target.floatText || 'Move target', color);
      return target;
    },
    advancePlayerTargetQueue() {
      this.player.target = null;
      if (!Array.isArray(this.player.targetQueue) || !this.player.targetQueue.length) return false;
      const next = this.player.targetQueue.shift();
      this.activatePlayerTarget(next, { floatText: next.floatText || 'Queued command', color: '#9abf8f' });
      return true;
    },
    clearPlayerTargetQueue() {
      this.releasePlayerTargetReservation();
      this.player.target = null;
      this.player.targetQueue = [];
    },
    setPlayerDestination(x, y, options = {}, { append = false } = {}) {
      const target = this.normalizePlayerTarget(x, y, options);
      if (append && this.player.target) {
        this.player.targetQueue ||= [];
        this.player.targetQueue.push(target);
        this.announcePlayerTarget(target, `Queued: ${options.floatText || 'Move target'}`, '#9abf8f');
        return target;
      }
      this.releasePlayerTargetReservation();
      if (!append) this.player.targetQueue = [];
      return this.activatePlayerTarget(target, { floatText: options.floatText });
    },
    releasePlayerTargetReservation() {
      const target = this.player?.target;
      if (target?.action === 'pickup_item' && target.itemId) {
        const item = this.items.find(i => i.id === target.itemId && i.reservedBy === 'player');
        if (item) item.reservedBy = null;
      }
      if (target?.action === 'deploy_loose_building_kit' && target.itemId) {
        const item = this.items.find(i => i.id === target.itemId && i.reservedBy === 'player');
        if (item) item.reservedBy = null;
      }
      if (target?.action === 'search_tree' && target.resourceId) {
        const tree = this.trees.find(t => t.id === target.resourceId && t.searchReservedBy === 'player');
        if (tree) tree.searchReservedBy = null;
      }
      if (target?.action === 'search_hemp' && target.resourceId) {
        const hemp = this.hempPlants.find(h => h.id === target.resourceId && h.searchReservedBy === 'player');
        if (hemp) hemp.searchReservedBy = null;
      }
    },
    queuePlayerItemPickup(item, { append = false } = {}) {
      if (!item) return false;
      if (this.player.inventory && !this.isEquipmentItem(item.type)) {
        this.addFloat(`No free space: carrying ${itemLabel(this.player.inventory.type)}`, item.x, item.y - 24, '#c86b5f');
        return false;
      }
      const verb = this.isEquipmentItem(item.type) ? 'Equip' : 'Pick up';
      this.setPlayerDestination(item.x, item.y, { action: 'pickup_item', itemId: item.id, floatText: `${verb} ${itemLabel(item.type)}` }, { append });
      return true;
    },
    completePlayerTarget(target) {
      if (target?.action === 'pickup_item' && target.itemId) {
        const item = this.items.find(i => i.id === target.itemId);
        const picked = this.manualPickupItem(item);
        if (!picked && item?.reservedBy === 'player') item.reservedBy = null;
        return;
      }
      if (target?.action === 'deploy_loose_building_kit' && target.itemId) {
        this.startPlayerBuildingKitAction(target);
        return;
      }
      if (target?.action === 'deploy_building_kit') {
        this.startPlayerBuildingKitAction(target);
        return;
      }
      if (target?.action === 'plant_seed' && target.holeId) {
        const hole = this.holes.find(h => h.id === target.holeId && !h.planted);
        if (hole) this.manualPlantSeedAtHole(hole);
        return;
      }
      if (target?.action === 'chop_tree' && target.resourceId) { const tree = this.trees.find(t => t.id === target.resourceId); if (tree) this.startPlayerResourceWork(target, tree, 'chopping tree'); return; }
      if (target?.action === 'mine_stone' && target.resourceId) { const rock = this.rocks.find(r => r.id === target.resourceId && !r.depleted); if (rock) this.startPlayerResourceWork(target, rock, 'mining stone'); return; }
      if (target?.action === 'attack_target') { this.playerAttackTargetByRef(target.targetRef); return; }
      if (target?.action === 'attack_throne' && target.structureId) { const throne = this.structures.find(st => st.id === target.structureId); this.damageThrone(throne, this.playerMeleeDamage()); return; }
      if (target?.action === 'demolish_structure' && target.structureId) { this.finishPlayerDemolishStructure(target); return; }
      if (target?.action === 'disassemble_building_to_kit' && target.structureId) { this.startPlayerBuildingKitAction(target); return; }
      if (target?.action === 'take_from_storage' && target.structureId) {
        const s = this.structures.find(st => st.id === target.structureId);
        this.manualTakeFromPalette(s);
        return;
      }
      if (target?.action === 'deposit_to_structure' && target.structureId) {
        const s = this.structures.find(st => st.id === target.structureId);
        const held = this.player.inventory?.type;
        if (!s || !held) return;
        const deposited = this.manualDepositToStructure(s, { waitIfProcessing: true });
        if (!deposited && this.player.inventory?.type === held && this.isStructureProcessing(s)) {
          if (!target.waiting) this.addFloat(`Waiting for ${s.name}`, s.x, s.y - 35, '#c7b683');
          this.player.target = { ...target, x: s.x, y: s.y, waiting: true };
        }
      }
    },
    queuePlayerStructureDeposit(s, { append = false } = {}) {
      const held = this.player.inventory?.type;
      if (!s || !held || !this.canStructureAcceptItemWhenIdle(s, held)) return false;
      this.setPlayerDestination(s.x, s.y, { action: 'deposit_to_structure', structureId: s.id, itemType: held, floatText: `Deposit ${itemLabel(held)} into ${s.name}` }, { append });
      return true;
    },
    queuePlayerPlantSeedAtHole(hole, { append = false } = {}) {
      if (!hole || hole.planted) return false;
      if (this.player.inventory?.type !== 'tree_seed') return false;
      this.setPlayerDestination(hole.x, hole.y, { action: 'plant_seed', holeId: hole.id, floatText: `Plant tree seed in ${hole.ref}` }, { append });
      return true;
    },
    queuePlayerPaletteInteraction(s, { append = false } = {}) {
      if (!s || !STORAGE_STRUCTURE_TYPES.includes(s.type)) return false;
      const held = this.player.inventory?.type;
      if (held) {
        if (!this.canStructureAcceptItem(s, held)) {
          const reason = (s.stored || 0) >= (s.capacity || 0) ? `${s.name} is full` : `${s.name} stores ${itemLabel(s.storageType || held)}`;
          this.addFloat(reason, s.x, s.y - 35, '#c86b5f');
          return true;
        }
        this.setPlayerDestination(s.x, s.y, { action: 'deposit_to_structure', structureId: s.id, itemType: held, floatText: `Store ${itemLabel(held)} in ${s.name}` }, { append });
        return true;
      }
      if (!s.storageType || (s.stored || 0) <= 0) {
        this.addFloat(`${s.name} is empty`, s.x, s.y - 35, '#c86b5f');
        return true;
      }
      this.setPlayerDestination(s.x, s.y, { action: 'take_from_storage', structureId: s.id, itemType: s.storageType, floatText: `Take ${itemLabel(s.storageType)} from ${s.name}` }, { append });
      return true;
    },
    startPlayerResourceWork(target, resource, processLabel) {
      this.player.target = { ...target, x: resource.x, y: resource.y, started: true, remaining: RESOURCE_HIT_SECONDS, total: RESOURCE_HIT_SECONDS, processLabel };
      this.addFloat(`${processLabel[0].toUpperCase()}${processLabel.slice(1)}…`, resource.x, resource.y - 34, '#d3a95f');
      return true;
    },
    startPlayerTimedAction(target, duration, processLabel) {
      this.player.target = { ...target, started: true, remaining: duration, total: duration, processLabel };
      this.addFloat(`${processLabel[0].toUpperCase()}${processLabel.slice(1)}…`, target.x, target.y - 34, '#d3a95f');
      return true;
    },
    startPlayerBuildingKitAction(target) {
      if (!target?.action) return false;
      if (target.action === 'deploy_loose_building_kit') {
        if (!this.canFinishPlayerDeployLooseKit(target)) return false;
        return this.startPlayerTimedAction(target, BUILDING_KIT_DEPLOY_SECONDS, 'deploying building kit');
      }
      if (target.action === 'deploy_building_kit') {
        if (!this.canFinishPlayerDeployHeldKit(target)) return false;
        return this.startPlayerTimedAction(target, BUILDING_KIT_DEPLOY_SECONDS, 'deploying building kit');
      }
      if (target.action === 'disassemble_building_to_kit') {
        if (!this.canFinishPlayerDisassembleStructure(target)) return false;
        return this.startPlayerTimedAction(target, BUILDING_DISASSEMBLE_SECONDS, 'disassembling building');
      }
      return false;
    },
    canFinishPlayerChopTree(target) {
      return !!this.trees.find(t => t.id === target.resourceId && this.isChoppableTree(t)) && this.player.inventory?.type === 'crude_axe';
    },
    canFinishPlayerMineStone(target) {
      return !!this.rocks.find(r => r.id === target.resourceId && !r.depleted) && this.player.inventory?.type === 'crude_pickaxe';
    },
    finishPlayerChopTree(target) {
      const tree = this.trees.find(t => t.id === target.resourceId && this.isChoppableTree(t));
      if (!tree || this.player.inventory?.type !== 'crude_axe') return false;
      tree.hp--;
      this.spawnItem('log', tree.x, tree.y, 1);
      this.addFloat('Chopped log', tree.x, tree.y - 34, '#d3a95f');
      this.emitSound('chop', { cooldownKey: 'player:chop', minGapMs: 160 });
      this.recordTeachStep(this.resourceRadiusStep('chop_tree', tree, this.treeDisplayName(tree)));
      this.syncTeachUi();
      if (tree.hp <= 0) { tree.stump = true; tree.regrow = 0; this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); }
      return true;
    },
    finishPlayerMineStone(target) {
      const rock = this.rocks.find(r => r.id === target.resourceId && !r.depleted);
      if (!rock || this.player.inventory?.type !== 'crude_pickaxe') return false;
      rock.hp--;
      this.spawnItem('stone', rock.x, rock.y, 1);
      this.addFloat('Mined stone', rock.x, rock.y - 24, '#d3a95f');
      this.emitSound('mine', { cooldownKey: 'player:mine', minGapMs: 160 });
      this.recordTeachStep(this.resourceRadiusStep('mine_stone', rock, 'stone deposit'));
      this.syncTeachUi();
      if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; this.addFloat('Stone deposit depleted', rock.x, rock.y - 24, '#9aa09d'); }
      return true;
    },
    queuePlayerTreeSearch(tree) {
      if (!tree || tree.stump || this.player.inventory) return false;
      if (!this.treeSearchAvailable(tree, 'player')) { this.addFloat('Tree already being searched', tree.x, tree.y - 34, '#c86b5f'); return true; }
      this.setPlayerDestination(tree.x, tree.y, { action: 'search_tree', resourceId: tree.id, floatText: 'Search tree for sticks/seeds' });
      return true;
    },
    queuePlayerHempAction(hemp, { append = false } = {}) {
      if (!hemp || hemp.harvested) return false;
      if (this.player.inventory?.type === 'crude_axe') {
        this.setPlayerDestination(hemp.x, hemp.y, { action: 'chop_hemp', resourceId: hemp.id, floatText: 'Chop hemp' }, { append });
        return true;
      }
      if (!this.player.inventory && this.hempSearchAvailable(hemp, 'player')) {
        this.setPlayerDestination(hemp.x, hemp.y, { action: 'search_hemp', resourceId: hemp.id, floatText: 'Search hemp for seed' }, { append });
        return true;
      }
      this.addFloat(this.player.inventory ? `Need empty hands or crude axe (holding ${itemLabel(this.player.inventory.type)})` : 'Hemp already being searched', hemp.x, hemp.y - 28, '#c86b5f');
      return true;
    },
    treeDisplayName(tree) {
      return tree?.stump ? 'tree stump' : tree?.growthStage === 'sapling' ? 'small sapling' : tree?.growthStage === 'small_tree' ? 'small tree' : 'grown tree';
    },
    dropTreeSearchFinds(tree) {
      this.spawnItem('stick', tree.x, tree.y, 1);
      this.spawnItem('tree_seed', tree.x, tree.y, 1);
    },
    finishHempSearch(hemp) {
      if (!hemp || hemp.harvested || this.player.inventory) return false;
      hemp.searchReservedBy = null;
      this.spawnItem('hemp_seed', hemp.x, hemp.y, 1);
      this.addFloat('Found hemp seed', hemp.x, hemp.y - 28, '#d3a95f');
      this.emitSound('search', { cooldownKey: 'player:search_hemp', minGapMs: 160 });
      this.recordTeachStep(this.resourceRadiusStep('search_hemp', hemp, 'hemp plant'));
      this.syncTeachUi();
      return true;
    },
    finishHempChop(hemp) {
      if (!hemp || hemp.harvested || this.player.inventory?.type !== 'crude_axe') return false;
      hemp.harvested = true;
      this.hempPlants = this.hempPlants.filter(h => h.id !== hemp.id);
      this.spawnItem('hemp', hemp.x, hemp.y, 1);
      this.spawnItem('hemp_seed', hemp.x, hemp.y, 1);
      this.addFloat('Harvested hemp + seed', hemp.x, hemp.y - 28, '#9abf8f');
      this.emitSound('harvest', { cooldownKey: 'player:harvest_hemp', minGapMs: 160 });
      this.recordTeachStep(this.resourceRadiusStep('chop_hemp', hemp, 'hemp plant'));
      this.syncTeachUi();
      return true;
    },
    finishTreeSearch(tree) {
      if (!tree || tree.stump || this.player.inventory) return false;
      this.dropTreeSearchFinds(tree);
      this.addFloat('Found stick + tree seed', tree.x, tree.y - 34, '#d3a95f');
      this.emitSound('search', { cooldownKey: 'player:search_tree', minGapMs: 160 });
      this.recordTeachStep(this.resourceRadiusStep('search_tree', tree, this.treeDisplayName(tree)));
      this.syncTeachUi();
      return true;
    },
    canFinishPlayerDeployHeldKit(target) {
      const kitType = this.normalizeBuildingKitItemType(target?.itemType || this.player.inventory?.type);
      return !!kitType && this.player.inventory?.type === kitType;
    },
    canFinishPlayerDeployLooseKit(target) {
      const item = this.items.find(i => i.id === target?.itemId);
      const kitType = this.normalizeBuildingKitItemType(item?.type);
      return !!item && !!kitType && !this.player.inventory;
    },
    finishPlayerDeployHeldKit(target) {
      const kitType = this.normalizeBuildingKitItemType(target?.itemType || this.player.inventory?.type);
      if (!kitType || this.player.inventory?.type !== kitType) return false;
      const s = this.deployBuildingKitAt(kitType, target.x, target.y);
      if (!s) return false;
      this.player.inventory = null;
      this.recordTeachStep(this.deployBuildingKitStep(kitType, s.x, s.y));
      this.syncTeachUi();
      return true;
    },
    finishPlayerDeployLooseKit(target) {
      const item = this.items.find(i => i.id === target?.itemId);
      const kitType = this.normalizeBuildingKitItemType(item?.type);
      if (!item || !kitType) return false;
      const s = this.deployBuildingKitAt(kitType, item.x, item.y);
      if (!s) { if (item.reservedBy === 'player') item.reservedBy = null; return false; }
      this.items = this.items.filter(i => i.id !== item.id);
      this.recordTeachStep({ op: 'pick_up', type: kitType });
      this.recordTeachStep(this.deployBuildingKitStep(kitType, s.x, s.y));
      this.syncTeachUi();
      return true;
    },
    queuePlayerDeployHeldKit(x, y, { append = false } = {}) {
      const kitType = this.normalizeBuildingKitItemType(this.player.inventory?.type);
      if (!kitType) return false;
      this.setPlayerDestination(x, y, { action: 'deploy_building_kit', itemType: kitType, x, y, floatText: `Deploy ${itemLabel(kitType)}` }, { append });
      return true;
    },
    queuePlayerDeployLooseKit(item) {
      const kitType = this.normalizeBuildingKitItemType(item?.type);
      if (!item || !kitType) return false;
      if (this.player.inventory) { this.addFloat(`Need empty hands to deploy ${itemLabel(kitType)} from ground`, this.player.x, this.player.y - 30, '#c86b5f'); return true; }
      if (item.reservedBy && item.reservedBy !== 'player') { this.addFloat(`${itemLabel(kitType)} is reserved`, item.x, item.y - 28, '#c86b5f'); return true; }
      item.reservedBy = 'player';
      this.setPlayerDestination(item.x, item.y, { action: 'deploy_loose_building_kit', itemId: item.id, floatText: `Deploy ${itemLabel(kitType)}` });
      return true;
    },
    queuePlayerResourceAction(resource, op, { append = false } = {}) {
      if (op === 'chop_tree' && this.player.inventory?.type !== 'crude_axe') return false;
      if (op === 'mine_stone' && this.player.inventory?.type !== 'crude_pickaxe') return false;
      const label = op === 'chop_tree' ? 'Chop tree' : 'Mine stone deposit';
      this.setPlayerDestination(resource.x, resource.y, { action: op, resourceId: resource.id, floatText: label }, { append });
      return true;
    },
    queuePlayerDemolishStructure(s, { append = false } = {}) {
      if (!this.canDemolishStructure(s) || this.player.inventory?.type !== 'crude_hammer') return false;
      this.setPlayerDestination(s.x, s.y, { action: 'demolish_structure', structureId: s.id, floatText: `Demolish ${s.name}` }, { append });
      return true;
    },
    finishPlayerDemolishStructure(target) {
      const s = this.structures.find(st => st.id === target?.structureId);
      if (!this.canDemolishStructure(s) || this.player.inventory?.type !== 'crude_hammer') return false;
      this.demolishStructure(s);
      return true;
    },
    manualDemolishStructure(s = null) {
      if (this.player.inventory?.type !== 'crude_hammer') return false;
      const target = s || this.structures.find(st => this.canDemolishStructure(st) && rectDistance(this.player.x, this.player.y, st) < 48);
      if (!target) { this.addFloat('Hammer needs a placed building', this.player.x, this.player.y - 30, '#c86b5f'); return false; }
      if (rectDistance(this.player.x, this.player.y, target) >= 48) return false;
      return this.demolishStructure(target);
    },
    canFinishPlayerDisassembleStructure(target) {
      const s = this.structures.find(st => st.id === target?.structureId);
      return !this.player.inventory && this.canDisassembleStructure(s);
    },
    queuePlayerDisassembleStructure(s, { append = false } = {}) {
      if (!this.canDisassembleStructure(s)) return false;
      this.setPlayerDestination(s.x, s.y, { action: 'disassemble_building_to_kit', structureId: s.id, floatText: `Disassemble ${s.name} into kit` }, { append });
      return true;
    },
    finishPlayerDisassembleStructure(target) {
      const s = this.structures.find(st => st.id === target?.structureId);
      if (!this.canDisassembleStructure(s)) return false;
      const kitType = this.disassembleStructureToKit(s, this.player);
      if (kitType) this.recordTeachStep({ op: 'disassemble_building_to_kit', structureId: target.structureId, structureRef: s.ref, structureType: s.type, structureName: s.name, target: s.name });
      this.syncTeachUi();
      return !!kitType;
    },
    queuePlayerThroneAttack(s, { append = false } = {}) {
      if (!this.isEnemyThrone(s)) return false;
      const side = this.player.x < s.x ? -1 : 1;
      this.setPlayerDestination(s.x + side * Math.max(42, s.w / 2), s.y, { action: 'attack_throne', structureId: s.id, floatText: `Attack ${s.name}` }, { append });
      return true;
    },
  });
}
