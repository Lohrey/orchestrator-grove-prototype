#!/usr/bin/env python3
"""Smoke checks for editable bot names, drawer search, and drawer teams drag/drop."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "t_8c481e6d-bot-drawer-teams-local.png"


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
        page.goto(f"http://127.0.0.1:{port}/index.html?v=t_8c481e6d_bot_teams", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.teachDebug")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        # Context-menu rename.
        page.evaluate("window.teachDebug.openBotMenu(1)")
        page.wait_for_selector("#botMenu [data-edit-bot-name]")
        assert page.locator("#botMenu [data-stop-workflow]").count() == 0
        page.locator("#botMenu [data-edit-bot-name]").click()
        page.wait_for_selector("#botMenu [data-menu-bot-name]")
        page.locator("#botMenu [data-menu-bot-name]").fill("Harvester Alpha")
        page.locator("#botMenu [data-menu-bot-name]").press("Enter")
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.name === 'Harvester Alpha'")
        page.wait_for_function("() => document.querySelector('#botMenu [data-bot-name-status]')?.textContent === 'Name saved.'")

        # Drawer rename and name search.
        page.locator("#botDrawerToggle").click()
        page.wait_for_selector("#botList [data-bot-name-input='2']")
        page.locator("#botList [data-bot-name-input='2']").fill("Miner Beta")
        page.locator("#botList [data-bot-name-input='2']").press("Enter")
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 2)?.name === 'Miner Beta'")
        page.locator("#botSearch").fill("Miner")
        page.wait_for_function("""
        () => [...document.querySelectorAll('#botList [data-bot-card]')].length === 1
          && document.querySelector('#botList [data-bot-card] input')?.value === 'Miner Beta'
        """)
        page.locator("#botSearch").fill("")
        page.wait_for_function("() => [...document.querySelectorAll('#botList [data-bot-card]')].length >= 4")

        # Create a team with a color, then drag a bot card into the team drop zone.
        page.locator("#botTeamName").fill("Forestry")
        page.locator("#botTeamColor").evaluate("el => { el.value = '#2f6f5d'; el.dispatchEvent(new Event('input', { bubbles: true })); }")
        page.locator("#botTeamCreate").click()
        page.wait_for_selector("#botList [data-team-id='team:1']")
        page.locator("#botList [data-bot-id='1']").drag_to(page.locator("#botList [data-team-id='team:1']"))
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.teamName === 'Forestry'")

        # Team color edits propagate to the team's cards via CSS variable/background source.
        page.locator("#botList [data-team-color-input='team:1']").evaluate(
            "el => { el.value = '#8a5a2b'; el.dispatchEvent(new Event('change', { bubbles: true })); }"
        )
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1)?.teamColor === '#8a5a2b'")
        page.wait_for_function("""
        () => [...document.querySelectorAll('#botList [data-team-dropzone]')]
          .find(el => el.dataset.teamId === 'team:1')
          ?.querySelector('[data-bot-id="1"]')
        """)
        card_color = page.evaluate("""
        () => [...document.querySelectorAll('#botList [data-team-dropzone]')]
          .find(el => el.dataset.teamId === 'team:1')
          .querySelector('[data-bot-id="1"]')
          .style.getPropertyValue('--team-color').trim()
        """)
        assert card_color == "#8a5a2b", card_color

        state = page.evaluate("window.getGameState()")
        assert state["bots"][0]["name"] == "Harvester Alpha", state["bots"][0]
        assert state["bots"][0]["teamName"] == "Forestry", state["bots"][0]
        assert state["botTeams"][0]["color"] == "#8a5a2b", state["botTeams"]
        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    server.shutdown()

print(f"bot drawer teams smoke passed; screenshot={SHOT}")
