#!/usr/bin/env python3
"""Smoke test for the worker-backed semantic assistant router."""

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
    page.wait_for_function("() => window.semanticRouterDebug && window.getGameState && window.assignBotProgram")


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})

            page.goto(url, wait_until="networkidle")
            wait_ready(page)

            assert page.locator("#semanticRouting").is_checked(), "semantic routing should default to enabled"
            status = page.locator("#semanticRouterStatus").text_content()
            assert "Semantic router" in (status or ""), status

            route = page.evaluate(
                """
                () => window.semanticRouterDebug.route(
                  'keep sawbench full of logs',
                  { loadout: ['starter_automation', 'woodworking'], knowledgePacks: window.actionPackCatalog }
                )
                """
            )
            assert route["topMatches"], route
            assert route["bestId"] in {"starter_automation", "woodworking"}, route

            trained = page.evaluate(
                """
                () => window.semanticRouterDebug.train(
                  'smash the crate with lumber',
                  'woodworking',
                  { loadout: ['starter_automation', 'woodworking'], knowledgePacks: window.actionPackCatalog }
                )
                """
            )
            assert trained["ok"] is True, trained

            reroute = page.evaluate(
                """
                () => window.semanticRouterDebug.route(
                  'smash the crate with lumber',
                  { loadout: ['starter_automation', 'woodworking'], knowledgePacks: window.actionPackCatalog }
                )
                """
            )
            assert reroute["bestId"] == "woodworking", reroute

            browser.close()
    finally:
        server.shutdown()

print("semantic router smoke passed")
