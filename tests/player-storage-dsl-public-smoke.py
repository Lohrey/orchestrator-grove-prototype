#!/usr/bin/env python3
"""Public HTTPS smoke for player-as-storage DSL actions."""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_c4955ba2_player_storage"
SHOT = Path("/root/agent-api-hub/public/prototypes/orchestrator-grove/t_c4955ba2-player-storage-public.png")


def tick(page, seconds: float, step: float = 0.05) -> None:
    page.evaluate(
        """
        ([seconds, step]) => {
          for (let t = 0; t < seconds; t += step) window.teachDebug.tickWorld(step);
        }
        """,
        [seconds, step],
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.generateAssistantDsl")
    page.locator("#mainMenuNewBtn").click()
    page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

    page.evaluate("window.setAssistantLoadout(['starter_automation'])")
    parsed = page.evaluate("window.generateAssistantDsl('bot 1 bring log to me')")
    assignment = (parsed.get("dslAssignments") or [])[0]
    assert assignment["program"]["steps"][1]["op"] == "deposit_to_player", assignment
    assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", assignment)
    assert assigned["ok"] is True, assigned
    tick(page, 8)
    state = page.evaluate("window.getGameState()")
    assert state["player"]["inventory"]["type"] == "log", state["player"]

    page.evaluate("window.teachDebug.pauseBot(1); window.teachDebug.setInventory('stone')")
    take_assignment = {
        "botId": 2,
        "program": {"steps": [{"op": "take_from_player", "type": "stone"}, {"op": "loop"}]},
    }
    assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", take_assignment)
    assert assigned["ok"] is True, assigned
    tick(page, 4)
    state = page.evaluate("window.getGameState()")
    bot2 = next(b for b in state["bots"] if b["id"] == 2)
    assert state["player"]["inventory"] is None, state["player"]
    assert bot2["inventory"]["type"] == "stone", bot2

    page.screenshot(path=str(SHOT), full_page=True)
    browser.close()

print(f"public player storage smoke passed; screenshot={SHOT}; url={URL}")
