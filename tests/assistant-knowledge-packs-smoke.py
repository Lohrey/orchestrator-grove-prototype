#!/usr/bin/env python3
"""Smoke checks for assistant knowledge packs and generated DSL assignments."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def wait_ready(page) -> None:
    page.wait_for_function(
        "() => window.getGameState && window.generateAssistantDsl && window.assignCustomDslProgram && window.assistantKnowledgePacks && window.getAssistantLoadoutDebug && window.getAssistantPromptPreview && window.getCustomActionPacks && window.getActionPackCatalog"
    )


def set_template_routing(page, enabled: bool) -> None:
    page.evaluate(
        """
        enabled => {
          const input = document.getElementById('templateRouting');
          input.checked = enabled;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        """,
        enabled,
    )


def submit_chat(page, text: str) -> None:
    page.fill("#chatInput", text)
    page.click("#askButton")


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(url, wait_until="networkidle")
            wait_ready(page)
            page.evaluate("window.gameMenuDebug?.closeMainMenu?.()")

            packs = page.evaluate("window.assistantKnowledgePacks")
            loadout = page.evaluate("window.assistantLoadout")
            assert "starter_automation" in packs, packs
            assert "woodworking" in loadout and "logistics" in loadout, loadout
            assert "Assistant knowledge packs" in page.evaluate("window.dslActionWikiText"), page.evaluate("window.dslActionWikiText")

            page.evaluate("window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('knowledge')")
            knowledge_class = page.locator('[data-settings-panel="knowledge"]').get_attribute("class") or ""
            assert "is-active" in knowledge_class, knowledge_class
            assert page.locator("#knowledgePackList [data-knowledge-pack]").count() == len(packs)
            debug = page.evaluate("window.getAssistantLoadoutDebug()")
            assert "mine_stone" in debug["unlockedOps"], debug
            assert "Mining + Tools" in page.locator("#knowledgePackList").inner_text()
            prompt_before = page.evaluate("window.getAssistantPromptPreview()")
            assert "SYSTEM:" in prompt_before and "USER:" in prompt_before, prompt_before
            assert "[current user request will appear here]" in prompt_before, prompt_before
            assert '"id":"mining_tools"' in prompt_before, prompt_before
            page.fill("#chatInput", "bot 1 feed sawbench with logs")
            prompt_with_request = page.evaluate("window.getAssistantPromptPreview()")
            assert "Request: bot 1 feed sawbench with logs" in prompt_with_request, prompt_with_request
            page.uncheck('[data-knowledge-pack="mining_tools"]')
            stored = page.evaluate("localStorage.getItem('orchestratorGrove.assistantLoadout.v1')")
            assert "mining_tools" not in stored, stored
            debug = page.evaluate("window.getAssistantLoadoutDebug()")
            assert "mine_stone" not in debug["unlockedOps"], debug
            prompt_after = page.locator("#assistantPromptPreview").inner_text()
            assert '"id":"mining_tools"' not in prompt_after, prompt_after
            assert "Request: bot 1 feed sawbench with logs" in prompt_after, prompt_after
            mining_parse = page.evaluate("window.generateAssistantDsl('bot 1 mine stone')")
            assert not mining_parse.get("dslAssignments"), mining_parse

            page.fill("#customPackName", "Player Courier Test")
            page.fill("#customPackContextVariables", "availableBotNames\navailableItemTypes")
            page.check('[data-action-pack-op="pick_up"]')
            page.check('[data-action-pack-op="deposit_to_player"]')
            page.click("#saveCustomPack")
            page.wait_for_function("() => !!window.getCustomActionPacks().custom_player_courier_test")
            assert page.locator('[data-knowledge-pack="custom_player_courier_test"]').count() == 1
            page.evaluate("window.setAssistantLoadout(['custom_player_courier_test'])")
            custom_debug = page.evaluate("window.getAssistantLoadoutDebug()")
            assert custom_debug["selectedPackIds"] == ["custom_player_courier_test"], custom_debug
            assert custom_debug["unlockedOps"] == ["pick_up", "deposit_to_player"], custom_debug
            page.fill("#chatInput", "bot 1 bring log to me")
            custom_prompt = page.evaluate("window.getAssistantPromptPreview()")
            assert '"id":"custom_player_courier_test"' in custom_prompt, custom_prompt
            custom_knowledge = page.evaluate("JSON.parse(document.getElementById('assistantLoadoutView').textContent)")
            custom_pack = custom_knowledge["equippedPacks"][0]
            custom_ops = [action["op"] for action in custom_pack["actions"]]
            assert custom_ops == ["pick_up", "deposit_to_player"], custom_pack
            assert custom_pack["actions"][0]["validVariables"] == ["type", "zone"], custom_pack
            assert custom_pack["actions"][0]["dslSnippet"] == '{"op":"pick_up","type":"$type","zone":"$zone"}', custom_pack
            assert custom_pack["actions"][1]["promptSignature"].startswith("deposit_to_player"), custom_pack
            assert "drop_item" not in custom_knowledge["unlockedOps"], custom_knowledge
            assert all(action["op"] != "drop_item" for action in custom_knowledge["actionGuide"]), custom_knowledge
            custom_bad_validation = page.evaluate(
                """
                () => {
                  try {
                    window.validateAssistantDslAssignments([{ botId: 1, program: { steps: [
                      { op: 'pick_up', type: 'log' },
                      { op: 'drop_item', type: 'log' }
                    ] } }]);
                    return { ok: true };
                  } catch (err) {
                    return { ok: false, error: err.message };
                  }
                }
                """
            )
            assert custom_bad_validation["ok"] is False, custom_bad_validation
            assert "locked op drop_item" in custom_bad_validation["error"], custom_bad_validation

            page.evaluate("window.setAssistantLoadout(['starter_automation'])")
            page.fill("#chatInput", "make bot 1 pick up crude_axe and chop tree")
            starter_prompt = page.evaluate("window.getAssistantPromptPreview()")
            assert '"lockedRequestHints"' in starter_prompt, starter_prompt
            assert '"op":"chop_tree"' in starter_prompt, starter_prompt
            assert "use_held_item(targetKind" in starter_prompt, starter_prompt
            assert "never use for trees/resources" in starter_prompt, starter_prompt
            bad_validation = page.evaluate(
                """
                () => {
                  try {
                    window.validateAssistantDslAssignments([{ botId: 1, program: { steps: [
                      { op: 'pick_up', type: 'crude_axe' },
                      { op: 'move_to_structure', target: 'tree' },
                      { op: 'loop' }
                    ] } }]);
                    return { ok: true };
                  } catch (err) {
                    return { ok: false, error: err.message };
                  }
                }
                """
            )
            assert bad_validation["ok"] is False, bad_validation
            assert "requires an existing structure" in bad_validation["error"], bad_validation
            starter_alias_validation = page.evaluate(
                """
                () => {
                  try {
                    window.validateAssistantDslAssignments([{ botId: 1, program: { steps: [
                      { op: 'pick_up', type: 'crude_axe' },
                      { op: 'use_held_item', targetKind: 'tree' },
                      { op: 'loop' }
                    ] } }]);
                    return { ok: true };
                  } catch (err) {
                    return { ok: false, error: err.message };
                  }
                }
                """
            )
            assert starter_alias_validation["ok"] is False, starter_alias_validation
            assert "locked op chop_tree" in starter_alias_validation["error"], starter_alias_validation

            page.evaluate("window.setAssistantLoadout(['starter_automation', 'woodworking'])")
            woodworking_prompt = page.evaluate("window.getAssistantPromptPreview()")
            assert '"name":"Chop trees"' in woodworking_prompt, woodworking_prompt
            assert '"op":"use_held_item"' in woodworking_prompt, woodworking_prompt
            good_validation = page.evaluate(
                """
                () => window.validateAssistantDslAssignments([{ botId: 1, program: { steps: [
                  { op: 'pick_up', type: 'crude_axe' },
                  { op: 'use_held_item', targetKind: 'tree' },
                  { op: 'loop' }
                ] } }])
                """
            )
            assert good_validation[0]["program"]["steps"][1]["op"] == "chop_tree", good_validation

            page.click("#resetKnowledgePacks")
            page.wait_for_function("window.getAssistantLoadout().includes('mining_tools')")
            page.evaluate("window.uiDebug.setSettingsOpen(false)")

            state = page.evaluate("window.getGameState()")
            sawbench = next(s for s in state["structures"] if s["type"] == "sawbench")

            parsed = page.evaluate("window.generateAssistantDsl('bot 1 feed sawbench with logs')")
            assignments = parsed.get("dslAssignments") or []
            assert len(assignments) == 1, parsed
            assert assignments[0]["program"]["steps"][0]["op"] == "pick_up", assignments[0]

            assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", assignments[0])
            assert assigned["ok"] is True, assigned
            bot1 = page.evaluate("window.getGameState().bots.find(b => b.id === 1)")
            assert bot1["program"] == "taught_loop", bot1
            assert bot1["taughtLoop"][1]["structureId"] == sawbench["id"], bot1

            invalid = page.evaluate(
                """
                structureId => window.validateDslProgram({
                  steps: [
                    { op: 'deposit_to_structure', type: 'log', structureId },
                    { op: 'loop' }
                  ]
                })
                """,
                sawbench["id"],
            )
            assert invalid["ok"] is False, invalid
            assert "prior pick_up" in invalid["error"], invalid

            set_template_routing(page, True)
            submit_chat(page, "bot 2 keep sawbench full of logs")
            page.wait_for_function("window.getGameState().bots.find(b => b.id === 2).program === 'taught_loop'", timeout=3000)
            chat_text = page.locator("#chatLog").inner_text()
            assert "Generated DSL for Bot 2" in chat_text, chat_text
            bot2 = page.evaluate("window.getGameState().bots.find(b => b.id === 2)")
            assert bot2["taughtLoop"][0]["op"] == "pick_up", bot2
            assert bot2["taughtLoop"][1]["op"] == "deposit_to_structure", bot2

            browser.close()
    finally:
        server.shutdown()

print("assistant knowledge packs smoke passed")
