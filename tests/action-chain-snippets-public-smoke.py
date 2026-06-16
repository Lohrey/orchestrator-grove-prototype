#!/usr/bin/env python3
"""Public smoke for Settings -> Action chain DSL snippets."""

from __future__ import annotations

from pathlib import Path
from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_action_chain_snippets"
ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_action_chain_snippets-public.png"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors: list[str] = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.actionStepChainRows && window.uiDebug && window.allowedProgramOps")
    page.evaluate("() => { window.gameMenuDebug?.closeMainMenu?.(); window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('step-chain'); }")
    rows = page.evaluate("window.actionStepChainRows")
    allowed = page.evaluate("window.allowedProgramOps")
    assert len(rows) == len(allowed) == page.locator("#actionStepChainTable tbody tr").count(), (len(rows), len(allowed))
    text = page.locator("#actionStepChainTable").inner_text()
    assert "DSL snippet" in text, text
    assert '{"op":"pick_up","type":"$type","zone":"$zone"}' in text, text
    assert '{"op":"loop"}' in text, text
    assert page.evaluate("window.actionStepChainRows.find(row => row.op === 'deposit_to_structure').dslSnippet") == '{"op":"deposit_to_structure","type":"$type","target":"$target"}'
    page.screenshot(path=str(SCREENSHOT), full_page=True)
    assert not errors, errors
    browser.close()

print(f"public action-chain DSL snippet smoke passed: {URL}")
print(f"screenshot: {SCREENSHOT}")
