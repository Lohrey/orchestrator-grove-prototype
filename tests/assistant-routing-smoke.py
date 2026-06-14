#!/usr/bin/env python3
"""Regression checks for assistant plank-hauling direction routing."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SAWBENCH_W = 92
SAWBENCH_H = 54


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def wait_ready(page) -> None:
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.assignBotProgram")


def assign(page, args: str) -> None:
    result = page.evaluate(f"window.assignBotProgram({args})")
    assert result["ok"] is True, result


def loose_near_structure(page, structure_id: int, item_type: str) -> int:
    return page.evaluate(
        """
        ([structureId, itemType, w, h]) => {
          const state = window.getGameState();
          const s = state.structures.find(st => st.id === structureId);
          const dropX = s.x + w / 2 + 24;
          const dropY = s.y + h / 2 + 18;
          return state.objectRegistry.filter(o =>
            o.kind === 'item' &&
            o.type === itemType &&
            o.x > s.x + w / 2 &&
            o.y > s.y + h / 2 &&
            Math.hypot(o.x - dropX, o.y - dropY) < 65
          ).length;
        }
        """,
        [structure_id, item_type, SAWBENCH_W, SAWBENCH_H],
    )


def produce_planks_at(page, sawbench_id: int) -> None:
    assign(page, f"{{ botId: 1, program: 'haul_logs', targetStructureId: {sawbench_id} }}")
    page.wait_for_function(
        f"""
        () => window.getGameState().structures.find(s => s.id === {sawbench_id}).processing?.label === 'sawing log' ||
              window.getGameState().stores.loosePlanks >= 2
        """,
        timeout=10000,
    )
    page.wait_for_function(
        f"""
        () => window.getGameState().structures.find(s => s.id === {sawbench_id}).planks === 0 &&
              window.getGameState().stores.loosePlanks >= 2
        """,
        timeout=10000,
    )
    assign(page, "{ botId: 1, program: 'idle' }")
    assert loose_near_structure(page, sawbench_id, "plank") >= 2, page.evaluate("window.getGameState()")


def submit_chat(page, text: str) -> None:
    page.fill("#chatInput", text)
    page.click("#askButton")


def set_template_routing(page, enabled: bool) -> None:
    page.evaluate(
        """
        enabled => {
          const input = document.getElementById('templateRouting');
          input.checked = enabled;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        """,
        enabled,
    )


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
            wait_ready(page)
            page.evaluate("window.teachDebug.placeStructure('sawbench', 720, 330)")
            state = page.evaluate("window.getGameState()")
            sawbench1 = next(s for s in state["structures"] if s["name"] == "sawbench 1")
            sawbench2 = next(s for s in state["structures"] if s["name"] == "sawbench 2")
            produce_planks_at(page, sawbench1["id"])

            assert page.evaluate("document.getElementById('templateRouting').checked") is False
            submit_chat(page, "make bot 4 haul plank to sawbench 2")
            page.wait_for_timeout(500)
            bot4_disabled = page.evaluate("window.getGameState().bots.find(b => b.id === 4)")
            assert bot4_disabled["program"] == "idle", bot4_disabled

            set_template_routing(page, True)
            submit_chat(page, "make bot 4 haul plank to sawbench 2")
            page.wait_for_function("window.getGameState().bots.find(b => b.id === 4).program === 'make_poles'", timeout=3000)
            bot4 = page.evaluate("window.getGameState().bots.find(b => b.id === 4)")
            assert bot4["targetStructureId"] == sawbench2["id"], bot4
            assert bot4["sourceStructureId"] is None, bot4
            page.wait_for_function(
                "window.getGameState().stores.loosePoles >= 2 && window.getGameState().stores.sawbenchPoles === 0",
                timeout=15000,
            )
            assert loose_near_structure(page, sawbench2["id"], "pole") >= 2, page.evaluate("window.getGameState()")
            factory_after_sawbench_route = page.evaluate(
                "window.getGameState().structures.find(s => s.type === 'factory').planks"
            )
            assert factory_after_sawbench_route == 0, factory_after_sawbench_route

            page.goto(url, wait_until="networkidle")
            wait_ready(page)
            page.evaluate("window.teachDebug.placeStructure('sawbench', 720, 330)")
            state = page.evaluate("window.getGameState()")
            sawbench2 = next(s for s in state["structures"] if s["name"] == "sawbench 2")
            factory = next(s for s in state["structures"] if s["type"] == "factory")
            produce_planks_at(page, sawbench2["id"])

            submit_chat(page, "bot 4 haul planks from sawbench 2 to factory 1")
            page.wait_for_function("window.getGameState().bots.find(b => b.id === 4).program === 'haul_planks'", timeout=3000)
            bot4 = page.evaluate("window.getGameState().bots.find(b => b.id === 4)")
            assert bot4["sourceStructureId"] == sawbench2["id"], bot4
            assert bot4["targetFactoryId"] == factory["id"], bot4
            page.wait_for_function(
                f"window.getGameState().structures.find(s => s.id === {factory['id']}).planks >= 1",
                timeout=15000,
            )

            browser.close()
    finally:
        server.shutdown()

print("assistant routing smoke passed")
