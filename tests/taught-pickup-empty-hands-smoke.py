#!/usr/bin/env python3
"""Regression: taught pick_up steps must not grab another tool when the bot already has one."""

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


def loose_count(page, item_type: str) -> int:
    return page.evaluate(
        "itemType => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === itemType).length",
        item_type,
    )


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.assignBotProgram")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        # Reproduce Paul's case: the bot already holds the axe from a previous run/edit,
        # then a reassigned taught loop starts again at a pick_up crude_axe step.
        bot = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        page.evaluate("([type, x, y]) => window.teachDebug.spawnItem(type, x + 6, y + 4, 1)", ["crude_axe", bot["x"], bot["y"]])
        assigned_chop = page.evaluate("() => window.assignBotProgram({ botId: 1, program: 'chop_wood' })")
        assert assigned_chop["ok"] is True, assigned_chop
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.tool?.type === 'crude_axe'", timeout=8000)

        bot = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        page.evaluate("([type, x, y]) => window.teachDebug.spawnItem(type, x + 6, y + 4, 1)", ["crude_axe", bot["x"], bot["y"]])
        loose_axes_before = loose_count(page, "crude_axe")

        assigned_loop = page.evaluate(
            """
            () => window.assignCustomDslProgram({
              botId: 1,
              program: { id: 'axe_repickup_regression', name: 'Axe repickup regression', steps: [
                { op: 'pick_up', type: 'crude_axe' },
                { op: 'loop' }
              ] }
            })
            """
        )
        assert assigned_loop["ok"] is True, assigned_loop

        page.wait_for_timeout(2500)
        state = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        assert state["tool"]["type"] == "crude_axe", state
        assert state["inventory"] is None, state
        assert loose_count(page, "crude_axe") == loose_axes_before, state
        assert "already has crude axe" in state["message"].lower(), state

        browser.close()

    server.shutdown()

print("taught pickup empty-hands smoke passed")
