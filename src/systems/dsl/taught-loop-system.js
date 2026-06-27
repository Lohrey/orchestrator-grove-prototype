export function installTaughtLoopSystem(Game, deps) {
  const {
    BUILDING_DISASSEMBLE_SECONDS,
    BUILDING_KIT_DEPLOY_SECONDS,
    DEFAULT_FOLLOW_DISTANCE,
    HEMP_CHOP_SECONDS,
    HEMP_SEARCH_SECONDS,
    RESOURCE_HIT_SECONDS,
    TREE_SEARCH_SECONDS,
    clamp,
    itemLabel,
    nearest
  } = deps;

  Object.assign(Game.prototype, {
    executeFollowStep(bot, step, dt) {
      const target = this.resolveActorReference(step.targetRef || step.target || 'me', bot);
      if (!target || target === bot || (target.hp ?? 1) <= 0) { bot.message = `Follow target ${step.targetName || step.target || 'target'} unavailable.`; return false; }
      const spacing = clamp(Number(step.distance || DEFAULT_FOLLOW_DISTANCE), 18, 220);
      const reached = this.moveToward(bot, target.x, target.y, dt, bot.speed, spacing);
      bot.message = reached ? `Following ${this.actorLabel(target)}.` : `Moving to follow ${this.actorLabel(target)}.`;
      return reached;
    },
    executeEquipItemStep(bot, step, dt) {
      const type = this.normalizeWeaponItemType(step.type);
      if (!type) { bot.message = 'equip_item supports only sword, shield, or bow.'; return false; }
      if (this.actorAlreadyHasPickupType(bot, type)) { bot.message = `Already has ${itemLabel(type)} equipped.`; return true; }
      let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === type) : null;
      if (!item) {
        item = nearest(this.items, bot.x, bot.y, i => i.type === type && (!i.reservedBy || i.reservedBy === bot.id));
        if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'equip_item'; }
      }
      if (!item) { bot.message = `Waiting for loose ${itemLabel(type)} to equip.`; return false; }
      if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Moving to equip ${itemLabel(type)}.`; return false; }
      const beforeInventory = bot.inventory?.type || null;
      if (!this.pickItem(bot, item)) return false;
      bot.message = beforeInventory ? `Carrying ${itemLabel(type)} as extra weaponry.` : `Equipped ${itemLabel(type)}.`;
      return true;
    },
    completeTaughtProgram(bot, message = 'Completed DSL program.') {
      this.releaseReservation(bot);
      bot.program = 'idle';
      bot.state = 'idle';
      bot.message = message;
      bot.runtime = { pc: 0, memory: {}, wait: 0 };
      bot.target = null;
      bot.targetItemId = null;
      bot.targetItemPurpose = null;
      bot.targetHoleId = null;
      bot.timer = 0;
      this.addFloat(`Bot ${bot.id}: DSL done`, bot.x, bot.y - 22, '#9abf8f');
      return true;
    },
    programTaughtLoop(bot, dt) {
      const steps = bot.taughtLoop || [];
      if (!steps.length) { bot.message = 'No taught loop assigned.'; return; }
      if (bot.runtime.pc >= steps.length) {
        if (bot.taughtLoopRepeat === false) {
          this.completeTaughtProgram(bot);
          return;
        }
        bot.runtime.pc = 0;
      }
      const step = steps[bot.runtime.pc] || steps[0];
      const advance = () => {
        this.releaseReservation(bot);
        bot.runtime.pc += 1;
        if (bot.runtime.pc >= steps.length) {
          if (bot.taughtLoopRepeat === false) {
            this.completeTaughtProgram(bot);
            return false;
          }
          bot.runtime.pc = 0;
        }
        bot.target = null;
        bot.targetItemId = null;
        bot.targetItemPurpose = null;
        bot.targetHoleId = null;
        bot.timer = 0;
        bot.runtime.wait = 0;
        return true;
      };
      if (step.op === 'wait') {
        const duration = clamp(Number(step.seconds ?? 1), 0.1, 30);
        if (!(bot.runtime.wait > 0)) bot.runtime.wait = duration;
        bot.runtime.wait = Math.max(0, bot.runtime.wait - dt);
        bot.message = `Taught loop: waiting ${bot.runtime.wait > 0 ? bot.runtime.wait.toFixed(1) : '0.0'}/${duration.toFixed(1)}s.`;
        if (bot.runtime.wait <= 0) advance();
        return;
      }
      if (step.op === 'assign_template') {
        const res = this.assignTemplateToBot(step.botId, step.templateName, { actorBot: bot, reason: `Assigned by ${this.botDisplayName?.(bot) || `Bot ${bot.id}`}` });
        bot.message = res.ok ? `Assigned template ${res.template.name} to ${this.botDisplayName?.(res.bot) || `Bot ${res.bot.id}`}.` : res.error;
        if (res.ok && res.bot?.id === bot.id) return;
        if (res.ok) advance();
        return;
      }
      if (step.op === 'rename_bot') {
        const targetBot = step.botId ? this.findBot(step.botId) : bot;
        const res = this.setBotName(targetBot, step.name);
        bot.message = res.ok
          ? `Renamed ${res.bot.id === bot.id ? 'this bot' : `Bot ${res.bot.id}`} to ${this.botDisplayName(res.bot)}.`
          : res.error;
        if (res.ok) advance();
        return;
      }
      if (step.op === 'promote_to_manager') {
        const targetBot = step.botId ? this.findBot(step.botId) : bot;
        const res = this.promoteBotToManager(targetBot, step.knowledgePacks);
        bot.message = res.ok
          ? `Promoted ${res.bot.id === bot.id ? 'this bot' : this.botDisplayName(res.bot)} to manager.`
          : res.error;
        if (res.ok) advance();
        return;
      }
      if (step.op === 'delegate_to_manager') {
        const res = this.delegateMessageToManager(bot, step.recipientBotId || step.recipient, step.message, { throttleKey: `${bot.id}:${bot.runtime.pc}:${step.recipientBotId || step.recipient}:${step.message}` });
        bot.message = res.ok
          ? (res.throttled ? `Delegate to ${step.recipientName || step.recipient} throttled briefly.` : `Delegated to ${this.botDisplayName(res.manager)}.`)
          : res.error;
        if (res.ok) advance();
        return;
      }
      if (step.op === 'follow') {
        if (this.executeFollowStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'attack') {
        this.executeAttackStep(bot, step, dt);
        return;
      }
      if (step.op === 'guard_area') {
        this.executeGuardAreaStep(bot, step, dt);
        return;
      }
      if (step.op === 'patrol_route') {
        this.executePatrolRouteStep(bot, step, dt);
        return;
      }
      if (step.op === 'equip_item') {
        if (this.executeEquipItemStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'craft_smithery') {
        if (this.executeCraftSmitheryStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'craft_bowmaker') {
        if (this.executeCraftBowmakerStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'craft_arrowmaker') {
        if (this.executeCraftArrowmakerStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'deploy_building_kit') {
        if (this.executeDeployBuildingKitStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'disassemble_building_to_kit') {
        if (this.executeDisassembleBuildingToKitStep(bot, step, dt)) advance();
        return;
      }
      if (step.op === 'pick_up' || step.op === 'pick_up_from_storage') {
        if (this.actorAlreadyHasPickupType(bot, step.type)) { bot.message = `Taught loop already has ${itemLabel(step.type)}; pick_up skipped.`; advance(); return; }
        const heldType = this.pickupBlockedByHeldTool(bot, step.type);
        if (heldType) { bot.message = `Taught loop needs empty hands for ${itemLabel(step.type)}; already holding ${itemLabel(heldType)}.`; return; }
        if (step.op === 'pick_up_from_storage') {
          const s = this.resolveRecordedStructure(step, bot);
          if (s && this.takeStoredItemFromStructure(bot, s, step.type, dt)) { advance(); return; }
          if (s) { bot.message = `Taught loop waiting for ${itemLabel(step.type)} in ${s.name}.`; return; }
        }
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === step.type && this.objectInZone(i, zone, bot)) : null;
        if (!item) {
          item = nearest(this.items, bot.x, bot.y, i => i.type === step.type && this.objectInZone(i, zone, bot) && (!i.reservedBy || i.reservedBy === bot.id));
          if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'taught_loop'; }
        }
        if (!item) { bot.message = `Taught loop waiting for loose ${itemLabel(step.type)}.`; return; }
        if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Taught loop: pick_up ${itemLabel(step.type)}.`; return; }
        if (!this.pickItem(bot, item)) return;
        bot.message = `Taught loop picked up ${itemLabel(step.type)}.`;
        advance();
        return;
      }
      if (step.op === 'move_to_structure') {
        const s = this.resolveRecordedStructure(step, bot);
        if (!s) { bot.message = `Taught loop cannot find ${step.structureName || 'structure'}.`; return; }
        if (!this.moveBotTo(bot, s, dt, 32)) { bot.message = `Taught loop: move_to ${s.name}.`; return; }
        bot.message = `Taught loop reached ${s.name}.`;
        advance();
        return;
      }
      if (step.op === 'take_from_player') {
        if (this.actorAlreadyHasPickupType(bot, step.type)) { bot.message = `Taught loop already has ${itemLabel(step.type)}; take_from_player skipped.`; advance(); return; }
        const heldType = this.pickupBlockedByHeldTool(bot, step.type);
        if (heldType) { bot.message = `Taught loop needs empty hands for ${itemLabel(step.type)}; already holding ${itemLabel(heldType)}.`; return; }
        if (!this.moveBotTo(bot, this.player, dt, 30)) { bot.message = `Taught loop: take ${itemLabel(step.type)} from player.`; return; }
        if (!this.takePlayerItemForBot(bot, step.type)) return;
        bot.message = `Taught loop took ${itemLabel(step.type)} from player.`;
        advance();
        return;
      }
      if (step.op === 'deposit_to_player') {
        if (!bot.inventory || bot.inventory.type !== step.type) { bot.message = `Taught loop needs ${itemLabel(step.type)} before bringing it to player.`; bot.runtime.pc = 0; return; }
        if (!this.moveBotTo(bot, this.player, dt, 30)) { bot.message = `Taught loop: bring ${itemLabel(step.type)} to player.`; return; }
        if (!this.depositBotItemToPlayer(bot, step.type)) return;
        bot.message = `Taught loop delivered ${itemLabel(step.type)} to player.`;
        advance();
        return;
      }
      if (step.op === 'deposit_to_structure') {
        const s = this.resolveRecordedStructure(step, bot);
        if (!s) { bot.message = `Taught loop cannot find ${step.structureName || 'structure'}.`; return; }
        if (!bot.inventory || bot.inventory.type !== step.type) { bot.message = `Taught loop needs ${itemLabel(step.type)} before depositing.`; bot.runtime.pc = 0; return; }
        if (!this.canStructureAcceptItem(s, step.type)) {
          if (!this.depositHeldItemToStructure(s, step.type, { worker: { bot } })) {
            bot.message = this.isStructureProcessing(s) ? `Taught loop waiting for ${s.name} to finish.` : `${s.name} cannot take ${itemLabel(step.type)}.`;
            return;
          }
        }
        if (!this.moveBotTo(bot, s, dt, 32)) { bot.message = `Taught loop: deposit ${itemLabel(step.type)} into ${s.name}.`; return; }
        if (!this.depositHeldItemToStructure(s, step.type, { worker: { bot } })) { bot.message = this.isStructureProcessing(s) ? `Taught loop waiting for ${s.name} to finish.` : `${s.name} cannot take ${itemLabel(step.type)}.`; return; }
        bot.inventory = null;
        bot.message = this.isStructureProcessing(s) ? `Taught loop deposited ${itemLabel(step.type)} and started ${s.processing.label}.` : `Taught loop deposited ${itemLabel(step.type)} into ${s.name}.`;
        advance();
        return;
      }
      if (step.op === 'drop_item') {
        if (!bot.inventory) { bot.message = 'Taught loop needs something in hand before dropping.'; bot.runtime.pc = 0; return; }
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        const target = this.zoneCenter(zone, bot);
        const droppedType = bot.inventory.type;
        if (target && !this.moveBotTo(bot, target, dt, 12)) { bot.message = `Taught loop: drop ${itemLabel(droppedType)} in ${this.zoneLabel(zone)}.`; return; }
        this.spawnItem(droppedType, bot.x, bot.y, bot.inventory.count || 1);
        bot.inventory = null;
        bot.message = `Taught loop dropped ${itemLabel(droppedType)} in ${this.zoneLabel(zone)}.`;
        advance();
        return;
      }
      if (step.op === 'dig_hole') {
        if (!this.ensureDigTool(bot, dt)) return;
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        let spot = bot.target?.kind === 'dig_spot' && this.pointInZone(bot.target.x, bot.target.y, zone, bot) && this.isDiggable(bot.target.x, bot.target.y) ? bot.target : null;
        if (!spot) { spot = this.findDigSpotInZone(bot, zone); bot.target = spot; bot.timer = 0; }
        if (!spot) { bot.message = `Taught loop waiting for open dirt in ${this.zoneLabel(zone)}.`; return; }
        if (!this.moveBotTo(bot, spot, dt, 12)) { bot.message = `Taught loop: dig hole in ${this.zoneLabel(zone)}.`; return; }
        bot.timer += dt;
        bot.message = `Taught loop: digging hole (${Math.ceil(bot.timer * 2)}/2).`;
        if (bot.timer >= 1) {
          bot.timer = 0;
          bot.inventory.durability--;
          this.spawnHole(spot.x, spot.y);
          this.addFloat('Dug hole', spot.x, spot.y - 16, '#6b4a28');
          this.emitSound('dig', { cooldownKey: `bot:dig:${bot.id}`, minGapMs: 220 });
          if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(bot.inventory.type)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
          advance();
        }
        return;
      }
      if (step.op === 'plant_seed') {
        if (!bot.inventory || bot.inventory.type !== 'tree_seed') { bot.message = 'Taught loop needs tree seed before planting.'; bot.runtime.pc = 0; return; }
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        let hole = step.holeId ? this.holes.find(h => h.id === step.holeId && !h.planted && this.objectInZone(h, zone, bot)) : null;
        if (!hole) hole = this.nearestOpenHole(bot.x, bot.y, zone, Infinity, bot.id, bot);
        if (!hole) { bot.message = `Taught loop waiting for an open dug hole in ${this.zoneLabel(zone)}.`; return; }
        if (!this.moveBotTo(bot, hole, dt, 12)) { bot.message = `Taught loop: plant tree seed in ${this.zoneLabel(zone)}.`; return; }
        this.plantSeedInHole(hole, bot);
        bot.inventory = null;
        bot.message = `Taught loop planted tree seed in ${this.zoneLabel(zone)}.`;
        advance();
        return;
      }
      if (step.op === 'chop_tree') {
        if (!this.ensureChopTool(bot, dt)) return;
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        let tree = bot.target && this.isChoppableTree(bot.target) && this.objectInZone(bot.target, zone, bot) ? bot.target : null;
        if (!tree && step.treeId) tree = this.trees.find(t => t.id === step.treeId && this.isChoppableTree(t) && this.objectInZone(t, zone, bot)) || null;
        if (!tree) tree = nearest(this.trees, bot.x, bot.y, t => this.isChoppableTree(t) && this.objectInZone(t, zone, bot));
        if (!tree) { bot.message = `Taught loop waiting for a grown tree in ${this.zoneLabel(zone)}.`; return; }
        bot.target = tree;
        if (!this.moveBotTo(bot, tree, dt, tree.radius + 14)) { bot.message = `Taught loop: move to tree in ${this.zoneLabel(zone)}.`; return; }
        bot.timer += dt;
        bot.message = `Taught loop: chopping tree (${Math.min(RESOURCE_HIT_SECONDS, Math.ceil(bot.timer))}/${RESOURCE_HIT_SECONDS}).`;
        if (bot.timer >= RESOURCE_HIT_SECONDS) {
          bot.timer = 0;
          tree.hp--;
          this.spawnItem('log', tree.x, tree.y, 1);
          bot.inventory.durability--;
          if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(bot.inventory.type)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
          if (tree.hp <= 0) { tree.stump = true; tree.regrow = 0; this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); advance(); }
        }
        return;
      }
      if (step.op === 'search_tree') {
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        let tree = bot.target && this.treeSearchAvailable(bot.target, bot.id) && this.objectInZone(bot.target, zone, bot) ? bot.target : null;
        if (!tree && step.treeId) tree = this.trees.find(t => t.id === step.treeId && this.treeSearchAvailable(t, bot.id) && this.objectInZone(t, zone, bot)) || null;
        if (!tree) tree = nearest(this.trees, bot.x, bot.y, t => this.treeSearchAvailable(t, bot.id) && this.objectInZone(t, zone, bot));
        if (!tree) { bot.message = `Taught loop waiting for an unsearched tree in ${this.zoneLabel(zone)}.`; return; }
        tree.searchReservedBy = bot.id;
        bot.target = tree;
        if (!this.moveBotTo(bot, tree, dt, tree.radius + 14)) { bot.message = 'Taught loop: move to tree and search for sticks/seeds.'; return; }
        bot.timer += dt;
        bot.message = `Searching tree for sticks/seeds (${Math.ceil(bot.timer)}/${Math.ceil(TREE_SEARCH_SECONDS)}).`;
        if (bot.timer >= TREE_SEARCH_SECONDS) { this.dropTreeSearchFinds(tree); this.addFloat('Found stick + seed', tree.x, tree.y - 34, '#d3a95f'); advance(); }
        return;
      }
      if (step.op === 'chop_hemp' || step.op === 'search_hemp') {
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        if (step.op === 'chop_hemp' && !this.ensureChopTool(bot, dt)) return;
        if (step.op === 'search_hemp' && bot.inventory) { bot.message = `Taught loop needs empty hands to search hemp.`; return; }
        let hemp = bot.target && !bot.target.harvested && this.objectInZone(bot.target, zone, bot) ? bot.target : null;
        if (!hemp && step.hempId) hemp = this.hempPlants.find(h => h.id === step.hempId && !h.harvested && this.objectInZone(h, zone, bot)) || null;
        if (!hemp) hemp = nearest(this.hempPlants, bot.x, bot.y, h => !h.harvested && this.objectInZone(h, zone, bot) && (step.op === 'chop_hemp' || !h.searched));
        if (!hemp) { bot.message = `Taught loop waiting for hemp in ${this.zoneLabel(zone)}.`; return; }
        bot.target = hemp;
        if (!this.moveBotTo(bot, hemp, dt, (hemp.radius || 14) + 12)) { bot.message = step.op === 'chop_hemp' ? 'Taught loop: move to hemp with axe.' : 'Taught loop: move to hemp and search.'; return; }
        bot.timer += dt;
        const total = step.op === 'chop_hemp' ? HEMP_CHOP_SECONDS : HEMP_SEARCH_SECONDS;
        bot.message = `${step.op === 'chop_hemp' ? 'Chopping' : 'Searching'} hemp (${Math.ceil(bot.timer)}/${Math.ceil(total)}).`;
        if (bot.timer >= total) {
          if (step.op === 'chop_hemp') { hemp.harvested = true; this.hempPlants = this.hempPlants.filter(h => h.id !== hemp.id); this.spawnItem('hemp', hemp.x, hemp.y, 1); this.spawnItem('hemp_seed', hemp.x, hemp.y, 1); }
          else { hemp.searched = true; this.spawnItem('hemp_seed', hemp.x, hemp.y, 1); }
          advance();
        }
        return;
      }
      if (step.op === 'mine_stone') {
        if (!this.ensureMineTool(bot, dt)) return;
        const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
        let rock = bot.target?.type === 'stone_deposit' && !bot.target.depleted && this.objectInZone(bot.target, zone, bot) ? bot.target : null;
        if (!rock && step.rockId) rock = this.rocks.find(r => r.id === step.rockId && !r.depleted && this.objectInZone(r, zone, bot)) || null;
        if (!rock) rock = nearest(this.rocks, bot.x, bot.y, r => !r.depleted && this.objectInZone(r, zone, bot));
        if (!rock) { bot.message = `Taught loop waiting for a stone deposit in ${this.zoneLabel(zone)}.`; return; }
        bot.target = rock;
        if (!this.moveBotTo(bot, rock, dt, rock.radius + 14)) { bot.message = `Taught loop: move to stone deposit in ${this.zoneLabel(zone)}.`; return; }
        bot.timer += dt;
        bot.message = `Taught loop: mining stone (${Math.min(RESOURCE_HIT_SECONDS, Math.ceil(bot.timer))}/${RESOURCE_HIT_SECONDS}).`;
        if (bot.timer >= RESOURCE_HIT_SECONDS) {
          bot.timer = 0;
          rock.hp--;
          this.spawnItem('stone', rock.x, rock.y, 1);
          bot.inventory.durability--;
          if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(bot.inventory.type)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
          if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; advance(); }
        }
        return;
      }
      advance();
    }
  });
}
