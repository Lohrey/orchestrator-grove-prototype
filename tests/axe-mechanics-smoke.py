#!/usr/bin/env python3
"""Smoke/regression checks for bot chopping tool mechanics."""

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


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.assignBotProgram")

        state = page.evaluate("window.getGameState()")
        assert state["stores"]["looseAxes"] == 10, state["stores"]
        assert state["stores"]["loosePickaxes"] == 5, state["stores"]
        assert state["stores"]["looseShovels"] == 5, state["stores"]
        assert state["stores"]["looseStones"] == 0, state["stores"]
        assert state["stores"]["stoneDeposits"] >= 1, state["stores"]

        result = page.evaluate("window.assignBotProgram({ botId: 1, program: 'chop_wood' })")
        assert result["ok"] is True, result

        page.wait_for_function(
            """
            () => {
              const bot = window.getGameState().bots.find(b => b.id === 1);
              return bot && (bot.tool?.type === 'crude_axe' || bot.message.includes('crude axe'));
            }
            """,
            timeout=3000,
        )
        early_bot = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        assert "stone" not in early_bot["message"].lower(), early_bot

        page.wait_for_function(
            "window.getGameState().bots.find(b => b.id === 1)?.tool?.type === 'crude_axe'",
            timeout=9000,
        )
        equipped_bot = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        assert equipped_bot["tool"] == {"type": "crude_axe", "durability": 100}, equipped_bot

        page.wait_for_function(
            "window.getGameState().bots.find(b => b.id === 1)?.tool?.durability === 99",
            timeout=5000,
        )
        after_hit = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
        assert after_hit["tool"] == {"type": "crude_axe", "durability": 99}, after_hit

        quarry_rect = {"kind": "rect", "x": 430, "y": 455, "w": 150, "h": 140}
        mine = page.evaluate("zone => window.assignBotProgram({ botId: 2, program: 'mine_stone', zone })", quarry_rect)
        assert mine["ok"] is True, mine
        page.wait_for_function(
            "window.getGameState().bots.find(b => b.id === 2)?.tool?.type === 'crude_pickaxe'",
            timeout=9000,
        )
        page.wait_for_function("zone => window.getGameState().objectRegistry.some(o => o.kind === 'item' && o.type === 'stone' && o.x >= zone.x && o.x <= zone.x + zone.w && o.y >= zone.y && o.y <= zone.y + zone.h)", arg=quarry_rect, timeout=8000)
        mined = page.evaluate("window.getGameState()")
        assert mined["bots"][1]["tool"]["type"] == "crude_pickaxe", mined["bots"][1]
        assert mined["stores"]["looseStones"] > 0, mined["stores"]

        pickup = page.evaluate("zone => window.assignBotProgram({ botId: 3, program: 'pickup_item', itemType: 'stone', zone })", quarry_rect)
        assert pickup["ok"] is True, pickup
        page.wait_for_function(
            "window.getGameState().bots.find(b => b.id === 3)?.inventory?.type === 'stone'",
            timeout=9000,
        )

        box = page.locator('#game').bounding_box()
        assert box, 'missing canvas box'
        page.fill('#chatInput', 'Bot 4 pick up logs from ')
        page.mouse.move(box['x'] + 120, box['y'] + 120)
        page.mouse.down()
        page.mouse.move(box['x'] + 220, box['y'] + 190)
        page.mouse.up()
        chat_value = page.locator('#chatInput').input_value()
        assert 'rect(x:' in chat_value and ',w:' in chat_value and ',h:' in chat_value, chat_value

        dsl = page.evaluate("window.validateDslProgram({ steps: [{ op: 'find_dug_hole' }, { op: 'plant_seed' }] })")
        assert dsl["ok"] is True, dsl
        assert "plant_trees" in page.evaluate("Object.keys(window.programTemplates)"), page.evaluate("Object.keys(window.programTemplates)")

        player_hole = page.evaluate("window.teachDebug.digHole(535, 520)")
        assert player_hole["ref"].startswith("hole:"), player_hole
        page.evaluate("window.teachDebug.movePlayerTo(535, 500)")
        assert page.evaluate("window.teachDebug.pickupNearest('tree_seed')") is True
        page.evaluate("window.teachDebug.movePlayerTo(535, 520)")
        assert page.evaluate("window.teachDebug.plantNearest()") is True
        player_planted = page.evaluate("window.getGameState()")
        assert player_planted["player"]["inventory"] is None, player_planted["player"]
        assert not any(h["id"] == player_hole["id"] for h in player_planted["holes"]), player_planted["holes"]
        assert any(o["kind"] == "resource" and o["type"] == "tree" and o["growthStage"] == "sapling" and abs(o["x"] - 535) <= 2 and abs(o["y"] - 520) <= 2 for o in player_planted["objectRegistry"]), player_planted["objectRegistry"]

        bot_hole = page.evaluate("window.teachDebug.digHole(565, 520)")
        assert bot_hole["ref"].startswith("hole:"), bot_hole
        page.evaluate("""
        () => {
          const input = document.getElementById('templateRouting');
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        """)
        page.fill('#chatInput', 'Bot 4 plant trees in rect(x:500,y:480,w:120,h:80)')
        page.press('#chatInput', 'Enter')
        page.wait_for_function("window.getGameState().bots.find(b => b.id === 4)?.program === 'plant_trees'", timeout=3000)
        page.wait_for_function(
            "window.getWorldObjects().filter(o => o.kind === 'resource' && o.type === 'tree' && o.growthStage === 'sapling' && o.planted).length >= 2",
            timeout=12000,
        )
        bot_planted = page.evaluate("window.getGameState()")
        assert bot_planted["bots"][3]["program"] == "plant_trees", bot_planted["bots"][3]

        browser.close()

    server.shutdown()

print("axe mechanics smoke passed")
