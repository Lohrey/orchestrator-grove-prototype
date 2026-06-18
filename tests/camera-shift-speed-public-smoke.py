#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_9f2729b2"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_9f2729b2-camera-shift-speed-public.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getCameraState && window.teachDebug")
    page.evaluate("() => { if (window.gameMenuDebug?.isPaused?.()) window.gameMenuDebug.startTest?.(); }")
    page.wait_for_function("() => !window.gameMenuDebug?.isPaused?.()")

    def key_event(kind: str, key: str) -> None:
        page.evaluate(
            "([kind, key]) => window.dispatchEvent(new KeyboardEvent(kind, { key, bubbles: true, cancelable: true }))",
            [kind, key],
        )

    start = page.evaluate("window.getCameraState().camera")
    key_event("keydown", "d")
    normal = page.evaluate("() => { window.teachDebug.tickWorld(1); return window.getCameraState().camera; }")
    key_event("keyup", "d")

    key_event("keydown", "Shift")
    key_event("keydown", "d")
    fast = page.evaluate("() => { window.teachDebug.tickWorld(1); return window.getCameraState().camera; }")
    key_event("keyup", "d")
    key_event("keyup", "Shift")

    normal_delta = normal["x"] - start["x"]
    fast_delta = fast["x"] - normal["x"]
    assert 500 <= normal_delta <= 540, {"normal_delta": normal_delta, "start": start, "normal": normal}
    assert fast_delta >= normal_delta * 2.2, {"normal_delta": normal_delta, "fast_delta": fast_delta, "fast": fast}
    assert fast.get("fastMultiplier", 0) >= 2.3, fast
    page.screenshot(path=str(SHOT), full_page=True)
    browser.close()

print(f"public camera shift speed smoke passed: {URL}")
print(f"screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}")
