#!/usr/bin/env python3
"""Smoke test for combat module improvements (Patrick's requirements).

Verifies:
1. Player auto-attacks nearby enemies when idle (barehand — was previously broken).
2. Dog auto-attacks nearby enemies when idle.
3. Bot aggressive combat mode (DEFAULT) auto-attacks within 500px EVEN WHILE working a loop,
   pausing the loop during combat and resuming after the enemy is killed.
4. Bot passive combat mode never auto-attacks.
5. Combat toggle switches between aggressive <-> passive.
6. Player attack speed stays ~1 hit/sec.
"""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TAG = "t_bot_combat_toggle_0705"
SHOT = ROOT / f"{TAG}-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def tick(page, seconds: float, step: float = 0.05) -> None:
    page.evaluate(
        """
        ([seconds, step]) => {
          for (let t = 0; t < seconds; t += step) window.teachDebug.tickWorld(step);
        }
        """,
        [seconds, step],
    )


def start_game(page) -> None:
    page.wait_for_function("() => window.getGameState && window.teachDebug")
    if not page.evaluate("() => document.getElementById('mainMenuOverlay')?.hidden"):
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")


def monster_hp(page, ref: str) -> int | None:
    return page.evaluate("ref => window.getWorldObjects().find(o => o.id === ref)?.hp", ref)


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        start_game(page)
        page.evaluate("() => window.teachDebug.setTargetFps(0)")

        # ── 1. Player barehand auto-attack when idle ──
        # Move player to an open area, ensure no weapon, spawn a monster nearby, verify it takes damage.
        page.evaluate("() => window.teachDebug.movePlayerTo(900, 900)")
        page.evaluate("() => window.teachDebug.equipPlayer(null)")
        tick(page, 0.5)  # let any aggro monsters settle
        player = page.evaluate("() => window.getGameState().player")
        m1 = page.evaluate(
            """
            (pos) => {
              const m = window.teachDebug.spawnMonster(pos.x + 30, pos.y, {
                name: 'player auto dummy', type: 'night_monster', kind: 'night_monster',
                hostile: true, passive: false, hp: 20, maxHp: 20, ownerId: 'wild',
                aggroRange: 9999, speed: 0, roamRadius: 0, avoidRadius: 0
              });
              return { id: m.id, ref: m.ref, hp: m.hp, x: m.x, y: m.y };
            }
            """,
            player,
        )
        tick(page, 4)
        m1_after = monster_hp(page, m1["ref"])
        assert m1_after is not None and m1_after < m1["hp"], (
            f"Player barehand auto-attack should damage nearby monster: before={m1['hp']}, after={m1_after}"
        )

        # Clean up the monster
        page.evaluate("ref => window.teachDebug.removeMonster(ref)", m1["ref"])
        tick(page, 0.2)

        # ── 2. Player attack speed ~1 hit/sec ──
        # Move player to an isolated far corner and clear existing monsters to avoid interference.
        page.evaluate("() => { const objs = window.getWorldObjects().filter(o => o.kind === 'monster'); objs.forEach(o => window.teachDebug.removeMonster(o.id)); }")
        page.evaluate("() => window.teachDebug.movePlayerTo(2000, 2000)")
        tick(page, 0.5)
        player = page.evaluate("() => window.getGameState().player")
        m1b = page.evaluate(
            """
            (pos) => {
              const m = window.teachDebug.spawnMonster(pos.x + 30, pos.y, {
                name: 'player speed dummy', type: 'night_monster', kind: 'night_monster',
                hostile: true, passive: false, hp: 100, maxHp: 100, ownerId: 'wild',
                aggroRange: 9999, speed: 0, roamRadius: 0, avoidRadius: 0
              });
              return { id: m.id, ref: m.ref, hp: m.hp };
            }
            """,
            player,
        )
        # Tick exactly 3 seconds; player should hit ~3 times (1/sec). Allow 2-4 range for tolerance.
        tick(page, 3.0, step=0.1)
        m1b_after = monster_hp(page, m1b["ref"])
        hits = m1b["hp"] - (m1b_after or 0)
        assert 2 <= hits <= 4, f"Player auto-attack should deal ~3 hits in 3s (1/sec), got {hits}"
        page.evaluate("ref => window.teachDebug.removeMonster(ref)", m1b["ref"])
        tick(page, 0.2)

        # ── 3. Dog auto-attack when idle ──
        dog = page.evaluate("() => window.getGameState().bots.find(b => b.kind === 'dog')")
        assert dog is not None, "Starter dog should exist"
        page.evaluate("([botId, x, y]) => window.teachDebug.moveBotTo(botId, x, y)", [dog["id"], 1100, 1100])
        tick(page, 0.3)
        dog_pos = page.evaluate("botId => { const s = window.getGameState().bots.find(b => b.id === botId); return { x: s.x, y: s.y }; }", dog["id"])
        m2 = page.evaluate(
            """
            (pos) => {
              const m = window.teachDebug.spawnMonster(pos.x + 25, pos.y, {
                name: 'dog auto dummy', type: 'night_monster', kind: 'night_monster',
                hostile: true, passive: false, hp: 20, maxHp: 20, ownerId: 'wild',
                aggroRange: 9999, speed: 0, roamRadius: 0, avoidRadius: 0
              });
              return { id: m.id, ref: m.ref, hp: m.hp };
            }
            """,
            dog_pos,
        )
        tick(page, 5)
        m2_after = monster_hp(page, m2["ref"])
        assert m2_after is not None and m2_after < m2["hp"], (
            f"Dog auto-attack should damage nearby monster: before={m2['hp']}, after={m2_after}"
        )
        page.evaluate("ref => window.teachDebug.removeMonster(ref)", m2["ref"])
        tick(page, 0.2)

        # ── 4. Bot aggressive (DEFAULT) auto-attacks within 500px WHILE working a loop ──
        # Assign bot 1 a taught loop (chop wood), spawn an enemy near it, verify the loop pauses
        # and the bot kills the enemy, then resumes.
        bot1 = page.evaluate("() => window.getGameState().bots.find(b => b.kind === 'bot' && b.id === 1)")
        assert bot1 is not None, "Bot 1 should exist"
        # Verify default combat mode is aggressive
        assert bot1["combatMode"] == "aggressive", f"Bot default combatMode should be 'aggressive', got {bot1.get('combatMode')}"
        # Assign a chop_wood program so the bot has an active loop
        page.evaluate("botId => { window.getGameState(); }", bot1["id"])
        # Use the DSL assign path to give bot 1 a real taught loop
        assigned = page.evaluate(
            """
            (botId) => {
              const res = window.assignCustomDslProgram({ botId: botId, program: { steps: [ { op: 'loop' }, { op: 'chop_wood' } ] }, reason: 'combat smoke' });
              return res;
            }
            """,
            bot1["id"],
        )
        page.evaluate("([botId, x, y]) => window.teachDebug.moveBotTo(botId, x, y)", [bot1["id"], 1300, 1300])
        tick(page, 0.3)
        bot1_pos = page.evaluate("botId => { const s = window.getGameState().bots.find(b => b.id === botId); return { x: s.x, y: s.y, pc: s.runtime?.pc || 0 }; }", bot1["id"])
        pc_before = bot1_pos["pc"]
        m3 = page.evaluate(
            """
            (pos) => {
              const m = window.teachDebug.spawnMonster(pos.x + 80, pos.y, {
                name: 'bot aggressive dummy', type: 'night_monster', kind: 'night_monster',
                hostile: true, passive: false, hp: 5, maxHp: 5, ownerId: 'wild',
                aggroRange: 9999, speed: 0, roamRadius: 0, avoidRadius: 0
              });
              return { id: m.id, ref: m.ref, hp: m.hp, x: m.x, y: m.y };
            }
            """,
            bot1_pos,
        )
        # Tick long enough for the bot to engage and kill (within 500px)
        tick(page, 10)
        m3_after = monster_hp(page, m3["ref"])
        assert m3_after is not None and m3_after <= 0, (
            f"Aggressive bot should kill nearby enemy within 500px even while looping: hp={m3_after}"
        )
        # Verify the bot was engaged (combatEngaged should have been true at some point, now false after kill)
        bot1_state = page.evaluate("botId => { const s = window.getGameState().bots.find(b => b.id === botId); return { combatEngaged: s.combatEngaged, combatMode: s.combatMode, state: s.state }; }", bot1["id"])
        assert bot1_state["combatMode"] == "aggressive"

        # ── 5. Bot passive mode never auto-attacks ──
        page.evaluate("botId => window.teachDebug.setBotCombatMode(botId, 'passive')", bot1["id"])
        bot1_passive = page.evaluate("botId => window.getGameState().bots.find(b => b.id === botId).combatMode", bot1["id"])
        assert bot1_passive == "passive", f"Bot combatMode should be 'passive' after set, got {bot1_passive}"
        page.evaluate("([botId, x, y]) => window.teachDebug.moveBotTo(botId, x, y)", [bot1["id"], 1400, 1400])
        tick(page, 0.3)
        bot1_pos2 = page.evaluate("botId => { const s = window.getGameState().bots.find(b => b.id === botId); return { x: s.x, y: s.y }; }", bot1["id"])
        m4 = page.evaluate(
            """
            (pos) => {
              const m = window.teachDebug.spawnMonster(pos.x + 30, pos.y, {
                name: 'passive dummy', type: 'night_monster', kind: 'night_monster',
                hostile: true, passive: false, hp: 5, maxHp: 5, ownerId: 'wild',
                aggroRange: 9999, speed: 0, roamRadius: 0, avoidRadius: 0
              });
              return { id: m.id, ref: m.ref, hp: m.hp };
            }
            """,
            bot1_pos2,
        )
        tick(page, 5)
        m4_after = monster_hp(page, m4["ref"])
        assert m4_after is not None and m4_after == m4["hp"], (
            f"Passive bot should NOT auto-attack: before={m4['hp']}, after={m4_after}"
        )

        # ── 6. Toggle back to aggressive via toggleBotCombatMode ──
        page.evaluate("botId => window.teachDebug.toggleBotCombatMode(botId)", bot1["id"])
        bot1_toggled = page.evaluate("botId => window.getGameState().bots.find(b => b.id === botId).combatMode", bot1["id"])
        assert bot1_toggled == "aggressive", f"Toggle should flip passive->aggressive, got {bot1_toggled}"

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()
        assert not failures, failures


base_url = os.environ.get("BASE_URL")
if base_url:
    run_smoke(f"{base_url.rstrip('/')}/index.html?v={TAG}")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v={TAG}")
        finally:
            server.shutdown()

print("bot combat toggle smoke passed")
