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


def load_page(page, url: str) -> None:
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("() => window.getCameraState && window.teachDebug && document.querySelector('canvas')")
    page.evaluate("() => { if (window.gameMenuDebug?.isPaused?.()) window.gameMenuDebug.startTest?.(); }")
    page.wait_for_function("() => !window.gameMenuDebug?.isPaused?.()")


def dispatch_key(page, kind: str, key: str) -> None:
    page.evaluate(
        "([kind, key]) => window.dispatchEvent(new KeyboardEvent(kind, { key, bubbles: true, cancelable: true }))",
        [kind, key],
    )


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html?v=t_touch_camera_bounds"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
            device_scale_factor=2,
        )
        page = context.new_page()
        load_page(page, url)

        drag_result = page.evaluate(
            """
            () => {
              const canvas = document.querySelector('canvas');
              const rect = canvas.getBoundingClientRect();
              const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                pointerId: 41,
                pointerType: 'touch',
                isPrimary: true,
                button: 0,
                buttons: type === 'pointerup' ? 0 : 1,
                clientX: rect.left + x,
                clientY: rect.top + y
              }));
              const before = window.getCameraState().camera;
              fire('pointerdown', 150, 240);
              fire('pointermove', 260, 330);
              fire('pointerup', 260, 330);
              return { before, after: window.getCameraState().camera };
            }
            """
        )
        before = drag_result["before"]
        after = drag_result["after"]
        assert after["x"] < before["x"] - 60, drag_result
        assert after["y"] < before["y"] - 45, drag_result

        load_page(page, url + "&bounds=1")
        top_left = page.evaluate(
            """
            () => {
              const canvas = document.querySelector('canvas');
              const rect = canvas.getBoundingClientRect();
              canvas.dispatchEvent(new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: 1000,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
              }));
              const state = window.getCameraState();
              return {
                camera: state.camera,
                map: state.map,
                canvas: { width: canvas.width, height: canvas.height },
                topLeftScreen: {
                  x: (0 - state.camera.x) * state.camera.zoom,
                  y: (0 - state.camera.y) * state.camera.zoom
                }
              };
            }
            """
        )
        assert top_left["camera"]["zoom"] <= 0.56, top_left
        assert top_left["camera"]["x"] < -40, top_left
        assert top_left["camera"]["y"] < -40, top_left
        assert top_left["topLeftScreen"]["x"] > 35, top_left
        assert top_left["topLeftScreen"]["y"] > 35, top_left

        dispatch_key(page, "keydown", "d")
        dispatch_key(page, "keydown", "s")
        bottom_right = page.evaluate(
            """
            () => {
              window.teachDebug.tickWorld(20);
              const canvas = document.querySelector('canvas');
              const state = window.getCameraState();
              return {
                camera: state.camera,
                map: state.map,
                canvas: { width: canvas.width, height: canvas.height },
                bottomRightScreen: {
                  x: (state.map.width - state.camera.x) * state.camera.zoom,
                  y: (state.map.height - state.camera.y) * state.camera.zoom
                }
              };
            }
            """
        )
        dispatch_key(page, "keyup", "d")
        dispatch_key(page, "keyup", "s")
        assert bottom_right["bottomRightScreen"]["x"] < bottom_right["canvas"]["width"] - 35, bottom_right
        assert bottom_right["bottomRightScreen"]["y"] < bottom_right["canvas"]["height"] - 35, bottom_right

        context.close()
        browser.close()

    server.shutdown()

print("mobile touch camera bounds smoke passed")
