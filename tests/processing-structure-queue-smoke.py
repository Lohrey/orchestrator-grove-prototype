#!/usr/bin/env python3
"""Regression: busy production buildings should queue deposits instead of opening menus."""

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
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug && window.uiDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        sawbench = page.evaluate("() => window.getGameState().structures.find(s => s.type === 'sawbench')")

        page.evaluate(
            "([x, y, id]) => { window.teachDebug.movePlayerTo(x - 20, y); window.teachDebug.setInventory('log'); window.teachDebug.depositToStructure(id); }",
            [sawbench["x"], sawbench["y"], sawbench["id"]],
        )
        page.wait_for_function(
            f"() => window.getGameState().structures.find(s => s.id === {sawbench['id']}).processing?.recipe === 'log'"
        )

        page.evaluate(
            "([x, y]) => { window.teachDebug.movePlayerTo(x - 20, y); window.teachDebug.setInventory('plank'); document.getElementById('structureMenu').hidden = true; }",
            [sawbench["x"], sawbench["y"]],
        )
        starting_poles = page.evaluate("() => window.getGameState().stores.loosePoles")
        right_click_world(page, sawbench["x"], sawbench["y"])

        assert page.locator("#structureMenu").is_hidden(), "right-clicking a busy production building must not open the structure menu"
        target = page.evaluate("window.getGameState().player.target")
        assert target["action"] == "deposit_to_structure" and target["structureId"] == sawbench["id"], target

        page.wait_for_function(
            """
            () => {
              for (let i = 0; i < 30; i += 1) window.teachDebug.tickWorld(1 / 30);
              return window.getGameState().player.target?.waiting === true;
            }
            """,
            timeout=4000,
        )

        page.wait_for_function(
            f"""
            () => {{
              for (let i = 0; i < 180; i += 1) window.teachDebug.tickWorld(1 / 30);
              const state = window.getGameState();
              return !state.player.inventory && state.stores.loosePoles >= {starting_poles + 2};
            }}
            """,
            timeout=8000,
        )

        state = page.evaluate("window.getGameState()")
        assert state["player"]["inventory"] is None, state["player"]
        assert state["stores"]["loosePoles"] >= starting_poles + 2, state["stores"]

        browser.close()
        assert not failures, failures

    server.shutdown()

print("processing structure queue smoke passed")
