#!/usr/bin/env python3
"""Playwright smoke for building-kit menus plus bot deploy/disassemble action steps."""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TAG = "t_building_kits_0618"
SHOT = ROOT / f"{TAG}-building-kits-smoke.png"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def tick(page, seconds: float, step: float = 0.05) -> None:
    page.evaluate(
        """
        ([seconds, step]) => {
          for (let t = 0; t < seconds; t += step) window.teachDebug.tickWorld(step);
        }
        """,
        [seconds, step],
    )


def start_game(page) -> None:
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.validateDslProgram && window.actionStepChainRows", timeout=45000)
    if page.evaluate("() => window.gameMenuDebug?.isPaused?.() || !!window.getGameState().paused"):
        page.evaluate("() => window.gameMenuDebug.startTest()")
        page.wait_for_function("() => !window.getGameState().paused", timeout=15000)


def world_to_client(page, x: float, y: float) -> dict:
    return page.evaluate(
        """
        ({ x, y }) => {
          const canvas = document.getElementById('game');
          const rect = canvas.getBoundingClientRect();
          const { camera } = window.getCameraState();
          const sx = (x - camera.x) * (camera.zoom || 1);
          const sy = (y - camera.y) * (camera.zoom || 1);
          return {
            x: rect.left + sx * rect.width / canvas.width,
            y: rect.top + sy * rect.height / canvas.height,
          };
        }
        """,
        {"x": x, "y": y},
    )


def run_smoke(url: str) -> None:
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        start_game(page)

        rows = page.evaluate("() => window.actionStepChainRows.map(r => r.op)")
        allowed = page.evaluate("() => window.allowedProgramOps")
        for op in ("deploy_building_kit", "disassemble_building_to_kit"):
            assert op in rows, {"missingRow": op, "rows": rows}
            assert op in allowed, {"missingAllowed": op, "allowed": allowed}

        player = page.evaluate("() => window.getGameState().player")
        page.evaluate("p => window.teachDebug.spawnItem('sawbench_kit', p.x + 34, p.y + 6)", player)
        kit_item = page.evaluate("() => window.getWorldObjects().find(i => i.kind === 'item' && i.type === 'sawbench_kit')")
        point = world_to_client(page, kit_item["x"], kit_item["y"])
        page.mouse.click(point["x"], point["y"], button="right")
        page.locator("#structureMenu [data-kit-pickup]").wait_for(state="visible", timeout=5000)
        assert page.locator("#structureMenu [data-kit-deploy]").is_visible()
        page.evaluate("() => document.querySelector('#structureMenu [data-close]')?.click()")

        page.evaluate("() => window.teachDebug.setBotInventory(1, null)")
        bot = page.evaluate("() => window.getGameState().bots[0]")
        bench = page.evaluate(
            "bot => window.teachDebug.placeStructure('workbench', bot.x + 20, bot.y)",
            bot,
        )
        page.evaluate("id => window.teachDebug.openStructureMenu(id)", bench["id"])
        page.locator("#structureMenu [data-disassemble-structure]").wait_for(state="visible", timeout=5000)
        page.evaluate("() => document.querySelector('#structureMenu [data-close]')?.click()")
        valid = page.evaluate(
            """
            ({ bench, bot }) => window.validateDslProgram({ steps: [
              { op: 'disassemble_building_to_kit', target: bench.name },
              { op: 'deploy_building_kit', type: 'workbench kit', zone: { kind: 'radius', x: bot.x + 95, y: bot.y, radius: 40 } },
              { op: 'loop' }
            ]})
            """,
            {"bench": bench, "bot": bot},
        )
        assert valid["ok"] is True, valid
        assigned = page.evaluate(
            "program => window.assignCustomDslProgram({ botId: 1, program })",
            valid["program"],
        )
        assert assigned["ok"] is True, assigned
        gone = False
        for _ in range(100):
            tick(page, 0.1)
            gone = page.evaluate("id => !window.getWorldObjects().some(s => s.kind === 'structure' && s.numericId === id)", bench["id"])
            if gone:
                break
        assert gone, "bot disassemble did not remove source building"
        deployed = False
        for _ in range(100):
            tick(page, 0.1)
            deployed = page.evaluate(
                "bot => window.getWorldObjects().some(s => s.kind === 'structure' && s.type === 'workbench' && Math.abs(s.x - (bot.x + 95)) < 12)",
                bot,
            )
            if deployed:
                break
        assert deployed, "bot deploy did not create replacement workbench"
        empty_hands = page.evaluate("() => !window.getGameState().bots.find(b => b.id === 1).inventory")
        assert empty_hands, "bot still holds kit after deploy"
        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    assert not errors, errors
    print(f"building kits public smoke passed: {url}")
    print(f"screenshot: {SHOT}")


def main() -> None:
    external_url = os.environ.get("ORCHARD_SMOKE_URL")
    if external_url:
        run_smoke(external_url)
        return
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v={TAG}")
        finally:
            httpd.shutdown()
            thread.join(timeout=2)


if __name__ == "__main__":
    main()
