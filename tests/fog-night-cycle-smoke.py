#!/usr/bin/env python3
import functools
import http.server
import os
import math
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / ("t_2859e629-fog-night-cycle-public.png" if BASE_URL else "t_2859e629-fog-night-cycle-smoke.png")

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

def distance(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])

def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 840})
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug && window.teachDebug")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => window.getGameState().gameMode === 'test' && !window.getGameState().paused")

        initial = page.evaluate("window.getGameState()")
        assert initial["fogOfWar"]["enabled"], initial["fogOfWar"]
        assert initial["fogOfWar"]["cellSize"] == 64, initial["fogOfWar"]
        assert "visibleCount" in initial["fogOfWar"], initial["fogOfWar"]
        assert initial["dayNight"]["label"] in {"Dawn", "Day", "Dusk", "Night"}, initial["dayNight"]

        # Advance through one long night update: it should flip to night, explore fog cells,
        # and create a night monster far away from the player/building cluster.
        state = page.evaluate("window.teachDebug.tickWorld(74)")
        assert state["dayNight"]["isNight"], state["dayNight"]
        assert state["dayNight"]["nightAmount"] > 0.7, state["dayNight"]
        assert state["fogOfWar"]["exploredCount"] > 0, state["fogOfWar"]
        assert state["fogOfWar"]["visibleCount"] > 0, state["fogOfWar"]
        assert state["fogOfWar"]["exploredCount"] >= state["fogOfWar"]["visibleCount"], state["fogOfWar"]

        objects = page.evaluate("window.getWorldObjects()")
        structures = [obj for obj in objects if obj["kind"] == "structure"]
        night_monsters = [obj for obj in objects if obj["kind"] == "monster" and obj.get("type") == "night_monster"]
        assert night_monsters, objects
        assert structures, objects
        for monster in night_monsters:
            nearest_structure = min(distance(monster, structure) for structure in structures)
            assert nearest_structure >= 520, {"monster": monster, "nearest_structure": nearest_structure}
            assert monster.get("avoidRadius", 0) >= 650, monster
            assert monster.get("roamRadius", 0) >= 500, monster

        production_lights = [obj for obj in structures if obj["type"] in {"sawbench", "workbench", "factory", "smithery", "bowmaker", "defensetower"}]
        assert production_lights, structures

        # Regression guard for t_de3368b1: fog reveal masks must not erase the
        # already-rendered scene. Sample live canvas pixels around the player
        # and a lit structure; both should remain opaque/visible at night.
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        visibility = page.evaluate(
            """
            () => {
              const state = window.getGameState();
              const camera = window.getCameraState().camera;
              const canvas = document.getElementById('game');
              const ctx = canvas.getContext('2d');
              const zoom = camera.zoom || 1;
              const lightTypes = new Set(['sawbench', 'workbench', 'factory', 'smithery', 'bowmaker', 'defensetower']);
              const structure = state.structures.find(s => lightTypes.has(s.type)) || state.structures[0];
              const samples = [
                { name: 'player', x: state.player.x, y: state.player.y, radius: 10 },
                { name: 'structure', x: structure.x + (structure.w || 48) / 2, y: structure.y + (structure.h || 48) / 2, radius: 18, type: structure.type }
              ];
              const read = sample => {
                const sx = Math.round((sample.x - camera.x) * zoom);
                const sy = Math.round((sample.y - camera.y) * zoom);
                const pixels = [];
                for (let y = sy - sample.radius; y <= sy + sample.radius; y += 2) {
                  for (let x = sx - sample.radius; x <= sx + sample.radius; x += 2) {
                    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
                    const d = ctx.getImageData(x, y, 1, 1).data;
                    pixels.push([d[0], d[1], d[2], d[3]]);
                  }
                }
                const opaque = pixels.filter(p => p[3] > 220).length;
                const bright = pixels.filter(p => p[3] > 220 && (p[0] + p[1] + p[2]) > 120).length;
                const alpha = pixels.reduce((total, p) => total + p[3], 0) / Math.max(1, pixels.length);
                const maxSaturation = Math.max(0, ...pixels.map(p => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])));
                return { ...sample, sx, sy, count: pixels.length, opaque, bright, avgAlpha: alpha, maxSaturation };
              };
              return Object.fromEntries(samples.map(sample => [sample.name, read(sample)]));
            }
            """
        )
        assert visibility["player"]["count"] > 0, visibility
        assert visibility["player"]["opaque"] >= 50, visibility
        assert visibility["player"]["bright"] >= 30, visibility
        assert visibility["player"]["avgAlpha"] > 220, visibility
        assert visibility["structure"]["count"] > 0, visibility
        assert visibility["structure"]["opaque"] >= 120, visibility
        assert visibility["structure"]["avgAlpha"] > 220, visibility
        assert visibility["structure"]["maxSaturation"] >= 18, visibility

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        assert SCREENSHOT.exists() and SCREENSHOT.stat().st_size > 20_000, SCREENSHOT
        assert not errors, errors
        browser.close()

if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_2859e629")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_2859e629")
        finally:
            server.shutdown()

print("fog/night cycle smoke passed")
