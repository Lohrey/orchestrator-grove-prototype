// src/campaign/campaign-quest.js
// Campaign quest state machine: van unpack progression gate, quest completion checker,
// and hooks for bot-program-assigned / storage-placed events.
// Part of the Game class composition root — installed via installCampaignQuestSystem(Game, deps).
//
// Dependencies (passed via deps):
//   distXY, rand, itemLabel.

import { distXY } from '../utils.js';
import { rand } from '../utils.js';

/**
 * Maps a quest number to the dialogue ID that fires when that quest begins.
 * Used by completeQuest to chain quest start dialogues after completion.
 */
const QUEST_START_DIALOGUES = {
  2: 'quest2_start',
  4: 'quest4_teach_prompt',
  6: 'quest6_start',
  8: 'quest8_start',
  9: 'quest9_start',
  10: 'quest10_start',
  11: 'quest11_start',
  12: 'quest12_start',
  13: 'quest13_start',
  14: 'quest14_start',
  15: 'quest15_start',
  16: 'quest16_start',
  17: 'quest17_start',
  18: 'quest18_start',
  19: 'quest19_start',
  20: 'quest20_start',
  21: 'quest21_start',
  22: 'quest22_start',
  23: 'quest23_start',
  24: 'quest24_start',
  25: 'quest25_start',
  26: 'quest26_start',
  27: 'quest27_start',
  28: 'quest28_start',
  29: 'quest29_start',
};

