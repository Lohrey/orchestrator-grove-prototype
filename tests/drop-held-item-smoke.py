#!/usr/bin/env python3
"""Smoke/regression check that Q drops the held item without a TypeError."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from contextlib import nullcontext
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def right_click_world(page, world_x: float, world_y: float) -> None:
    page.evaluate(
        """
        ([worldX, worldY]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX, clientY }));
        }
        """,
        [world_x, world_y],
    )


def crude_shovel_count(page) -> int:
    return page.evaluate("window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'crude_shovel').length")


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.teachDebug && window.uiDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        assert page.evaluate("typeof window.teachDebug.dropHeld") == "function"
        initial_shovels = crude_shovel_count(page)
        assert initial_shovels >= 1, page.evaluate("window.getGameState().stores")
        shovel = page.evaluate("window.getWorldObjects().find(o => o.kind === 'item' && o.type === 'crude_shovel')")
        assert shovel, "expected a crude shovel item in the world"

        right_click_world(page, shovel["x"], shovel["y"])
        page.wait_for_function(
            "([x, y]) => { const p = window.getGameState().player; return Math.hypot(p.x - x, p.y - y) < 38; }",
            arg=[shovel["x"], shovel["y"]],
            timeout=8000,
        )
        page.keyboard.press("E")
        page.wait_for_function("window.getGameState().player.inventory?.type === 'crude_shovel'", timeout=2000)
        assert crude_shovel_count(page) == initial_shovels - 1

        page.keyboard.press("Q")
        page.wait_for_function("window.getGameState().player.inventory === null", timeout=2000)
        assert crude_shovel_count(page) == initial_shovels

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

print("drop held item smoke passed")
