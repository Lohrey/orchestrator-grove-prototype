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
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/index.html"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(url)
        page.wait_for_function("() => window.getGameState && window.audioDebug && window.teachDebug")

        page.keyboard.press("Escape")
        page.locator('[data-settings-tab="audio"]').click()
        page.wait_for_selector('[data-settings-panel="audio"].is-active')
        assert page.locator("#audioSfxToggle").is_checked()
        station_count = page.locator("#audioStation option").count()
        assert station_count >= 2, station_count
        state = page.evaluate("() => window.audioDebug.state()")
        assert "groovesalad" in state["stations"] and "dronezone" in state["stations"], state
        assert state["sfxVolume"] >= 0 and state["musicVolume"] >= 0, state
        page.locator("#audioSfxTest").click()

        page.evaluate("""
        () => {
          window.__sounds = [];
          window.audioDebug.controller.play = (name, detail = {}) => { window.__sounds.push({ name, detail }); return true; };
        }
        """)
        page.evaluate("() => window.teachDebug.placeStructure('item_palette', 900, 420)")
        page.evaluate("() => window.teachDebug.spawnItem('log', 910, 420, 1)")
        page.evaluate("() => { window.teachDebug.movePlayerTo(910, 420); window.teachDebug.pickupNearest('log'); }")
        page.evaluate("""
        () => {
          const palette = window.getGameState().structures.find(s => s.type === 'item_palette' && Math.abs(s.x - 900) < 2);
          window.teachDebug.depositToStructure(palette.id);
        }
        """)
        sounds = page.evaluate("() => window.__sounds.map(s => s.name)")
        assert "build" in sounds, sounds
        assert "drop" in sounds, sounds
        assert "pickup" in sounds, sounds
        assert "storage" in sounds or "deposit" in sounds, sounds
        assert not [e for e in errors if "failed to boot" in e.lower()], errors
        browser.close()
    server.shutdown()

print("audio smoke passed")
