/**
 * Unit test for the Pixi fog-of-war overlay positioning and signature logic.
 *
 * Root cause being tested:
 *   In the Pixi renderer, fogOverlaySprite is parented inside worldViewport.
 *   Its local position must be set to (fogView.left, fogView.top) every frame
 *   so that Pixi's own world-transform pipeline moves/scales the fog in lock-step
 *   with the camera.  Previously, the sprite position was only updated inside
 *   resizeOverlayCanvas, which only ran when the fogOverlaySignature changed —
 *   meaning small camera moves within a signature bucket left the sprite
 *   "frozen" at stale integer coordinates while the rest of the world moved
 *   smoothly, producing visible drift.
 *
 * This test verifies:
 *   1. fogOverlaySignature changes when fogView bounds change (so the texture
 *      is redrawn when the visible region shifts).
 *   2. fogOverlaySignature does NOT depend on raw camera x/y/zoom — those are
 *      handled by the Pixi world transform, not the texture redraw.
 *   3. updateFogOverlay repositions the sprite every call, even when the
 *      signature is unchanged (no drift between redraws).
 */

import assert from 'node:assert/strict';

// ── Globals needed by transitive imports (pixi-layers.js, fog-of-war.js) ──
const noop = () => {};
globalThis.window ||= {
  innerWidth: 1280,
  innerHeight: 840,
  devicePixelRatio: 1,
  addEventListener: noop,
  removeEventListener: noop,
  requestAnimationFrame: noop
};
globalThis.document ||= {
  createElement(tag) {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => makeCanvasContextStub() };
    }
    return {};
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: noop,
  removeEventListener: noop
};
globalThis.requestAnimationFrame ||= noop;

// ── Minimal PIXI stubs ────────────────────────────────────────────
function makeSpriteStub() {
  const sprite = {
    visible: true,
    position: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
    scale: { x: 1, y: 1, set(v) { this.x = v; this.y = v; } },
    _positionSetCount: 0,
  };
  // Wrap position.set to count calls
  const origSet = sprite.position.set.bind(sprite.position);
  sprite.position.set = (x, y) => {
    sprite._positionSetCount++;
    origSet(x, y);
  };
  return sprite;
}

function makeTextureStub() {
  return {
    source: { update() {} },
    update() {}
  };
}

function makeCanvasContextStub() {
  return {
    canvas: { width: 0, height: 0 },
    clearRect() {},
    setTransform() {},
    save() {},
    restore() {},
    drawImage() {},
    fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fillStyle: '',
    globalCompositeOperation: ''
  };
}

// ── Import the module under test ──────────────────────────────────
const {
  fogOverlaySignature,
  updateFogOverlay
} = await import('../src/renderers/pixi/pixi-effects.js?v=fog_pixi_drift_0628');

// ── Test 1: Signature changes when fogView bounds shift ───────────
{
  const rs = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64, enabled: true },
    dynamicShadowsEnabled: false
  };
  const sources = [{ kind: 'player', x: 500, y: 400, radius: 300, strength: 1 }];
  const fogViewA = { left: 0, top: 0, right: 800, bottom: 600 };
  const fogViewB = { left: 10, top: 10, right: 810, bottom: 610 };

  const sigA = fogOverlaySignature(rs, fogViewA, sources, [], 0.5);
  const sigB = fogOverlaySignature(rs, fogViewB, sources, [], 0.5);

  assert.notEqual(sigA, sigB, 'Signature must change when fogView bounds change');
  console.log('PASS: signature changes when fogView bounds shift');
}

// ── Test 2: Signature does NOT depend on camera x/y/zoom ──────────
{
  const fogView = { left: 0, top: 0, right: 800, bottom: 600 };
  const sources = [];
  const occluders = [];
  const nightAmount = 0.3;

  const rs1 = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64 },
    dynamicShadowsEnabled: false,
    camera: { x: 100, y: 200, zoom: 1.5 }
  };
  const rs2 = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64 },
    dynamicShadowsEnabled: false,
    camera: { x: 999, y: 999, zoom: 0.25 }
  };

  const sig1 = fogOverlaySignature(rs1, fogView, sources, occluders, nightAmount);
  const sig2 = fogOverlaySignature(rs2, fogView, sources, occluders, nightAmount);

  assert.equal(sig1, sig2, 'Signature must NOT depend on camera x/y/zoom');
  console.log('PASS: signature is independent of camera x/y/zoom');
}

