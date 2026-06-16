#!/usr/bin/env python3
"""Smoke-check polished publishing arrival/main menu visuals and menu SFX hooks."""
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_3ef6c5ab-main-menu-polish.png"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1366, "height": 820})
            page.goto(f"http://127.0.0.1:{port}/index.html?t=t_3ef6c5ab_menu_polish")
            page.wait_for_function("() => window.getGameState && !document.getElementById('mainMenuOverlay').hidden")

            assert page.locator(".main-menu-cinema .menu-mote").count() == 3
            assert page.locator(".main-menu-hero .main-menu-sigil").count() == 1
            assert page.locator(".main-menu-feature-row span").count() == 3
            assert page.locator(".main-menu-release-badge").inner_text().lower() == "publishing build · cozy automation"
            assert page.locator("#mainMenuLocalAiBtn").inner_text() == "Local vs AI"

            card_box = page.locator(".main-menu-card").bounding_box()
            hero_box = page.locator(".main-menu-hero").bounding_box()
            assert card_box and card_box["width"] > 780, card_box
            assert hero_box and hero_box["height"] > 300, hero_box

            audio_state = page.evaluate("() => window.audioDebug.state()")
            assert "groovesalad" in audio_state["stations"]
            assert page.evaluate("() => window.audioDebug.play('menu_arrive')") is True
            assert page.evaluate("() => window.audioDebug.play('menu_confirm')") is True

            page.locator("#mainMenuCampaignBtn").click()
            page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
            assert "Campaign mode" in page.locator("#mainMenuStartSelectedBtn").inner_text()
            page.screenshot(path=str(SCREENSHOT), full_page=True)
            browser.close()
    finally:
        server.shutdown()

print("main menu audiovisual polish smoke passed")
