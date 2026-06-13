#!/usr/bin/env python3
"""Smoke/regression check for passive roaming monsters."""

from __future__ import annotations

import functools
import http.server
import math
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "passive-monsters-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def distance(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.teachDebug")

        state = page.evaluate("window.getGameState()")
        monsters = state["monsters"]
        assert len(monsters) >= 5, monsters
        for monster in monsters:
            assert monster["type"] == "passive_monster", monster
            assert monster["passive"] is True, monster
            assert monster["hp"] == 10 and monster["maxHp"] == 10, monster
            assert 1400 <= monster["x"] <= 2200 and 850 <= monster["y"] <= 1450, monster

        registry_monsters = page.evaluate("window.getWorldObjects().filter(o => o.kind === 'monster')")
        assert len(registry_monsters) == len(monsters), registry_monsters

        first = monsters[0]
        page.evaluate("([x, y]) => window.teachDebug.placeStructure('sawbench', x + 30, y)", [first["x"], first["y"]])
        near_structure = page.evaluate("window.getGameState().structures.at(-1)")
        before = distance(first, near_structure)

        moved_state = page.evaluate("() => window.teachDebug.tickWorld(2.0)")
        moved_monster = next(m for m in moved_state["monsters"] if m["id"] == first["id"])
        after = distance(moved_monster, near_structure)
        assert after > before + 35, {"before": before, "after": after, "monster": moved_monster, "structure": near_structure}
        assert moved_monster["wanderTarget"], moved_monster

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

print(f"passive monsters smoke passed: {SCREENSHOT}")
