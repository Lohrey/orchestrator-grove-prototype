#!/usr/bin/env python3
"""Public HTTPS regression for search_tree zone editing and single tree-search reservation."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_513a4e6c"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_513a4e6c-tree-search-zone-reservation-public.png")


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


def nearby_count(page, item_type: str, x: float, y: float, radius: float = 36) -> int:
    return page.evaluate(
        """
        ([type, x, y, radius]) => window.getWorldObjects().filter(o =>
          o.kind === 'item' && o.type === type && Math.hypot(o.x - x, o.y - y) <= radius
        ).length
        """,
        [item_type, x, y, radius],
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.getWorldObjects", timeout=15000)
    assert page.evaluate("() => [...document.scripts].some(s => s.src.includes('game.js?v=t_513a4e6c'))")

    trees = [o for o in page.evaluate("window.getWorldObjects()") if o["kind"] == "resource" and o["type"] == "tree" and not o["stump"]]
    original_tree = trees[0]
    zone_tree = trees[1]

    page.evaluate("window.teachDebug.start(1)")
    page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 30, y); window.teachDebug.setInventory(null); }", [original_tree["x"], original_tree["y"]])
    right_click_world(page, original_tree["x"], original_tree["y"])
    page.wait_for_function("() => window.getGameState().recorder.steps.some(s => s.op === 'search_tree')", timeout=9000)

    page.evaluate("window.beginZoneDrawing()")
    dispatch_world_mouse(page, "mousedown", zone_tree["x"] - 32, zone_tree["y"] - 32)
    dispatch_world_mouse(page, "mousemove", zone_tree["x"] + 32, zone_tree["y"] + 32)
    dispatch_world_mouse(page, "mouseup", zone_tree["x"] + 32, zone_tree["y"] + 32)
    page.wait_for_function("() => window.getGameState().zones.length === 1")

    page.evaluate("window.teachDebug.editStepLocation(0)")
    assert page.evaluate("([x, y]) => window.teachDebug.applyLocation(x, y)", [zone_tree["x"], zone_tree["y"]]) is True
    edited = page.evaluate("window.getGameState().recorder.steps[0]")
    assert edited.get("zoneId") == "zone:1" and "treeId" not in edited and edited["text"] == "search trees in zone 1 for sticks and seeds", edited

    before_sticks = nearby_count(page, "stick", zone_tree["x"], zone_tree["y"])
    before_seeds = nearby_count(page, "tree_seed", zone_tree["x"], zone_tree["y"])
    assert page.evaluate("window.teachDebug.assignToBot(1).ok") is True
    assert page.evaluate("window.teachDebug.assignToBot(2).ok") is True
    page.wait_for_function("treeId => window.getWorldObjects().some(o => o.kind === 'resource' && o.numericId === treeId && o.searchReservedBy)", arg=zone_tree["numericId"], timeout=6000)
    reserved = page.evaluate("treeId => window.getWorldObjects().find(o => o.kind === 'resource' && o.numericId === treeId).searchReservedBy", zone_tree["numericId"])
    assert reserved in (1, 2), reserved
    page.wait_for_function("() => window.getGameState().bots.some(b => b.message.includes('waiting for an unsearched tree in zone 1'))", timeout=4000)

    right_click_world(page, zone_tree["x"], zone_tree["y"])
    assert page.evaluate("() => window.getGameState().player.target?.action !== 'search_tree'")
    assert page.evaluate("treeId => window.getWorldObjects().find(o => o.kind === 'resource' && o.numericId === treeId).searchReservedBy", zone_tree["numericId"]) == reserved

    page.wait_for_function(
        "([type, x, y, radius, before]) => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === type && Math.hypot(o.x - x, o.y - y) <= radius).length > before",
        arg=["stick", zone_tree["x"], zone_tree["y"], 36, before_sticks],
        timeout=10000,
    )
    page.wait_for_function(
        "([type, x, y, radius, before]) => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === type && Math.hypot(o.x - x, o.y - y) <= radius).length > before",
        arg=["tree_seed", zone_tree["x"], zone_tree["y"], 36, before_seeds],
        timeout=10000,
    )
    page.screenshot(path=str(SHOT), full_page=True)
    browser.close()

print(f"public tree search zone/reservation smoke passed: {URL}")
print(f"screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}")
