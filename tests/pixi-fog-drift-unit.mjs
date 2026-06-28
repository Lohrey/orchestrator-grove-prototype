/**
 * Unit test for the Pixi fog-of-war overlay — full-map sprite approach.
 *
 * The fog sprite covers the ENTIRE map at world (0,0). The worldViewport
 * transform (scale + translate) handles camera movement automatically.
 * The sprite position is always (0,0) — it never moves. Only the fog
 * canvas content is redrawn when fog revision/sources/occluders change.
 *
 * This eliminates:
 *   - Fog drifting opposite to camera movement
 *   - Visible rectangle edges when zoomed out
 *   - Transparent areas outside the viewport-sized canvas
 */

import { updateFogOverlay } from '../src/renderers/pixi/pixi-effects.js?v=fog_fullmap_0628';
import assert from 'node:assert';

function makeCanvasContextStub() {
  return {
    canvas: { width: 800, height: 600 },
    save() {}, restore() {},
    clearRect() {}, fillRect() {}, setTransform() {},
    fillStyle: '', globalCompositeOperation: '',
    beginPath() {}, arc() {}, fill() {}, ellipse() {},
    translate() {}, moveTo() {}, lineTo() {}, stroke() {},
    quadraticCurveTo() {}, closePath() {}
  };
}

function makeSpriteStub() {
  const pos = { x: 0, y: 0 };
  let visible = true;
  let positionSetCount = 0;
  return {
    visible: true,
    position: { set(x, y) { pos.x = x; pos.y = y; positionSetCount++; }, get x() { return pos.x; }, get y() { return pos.y; } },
    scale: { set(v) {}, get x() { return 1; }, get y() { return 1; } },
    get _positionSetCount() { return positionSetCount; },
    _setVisible(v) { visible = v; }
  };
}

function makeTextureStub() {
  return { source: { update() {} }, update() {} };
}

// ── Test 1: Sprite is always at (0,0) regardless of camera/fogView ──
{
  const rs = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64, enabled: true },
    dynamicShadowsEnabled: false,
    camera: { x: 500, y: 400, zoom: 1.5 }
  };
  const fogOverlayCanvas = { width: 800, height: 600 };
  const fogOverlayContext = makeCanvasContextStub();
  fogOverlayContext.canvas = fogOverlayCanvas;
  const fogOverlaySprite = makeSpriteStub();
  const fogOverlayTexture = makeTextureStub();

  function resizeOverlayCanvas(canvas, sprite, texture, w, h, x, y) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  const lastFogOverlaySignatureRef = { value: '' };
  const baseOpts = { fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture, resizeOverlayCanvas, lastFogOverlaySignatureRef };

  const view = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  const fogView = { left: 100, top: 200, right: 900, bottom: 800, width: 800, height: 600 };

  updateFogOverlay(rs, view, fogView, [], [], 0, baseOpts);

  assert.equal(fogOverlaySprite.position.x, 0, 'Sprite must always be at x=0 (full-map anchored)');
  assert.equal(fogOverlaySprite.position.y, 0, 'Sprite must always be at y=0 (full-map anchored)');
  console.log('PASS: sprite anchored at (0,0) regardless of camera position');
}

// ── Test 2: Canvas resized to full map dimensions ──────────────────
{
  const rs = {
    map: { width: 3600, height: 2400 },
    fogOfWar: { revision: 1, cellSize: 64, enabled: true },
    dynamicShadowsEnabled: false
  };
  const fogOverlayCanvas = { width: 800, height: 600 };
  const fogOverlayContext = makeCanvasContextStub();
  fogOverlayContext.canvas = fogOverlayCanvas;
  const fogOverlaySprite = makeSpriteStub();
  const fogOverlayTexture = makeTextureStub();

  function resizeOverlayCanvas() {}

  const lastFogOverlaySignatureRef = { value: '' };
  const baseOpts = { fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture, resizeOverlayCanvas, lastFogOverlaySignatureRef };

  const view = { left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 };
  const fogView = { left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 };

  updateFogOverlay(rs, view, fogView, [], [], 0, baseOpts);

  assert.equal(fogOverlayCanvas.width, 3600, 'Canvas width must match map width');
  assert.equal(fogOverlayCanvas.height, 2400, 'Canvas height must match map height');
  console.log('PASS: fog canvas resized to full map dimensions');
}

// ── Test 3: No redraw when only camera moves (signature stable) ────
{
  const rs = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64, enabled: true },
    dynamicShadowsEnabled: false
  };
  const fogOverlayCanvas = { width: 2000, height: 1600 };
  const fogOverlayContext = makeCanvasContextStub();
  fogOverlayContext.canvas = fogOverlayCanvas;
  let clearCount = 0;
  const origClear = fogOverlayContext.clearRect;
  fogOverlayContext.clearRect = function(...args) { clearCount++; origClear.apply(this, args); };
  const fogOverlaySprite = makeSpriteStub();
  const fogOverlayTexture = makeTextureStub();

  function resizeOverlayCanvas() {}
  const lastFogOverlaySignatureRef = { value: '' };
  const baseOpts = { fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture, resizeOverlayCanvas, lastFogOverlaySignatureRef };

  const view1 = { left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 };
  const fogView1 = { left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 };
  updateFogOverlay(rs, view1, fogView1, [], [], 0, baseOpts);
  const clearsAfterFirst = clearCount;

  // Move camera — fog state hasn't changed, so no redraw
  const view2 = { left: 500, top: 300, right: 1460, bottom: 940, width: 960, height: 640 };
  const fogView2 = { left: 500, top: 300, right: 1460, bottom: 940, width: 960, height: 640 };
  updateFogOverlay(rs, view2, fogView2, [], [], 0, baseOpts);

  assert.equal(clearCount, clearsAfterFirst, 'No canvas redraw when only camera moves');
  console.log('PASS: no redraw when only camera position changes');
}

// ── Test 4: Redraw when fog revision changes ───────────────────────
{
  const rs1 = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64, enabled: true },
    dynamicShadowsEnabled: false
  };
  const fogOverlayCanvas = { width: 2000, height: 1600 };
  const fogOverlayContext = makeCanvasContextStub();
  fogOverlayContext.canvas = fogOverlayCanvas;
  let clearCount = 0;
  const origClear = fogOverlayContext.clearRect;
  fogOverlayContext.clearRect = function(...args) { clearCount++; origClear.apply(this, args); };
  const fogOverlaySprite = makeSpriteStub();
  const fogOverlayTexture = makeTextureStub();

  function resizeOverlayCanvas() {}
  const lastFogOverlaySignatureRef = { value: '' };
  const baseOpts = { fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture, resizeOverlayCanvas, lastFogOverlaySignatureRef };

  const view = { left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 };
  const fogView = { left: 0, top: 0, right: 960, bottom: 640, width: 960, height: 640 };

  updateFogOverlay(rs1, view, fogView, [], [], 0, baseOpts);
  const clearsAfterRev1 = clearCount;

  const rs2 = { ...rs1, fogOfWar: { revision: 2, cellSize: 64, enabled: true } };
  updateFogOverlay(rs2, view, fogView, [], [], 0, baseOpts);

  assert.ok(clearCount > clearsAfterRev1, 'Canvas must redraw when fog revision changes');
  console.log('PASS: redraw triggered when fog revision changes');
}

console.log('\npixi fog full-map unit tests passed');
