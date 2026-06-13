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
        thrones = state["multiplayer"]["thrones"]
        assert len(thrones) == 2, thrones
        assert any(t["ownerId"] == "p1" and t["x"] < 400 and t["y"] > 2100 for t in thrones), thrones
        assert any(t["ownerId"] == "p2" and t["x"] > 3300 and t["y"] < 400 for t in thrones), thrones
        enemy = next(t for t in thrones if t["ownerId"] == "p2")
        after = page.evaluate("id => { window.teachDebug.attackThrone(id); return window.getGameState().multiplayer; }", enemy["id"])
        damaged = next(t for t in after["thrones"] if t["ownerId"] == "p2")
        assert damaged["hp"] == 110, damaged
        assert page.locator("#multiplayerPanel").is_visible()
        assert "Download session" in page.locator("#multiplayerSaveBtn").inner_text()
        browser.close()
    server.shutdown()

print("multiplayer smoke passed")
