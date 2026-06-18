#!/usr/bin/env python3
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
    url = f"http://127.0.0.1:{port}/index.html?v=t_9f2729b2"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(url)
        page.wait_for_function("() => window.getCameraState && window.teachDebug")
        page.evaluate("() => { if (window.gameMenuDebug?.isPaused?.()) window.gameMenuDebug.startTest?.(); }")
        page.wait_for_function("() => !window.gameMenuDebug?.isPaused?.()")

        def key_event(kind: str, key: str) -> None:
            page.evaluate(
                "([kind, key]) => window.dispatchEvent(new KeyboardEvent(kind, { key, bubbles: true, cancelable: true }))",
                [kind, key],
            )

        start = page.evaluate("window.getCameraState().camera")
        key_event("keydown", "d")
        normal = page.evaluate("() => { window.teachDebug.tickWorld(1); return window.getCameraState().camera; }")
        key_event("keyup", "d")

        key_event("keydown", "Shift")
        key_event("keydown", "d")
        fast = page.evaluate("() => { window.teachDebug.tickWorld(1); return window.getCameraState().camera; }")
        key_event("keyup", "d")
        key_event("keyup", "Shift")

        normal_delta = normal["x"] - start["x"]
        fast_delta = fast["x"] - normal["x"]
        assert 500 <= normal_delta <= 540, {"normal_delta": normal_delta, "start": start, "normal": normal}
        assert fast_delta >= normal_delta * 2.2, {"normal_delta": normal_delta, "fast_delta": fast_delta, "fast": fast}
        assert fast.get("fastMultiplier", 0) >= 2.3, fast
        browser.close()
    server.shutdown()

print("camera shift speed smoke passed")
