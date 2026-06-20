#!/usr/bin/env python3
"""Smoke check for the registry-backed action step chain Settings table."""

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
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(url, wait_until="networkidle")
            page.wait_for_function("() => window.getGameState && window.actionStepChainRows && window.allowedProgramOps")
            page.evaluate("window.gameMenuDebug?.closeMainMenu?.()")

            rows = page.evaluate("window.actionStepChainRows")
            allowed = page.evaluate("window.allowedProgramOps")
            assert len(rows) == len(allowed), (len(rows), len(allowed))
            assert rows[0]["op"] == "find_nearest_tree", rows[0]
            assert all(row.get("dslSnippet") for row in rows), rows
            pick_up_row = next(row for row in rows if row["op"] == "pick_up")
            assert pick_up_row["dslSnippet"] == '{"op":"pick_up","type":"$type","zone":"$zone"}', pick_up_row
            loop_row = next(row for row in rows if row["op"] == "loop")
            assert loop_row["dslSnippet"] == '{"op":"loop"}', loop_row
            assert any(row["op"] == "use_held_item" and "Normalizer-only" in row["notes"] for row in rows), rows
            assert any(row["op"] == "wait" and row["backend"] == "built-in template + custom/taught loop" for row in rows), rows

            page.evaluate("window.uiDebug.setSettingsOpen(true); window.uiDebug.setSettingsTab('step-chain')")
            table = page.locator("#actionStepChainTable table")
            assert table.is_visible(), "step chain table must be visible"
            assert page.locator("#actionStepChainTable tbody tr").count() == len(rows)
            table_text = page.locator("#actionStepChainTable").inner_text()
            assert "Chop tree" in table_text
            assert "DSL snippet" in table_text
            assert '{"op":"pick_up","type":"$type","zone":"$zone"}' in table_text
            assert '{"op":"loop"}' in table_text
            assert "deposit_to_structure(type, target/structureId)" in table_text
            assert "Normalizer-only alias" in table_text

            browser.close()
    finally:
        server.shutdown()

print("action step chain UI smoke passed")
