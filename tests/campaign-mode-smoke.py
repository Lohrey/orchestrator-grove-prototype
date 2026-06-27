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
    url = f"http://127.0.0.1:{port}/index.html?renderer=canvas2d"
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
            const state = window.getGameState();
            return intro.hidden && state.gameMode === 'campaign' && state.campaignArrival?.active && state.paused;
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
        page.wait_for_timeout(400)
        moving_camper_pixels = page.evaluate("""() => {
            const state = window.getGameState();
            const camera = window.getCameraState().camera;
            const canvas = document.getElementById('game');
            const ctx = canvas.getContext('2d');
            const progress = Math.max(0, Math.min(1, state.campaignArrival?.progress || 0));
            const points = [
                [-170, state.map.height - 910],
                [760, state.map.height - 910],
                [1140, state.map.height - 845],
                [1160, state.map.height - 646]
            ];
            const segments = [];
            let total = 0;
            for (let i = 0; i < points.length - 1; i++) {
                const a = points[i], b = points[i + 1];
                const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
                segments.push({ a, b, length });
                total += length;
            }
            let target = total * progress;
            let wx = points[0][0], wy = points[0][1];
            for (const segment of segments) {
                if (target <= segment.length) {
                    const local = segment.length ? target / segment.length : 0;
                    wx = segment.a[0] + (segment.b[0] - segment.a[0]) * local;
                    wy = segment.a[1] + (segment.b[1] - segment.a[1]) * local;
                    break;
                }
                target -= segment.length;
            }
            const zoom = camera.zoom || 1;
            const sx = Math.round((wx - camera.x) * zoom);
            const sy = Math.round((wy - camera.y) * zoom);
            const radius = 56;
            const image = ctx.getImageData(Math.max(0, sx - radius), Math.max(0, sy - radius), radius * 2, radius * 2).data;
            let white = 0;
            for (let i = 0; i < image.length; i += 4) {
                if (image[i] > 195 && image[i + 1] > 195 && image[i + 2] > 175) white += 1;
            }
            return { white, sx, sy, progress, backend: state.rendererBackend };
        }""")
        assert moving_camper_pixels["white"] > 40, moving_camper_pixels

        page.wait_for_function("() => !window.getGameState().campaignArrival?.active && !window.getGameState().paused")

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
