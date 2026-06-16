#!/usr/bin/env python3
"""Smoke checks for player-saved templates and assign_template DSL step."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "t_320b270b-template-drawer-local.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"http://127.0.0.1:{port}/index.html?v=t_320b270b_templates", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        page.locator("#templateDrawerToggle").click()
        page.wait_for_selector("#templatePanel")
        assert page.locator("#templateName").is_visible(), "template drawer must expose template naming input"
        assert "No saved templates" in (page.locator("#templateList").text_content() or "")

        page.evaluate("window.teachDebug.start(1)")
        page.evaluate("window.teachDebug.recordStep({ op: 'pick_up', type: 'log' })")
        page.evaluate("window.teachDebug.recordStep({ op: 'loop' })")
        page.evaluate("window.teachDebug.stop()")
        page.locator("#templateName").fill("Log Runner")
        page.locator("#templateSaveBtn").click()
        page.wait_for_function("() => window.getGameState().customTemplates?.some(t => t.name === 'Log Runner')")
        assert page.locator("#templateList .template-card").count() == 1
        assert "Log Runner" in (page.locator("#templateList").text_content() or "")

        page.locator("#templateList [data-template-bot-id]").fill("2")
        page.locator("#templateList [data-assign-template]").click()
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 2)?.customTemplateName === 'Log Runner'")
        bot2 = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 2)
        assert bot2["taughtLoop"][0]["op"] == "pick_up" and bot2["taughtLoop"][0]["type"] == "log", bot2

        checked = page.evaluate(
            "window.validateDslProgram({ steps: [{ op: 'assign_template', bot: 2, templateName: 'Log Runner' }, { op: 'loop' }] })"
        )
        assert checked["ok"], checked
        assert checked["program"]["steps"][0]["botId"] == 2

        res = page.evaluate(
            "window.assignCustomDslProgram({ botId: 1, program: { id: 'assigner', name: 'Assigner', steps: [{ op: 'assign_template', bot: 2, templateName: 'Log Runner' }, { op: 'loop' }] } })"
        )
        assert res["ok"], res
        page.evaluate("window.teachDebug.assignTemplate(2, 'missing-template')")
        page.evaluate("window.teachDebug.tickWorld(0.2)")
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 2)?.customTemplateName === 'Log Runner'")

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    server.shutdown()

print(f"custom template drawer smoke passed; screenshot={SHOT}")
