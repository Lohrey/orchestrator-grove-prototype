#!/usr/bin/env python3
"""Smoke check: Pixi world interactions keep bot/structure menus anchored to entity screen positions."""

from __future__ import annotations

import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import ROOT, SERVER_URL, start_local_server, wait_for_server

SHOT = ROOT / "t_pixi-world-menu-anchor-smoke.png"


def assert_near(actual: float, expected: float, tolerance: float = 10) -> None:
    assert abs(actual - expected) <= tolerance, {"actual": actual, "expected": expected, "tolerance": tolerance}


server = start_local_server()

try:
    wait_for_server(f"{SERVER_URL}/index.html")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

        page.goto(f"{SERVER_URL}/index.html?renderer=pixi&v=t_pixi_menu_anchor", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug && window.teachDebug")
        page.evaluate(
            """
            async () => {
              const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              window.gameMenuDebug.startTest();
              await waitFrame();
              await waitFrame();
            }
            """
        )
        page.wait_for_function("() => window.getGameState().gameMode === 'test' && !window.getGameState().paused")
        assert page.evaluate("() => window.getGameState().rendererBackend") == "pixi"

        bot_anchor = page.evaluate(
            """
            () => {
              const bot = window.getGameState().bots.find(entry => entry.id === 1);
              const camera = window.getCameraState().camera;
              const canvas = document.getElementById('game');
              const rect = canvas.getBoundingClientRect();
              const zoom = camera.zoom || 1;
              const clientX = rect.left + (bot.x - camera.x) * zoom * rect.width / canvas.width;
              const clientY = rect.top + (bot.y - camera.y) * zoom * rect.height / canvas.height;
              canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }));
              return {
                name: bot.name,
                expectedLeft: Math.min(clientX, window.innerWidth - 310),
                expectedTop: Math.min(clientY, window.innerHeight - 260)
              };
            }
            """
        )
        page.wait_for_function("() => !document.getElementById('botMenu').hidden")
        bot_menu = page.locator("#botMenu").bounding_box()
        assert bot_menu is not None
        assert page.locator("#botMenu .bot-menu-title b").inner_text() == bot_anchor["name"]
        assert_near(bot_menu["x"], bot_anchor["expectedLeft"])
        assert_near(bot_menu["y"], bot_anchor["expectedTop"])

        structure_anchor = page.evaluate(
            """
            () => {
              const camera = window.getCameraState().camera;
              const placed = window.teachDebug.placeStructure('sawbench', camera.x + 520, camera.y + 340);
              const canvas = document.getElementById('game');
              const rect = canvas.getBoundingClientRect();
              const zoom = camera.zoom || 1;
              const worldX = placed.x + ((placed.w || 48) / 2);
              const worldY = placed.y + ((placed.h || 48) / 2);
              const clientX = rect.left + (worldX - camera.x) * zoom * rect.width / canvas.width;
              const clientY = rect.top + (worldY - camera.y) * zoom * rect.height / canvas.height;
              canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX, clientY }));
              return {
                name: placed.name,
                expectedLeft: Math.min(clientX, window.innerWidth - 310),
                expectedTop: Math.min(clientY, window.innerHeight - 260)
              };
            }
            """
        )
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden")
        structure_menu = page.locator("#structureMenu").bounding_box()
        assert structure_menu is not None
        assert page.locator("#structureMenu b").first.inner_text() == structure_anchor["name"]
        assert_near(structure_menu["x"], structure_anchor["expectedLeft"])
        assert_near(structure_menu["y"], structure_anchor["expectedTop"])

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()
        assert not errors, errors
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print(f"pixi world menu anchor smoke passed: {SHOT}")
