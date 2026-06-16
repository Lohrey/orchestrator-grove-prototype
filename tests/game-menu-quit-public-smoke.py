#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_da65bf46_quit_menu"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_da65bf46-quit-main-menu-public.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.gameMenuDebug")
    assert page.locator("#mainMenuOverlay").is_visible()

    page.locator("#mainMenuNewBtn").click()
    page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
    page.locator("#mainMenuStartSelectedBtn").click()
    page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")
    page.keyboard.press("Escape")
    page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden && window.getGameState().paused")

    page.evaluate("() => window.gameMenuDebug.setLastSaveAgeSeconds(31)")
    page.locator("#quitToMainMenuBtn").click()
    page.wait_for_function("() => !document.getElementById('quitSavePrompt').hidden")
    assert page.locator("#saveAndQuitBtn").is_visible()
    assert page.locator("#quitWithoutSaveBtn").is_visible()
    assert page.locator("#cancelQuitBtn").is_visible()
    page.screenshot(path=str(SHOT), full_page=True)

    page.locator("#saveAndQuitBtn").click()
    page.wait_for_function("() => !document.getElementById('mainMenuOverlay').hidden && document.getElementById('settingsOverlay').hidden")
    assert page.evaluate("window.getGameState().paused") is True
    assert page.evaluate("window.gameMenuDebug.wasSavedRecently()") is True
    browser.close()

print(f"public game menu quit smoke passed; screenshot={SHOT}")
