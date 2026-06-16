#!/usr/bin/env python3
"""Smoke checks for bot context-menu JSON editor and DSL card accept flow."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "t_b5a16881-bot-program-editor-local.png"


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


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html?v=t_b5a16881_bot_editor", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        page.evaluate("window.teachDebug.openBotMenu(1)")
        page.wait_for_selector("#botMenu [data-bot-json-editor]")
        assert page.locator("#botMenu [data-save-json]").is_visible(), "save button must sit under assigned JSON editor"
        assert page.locator("#botMenu [data-bot-program-steps] .bot-program-step-card").count() >= 1, "DSL card flow must render"

        invalid = "{bad json"
        page.locator("#botMenu [data-bot-json-editor]").fill(invalid)
        page.locator("#botMenu [data-save-json]").click()
        page.wait_for_function("() => document.querySelector('#botMenu [data-bot-edit-status]')?.textContent.includes('JSON error')")

        edited_program = {
            "id": "menu_json_loop",
            "name": "Menu JSON Loop",
            "steps": [
                {"op": "pick_up", "type": "crude_axe", "text": "pick up nearest crude axe"},
                {"op": "chop_tree", "text": "chop nearest tree"},
                {"op": "loop"},
            ],
        }
        page.locator("#botMenu [data-bot-json-editor]").fill(__import__("json").dumps(edited_program, indent=2))
        page.locator("#botMenu [data-save-json]").click()
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.program === 'taught_loop'")
        bot = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 1)
        assert bot["taughtLoop"][0]["type"] == "crude_axe" and bot["taughtLoop"][1]["op"] == "chop_tree", bot

        page.evaluate("window.teachDebug.openBotMenu(2)")
        page.wait_for_selector("#botMenu [data-bot-json-editor]")
        bot2_json = page.locator("#botMenu [data-bot-json-editor]").input_value()
        assert "Idle / Depot Parking" in bot2_json and "Menu JSON Loop" not in bot2_json, bot2_json

        page.evaluate("window.teachDebug.openBotMenu(1)")
        page.wait_for_selector("#botMenu [data-bot-program-steps] .bot-program-step-card")
        page.locator("#botMenu [data-bot-program-steps] [data-bot-step-type='0']").evaluate(
            "el => { el.value = 'crude_pickaxe'; el.dispatchEvent(new Event('change', { bubbles: true })); }"
        )
        page.wait_for_function("() => document.querySelector('#botMenu [data-bot-json-editor]')?.value.includes('crude_pickaxe')")

        # DSL cards reuse the teach-step location control: changing the card location updates the pill and JSON.
        if not page.evaluate("window.getGameState().zones.length"):
            page.evaluate("window.beginZoneDrawing()")
            dispatch_world_mouse(page, "mousedown", 820, 520, 0)
            dispatch_world_mouse(page, "mouseup", 980, 680, 0)
            page.wait_for_function("() => window.getGameState().zones.length > 0")
        zone1 = page.evaluate("window.getGameState().zones[0]")
        page.evaluate("window.teachDebug.openBotMenu(1)")
        page.wait_for_selector("#botMenu [data-bot-program-steps] .bot-program-step-card")
        page.locator("#botMenu [data-bot-program-steps] select[data-bot-step-location-menu='0']").select_option("select_zone")
        page.evaluate("([x, y]) => window.teachDebug.applyLocation(x, y)", [zone1["x"] + (zone1.get("w") or 0) / 2, zone1["y"] + (zone1.get("h") or 0) / 2])
        page.wait_for_function(
            "zoneName => document.querySelector('#botMenu [data-bot-program-steps] [data-bot-step-location=\"0\"]')?.textContent.trim() === zoneName",
            arg=zone1["name"],
        )
        editor_value = page.locator("#botMenu [data-bot-json-editor]").input_value()
        assert '"zoneId"' in editor_value and zone1["id"] in editor_value and '"zoneLabel"' in editor_value, editor_value

        page.locator("#botMenu [data-accept-dsl-cards]").click()
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.taughtLoop?.[0]?.type === 'crude_pickaxe'")
        bot = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 1)
        assert bot["taughtLoop"][0]["type"] == "crude_pickaxe" and bot["taughtLoop"][0]["zoneId"] == zone1["id"], bot
        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    server.shutdown()

print(f"bot program editor smoke passed; screenshot={SHOT}")
