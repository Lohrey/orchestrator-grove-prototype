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
            assert "DSL Action Wiki" in system_prompt
            assert "find_nearest_tree" in system_prompt
            assert "deliver_to_factory" in system_prompt
            assert "JSON loop step sequences" in system_prompt

            browser.close()
    finally:
        server.shutdown()

print("dsl action wiki smoke passed")
