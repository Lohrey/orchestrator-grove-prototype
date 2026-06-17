#!/usr/bin/env python3
"""Smoke test Rust/WASM simulation worker integration."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html?renderer=canvas2d&simWorker=1"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(url, wait_until="networkidle")
            page.wait_for_function("() => window.simWorkerDebug && window.getWorldObjects")
            ping = page.evaluate("() => window.simWorkerDebug.ping()")
            assert ping["backend"] == "rust-wasm", ping
            assert ping["version"] == 1, ping
            fixture = page.evaluate(
                """
                () => window.simWorkerDebug.client.nearestItem([
                  { id: 'item:1', numericId: 1, type: 'log', x: 10, y: 10 },
                  { id: 'item:2', numericId: 2, type: 'plank', x: 11, y: 10 },
                  { id: 'item:3', numericId: 3, type: 'log', x: 80, y: 80 }
                ], { type: 'log', x: 12, y: 10 })
                """
            )
            assert fixture["id"] == "item:1" and fixture["backend"] == "rust-wasm", fixture
            live = page.evaluate("() => window.simWorkerDebug.nearestLiveItem('log')")
            assert live is None or live.get("backend") == "rust-wasm", live
            path = page.evaluate("() => window.simWorkerDebug.pathfind(100, 120, 10, 20)")
            assert path["waypoints"][-1] == {"x": 100, "y": 120}, path
            chunk = page.evaluate("() => window.simWorkerDebug.chunkForPoint(511, 513, 256)")
            assert chunk["key"] == "1:2" and chunk["backend"] == "rust-wasm", chunk
            tick = page.evaluate("() => window.simWorkerDebug.botTick(0, 0, 10, 0, 0.5, 10, 1)")
            assert round(tick["x"], 2) == 5 and round(tick["y"], 2) == 0 and tick["backend"] == "rust-wasm", tick
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()

print("sim worker Rust/WASM smoke passed")
