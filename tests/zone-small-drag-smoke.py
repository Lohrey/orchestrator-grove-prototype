#!/usr/bin/env python3
"""Smoke/regression check for small drawn zones and left-drag zone movement."""

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
SCREENSHOT = ROOT / "t_2939a3b6-zone-small-drag-smoke.png"


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
        page.wait_for_function("() => window.getGameState && window.getCameraState && window.uiDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        page.click("#zonesDrawerToggle")
        page.click("#drawZoneDrawerButton")
        dispatch_world_mouse(page, "mousedown", 200, 220)
        dispatch_world_mouse(page, "mousemove", 209, 231)
        dispatch_world_mouse(page, "mouseup", 209, 231)
        page.wait_for_function("() => window.getGameState().zones.length === 1")
        dispatch_world_mouse(page, "click", 209, 231)

        small = page.evaluate("() => window.getGameState().zones[0]")
        assert 8 <= small["w"] <= 10 and 10 <= small["h"] <= 12, small
        assert small["x"] == 200 and small["y"] == 220, small

        dispatch_world_mouse(page, "mousedown", 204, 225)
        dispatch_world_mouse(page, "mousemove", 284, 285)
        dispatch_world_mouse(page, "mouseup", 284, 285)
        page.wait_for_function("() => window.getGameState().zones[0].x >= 279 && window.getGameState().zones[0].y >= 279")
        moved = page.evaluate("() => window.getGameState().zones[0]")
        assert 279 <= moved["x"] <= 281 and 280 <= moved["y"] <= 281, moved
        assert moved["w"] == small["w"] and moved["h"] == small["h"], (small, moved)

        dispatch_world_mouse(page, "click", moved["x"] + 3, moved["y"] + 3)
        page.wait_for_timeout(100)
        assert page.evaluate("() => document.getElementById('structureMenu').hidden") is True

        dispatch_world_mouse(page, "click", moved["x"] + 3, moved["y"] + 3)
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden")
        menu_text = page.locator("#structureMenu").inner_text()
        assert "zone 1" in menu_text and "Add rectangle coords" in menu_text, menu_text

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_2939a3b6")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_2939a3b6")
        finally:
            server.shutdown()

print("zone small/drag smoke passed")
