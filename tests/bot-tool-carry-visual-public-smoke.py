#!/usr/bin/env python3
"""Public regression: bot-held crude tools are carried at the hand in the Pixi backend."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import BOT_TOOL_CAPTURE_JS

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_fe2b07c8"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_fe2b07c8-bot-tool-carry-public.png")
IGNORED_WARNING_TEXT = "GPU stall due to ReadPixels"

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

    page.goto(URL, wait_until="domcontentloaded", timeout=20000)
    page.wait_for_function("() => window.getGameState", timeout=20000)

    result = page.evaluate(BOT_TOOL_CAPTURE_JS)

    assert result["aboveLogDiff"] > result["aboveToolDiff"] * 2 + 1000, result
    assert result["handToolDiff"] > result["handLogDiff"] * 2 + 1000, result
    assert result["handToolDiff"] > 1500, result
    assert result["pixiLoaded"], result
    assert result["rendererBackend"] == "pixi", result
    page.screenshot(path=str(SHOT), full_page=False)
    browser.close()
    assert not errors, errors

print(f"public bot tool carry visual smoke passed: {URL}")
print(f"screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}")
