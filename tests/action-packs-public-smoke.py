#!/usr/bin/env python3
"""Public HTTPS smoke for custom action packs and registry-derived LLM context."""

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_action_packs_0617"
ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_action_packs_0617-public.png"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.getActionPackCatalog && window.clearCustomActionPacks && window.getAssistantPromptPreview")
    page.evaluate("() => { window.clearCustomActionPacks(); window.gameMenuDebug?.closeMainMenu?.(); window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('knowledge'); }")

    assert page.locator('[data-action-pack-op="pick_up"]').count() == 1
    assert page.locator('[data-action-pack-op="deposit_to_player"]').count() == 1
    assert page.locator('[data-action-pack-op="drop_item"]').count() == 1

    page.fill("#customPackName", "Public Courier Pack")
    page.fill("#customPackContextVariables", "availableBotNames\navailableItemTypes")
    page.check('[data-action-pack-op="pick_up"]')
    page.check('[data-action-pack-op="deposit_to_player"]')
    page.click("#saveCustomPack")
    page.wait_for_function("() => !!window.getCustomActionPacks().custom_public_courier_pack")
    page.evaluate("window.setAssistantLoadout(['custom_public_courier_pack'])")
    page.fill("#chatInput", "bot 1 bring log to me")
    page.evaluate("window.getAssistantPromptPreview()")

    knowledge = page.evaluate("JSON.parse(document.getElementById('assistantLoadoutView').textContent)")
    pack = knowledge["equippedPacks"][0]
    assert [action["op"] for action in pack["actions"]] == ["pick_up", "deposit_to_player"], pack
    assert pack["actions"][0]["validVariables"] == ["type", "zone"], pack
    assert pack["actions"][0]["dslSnippet"] == '{"op":"pick_up","type":"$type","zone":"$zone"}', pack
    assert "drop_item" not in knowledge["unlockedOps"], knowledge

    rejected = page.evaluate(
        """
        () => {
          try {
            window.validateAssistantDslAssignments([{ botId: 1, program: { steps: [
              { op: 'pick_up', type: 'log' },
              { op: 'drop_item' }
            ] } }]);
            return { ok: true };
          } catch (err) {
            return { ok: false, error: err.message };
          }
        }
        """
    )
    assert rejected["ok"] is False and "locked op drop_item" in rejected["error"], rejected

    page.screenshot(path=str(SCREENSHOT), full_page=True)
    browser.close()

print(f"public action packs smoke passed: {URL}")
print(f"screenshot: {SCREENSHOT}")
