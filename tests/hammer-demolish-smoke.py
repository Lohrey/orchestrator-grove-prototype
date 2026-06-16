#!/usr/bin/env python3
"""Smoke/regression check for crude hammer crafting and placed-building demolition."""

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
SCREENSHOT = ROOT / "t_39abb68c-hammer-demolish-smoke.png"


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


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        if page.locator("#mainMenuOverlay:not([hidden])").count():
            page.click("#mainMenuNewBtn")
            page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
            page.click("#mainMenuStartSelectedBtn")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.teachDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        workbench = page.evaluate("() => window.getWorldObjects().find(o => o.kind === 'structure' && o.type === 'workbench')")
        assert workbench, "expected starting tool bench"
        page.evaluate(
            """
            ([structureId]) => {
              window.teachDebug.setWorkbenchRecipe(structureId, 'crude_hammer');
              window.teachDebug.setInventory('stick');
              if (!window.teachDebug.depositToStructure(structureId)) return false;
              window.teachDebug.setInventory('stone');
              if (!window.teachDebug.depositToStructure(structureId)) return false;
              window.teachDebug.tickProduction(2);
              return true;
            }
            """,
            [workbench["numericId"]],
        )
        page.wait_for_function("() => window.getGameState().objectRegistry.some(o => o.kind === 'item' && o.type === 'crude_hammer')")

        placed = page.evaluate("() => window.teachDebug.placeStructure('sawbench', 860, 520)")
        assert placed["placed"] is True, placed
        initial_count = page.evaluate("() => window.getGameState().structures.length")

        # Starting structures are not player-placed and must not be removed by the hammer.
        page.evaluate("window.teachDebug.setInventory('crude_hammer')")
        page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x, y)", [workbench["x"], workbench["y"]])
        page.keyboard.press("KeyE")
        after_initial_attempt = page.evaluate("() => window.getGameState().structures.length")
        assert after_initial_attempt == initial_count, (initial_count, after_initial_attempt)

        # A placed structure is demolished via right-click/queued target with the hammer.
        page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x - 80, y)", [placed["x"], placed["y"]])
        dispatch_world_mouse(page, "contextmenu", placed["x"], placed["y"], 2)
        for _ in range(80):
            page.evaluate("window.teachDebug.tickPlayer(1 / 30)")
        page.wait_for_function("([id]) => !window.getGameState().structures.some(s => s.id === id)", arg=[placed["id"]], timeout=3000)
        final_count = page.evaluate("() => window.getGameState().structures.length")
        assert final_count == initial_count - 1, (initial_count, final_count)

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_39abb68c")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_39abb68c")
        finally:
            server.shutdown()

print("hammer demolish smoke passed")
