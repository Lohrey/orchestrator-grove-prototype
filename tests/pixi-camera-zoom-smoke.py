#!/usr/bin/env python3
"""Smoke check: camera pan and wheel zoom work on the native Pixi renderer path."""

from __future__ import annotations

import io
import subprocess
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import ROOT, SERVER_URL, start_local_server, wait_for_server

SHOT = ROOT / "t_pixi-camera-zoom-smoke.png"


def screenshot_image(page) -> Image.Image:
    return Image.open(io.BytesIO(page.locator("#game").screenshot())).convert("RGB")


def image_diff_total(a: Image.Image, b: Image.Image) -> int:
    diff = ImageChops.difference(a, b)
    histogram = diff.histogram()
    total = 0
    for channel in range(3):
        channel_histogram = histogram[channel * 256:(channel + 1) * 256]
        total += sum(value * count for value, count in enumerate(channel_histogram))
    return total


server = start_local_server()

try:
    wait_for_server(f"{SERVER_URL}/index.html")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 840})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

        page.goto(f"{SERVER_URL}/index.html?renderer=pixi&v=t_pixi_camera_zoom", wait_until="networkidle")
        page.wait_for_function("() => window.getCameraState && window.teachDebug && window.gameMenuDebug")
        page.evaluate("() => { if (window.gameMenuDebug?.isPaused?.()) window.gameMenuDebug.startTest?.(); }")
        page.wait_for_function("() => !window.gameMenuDebug?.isPaused?.()")
        assert page.evaluate("() => window.getGameState().rendererBackend") == "pixi"

        start = page.evaluate("window.getCameraState().camera")
        start_image = screenshot_image(page)

        page.evaluate(
            """
            () => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true }));
            }
            """
        )
        after_pan = page.evaluate("() => { window.teachDebug.tickWorld(1); return window.getCameraState().camera; }")
        page.evaluate("() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true, cancelable: true }))")
        pan_image = screenshot_image(page)
        assert after_pan["x"] - start["x"] >= 500, {"start": start, "after_pan": after_pan}
        assert image_diff_total(start_image, pan_image) > 5000000

        canvas_box = page.locator("#game").bounding_box()
        assert canvas_box is not None
        page.mouse.move(canvas_box["x"] + canvas_box["width"] / 2, canvas_box["y"] + canvas_box["height"] / 2)
        page.mouse.wheel(0, -1000)
        page.wait_for_timeout(100)
        zoomed = page.evaluate("window.getCameraState().camera")
        zoom_image = screenshot_image(page)
        assert zoomed["zoom"] > after_pan["zoom"], {"after_pan": after_pan, "zoomed": zoomed}
        assert image_diff_total(pan_image, zoom_image) > 5000000

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()
        assert not errors, errors
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print(f"pixi camera zoom smoke passed: {SHOT}")
