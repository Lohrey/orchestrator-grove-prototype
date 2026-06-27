#!/usr/bin/env python3
"""Smoke/regression checks for bot chopping tool mechanics."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.assignBotProgram")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        state = page.evaluate("window.getGameState()")
        assert state["stores"]["looseAxes"] == 10, state["stores"]
        assert state["stores"]["loosePickaxes"] == 5, state["stores"]
        assert state["stores"]["looseShovels"] == 5, state["stores"]
        assert state["stores"]["looseStones"] == 0, state["stores"]
        assert state["stores"]["stoneDeposits"] >= 1, state["stores"]

        bot = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        page.evaluate("([type, x, y]) => window.teachDebug.spawnItem(type, x + 6, y + 4, 1)", ["crude_axe", bot["x"], bot["y"]])
        result = page.evaluate("window.assignBotProgram({ botId: 1, program: 'chop_wood' })")
        assert result["ok"] is True, result

        page.wait_for_timeout(12000)
        equipped_bot = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        assert equipped_bot["inventory"]["type"] == "crude_axe", equipped_bot
        assert equipped_bot["inventory"]["durability"] >= 98, equipped_bot

        after_hit = equipped_bot

        page.evaluate("([x, y]) => window.teachDebug.spawnItem('crude_pickaxe', x + 10, y + 6, 1)", [after_hit["x"], after_hit["y"]])
        before_pickaxe = page.evaluate("window.getGameState().stores.loosePickaxes")
        pickup_tool = page.evaluate("() => window.assignBotProgram({ botId: 1, program: 'pickup_item', itemType: 'crude_pickaxe' })")
        assert pickup_tool["ok"] is True, pickup_tool
        page.wait_for_timeout(1500)
        after_pickup_attempt = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        assert after_pickup_attempt["inventory"]["type"] == "crude_axe", after_pickup_attempt
        assert page.evaluate("window.getGameState().stores.loosePickaxes") == before_pickaxe, after_pickup_attempt

        browser.close()

    server.shutdown()

print("axe mechanics smoke passed")
