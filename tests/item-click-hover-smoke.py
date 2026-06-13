#!/usr/bin/env python3
"""Smoke/regression check for item hover labels and right-click pickup pathing."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "item-click-hover-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def dispatch_world_mouse(page, event_type: str, world_x: float, world_y: float, button: int = 0) -> None:
    page.evaluate(
        """
        ([eventType, worldX, worldY, button]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, button, clientX, clientY }));
        }
        """,
        [event_type, world_x, world_y, button],
    )


def move_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "mousemove", world_x, world_y)


def right_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "contextmenu", world_x, world_y, 2)


def item_count(page, item_type: str) -> int:
    return page.evaluate(
        "itemType => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === itemType).length",
        item_type,
    )


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getHoverState && window.getCameraState")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

        log_item = page.evaluate("window.getWorldObjects().find(o => o.kind === 'item' && o.type === 'log')")
        assert log_item, "expected a loose log item in the world"
        initial_logs = item_count(page, "log")

        move_world(page, log_item["x"], log_item["y"])
        page.wait_for_function(
            "itemId => window.getHoverState().item?.id === itemId && window.getHoverState().cursor === 'pointer'",
            arg=log_item["numericId"],
            timeout=2000,
        )
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        right_click_world(page, log_item["x"], log_item["y"])
        page.wait_for_function(
            "itemId => window.getCameraState().player.target?.action === 'pickup_item' && window.getCameraState().player.target?.itemId === itemId",
            arg=log_item["numericId"],
            timeout=2000,
        )
        page.wait_for_function("window.getGameState().player.inventory?.type === 'log'", timeout=8000)
        assert item_count(page, "log") == initial_logs - 1

        stick_item = page.evaluate("window.getWorldObjects().find(o => o.kind === 'item' && o.type === 'stick')")
        assert stick_item, "expected a loose stick item in the world"
        player_before = page.evaluate("window.getGameState().player")
        right_click_world(page, stick_item["x"], stick_item["y"])
        page.wait_for_timeout(250)
        player_after = page.evaluate("window.getGameState().player")
        assert player_after["inventory"] == {"type": "log", "count": 1}, player_after
        assert player_after["target"] is None, player_after
        assert abs(player_after["x"] - player_before["x"]) < 2 and abs(player_after["y"] - player_before["y"]) < 2, (player_before, player_after)

        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html")
        finally:
            server.shutdown()

print("item click/hover smoke passed")
