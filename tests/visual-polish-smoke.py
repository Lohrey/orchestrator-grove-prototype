#!/usr/bin/env python3
"""Smoke check for the t_8ab80257 visual polish pass."""

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
SCREENSHOT = Path(os.environ.get("ORCHESTRATOR_GROVE_SCREENSHOT", ROOT / "t_8ab80257-visual-polish-local.png"))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def run(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 960})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.uiDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); window.uiDebug.setBotDrawerOpen(true); window.uiDebug.setBuildDrawerOpen(true); }")
        page.wait_for_timeout(350)
        version = page.locator(".version").first.inner_text()
        assert version in ("v8", "v9"), version
        pixel_stats = page.evaluate(
            """
            () => {
              const canvas = document.getElementById('game');
              const ctx = canvas.getContext('2d');
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              const colors = new Set();
              let bright = 0;
              for (let i = 0; i < data.length; i += 4 * 173) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                colors.add(`${r>>4},${g>>4},${b>>4}`);
                if (r + g + b > 430) bright += 1;
              }
              return { uniqueBuckets: colors.size, bright };
            }
            """
        )
        assert pixel_stats["uniqueBuckets"] > 24, pixel_stats
        assert pixel_stats["bright"] > 3, pixel_stats
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run(f"{BASE_URL}/index.html?v=t_0e5e4767")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run(f"http://127.0.0.1:{port}/index.html?v=t_0e5e4767")
        finally:
            server.shutdown()

print(f"visual polish smoke passed: {SCREENSHOT}")
