#!/usr/bin/env python3
"""Smoke/regression check for rectangle and radius zone resize handles."""

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
SCREENSHOT = ROOT / "t_39abb68c-zone-resize-smoke.png"


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
        page.wait_for_function("() => window.getGameState && window.getCameraState && window.uiDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        # Rectangle: draw, resize the southeast handle, and verify the origin stays stable.
        page.click("#zonesDrawerToggle")
        page.click("#drawZoneDrawerButton")
        dispatch_world_mouse(page, "mousedown", 300, 260)
        dispatch_world_mouse(page, "mousemove", 380, 320)
        dispatch_world_mouse(page, "mouseup", 380, 320)
        page.wait_for_function("() => window.getGameState().zones.length === 1")
        rect_before = page.evaluate("() => window.getGameState().zones[0]")
        dispatch_world_mouse(page, "mousedown", rect_before["x"] + rect_before["w"], rect_before["y"] + rect_before["h"])
        dispatch_world_mouse(page, "mousemove", rect_before["x"] + rect_before["w"] + 55, rect_before["y"] + rect_before["h"] + 45)
        dispatch_world_mouse(page, "mouseup", rect_before["x"] + rect_before["w"] + 55, rect_before["y"] + rect_before["h"] + 45)
        rect_after = page.evaluate("() => window.getGameState().zones[0]")
        assert rect_after["x"] == rect_before["x"] and rect_after["y"] == rect_before["y"], (rect_before, rect_after)
        assert rect_after["w"] > rect_before["w"] + 40 and rect_after["h"] > rect_before["h"] + 30, (rect_before, rect_after)

        # Radius: use teach-location radius drawing to create a persisted radius zone, drag it, then resize its edge handle.
        page.evaluate("window.teachDebug.start(1)")
        page.evaluate("window.teachDebug.setInventory('log')")
        page.evaluate("window.teachDebug.movePlayerTo(760, 520)")
        page.keyboard.press("KeyQ")
        page.evaluate("window.teachDebug.editStepLocation(0, 'draw_radius')")
        dispatch_world_mouse(page, "mousedown", 520, 450)
        dispatch_world_mouse(page, "mousemove", 610, 450)
        dispatch_world_mouse(page, "mouseup", 610, 450)
        page.wait_for_function("() => window.getGameState().zones.some(z => z.kind === 'radius')")
        radius_before = page.evaluate("() => window.getGameState().zones.find(z => z.kind === 'radius')")
        dispatch_world_mouse(page, "mousedown", radius_before["x"], radius_before["y"])
        dispatch_world_mouse(page, "mousemove", radius_before["x"] + 70, radius_before["y"] + 35)
        dispatch_world_mouse(page, "mouseup", radius_before["x"] + 70, radius_before["y"] + 35)
        radius_moved = page.evaluate("() => window.getGameState().zones.find(z => z.kind === 'radius')")
        assert abs(radius_moved["x"] - (radius_before["x"] + 70)) <= 2, (radius_before, radius_moved)
        assert abs(radius_moved["y"] - (radius_before["y"] + 35)) <= 2, (radius_before, radius_moved)
        assert radius_moved["radius"] == radius_before["radius"], (radius_before, radius_moved)
        assert all(isinstance(radius_moved[k], (int, float)) for k in ["x", "y", "radius"]), radius_moved
        dispatch_world_mouse(page, "mousedown", radius_moved["x"] + radius_moved["radius"], radius_moved["y"])
        dispatch_world_mouse(page, "mousemove", radius_moved["x"] + radius_moved["radius"] + 60, radius_moved["y"])
        dispatch_world_mouse(page, "mouseup", radius_moved["x"] + radius_moved["radius"] + 60, radius_moved["y"])
        radius_resized = page.evaluate("() => window.getGameState().zones.find(z => z.kind === 'radius')")
        assert radius_resized["radius"] > radius_moved["radius"] + 45, (radius_moved, radius_resized)

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

print("zone resize smoke passed")