// ── Test 3: updateFogOverlay repositions sprite every call ────────
// This is the core drift fix: even when the signature is unchanged
// (no texture redraw), the sprite position must still be updated to
// match the current fogView, so it tracks the camera via the world transform.
{
  const rs = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64, enabled: true },
    dynamicShadowsEnabled: false,
    camera: { x: 0, y: 0, zoom: 1 }
  };
  const fogOverlayCanvas = { width: 800, height: 600 };
  const fogOverlayContext = makeCanvasContextStub();
  fogOverlayContext.canvas = fogOverlayCanvas;
  const fogOverlaySprite = makeSpriteStub();
  const fogOverlayTexture = makeTextureStub();

  function resizeOverlayCanvas(canvas, sprite, texture, w, h, x, y) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    sprite.position.set(x, y);
    sprite.scale.set(1);
    texture.source.update();
    texture.update();
  }

  const lastFogOverlaySignatureRef = { value: '' };

  const baseOpts = {
    fogOverlayCanvas, fogOverlayContext, fogOverlaySprite, fogOverlayTexture,
    resizeOverlayCanvas, lastFogOverlaySignatureRef
  };

  const sources = [];
  const occluders = [];
  const nightAmount = 0;
  const view = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };

  // Frame 1: fogView at (0,0)
  updateFogOverlay(rs, view, { left: 0, top: 0, right: 800, bottom: 600 }, sources, occluders, nightAmount, baseOpts);
  const callsAfterFrame1 = fogOverlaySprite._positionSetCount;
  assert.ok(callsAfterFrame1 >= 1, 'Sprite must be positioned on first frame');
  assert.equal(fogOverlaySprite.position.x, 0, 'Sprite x = 0 for fogView.left=0');
  assert.equal(fogOverlaySprite.position.y, 0, 'Sprite y = 0 for fogView.top=0');

  // Frame 2: fogView shifted by 1 pixel in each axis but signature unchanged
  // (same integer bounds → signature stays the same → texture NOT redrawn)
  const fogView2 = { left: 0, top: 0, right: 800, bottom: 600 };
  updateFogOverlay(rs, view, fogView2, sources, occluders, nightAmount, baseOpts);

  // Frame 3: fogView actually changes bounds — sprite must move even if
  // the signature comparison short-circuits the redraw
  const fogView3 = { left: 5, top: 7, right: 805, bottom: 607 };
  updateFogOverlay(rs, view, fogView3, sources, occluders, nightAmount, baseOpts);
  assert.equal(fogOverlaySprite.position.x, 5, 'Sprite x must track fogView.left even between redraws');
  assert.equal(fogOverlaySprite.position.y, 7, 'Sprite y must track fogView.top even between redraws');

  // Frame 4: fogView shifts again with same signature (5,7 → 5,7 but we
  // want to verify the position is still set)
  updateFogOverlay(rs, view, { left: 5, top: 7, right: 805, bottom: 607 }, sources, occluders, nightAmount, baseOpts);
  assert.equal(fogOverlaySprite.position.x, 5, 'Sprite position stays correct on repeated identical frames');
  assert.equal(fogOverlaySprite.position.y, 7, 'Sprite position stays correct on repeated identical frames');

  const totalPositionSets = fogOverlaySprite._positionSetCount;
  assert.ok(totalPositionSets >= 4, `Sprite position.set must be called every frame (got ${totalPositionSets} for 4 frames)`);

  console.log('PASS: sprite repositioned every frame (no drift between redraws)');
}

// ── Test 4: Signature changes on fog revision ─────────────────────
{
  const rs1 = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 1, cellSize: 64 },
    dynamicShadowsEnabled: false
  };
  const rs2 = {
    map: { width: 2000, height: 1600 },
    fogOfWar: { revision: 2, cellSize: 64 },
    dynamicShadowsEnabled: false
  };
  const fogView = { left: 0, top: 0, right: 800, bottom: 600 };

  const sig1 = fogOverlaySignature(rs1, fogView, [], [], 0);
  const sig2 = fogOverlaySignature(rs2, fogView, [], [], 0);

  assert.notEqual(sig1, sig2, 'Signature must change when fog revision changes');
  console.log('PASS: signature changes on fog revision');
}

console.log('\npixi fog drift unit tests passed');
