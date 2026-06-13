#!/usr/bin/env python3
"""Smoke/regression check for left-click building context menus and recipe info."""

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
SCREENSHOT = ROOT / "building-left-click-menu-smoke.png"


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


def assert_menu_contains(page, structure_type: str, expected_recipe: str, expected_info: str) -> None:
    structure = page.evaluate(
        "type => window.getWorldObjects().find(o => o.kind === 'structure' && o.type === type)",
        structure_type,
    )
    assert structure, f"expected structure type {structure_type}"
    left_click_world(page, structure["x"], structure["y"])
    page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
    menu_text = page.locator("#structureMenu").inner_text()
    assert structure["name"] in menu_text, menu_text
    assert "Info:" in menu_text, menu_text
    assert expected_info in menu_text, menu_text
    assert "Recipe:" in menu_text, menu_text
    assert expected_recipe in menu_text, menu_text


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        assert_menu_contains(page, "sawbench", "1 log → 2 planks; 1 plank → 2 wood poles.", "Processes wood into construction parts.")
        assert_menu_contains(page, "workbench", "1 stick + 1 stone → 1 selected crude tool. Current: crude axe.", "Crafts crude tools from basic materials.")
        assert_menu_contains(page, "factory", "1 log + 3 planks + 1 pole + 1 tree seed → 1 Basic Bot.", "Assembles new Basic Bots when stocked.")

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

print("building left-click menu smoke passed")