export function installCampaignQuestSystem(Game, deps) {
  const { itemLabel } = deps;

  Object.assign(Game.prototype, {
    isNearVan(x, y, radius = 80) {
      // Use actual van feature bounds (126×62) for tighter interaction area.
      // Find the camper_van map feature near idleDepot for precise rect hit-testing.
      const feature = (this.mapFeatures || []).find(f => f.type === 'camper_van');
      if (feature) {
        const hw = (feature.w || 126) / 2 + 16; // small padding for easy clicking
        const hh = (feature.h || 62) / 2 + 16;
        return Math.abs(x - feature.x) <= hw && Math.abs(y - feature.y) <= hh;
      }
      // Fallback to radius-based if feature not found
      const van = this.idleDepot;
      if (!van) return false;
      return distXY(x, y, van.x, van.y) <= radius;
    },

    /**
     * Unpack the camper van. Each unpack advances the quest progression gate
     * and drops the next quest item. Only callable once per quest milestone.
     * Returns true if unpack succeeded, false if nothing to unpack.
     */
    unpackVan() {
      if (!this.campaignQuest?.active) return false;
      const q = this.campaignQuest;
      const van = this.idleDepot;
      if (!van) return false;
      const unpackIndex = q.vanUnpackCount; // 0-based: 0=first, 1=second, etc.

      // Map unpack index → which quest this unpack serves and what it drops
      // Chapter I (tutorial)
      // Unpack 0 → Quest 1: crude_axe
      // Unpack 1 → Quest 3: bot
      // Unpack 2 → Quest 5: item_palette_kit (storage building kit)
      // Unpack 3 → Quest 7: crude_shovel
      // Chapter II (industry)
      // Unpack 4 → Quest 10: sawbench_kit
      // Unpack 5 → Quest 12: workbench_kit
      // Chapter III (automation at scale)
      // Unpack 6 → Quest 19: factory_kit
      // Chapter IV (arms & defense)
      // Unpack 7 → Quest 20: smithery_kit
      const unpackMapping = [
        { quest: 1, type: 'item', item: 'crude_axe', dialogue: 'quest1_axe_dropped' },
        { quest: 3, type: 'bot', dialogue: 'quest3_bot_dropped' },
        { quest: 5, type: 'item', item: 'item_palette_kit', dialogue: 'quest5_storage_dropped' },
        { quest: 7, type: 'item', item: 'crude_shovel', dialogue: 'quest7_shovel_dropped' },
        { quest: 10, type: 'item', item: 'sawbench_kit', dialogue: 'quest10_van_drop' },
        { quest: 12, type: 'item', item: 'workbench_kit', dialogue: 'quest12_van_drop' },
        { quest: 19, type: 'item', item: 'factory_kit', dialogue: 'quest19_van_drop' },
        { quest: 20, type: 'item', item: 'smithery_kit', dialogue: 'quest20_van_drop' },
      ];

      if (unpackIndex >= unpackMapping.length) {
        this.addFloat('The van is empty — nothing left to unpack.', van.x, van.y - 30, '#c7b683');
        return false;
      }

      const entry = unpackMapping[unpackIndex];
      // Only allow unpack if the player is on (or past) the expected quest
      if (q.currentQuest < entry.quest) {
        this.addFloat(`Nothing to unpack yet — complete the current task first.`, van.x, van.y - 30, '#c7b683');
        return false;
      }

      const dropX = van.x + 60 + rand(-10, 10);
      const dropY = van.y + 30 + rand(-8, 8);

      q.vanUnpackCount++;

      if (entry.type === 'item') {
        this.spawnItem(entry.item, dropX, dropY, 1);
        this.addFloat(`Unpacked: ${itemLabel(entry.item)}`, van.x, van.y - 45, '#9abf8f');
      } else if (entry.type === 'bot') {
        const bot = this.createBot(dropX, dropY, 'idle', true);
        if (bot) this.addFloat('Unpacked: helper bot', van.x, van.y - 45, '#9abf8f');
      }

      this.emitSound('drop', { cooldownKey: 'van:unpack', minGapMs: 200 });
      this.queueDialogue(entry.dialogue);
      this.checkCampaignQuest();
      return true;
    },

    /**
     * Central quest completion checker. Called after relevant game actions.
     * Checks the current quest's conditions and advances when met.
     */
    checkCampaignQuest() {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;

      const completeQuest = (n, nextDialogueId) => {
        if (q.completedQuests.includes(n)) return;
        q.completedQuests.push(n);
        q.currentQuest = n + 1;
        if (nextDialogueId) {
          const self = this;
          setTimeout(() => {
            self.queueDialogue(nextDialogueId);
          }, 800);
        }
        // Fire the start dialogue for the next quest — but skip if it's the
        // same as the completion dialogue (avoids doubling Q1–Q9 transitions
        // where the completion dialogue IS the next quest's start prompt).
        const nextQuestStart = QUEST_START_DIALOGUES[q.currentQuest];
        if (nextQuestStart && nextQuestStart !== nextDialogueId) {
          const self = this;
          setTimeout(() => {
            self.queueDialogue(nextQuestStart);
          }, 2400);
        }
        if (q.currentQuest > 29) {
          q.active = false;
          q.campaignComplete = true;
        }
      };

      switch (q.currentQuest) {
        case 1:
          // Quest 1: unpack the van (axe drops). Completed by unpacking.
          if (q.vanUnpackCount >= 1) {
            completeQuest(1, 'quest2_start');
          }
          break;
        case 2:
          // Quest 2: pick up axe, chop a tree, drop axe
          if (q.quest2AxePickedUp && q.quest2TreeChopped && q.quest2AxeDropped) {
            completeQuest(2, 'quest2_complete');
          }
          break;
        case 3:
          // Quest 3: unpack van again (bot drops). Completed by unpacking.
          if (q.vanUnpackCount >= 2) {
            completeQuest(3, 'quest4_teach_prompt');
          }
          break;
        case 4:
          // Quest 4: teach bot to chop (teach-by-doing). When a bot finishes
          // a chop action on its own, we consider it taught. Simplified:
          // when player opens a bot teach menu and assigns a program.
          // We auto-complete when any bot has a non-idle program assigned
          // and has chopped at least one tree (tracked via treesChopped by bots).
          // For simplicity, complete when the player has taught any bot a program.
          if (q.quest4BotTaught) {
            completeQuest(4, null); // quest5_storage triggers on unpack
          }
          break;
        case 5:
          // Quest 5: unpack van (storage kit), player places it
          if (q.vanUnpackCount >= 3 && q.quest5StoragePlaced) {
            completeQuest(5, 'quest6_start');
          }
          break;
        case 6:
          // Quest 6: store 10 logs in the storage building
          if (q.logsStored >= 10) {
            completeQuest(6, 'quest6_complete');
          }
          break;
        case 7:
          // Quest 7: unpack van (shovel drops). Completed by unpacking.
          if (q.vanUnpackCount >= 4) {
            completeQuest(7, 'quest8_start');
          }
          break;
        case 8:
          // Quest 8: dig 5 holes and drop the shovel
          if (q.holesDug >= 5 && !this.player.inventory) {
            completeQuest(8, 'quest8_complete');
          }
          break;
        case 9:
          // Quest 9: plant 5 seeds (or at least as many holes as were dug)
          if (q.seedsPlanted >= 5) {
            completeQuest(9, 'quest9_complete');
          }
          break;
        // ═════════════════════════════════════════════════════════
        // Chapter II — Industry (Q10–Q15)
        // ═════════════════════════════════════════════════════════
        case 10:
          // Quest 10: unpack sawbench kit, place it, process a log
          if ((q.planksProduced || 0) >= 1) {
            completeQuest(10, 'quest10_complete');
          }
          break;
        case 11:
          // Quest 11: process planks into poles
          if ((q.polesProduced || 0) >= 1) {
            completeQuest(11, 'quest11_complete');
          }
          break;
        case 12:
          // Quest 12: unpack workbench kit, place it
          if (this.structures.some(s => s.type === 'workbench')) {
            completeQuest(12, 'quest12_complete');
          }
          break;
        case 13:
          // Quest 13: craft a crude_pickaxe at the workbench
          if (q.craftedPickaxe) {
            completeQuest(13, 'quest13_complete');
          }
          break;
        case 14:
          // Quest 14: mine stone (with pickaxe)
          if ((q.stoneMined || 0) >= 1) {
            completeQuest(14, 'quest14_complete');
          }
          break;
        case 15:
          // Quest 15: teach a bot a sawbench delivery loop
          if (q.botSawbenchLoop) {
            completeQuest(15, 'quest15_complete');
          }
          break;
        // ═════════════════════════════════════════════════════════
        // Chapter III — Automation at Scale (Q16–Q19)
        // ═════════════════════════════════════════════════════════
        case 16:
          // Quest 16: promote a bot with woodworking knowledge pack
          if (q.botHasWoodworking) {
            completeQuest(16, 'quest16_complete');
          }
          break;
        case 17:
          // Quest 17: 2+ bots with active programs
          if ((this.bots || []).filter(b => b.program && b.program !== 'idle').length >= 2) {
            completeQuest(17, 'quest17_complete');
          }
          break;
        case 18:
          // Quest 18: promote a bot to manager + delegation
          if (q.managerDelegationActive) {
            completeQuest(18, 'quest18_complete');
          }
          break;
        case 19:
          // Quest 19: build a factory and assemble a new bot
          if ((q.botsAssembled || 0) >= 1) {
            completeQuest(19, 'quest19_complete');
          }
          break;
        // ═════════════════════════════════════════════════════════
        // Chapter IV — Arms & Defense (Q20–Q25)
        // ═════════════════════════════════════════════════════════
        case 20:
          // Quest 20: place a smithery
          if (this.structures.some(s => s.type === 'smithery')) {
            completeQuest(20, 'quest20_complete');
          }
          break;
        case 21:
          // Quest 21: equip wooden_sword and wooden_shield
          if (q.playerEquippedSwordShield) {
            completeQuest(21, 'quest21_complete');
          }
          break;
        case 22:
          // Quest 22: survive first night
          if ((q.nightsSurvived || 0) >= 1) {
            completeQuest(22, 'quest22_survived');
          }
          break;
        case 23:
          // Quest 23: build a defense tower
          if (this.structures.some(s => s.type === 'defensetower')) {
            completeQuest(23, 'quest23_complete');
          }
          break;
        case 24:
          // Quest 24: bot with combat pack + aggressive mode
          if (q.combatBotAggressive) {
            completeQuest(24, 'quest24_complete');
          }
          break;
        case 25:
          // Quest 25: craft and equip bow + ammo
          if (q.playerEquippedBow) {
            completeQuest(25, 'quest25_complete');
          }
          break;
        // ═════════════════════════════════════════════════════════
        // Chapter V — The Garrison (Q26–Q29)
        // ═════════════════════════════════════════════════════════
        case 26:
          // Quest 26: teach a combat bot a patrol route
          if (q.botHasPatrolLoop) {
            completeQuest(26, 'quest26_complete');
          }
          break;
        case 27:
          // Quest 27: assign guard_area to a combat bot
          if (q.botOnGuardDuty) {
            completeQuest(27, 'quest27_complete');
          }
          break;
        case 28:
          // Quest 28: scale to 5+ bots with 2+ combat bots
          if ((this.bots || []).length >= 5 && (q.combatBots || 0) >= 2) {
            completeQuest(28, 'quest28_complete');
          }
          break;
        case 29:
          // Quest 29: survive the wave night with structures intact
          if ((q.nightsSurvived || 0) >= 2) {
            completeQuest(29, 'quest29_finale');
          }
          break;
      }
    },

    /**
     * Called when a bot program is assigned (teach-by-doing). Hook from teach system.
     */
    onBotProgramAssigned(bot) {
      if (!this.campaignQuest?.active) return;
      // Original Q4 tracking
      const q = this.campaignQuest;
      if (q.currentQuest === 4 && bot && bot.program && bot.program !== 'idle') {
        q.quest4BotTaught = true;
        this.checkCampaignQuest();
      }
      // Extended v2 tracking for Q10-Q29
      this.onBotProgramAssignedV2(bot);
    },

    /**
     * Called when a storage structure is deployed/placed.
     */
    onStoragePlaced() {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      if (q.currentQuest === 5) {
        q.quest5StoragePlaced = true;
        if (!q.completedQuests.includes(5)) this.queueDialogue('quest5_storage_placed');
        this.checkCampaignQuest();
      }
    },

    /**
     * Called when a structure finishes processing and produces output.
     * @param {string} recipe - what was produced (e.g. 'plank', 'pole', 'crude_pickaxe')
     */
    onItemProduced(recipe) {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      if (recipe === 'plank' && !q.completedQuests.includes(10)) {
        q.planksProduced = (q.planksProduced || 0) + 1;
        this.checkCampaignQuest();
      }
      if (recipe === 'pole' && !q.completedQuests.includes(11)) {
        q.polesProduced = (q.polesProduced || 0) + 1;
        this.checkCampaignQuest();
      }
      if (recipe === 'crude_pickaxe' && !q.completedQuests.includes(13)) {
        q.craftedPickaxe = true;
        this.checkCampaignQuest();
      }
      if (recipe === 'basic_bot' && !q.completedQuests.includes(19)) {
        q.botsAssembled = (q.botsAssembled || 0) + 1;
        this.checkCampaignQuest();
      }
    },

    /**
     * Called when the player mines stone from a deposit.
     */
    onStoneMined() {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      if (q.currentQuest === 14) {
        q.stoneMined = (q.stoneMined || 0) + 1;
        this.addFloat(`Stone mined: ${q.stoneMined}`, this.player.x, this.player.y - 48, '#9abf8f');
        this.checkCampaignQuest();
      }
    },

    /**
     * Called when any structure is placed via build menu or building kit deploy.
     * Checks quest conditions that require structure existence.
     */
    onStructurePlaced(type) {
      if (!this.campaignQuest?.active) return;
      this.checkCampaignQuest();
    },

    /**
     * Called when the day/night cycle transitions from night to day.
     */
    onNightSurvived() {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      q.nightsSurvived = (q.nightsSurvived || 0) + 1;
      // Check structure integrity for Q29 (wave night)
      if (q.currentQuest === 29) {
        const productionSurvived = this.structures.some(s =>
          ['sawbench', 'workbench', 'factory', 'smithery'].includes(s.type) && (s.hp ?? 1) > 0
        );
        if (!productionSurvived) {
          this.addFloat('A production building was destroyed!', this.player.x, this.player.y - 48, '#c86b5f');
        }
      }
      this.checkCampaignQuest();
    },

    /**
     * Called when a bot's knowledge packs change (promotion).
     */
    onBotKnowledgeChanged(bot) {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      const packs = bot?.knowledgePacks || bot?.managerKnowledgePacks || [];
      // Q16: bot with woodworking pack
      if (packs.includes('woodworking') && !q.botHasWoodworking) {
        q.botHasWoodworking = true;
        this.checkCampaignQuest();
      }
      // Q24: bot with combat pack + aggressive mode
      if (packs.includes('combat')) {
        q.combatBots = Math.max(q.combatBots || 0, this.bots.filter(b =>
          (b.knowledgePacks || b.managerKnowledgePacks || []).includes('combat')
        ).length);
        if (bot.combatMode === 'aggressive') {
          q.combatBotAggressive = true;
        }
        this.checkCampaignQuest();
      }
    },

    /**
     * Called when a bot is promoted to manager or delegation is used.
     */
    onManagerAction(bot) {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      if (bot?.managerKnowledgePacks?.length > 0) {
        // Check if any delegated task exists
        const hasDelegation = this.bots.some(b =>
          b.managerKnowledgePacks?.length > 0 && b.delegatedTasks?.length > 0
        );
        if (hasDelegation || bot.delegatedTasks?.length > 0) {
          q.managerDelegationActive = true;
          this.checkCampaignQuest();
        } else {
          // Manager exists but no delegation yet — prompt
          if (q.currentQuest === 18 && !q.managerExists) {
            q.managerExists = true;
            this.queueDialogue('quest18_manager_prompt');
          }
        }
      }
    },

    /**
     * Called when a bot program is assigned (covers taught loops and built-in templates).
     * Extended from original onBotProgramAssigned for Q15 and Q26/Q27.
     */
    onBotProgramAssignedV2(bot) {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;

      // Q4: any bot taught (original tutorial)
      if (q.currentQuest === 4 && bot && bot.program && bot.program !== 'idle') {
        q.quest4BotTaught = true;
      }

      // Q15: bot with sawbench delivery loop
      if (bot?.program === 'taught_loop' || bot?.taughtLoop) {
        const loopSteps = bot.taughtLoop || bot.programSteps || [];
        const hasSawbench = loopSteps.some(step =>
          step.op === 'deliver_to_sawbench' ||
          step.op === 'process_sawbench' ||
          (typeof step.op === 'string' && step.op.includes('sawbench'))
        );
        if (hasSawbench) {
          q.botSawbenchLoop = true;
        }

        // Q26: patrol route or attack in taught loop
        const hasPatrol = loopSteps.some(step =>
          step.op === 'patrol_route' || step.op === 'attack'
        );
        if (hasPatrol) {
          q.botHasPatrolLoop = true;
        }

        // Q27: guard_area assignment
        const hasGuard = loopSteps.some(step => step.op === 'guard_area');
        if (hasGuard) {
          q.botOnGuardDuty = true;
        }
      }

      // Also check DSL program steps
      if (bot?.programSteps) {
        const hasSawbench = bot.programSteps.some(step =>
          step.op === 'deliver_to_sawbench' || step.op === 'process_sawbench'
        );
        if (hasSawbench) q.botSawbenchLoop = true;

        const hasPatrol = bot.programSteps.some(step =>
          step.op === 'patrol_route' || step.op === 'attack'
        );
        if (hasPatrol) q.botHasPatrolLoop = true;

        const hasGuard = bot.programSteps.some(step => step.op === 'guard_area');
        if (hasGuard) q.botOnGuardDuty = true;
      }

      // Q17: multi-bot check
      // Q28: combat bot count
      const packs = bot?.knowledgePacks || bot?.managerKnowledgePacks || [];
      if (packs.includes('combat')) {
        q.combatBots = Math.max(q.combatBots || 0, this.bots.filter(b =>
          (b.knowledgePacks || b.managerKnowledgePacks || []).includes('combat')
        ).length);
      }

      this.checkCampaignQuest();
    },

    /**
     * Called when the player's equipment changes.
     */
    onPlayerEquipmentChanged() {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      const eq = this.player.equipment || {};
      const weapon = eq.weapon;
      const shield = eq.shield;
      const ammo = this.player.ammunition || 0;

      // Q21: sword + shield equipped
      if (weapon === 'wooden_sword' && shield === 'wooden_shield') {
        q.playerEquippedSwordShield = true;
      }
      // Q25: bow equipped with ammo
      if (weapon === 'bow' && ammo > 0) {
        q.playerEquippedBow = true;
      }
      this.checkCampaignQuest();
    }
  });
}
