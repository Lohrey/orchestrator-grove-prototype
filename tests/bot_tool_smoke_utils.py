from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_URL = "http://127.0.0.1:8097"

BOT_TOOL_CAPTURE_JS = """
async () => {
  document.body.innerHTML = '<canvas id="botToolSmoke" width="420" height="280" style="width:420px;height:280px"></canvas>';
  const canvas = document.getElementById('botToolSmoke');
  const mod = await import('./src/renderers/index.js?v=t_building_kits_0618');
  const backend = await mod.createRenderBackend({ canvas, mode: 'pixi', capture: true });
  const readCanvas = document.createElement('canvas');
  readCanvas.width = canvas.width;
  readCanvas.height = canvas.height;
  const c = readCanvas.getContext('2d', { willReadFrequently: true });
  const bot = { id: 1, name: 'Bot 1', x: 180, y: 145, r: 11, color: '#80a9c9', inventory: null, tool: null, equipment: {}, facingX: 1, facingY: 0 };
  const state = {
    W: canvas.width,
    H: canvas.height,
    map: { width: canvas.width, height: canvas.height },
    camera: { x: 0, y: 0, zoom: 1 },
    mouse: { hoverBot: null, hoverItem: null, hoverTree: null, hoverStructure: null },
    holes: [], rocks: [], hempPlants: [], structures: [], projectiles: [], items: [], monsters: [], trees: [], zones: [], floaters: [], mapFeatures: [],
    bots: [bot],
    player: { x: -200, y: -200, r: 13, inventory: null, equipment: {}, facingX: 1, facingY: 0 },
    assistant: { x: -240, y: -240, facingX: 1, facingY: 0 },
    multiplayer: { enabled: false, players: {} },
    placementType: null,
    zoneDraft: null,
    fps: 60,
    targetFps: 60,
    dayNight: null,
    mobile: false,
    showFpsOverlay: false
  };
  function region(cx, cy, w, h) {
    const x = Math.max(0, Math.round(cx - w / 2));
    const y = Math.max(0, Math.round(cy - h / 2));
    return Array.from(c.getImageData(x, y, w, h).data);
  }
  function diff(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 4) {
      total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    }
    return total;
  }
  function capture(type) {
    bot.inventory = type ? { type, count: 1 } : null;
    backend.draw(state);
    return canvas.toDataURL();
  }
  async function captureRegions(type) {
    const dataUrl = capture(type);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    c.clearRect(0, 0, readCanvas.width, readCanvas.height);
    c.drawImage(img, 0, 0);
    return {
      above: region(bot.x, bot.y - 24, 30, 22),
      hand: region(bot.x + 22, bot.y + 6, 34, 34)
    };
  }

  const empty = await captureRegions(null);
  const tool = await captureRegions('crude_axe');
  const log = await captureRegions('log');
  const rendererBackend = backend.kind;
  const pixiLoaded = performance.getEntriesByType('resource').some(entry => entry.name.includes('pixi-renderer.js') || entry.name.includes('/vendor/pixi/pixi.mjs'));
  backend.destroy();
  return {
    aboveToolDiff: diff(empty.above, tool.above),
    aboveLogDiff: diff(empty.above, log.above),
    handToolDiff: diff(empty.hand, tool.hand),
    handLogDiff: diff(empty.hand, log.hand),
    rendererBackend,
    pixiLoaded
  };
}
"""


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


def start_local_server(port: int = 8097) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["PORT"] = str(port)
    return subprocess.Popen(
        ["node", "server.mjs"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
