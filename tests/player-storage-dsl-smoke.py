#!/usr/bin/env python3
"""Smoke checks for player-as-storage DSL actions and storage retry throttling."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOT = ROOT / "t_c4955ba2-player-storage-local.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def tick(page, seconds: float, step: float = 0.05) -> None:
    page.evaluate(
        """
        ([seconds, step]) => {
          for (let t = 0; t < seconds; t += step) window.teachDebug.tickWorld(step);
        }
        """,
        [seconds, step],
    )


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f"http://127.0.0.1:{port}/index.html?v=t_c4955ba2_player_storage", wait_until="networkidle")
            page.wait_for_function("() => window.getGameState && window.teachDebug && window.generateAssistantDsl")
            page.locator("#mainMenuNewBtn").click()
            page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
            page.locator("#mainMenuStartSelectedBtn").click()
            page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

            page.evaluate("window.setAssistantLoadout(['starter_automation'])")
            debug = page.evaluate("window.getAssistantLoadoutDebug()")
            assert "deposit_to_player" in debug["unlockedOps"] and "take_from_player" in debug["unlockedOps"], debug
            assert "currentPlayerInventory" in debug["optionalContext"], debug

            parsed = page.evaluate("window.generateAssistantDsl('bot 1 bring log to me')")
            assignment = (parsed.get("dslAssignments") or [])[0]
            assert assignment["program"]["steps"][1]["op"] == "deposit_to_player", assignment
            assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", assignment)
            assert assigned["ok"] is True, assigned
            tick(page, 8)
            state = page.evaluate("window.getGameState()")
            bot1 = next(b for b in state["bots"] if b["id"] == 1)
            assert state["player"]["inventory"]["type"] == "log", state["player"]
            assert bot1["taughtLoop"][1]["op"] == "deposit_to_player", bot1
            page.evaluate("window.teachDebug.pauseBot(1)")

            invalid = page.evaluate(
                """
                () => window.validateDslProgram({ steps: [
                  { op: 'deposit_to_player', type: 'stone' },
                  { op: 'loop' }
                ] })
                """
            )
            assert invalid["ok"] is False and "prior pick_up" in invalid["error"], invalid

            page.evaluate("window.teachDebug.setInventory('stone')")
            take_assignment = {
                "botId": 2,
                "program": {
                    "id": "take_from_player_test",
                    "name": "Take From Player Test",
                    "steps": [
                        {"op": "take_from_player", "type": "stone"},
                        {"op": "loop"},
                    ],
                },
            }
            assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", take_assignment)
            assert assigned["ok"] is True, assigned
            tick(page, 4)
            state = page.evaluate("window.getGameState()")
            bot2 = next(b for b in state["bots"] if b["id"] == 2)
            assert state["player"]["inventory"] is None, state["player"]
            assert bot2["inventory"]["type"] == "stone", bot2

            palette = page.evaluate(
                """
                () => {
                  const p = window.teachDebug.placeStructure('item_palette', 245, 250);
                  p.storageType = 'log';
                  p.stored = p.capacity;
                  return { id: p.id, capacity: p.capacity };
                }
                """
            )
            page.evaluate("window.teachDebug.setBotInventory(3, 'log')")
            full_storage_assignment = {
                "botId": 3,
                "program": {
                    "id": "full_storage_retry_test",
                    "name": "Full Storage Retry Test",
                    "steps": [
                        {"op": "pick_up", "type": "log"},
                        {"op": "deposit_to_structure", "type": "log", "structureId": palette["id"]},
                        {"op": "loop"},
                    ],
                },
            }
            assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", full_storage_assignment)
            assert assigned["ok"] is True, assigned
            tick(page, 1)
            runtime1 = page.evaluate("window.teachDebug.getBotRuntime(3)")
            retry_until1 = runtime1["retryUntil"][f"deposit:{palette['id']}:log"]
            now1 = page.evaluate("window.teachDebug.getWorldTime()")
            assert retry_until1 - now1 > 8.5, (runtime1, now1)
            tick(page, 5)
            runtime2 = page.evaluate("window.teachDebug.getBotRuntime(3)")
            retry_until2 = runtime2["retryUntil"][f"deposit:{palette['id']}:log"]
            assert retry_until2 == retry_until1, (runtime1, runtime2)
            bot3 = next(b for b in page.evaluate("window.getGameState().bots") if b["id"] == 3)
            assert bot3["inventory"]["type"] == "log", bot3

            page.evaluate("window.teachDebug.openBotMenu(1)")
            page.wait_for_selector("#botMenu [data-bot-program-steps] .bot-program-step-card")
            menu_text = page.locator("#botMenu [data-bot-program-steps]").inner_text()
            assert "deposit_to_player" in menu_text or "bring log to player" in menu_text, menu_text

            page.screenshot(path=str(SHOT), full_page=True)
            browser.close()
    finally:
        server.shutdown()

print(f"player storage DSL smoke passed; screenshot={SHOT}")
