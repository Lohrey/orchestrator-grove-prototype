#!/usr/bin/env python3
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


def count_objects(page, kind, typ):
    return page.evaluate("([kind, typ]) => window.getWorldObjects().filter(o => o.kind === kind && o.type === typ).length", [kind, typ])


def resource(page, typ):
    return page.evaluate("typ => window.getWorldObjects().find(o => o.kind === 'resource' && o.type === typ && !o.depleted && !o.stump)", typ)


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/index.html?v=t_4eb359b9"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(url)
        page.wait_for_function("() => window.getGameState && window.teachDebug && window.getWorldObjects")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        tree = resource(page, "tree")
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 10, y); window.teachDebug.setInventory('crude_axe'); }", [tree["x"], tree["y"]])
        start_logs = count_objects(page, "item", "log")
        page.evaluate("window.teachDebug.interact()")
        target = page.evaluate("window.getGameState().player.target")
        assert target["action"] == "chop_tree" and target["started"] is True and target["total"] == 3, target
        page.evaluate("window.teachDebug.tickWorld(2.8)")
        mid_tree = page.evaluate("id => window.getWorldObjects().find(o => o.id === id)", tree["id"])
        assert mid_tree["hp"] == tree["hp"], {"before": tree, "mid": mid_tree}
        page.evaluate("window.teachDebug.tickWorld(0.35)")
        end_tree = page.evaluate("id => window.getWorldObjects().find(o => o.id === id)", tree["id"])
        assert end_tree["hp"] == tree["hp"] - 1, {"before": tree, "end": end_tree}
        assert count_objects(page, "item", "log") == start_logs + 1

        rock = resource(page, "stone_deposit")
        page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 10, y); window.teachDebug.setInventory('crude_pickaxe'); }", [rock["x"], rock["y"]])
        start_stones = count_objects(page, "item", "stone")
        page.evaluate("window.teachDebug.interact()")
        target = page.evaluate("window.getGameState().player.target")
        assert target["action"] == "mine_stone" and target["started"] is True and target["total"] == 3, target
        page.evaluate("window.teachDebug.tickWorld(2.8)")
        mid_rock = page.evaluate("id => window.getWorldObjects().find(o => o.id === id)", rock["id"])
        assert mid_rock["hp"] == rock["hp"], {"before": rock, "mid": mid_rock}
        page.evaluate("window.teachDebug.tickWorld(0.35)")
        end_rock = page.evaluate("id => window.getWorldObjects().find(o => o.id === id)", rock["id"])
        assert end_rock["hp"] == rock["hp"] - 1, {"before": rock, "end": end_rock}
        assert count_objects(page, "item", "stone") == start_stones + 1

        sawbench = page.evaluate("window.getGameState().structures.find(s => s.type === 'sawbench')")
        page.evaluate("([x, y, id]) => { window.teachDebug.movePlayerTo(x, y); window.teachDebug.setInventory('log'); window.teachDebug.depositToStructure(id); }", [sawbench["x"], sawbench["y"], sawbench["id"]])
        state = page.evaluate("window.getGameState()")
        sawbench = next(s for s in state["structures"] if s["id"] == sawbench["id"])
        assert sawbench["logs"] == 0 and sawbench["processing"] and sawbench["processing"]["label"] == "sawing log", sawbench
        assert state["player"]["target"]["action"] == "structure_processing", state["player"]
        page.evaluate("window.teachDebug.tickWorld(0.6)")
        state = page.evaluate("window.getGameState()")
        assert state["player"]["target"]["action"] == "structure_processing", state["player"]
        page.evaluate("window.teachDebug.tickWorld(1.0)")
        state = page.evaluate("window.getGameState()")
        sawbench = next(s for s in state["structures"] if s["id"] == sawbench["id"])
        assert sawbench["processing"] is None, sawbench
        assert count_objects(page, "item", "plank") >= 2

        browser.close()
    server.shutdown()

print("resource and production worker smoke passed")
