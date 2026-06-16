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
SCREENSHOT = ROOT / ("t_da28d8dd-depth-sorting-public.png" if BASE_URL else "t_da28d8dd-depth-sorting-smoke.png")

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

        order = page.evaluate(
            """
            async () => {
              const mod = await import(new URL('./src/depth-sort.js?v=t_da28d8dd', window.location.href).href);
              const drawn = [];
              const tree = { x: 400, y: 300, radius: 24 };
              const playerBehind = { x: 400, y: 268, r: 13 };
              const playerFront = { x: 400, y: 330, r: 13 };
              const botSameY = { x: 390, y: 286, r: 11 };
              const items = [
                mod.createDepthDrawable('player', playerBehind, () => drawn.push('player-behind'), { order: 0 }),
                mod.createDepthDrawable('tree', tree, () => drawn.push('tree'), { order: 1 }),
                mod.createDepthDrawable('player', playerFront, () => drawn.push('player-front'), { order: 2 }),
                mod.createDepthDrawable('bot', botSameY, () => drawn.push('bot-near-base'), { order: 3 })
              ];
              for (const item of mod.sortDepthDrawables(items)) item.draw();
              return {
                drawn,
                anchors: {
                  behind: mod.getDepthAnchorY('player', playerBehind),
                  tree: mod.getDepthAnchorY('tree', tree),
                  front: mod.getDepthAnchorY('player', playerFront),
                  bot: mod.getDepthAnchorY('bot', botSameY)
                }
              };
            }
            """
        )
        drawn = order["drawn"]
        assert drawn.index("player-behind") < drawn.index("tree"), order
        assert drawn.index("tree") < drawn.index("player-front"), order
        assert order["anchors"]["behind"] < order["anchors"]["tree"] < order["anchors"]["front"], order

        # Force a live overlapping scene and capture it for human visual review.
        page.evaluate(
            """
            () => {
              const state = window.getGameState();
              const tree = state.trees?.[0];
              if (tree) {
                window.teachDebug.movePlayerTo(tree.x, tree.y - 34);
                window.teachDebug.tickWorld(1);
                window.teachDebug.movePlayerTo(tree.x, tree.y + 42);
                window.teachDebug.tickWorld(1);
              }
            }
            """
        )
        page.wait_for_timeout(180)
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        assert SCREENSHOT.exists() and SCREENSHOT.stat().st_size > 20_000, SCREENSHOT
        assert not errors, errors
        browser.close()

if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_da28d8dd")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_da28d8dd")
        finally:
            server.shutdown()

print("depth sorting smoke passed")
