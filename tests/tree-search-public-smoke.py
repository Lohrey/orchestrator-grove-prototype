#!/usr/bin/env python3
"""Public HTTPS smoke for bare-hand tree search."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_c8a17145"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_c8a17145-tree-search-public-verification.png")


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


def item_count(page, item_type: str) -> int:
    return page.evaluate("type => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === type).length", item_type)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.getWorldObjects", timeout=15000)
    assert page.evaluate("() => [...document.scripts].some(s => s.src.includes('game.js?v=t_c8a17145'))")

    tree = next(o for o in page.evaluate("window.getWorldObjects()") if o["kind"] == "resource" and o["type"] == "tree" and not o["stump"])
    sticks = item_count(page, "stick")
    seeds = item_count(page, "tree_seed")
    page.evaluate("window.teachDebug.start(1)")
    page.evaluate("([x, y]) => { window.teachDebug.movePlayerTo(x - 30, y); window.teachDebug.setInventory(null); }", [tree["x"], tree["y"]])
    dispatch_world_mouse(page, "contextmenu", tree["x"], tree["y"], 2)
    page.wait_for_function("() => window.getGameState().player.target?.action === 'search_tree' && window.getGameState().player.target?.started === true", timeout=5000)
    page.wait_for_function(
        "([sticks, seeds]) => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'stick').length === sticks + 1 && window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'tree_seed').length === seeds + 1",
        arg=[sticks, seeds],
        timeout=9000,
    )
    steps = page.evaluate("window.getGameState().recorder.steps")
    assert steps and steps[0]["op"] == "search_tree" and "sticks and seeds" in steps[0]["text"], steps
    page.screenshot(path=str(SHOT), full_page=True)
    browser.close()

print(f"public tree search smoke passed: {URL}")
print(f"screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}")
