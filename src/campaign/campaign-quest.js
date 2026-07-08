// src/campaign/campaign-quest.js
// Campaign quest state machine: van unpack progression gate, quest completion checker,
// and hooks for bot-program-assigned / storage-placed events.
// Part of the Game class composition root — installed via installCampaignQuestSystem(Game, deps).
//
// Dependencies (passed via deps):
//   distXY, rand, itemLabel.

import { distXY } from '../utils.js';
import { rand } from '../utils.js';

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
      // Unpack 0 → Quest 1: crude_axe
      // Unpack 1 → Quest 3: bot
      // Unpack 2 → Quest 5: item_palette_kit (storage building kit)
      // Unpack 3 → Quest 7: crude_shovel
      const unpackMapping = [
        { quest: 1, type: 'item', item: 'crude_axe', dialogue: 'quest1_axe_dropped' },
        { quest: 3, type: 'bot', dialogue: 'quest3_bot_dropped' },
        { quest: 5, type: 'item', item: 'item_palette_kit', dialogue: 'quest5_storage_dropped' },
        { quest: 7, type: 'item', item: 'crude_shovel', dialogue: 'quest7_shovel_dropped' },
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
        if (q.currentQuest > 9) {
          q.active = false;
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
      }
    },

    /**
     * Called when a bot program is assigned (teach-by-doing). Hook from teach system.
     */
    onBotProgramAssigned(bot) {
      if (!this.campaignQuest?.active) return;
      const q = this.campaignQuest;
      if (q.currentQuest === 4 && bot && bot.program && bot.program !== 'idle') {
        q.quest4BotTaught = true;
        this.checkCampaignQuest();
      }
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
    }
  });
}
