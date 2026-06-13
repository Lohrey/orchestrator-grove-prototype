#!/usr/bin/env python3
"""Smoke checks that worlds start without built-in zones and player-created zones still work."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def dispatch_world_mouse(page, event_type: str, world_x: float, world_y: float, button: int = 0) -> None:
    page.evaluate(
        """
        ([eventType, worldX, worldY, button]) => {
          const c = document.getElementById('game');
          const s = window.getCameraState();
          const rect = c.getBoundingClientRect();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, button, clientX, clientY }));
        }
        """,
        [event_type, world_x, world_y, button],
    )


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState")

        state = page.evaluate("window.getGameState()")
        assert state["zones"] == [], state["zones"]
        registry_zones = page.evaluate("window.getWorldObjects().filter(o => o.kind === 'zone')")
        assert registry_zones == [], registry_zones

        page.click("#drawZoneButton")
        dispatch_world_mouse(page, "mousedown", 200, 220)
        dispatch_world_mouse(page, "mousemove", 360, 340)
        dispatch_world_mouse(page, "mouseup", 360, 340)
        page.wait_for_function("() => window.getGameState().zones.length === 1")

        zone = page.evaluate("window.getGameState().zones[0]")
        assert zone["id"] == "zone:1", zone
        assert zone["name"] == "zone 1", zone
        assert zone["kind"] == "rect", zone
        assert zone.get("builtIn") in (None, False), zone
        assert page.locator("#chatInput").input_value().startswith("rect("), page.locator("#chatInput").input_value()

        assigned = page.evaluate("window.assignBotProgram({ botId: 1, program: 'dig_holes', zoneId: 'zone:1' })")
        assert assigned["ok"] is True, assigned
        bot = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 1)
        assert bot["zoneId"] == "zone:1", bot

        browser.close()

    server.shutdown()

print("start zones smoke passed")
