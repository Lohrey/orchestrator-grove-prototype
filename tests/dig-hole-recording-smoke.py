#!/usr/bin/env python3
"""Smoke checks for shovel dig recording, dig-radius DSL, and hole spacing."""

from __future__ import annotations

import functools
import http.server
import math
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def holes(page):
    return page.evaluate("() => window.getWorldObjects().filter(o => o.kind === 'hole')")


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/index.html?v=t_8d24405b_dig_recording"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug && window.getWorldObjects")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        dig_x, dig_y = 1000, 760
        page.evaluate("botId => window.teachDebug.start(botId)", 1)
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x, y); window.teachDebug.setInventory('crude_shovel'); window.teachDebug.interact(); }", [dig_x, dig_y])

        state = page.evaluate("window.getGameState()")
        steps = state["recorder"]["steps"]
        assert len(steps) == 1, steps
        step = steps[0]
        assert step["op"] == "dig_hole", step
        assert step["zoneSpec"]["kind"] == "radius", step
        assert step["zoneSpec"]["radius"] == 96, step
        assert abs(step["zoneSpec"]["x"] - dig_x) <= 1 and abs(step["zoneSpec"]["y"] - dig_y) <= 1, step
        assert "dig hole in" in step["text"], step

        first_holes = holes(page)
        assert len(first_holes) == 1, first_holes
        assert first_holes[0]["radius"] >= 16 and first_holes[0]["blockRadius"] >= 42, first_holes

        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x, y); window.teachDebug.setInventory('crude_shovel'); window.teachDebug.interact(); }", [dig_x + 25, dig_y])
        assert len(holes(page)) == 1, holes(page)

        assigned = page.evaluate("() => window.teachDebug.assignToBot(1)")
        assert assigned["ok"], assigned
        page.evaluate("([x, y]) => window.teachDebug.spawnItem('crude_shovel', x, y, 1)", [940, 720])
        for _ in range(80):
            page.evaluate("window.teachDebug.tickWorld(0.35)")
            if len(holes(page)) >= 2:
                break

        dug = holes(page)
        assert len(dug) >= 2, dug
        new_hole = max(dug, key=lambda h: h["numericId"])
        assert math.dist((dig_x, dig_y), (new_hole["x"], new_hole["y"])) <= 96, dug
        assert math.dist((first_holes[0]["x"], first_holes[0]["y"]), (new_hole["x"], new_hole["y"])) >= 42, dug

        browser.close()
    server.shutdown()

print("dig hole recording smoke passed")
