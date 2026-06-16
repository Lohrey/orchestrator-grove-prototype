#!/usr/bin/env python3
"""Smoke-check performance toggles for fog, lighting, shadows, and FPS HUD."""

from __future__ import annotations

import contextlib
import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_70a03111-performance-settings-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return


Handler = functools.partial(QuietHandler, directory=str(ROOT))
with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 820})
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(f"http://127.0.0.1:{port}/index.html?v=t_70a03111", wait_until="networkidle")
        page.wait_for_function("() => window.gameMenuDebug && window.uiDebug && window.getGameState")
        page.evaluate("() => { window.gameMenuDebug.closeMainMenu(); window.uiDebug.setChatOpen(false); }")
        page.wait_for_timeout(1200)

        state = page.evaluate("() => window.getGameState()")
        assert state["fogOfWar"]["enabled"] is True, state
        assert state["lightingEffectsEnabled"] is True, state
        assert state["dynamicShadowsEnabled"] is False, state
        assert state["showFpsOverlay"] is True, state
        assert isinstance(state["fps"], (int, float)), state

        page.keyboard.press("Escape")
        page.click("[data-settings-tab='performance']")
        for selector in ["#fogOfWarToggle", "#lightingEffects", "#dynamicShadows", "#showFpsOverlay"]:
            assert page.locator(selector).is_visible(), selector

        page.locator("#fogOfWarToggle").uncheck()
        assert page.evaluate("() => window.getGameState().fogOfWar.enabled") is False
        page.locator("#lightingEffects").uncheck()
        assert page.evaluate("() => window.getGameState().lightingEffectsEnabled") is False
        page.locator("#showFpsOverlay").uncheck()
        assert page.evaluate("() => window.getGameState().showFpsOverlay") is False
        page.locator("#dynamicShadows").check()
        assert page.evaluate("() => window.getGameState().dynamicShadowsEnabled") is True

        stored = page.evaluate("() => JSON.parse(localStorage.getItem('orchestratorGrove.settings.v1'))")
        assert stored["fogOfWar"] is False, stored
        assert stored["lightingEffects"] is False, stored
        assert stored["showFpsOverlay"] is False, stored
        assert stored["dynamicShadows"] is True, stored

        page.locator("#fogOfWarToggle").check()
        page.locator("#lightingEffects").check()
        page.locator("#showFpsOverlay").check()
        page.locator("#dynamicShadows").uncheck()
        page.keyboard.press("Escape")
        page.wait_for_timeout(900)
        page.screenshot(path=str(SCREENSHOT), full_page=True)

        assert not errors, errors
        browser.close()

    httpd.shutdown()
    with contextlib.suppress(Exception):
        thread.join(timeout=1)

print("performance effects settings smoke passed")
