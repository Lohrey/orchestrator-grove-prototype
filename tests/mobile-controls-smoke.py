#!/usr/bin/env python3
import contextlib
import http.server
import socketserver
import subprocess
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_mobile_controls_smoke.png"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

@contextlib.contextmanager
def local_server():
    server = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    server.allow_reuse_address = True
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    old_cwd = Path.cwd()
    try:
        import os
        os.chdir(ROOT)
        thread.start()
        yield port
    finally:
        server.shutdown()
        server.server_close()
        import os
        os.chdir(old_cwd)

def first_empty_tap_point(page):
    return page.evaluate(
        """
        () => {
          const canvas = document.getElementById('game');
          const rect = canvas.getBoundingClientRect();
          const state = window.getCameraState();
          const objects = window.getWorldObjects();
          const zoom = state.camera.zoom || 1;
          const candidates = [
            [0.70, 0.33], [0.62, 0.42], [0.76, 0.48], [0.34, 0.35],
            [0.52, 0.58], [0.24, 0.48], [0.44, 0.25], [0.80, 0.62]
          ];
          const farEnough = (wx, wy) => objects.every(o => {
            const ox = o.x || 0, oy = o.y || 0;
            const radius = Math.max(o.r || o.radius || ((o.w || 0) + (o.h || 0)) / 4 || 18, 28);
            return Math.hypot(wx - ox, wy - oy) > radius + 30;
          });
          for (const [fx, fy] of candidates) {
            const sx = rect.width * fx;
            const sy = rect.height * fy;
            const wx = sx / zoom + state.camera.x;
            const wy = sy / zoom + state.camera.y;
            if (wx > 30 && wy > 30 && wx < state.map.width - 30 && wy < state.map.height - 30 && farEnough(wx, wy)) {
              return { clientX: rect.left + sx, clientY: rect.top + sy, worldX: wx, worldY: wy };
            }
          }
          return { clientX: rect.left + rect.width * 0.72, clientY: rect.top + rect.height * 0.36 };
        }
        """
    )

def main():
    subprocess.run(["node", "--check", "game.js"], cwd=ROOT, check=True)
    subprocess.run(["node", "--check", "src/main.js"], cwd=ROOT, check=True)
    subprocess.run(["node", "--check", "src/world.js"], cwd=ROOT, check=True)
    subprocess.run(["node", "--check", "src/canvas-renderer.js"], cwd=ROOT, check=True)

    errors = []
    with local_server() as port, sync_playwright() as p:
        iphone = p.devices["iPhone 13"]
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone)
        page = context.new_page()
        page.on("console", lambda msg: errors.append(f"console {msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getCameraState && window.uiDebug")
        page.locator("#mainMenuNewBtn").tap()
        page.wait_for_function("() => !document.getElementById('mainMenuModeLayer').hidden")
        page.locator("#mainMenuStartSelectedBtn").tap()
        page.wait_for_function("() => document.getElementById('mainMenuOverlay').hidden && !window.getGameState().paused")
        page.wait_for_function("() => document.getElementById('mobileControls') && getComputedStyle(document.getElementById('mobileControls')).display !== 'none'")
        page.wait_for_function("() => document.getElementById('chatOverlay').classList.contains('is-collapsed')")

        point = first_empty_tap_point(page)
        before_target = page.evaluate("() => window.getCameraState().player.target")
        page.touchscreen.tap(point["clientX"], point["clientY"])
        page.wait_for_function("() => !!window.getCameraState().player.target")
        after_target = page.evaluate("() => window.getCameraState().player.target")
        assert after_target != before_target, "mobile tap should set/change player target"

        page.locator("#mobileSettingsBtn").tap()
        page.wait_for_function("() => !document.getElementById('settingsOverlay').hidden")
        page.locator("#settingsClose").tap()
        page.wait_for_function("() => document.getElementById('settingsOverlay').hidden")

        page.locator("#mobileBuildBtn").tap()
        page.wait_for_function("() => !document.getElementById('buildDrawer').classList.contains('is-collapsed')")
        build_fit = page.evaluate(
            """
            () => {
              const tabs = document.querySelector('.build-tabs');
              const panel = document.getElementById('buildPanel');
              const rect = tabs.getBoundingClientRect();
              const panelRect = panel.getBoundingClientRect();
              const buttons = [...tabs.querySelectorAll('button')].map(b => b.getBoundingClientRect());
              return {
                panelInsideViewport: panelRect.left >= -1 && panelRect.right <= window.innerWidth + 1,
                tabsInsidePanel: rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1,
                buttonsTouchSized: buttons.every(b => b.width >= 44 && b.height >= 40),
                wrapsOrScrolls: tabs.scrollWidth >= tabs.clientWidth && tabs.clientHeight <= 64,
                bodyNoHorizontalScroll: document.documentElement.scrollWidth <= window.innerWidth + 1
              };
            }
            """
        )
        assert all(build_fit.values()), f"build tabs must fit mobile layout: {build_fit}"

        page.locator("#mobileBuildBtn").tap()
        page.wait_for_function("() => document.getElementById('buildDrawer').classList.contains('is-collapsed')")
        page.locator("#mobileChatBtn").tap()
        page.wait_for_function("() => !document.getElementById('chatOverlay').classList.contains('is-collapsed')")

        zoom_before = page.evaluate("() => window.getCameraState().camera.zoom")
        page.locator("#mobileZoomInBtn").tap()
        page.wait_for_function("z => window.getCameraState().camera.zoom > z", arg=zoom_before)
        zoom_after_plus = page.evaluate("() => window.getCameraState().camera.zoom")
        page.locator("#mobileZoomOutBtn").tap()
        page.wait_for_function("z => window.getCameraState().camera.zoom < z", arg=zoom_after_plus)

        # Drag-pan camera via touch gesture.
        cam_before = page.evaluate("() => window.getCameraState().camera")
        page.touchscreen.tap(10, 10)  # release any focus state
        page.dispatch_event("#game", "pointerdown", {"pointerType": "touch", "pointerId": 901, "isPrimary": True, "clientX": 190, "clientY": 430, "button": 0, "buttons": 1})
        page.dispatch_event("#game", "pointermove", {"pointerType": "touch", "pointerId": 901, "isPrimary": True, "clientX": 235, "clientY": 470, "button": 0, "buttons": 1})
        page.dispatch_event("#game", "pointerup", {"pointerType": "touch", "pointerId": 901, "isPrimary": True, "clientX": 235, "clientY": 470, "button": 0, "buttons": 0})
        cam_after = page.evaluate("() => window.getCameraState().camera")
        assert cam_after["x"] != cam_before["x"] or cam_after["y"] != cam_before["y"], "touch drag should pan camera"

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        context.close()
        browser.close()

    assert not errors, "browser errors: " + " | ".join(errors)
    print(f"mobile controls smoke passed; screenshot={SCREENSHOT}")

if __name__ == "__main__":
    main()
