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
    url = f"http://127.0.0.1:{port}/index.html"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 840})
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug")

        buttons = page.locator(".main-menu-actions button").all_inner_texts()
        assert buttons[0] == "Campaign mode", buttons
        assert buttons[1] == "Test mode", buttons

        page.locator("#mainMenuCampaignBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("""() => {
            const intro = document.getElementById('campaignIntroOverlay');
            return intro && !intro.hidden && window.getGameState().gameMode === 'campaign' && window.getGameState().paused;
        }""")
        intro_title = page.locator("#campaignIntroTitle").inner_text()
        intro_text = page.locator("#campaignIntroText").inner_text()
        assert "Paul" in intro_title and "daylight" in intro_text, {"title": intro_title, "text": intro_text}
        assert page.locator("#campaignIntroSkipBtn").is_visible()
        page.locator("#campaignIntroSkipBtn").click()
        page.wait_for_function("""() => {
            const intro = document.getElementById('campaignIntroOverlay');
            return intro.hidden && window.getGameState().gameMode === 'campaign' && !window.getGameState().paused;
        }""")
        state = page.evaluate("window.getGameState()")
        assert state["map"]["width"] >= 5600 and state["map"]["height"] >= 3800, state["map"]
        assert state["player"]["x"] < 1400 and state["player"]["y"] > state["map"]["height"] - 1000, state["player"]
        features = state["mapFeatures"]
        lake = next(f for f in features if f["id"] == "campaign_glow_lake")
        assert lake["type"] == "lake" and lake["glow"] == "green", lake
        assert lake["x"] < 1000 and lake["y"] > state["map"]["height"] - 900, lake
        road = next(f for f in features if f["type"] == "road")
        assert road["points"][0][0] < 0 and road["points"][-1][0] > state["map"]["width"], road
        parking = next(f for f in features if f["type"] == "parking_lot")
        camper = next(f for f in features if f["id"] == "campaign_camper")
        assert abs(camper["x"] - parking["x"]) < parking["w"] / 2, {"camper": camper, "parking": parking}
        assert abs(camper["y"] - parking["y"]) < parking["h"] / 2, {"camper": camper, "parking": parking}

        page.evaluate("window.gameMenuDebug.openMainMenu()")
        page.locator("#mainMenuCampaignBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => !document.getElementById('campaignIntroOverlay').hidden && window.getGameState().paused")
        page.keyboard.press("Escape")
        page.wait_for_function("""() => {
            const intro = document.getElementById('campaignIntroOverlay');
            const settings = document.getElementById('settingsOverlay');
            return intro.hidden && settings.hidden && !window.getGameState().paused;
        }""")

        page.evaluate("window.gameMenuDebug.openMainMenu()")
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => window.getGameState().gameMode === 'test'")
        state = page.evaluate("window.getGameState()")
        assert state["map"]["width"] == 3600 and state["map"]["height"] == 2400, state["map"]
        assert state["multiplayer"]["mapMode"] == "test", state["multiplayer"]
        assert not state["mapFeatures"], state["mapFeatures"]
        assert not errors, errors
        browser.close()
    server.shutdown()

print("campaign mode smoke passed")
