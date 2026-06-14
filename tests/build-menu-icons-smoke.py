#!/usr/bin/env python3
"""Smoke-check characteristic icons and explanatory copy on build-menu buttons."""

from __future__ import annotations

import contextlib
import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "build-menu-icons-smoke.png"
EXPECTED = {
    "sawbench": {"icon": "🪚", "label": "Sawbench", "hint": "Logs → planks"},
    "workbench": {"icon": "🪓", "label": "Tool Bench", "hint": "Craft axes/tools"},
    "factory": {"icon": "🤖", "label": "Bot Factory", "hint": "Assemble bots"},
    "item_palette": {"icon": "📦", "label": "Item Palette", "hint": "Store resources"},
    "smithery": {"icon": "⚔️", "label": "Smithery", "hint": "Swords & shields"},
    "bowmaker": {"icon": "🏹", "label": "Bowmaker", "hint": "Craft ranged bows"},
    "defensetower": {"icon": "🛡️", "label": "Defense Tower", "hint": "Guards the base"},
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return


Handler = functools.partial(QuietHandler, directory=str(ROOT))
with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 820})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.click("#buildDrawerToggle")
        page.wait_for_selector("#buildPanel")

        tabs = {"production": ["sawbench", "workbench", "factory"], "storage": ["item_palette"], "military": ["smithery", "bowmaker", "defensetower"]}
        for tab, keys in tabs.items():
            page.click(f"[data-build-tab='{tab}']")
            for key in keys:
                button = page.locator(f"[data-build='{key}']")
                assert button.is_visible(), key
                assert button.get_attribute("aria-label") == f"Place {EXPECTED[key]['label']}", key
                assert button.locator(".build-icon").inner_text().strip() == EXPECTED[key]["icon"], key
                assert button.locator(".build-copy b").inner_text().strip() == EXPECTED[key]["label"], key
                assert button.locator(".build-copy small").inner_text().strip() == EXPECTED[key]["hint"], key

        # Capture evidence with the icon buttons visible before selection closes the drawer.
        page.click("[data-build-tab='production']")
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        # Nested icon clicks must still select the building via event delegation.
        page.click("[data-build='sawbench'] .build-icon")
        page.wait_for_function("() => window.getGameState && window.getGameState().placementType === 'sawbench'")

        assert not errors, errors
        browser.close()

    httpd.shutdown()
    with contextlib.suppress(Exception):
        thread.join(timeout=1)

print("build menu icons smoke passed")
