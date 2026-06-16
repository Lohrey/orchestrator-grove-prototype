#!/usr/bin/env python3
"""Smoke/regression check for tool bench output selector buttons."""

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
SCREENSHOT = ROOT / "toolbench-selector-smoke.png"

TOOL_CASES = [
    ("crude_axe", "crude axe"),
    ("crude_pickaxe", "crude pickaxe"),
    ("crude_shovel", "crude shovel"),
    ("crude_hammer", "crude hammer"),
]


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


def produce_selected_tool(page, workbench_id: int, tool_type: str) -> None:
    ok = page.evaluate(
        """
        ([structureId, recipe]) => {
          window.teachDebug.setWorkbenchRecipe(structureId, recipe);
          window.teachDebug.setInventory('stick');
          if (!window.teachDebug.depositToStructure(structureId)) return false;
          window.teachDebug.setInventory('stone');
          if (!window.teachDebug.depositToStructure(structureId)) return false;
          window.teachDebug.tickProduction(0);
          window.teachDebug.tickProduction(2);
          return window.getGameState().objectRegistry.some(o => o.kind === 'item' && o.type === recipe);
        }
        """,
        [workbench_id, tool_type],
    )
    assert ok, f"expected produced loose {tool_type}"


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
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.teachDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        workbench = page.evaluate("() => window.getWorldObjects().find(o => o.kind === 'structure' && o.type === 'workbench')")
        assert workbench, "expected a starting tool bench"
        left_click_world(page, workbench["x"], workbench["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)

        menu = page.locator("#structureMenu")
        menu_text = menu.inner_text()
        assert "Produce:" in menu_text, menu_text
        for tool_type, _label in TOOL_CASES:
            assert menu.locator(f"button[data-select-tool='{tool_type}']").count() == 1, menu_text

        for tool_type, label in TOOL_CASES:
            left_click_world(page, workbench["x"], workbench["y"])
            page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
            menu.locator(f"button[data-select-tool='{tool_type}']").click()
            page.wait_for_function(
                "([recipe]) => window.getGameState().structures.find(s => s.type === 'workbench').workbenchRecipe === recipe",
                arg=[tool_type],
                timeout=2000,
            )
            menu_text = menu.inner_text()
            assert f"Current: {label}" in menu_text, menu_text
            assert "1 stick + 1 stone" in menu_text, menu_text
            produce_selected_tool(page, workbench["numericId"], tool_type)

        left_click_world(page, workbench["x"], workbench["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
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

print("toolbench selector smoke passed")
