#!/usr/bin/env python3
import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "t_bfd12988-multiplayer-ai-wave-local.png"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

def tick(page, seconds, slices=1):
    step = seconds / slices
    for _ in range(slices):
        page.evaluate("dt => window.teachDebug.tickWorld(dt)", step)

def run_smoke(url: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(url)
        page.wait_for_function("() => window.getGameState && window.teachDebug")
        page.wait_for_timeout(250)

        state = page.evaluate("window.getGameState()")
        mp = state["multiplayer"]
        assert mp["enabled"] is True, mp
        assert mp["mapMode"] == "local_ai", mp
        assert state["player"]["x"] < 500 and state["player"]["y"] > 2000, state["player"]
        assert len(mp["towers"]) == 6, mp["towers"]
        assert sum(1 for t in mp["towers"] if t["ownerId"] == "p1") == 3, mp["towers"]
        assert sum(1 for t in mp["towers"] if t["ownerId"] == "p2") == 3, mp["towers"]
        assert 13 < mp["aiWave"]["spawnTimer"] <= 15, mp["aiWave"]

        tick(page, 15.2, slices=16)
        state = page.evaluate("window.getGameState()")
        creeps = [m for m in state["monsters"] if m["type"] == "lane_creep"]
        assert len(creeps) >= 1, state["monsters"]
        assert state["multiplayer"]["aiWave"]["lastWaveSize"] == 1, state["multiplayer"]["aiWave"]

        tick(page, 180, slices=12)
        state = page.evaluate("window.getGameState()")
        assert state["multiplayer"]["aiWave"]["lastWaveSize"] >= 2, state["multiplayer"]["aiWave"]

        player = state["player"]
        dummy = page.evaluate("([x, y]) => window.teachDebug.spawnMonster(x, y, { name: 'player auto target', type: 'lane_creep', ownerId: 'p2', hostile: true, passive: false, speed: 0, hp: 10, maxHp: 10, roamRadius: 0, avoidRadius: 0 })", [player["x"] + 42, player["y"]])
        page.evaluate("() => window.teachDebug.equipPlayer('wooden_sword')")
        tick(page, 0.15, slices=1)
        hp_after_player = page.evaluate("ref => window.getGameState().monsters.find(m => m.ref === ref).hp", dummy["ref"])
        assert hp_after_player == 8, hp_after_player

        bot = page.evaluate("() => window.getGameState().bots[0]")
        bot_dummy = page.evaluate("([x, y]) => window.teachDebug.spawnMonster(x, y, { name: 'bot auto target', type: 'lane_creep', ownerId: 'p2', hostile: true, passive: false, speed: 0, hp: 10, maxHp: 10, roamRadius: 0, avoidRadius: 0 })", [bot["x"] + 38, bot["y"]])
        page.evaluate("botId => window.teachDebug.setBotEquipment(botId, 'wooden_sword')", bot["id"])
        tick(page, 0.15, slices=1)
        hp_after_bot = page.evaluate("ref => window.getGameState().monsters.find(m => m.ref === ref).hp", bot_dummy["ref"])
        assert hp_after_bot == 8, hp_after_bot

        tower = page.evaluate("() => window.getGameState().multiplayer.towers.find(t => t.ownerId === 'p1')")
        tower_dummy = page.evaluate("([x, y]) => window.teachDebug.spawnMonster(x, y, { name: 'tower auto target', type: 'lane_creep', ownerId: 'p2', hostile: true, passive: false, speed: 0, hp: 10, maxHp: 10, roamRadius: 0, avoidRadius: 0 })", [tower["x"] + 35, tower["y"]])
        tick(page, 1.5, slices=10)
        hp_after_tower = page.evaluate("ref => window.getGameState().monsters.find(m => m.ref === ref).hp", tower_dummy["ref"])
        assert hp_after_tower <= 9, hp_after_tower

        own = page.evaluate("() => window.getGameState().multiplayer.thrones.find(t => t.ownerId === 'p1')")
        page.evaluate("own => window.teachDebug.spawnMonster(own.x + 58, own.y, { name: 'throne attacker', type: 'lane_creep', ownerId: 'p2', hostile: true, passive: false, speed: 0, hp: 10, maxHp: 10, roamRadius: 0, avoidRadius: 0, laneTargetRef: own.ref })", own)
        tick(page, 1.2, slices=3)
        own_after = page.evaluate("() => window.getGameState().multiplayer.thrones.find(t => t.ownerId === 'p1')")
        assert own_after["hp"] < own["hp"], {"before": own, "after": own_after}

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()

if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?multiplayer=local-ai&session=ai-wave-smoke&t=t_f62dde4d_local_ai")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?multiplayer=local-ai&session=ai-wave-smoke")
        finally:
            server.shutdown()

print("multiplayer ai wave smoke passed")
