#!/usr/bin/env python3
"""Smoke-check characteristic icons and explanatory copy on build-menu buttons."""

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
SCREENSHOT = ROOT / "build-menu-icons-smoke.png"
BASE_URL = os.environ.get("BASE_URL", "").rstrip("/") or os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
EXPECTED = {
    "sawbench": {"icon": "🪚", "label": "Sawbench", "hint": "Open timber saw table", "aria": "Place Sawbench"},
    "workbench": {"icon": "🪓", "label": "Tool Bench", "hint": "Angled tool canopy", "aria": "Place Tool Bench"},
    "factory": {"icon": "🤖", "label": "Bot Factory", "hint": "Two-stack robot works", "aria": "Place Bot Factory"},
    "portable_3d_printer": {"icon": "🖨️", "label": "3D Printer", "hint": "Field fabrication frame", "aria": "Place Portable 3D Printer"},
    "assembler": {"icon": "🦾", "label": "Assembler", "hint": "Robotic arm workcell", "aria": "Place Portable Assembler"},
    "item_palette": {"icon": "📦", "label": "Item Palette", "hint": "Open resource crate", "aria": "Place Item Palette"},
    "power_station": {"icon": "🔋", "label": "Power Station", "hint": "Portable battery bank", "aria": "Place Power Station"},
    "robotics_parts_bin": {"icon": "⚙️", "label": "Parts Bin", "hint": "DIY robotics parts", "aria": "Place DIY Robotics Parts Bin"},
    "camper_van": {"icon": "🚐", "label": "White Camper", "hint": "Home on wheels", "aria": "Place Simple White Camper Van"},
    "hammock_camp": {"icon": "🏕️", "label": "Hammock Camp", "hint": "Rest between two poles", "aria": "Place Hammock Camp"},
    "ultrabook_desk": {"icon": "💻", "label": "Ultrabook Desk", "hint": "Remote work setup", "aria": "Place Ultrabook Field Desk"},
    "solar_array": {"icon": "☀️", "label": "Solar Panels", "hint": "Fold-out charging array", "aria": "Place Fold-Out Solar Panels"},
    "smithery": {"icon": "⚔️", "label": "Smithery", "hint": "Stone forge & anvil", "aria": "Place Smithery"},
    "bowmaker": {"icon": "🏹", "label": "Bowmaker", "hint": "Arched bow hut", "aria": "Place Bowmaker"},
    "arrowmaker": {"icon": "🪶", "label": "Arrowmaker", "hint": "Fletching shed", "aria": "Place Arrowmaker"},
    "defensetower": {"icon": "🛡️", "label": "Defense Tower", "hint": "Tall guard tower", "aria": "Place Defense Tower"},
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return

def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 820})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.gameMenuDebug && window.uiDebug")
        page.evaluate("() => { window.gameMenuDebug.closeMainMenu(); window.uiDebug.setChatOpen(false); }")
        page.click("#buildDrawerToggle")
        page.wait_for_selector("#buildPanel")

        tabs = {
            "production": ["sawbench", "workbench", "factory", "portable_3d_printer", "assembler"],
            "storage": ["item_palette", "power_station", "robotics_parts_bin"],
            "camp": ["camper_van", "hammock_camp", "ultrabook_desk", "solar_array"],
            "military": ["smithery", "bowmaker", "arrowmaker", "defensetower"],
        }
        for tab, keys in tabs.items():
            page.click(f"[data-build-tab='{tab}']")
            for key in keys:
                button = page.locator(f"[data-build='{key}']")
                assert button.is_visible(), key
                assert button.get_attribute("aria-label") == EXPECTED[key]["aria"], key
                assert button.locator(".build-icon").inner_text().strip() == EXPECTED[key]["icon"], key
                assert button.locator(".build-copy b").inner_text().strip() == EXPECTED[key]["label"], key
                assert button.locator(".build-copy small").inner_text().strip() == EXPECTED[key]["hint"], key

        page.click("[data-build-tab='production']")
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        page.click("[data-build='sawbench'] .build-icon")
        page.wait_for_function("() => window.getGameState && window.getGameState().placementType === 'sawbench'")

        assert not errors, errors
        browser.close()

if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html")
else:
    Handler = functools.partial(QuietHandler, directory=str(ROOT))
    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html")
        finally:
            httpd.shutdown()
            with contextlib.suppress(Exception):
                thread.join(timeout=1)
print("build menu icons smoke passed")
