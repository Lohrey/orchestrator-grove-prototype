#!/usr/bin/env python3
"""Smoke test Pixi renderer seam and Svelte overlay bridge."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_pixi_worker_wasm-architecture.png"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html?renderer=pixi&simWorker=1"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(url, wait_until="networkidle")
            page.wait_for_function("() => window.getGameState && window.orchestratorUiBridge && window.simWorkerDebug")
            page.wait_for_function("() => document.querySelector('.grove-architecture-badge')")
            backend = page.evaluate("() => window.getGameState().rendererBackend || window.orchestratorUiBridge.getRendererLabel()")
            label = page.evaluate("() => window.orchestratorUiBridge.getRendererLabel()")
            assert "PixiJS" in label or "Canvas 2D" in label, label
            ping = page.evaluate("() => window.simWorkerDebug.ping()")
            assert ping["backend"] == "rust-wasm", ping
            text = page.locator(".grove-architecture-badge").inner_text()
            assert "GROVE ARCHITECTURE" in text.upper(), text
            assert "worker" in text.lower(), text
            page.screenshot(path=str(SCREENSHOT), full_page=True)
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()

print(f"architecture overlay smoke passed; screenshot={SCREENSHOT}")
