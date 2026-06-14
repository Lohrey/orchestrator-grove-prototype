#!/usr/bin/env python3
import functools
import http.server
import socketserver
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass

with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html?multiplayer=host&session=smoke-room"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(url)
        page.wait_for_function("() => window.getGameState && window.multiplayerDebug")
        page.wait_for_timeout(350)
        state = page.evaluate("window.getGameState()")
        assert state["multiplayer"]["enabled"] is True, state["multiplayer"]
        assert state["multiplayer"]["sessionId"] == "smoke-room"
        assert state["player"]["x"] < 500 and state["player"]["y"] > 2000, state["player"]
        mp = state["multiplayer"]
        assert mp["mapMode"] == "online_lakes", mp
        assert mp["aiWave"]["enabled"] is False, mp.get("aiWave")
        assert mp["thrones"] == [], mp["thrones"]
        features = mp["mapFeatures"]
        lakes = [f for f in features if f["type"] == "lake"]
        campers = [f for f in features if f["type"] == "camper_van"]
        assert len(lakes) == 2 and len(campers) == 2, features
        p1_camper = next(f for f in campers if f["ownerId"] == "p1")
        assert p1_camper["x"] < 700 and p1_camper["y"] > 1900, p1_camper
        bots_near_camper = [
            b for b in state["bots"]
            if ((b["x"] - p1_camper["x"]) ** 2 + (b["y"] - p1_camper["y"]) ** 2) ** 0.5 < 160
        ]
        assert len(bots_near_camper) >= 2, {"camper": p1_camper, "bots": state["bots"]}
        assert page.locator("#multiplayerPanel").is_visible()
        assert "Download session" in page.locator("#multiplayerSaveBtn").inner_text()
        page.locator("#multiplayerDrawerToggle").click()
        page.wait_for_function("() => document.getElementById('gameStage').classList.contains('has-open-drawer')")
        drawer_box = page.locator("#multiplayerDrawer").bounding_box()
        assert drawer_box is not None
        toggle_boxes = page.evaluate("""
        () => ['botDrawerToggle','buildDrawerToggle','zonesDrawerToggle','multiplayerDrawerToggle'].map(id => {
          const r = document.getElementById(id).getBoundingClientRect();
          return { id, left: Math.round(r.left), right: Math.round(r.right) };
        })
        """)
        expected_left = round(drawer_box["x"] - 43)
        assert all(abs(t["left"] - expected_left) <= 1 for t in toggle_boxes), {"expected_left": expected_left, "toggles": toggle_boxes}
        page.locator("#multiplayerDrawerToggle").click()
        page.wait_for_function("() => !document.getElementById('gameStage').classList.contains('has-open-drawer') && document.getElementById('multiplayerDrawer').classList.contains('is-collapsed')")
        browser.close()
    server.shutdown()

print("multiplayer smoke passed")
