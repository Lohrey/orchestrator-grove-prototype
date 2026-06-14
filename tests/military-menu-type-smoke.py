#!/usr/bin/env python3
"""Regression check: military building menus show type "military", not the internal building id."""

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
SCREENSHOT = ROOT / "t_2d8a05eb-military-menu-type-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def open_structure_menu(page, structure_type: str) -> str:
    structure = page.evaluate(
        "type => window.getWorldObjects().find(o => o.kind === 'structure' && o.type === type)",
        structure_type,
    )
    if not structure:
        structure = page.evaluate(
            "type => window.teachDebug.placeStructure(type, 420, 320)",
            structure_type,
        )
    assert structure, f"expected structure type {structure_type}"
    page.evaluate(
        """
        ([worldX, worldY]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX, clientY }));
        }
        """,
        [structure["x"], structure["y"]],
    )
    page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
    return page.locator("#structureMenu").inner_text()


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.teachDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); window.gameMenuDebug.closeMainMenu(); document.activeElement?.blur(); }")

        for structure_type in ["smithery", "bowmaker", "defensetower", "throne"]:
            menu_text = open_structure_menu(page, structure_type)
            assert "type military" in menu_text, menu_text
            assert f"type {structure_type}" not in menu_text, menu_text

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_2d8a05eb")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_2d8a05eb")
        finally:
            server.shutdown()

print("military menu type smoke passed")
