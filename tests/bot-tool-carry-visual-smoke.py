#!/usr/bin/env python3
"""Regression: bot-held crude tools are carried at the hand, not shown above the head."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "t_fe2b07c8-bot-tool-carry-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 420, "height": 280})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

        page.goto(f"http://127.0.0.1:{port}/index.html?v=t_fe2b07c8", wait_until="domcontentloaded")
        page.wait_for_function("() => window.getGameState")

        result = page.evaluate(
            """
            async () => {
              document.body.innerHTML = '<canvas id="botToolSmoke" width="420" height="280" style="width:420px;height:280px"></canvas>';
              const canvas = document.getElementById('botToolSmoke');
              const c = canvas.getContext('2d', { willReadFrequently: true });
              const mod = await import('./src/canvas-renderer.js?v=t_fe2b07c8');
              const bot = { id: 1, name: 'Bot 1', x: 180, y: 145, r: 11, color: '#80a9c9', inventory: null, tool: null, equipment: {}, facingX: 1, facingY: 0 };
              const state = {
                W: canvas.width,
                H: canvas.height,
                map: { width: canvas.width, height: canvas.height },
                camera: { x: 0, y: 0, zoom: 1 },
                mouse: { hoverBot: null, hoverItem: null, hoverTree: null, hoverStructure: null },
                holes: [], rocks: [], hempPlants: [], structures: [], projectiles: [], items: [], monsters: [], trees: [], zones: [], floaters: [], mapFeatures: [],
                bots: [bot],
                player: { x: -200, y: -200, r: 13, inventory: null, equipment: {}, facingX: 1, facingY: 0 },
                assistant: { x: -240, y: -240, facingX: 1, facingY: 0 },
                multiplayer: { enabled: false, players: {} },
                placementType: null,
                zoneDraft: null
              };
              function region(cx, cy, w, h) {
                const x = Math.max(0, Math.round(cx - w / 2));
                const y = Math.max(0, Math.round(cy - h / 2));
                return Array.from(c.getImageData(x, y, w, h).data);
              }
              function diff(a, b) {
                let total = 0;
                for (let i = 0; i < a.length; i += 4) {
                  total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
                }
                return total;
              }
              function capture(type) {
                bot.inventory = type ? { type, count: 1 } : null;
                mod.drawWorld(state, c);
                return {
                  above: region(bot.x, bot.y - 24, 30, 22),
                  hand: region(bot.x + 22, bot.y + 6, 34, 34)
                };
              }

              const empty = capture(null);
              const tool = capture('crude_axe');
              const log = capture('log');
              return {
                aboveToolDiff: diff(empty.above, tool.above),
                aboveLogDiff: diff(empty.above, log.above),
                handToolDiff: diff(empty.hand, tool.hand),
                handLogDiff: diff(empty.hand, log.hand)
              };
            }
            """
        )

        assert result["aboveLogDiff"] > result["aboveToolDiff"] * 2 + 1000, result
        assert result["handToolDiff"] > result["handLogDiff"] * 2 + 1000, result
        assert result["handToolDiff"] > 1500, result

        page.screenshot(path=str(SHOT), full_page=False)
        browser.close()

        assert not errors, errors

    server.shutdown()
    thread.join(timeout=1)

print(f"bot tool carry visual smoke passed: {SHOT}")
