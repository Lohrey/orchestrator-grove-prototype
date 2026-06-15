#!/usr/bin/env python3
"""Smoke test for TabbyAPI model selection and browser-persisted settings."""

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


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    tabby_hits: list[str] = []
    ollama_hits: list[str] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})

            def handle_tabby(route) -> None:
                tabby_hits.append(route.request.url)
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(
                        {
                            "choices": [
                                {
                                    "message": {
                                        "content": json.dumps(
                                            {
                                                "tool_calls": [
                                                    {
                                                        "name": "assignBotProgram",
                                                        "arguments": {
                                                            "botId": 1,
                                                            "program": "chop_wood",
                                                        },
                                                    }
                                                ]
                                            }
                                        )
                                    }
                                }
                            ]
                        }
                    ),
                )

            def handle_ollama(route) -> None:
                ollama_hits.append(route.request.url)
                route.fulfill(status=500, body="unexpected ollama route")

            page.route("**/v1/chat/completions", handle_tabby)
            page.route("**/api/chat", handle_ollama)
            page.route("**/api/generate", handle_ollama)

            page.goto(url, wait_until="networkidle")
            page.wait_for_function("() => window.getGameState && document.getElementById('llmMode')")

            page.select_option("#llmMode", "tabbyapi")
            page.wait_for_function("document.getElementById('ollamaEndpoint').value === 'http://127.0.0.1:5000/v1'")
            assert page.eval_on_selector("#ollamaModel", "el => el.value") == "Qwen2.5-Coder-7B-Instruct-exl2-6_5"

            page.fill("#ollamaEndpoint", "http://127.0.0.1:5000/v1")
            page.fill("#targetFps", "55")
            page.fill("#maxBots", "9")
            page.click("#benchmarkBtn")
            page.wait_for_function("document.getElementById('ollamaStatus').textContent.includes('TabbyAPI / ExLlama')")

            assert tabby_hits, "expected TabbyAPI /v1/chat/completions request"
            assert not ollama_hits, f"unexpected Ollama requests: {ollama_hits}"

            stored = page.evaluate("JSON.parse(localStorage.getItem('orchestratorGrove.settings.v1'))")
            assert stored["llmMode"] == "tabbyapi", stored
            assert stored["ai"]["provider"] == "tabbyapi", stored
            assert stored["ai"]["endpoint"] == "http://127.0.0.1:5000/v1", stored
            assert stored["ai"]["model"] == "Qwen2.5-Coder-7B-Instruct-exl2-6_5", stored
            assert stored["targetFps"] == 55, stored
            assert stored["maxBots"] == 9, stored

            page.reload(wait_until="networkidle")
            page.wait_for_function("() => document.getElementById('llmMode').value === 'tabbyapi'")
            assert page.eval_on_selector("#ollamaEndpoint", "el => el.value") == "http://127.0.0.1:5000/v1"
            assert page.eval_on_selector("#ollamaModel", "el => el.value") == "Qwen2.5-Coder-7B-Instruct-exl2-6_5"
            assert page.eval_on_selector("#targetFps", "el => el.value") == "55"
            assert page.eval_on_selector("#maxBots", "el => el.value") == "9"

            browser.close()
    finally:
        server.shutdown()

print("tabbyapi settings smoke passed")
