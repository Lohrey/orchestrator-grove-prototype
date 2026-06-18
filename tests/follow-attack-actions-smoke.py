#!/usr/bin/env python3
"""Smoke checks for follow + attack DSL actions and moving nearby zones."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from math import hypot
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TAG = "t_follow_attack_0617"
SHOT = ROOT / f"{TAG}-follow-attack-local.png"


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


def distance(a: dict, b: dict) -> float:
    return hypot(a["x"] - b["x"], a["y"] - b["y"])


def start_game(page) -> None:
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.generateAssistantDsl")
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

        page.evaluate("window.setAssistantLoadout(['starter_automation', 'combat'])")
        debug = page.evaluate("window.getAssistantLoadoutDebug()")
        assert "follow" in debug["unlockedOps"] and "attack" in debug["unlockedOps"], debug
        assert page.evaluate("() => window.allowedProgramOps.includes('follow') && window.allowedProgramOps.includes('attack')")
        assert page.evaluate("() => window.actionStepChainRows.some(r => r.op === 'follow') && window.actionStepChainRows.some(r => r.op === 'attack')")

        follow_parsed = page.evaluate("window.generateAssistantDsl('Bot 1 and Bot 2 follow me')")
        follow_assignments = follow_parsed.get("dslAssignments") or []
        assert [a["botId"] for a in follow_assignments] == [1, 2], follow_parsed
        assert all(a["program"]["steps"][0]["op"] == "follow" for a in follow_assignments), follow_parsed
        assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", follow_assignments[0])
        assert assigned["ok"] is True, assigned

        before = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        page.evaluate("() => window.teachDebug.movePlayerTo(560, 560)")
        player = page.evaluate("() => window.getGameState().player")
        initial_distance = distance(before, player)
        tick(page, 4)
        after = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        assert distance(after, player) < initial_distance - 80, {"before": before, "after": after, "player": player}
        assert after["taughtLoop"][0]["targetRef"] == "player:local", after

        attack_parsed = page.evaluate("window.generateAssistantDsl('Bot 3 attack nearby monsters radius 500')")
        attack_assignment = (attack_parsed.get("dslAssignments") or [])[0]
        attack_step = attack_assignment["program"]["steps"][0]
        assert attack_step["op"] == "attack" and attack_step["zone"]["kind"] == "nearby" and attack_step["radius"] == 500, attack_assignment
        bot3 = page.evaluate("() => window.getGameState().bots.find(b => b.id === 3)")
        monster = page.evaluate(
            """
            ([x, y]) => {
              const m = window.teachDebug.spawnMonster(x, y, { name: 'nearby smoke monster', type: 'night_monster', kind: 'night_monster', hostile: true, passive: false, hp: 3, maxHp: 3, ownerId: 'wild' });
              return { id: m.id, ref: m.ref, hp: m.hp, x: m.x, y: m.y };
            }
            """,
            [bot3["x"] + 170, bot3["y"]],
        )
        assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", attack_assignment)
        assert assigned["ok"] is True, assigned
        assigned_bot3 = page.evaluate("() => window.getGameState().bots.find(b => b.id === 3)")
        assert assigned_bot3["taughtLoop"][0]["zoneSpec"]["kind"] == "nearby", assigned_bot3
        assert assigned_bot3["taughtLoop"][0]["zoneSpec"]["radius"] == 500, assigned_bot3

        tick(page, 7)
        objects = page.evaluate("window.getWorldObjects()")
        monster_after = next(obj for obj in objects if obj.get("id") == monster["ref"])
        bot3_after = page.evaluate("() => window.getGameState().bots.find(b => b.id === 3)")
        assert monster_after["hp"] <= 0, {"monsterBefore": monster, "monsterAfter": monster_after, "bot3": bot3_after}
        assert distance(bot3_after, monster_after) < 110, {"monsterAfter": monster_after, "bot3": bot3_after}

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

print("follow/attack action smoke passed")
