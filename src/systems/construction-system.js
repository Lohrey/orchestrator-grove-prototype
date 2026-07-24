// src/systems/construction-system.js
// Multi-bot construction system for quest buildings (e.g. the bridge).
// Part of the Game class composition root — installed via installConstructionSystem(Game, deps).
//
// A structure with `buildWorkTotal` (set by addStructure from BUILDING_TYPES def):
//   - structure.buildWorkDone           accumulated work-seconds (starts 0)
//   - structure.constructionMaterialsMet  false until all materials deposited
//   - structure.constructionComplete    flips true when buildWorkDone >= buildWorkTotal
//   - structure.workers                 array of bot ids currently assigned
//   - structure.materialsRequired       { logs: N, planks: N, ... }
//   - structure.materialsDeposited      { logs: 0, planks: 0, ... }
//
// Methods added to Game.prototype:
//   - assignBotToConstruction(bot, structure)
//   - unassignBotFromConstruction(bot)
//   - checkConstructionMaterials(structure)
//   - depositConstructionMaterial(structure, type, count)
//   - updateConstruction(dt)             called from main update loop
//   - onConstructionComplete(structure)  fires hook, removes impassable zone
//
// Player contribution: right-clicking a quest construction structure while
// carrying no item sets `player.constructionTarget = structure.id`. The update
// loop counts the player as an extra worker when they are nearby.

