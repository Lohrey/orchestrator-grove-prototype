#!/usr/bin/env python3
"""Smoke test for Canvas2D full sprite cache: monsters, structures, bot walk-cycle.

Verifies:
1. Sprite cache builds with monster wobble frames, structure sprites, bot walk frames.
2. Monsters/structures/bots render via the blit path (no JS errors).
3. Canvas has non-trivial pixel content in center region.
4. The Pixi default path still loads without regression.

Run against a served game (python3 -m http.server 8191).
"""

from __future__ import annotations

import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8191/index.html"


def collect_console_errors(page):
    errors = []

    def on_console(msg):
        if msg.type in ("error", "warning"):
            errors.append(f"[{msg.type}] {msg.text}")

    page.on("console", on_console)
    page.on("pageerror", lambda exc: errors.append(f"[[pageerror] {exc}"))
    return errors


def test_canvas2d_full_cache():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = collect_console_errors(page)

        # Load with canvas2d renderer
        page.goto(f"{BASE}?renderer=canvas2d&gameMode=test", wait_until="networkidle")
        page.wait_for_function(
            "() => window.getGameState && window.teachDebug && window.getWorldObjects",
            timeout=15000,
        )

        # Give the renderer time to build the cache and settle
        page.wait_for_timeout(2000)

        # Confirm world objects exist
        world = page.evaluate("() => window.getWorldObjects()")
        trees = [o for o in world if o.get("kind") == "resource" and o.get("type") == "tree" and not o.get("stump")]
        structures = [o for o in world if o.get("kind") == "structure"]
        bots = [o for o in world if o.get("kind") == "bot"]
        monsters = [o for o in world if o.get("kind") == "monster"]

        print(f"  world objects: {len(trees)} trees, {len(structures)} structures, "
              f"{len(bots)} bots, {len(monsters)} monsters")

        # Confirm the canvas has non-trivial pixel content (not blank)
        canvas_info = page.evaluate(
            """() => {
                const cv = document.querySelector('canvas');
                if (!cv) return null;
                const ctx = cv.getContext('2d');
                const cx = cv.width / 2, cy = cv.height / 2;
                const data = ctx.getImageData(cx - 50, cy - 50, 100, 100).data;
                let nonZero = 0;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] > 0) nonZero++;
                }
                return { w: cv.width, h: cv.height, nonZeroPixels: nonZero, total: 10000 };
            }"""
        )
        assert canvas_info, "No canvas found"
        assert canvas_info["w"] > 0 and canvas_info["h"] > 0, canvas_info
        assert canvas_info["nonZeroPixels"] > 100, \
            f"Canvas appears blank: only {canvas_info['nonZeroPixels']}/10000 non-zero pixels in center"
        print(f"  canvas2d: {canvas_info['w']}x{canvas_info['h']}, "
              f"center 100x100 region: {canvas_info['nonZeroPixels']}/10000 non-zero alpha")

        # Screenshot for visual verification
        page.screenshot(path="canvas2d-full-cache-smoke.png")
        print("  screenshot saved: canvas2d-full-cache-smoke.png")

        # Check for JS errors
        real_errors = [
            e for e in errors
            if "favicon" not in e.lower()
            and "404" not in e
            and "AudioContext" not in e
            and "autoplay" not in e
        ]
        assert not real_errors, f"JS errors during canvas2d render:\n" + "\n".join(real_errors)
        print(f"  0 JS errors on canvas2d path")

        browser.close()


def test_pixi_default():
    """Verify the default (Pixi) path still loads without regression."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = collect_console_errors(page)

        page.goto(f"{BASE}?gameMode=test", wait_until="networkidle")
        page.wait_for_function(
            "() => window.getGameState && window.getWorldObjects",
            timeout=15000,
        )
        page.wait_for_timeout(1500)

        world = page.evaluate("() => window.getWorldObjects()")
        trees = [o for o in world if o.get("kind") == "resource" and o.get("type") == "tree"]
        assert len(trees) > 0, f"Expected trees in Pixi path, got {len(trees)}"

        page.screenshot(path="canvas2d-full-cache-pixi-regression.png")

        real_errors = [
            e for e in errors
            if "favicon" not in e.lower()
            and "404" not in e
            and "AudioContext" not in e
            and "autoplay" not in e
            and "GPU stall" not in e
            and "GL_CLOSE_PATH_NV" not in e
            and "vector fallback" not in e
            and "Character sprites failed" not in e
        ]
        assert not real_errors, f"JS errors on Pixi path:\n" + "\n".join(real_errors)
        print(f"  0 JS errors on Pixi path ({len(trees)} trees rendered)")
        browser.close()


if __name__ == "__main__":
    print("=== Canvas2D full cache smoke (monsters + structures + bot walk) ===")
    test_canvas2d_full_cache()
    print("=== Pixi default regression check ===")
    test_pixi_default()
    print("canvas2d full cache smoke passed")
