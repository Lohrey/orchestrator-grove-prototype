#!/usr/bin/env python3
"""Public HTTPS smoke for player-created-only zones."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_2412e0c7"
SCREENSHOT = Path(__file__).resolve().parents[1] / "t_2412e0c7-start-zones-public-verification.png"


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


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState")

    initial = page.evaluate("window.getGameState().zones")
    assert initial == [], initial
    assert page.evaluate("window.getWorldObjects().filter(o => o.kind === 'zone')") == []

    page.click("#drawZoneButton")
    dispatch_world_mouse(page, "mousedown", 200, 220)
    dispatch_world_mouse(page, "mousemove", 360, 340)
    dispatch_world_mouse(page, "mouseup", 360, 340)
    page.wait_for_function("() => window.getGameState().zones.length === 1")

    zone = page.evaluate("window.getGameState().zones[0]")
    assert zone["id"] == "zone:1", zone
    assert zone["name"] == "zone 1", zone
    assert zone.get("builtIn") in (None, False), zone
    page.screenshot(path=str(SCREENSHOT), full_page=True)
    browser.close()

print(f"public start zones smoke passed: {SCREENSHOT}")
