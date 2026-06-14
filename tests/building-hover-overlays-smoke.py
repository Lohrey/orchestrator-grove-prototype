#!/usr/bin/env python3
"""Regression check: building name/stat canvas overlays only draw while the building is hovered."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("ORCHESTRATOR_GROVE_BASE_URL", "").rstrip("/")
SCREENSHOT = ROOT / "t_6ebb6251-building-hover-overlays-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


def wait_for_paint(page) -> None:
    page.evaluate("""() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))""")


def text_calls(page) -> list[str]:
    return page.evaluate("() => (window.__canvasTextCalls || []).map(call => String(call.text))")


def run_smoke(url: str) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        failures: list[str] = []
        page.on("pageerror", lambda exc: failures.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: failures.append(f"console error: {msg.text}") if msg.type == "error" else None)
        page.add_init_script(
            """
            (() => {
              window.__canvasTextCalls = [];
              window.__clearCanvasTextCalls = () => { window.__canvasTextCalls = []; };
              const record = (method, args) => window.__canvasTextCalls.push({ method, text: String(args[0]), x: args[1], y: args[2] });
              const fillText = CanvasRenderingContext2D.prototype.fillText;
              const strokeText = CanvasRenderingContext2D.prototype.strokeText;
              CanvasRenderingContext2D.prototype.fillText = function(...args) { record('fillText', args); return fillText.apply(this, args); };
              CanvasRenderingContext2D.prototype.strokeText = function(...args) { record('strokeText', args); return strokeText.apply(this, args); };
            })();
            """
        )

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.getWorldObjects && window.getCameraState && window.teachDebug && window.uiDebug && window.gameMenuDebug")
        page.evaluate("() => { window.uiDebug.setChatOpen(false); window.gameMenuDebug.closeMainMenu(); document.activeElement?.blur(); }")
        target = page.evaluate(
            """
            () => {
              const cam = window.getCameraState().camera;
              const s = window.teachDebug.placeStructure('sawbench', cam.x + 420, cam.y + 320);
              return { id: s.id, name: s.name, x: s.x, y: s.y, stats: `L${s.logs || 0} P${s.planks || 0} Po${s.poles || 0}` };
            }
            """
        )
        assert target and target["name"], target

        page.evaluate("""
        () => {
          const c = document.getElementById('game');
          c.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
          window.__clearCanvasTextCalls();
        }
        """)
        wait_for_paint(page)
        off_hover_text = text_calls(page)
        assert target["name"] not in off_hover_text, off_hover_text
        assert target["stats"] not in off_hover_text, off_hover_text

        page.evaluate(
            """
            ({ x, y }) => {
              const c = document.getElementById('game');
              const rect = c.getBoundingClientRect();
              const s = window.getCameraState();
              const clientX = rect.left + (x - s.camera.x) * (s.camera.zoom || 1) * rect.width / c.width;
              const clientY = rect.top + (y - s.camera.y) * (s.camera.zoom || 1) * rect.height / c.height;
              window.__clearCanvasTextCalls();
              c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX, clientY }));
            }
            """,
            {"x": target["x"], "y": target["y"]},
        )
        page.wait_for_function("() => document.getElementById('game').style.cursor === 'pointer'")
        wait_for_paint(page)
        on_hover_text = text_calls(page)
        assert target["name"] in on_hover_text, on_hover_text
        assert target["stats"] in on_hover_text, on_hover_text

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()
        assert not failures, failures


if BASE_URL:
    run_smoke(f"{BASE_URL}/index.html?v=t_6ebb6251")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v=t_6ebb6251")
        finally:
            server.shutdown()

print("building hover overlays smoke passed")
