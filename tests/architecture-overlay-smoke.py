#!/usr/bin/env python3
"""Smoke test Pixi renderer seam and Svelte overlay bridge."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "t_pixi_worker_wasm-architecture.png"
SERVER_URL = "http://127.0.0.1:8097"

def wait_for_server(url: str, timeout: float = 15.0) -> None:
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"server did not become ready: {url}")


env = os.environ.copy()
env["PORT"] = "8097"
server = subprocess.Popen(
    ["node", "server.mjs"],
    cwd=ROOT,
    env=env,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)

try:
    wait_for_server(f"{SERVER_URL}/index.html")
    url = f"{SERVER_URL}/index.html?renderer=pixi&simWorker=1"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors: list[str] = []
        logs: list[str] = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
        page.goto(url, wait_until="networkidle")
        page.wait_for_function("() => window.getGameState && window.orchestratorUiBridge && window.simWorkerDebug && window.gameMenuDebug")
        page.wait_for_function("() => document.querySelector('.grove-architecture-badge')")
        page.evaluate(
            """
            async () => {
              const waitFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              window.gameMenuDebug.startTest();
              await waitFrame();
              await waitFrame();
            }
            """
        )
        label = page.evaluate("() => window.orchestratorUiBridge.getRendererLabel()")
        backend = page.evaluate("() => window.getGameState().rendererBackend")
        assert "PixiJS" in label, label
        assert backend == "pixi", backend
        assert not any("Pixi renderer failed" in log for log in logs), logs
        assert not any("PixiJS Deprecation Warning" in log for log in logs), logs
        ping = page.evaluate("() => window.simWorkerDebug.ping()")
        assert ping["backend"] == "rust-wasm", ping
        text = page.locator(".grove-architecture-badge").inner_text()
        assert "GROVE ARCHITECTURE" in text.upper(), text
        assert "worker" in text.lower(), text
        page.screenshot(path=str(SCREENSHOT), full_page=True)
        assert not errors, errors
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()

print(f"architecture overlay smoke passed; screenshot={SCREENSHOT}")
