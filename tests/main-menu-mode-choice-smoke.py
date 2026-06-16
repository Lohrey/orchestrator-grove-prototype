#!/usr/bin/env python3
"""Smoke-check main menu separates Local vs AI from Online Multiplayer."""
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_f62dde4d-main-menu-mode-choice.png"

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
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(f"http://127.0.0.1:{port}/index.html?t=t_f62dde4d_menu")
            page.wait_for_function("() => window.getGameState && !document.getElementById('mainMenuOverlay').hidden")
            assert page.locator("#mainMenuLocalAiBtn").inner_text() == "Local vs AI"
            assert "online" in page.locator("#mainMenuHostBtn").inner_text().lower()
            page.locator("#mainMenuLocalAiBtn").click()
            page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
            assert "Local vs AI" in page.locator("#mainMenuStartSelectedBtn").inner_text()
            page.locator("#mainMenuStartSelectedBtn").click()
            page.wait_for_function("() => window.getGameState().multiplayer.mapMode === 'local_ai'")
            state = page.evaluate("window.getGameState()")
            assert len(state["multiplayer"]["thrones"]) == 2, state["multiplayer"]
            assert len(state["multiplayer"]["towers"]) == 6, state["multiplayer"]
            page.screenshot(path=str(SCREENSHOT), full_page=True)
            browser.close()
    finally:
        server.shutdown()

print("main menu mode choice smoke passed")
