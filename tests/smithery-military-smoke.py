#!/usr/bin/env python3
"""Smoke/regression check for the Military build tab and Smithery production modes."""

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
SCREENSHOT = ROOT / "smithery-military-smoke.png"


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


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.teachDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); window.uiDebug.setBuildDrawerOpen(true); window.uiDebug.setBuildTab('military'); document.activeElement?.blur(); }")

        assert page.locator('[data-build-tab="military"][aria-selected="true"]').count() == 1
        assert page.locator('[data-build-category="military"].is-active [data-build="smithery"]').count() == 1

        smithery = page.evaluate("() => window.getWorldObjects().find(o => o.kind === 'structure' && o.type === 'smithery')")
        assert smithery, "expected a starting smithery"
        assert smithery["name"] == "smithery 1"
        assert smithery["smitheryRecipe"] == "wooden_sword"

        left_click_world(page, smithery["x"], smithery["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
        menu = page.locator("#structureMenu")
        menu_text = menu.inner_text()
        assert "Smithery" in menu_text, menu_text
        assert "Production mode:" in menu_text, menu_text
        assert "wooden sword" in menu_text, menu_text
        assert "1 stick" in menu_text, menu_text
        assert menu.locator("button[data-switch-smithery]").count() == 1

        sword_ok = page.evaluate(
            """
            ([structureId]) => {
              window.teachDebug.setInventory('stick');
              if (!window.teachDebug.depositToStructure(structureId)) return false;
              window.teachDebug.tickProduction(0);
              window.teachDebug.tickProduction(2);
              return window.getGameState().objectRegistry.some(o => o.kind === 'item' && o.type === 'wooden_sword');
            }
            """,
            [smithery["numericId"]],
        )
        assert sword_ok, "expected stick -> wooden sword production"

        left_click_world(page, smithery["x"], smithery["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
        menu.locator("button[data-switch-smithery]").click()
        page.wait_for_function(
            "() => window.getGameState().structures.find(s => s.type === 'smithery').smitheryRecipe === 'wooden_shield'",
            timeout=2000,
        )
        menu_text = menu.inner_text()
        assert "wooden shield" in menu_text, menu_text
        assert "1 plank" in menu_text, menu_text

        shield_ok = page.evaluate(
            """
            ([structureId]) => {
              window.teachDebug.setInventory('plank');
              if (!window.teachDebug.depositToStructure(structureId)) return false;
              window.teachDebug.tickProduction(0);
              window.teachDebug.tickProduction(2);
              return window.getGameState().objectRegistry.some(o => o.kind === 'item' && o.type === 'wooden_shield');
            }
            """,
            [smithery["numericId"]],
        )
        assert shield_ok, "expected plank -> wooden shield production"

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html")
        finally:
            server.shutdown()

print("smithery military smoke passed")
