#!/usr/bin/env python3
"""Smoke check for the browser Whisper voice setting and model controls."""

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


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.voiceInputDebug && window.browserSttDebug && document.getElementById('browserSttModel')")
        page.evaluate("() => { window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('voice'); }")

        options = page.eval_on_selector_all("#asrMode option", "els => els.map(o => ({ value: o.value, text: o.textContent.trim() }))")
        assert {"value": "browser_whisper", "text": "Browser Whisper (download once, local inference)"} in options, options

        page.select_option("#asrMode", "browser_whisper")
        mode = page.evaluate("window.voiceInputDebug.getAsrMode()")
        assert mode == "browser_whisper", mode

        model_options = page.eval_on_selector_all("#browserSttModel option", "els => els.map(o => ({ value: o.value, text: o.textContent.trim() }))")
        assert {"value": "whisper-tiny.en", "text": "Whisper tiny.en"} in model_options, model_options

        status = page.text_content("#asrStatus")
        help_text = page.text_content("#asrModeHelp")
        browser_status = page.text_content("#browserSttStatus")
        assert "browser Whisper local inference" in status, status
        assert "download once" in help_text, help_text
        assert "Browser model not loaded yet" in browser_status, browser_status

        state = page.evaluate("window.browserSttDebug.getState()")
        assert state["modelId"] == "whisper-tiny.en", state
        assert state["status"] == "idle", state

        browser.close()

    server.shutdown()

print("browser Whisper UI smoke passed")
