#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_c5cec6a1_terrain"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_c5cec6a1-terrain-lush-public.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.goto(URL, wait_until="domcontentloaded", timeout=20000)
    page.wait_for_function("() => window.getGameState && window.getCameraState", timeout=20000)
    page.get_by_role("button", name="Start new game").click()
    page.wait_for_timeout(900)
    camera_state = page.evaluate("window.getCameraState()")
    assert camera_state["map"]["width"] >= 3000 and camera_state["map"]["height"] >= 2000, camera_state["map"]
    metrics = page.evaluate(
        """
        () => {
          const canvas = document.getElementById('game');
          const ctx = canvas.getContext('2d');
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let greenLead = 0, saturated = 0, dark = 0, bright = 0, samples = 0;
          for (let i = 0; i < data.length; i += 4 * 23) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            samples += 1;
            if (g > r + 8 && g > b + 8) greenLead += 1;
            if (Math.max(r, g, b) - Math.min(r, g, b) > 34) saturated += 1;
            const luma = (r + g + b) / 3;
            if (luma < 55) dark += 1;
            if (luma > 95) bright += 1;
          }
          return {
            greenRatio: greenLead / samples,
            saturatedRatio: saturated / samples,
            darkRatio: dark / samples,
            brightRatio: bright / samples
          };
        }
        """
    )
    assert metrics["greenRatio"] > 0.28, metrics
    assert metrics["saturatedRatio"] > 0.22, metrics
    assert metrics["darkRatio"] > 0.03 and metrics["brightRatio"] > 0.03, metrics
    page.screenshot(path=str(SHOT), full_page=False)
    browser.close()
    if errors:
        raise AssertionError("\n".join(errors[:20]))

print(f"public terrain lush smoke passed: {URL}")
print(f"screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}")
