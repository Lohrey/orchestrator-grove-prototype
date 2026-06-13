#!/usr/bin/env python3
"""Smoke checks for bare-hand tree search, progress, drops, and teach DSL cards."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
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


def item_count(page, item_type: str) -> int:
    return page.evaluate(
        "type => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === type).length",
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
        page.wait_for_function("() => window.getGameState && window.teachDebug && window.getWorldObjects")

        tree = next(o for o in page.evaluate("window.getWorldObjects()") if o["kind"] == "resource" and o["type"] == "tree" and not o["stump"])
        before_sticks = item_count(page, "stick")
        before_seeds = item_count(page, "tree_seed")

        page.evaluate("window.teachDebug.start(1)")
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 30, y); window.teachDebug.setInventory(null); }", [tree["x"], tree["y"]])
        right_click_world(page, tree["x"], tree["y"])

        page.wait_for_function("() => window.getGameState().player.target?.action === 'search_tree' && window.getGameState().player.target?.started === true", timeout=5000)
        progress = page.evaluate("window.getGameState().player.target")
        assert progress["total"] > 0 and progress["remaining"] <= progress["total"], progress

        page.wait_for_function(
            "([sticks, seeds]) => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'stick').length === sticks + 1 && window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'tree_seed').length === seeds + 1",
            arg=[before_sticks, before_seeds],
            timeout=8000,
        )
        steps = page.evaluate("window.getGameState().recorder.steps")
        assert len(steps) == 1 and steps[0]["op"] == "search_tree", steps
        assert "search" in steps[0]["text"] and "sticks and seeds" in steps[0]["text"], steps[0]
        assert page.locator("#teachSteps .teach-step-card code").inner_text().startswith("move to ")

        assigned = page.evaluate("window.teachDebug.assignToBot(1)")
        assert assigned["ok"] is True, assigned
        page.wait_for_function(
            "([sticks, seeds]) => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'stick').length >= sticks + 2 && window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'tree_seed').length >= seeds + 2",
            arg=[before_sticks, before_seeds],
            timeout=12000,
        )
        bot1 = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 1)
        assert bot1["program"] == "taught_loop" and bot1["taughtLoop"][0]["op"] == "search_tree", bot1

        browser.close()

    server.shutdown()

print("tree search smoke passed")
