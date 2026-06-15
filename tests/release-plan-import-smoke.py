#!/usr/bin/env python3
"""Regression checks for release plan savefile validation."""
from __future__ import annotations

import functools
import http.server
import json
import socketserver
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/plan.html"

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        invalid_payload = {
            "schema": "orchestrator-grove-multiplayer-session-v1",
            "exportedAt": "2026-06-15T12:00:00.000Z",
            "session": {
                "states": {
                    "p1": {
                        "paused": True,
                        "player": {"x": 100, "y": 200},
                        "bots": [],
                    }
                }
            },
        }
        valid_payload = {
            "app": "orchestrator-grove-release-plan",
            "version": 1,
            "state": {
                "s0-i0": True,
                "s1-i2": True,
                "paused": True,
                "player": {"x": 1},
                "s3-i4": "yes",
            },
        }
        invalid_file = tmpdir / "invalid-plan-import.json"
        valid_file = tmpdir / "valid-plan-import.json"
        invalid_file.write_text(json.dumps(invalid_payload), encoding="utf-8")
        valid_file.write_text(json.dumps(valid_payload), encoding="utf-8")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.add_init_script(
                """
                localStorage.setItem('orchestrator-grove-release-plan-v1', JSON.stringify({
                  paused: true,
                  player: { x: 50, y: 80 },
                  's0-i1': 'truthy-string'
                }));
                """
            )
            page.goto(url)
            page.wait_for_selector("#doneCount")

            assert page.locator("#doneCount").inner_text() == "0/20"
            assert page.evaluate("JSON.parse(localStorage.getItem('orchestrator-grove-release-plan-v1'))") == {
            }

            page.locator("#uploadInput").set_input_files(str(invalid_file))
            page.wait_for_function("() => document.getElementById('saveStatus').textContent.includes('Upload fehlgeschlagen')")
            assert "release-plan" in page.locator("#saveStatus").inner_text().lower()
            assert page.locator("#doneCount").inner_text() == "0/20"

            page.locator("#uploadInput").set_input_files(str(valid_file))
            page.wait_for_function("() => document.getElementById('saveStatus').textContent.includes('Savefile geladen.')")
            assert page.locator("#doneCount").inner_text() == "2/20"
            assert page.evaluate("JSON.parse(localStorage.getItem('orchestrator-grove-release-plan-v1'))") == {
                "s0-i0": True,
                "s1-i2": True,
            }

            browser.close()

    server.shutdown()

print("release plan import smoke passed")
