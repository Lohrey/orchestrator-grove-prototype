#!/usr/bin/env python3
"""Smoke test for player health mechanic: damage, death, respawn, regen.

Uses teachDebug.damagePlayer / respawnPlayer for deterministic control.
Verifies:
1. damagePlayer reduces HP and triggers death at 0.
2. Respawn restores HP and clears dead flag.
3. Passive regen recovers HP after delay.
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
TAG = "t_health_system_0628"
SHOT = ROOT / f"{TAG}-health-mechanic-smoke.png"


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


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(url, wait_until="networkidle")
        start_game(page)

        # ── 1. Verify initial full HP ──
        state = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        max_hp = state["maxHp"]
        assert state["hp"] == max_hp, f"Player should start at full HP: {state}"
        assert state["dead"] is False, f"Player should not be dead: {state}"

        # ── 2. Damage player and verify HP drops ──
        state = page.evaluate("() => window.teachDebug.damagePlayer(3)")
        hp1 = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert hp1["hp"] == max_hp - 3, f"Player should have {max_hp - 3} HP after 3 damage: {hp1}"
        assert hp1["dead"] is False, f"Player should not be dead yet: {hp1}"

        # ── 3. Kill the player ──
        state = page.evaluate(f"() => window.teachDebug.damagePlayer({max_hp})")
        hp2 = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert hp2["hp"] == 0, f"Player HP should be 0: {hp2}"
        assert hp2["dead"] is True, f"Player should be dead: {hp2}"

        # ── 4. Damage while dead is a no-op ──
        page.evaluate("() => window.teachDebug.damagePlayer(5)")
        hp3 = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert hp3["dead"] is True and hp3["hp"] == 0, f"Dead player should not take more damage: {hp3}"

        # ── 5. Respawn ──
        page.evaluate("() => window.teachDebug.respawnPlayer()")
        hp4 = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert hp4["dead"] is False, f"Player should not be dead after respawn: {hp4}"
        assert hp4["hp"] == max_hp, f"Player should have full HP after respawn: {hp4}"

        # ── 6. Passive regen: damage, wait past delay, verify HP recovers ──
        # Move player to a remote corner to avoid monster interference
        page.evaluate("() => window.teachDebug.movePlayerTo(100, 100)")
        tick(page, 0.5)  # let any aggro monsters lose track
        page.evaluate("() => window.teachDebug.damagePlayer(2)")
        before_regen = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert before_regen["hp"] == max_hp - 2, f"HP should be {max_hp - 2}: {before_regen}"

        # Tick 15s (past the 10s delay + at least one 3s regen interval)
        tick(page, 15)
        after_regen = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert after_regen["hp"] > before_regen["hp"], (
            f"HP should have regenerated: before={before_regen}, after={after_regen}"
        )

        # Tick much more to verify full recovery
        tick(page, 30)
        fully_healed = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert fully_healed["hp"] == max_hp, f"HP should be fully regenerated: {fully_healed}"

        # ── 7. Hostile monster deals damage ──
        player_pos = page.evaluate("() => ({ x: window.getGameState().player.x, y: window.getGameState().player.y })")
        before_monster = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        page.evaluate(
            """
            (pos) => {
              const m = window.teachDebug.spawnMonster(pos.x + 25, pos.y, {
                name: 'hostile smoke monster',
                type: 'night_monster',
                kind: 'night_monster',
                hostile: true, passive: false,
                hp: 999, maxHp: 999, ownerId: 'wild', aggroRange: 500,
                roamRadius: 5, avoidRadius: 5
              });
              m.homeX = pos.x + 25;
              m.homeY = pos.y;
              m.wanderTarget = { x: pos.x, y: pos.y };
            }
            """,
            player_pos,
        )
        tick(page, 5)
        after_monster = page.evaluate("() => window.teachDebug.getPlayerHealthState()")
        assert after_monster["hp"] < before_monster["hp"], (
            f"Monster should have damaged player: before={before_monster}, after={after_monster}"
        )

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()


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

print("player health mechanic smoke passed")
