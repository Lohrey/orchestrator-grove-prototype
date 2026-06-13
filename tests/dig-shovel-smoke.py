#!/usr/bin/env python3
"""Smoke/regression checks for shovel digging by player and DSL bots."""

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


def canvas_client_point(page, world_x: float, world_y: float) -> tuple[float, float]:
    box = page.locator("#game").bounding_box()
    assert box, "canvas is not visible"
    size = page.evaluate("""
        () => {
          const c = document.getElementById('game');
          const s = window.getCameraState();
          return { w: c.width, h: c.height, camera: s.camera };
        }
    """)
    return (
        box["x"] + (world_x - size["camera"]["x"]) * box["width"] / size["w"],
        box["y"] + (world_y - size["camera"]["y"]) * box["height"] / size["h"],
    )


def right_click_world(page, world_x: float, world_y: float) -> None:
    page.evaluate(
        """
        ([worldX, worldY]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX, clientY }));
        }
        """,
        [world_x, world_y],
    )


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.assignBotProgram && window.programTemplates")

        state = page.evaluate("window.getGameState()")
        assert "dig_holes" in page.evaluate("Object.keys(window.programTemplates)"), page.evaluate("Object.keys(window.programTemplates)")
        assert state["stores"]["looseShovels"] >= 1, state["stores"]
        assert page.evaluate("window.validateDslProgram(window.programTemplates.dig_holes).ok") is True

        shovel = page.evaluate("window.getWorldObjects().find(o => o.kind === 'item' && o.type === 'crude_shovel')")
        assert shovel, "expected a crude shovel item in the world"
        right_click_world(page, shovel["x"], shovel["y"])
        page.wait_for_function(
            "([x, y]) => { const p = window.getGameState().player; return Math.hypot(p.x - x, p.y - y) < 38; }",
            arg=[shovel["x"], shovel["y"]],
            timeout=7000,
        )
        page.keyboard.press("E")
        page.wait_for_function("window.getGameState().player.inventory?.type === 'crude_shovel'", timeout=2000)

        clear_x, clear_y = shovel["x"] + 120, shovel["y"] + 120
        right_click_world(page, clear_x, clear_y)
        page.wait_for_function(
            "([x, y]) => { const p = window.getGameState().player; return Math.hypot(p.x - x, p.y - y) < 25; }",
            arg=[clear_x, clear_y],
            timeout=8000,
        )
        page.keyboard.press("E")
        page.wait_for_function("window.getGameState().holes.length >= 1", timeout=2000)

        result = page.evaluate("window.assignBotProgram({ botId: 1, program: 'dig_holes', zoneId: 'zone:depot' })")
        assert result["ok"] is True, result
        page.wait_for_function(
            "() => window.getGameState().bots.find(b => b.id === 1)?.tool?.type === 'crude_shovel'",
            timeout=12000,
        )
        page.wait_for_function("window.getGameState().holes.length >= 2", timeout=14000)
        bot = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        assert bot["program"] == "dig_holes", bot

        browser.close()

    server.shutdown()

print("dig shovel smoke passed")
