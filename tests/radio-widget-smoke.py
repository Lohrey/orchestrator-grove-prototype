#!/usr/bin/env python3
"""Smoke-check the left canvas radio widget and low-bandwidth station roster."""

from __future__ import annotations

import contextlib
import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_3c36064a-radio-widget-smoke.png"
EXPECTED_STATIONS = {"groovesalad", "dronezone", "missioncontrol", "vaporwaves", "defcon"}


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
        page.add_init_script(
            """
            (() => {
              const markPaused = (el, paused) => Object.defineProperty(el, 'paused', { configurable: true, get: () => paused });
              HTMLMediaElement.prototype.play = function() { markPaused(this, false); this.dispatchEvent(new Event('playing')); return Promise.resolve(); };
              HTMLMediaElement.prototype.pause = function() { markPaused(this, true); };
              HTMLMediaElement.prototype.load = function() {};
            })();
            """
        )

        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.gameMenuDebug && window.uiDebug && window.audioDebug")
        page.evaluate("() => { window.gameMenuDebug.closeMainMenu(); window.uiDebug.setChatOpen(false); }")

        # Esc audio tab no longer contains the radio controls.
        page.keyboard.press("Escape")
        page.click("[data-settings-tab='audio']")
        assert page.locator("#audioSfxTest").is_visible()
        assert page.locator("#radioMusicStart").count() == 1
        assert page.locator("#audioStation").count() == 0
        assert "Radio moved to the slim left canvas widget roster" in page.locator("[data-settings-panel='audio']").inner_text()
        page.click("[data-settings-tab='performance']")
        assert page.locator("#dynamicShadows").is_visible()
        assert page.locator("#dynamicShadows").is_checked() is False
        assert page.evaluate("window.getGameState().dynamicShadowsEnabled") is False
        page.locator("#dynamicShadows").check()
        assert page.evaluate("window.getGameState().dynamicShadowsEnabled") is True
        page.locator("#dynamicShadows").uncheck()
        assert page.evaluate("window.getGameState().dynamicShadowsEnabled") is False
        page.keyboard.press("Escape")

        # The roster starts folded into the left edge and opens on left-border hover.
        box = page.locator("#widgetRoster").bounding_box()
        assert box is not None
        initial_left = box["x"]
        assert initial_left < 0, initial_left
        page.mouse.move(2, 410)
        page.wait_for_function("() => document.getElementById('widgetRoster').getBoundingClientRect().left >= -1")
        page.locator("#radioWidgetToggle").click()
        page.wait_for_function("() => !document.getElementById('radioWidgetPanel').hidden")

        stations = page.evaluate("() => window.audioDebug.state().stations")
        assert set(stations) == EXPECTED_STATIONS, stations
        for key in EXPECTED_STATIONS:
            button = page.locator(f"[data-radio-station='{key}']")
            assert button.is_visible(), key
            assert button.locator("b").inner_text().strip(), key
            assert button.locator("small").inner_text().strip(), key

        # Selecting a station updates persisted state; Play/Stop update widget status with click feedback path exercised.
        page.locator("[data-radio-station='vaporwaves']").click()
        assert page.evaluate("() => window.audioDebug.state().station") == "vaporwaves"
        page.locator("#radioMusicStart").click()
        page.wait_for_function("() => window.audioDebug.state().musicPlaying")
        assert "Playing Vaporwaves" in page.locator("#radioMusicStatus").inner_text()
        page.locator("#radioMusicStop").click()
        assert "stopped" in page.locator("#radioMusicStatus").inner_text().lower()

        # First Esc closes the radio/music widget only; the game menu opens on the next Esc.
        page.keyboard.press("Escape")
        page.wait_for_function("() => document.getElementById('radioWidgetPanel').hidden")
        assert page.locator("#settingsOverlay").evaluate("el => el.hidden") is True
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden")

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        assert not errors, errors
        browser.close()

    httpd.shutdown()
    with contextlib.suppress(Exception):
        thread.join(timeout=1)

print("radio widget smoke passed")
