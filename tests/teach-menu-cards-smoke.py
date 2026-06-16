#!/usr/bin/env python3
"""Smoke checks for bot-menu teach recorder, card editing, pause, and resource recording."""

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


def click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "click", world_x, world_y, 0)


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
        page.wait_for_function("() => window.getGameState && window.teachDebug")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        assert page.locator("#teachPanel").is_hidden(), "standalone teach panel must start hidden"
        state = page.evaluate("window.getGameState()")
        bot1 = next(b for b in state["bots"] if b["id"] == 1)
        click_world(page, bot1["x"], bot1["y"])
        page.locator("#botMenu [data-teach-record]").click()
        page.wait_for_function("() => !document.getElementById('teachPanel').hidden")
        rec = page.evaluate("window.getGameState().recorder")
        assert rec["recording"] is True and rec["targetBotId"] == 1, rec
        assert page.locator("#teachBotId").input_value() == "1"
        assert page.locator("#teachCloseBtn").is_visible(), "standalone teach panel needs a visible close button"
        page.locator("#teachCloseBtn").click()
        page.wait_for_function("() => document.getElementById('teachPanel').hidden")
        assert page.evaluate("window.getGameState().recorder.recording") is True, "closing the panel should not cancel the recording"
        page.evaluate("window.teachDebug.start(1)")
        page.wait_for_function("() => !document.getElementById('teachPanel').hidden")
        page.keyboard.press("Escape")
        page.wait_for_function("() => document.getElementById('teachPanel').hidden")
        assert page.evaluate("window.getGameState().recorder.recording") is True, "Esc should close only the panel"
        page.evaluate("window.teachDebug.start(1)")
        page.wait_for_function("() => !document.getElementById('teachPanel').hidden")

        # Build two cards, reorder, delete, and edit location via the step-card dropdown.
        page.evaluate("window.teachDebug.setInventory(null)")
        first_log = next(i for i in page.evaluate("window.getGameState().objectRegistry") if i["kind"] == "item" and i["type"] == "log")
        page.evaluate("([x, y]) => window.teachDebug.movePlayerTo(x, y)", [first_log["x"], first_log["y"]])
        page.evaluate("window.teachDebug.interact()")
        sawbench1 = next(s for s in page.evaluate("window.getGameState().structures") if s["name"] == "sawbench 1")
        right_click_world(page, sawbench1["x"], sawbench1["y"])
        page.wait_for_function("() => window.getGameState().recorder.steps.length === 2")
        assert page.locator("#teachSteps .teach-step-card[draggable='true']").count() == 2
        menu_labels = page.locator("#teachSteps select[data-step-location-menu]").first.locator("option").all_inner_texts()
        assert {"Select zone", "Draw zone", "Draw radius", "Nearest"}.issubset(set(menu_labels)), menu_labels

        page.evaluate("window.teachDebug.moveStep(0, 1)")
        texts = [s["text"] for s in page.evaluate("window.getGameState().recorder.steps")]
        assert texts[0].startswith("move to sawbench 1"), texts
        page.evaluate("window.teachDebug.deleteStep(1)")
        assert len(page.evaluate("window.getGameState().recorder.steps")) == 1
        page.evaluate("window.teachDebug.editStepLocation(0, 'draw_zone')")
        dispatch_world_mouse(page, "mousedown", sawbench1["x"] - 80, sawbench1["y"] - 70, 0)
        dispatch_world_mouse(page, "mouseup", sawbench1["x"] + 80, sawbench1["y"] + 70, 0)
        edited = page.evaluate("window.getGameState().recorder.steps[0]")
        assert edited["zoneId"].startswith("zone:") and edited["zoneLabel"] == "zone 1", edited
        page.evaluate("window.teachDebug.editStepLocation(0, 'nearest')")
        nearest_step = page.evaluate("window.getGameState().recorder.steps[0]")
        assert "zoneId" not in nearest_step and "zoneSpec" not in nearest_step and "structureName" not in nearest_step, nearest_step

        # Assign stops recording and pins the taught loop to the bot from the menu.
        assigned = page.evaluate("window.teachDebug.assignToBot(1)")
        assert assigned["ok"] is True, assigned
        rec = page.evaluate("window.getGameState().recorder")
        assert rec["recording"] is False and rec["lastAssignedBotId"] == 1, rec
        bot1 = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 1)
        assert bot1["program"] == "taught_loop" and len(bot1["taughtLoop"]) == 1, bot1

        paused = page.evaluate("window.teachDebug.pauseBot(1)")
        bot1 = next(b for b in paused["bots"] if b["id"] == 1)
        assert bot1["paused"] is True, bot1

        # Dropping held items records a location-scoped card that bots can replay into a zone.
        page.evaluate("window.teachDebug.start(2)")
        page.evaluate("window.teachDebug.movePlayerTo(760, 520)")
        page.evaluate("window.teachDebug.setInventory('log')")
        assert page.evaluate("window.teachDebug.dropHeld()") is True
        drop_step = page.evaluate("window.getGameState().recorder.steps[0]")
        assert drop_step["op"] == "drop_item" and drop_step["type"] == "log", drop_step
        assert drop_step["zoneSpec"]["kind"] == "radius" and "drop zone" in drop_step["zoneLabel"], drop_step
        assert "drop log on ground in drop zone" in drop_step["text"], drop_step
        page.evaluate("window.teachDebug.editStepLocation(0, 'draw_zone')")
        dispatch_world_mouse(page, "mousedown", 900, 620, 0)
        dispatch_world_mouse(page, "mouseup", 1020, 740, 0)
        edited_drop = page.evaluate("window.getGameState().recorder.steps[0]")
        assert edited_drop["op"] == "drop_item" and edited_drop["zoneLabel"] == "zone 2", edited_drop
        assigned_drop = page.evaluate("window.teachDebug.assignToBot(2)")
        assert assigned_drop["ok"] is True and assigned_drop["steps"][0]["op"] == "drop_item", assigned_drop
        replay = page.evaluate(
            """
            () => {
              window.teachDebug.setBotInventory(2, 'log');
              for (let i = 0; i < 360; i += 1) window.teachDebug.tickWorld(1 / 30);
              const state = window.getGameState();
              const zone = state.zones.find(z => z.name === 'zone 2');
              const logsInZone = state.objectRegistry.filter(o => o.kind === 'item' && o.type === 'log' && o.x >= zone.x && o.x <= zone.x + zone.w && o.y >= zone.y && o.y <= zone.y + zone.h);
              const bot = state.bots.find(b => b.id === 2);
              return { zone, logsInZone, bot };
            }
            """
        )
        assert replay["logsInZone"] and replay["bot"]["inventory"] is None, replay

        # Right-click resource targets with tool in hand creates radius-scoped teach DSL actions.
        page.evaluate("window.teachDebug.start(2)")
        tree = next(o for o in page.evaluate("window.getWorldObjects()") if o["kind"] == "resource" and o["type"] == "tree" and not o["stump"])
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 30, y); window.teachDebug.setInventory('crude_axe'); }", [tree["x"], tree["y"]])
        right_click_world(page, tree["x"], tree["y"])
        page.wait_for_function("() => window.getGameState().recorder.steps.some(s => s.op === 'chop_tree')", timeout=8000)
        chop_step = page.evaluate("window.getGameState().recorder.steps.find(s => s.op === 'chop_tree')")
        assert chop_step["zoneSpec"]["kind"] == "radius" and "treeId" not in chop_step and "treeName" not in chop_step, chop_step
        page.evaluate("window.teachDebug.openBotMenu(2)")
        page.wait_for_function("() => !document.getElementById('botMenu').hidden && document.querySelector('#botMenu .menu-teach-steps .teach-step-card')")
        assert "radius" in page.locator("#botMenu .menu-teach-steps [data-step-location]").first.inner_text()
        page.locator("#botMenu .menu-teach-steps select[data-step-location-menu]").first.select_option("select_zone")
        zone1 = next(z for z in page.evaluate("window.getGameState().zones") if z["name"] == "zone 1")
        page.evaluate("([x, y]) => window.teachDebug.applyLocation(x, y)", [zone1["x"] + zone1["w"] / 2, zone1["y"] + zone1["h"] / 2])
        page.wait_for_function("() => document.querySelector('#botMenu .menu-teach-steps [data-step-location]')?.textContent.trim() === 'zone 1'")
        assert page.locator("#botMenu .menu-teach-steps .teach-step-card code").first.inner_text().endswith("in zone 1")
        chop_step = page.evaluate("window.getGameState().recorder.steps.find(s => s.op === 'chop_tree')")
        assert chop_step["zoneId"] == zone1["id"] and chop_step["zoneLabel"] == "zone 1", chop_step
        rock = next(o for o in page.evaluate("window.getWorldObjects()") if o["kind"] == "resource" and o["type"] == "stone_deposit" and not o["depleted"])
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 30, y); window.teachDebug.setInventory('crude_pickaxe'); }", [rock["x"], rock["y"]])
        right_click_world(page, rock["x"], rock["y"])
        page.wait_for_function("() => window.getGameState().recorder.steps.some(s => s.op === 'mine_stone')", timeout=8000)
        mine_step = page.evaluate("window.getGameState().recorder.steps.find(s => s.op === 'mine_stone')")
        assert mine_step["zoneSpec"]["kind"] == "radius" and "rockId" not in mine_step and "rockName" not in mine_step, mine_step
        hemp = next(o for o in page.evaluate("window.getWorldObjects()") if o["kind"] == "resource" and o["type"] == "hemp_plant" and not o["harvested"])
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 30, y); window.teachDebug.setInventory('crude_axe'); }", [hemp["x"], hemp["y"]])
        right_click_world(page, hemp["x"], hemp["y"])
        page.wait_for_function("() => window.getGameState().recorder.steps.some(s => s.op === 'chop_hemp')", timeout=8000)
        hemp_step = page.evaluate("window.getGameState().recorder.steps.find(s => s.op === 'chop_hemp')")
        assert hemp_step["zoneSpec"]["kind"] == "radius" and "hempId" not in hemp_step and "hempName" not in hemp_step, hemp_step

        browser.close()

    server.shutdown()

print("teach menu/cards smoke passed")
