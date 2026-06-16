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
        page.goto(url)
        page.wait_for_function("() => window.getGameState && window.gameMenuDebug")
        assert page.locator("#mainMenuOverlay").is_visible()
        assert page.evaluate("window.getGameState().paused") is True

        # Main menu mode selection exposes mode-specific new/load layer.
        assert page.locator("#mainMenuLoadBtn").is_hidden()
        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        assert page.locator("#mainMenuStartSelectedBtn").is_visible()
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")

        # Browser-cache save/load restores progress inside a named Test-mode slot.
        page.evaluate("() => window.teachDebug.movePlayerTo(777, 888)")
        saved = page.evaluate("() => window.gameMenuDebug.save({slotName: 'Test Slot A', saveName: 'Checkpoint A'})")
        assert saved["schema"] == "orchestrator-grove-save-v1"
        assert saved["mode"] == "test"
        library = page.evaluate("() => window.gameMenuDebug.saveLibrary()")
        assert len(library["slots"]["test"]) == 1
        assert library["slots"]["campaign"] == []
        assert library["slots"]["test"][0]["saves"][0]["name"] == "Checkpoint A"
        page.evaluate("() => window.teachDebug.movePlayerTo(111, 222)")
        loaded = page.evaluate("() => window.gameMenuDebug.load({mode: 'test'})")
        assert loaded["player"]["x"] == 777 and loaded["player"]["y"] == 888, loaded["player"]

        # Esc opens game menu and pauses; paused update ticks do not pan camera.
        page.evaluate("() => window.uiDebug.setChatOpen(false)")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden")
        assert page.evaluate("window.getGameState().paused") is True
        before_camera = page.evaluate("window.getCameraState().camera")
        page.keyboard.down("w")
        page.evaluate("() => window.teachDebug.tickWorld(2)")
        page.keyboard.up("w")
        after_camera = page.evaluate("window.getCameraState().camera")
        assert after_camera["x"] == before_camera["x"] and after_camera["y"] == before_camera["y"], {"before": before_camera, "after": after_camera}

        # Quit to main menu asks for save when last save is older than 30 seconds.
        page.evaluate("() => window.gameMenuDebug.setLastSaveAgeSeconds(31)")
        page.locator("#quitToMainMenuBtn").click()
        page.wait_for_function("() => !document.getElementById('quitSavePrompt').hidden")
        assert page.locator("#saveAndQuitBtn").is_visible()
        assert page.locator("#quitWithoutSaveBtn").is_visible()
        assert page.locator("#cancelQuitBtn").is_visible()
        page.locator("#cancelQuitBtn").click()
        page.wait_for_function("() => document.getElementById('quitSavePrompt').hidden")

        # A recent save lets quit go straight back to the main menu and keeps the game paused.
        page.evaluate("() => window.gameMenuDebug.setLastSaveAgeSeconds(5)")
        page.locator("#quitToMainMenuBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuOverlay').hidden && document.getElementById('settingsOverlay').hidden")
        assert page.evaluate("window.getGameState().paused") is True

        page.locator("#mainMenuNewBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").click()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")
        page.evaluate("() => window.uiDebug.setChatOpen(false)")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden")

        # Save & quit saves first, hides the prompt, and returns to main menu.
        page.evaluate("() => window.gameMenuDebug.setLastSaveAgeSeconds(31)")
        page.locator("#quitToMainMenuBtn").click()
        page.wait_for_function("() => !document.getElementById('quitSavePrompt').hidden")
        page.locator("#saveAndQuitBtn").click()
        page.wait_for_function("() => !document.getElementById('mainMenuOverlay').hidden && document.getElementById('settingsOverlay').hidden")
        assert page.evaluate("window.gameMenuDebug.wasSavedRecently()") is True
        browser.close()
    server.shutdown()

print("game menu save smoke passed")
