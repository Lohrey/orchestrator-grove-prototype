#!/usr/bin/env python3
"""Smoke-check story-kit placeable buildings, story objects, and distinctive building visuals."""

from __future__ import annotations

import contextlib
import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "t_bdae19d0-story-buildings-visual-smoke.png"

NEW_BUILDINGS = {
    "camper_van": "Simple White Camper Van",
    "hammock_camp": "Hammock Camp",
    "ultrabook_desk": "Ultrabook Field Desk",
    "solar_array": "Fold-Out Solar Panels",
    "power_station": "Power Station",
    "portable_3d_printer": "Portable 3D Printer",
    "assembler": "Portable Assembler",
    "robotics_parts_bin": "DIY Robotics Parts Bin",
}
STORY_ITEMS = {
    "hammock",
    "ultrabook",
    "solar_panel",
    "power_station",
    "portable_3d_printer",
    "assembler",
    "robotics_parts",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return


def wait_for_paint(page) -> None:
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")


def run(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 960})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug && window.teachDebug && window.uiDebug")
        page.evaluate("() => { window.gameMenuDebug.startCampaign(); document.getElementById('campaignIntroSkipBtn')?.click(); window.uiDebug.setChatOpen(false); }")
        page.wait_for_function("() => window.getGameState().gameMode === 'campaign'")

        state = page.evaluate("() => window.getGameState()")
        objects = page.evaluate("() => window.getWorldObjects()")
        structures = state["structures"]
        items = [obj for obj in objects if obj.get("kind") == "item"]
        for key, label in NEW_BUILDINGS.items():
            matches = [s for s in structures if s["type"] == key]
            assert matches, f"missing campaign structure {key}"
            assert matches[0]["label"] == label, matches[0]
        item_types = {item["type"] for item in items}
        missing_items = STORY_ITEMS - item_types
        assert not missing_items, missing_items

        # Build drawer exposes every new placeable building.
        page.evaluate("() => window.uiDebug.setBuildDrawerOpen(true)")
        for key in NEW_BUILDINGS:
            tab = page.locator(f"[data-build='{key}']")
            assert tab.count() == 1, key
        page.evaluate("() => window.uiDebug.setBuildDrawerOpen(false)")

        # Place a grid of all new buildings in test mode; screenshot gives visual evidence
        # that they render as distinct silhouettes, not one reused house shell.
        page.evaluate("() => { window.gameMenuDebug.startTest(); window.gameMenuDebug.closeMainMenu(); window.uiDebug.setChatOpen(false); }")
        coords = [
            (760, 430), (910, 430), (1060, 430), (1210, 430),
            (760, 560), (910, 560), (1060, 560), (1210, 560),
        ]
        for (key, (x, y)) in zip(NEW_BUILDINGS, coords):
            placed = page.evaluate("({ key, x, y }) => window.teachDebug.placeStructure(key, x, y)", {"key": key, "x": x, "y": y})
            assert placed and placed["type"] == key, placed
        page.evaluate("() => { const s = window.getCameraState(); s.camera.x = 560; s.camera.y = 270; }")
        wait_for_paint(page)
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        assert not errors, errors
        browser.close()


if BASE_URL:
    run(f"{BASE_URL}/index.html?v=t_bdae19d0")
else:
    Handler = functools.partial(QuietHandler, directory=str(ROOT))
    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            run(f"http://127.0.0.1:{port}/index.html?v=t_bdae19d0")
        finally:
            httpd.shutdown()
            with contextlib.suppress(Exception):
                thread.join(timeout=1)

print("story buildings visual smoke passed")
