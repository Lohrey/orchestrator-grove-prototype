#!/usr/bin/env python3
"""Public smoke checks for bot context-menu JSON editor and DSL card accept flow."""

from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_b5a16881_bot_editor"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_b5a16881-bot-program-editor-public.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.teachDebug")
    page.locator("#mainMenuNewBtn").click()
    page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
    page.locator("#mainMenuStartSelectedBtn").click()
    page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")
    page.evaluate("window.teachDebug.openBotMenu(1)")
    page.wait_for_selector("#botMenu [data-bot-json-editor]")
    assert page.locator("#botMenu [data-save-json]").is_visible()
    assert page.locator("#botMenu [data-bot-program-steps] .bot-program-step-card").count() >= 1
    program = {
        "id": "public_menu_json_loop",
        "name": "Public Menu JSON Loop",
        "steps": [
            {"op": "pick_up", "type": "crude_axe"},
            {"op": "chop_tree"},
            {"op": "loop"},
        ],
    }
    import json
    page.locator("#botMenu [data-bot-json-editor]").fill(json.dumps(program, indent=2))
    page.locator("#botMenu [data-save-json]").click()
    page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.taughtLoop?.[1]?.op === 'chop_tree'")
    page.evaluate("window.teachDebug.openBotMenu(1)")
    page.locator("#botMenu [data-bot-program-steps] [data-bot-step-type='0']").evaluate(
        "el => { el.value = 'crude_pickaxe'; el.dispatchEvent(new Event('change', { bubbles: true })); }"
    )
    page.locator("#botMenu [data-accept-dsl-cards]").click()
    page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.taughtLoop?.[0]?.type === 'crude_pickaxe'")
    page.screenshot(path=str(SHOT), full_page=True)
    browser.close()

print(f"public bot program editor smoke passed; screenshot={SHOT}")
