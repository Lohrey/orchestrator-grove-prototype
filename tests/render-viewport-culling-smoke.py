#!/usr/bin/env python3
import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 840})
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug && window.teachDebug")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => window.getGameState().gameMode === 'test' && !window.getGameState().paused")
        page.evaluate(
            """
            () => {
              window.__renderPerfStats = { drawImages: [], fillRects: [] };
              const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
              const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
              CanvasRenderingContext2D.prototype.drawImage = function(...args) {
                if (window.__renderPerfStats && args.length >= 9) {
                  window.__renderPerfStats.drawImages.push({ w: Number(args[3]) || 0, h: Number(args[4]) || 0 });
                }
                return originalDrawImage.apply(this, args);
              };
              CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
                if (window.__renderPerfStats) window.__renderPerfStats.fillRects.push({ w: Number(w) || 0, h: Number(h) || 0 });
                return originalFillRect.apply(this, arguments);
              };
            }
            """
        )
        state = page.evaluate("window.teachDebug.tickWorld(74)")
        assert state["fogOfWar"]["enabled"], state["fogOfWar"]
        assert state["dayNight"]["nightAmount"] > 0.7, state["dayNight"]
        page.evaluate("window.__renderPerfStats.drawImages = []; window.__renderPerfStats.fillRects = []")
        page.wait_for_timeout(120)
        stats = page.evaluate("window.__renderPerfStats")
        camera = page.evaluate("window.getCameraState()")
        map_area = camera["map"]["width"] * camera["map"]["height"]
        canvas_area = 1280 * 840
        assert stats["drawImages"], stats
        largest_draw = max(rect["w"] * rect["h"] for rect in stats["drawImages"])
        largest_fill = max(rect["w"] * rect["h"] for rect in stats["fillRects"])
        assert largest_draw < map_area * 0.5, {"largest_draw": largest_draw, "map_area": map_area, "stats": stats["drawImages"][:8]}
        assert largest_fill < map_area * 0.5, {"largest_fill": largest_fill, "map_area": map_area, "stats": stats["fillRects"][:8]}
        assert largest_draw < canvas_area * 3.5, {"largest_draw": largest_draw, "canvas_area": canvas_area}
        assert not errors, errors
        browser.close()

if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_b76e061a")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_b76e061a")
        finally:
            server.shutdown()

print("render viewport culling smoke passed")
