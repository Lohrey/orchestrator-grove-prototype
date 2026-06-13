#!/usr/bin/env python3
"""Regression checks for player-held axe/pickaxe E interactions."""

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


BOOT_COUNTER = 0


def boot_page(page, port: int) -> None:
    global BOOT_COUNTER
    BOOT_COUNTER += 1
    page.goto(f"http://127.0.0.1:{port}/index.html?scenario={BOOT_COUNTER}", wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.teachDebug")


def move_player(page, x: float, y: float) -> None:
    page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x, y)", [x, y])


def pickup_tool_with_e(page, tool_type: str) -> None:
    tool = page.evaluate(
        "type => window.getGameState().objectRegistry.find(o => o.kind === 'item' && o.type === type)",
        tool_type,
    )
    assert tool, f"missing {tool_type} item"
    move_player(page, tool["x"], tool["y"])
    page.keyboard.press("E")
    page.wait_for_function(
        "type => window.getGameState().player.inventory?.type === type",
        arg=tool_type,
        timeout=2000,
    )


def dispatch_repeat_e(page) -> None:
    page.evaluate(
        """
        () => window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'E', code: 'KeyE', bubbles: true, cancelable: true, repeat: true
        }))
        """
    )
    page.wait_for_timeout(250)


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors: list[str] = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        boot_page(page, port)
        pickup_tool_with_e(page, "crude_axe")
        logs_before = page.evaluate("window.getGameState().stores.looseLogs")
        move_player(page, 155, 120)
        page.keyboard.press("E")
        page.wait_for_function(
            "before => window.getGameState().stores.looseLogs > before && window.getGameState().player.inventory?.type === 'crude_axe'",
            arg=logs_before,
            timeout=2000,
        )
        logs_after = page.evaluate("window.getGameState().stores.looseLogs")
        dispatch_repeat_e(page)
        assert page.evaluate("window.getGameState().stores.looseLogs") == logs_after

        boot_page(page, port)
        pickup_tool_with_e(page, "crude_pickaxe")
        stones_before = page.evaluate("window.getGameState().stores.looseStones")
        move_player(page, 470, 500)
        page.keyboard.press("E")
        page.wait_for_function(
            "before => window.getGameState().stores.looseStones > before && window.getGameState().player.inventory?.type === 'crude_pickaxe'",
            arg=stones_before,
            timeout=2000,
        )
        stones_after = page.evaluate("window.getGameState().stores.looseStones")
        dispatch_repeat_e(page)
        assert page.evaluate("window.getGameState().stores.looseStones") == stones_after

        assert not errors, errors
        browser.close()

    server.shutdown()

print("player tool interact smoke passed")
