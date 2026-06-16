#!/usr/bin/env python3
"""Smoke test for the Settings DSL Action Wiki and Ollama prompt injection."""

from __future__ import annotations

import functools
import http.server
import json
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def wait_ready(page) -> None:
    page.wait_for_function("() => window.getGameState && window.uiDebug && window.dslActionWikiText")


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            captured = []

            def fake_ollama(route, request):
                body = request.post_data_json
                captured.append(body)
                user_prompt = body["messages"][1]["content"]
                if "invalid-json-debug" in user_prompt:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({"message": {"content": "I cannot comply yet: use bot 1, then maybe { not valid JSON"}}),
                    )
                    return
                if "locked-dsl-debug" in user_prompt:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(
                            {
                                "message": {
                                    "content": json.dumps(
                                        {
                                            "dsl_assignments": [
                                                {
                                                    "botId": 2,
                                                    "program": {
                                                        "id": "bad_locked_loop",
                                                        "name": "Bad locked loop",
                                                        "steps": [{"op": "chop_tree"}, {"op": "loop"}],
                                                    },
                                                }
                                            ]
                                        }
                                    )
                                }
                            }
                        ),
                    )
                    return
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "tool_calls": [
                                            {
                                                "name": "assignBotProgram",
                                                "arguments": {"botId": 1, "program": "chop_wood"},
                                            }
                                        ]
                                    }
                                )
                            }
                        }
                    ),
                )

            page.route("**/fake-ollama/api/chat", fake_ollama)
            page.goto(url, wait_until="networkidle")
            wait_ready(page)

            page.evaluate("window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('dsl-wiki')")
            assert page.locator('[data-settings-tab="dsl-wiki"]').inner_text() == "DSL Wiki"
            wiki_text = page.locator("#dslWikiView").inner_text()
            assert "Bot DSL Action Wiki" in wiki_text
            assert "find_nearest_tree" in wiki_text
            assert "if_inventory" in wiki_text
            assert "use_held_item" in wiki_text
            assert "deposit_to_player" in wiki_text
            assert "take_from_player" in wiki_text
            assert "targetKind" in wiki_text
            assert "loop()" in wiki_text
            assert "crude_shovel" in wiki_text

            page.evaluate(
                """
                () => {
                  window.uiDebug.setSettingsOpen(false);
                  document.getElementById('llmMode').value = 'ollama';
                  document.getElementById('ollamaEndpoint').value = '/fake-ollama';
                  document.getElementById('ollamaModel').value = 'gemma4:12b';
                }
                """
            )
            page.fill("#chatInput", "bot 1 chop trees in the north forest")
            page.click("#askButton")
            page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1).program === 'chop_wood'")

            assert captured, "Ollama request was not captured"
            system_prompt = captured[0]["messages"][0]["content"]
            user_prompt = captured[0]["messages"][1]["content"]
            assert "strict JSON compiler" in system_prompt
            assert "Preferred shape" in system_prompt
            assert "never output markdown or JavaScript" in system_prompt
            assert '"equippedPacks"' in user_prompt
            assert '"id":"starter_automation"' in user_prompt
            assert "deposit_to_structure" in user_prompt

            page.evaluate("window.setAssistantLoadout(['starter_automation'])")
            page.fill("#chatInput", "locked-dsl-debug please")
            page.click("#askButton")
            page.wait_for_function("() => document.getElementById('ollamaStatus').textContent.includes('locked op chop_tree')")
            bot2 = page.evaluate("window.getGameState().bots.find(b => b.id === 2)")
            assert bot2["program"] != "taught_loop", bot2
            starter_user_prompt = captured[-1]["messages"][1]["content"]
            assert '"id":"starter_automation"' in starter_user_prompt, starter_user_prompt
            assert '"id":"woodworking"' not in starter_user_prompt, starter_user_prompt
            assert '"unlockedOps":["pick_up","drop_item","move_to_structure","use_held_item","assign_template","deposit_to_player","take_from_player","loop","wait"]' in starter_user_prompt, starter_user_prompt
            assert "deposit_to_structure(type" not in starter_user_prompt, starter_user_prompt
            assert "chop_tree(zone" not in starter_user_prompt, starter_user_prompt
            assert "use_held_item(targetKind" in starter_user_prompt, starter_user_prompt
            assert '"op":"deposit_to_structure"' not in starter_user_prompt, starter_user_prompt
            locked_tool_error = page.evaluate(
                """
                () => {
                  try {
                    window.validateAssistantToolCalls([{ name: 'assignBotProgram', arguments: { botId: 2, program: 'chop_wood' } }]);
                    return null;
                  } catch (err) {
                    return err.message;
                  }
                }
                """
            )
            assert "locked" in locked_tool_error, locked_tool_error

            page.fill("#chatInput", "invalid-json-debug please")
            page.click("#askButton")
            page.wait_for_function("() => document.getElementById('aiLog').textContent.includes('model returned invalid JSON') && document.getElementById('chatLog').textContent.includes('Raw model response')")
            ai_log = page.locator("#aiLog").inner_text()
            assert "Final prompt:" in ai_log, ai_log
            assert "Parsed JSON / error:" in ai_log, ai_log
            assert "model returned invalid JSON" in ai_log, ai_log
            chat_html = page.locator("#chatLog").inner_html()
            assert "raw-llm-response" in chat_html, chat_html
            assert "I cannot comply yet" in chat_html, chat_html

            browser.close()
    finally:
        server.shutdown()

print("dsl action wiki smoke passed")
