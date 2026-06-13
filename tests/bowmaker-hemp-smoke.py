#!/usr/bin/env python3
"""Smoke/regression check for Bowmaker, hemp plants, and recordable hemp actions."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "t_551bfc0b-bowmaker-hemp-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def dispatch_world_mouse(page, event_type: str, world_x: float, world_y: float, button: int = 0) -> None:
    page.evaluate(
        """
        ([eventType, worldX, worldY, button]) => {
          const c = document.getElementById('game');
          const rect = c.getBoundingClientRect();
          const s = window.getCameraState();
          const clientX = rect.left + (worldX - s.camera.x) * rect.width / c.width;
          const clientY = rect.top + (worldY - s.camera.y) * rect.height / c.height;
          c.dispatchEvent(new MouseEvent(eventType, { bubbles: true, cancelable: true, button, clientX, clientY }));
        }
        """,
        [event_type, world_x, world_y, button],
    )


def left_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "click", world_x, world_y, 0)


def right_click_world(page, world_x: float, world_y: float) -> None:
    dispatch_world_mouse(page, "contextmenu", world_x, world_y, 2)


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.teachDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); window.uiDebug.setBuildDrawerOpen(true); window.uiDebug.setBuildTab('military'); document.activeElement?.blur(); }")

        assert page.locator('[data-build-tab="military"][aria-selected="true"]').count() == 1
        assert page.locator('[data-build-category="military"].is-active [data-build="smithery"]').count() == 1
        assert page.locator('[data-build-category="military"].is-active [data-build="bowmaker"]').count() == 1

        objects = page.evaluate("() => window.getWorldObjects()")
        bowmaker = next((o for o in objects if o.get("kind") == "structure" and o.get("type") == "bowmaker"), None)
        hemp_plants = [o for o in objects if o.get("kind") == "resource" and o.get("type") == "hemp_plant"]
        assert bowmaker, "expected a starting bowmaker"
        assert bowmaker["name"] == "bowmaker 1"
        assert len(hemp_plants) >= 10, f"expected hemp plants on map, got {len(hemp_plants)}"

        left_click_world(page, bowmaker["x"], bowmaker["y"])
        page.wait_for_function("() => !document.getElementById('structureMenu').hidden", timeout=2000)
        menu_text = page.locator("#structureMenu").inner_text()
        assert "Bowmaker" in menu_text, menu_text
        assert "2 sticks + 3 hemp" in menu_text, menu_text
        assert "made bows" in menu_text, menu_text

        bow_ok = page.evaluate(
            """
            ([structureId]) => {
              for (const type of ['stick', 'stick', 'hemp', 'hemp', 'hemp']) {
                window.teachDebug.setInventory(type);
                if (!window.teachDebug.depositToStructure(structureId)) return { ok: false, type, state: window.getGameState() };
              }
              window.teachDebug.tickProduction(0);
              const started = window.getGameState().structures.find(s => s.type === 'bowmaker').processing?.recipe === 'bow';
              window.teachDebug.tickProduction(6);
              const madeBow = window.getWorldObjects().some(o => o.kind === 'item' && o.type === 'bow');
              return { ok: started && madeBow, started, madeBow, state: window.getGameState() };
            }
            """,
            [bowmaker["numericId"]],
        )
        assert bow_ok["ok"], bow_ok

        # Record bare-hand hemp search. It should show a timed player target and record search_hemp.
        search_hemp = hemp_plants[0]
        seed_count_before = page.evaluate("() => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'hemp_seed').length")
        page.evaluate("([x, y]) => { window.teachDebug.start(1); window.teachDebug.setInventory(null); window.teachDebug.movePlayerTo(x - 6, y); }", [search_hemp["x"], search_hemp["y"]])
        right_click_world(page, search_hemp["x"], search_hemp["y"])
        page.wait_for_function("() => window.getGameState().player.target?.action === 'search_hemp'", timeout=2000)
        page.wait_for_function("() => window.getGameState().player.target?.started === true", timeout=2000)
        page.wait_for_function(
            "before => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'hemp_seed').length > before",
            arg=seed_count_before,
            timeout=4000,
        )
        assert page.evaluate("() => window.getGameState().recorder.steps.some(s => s.op === 'search_hemp')"), "search_hemp not recorded"

        # Record axe hemp chop on a fresh plant. It should drop hemp+seed and record chop_hemp.
        fresh = page.evaluate("() => window.teachDebug.spawnHemp(930, 230)")
        hemp_count_before = page.evaluate("() => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'hemp').length")
        seed_count_mid = page.evaluate("() => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'hemp_seed').length")
        page.evaluate("([x, y]) => { window.teachDebug.setInventory('crude_axe'); window.teachDebug.movePlayerTo(x - 6, y); }", [fresh["x"], fresh["y"]])
        right_click_world(page, fresh["x"], fresh["y"])
        page.wait_for_function("() => window.getGameState().player.target?.action === 'chop_hemp'", timeout=2000)
        page.wait_for_function("() => window.getGameState().player.target?.started === true", timeout=2000)
        page.wait_for_function(
            "before => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'hemp').length > before",
            arg=hemp_count_before,
            timeout=5000,
        )
        page.wait_for_function(
            "before => window.getWorldObjects().filter(o => o.kind === 'item' && o.type === 'hemp_seed').length > before",
            arg=seed_count_mid,
            timeout=5000,
        )
        state = page.evaluate("() => { const s = window.teachDebug.stop(); return { recorder: s, objects: window.getWorldObjects() }; }")
        recorded_ops = [step["op"] for step in state["recorder"]["recordedLoop"]]
        assert "search_hemp" in recorded_ops, recorded_ops
        assert "chop_hemp" in recorded_ops, recorded_ops

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html")
        finally:
            server.shutdown()

print("bowmaker hemp smoke passed")
