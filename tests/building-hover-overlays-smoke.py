#!/usr/bin/env python3
"""Regression check: Pixi building hover overlays only appear while the building is hovered."""

from __future__ import annotations

import io
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import ROOT, SERVER_URL, start_local_server, wait_for_server

BASE_URL = (os.environ.get("ORCHESTRATOR_GROVE_BASE_URL") or "").rstrip("/")
SCREENSHOT = ROOT / "t_6ebb6251-building-hover-overlays-smoke.png"


def wait_for_paint(page) -> None:
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")


def screenshot_image(page) -> Image.Image:
    return Image.open(io.BytesIO(page.locator("#game").screenshot())).convert("RGB")


def region_difference(a: Image.Image, b: Image.Image, box: tuple[int, int, int, int]) -> int:
    diff = ImageChops.difference(a.crop(box), b.crop(box))
    histogram = diff.histogram()
    total = 0
    for channel in range(3):
        channel_histogram = histogram[channel * 256:(channel + 1) * 256]
        total += sum(value * count for value, count in enumerate(channel_histogram))
    return total


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.teachDebug && window.uiDebug && window.gameMenuDebug")
        page.evaluate(
            """
            async () => {
              const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              window.gameMenuDebug.startTest();
              await waitFrame();
              await waitFrame();
              window.uiDebug.setChatOpen(false);
              window.gameMenuDebug.closeMainMenu();
              document.activeElement?.blur();
              await waitFrame();
            }
            """
        )
        page.wait_for_function("() => window.getGameState().rendererBackend === 'pixi'")
        target = page.evaluate(
            """
            () => {
              const cam = window.getCameraState().camera;
              const s = window.teachDebug.placeStructure('sawbench', cam.x + 420, cam.y + 320);
              return { id: s.id, name: s.name, x: s.x, y: s.y, w: s.w || 90, h: s.h || 60 };
            }
            """
        )
        assert target and target["name"], target

        page.evaluate(
            """
            () => {
              const c = document.getElementById('game');
              c.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
            }
            """
        )
        wait_for_paint(page)
        off_hover = screenshot_image(page)

        overlay_box = page.evaluate(
            """
            ({ x, y, w, h }) => {
              const c = document.getElementById('game');
              const rect = c.getBoundingClientRect();
              const s = window.getCameraState();
              const zoom = s.camera.zoom || 1;
              const screenX = Math.round((x - s.camera.x) * zoom * rect.width / c.width);
              const screenY = Math.round((y - s.camera.y) * zoom * rect.height / c.height);
              const clientX = rect.left + screenX;
              const clientY = rect.top + screenY;
              c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX, clientY }));
              return {
                left: Math.max(0, screenX - 150),
                top: Math.max(0, screenY - 20),
                right: Math.min(c.width, screenX + 150),
                bottom: Math.min(c.height, screenY + Math.round(h * 0.65) + 42)
              };
            }
            """,
            target,
        )
        page.wait_for_function("() => document.getElementById('game').style.cursor === 'pointer'")
        wait_for_paint(page)
        on_hover = screenshot_image(page)

        diff_total = region_difference(
            off_hover,
            on_hover,
            (overlay_box["left"], overlay_box["top"], overlay_box["right"], overlay_box["bottom"]),
        )
        assert diff_total > 150000, {"diff_total": diff_total, "overlay_box": overlay_box}

        on_hover.save(SCREENSHOT)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?renderer=pixi&v=t_6ebb6251")
else:
    server = start_local_server()
    try:
        wait_for_server(f"{SERVER_URL}/index.html")
        run_smoke(f"{SERVER_URL}/index.html?renderer=pixi&v=t_6ebb6251")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

print("building hover overlays smoke passed")
