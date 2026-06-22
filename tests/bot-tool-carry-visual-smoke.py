#!/usr/bin/env python3
"""Regression: bot-held crude tools are carried at the hand in the Pixi backend."""

from __future__ import annotations

import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import BOT_TOOL_CAPTURE_JS, ROOT, SERVER_URL, start_local_server, wait_for_server

SHOT = ROOT / "t_fe2b07c8-bot-tool-carry-smoke.png"
IGNORED_WARNING_TEXT = "GPU stall due to ReadPixels"
server = start_local_server()

try:
    wait_for_server(f"{SERVER_URL}/index.html")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 420, "height": 280})
        errors: list[str] = []
        page.on(
            "console",
            lambda msg: errors.append(f"{msg.type}: {msg.text}")
            if msg.type in ("error", "warning") and IGNORED_WARNING_TEXT not in msg.text
            else None,
        )
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

        page.goto(f"{SERVER_URL}/index.html?renderer=pixi&v=t_fe2b07c8", wait_until="domcontentloaded")
        page.wait_for_function("() => window.getGameState")

        result = page.evaluate(BOT_TOOL_CAPTURE_JS)

        assert result["aboveLogDiff"] > result["aboveToolDiff"] * 2 + 1000, result
        assert result["handToolDiff"] > result["handLogDiff"] * 2 + 1000, result
        assert result["handToolDiff"] > 1500, result
        assert result["rendererBackend"] == "pixi", result
        assert result["pixiLoaded"], result

        page.screenshot(path=str(SHOT), full_page=False)
        browser.close()

        assert not errors, errors
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print(f"bot tool carry visual smoke passed: {SHOT}")
