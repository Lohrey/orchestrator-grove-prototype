#!/usr/bin/env python3
"""Smoke checks for planted tree growth stages and no stump auto-respawn."""

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


def planted_tree_at(page, x: int, y: int):
    return page.evaluate(
        """
        ([x, y]) => window.getWorldObjects().find(o =>
          o.kind === 'resource' && o.type === 'tree' && o.planted &&
          Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2
        )
        """,
        [x, y],
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

        hole = page.evaluate("window.teachDebug.digHole(535, 520)")
        assert hole["ref"].startswith("hole:"), hole
        before_holes = page.evaluate("window.getGameState().holes.length")
        page.evaluate("window.teachDebug.movePlayerTo(535, 500)")
        assert page.evaluate("window.teachDebug.pickupNearest('tree_seed')") is True
        page.evaluate("window.teachDebug.movePlayerTo(535, 520)")
        assert page.evaluate("window.teachDebug.plantNearest()") is True

        after = page.evaluate("window.getGameState()")
        assert len(after["holes"]) == before_holes - 1, after["holes"]
        assert not any(h["id"] == hole["id"] for h in after["holes"]), after["holes"]

        tree = planted_tree_at(page, 535, 520)
        assert tree and tree["growthStage"] == "sapling", tree

        page.wait_for_function(
            "([x, y]) => window.getWorldObjects().some(o => o.kind === 'resource' && o.type === 'tree' && o.planted && o.growthStage === 'small_tree' && Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2)",
            arg=[535, 520],
            timeout=11000,
        )
        page.wait_for_function(
            "([x, y]) => window.getWorldObjects().some(o => o.kind === 'resource' && o.type === 'tree' && o.planted && o.growthStage === 'grown_tree' && Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2)",
            arg=[535, 520],
            timeout=13000,
        )

        page.evaluate("window.teachDebug.movePlayerTo(610, 500)")
        assert page.evaluate("window.teachDebug.pickupNearest('crude_axe')") is True
        page.evaluate("window.teachDebug.movePlayerTo(535, 520)")
        for _ in range(4):
            page.evaluate("window.teachDebug.interact()")

        stump = planted_tree_at(page, 535, 520)
        assert stump and stump["stump"] is True, stump
        page.wait_for_timeout(20500)
        still_stump = planted_tree_at(page, 535, 520)
        assert still_stump and still_stump["stump"] is True, still_stump

        browser.close()

    server.shutdown()

print("tree growth smoke passed")
