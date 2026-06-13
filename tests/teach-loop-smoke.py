#!/usr/bin/env python3
"""Smoke/regression checks for teach-by-doing loop recording and bot replay."""

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


def dispatch_world_mouse(page, event_type: str, world_x: float, world_y: float, button: int = 0) -> None:
    page.evaluate(
        """
        ([eventType, worldX, worldY, button]) => {
          const c = document.getElementById('game');
          const s = window.getCameraState();
          const rect = c.getBoundingClientRect();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, button, clientX, clientY }));
        }
        """,
        [event_type, world_x, world_y, button],
    )


def right_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "contextmenu", world_x, world_y, 2)


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug && window.assignBotProgram")

        page.evaluate("window.teachDebug.placeStructure('sawbench', 720, 330)")
        initial = page.evaluate("window.getGameState()")
        sawbench2 = next(s for s in initial["structures"] if s["name"] == "sawbench 2")
        first_log = next(i for i in initial["objectRegistry"] if i["kind"] == "item" and i["type"] == "log")

        page.evaluate("window.teachDebug.start()")
        page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x, y)", [first_log["x"], first_log["y"]])
        assert page.evaluate("window.teachDebug.interact()") is None
        assert page.evaluate("window.getGameState().player.inventory") == {"type": "log", "count": 1}

        right_click_world(page, sawbench2["x"], sawbench2["y"])
        page.wait_for_function(
            """
            () => {
              const state = window.getGameState();
              const rec = state.recorder.steps.map(s => s.text);
              const s2 = state.structures.find(s => s.name === 'sawbench 2');
              return !state.player.inventory && s2 && (s2.logs >= 1 || s2.processing) &&
                rec.length === 2 && rec[0] === 'pick up nearest log' && rec[1] === 'move to sawbench 2 and deposit log';
            }
            """,
            timeout=15000,
        )
        stopped = page.evaluate("window.teachDebug.stop()")
        texts = [step["text"] for step in stopped["recordedLoop"]]
        assert texts == ["pick up nearest log", "move to sawbench 2 and deposit log"], texts
        assert stopped["recordedLoop"][1]["op"] == "deposit_to_structure", stopped
        assert stopped["recordedLoop"][1]["structureName"] == "sawbench 2", stopped

        page.wait_for_function("() => window.getGameState().stores.loosePlanks >= 2", timeout=15000)

        assigned = page.evaluate("window.teachDebug.assignToBot(1)")
        assert assigned["ok"] is True, assigned
        page.wait_for_function(
            """
            () => {
              const state = window.getGameState();
              const bot = state.bots.find(b => b.id === 1);
              return state.stores.loosePlanks >= 4 && bot && bot.program === 'taught_loop' &&
                bot.taughtLoop && bot.taughtLoop.length === 2 && bot.taughtLoop[0].text === 'pick up nearest log' &&
                bot.taughtLoop[1].text === 'move to sawbench 2 and deposit log';
            }
            """,
            timeout=20000,
        )
        replay = page.evaluate("window.getGameState()")
        bot1 = next(b for b in replay["bots"] if b["id"] == 1)
        assert bot1["program"] == "taught_loop", bot1
        assert bot1["taughtLoop"] and bot1["taughtLoop"][1]["structureName"] == "sawbench 2", bot1

        browser.close()

    server.shutdown()

print("teach loop smoke passed")
