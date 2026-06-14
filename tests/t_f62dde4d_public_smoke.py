#!/usr/bin/env python3
"""Public smoke for t_f62dde4d mode split and online lake map."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_f62dde4d-online-lake-public.png"
BASE = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto(f"{BASE}/index.html?multiplayer=host&session=t-f62dde4d-public&v=t_f62dde4d_modes", wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.getGameState().multiplayer?.enabled")
    state = page.evaluate("window.getGameState()")
    mp = state["multiplayer"]
    assert mp["mapMode"] == "online_lakes", mp
    assert mp["thrones"] == [], mp["thrones"]
    assert len([f for f in mp["mapFeatures"] if f["type"] == "lake"]) == 2, mp["mapFeatures"]
    assert len([f for f in mp["mapFeatures"] if f["type"] == "camper_van"]) == 2, mp["mapFeatures"]
    page.screenshot(path=str(SCREENSHOT), full_page=True)

    page.goto(f"{BASE}/index.html?multiplayer=local-ai&session=t-f62dde4d-ai&v=t_f62dde4d_modes", wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.getGameState().multiplayer?.mapMode === 'local_ai'")
    local_state = page.evaluate("window.getGameState()")
    assert len(local_state["multiplayer"]["thrones"]) == 2, local_state["multiplayer"]
    assert len(local_state["multiplayer"]["towers"]) == 6, local_state["multiplayer"]
    assert local_state["multiplayer"]["aiWave"]["enabled"] is True, local_state["multiplayer"]["aiWave"]
    browser.close()

print("t_f62dde4d public smoke passed")
