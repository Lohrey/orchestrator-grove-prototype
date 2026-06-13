#!/usr/bin/env python3
"""Smoke/regression check for zone drawer, left-click zone menus, rename, and hide."""

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
SCREENSHOT = ROOT / "zones-drawer-menu-smoke.png"


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
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.uiDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        boxes = page.evaluate(
            """
            () => ['botDrawerToggle', 'buildDrawerToggle', 'zonesDrawerToggle'].map(id => {
              const r = document.getElementById(id).getBoundingClientRect();
              return { id, left: r.left, right: r.right, top: r.top, width: r.width };
            })
            """
        )
        assert all(box["right"] > 1235 and box["width"] == 43 for box in boxes), boxes
        assert boxes[0]["top"] < boxes[1]["top"] < boxes[2]["top"], boxes

        page.click("#zonesDrawerToggle")
        page.click("#drawZoneDrawerButton")
        dispatch_world_mouse(page, "mousedown", 200, 220)
        dispatch_world_mouse(page, "mousemove", 360, 340)
        dispatch_world_mouse(page, "mouseup", 360, 340)
        page.wait_for_function("() => window.getGameState().zones.length === 1")

        page.click("#zonesDrawerToggle")
        page.wait_for_selector("[data-zone-id='zone:1']")
        page.once("dialog", lambda dialog: dialog.accept("yard"))
        page.click("[data-rename-zone='zone:1']", no_wait_after=True)
        page.wait_for_function("() => window.getGameState().zones[0].name === 'yard'")

        page.click("[data-toggle-zone-hidden='zone:1']")
        page.wait_for_function("() => window.getGameState().zones[0].hidden === true")
        assert page.evaluate("() => window.getWorldObjects().find(o => o.id === 'zone:1').hidden") is True
        page.click("[data-toggle-zone-hidden='zone:1']")
        page.wait_for_function("() => window.getGameState().zones[0].hidden === false")

        dispatch_world_mouse(page, "click", 280, 280, 0)
        dispatch_world_mouse(page, "click", 280, 280, 0)
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden")
        menu_text = page.locator("#structureMenu").inner_text()
        assert "yard" in menu_text and "Rename" in menu_text and "Hide zone" in menu_text, menu_text

        page.evaluate("() => window.getGameState && document.getElementById('structureMenu').setAttribute('hidden', '')")
        dispatch_world_mouse(page, "contextmenu", 280, 280, 2)
        page.wait_for_timeout(100)
        assert page.evaluate("() => document.getElementById('structureMenu').hidden") is True

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

print("zones drawer/menu smoke passed")
