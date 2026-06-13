#!/usr/bin/env python3
"""Smoke/regression checks for sawbench products dropping as loose floor items."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SAWBENCH_W = 92
SAWBENCH_H = 54


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def dropped_near_sawbench(page, item_type: str) -> int:
    return page.evaluate(
        """
        ([itemType, w, h]) => {
          const state = window.getGameState();
          const saw = state.structures.find(s => s.type === 'sawbench');
          const dropX = saw.x + w / 2 + 24;
          const dropY = saw.y + h / 2 + 18;
          return state.objectRegistry.filter(o =>
            o.kind === 'item' &&
            o.type === itemType &&
            o.x > saw.x + w / 2 &&
            o.y > saw.y + h / 2 &&
            Math.hypot(o.x - dropX, o.y - dropY) < 65
          ).length;
        }
        """,
        [item_type, SAWBENCH_W, SAWBENCH_H],
    )


def wait_for_ready(page, url: str) -> None:
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.assignBotProgram && window.programTemplates && window.teachDebug")


def produce_loose_planks(page) -> None:
    result = page.evaluate("window.assignBotProgram({ botId: 1, program: 'haul_logs' })")
    assert result["ok"] is True, result
    page.wait_for_function("window.getGameState().stores.sawbenchLogs >= 1", timeout=9000)
    result = page.evaluate("window.assignBotProgram({ botId: 1, program: 'idle' })")
    assert result["ok"] is True, result

    result = page.evaluate("window.assignBotProgram({ botId: 2, program: 'make_planks' })")
    assert result["ok"] is True, result
    page.wait_for_function(
        "window.getGameState().stores.loosePlanks >= 2 && window.getGameState().stores.sawbenchLogs === 0 && window.getGameState().stores.sawbenchPlanks === 0",
        timeout=9000,
    )
    result = page.evaluate("window.assignBotProgram({ botId: 2, program: 'idle' })")
    assert result["ok"] is True, result
    assert dropped_near_sawbench(page, "plank") >= 2, page.evaluate("window.getGameState()")


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            wait_for_ready(page, url)

            make_poles = page.evaluate("window.programTemplates.make_poles")
            assert any(
                step.get("op") == "deliver_to_sawbench" and step.get("type") == "plank"
                for step in make_poles["steps"]
            ), make_poles
            assert page.evaluate("window.validateDslProgram(window.programTemplates.make_poles).ok") is True

            produce_loose_planks(page)
            before = page.evaluate("window.getGameState().stores")
            plank = page.evaluate("window.getGameState().objectRegistry.find(o => o.kind === 'item' && o.type === 'plank')")
            saw = page.evaluate("window.getGameState().structures.find(s => s.type === 'sawbench')")
            page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x, y)", [plank["x"], plank["y"]])
            assert page.evaluate("window.teachDebug.pickupNearest('plank')") is True
            page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x, y)", [saw["x"], saw["y"]])
            assert page.evaluate("id => window.teachDebug.depositToStructure(id)", saw["id"]) is True
            page.wait_for_function(
                f"window.getGameState().stores.loosePoles >= {before['loosePoles'] + 2} && window.getGameState().stores.sawbenchPoles === 0",
                timeout=3000,
            )
            assert dropped_near_sawbench(page, "pole") >= 2, page.evaluate("window.getGameState()")

            wait_for_ready(page, url)
            produce_loose_planks(page)
            before_bot = page.evaluate("window.getGameState().stores")
            result = page.evaluate("window.assignBotProgram({ botId: 3, program: 'make_poles' })")
            assert result["ok"] is True, result
            page.wait_for_function(
                f"window.getGameState().stores.loosePoles >= {before_bot['loosePoles'] + 2} && window.getGameState().stores.sawbenchPoles === 0",
                timeout=9000,
            )
            assert dropped_near_sawbench(page, "pole") >= 2, page.evaluate("window.getGameState()")

            browser.close()
    finally:
        server.shutdown()

print("sawbench poles smoke passed")
