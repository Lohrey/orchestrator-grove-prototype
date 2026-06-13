#!/usr/bin/env python3
"""Smoke checks mouse-wheel camera zoom stays anchored under the cursor."""

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
SHOT = Path(os.environ.get("ORCHESTRATOR_GROVE_SCREENSHOT", ROOT / "t_0e5e4767-zoom-wheel-local.png"))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def wheel_canvas(page, delta_y: float, ratio_x: float = 0.5, ratio_y: float = 0.5) -> None:
    page.evaluate(
        """
        ([deltaY, ratioX, ratioY]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const clientX = rect.left + rect.width * ratioX;
          const clientY = rect.top + rect.height * ratioY;
          c.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaY,
            clientX,
            clientY
          }));
        }
        """,
        [delta_y, ratio_x, ratio_y],
    )


def run(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getCameraState && window.getGameState")

        before = page.evaluate(
            """
            () => {
              const c = document.getElementById('game');
              const s = window.getCameraState();
              const screenX = c.width * 0.5;
              const screenY = c.height * 0.5;
              return {
                camera: s.camera,
                anchorWorld: {
                  x: s.camera.x + screenX / s.camera.zoom,
                  y: s.camera.y + screenY / s.camera.zoom
                },
                playerTarget: s.player.target
              };
            }
            """
        )
        assert before["camera"]["zoom"] == 1, before

        wheel_canvas(page, -500)
        page.wait_for_function("() => window.getCameraState().camera.zoom > 1.25")
        after_in = page.evaluate(
            """
            () => {
              const c = document.getElementById('game');
              const s = window.getCameraState();
              const screenX = c.width * 0.5;
              const screenY = c.height * 0.5;
              return {
                camera: s.camera,
                anchorWorld: {
                  x: s.camera.x + screenX / s.camera.zoom,
                  y: s.camera.y + screenY / s.camera.zoom
                },
                playerTarget: s.player.target
              };
            }
            """
        )
        assert after_in["camera"]["zoom"] > before["camera"]["zoom"], after_in
        assert abs(after_in["anchorWorld"]["x"] - before["anchorWorld"]["x"]) < 1.0, (before, after_in)
        assert abs(after_in["anchorWorld"]["y"] - before["anchorWorld"]["y"]) < 1.0, (before, after_in)
        assert after_in["playerTarget"] == before["playerTarget"], after_in

        for _ in range(9):
            wheel_canvas(page, 700)
        page.wait_for_function("() => window.getCameraState().camera.zoom <= 0.56")
        after_out = page.evaluate("window.getCameraState().camera")
        assert 0.54 <= after_out["zoom"] <= 0.56, after_out
        assert after_out["minZoom"] == 0.55, after_out
        assert after_out["maxZoom"] == 2.35, after_out

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()


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

print(f"zoom wheel smoke passed: {SHOT}")