export function installConstructionSystem(Game, deps) {
  const { BUILDING_TYPES, clamp, clone } = deps;

  Object.assign(Game.prototype, {
    /**
     * Assign a bot to work on a construction structure. The bot will walk to
     * the structure (handled in updateBot) and stay there; this method just
     * records the assignment. Each tick the construction update loop adds one
     * work-second per assigned bot that is close enough to the site.
     */
    assignBotToConstruction(bot, structure) {
      if (!bot || !structure || !structure.buildWorkTotal || structure.constructionComplete) return false;
      bot.constructionTarget = structure.id;
      bot.state = 'constructing';
      if (!Array.isArray(structure.workers)) structure.workers = [];
      if (!structure.workers.includes(bot.id)) structure.workers.push(bot.id);
      return true;
    },

    /**
     * Remove a bot from a construction site (e.g. if the structure is
     * destroyed or the bot is reassigned). Clears bot.constructionTarget.
     */
    unassignBotFromConstruction(bot) {
      if (!bot || !bot.constructionTarget) return;
      const structure = this.structures.find(s => s.id === bot.constructionTarget);
      if (structure && Array.isArray(structure.workers)) {
        structure.workers = structure.workers.filter(id => id !== bot.id);
      }
      bot.constructionTarget = null;
      if (bot.state === 'constructing') bot.state = bot.program || 'idle';
    },

    /**
     * Return true if all required materials for the structure have been
     * deposited. Caches the result on structure.constructionMaterialsMet.
     */
    checkConstructionMaterials(structure) {
      if (!structure || !structure.materialsRequired) return true;
      const deposited = structure.materialsDeposited || {};
      const met = Object.entries(structure.materialsRequired).every(
        ([type, required]) => (deposited[type] || 0) >= required
      );
      structure.constructionMaterialsMet = met;
      return met;
    },

    /**
     * Deposit materials toward a construction structure. Returns the number
     * actually accepted (clamped against the remaining requirement).
     */
    depositConstructionMaterial(structure, type, count = 1) {
      if (!structure || !structure.materialsRequired || !(type in structure.materialsRequired)) return 0;
      if (!structure.materialsDeposited) structure.materialsDeposited = {};
      const required = structure.materialsRequired[type] || 0;
      const already = structure.materialsDeposited[type] || 0;
      const accepted = Math.max(0, Math.min(count, required - already));
      structure.materialsDeposited[type] = already + accepted;
      this.checkConstructionMaterials(structure);
      return accepted;
    },

    /**
     * Per-tick update. Iterates all structures with buildWorkTotal and, for
     * each that has materialsMet, accumulates work from assigned workers (and
     * a nearby player, if contributing). On completion, fires the completion
     * handler once.
     */
    updateConstruction(dt) {
      for (const structure of this.structures || []) {
        if (!structure.buildWorkTotal || structure.constructionComplete) continue;
        if (!structure.constructionMaterialsMet) {
          this.checkConstructionMaterials(structure);
          if (!structure.constructionMaterialsMet) continue;
        }
        // Count workers close enough to contribute this tick.
        let contributors = 0;
        const siteRadius = Math.max(structure.w || 80, structure.h || 80) * 0.75 + 60;
        for (const bot of this.bots || []) {
          if (bot.constructionTarget !== structure.id) continue;
          const dx = (bot.x || 0) - (structure.x || 0);
          const dy = (bot.y || 0) - (structure.y || 0);
          if (dx * dx + dy * dy <= siteRadius * siteRadius) contributors++;
        }
        // Player contribution: if carrying nothing and right-click-assigned.
        if (this.player?.constructionTarget === structure.id && !this.player.inventory && !this.player.dead) {
          const dx = (this.player.x || 0) - (structure.x || 0);
          const dy = (this.player.y || 0) - (structure.y || 0);
          if (dx * dx + dy * dy <= siteRadius * siteRadius) contributors++;
        }
        if (contributors > 0) {
          structure.buildWorkDone = (structure.buildWorkDone || 0) + contributors * dt;
          if (structure.buildWorkDone >= structure.buildWorkTotal) {
            structure.buildWorkDone = structure.buildWorkTotal;
            this.onConstructionComplete(structure);
          }
        }
      }
    },

    /**
     * Construction complete handler. Marks the structure, unassigns workers,
     * removes any `canyon_bridge_gap` impassable zone so the far side becomes
     * passable, and fires the onConstructionComplete hook (used by the quest
     * system to advance Q30).
     */
    onConstructionComplete(structure) {
      if (!structure || structure.constructionComplete) return;
      structure.constructionComplete = true;
      // Unassign all workers.
      for (const bot of this.bots || []) {
        if (bot.constructionTarget === structure.id) {
          bot.constructionTarget = null;
          if (bot.state === 'constructing') bot.state = bot.program || 'idle';
        }
      }
      structure.workers = [];
      if (this.player?.constructionTarget === structure.id) {
        this.player.constructionTarget = null;
      }
      // Remove the bridge-gap impassable zone so the chasm becomes passable.
      if (structure.type === 'bridge') {
        this.removeImpassableZone?.('canyon_bridge_gap');
      }
      this.addFloat(`${structure.name} complete`, structure.x, structure.y - 48, '#9abf8f');
      this.emitSound?.('build', { cooldownKey: `construction_complete:${structure.id}`, minGapMs: 9999 });
      // Quest hook
      this.onQuestConstructionComplete?.(structure);
    },

    /**
     * Place the bridge structure at its predefined canyon gap position.
     * Called by the Q30 quest start handler. The structure is created in the
     * unbuilt state (buildWorkDone = 0) and waits for materials + workers.
     */
    placeBridgeAtCanyonGap() {
      const { CANYON_BRIDGE_POSITION } = deps;
      if (!CANYON_BRIDGE_POSITION) return null;
      // Don't place twice.
      const existing = this.structures.find(s => s.type === 'bridge');
      if (existing) return existing;
      const s = this.addStructure('bridge', CANYON_BRIDGE_POSITION.x, CANYON_BRIDGE_POSITION.y, { placed: true });
      if (this.campaignQuest) this.campaignQuest.bridgeStructureId = s.id;
      return s;
    },

    /**
     * Convenience: deposit a held material into a nearby construction site.
     * Used by the player right-click path when standing near a bridge holding
     * a required material (e.g. a log). Returns true if accepted.
     */
    depositHeldItemIntoConstruction(structure) {
      if (!structure || !structure.buildWorkTotal || structure.constructionComplete) return false;
      const held = this.player?.inventory;
      if (!held) return false;
      const type = held.type;
      if (!structure.materialsRequired || !(type in structure.materialsRequired)) return false;
      const required = structure.materialsRequired[type] || 0;
      const already = structure.materialsDeposited?.[type] || 0;
      if (already >= required) return false;
      const accepted = this.depositConstructionMaterial(structure, type, held.count || 1);
      if (accepted > 0) {
        this.player.inventory = null;
        this.addFloat(`Deposited ${accepted} ${type} into ${structure.name}`, this.player.x, this.player.y - 36, '#9abf8f');
        this.emitSound?.('deposit', { cooldownKey: `construction_deposit:${structure.id}:${type}`, minGapMs: 80 });
        return true;
      }
      return false;
    },

    /**
     * Player right-click assist: if the player is near a quest construction
     * site and carries no item, set player.constructionTarget so the update
     * loop counts them as a contributor. If they ARE carrying a required
     * material, deposit it instead. Returns true if the click was consumed.
     */
    playerAssistConstruction(structure) {
      if (!structure || !structure.buildWorkTotal || structure.constructionComplete) return false;
      // Deposit path: player holds a required material.
      if (this.player.inventory && structure.materialsRequired && (this.player.inventory.type in structure.materialsRequired)) {
        return this.depositHeldItemIntoConstruction(structure);
      }
      // Assist path: empty hands → contribute labor.
      if (!this.player.inventory) {
        this.player.constructionTarget = structure.id;
        this.addFloat(`Helping build ${structure.name}`, this.player.x, this.player.y - 36, '#d3a95f');
        return true;
      }
      return false;
    }
  });
}
