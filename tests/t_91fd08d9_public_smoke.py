#!/usr/bin/env python3
"""Public smoke for t_91fd08d9: radio Esc behavior and dynamic shadow performance toggle."""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_91fd08d9"
SCREENSHOT = ROOT / "t_91fd08d9-radio-shadows-public.png"

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
          try { localStorage.clear(); } catch {}
        })();
        """
    )

    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("() => window.gameMenuDebug && window.uiDebug && window.audioDebug && window.getGameState")
    page.evaluate("() => { window.gameMenuDebug.closeMainMenu(); window.uiDebug.setChatOpen(false); document.activeElement?.blur(); }")

    page.keyboard.press("Escape")
    page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden")
    page.click("[data-settings-tab='performance']")
    assert page.locator("#dynamicShadows").is_visible()
    assert page.locator("#dynamicShadows").is_checked() is False
    assert page.evaluate("window.getGameState().dynamicShadowsEnabled") is False
    page.locator("#dynamicShadows").check()
    assert page.evaluate("window.getGameState().dynamicShadowsEnabled") is True
    page.locator("#dynamicShadows").uncheck()
    assert page.evaluate("window.getGameState().dynamicShadowsEnabled") is False
    page.keyboard.press("Escape")
    page.wait_for_function("() => document.getElementById('settingsOverlay').hidden")

    page.mouse.move(2, 410)
    page.wait_for_function("() => document.getElementById('widgetRoster').getBoundingClientRect().left >= -1")
    page.locator("#radioWidgetToggle").click()
    page.wait_for_function("() => !document.getElementById('radioWidgetPanel').hidden")
    page.keyboard.press("Escape")
    page.wait_for_function("() => document.getElementById('radioWidgetPanel').hidden")
    assert page.locator("#settingsOverlay").evaluate("el => el.hidden") is True
    page.keyboard.press("Escape")
    page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden")

    page.screenshot(path=str(SCREENSHOT), full_page=True)
    assert not errors, errors
    browser.close()

print(f"public smoke passed: {SCREENSHOT}")
