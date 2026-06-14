#!/usr/bin/env python3
"""Smoke/regression check for item palette right-click storage interactions."""

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


def click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "click", world_x, world_y, 0)


def right_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "contextmenu", world_x, world_y, 2)


def tick_until(page, predicate: str) -> None:
    page.wait_for_function(
        f"""
        () => {{
          for (let i = 0; i < 360; i += 1) window.teachDebug.tickWorld(1 / 30);
          return {predicate};
        }}
        """,
        timeout=8000,
    )


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

        palette = page.evaluate("() => window.teachDebug.placeStructure('item_palette', 900, 420)")
        palette_id = palette["id"]

        # Left click is still the only way to open the palette context menu.
        click_world(page, palette["x"], palette["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
        menu_text = page.locator("#structureMenu").inner_text()
        assert "item palette" in menu_text.lower(), menu_text
        assert "stored 0/40" in menu_text, menu_text

        # Right-click with held item queues movement, stores the item, records DSL, and never opens the menu.
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 220, y); window.teachDebug.setInventory('log'); window.teachDebug.start(1); document.getElementById('structureMenu').hidden = true; }", [palette["x"], palette["y"]])
        right_click_world(page, palette["x"], palette["y"])
        assert page.locator("#structureMenu").is_hidden(), "right-click deposit must not open structure menu"
        target = page.evaluate("window.getGameState().player.target")
        assert target["action"] == "deposit_to_structure" and target["structureId"] == palette_id, target
        tick_until(page, f"window.getGameState().structures.find(s => s.id === {palette_id}).stored === 1 && !window.getGameState().player.inventory")
        deposit_state = page.evaluate("window.getGameState()")
        stored_palette = next(s for s in deposit_state["structures"] if s["id"] == palette_id)
        assert stored_palette["storageType"] == "log" and stored_palette["stored"] == 1, stored_palette
        deposit_step = deposit_state["recorder"]["steps"][-1]
        assert deposit_step["op"] == "deposit_to_structure", deposit_step
        assert deposit_step["type"] == "log" and deposit_step["structureType"] == "item_palette", deposit_step
        assert "deposit log" in deposit_step["text"], deposit_step

        # Right-click empty-handed queues movement, takes one stored item, records DSL, and never opens the menu.
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 220, y); window.teachDebug.setInventory(null); window.teachDebug.start(1); document.getElementById('structureMenu').hidden = true; }", [palette["x"], palette["y"]])
        right_click_world(page, palette["x"], palette["y"])
        assert page.locator("#structureMenu").is_hidden(), "right-click take must not open structure menu"
        target = page.evaluate("window.getGameState().player.target")
        assert target["action"] == "take_from_storage" and target["structureId"] == palette_id, target
        tick_until(page, "window.getGameState().player.inventory?.type === 'log'")
        take_state = page.evaluate("window.getGameState()")
        emptied_palette = next(s for s in take_state["structures"] if s["id"] == palette_id)
        assert emptied_palette["stored"] == 0 and emptied_palette["storageType"] is None, emptied_palette
        take_step = take_state["recorder"]["steps"][-1]
        assert take_step["op"] == "pick_up_from_storage", take_step
        assert take_step["type"] == "log" and take_step["structureType"] == "item_palette", take_step
        assert "pick up log from item palette" in take_step["text"], take_step

        # Right-clicking an empty palette with empty hands still suppresses the context menu.
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 220, y); window.teachDebug.setInventory(null); document.getElementById('structureMenu').hidden = true; }", [palette["x"], palette["y"]])
        right_click_world(page, palette["x"], palette["y"])
        assert page.locator("#structureMenu").is_hidden(), "right-click empty palette must not open structure menu"

        page.screenshot(path=str(ROOT / "storage-palette-right-click-smoke.png"), full_page=True)
        browser.close()
        assert not failures, failures

    server.shutdown()

print("storage palette right-click smoke passed")
