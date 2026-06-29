// src/systems/health-system.js
// Player health mechanic: damage, death, respawn, passive regen.
// Part of the Game class composition root — installed via installHealthSystem(Game, deps).
//
// Dependencies (passed via deps):
//   PLAYER_MAX_HP, PLAYER_REGEN_DELAY_MS, PLAYER_REGEN_INTERVAL_MS, PLAYER_REGEN_AMOUNT,
//   CAMPAIGN_START (for respawn safe point), MONSTER_MELEE_ATTACK (monster damage).

import { clamp } from '../utils.js?v=grove_pixi_fixes_0628';

const MS_PER_SECOND = 1000;
const PLAYER_RESPAWN_INVULN_SECONDS = 3;

export function installHealthSystem(Game, deps) {
  const {
    PLAYER_MAX_HP,
    PLAYER_REGEN_DELAY_MS,
    PLAYER_REGEN_INTERVAL_MS,
    PLAYER_REGEN_AMOUNT,
    CAMPAIGN_START,
    MONSTER_MELEE_ATTACK
  } = deps;

  /** Returns the safe respawn point — campaign start if in campaign mode, otherwise map center. */
  function safeSpawnPoint(game) {
    if (game.gameMode === 'campaign' && CAMPAIGN_START) return { x: CAMPAIGN_START.x, y: CAMPAIGN_START.y };
    return { x: Math.round(game.map.width / 2), y: Math.round(game.map.height / 2) };
  }

  Object.assign(Game.prototype, {
    /**
     * Damage the local player by `amount`. Shows a floating damage text, resets regen timer,
     * and triggers death if hp <= 0. No-op if the player is already dead (hp <= 0).
     */
    damagePlayer(amount = 1) {
      const p = this.player;
      if (!p || (p.hp ?? 1) <= 0) return false;
      // Respawn invulnerability
      if (typeof p.invulnerableUntil === 'number' && (this.worldTime || 0) < p.invulnerableUntil) return false;
      p.hp = Math.max(0, (p.hp ?? PLAYER_MAX_HP) - amount);
      p.lastDamageTime = (this.worldTime || 0) * MS_PER_SECOND;
      this.addFloat(`Player -${amount} HP`, p.x, p.y - 30, '#c86b5f');
      this.emitSound('player_hurt', { cooldownKey: 'player_hurt', minGapMs: 150 });
      if (p.hp <= 0) this.triggerPlayerDeath();
      if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
      return true;
    },

    /**
     * Enter death state: set hp to 0, mark player dead, pause hostile monster aggression.
     * The player's position and movement are frozen by `updatePlayerHealth()` checking the dead flag.
     */
    triggerPlayerDeath() {
      const p = this.player;
      p.hp = 0;
      p.dead = true;
      p.target = null;
      p.targetQueue = [];
      // Pause hostile monsters so the player isn't attacked while in respawn screen
      for (const m of this.monsters) {
        if (m.hostile && (m.hp ?? 0) > 0 && m.autoAttack) {
          m.autoAttack.targetRef = null;
        }
      }
      this.addFloat('You were defeated', p.x, p.y - 45, '#fff4d0');
      this.emitSound('defeat', { cooldownKey: 'player_defeat', minGapMs: 9999 });
    },

    /**
     * Respawn the player: restore hp to max, clear dead state, teleport to safe spawn.
     */
    respawnPlayer() {
      const p = this.player;
      const spawn = safeSpawnPoint(this);
      p.hp = p.maxHp || PLAYER_MAX_HP;
      p.dead = false;
      p.lastDamageTime = -Infinity; // allow immediate regen
      p.regenTimer = 0;
      p.invulnerableUntil = (this.worldTime || 0) + PLAYER_RESPAWN_INVULN_SECONDS;
      p.x = spawn.x;
      p.y = spawn.y;
      p.target = null;
      p.targetQueue = [];
      this.addFloat('Respawned', spawn.x, spawn.y - 30, '#9abf8f');
      if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
    },

    /**
     * Called every update tick. Handles:
     * - Player death freeze (skip movement logic)
     * - Hostile monster damage to the player on contact (mirrors updateActorAutoAttack pattern)
     * - Passive HP regeneration after regen delay
     */
    updatePlayerHealth(dt) {
      const p = this.player;
      if (!p) return;

      // ── Death freeze ──────────────────────────────────────────────
      // If the player is dead, we skip all combat/regen logic; the UI/overlay
      // handles respawn. The main updatePlayer() still runs but updatePlayer
      // is gated so it won't move a dead player (see world.js wiring).
      if (p.dead) return;

      // ── Hit-based damage (#5) ─────────────────────────────────────
      // Monsters now deal damage through the combat system: updateActorAutoAttack
      // (called from updateMonster) finds hostile targets, checks attack range,
      // waits for cooldown, and calls damageAttackTarget which routes player
      // damage through this.damagePlayer(). No more contact/proximity damage —
      // a monster must be in attack range AND its cooldown must be ready.

      // ── Passive HP regeneration ───────────────────────────────────
      if ((p.hp ?? 0) >= (p.maxHp || PLAYER_MAX_HP)) {
        p.regenTimer = 0;
        return;
      }
      const nowMs = (this.worldTime || 0) * MS_PER_SECOND;
      const lastDamage = p.lastDamageTime ?? -Infinity;
      if (nowMs - lastDamage < PLAYER_REGEN_DELAY_MS) {
        p.regenTimer = 0;
        return;
      }
      p.regenTimer = (p.regenTimer || 0) + dt * MS_PER_SECOND;
      if (p.regenTimer >= PLAYER_REGEN_INTERVAL_MS) {
        p.regenTimer -= PLAYER_REGEN_INTERVAL_MS;
        const before = p.hp;
        p.hp = Math.min(p.maxHp || PLAYER_MAX_HP, (p.hp || 0) + PLAYER_REGEN_AMOUNT);
        if (p.hp > before) {
          this.addFloat(`+${p.hp - before} HP`, p.x, p.y - 42, '#9abf8f');
          if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
        }
      }
    },

    /** Whether the player is currently in the dead/respawn-pending state. */
    isPlayerDead() {
      return !!(this.player && this.player.dead);
    }
  });
}
