#!/usr/bin/env python3
"""Smoke check for the faster-whisper voice setting and upload endpoint wiring."""

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
        page.wait_for_function("() => window.voiceInputDebug && document.getElementById('asrMode')")
        page.evaluate("() => { window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('voice'); }")

        options = page.eval_on_selector_all("#asrMode option", "els => els.map(o => ({ value: o.value, text: o.textContent.trim() }))")
        assert {"value": "faster_whisper", "text": "faster-whisper server STT (browser recording upload)"} in options, options

        page.select_option("#asrMode", "faster_whisper")
        mode = page.evaluate("window.voiceInputDebug.getAsrMode()")
        assert mode == "faster_whisper", mode

        status = page.text_content("#asrStatus")
        help_text = page.text_content("#asrModeHelp")
        assert "faster-whisper server STT" in status, status
        assert "/asr/transcribe?mode=faster_whisper" in help_text, help_text

        transcribe_url = page.evaluate("window.voiceInputDebug.transcribeUrl()")
        assert transcribe_url == "http://127.0.0.1:8096/asr/transcribe?mode=faster_whisper", transcribe_url

        browser.close()

    server.shutdown()

print("faster-whisper UI smoke passed")
