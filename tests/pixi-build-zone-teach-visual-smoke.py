#!/usr/bin/env python3
"""Smoke check: Pixi shows build ghosts, zone drafts, and teach-location drafts on the live canvas."""

from __future__ import annotations

import io
import subprocess
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import ROOT, SERVER_URL, start_local_server, wait_for_server

SHOT = ROOT / "t_pixi-build-zone-teach-visual-smoke.png"


def wait_for_paint(page) -> None:
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")


def screenshot_image(page) -> Image.Image:
    return Image.open(io.BytesIO(page.locator("#game").screenshot())).convert("RGB")


def diff_total(a: Image.Image, b: Image.Image, box: tuple[int, int, int, int]) -> int:
    diff = ImageChops.difference(a.crop(box), b.crop(box))
    histogram = diff.histogram()
    total = 0
    for channel in range(3):
        channel_histogram = histogram[channel * 256:(channel + 1) * 256]
        total += sum(value * count for value, count in enumerate(channel_histogram))
    return total


def world_mouse(page, event_type: str, world_x: float, world_y: float, button: int = 0) -> None:
    page.evaluate(
        """
        ([eventType, worldX, worldY, button]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const zoom = s.camera.zoom || 1;
          const clientX = rect.left + (worldX - s.camera.x) * zoom * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * zoom * rect.height / c.height;
          c.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, button, clientX, clientY }));
        }
        """,
        [event_type, world_x, world_y, button],
    )


server = start_local_server()

try:
    wait_for_server(f"{SERVER_URL}/index.html")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

        page.goto(f"{SERVER_URL}/index.html?renderer=pixi&v=t_pixi_build_zone_teach", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug && window.teachDebug && window.uiDebug")
        page.evaluate(
            """
            async () => {
              const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              window.gameMenuDebug.startTest();
              await waitFrame();
              await waitFrame();
              window.uiDebug.setChatOpen(false);
              document.activeElement?.blur();
              await waitFrame();
            }
            """
        )
        page.wait_for_function("() => window.getGameState().rendererBackend === 'pixi'")

        # Build ghost
        page.click("#buildDrawerToggle")
        page.click("[data-build-tab='production']")
        build_before = screenshot_image(page)
        page.click("[data-build='sawbench']")
        world_mouse(page, "mousemove", 520, 380, 0)
        wait_for_paint(page)
        build_after = screenshot_image(page)
        build_box = (460, 320, 580, 440)
        assert diff_total(build_before, build_after, build_box) > 80000

        # Rectangle zone draft
        page.click("#zonesDrawerToggle")
        page.click("#drawZoneDrawerButton")
        zone_before = screenshot_image(page)
        world_mouse(page, "mousedown", 300, 260, 0)
        world_mouse(page, "mousemove", 410, 340, 0)
        wait_for_paint(page)
        zone_after = screenshot_image(page)
        zone_box = (280, 240, 430, 360)
        assert diff_total(zone_before, zone_after, zone_box) > 100000
        world_mouse(page, "mouseup", 410, 340, 0)
        wait_for_paint(page)

        # Teach-location draft uses the same renderer overlay path under Pixi.
        page.evaluate("window.teachDebug.start(1)")
        page.evaluate("window.teachDebug.recordStep({ op: 'pick_up', type: 'log' })")
        page.evaluate("window.teachDebug.editStepLocation(0, 'draw_zone')")
        teach_before = screenshot_image(page)
        world_mouse(page, "mousedown", 700, 260, 0)
        world_mouse(page, "mousemove", 840, 360, 0)
        wait_for_paint(page)
        teach_after = screenshot_image(page)
        teach_box = (680, 240, 860, 380)
        assert diff_total(teach_before, teach_after, teach_box) > 110000
        world_mouse(page, "mouseup", 840, 360, 0)
        page.wait_for_function("() => window.getGameState().zones.length >= 2")

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()
        assert not errors, errors
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print(f"pixi build/zone/teach visual smoke passed: {SHOT}")
