#!/usr/bin/env python3
"""Regression check for local Ollama model-name selection."""

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


OLLAMA_TAGS = {
    "models": [
        {"name": "gemma4:12b"},
        {"name": "bge-m3:latest"},
        {"name": "bonsai8b-q1:latest"},
        {"name": "gemma4-26b-a4b-local:latest"},
        {"name": "gemma3n:latest"},
        {"name": "llama3.2-vision:11b-instruct-q8_0"},
        {"name": "llama3.2-vision:latest"},
        {"name": "llama3:latest"},
    ]
}


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.route(
                "**/api/tags",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(OLLAMA_TAGS),
                ),
            )
            page.goto(url, wait_until="networkidle")
            page.wait_for_function("() => window.getGameState && document.getElementById('ollamaModel')")

            initial_value = page.eval_on_selector("#ollamaModel", "el => el.value")
            assert initial_value == "gemma4:12b", initial_value
            initial_options = page.eval_on_selector_all("#ollamaModel option", "opts => opts.map(o => o.value)")
            assert "gemma4:12b-it-qat" not in initial_options, initial_options

            page.evaluate("document.getElementById('refreshModels').click()")
            page.wait_for_function("document.getElementById('ollamaStatus').textContent.includes('Selected gemma4:12b')")
            refreshed_value = page.eval_on_selector("#ollamaModel", "el => el.value")
            refreshed_options = page.eval_on_selector_all("#ollamaModel option", "opts => opts.map(o => o.value)")
            assert refreshed_value == "gemma4:12b", refreshed_value
            assert "gemma4:12b" in refreshed_options, refreshed_options
            assert "gemma4:12b-it-qat" not in refreshed_options, refreshed_options
            assert "gemma3n:latest" not in refreshed_options, refreshed_options
            browser.close()
    finally:
        server.shutdown()

print("ollama model selection smoke passed")
