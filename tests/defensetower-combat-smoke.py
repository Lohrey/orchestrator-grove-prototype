#!/usr/bin/env python3
"""Smoke/regression check for Defense Tower ranged combat mechanics."""

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
SCREENSHOT = ROOT / "defensetower-combat-smoke.png"


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


def left_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "click", world_x, world_y, 0)


def tick(page, seconds: float, slices: int = 1) -> None:
    for _ in range(slices):
        page.evaluate("seconds => window.teachDebug.tickWorld(seconds)", seconds / slices)


def monster_hp(page, ref: str) -> int:
    return page.evaluate("ref => window.getWorldObjects().find(o => o.id === ref)?.hp", ref)


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.teachDebug")
        page.evaluate("() => window.teachDebug.setTargetFps(0)")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); window.uiDebug.setBuildDrawerOpen(true); window.uiDebug.setBuildTab('military'); document.activeElement?.blur(); }")

        assert page.locator('[data-build-tab="military"][aria-selected="true"]').count() == 1
        assert page.locator('[data-build-category="military"].is-active [data-build="defensetower"]').count() == 1

        tower = page.evaluate("() => window.teachDebug.placeStructure('defensetower', 1000, 1000)")
        assert tower["type"] == "defensetower"
        assert tower["name"] == "defense tower 2" or tower["name"] == "defense tower 1"
        assert tower["rangedAttack"]["damage"] == 1
        assert tower["rangedAttack"]["cooldown"] == 1
        assert tower["rangedAttack"]["range"] == 260

        target = page.evaluate(
            "() => window.teachDebug.spawnMonster(1080, 1000, { name: 'target dummy', hp: 5, maxHp: 5, speed: 0, roamRadius: 0, avoidRadius: 0 })"
        )
        far_target = page.evaluate(
            "() => window.teachDebug.spawnMonster(1420, 1000, { name: 'far dummy', hp: 5, maxHp: 5, speed: 0, roamRadius: 0, avoidRadius: 0 })"
        )

        tick(page, 0.15, slices=3)
        assert monster_hp(page, target["ref"]) == 4, "first arrow should hit for exactly 1 HP"
        assert monster_hp(page, far_target["ref"]) == 5, "out-of-range monster should not be damaged"

        tick(page, 0.7, slices=7)
        assert monster_hp(page, target["ref"]) == 4, "tower should not fire more than once per second"

        tick(page, 0.4, slices=4)
        assert monster_hp(page, target["ref"]) == 3, "second arrow should land after the 1s cooldown"

        left_click_world(page, tower["x"], tower["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
        menu_text = page.locator("#structureMenu").inner_text()
        assert "Defense Tower" in menu_text, menu_text
        assert "range 260" in menu_text, menu_text
        assert "damage 1" in menu_text, menu_text
        assert "1 arrow per second" in menu_text, menu_text

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_7384ba5d")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_7384ba5d")
        finally:
            server.shutdown()

print("defensetower combat smoke passed")
