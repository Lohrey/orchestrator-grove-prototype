#!/usr/bin/env python3
"""Smoke/regression check for equipment slots and player attack mechanics."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "equipment-combat-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def dispatch_world_mouse(page, event_type: str, world_x: float, world_y: float, button: int = 0) -> None:
    page.evaluate(
        """
        ([eventType, worldX, worldY, button]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, button, clientX, clientY }));
        }
        """,
        [event_type, world_x, world_y, button],
    )


def right_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "contextmenu", world_x, world_y, 2)


def tick_world(page, seconds: float, slices: int = 1) -> None:
    for _ in range(slices):
        page.evaluate("seconds => window.teachDebug.tickWorld(seconds)", seconds / slices)


def hp(page, ref: str) -> int:
    return page.evaluate("ref => window.getWorldObjects().find(o => o.id === ref)?.hp", ref)


def count_loose(page, item_type: str) -> int:
    return page.evaluate("type => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === type).length", item_type)


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug && window.getWorldObjects")
        page.evaluate("() => window.gameMenuDebug?.startNew?.()")
        page.evaluate("() => window.teachDebug.setTargetFps(0)")
        page.evaluate("() => window.teachDebug.movePlayerTo(520, 520)")

        page.evaluate("() => window.teachDebug.setInventory('log')")
        page.evaluate("() => window.teachDebug.spawnItem('wooden_sword', 520, 520, 1)")
        page.evaluate("() => window.teachDebug.pickupNearest('wooden_sword')")
        state = page.evaluate("() => window.getGameState().player")
        assert state["inventory"]["type"] == "log", "equipping sword must not displace normal carried item"
        assert state["equipment"]["weapon"] == "wooden_sword"

        page.evaluate("() => window.teachDebug.spawnItem('wooden_shield', 520, 520, 1)")
        page.evaluate("() => window.teachDebug.pickupNearest('wooden_shield')")
        state = page.evaluate("() => window.getGameState().player")
        assert state["inventory"]["type"] == "log"
        assert state["equipment"]["weapon"] == "wooden_sword" and state["equipment"]["shield"] == "wooden_shield"

        page.evaluate("() => window.teachDebug.spawnItem('bow', 520, 520, 1)")
        page.evaluate("() => window.teachDebug.pickupNearest('bow')")
        state = page.evaluate("() => window.getGameState().player")
        assert state["inventory"]["type"] == "log", "bow equipment must not displace normal carried item"
        assert state["equipment"]["weapon"] == "bow"
        assert state["equipment"]["shield"] is None
        sets = state["equipment"]["weaponSets"]
        assert len(sets) == 2 and sets[0] == {"id": "melee_1", "weapon": "wooden_sword", "shield": "wooden_shield"}
        assert sets[1] == {"id": "bow_2", "weapon": "bow", "shield": None}

        page.evaluate("() => window.teachDebug.switchWeapon()")
        state = page.evaluate("() => window.getGameState().player")
        assert state["equipment"]["weapon"] == "wooden_sword" and state["equipment"]["shield"] == "wooden_shield", "F should switch back to primary pickup-order weapon set"
        page.evaluate("() => window.teachDebug.setInventory(null)")
        page.evaluate("() => window.teachDebug.spawnItem('wooden_sword', 520, 520, 1)")
        page.evaluate("() => window.teachDebug.pickupNearest('wooden_sword')")
        state = page.evaluate("() => window.getGameState().player")
        assert state["inventory"]["type"] == "wooden_sword", "full weapon slots should carry extra weaponry as the one held item"

        page.evaluate("() => window.teachDebug.dropHeld()")
        state = page.evaluate("() => window.getGameState().player")
        assert state["inventory"] is None and state["equipment"]["shield"] == "wooden_shield"
        page.evaluate("() => window.teachDebug.dropHeld()")
        state = page.evaluate("() => window.getGameState().player")
        assert state["equipment"]["weapon"] == "wooden_sword" and state["equipment"]["shield"] is None, "Q should drop shield before sword"
        page.evaluate("() => window.teachDebug.dropHeld()")
        state = page.evaluate("() => window.getGameState().player")
        assert state["equipment"]["weapon"] == "bow", "Q should drop sword then switch to remaining bow set"

        page.evaluate("() => window.teachDebug.setInventory(null)")
        page.evaluate("() => window.teachDebug.equipPlayer(null)")
        bare = page.evaluate("() => window.teachDebug.spawnMonster(550, 520, { name: 'barehand dummy', hp: 3, maxHp: 3, speed: 0, roamRadius: 0, avoidRadius: 0 })")
        right_click_world(page, bare["x"], bare["y"])
        tick_world(page, 0.4, slices=8)
        assert hp(page, bare["ref"]) == 2, "barehand right-click attack should deal 1 HP"

        page.evaluate("() => window.teachDebug.equipPlayer('wooden_sword')")
        sword = page.evaluate("() => window.teachDebug.spawnMonster(565, 520, { name: 'sword dummy', hp: 3, maxHp: 3, speed: 0, roamRadius: 0, avoidRadius: 0 })")
        right_click_world(page, sword["x"], sword["y"])
        tick_world(page, 0.4, slices=8)
        assert hp(page, sword["ref"]) == 1, "wooden sword right-click attack should deal 2 HP"

        page.evaluate("() => window.teachDebug.equipPlayer('bow')")
        bow = page.evaluate("() => window.teachDebug.spawnMonster(620, 520, { name: 'bow dummy', hp: 3, maxHp: 3, speed: 0, roamRadius: 0, avoidRadius: 0 })")
        right_click_world(page, bow["x"], bow["y"])
        tick_world(page, 0.45, slices=12)
        assert hp(page, bow["ref"]) == 2, "bow right-click attack should shoot one 1 HP arrow"

        bot = page.evaluate("() => { const s = window.getGameState(); return s.bots[0]; }")
        page.evaluate("botId => window.teachDebug.setBotEquipment(botId, 'wooden_sword')", bot["id"])
        bot_state = page.evaluate("botId => window.getGameState().bots.find(b => b.id === botId)", bot["id"])
        assert bot_state["equipment"]["weapon"] == "wooden_sword", "bots should expose equipment slots too"

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_2c2293dd")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_2c2293dd")
        finally:
            server.shutdown()

print("equipment combat smoke passed")
