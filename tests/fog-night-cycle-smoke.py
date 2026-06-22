#!/usr/bin/env python3
from __future__ import annotations

import io
import math
import os
import subprocess
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

from bot_tool_smoke_utils import ROOT, SERVER_URL, start_local_server, wait_for_server

BASE_URL = (os.environ.get("ORCHESTRATOR_GROVE_BASE_URL") or os.environ.get("BASE_URL") or "").rstrip("/")
SCREENSHOT = ROOT / ("t_2859e629-fog-night-cycle-public.png" if BASE_URL else "t_2859e629-fog-night-cycle-smoke.png")


def distance(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def average_brightness(image: Image.Image, center_x: float, center_y: float, radius: int = 18) -> float:
    x0 = max(0, int(round(center_x - radius)))
    y0 = max(0, int(round(center_y - radius)))
    x1 = min(image.width, int(round(center_x + radius)))
    y1 = min(image.height, int(round(center_y + radius)))
    pixels = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = image.getpixel((x, y))
            pixels.append((r + g + b) / 3)
    return sum(pixels) / max(1, len(pixels))


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 840})
        errors: list[str] = []
        logs: list[str] = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else logs.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug && window.teachDebug")
        page.evaluate(
            """
            async () => {
              const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              window.gameMenuDebug.startTest();
              await waitFrame();
              await waitFrame();
            }
            """
        )
        page.wait_for_function("() => window.getGameState().gameMode === 'test' && !window.getGameState().paused")

        initial = page.evaluate("window.getGameState()")
        assert initial["rendererBackend"] == "pixi", initial["rendererBackend"]
        assert initial["fogOfWar"]["enabled"], initial["fogOfWar"]
        assert initial["fogOfWar"]["cellSize"] == 64, initial["fogOfWar"]
        assert "visibleCount" in initial["fogOfWar"], initial["fogOfWar"]
        assert initial["dayNight"]["label"] in {"Dawn", "Day", "Dusk", "Night"}, initial["dayNight"]

        state = page.evaluate("window.teachDebug.tickWorld(74)")
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
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

        production_lights = [obj for obj in structures if obj["type"] in {"sawbench", "workbench", "factory", "smithery", "bowmaker", "arrowmaker", "defensetower"}]
        assert production_lights, structures

        sample_points = page.evaluate(
            """
            () => {
              const state = window.getGameState();
              const camera = window.getCameraState().camera;
              const zoom = camera.zoom || 1;
              const lightTypes = new Set(['sawbench', 'workbench', 'factory', 'smithery', 'bowmaker', 'arrowmaker', 'defensetower']);
              const structure = state.structures.find(s => lightTypes.has(s.type)) || state.structures[0];
              return {
                player: {
                  x: (state.player.x - camera.x) * zoom,
                  y: (state.player.y - camera.y) * zoom
                },
                structure: {
                  x: ((structure.x + ((structure.w || 48) / 2)) - camera.x) * zoom,
                  y: ((structure.y + ((structure.h || 48) / 2)) - camera.y) * zoom,
                  type: structure.type
                },
                fogProbe: { x: 80, y: 120 }
              };
            }
            """
        )

        canvas_png = page.locator("#game").screenshot(path=str(SCREENSHOT))
        image = Image.open(io.BytesIO(canvas_png)).convert("RGB")
        fog_brightness = average_brightness(image, sample_points["fogProbe"]["x"], sample_points["fogProbe"]["y"])
        player_brightness = average_brightness(image, sample_points["player"]["x"], sample_points["player"]["y"])
        structure_brightness = average_brightness(image, sample_points["structure"]["x"], sample_points["structure"]["y"])

        assert fog_brightness < 40, {"fog_brightness": fog_brightness}
        assert player_brightness > fog_brightness + 55, {
            "fog_brightness": fog_brightness,
            "player_brightness": player_brightness,
        }
        assert structure_brightness > fog_brightness + 25, {
            "fog_brightness": fog_brightness,
            "structure_brightness": structure_brightness,
            "structure_type": sample_points["structure"]["type"],
        }

        assert SCREENSHOT.exists() and SCREENSHOT.stat().st_size > 20_000, SCREENSHOT
        assert not any("Pixi renderer failed" in log for log in logs), logs
        assert not any("PixiJS Deprecation Warning" in log for log in logs), logs
        assert not errors, errors
        browser.close()


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?renderer=pixi&v=t_2859e629")
else:
    server = start_local_server()
    try:
        wait_for_server(f"{SERVER_URL}/index.html")
        run_smoke(f"{SERVER_URL}/index.html?renderer=pixi&v=t_2859e629")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

print("fog/night cycle smoke passed")
