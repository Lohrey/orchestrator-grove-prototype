// Ad-hoc verification for the WebGL2 atlas builder.
// Mocks the sprite cache with mixed sizes (32/64/256), confirms the UV map
// has correct coordinates, all sprites fit, and array entries get per-frame
// UV keys.
//
// Run: node tests/webgl2-atlas-mixed-sizes-unit.mjs

import assert from 'node:assert/strict';

// buildAtlas is exported as a pure function that only needs a sprite cache
// object with blittable image sources (HTMLCanvasElement-like). In Node we
// can use OffscreenCanvas if available, otherwise a minimal stub that
// satisfies the drawImage calls inside buildAtlas.

// ── Stub a blittable image source ─────────────────────────────────────
// buildAtlas only needs the source to be passable to ctx.drawImage and to
// have a getContext method OR be an ImageBitmap. We build a tiny stub canvas.
function makeStubImage(w, h) {
  // Use OffscreenCanvas if available (Node 22+); otherwise a minimal stub
  // whose presence in the atlas is enough for UV-correctness verification.
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  // Minimal stub: buildAtlas guards drawImage in try/catch, so a plain
  // object with width/height is enough to verify UV math.
  return { width: w, height: h, _stub: true };
}

function buildMockSpriteCache() {
  const cache = {};
  // Items: 32×32
  for (const type of ['log', 'stone', 'plank']) {
    cache[`item_${type}`] = makeStubImage(32, 32);
    cache[`item_${type}_meta`] = { w: 32, h: 32, cx: 16, cy: 16 };
  }
  // Bots: 64×64 (single + walk array of 4 frames)
  for (let i = 0; i < 3; i++) {
    cache[`bot_${i}`] = makeStubImage(64, 64);
    cache[`bot_${i}_meta`] = { w: 64, h: 64, cx: 32, cy: 32 };
    const frames = [];
    for (let f = 0; f < 4; f++) frames.push(makeStubImage(64, 64));
    cache[`bot_${i}_walk`] = frames;
    cache[`bot_${i}_walk_meta`] = { w: 64, h: 64, cx: 32, cy: 32, frames: 4 };
  }
  // Trees: 64×64 with 4 sway frames
  for (const stage of ['grown_tree', 'small_tree', 'sapling']) {
    const frames = [];
    for (let f = 0; f < 4; f++) frames.push(makeStubImage(64, 64));
    cache[`tree_${stage}`] = frames;
    cache[`tree_${stage}_meta`] = { w: 64, h: 64, cx: 32, cy: 32, frames: 4 };
  }
  // Rocks: 64×64
  cache['rock_normal'] = makeStubImage(64, 64);
  cache['rock_normal_meta'] = { w: 64, h: 64, cx: 32, cy: 32 };
  cache['rock_depleted'] = makeStubImage(64, 64);
  cache['rock_depleted_meta'] = { w: 64, h: 64, cx: 32, cy: 32 };
  // Monsters: 64×64 with 4 wobble frames
  for (const type of ['default', 'night_monster']) {
    const frames = [];
    for (let f = 0; f < 4; f++) frames.push(makeStubImage(64, 64));
    cache[`monster_${type}`] = frames;
    cache[`monster_${type}_meta`] = { w: 64, h: 64, cx: 32, cy: 32, frames: 4 };
  }
  // Structures: 256×256
  for (const type of ['workbench', 'factory', 'sawbench', 'smithery']) {
    cache[`structure_${type}`] = makeStubImage(256, 256);
    cache[`structure_${type}_meta`] = { w: 256, h: 256, cx: 128, cy: 128 };
  }
  // Player: 64×64
  for (const facing of ['e', 'w', 'n', 's']) {
    cache[`player_normal_${facing}`] = makeStubImage(64, 64);
    cache[`player_normal_${facing}_meta`] = { w: 64, h: 64, cx: 32, cy: 32 };
    cache[`player_lowhp_${facing}`] = makeStubImage(64, 64);
    cache[`player_lowhp_${facing}_meta`] = { w: 64, h: 64, cx: 32, cy: 32 };
  }
  // Dog: 64×64
  cache['dog_left'] = makeStubImage(64, 64);
  cache['dog_left_meta'] = { w: 64, h: 64, cx: 32, cy: 32 };
  cache['dog_right'] = makeStubImage(64, 64);
  cache['dog_right_meta'] = { w: 64, h: 64, cx: 32, cy: 32 };
  return cache;
}

// Inline a minimal buildAtlas replica isn't enough — we want to test the real
// one. Load it via dynamic import. The module uses browser-only globals
// (document, OffscreenCanvas) but buildAtlas itself only needs the sprite
// cache + a canvas factory. We patch globalThis with a minimal document stub
// if needed so the module loads.

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(1, 1);
        // Minimal canvas stub for UV verification
        return {
          width: 0, height: 0,
          getContext: () => ({
            clearRect() {},
            drawImage() {},
            canvas: null
          })
        };
      }
      return {};
    }
  };
}

const { buildAtlas } = await import('../src/renderers/webgl2-renderer.js?v=t_webgl2_atlas_test');

// ── Test 1: empty cache → null ────────────────────────────────────────
assert.equal(buildAtlas(null), null, 'null cache returns null');
assert.equal(buildAtlas({}), null, 'empty cache returns null');

// ── Test 2: mixed-size cache → atlas with UVs ────────────────────────
const cache = buildMockSpriteCache();
const atlas = buildAtlas(cache);
assert.ok(atlas, 'mixed-size cache should produce an atlas');
assert.ok(atlas.canvas, 'atlas should have a canvas');
assert.ok(atlas.uvMap, 'atlas should have a uvMap');

// Atlas dimensions should be power-of-2 (we have 256px sprites, so ≥256)
const isPow2 = n => n > 0 && (n & (n - 1)) === 0;
assert.ok(isPow2(atlas.atlasW), `atlas width should be power-of-2, got ${atlas.atlasW}`);
assert.ok(isPow2(atlas.atlasH), `atlas height should be power-of-2, got ${atlas.atlasH}`);
assert.ok(atlas.atlasW >= 256, `atlas should be at least 256 wide, got ${atlas.atlasW}`);
assert.ok(atlas.atlasW <= 4096, `atlas width should be capped at 4096, got ${atlas.atlasW}`);

// ── Test 3: every sprite key gets a UV entry ──────────────────────────
// Single-frame keys: item_log, bot_0, rock_normal, structure_workbench, etc.
assert.ok(atlas.uvMap['item_log'], 'item_log should have a UV entry');
assert.ok(atlas.uvMap['bot_0'], 'bot_0 should have a UV entry');
assert.ok(atlas.uvMap['rock_normal'], 'rock_normal should have a UV entry');
assert.ok(atlas.uvMap['structure_workbench'], 'structure_workbench should have a UV entry');
assert.ok(atlas.uvMap['player_normal_e'], 'player_normal_e should have a UV entry');
assert.ok(atlas.uvMap['dog_left'], 'dog_left should have a UV entry');

// Array entries: bot_0_walk should NOT exist as a single UV; instead
// bot_0_walk_0, bot_0_walk_1, bot_0_walk_2, bot_0_walk_3 should exist.
assert.ok(!atlas.uvMap['bot_0_walk'], 'array base key should not have a single UV');
assert.ok(atlas.uvMap['bot_0_walk_0'], 'bot_0_walk frame 0 should have a UV entry');
assert.ok(atlas.uvMap['bot_0_walk_1'], 'bot_0_walk frame 1 should have a UV entry');
assert.ok(atlas.uvMap['bot_0_walk_2'], 'bot_0_walk frame 2 should have a UV entry');
assert.ok(atlas.uvMap['bot_0_walk_3'], 'bot_0_walk frame 3 should have a UV entry');

assert.ok(atlas.uvMap['tree_grown_tree_0'], 'tree sway frame 0 should have a UV entry');
assert.ok(atlas.uvMap['tree_grown_tree_3'], 'tree sway frame 3 should have a UV entry');
assert.ok(atlas.uvMap['monster_default_0'], 'monster wobble frame 0 should have a UV entry');
assert.ok(atlas.uvMap['monster_night_monster_3'], 'monster wobble frame 3 should have a UV entry');

// ── Test 4: UV coordinates are normalized 0..1 and within atlas bounds ─
function checkUV(label, uv, atlasW, atlasH, expectedW, expectedH) {
  assert.ok(uv.u0 >= 0 && uv.u0 <= 1, `${label}: u0 out of range: ${uv.u0}`);
  assert.ok(uv.v0 >= 0 && uv.v0 <= 1, `${label}: v0 out of range: ${uv.v0}`);
  assert.ok(uv.u1 > uv.u0, `${label}: u1 should be > u0`);
  assert.ok(uv.v1 > uv.v0, `${label}: v1 should be > v0`);
  assert.ok(uv.u1 <= 1, `${label}: u1 out of range: ${uv.u1}`);
  assert.ok(uv.v1 <= 1, `${label}: v1 out of range: ${uv.v1}`);
  // Verify the UV rect maps back to the expected pixel size
  const pxW = Math.round((uv.u1 - uv.u0) * atlasW);
  const pxH = Math.round((uv.v1 - uv.v0) * atlasH);
  assert.equal(pxW, expectedW, `${label}: UV width ${pxW} != expected ${expectedW}`);
  assert.equal(pxH, expectedH, `${label}: UV height ${pxH} != expected ${expectedH}`);
}

checkUV('item_log', atlas.uvMap['item_log'], atlas.atlasW, atlas.atlasH, 32, 32);
checkUV('bot_0', atlas.uvMap['bot_0'], atlas.atlasW, atlas.atlasH, 64, 64);
checkUV('bot_0_walk_0', atlas.uvMap['bot_0_walk_0'], atlas.atlasW, atlas.atlasH, 64, 64);
checkUV('rock_normal', atlas.uvMap['rock_normal'], atlas.atlasW, atlas.atlasH, 64, 64);
checkUV('tree_grown_tree_0', atlas.uvMap['tree_grown_tree_0'], atlas.atlasW, atlas.atlasH, 64, 64);
checkUV('monster_default_0', atlas.uvMap['monster_default_0'], atlas.atlasW, atlas.atlasH, 64, 64);
checkUV('structure_workbench', atlas.uvMap['structure_workbench'], atlas.atlasW, atlas.atlasH, 256, 256);
checkUV('player_normal_e', atlas.uvMap['player_normal_e'], atlas.atlasW, atlas.atlasH, 64, 64);

// ── Test 4b: center offsets (cx, cy) are recorded for centering ───────
assert.equal(atlas.uvMap['item_log'].cx, 16, 'item_log cx should be 16 (32/2)');
assert.equal(atlas.uvMap['item_log'].cy, 16, 'item_log cy should be 16 (32/2)');
assert.equal(atlas.uvMap['bot_0'].cx, 32, 'bot_0 cx should be 32 (64/2)');
assert.equal(atlas.uvMap['bot_0'].cy, 32, 'bot_0 cy should be 32 (64/2)');
assert.equal(atlas.uvMap['structure_workbench'].cx, 128, 'structure cx should be 128 (256/2)');
assert.equal(atlas.uvMap['structure_workbench'].cy, 128, 'structure cy should be 128 (256/2)');

// ── Test 5: no two sprites share the same atlas region (no overlaps) ───
// Collect all UV rects and verify they don't overlap (allowing 0-area edges).
const rects = [];
for (const [key, uv] of Object.entries(atlas.uvMap)) {
  rects.push({ key, x: uv.u0, y: uv.v0, w: uv.u1 - uv.u0, h: uv.v1 - uv.v0 });
}
function overlap(a, b) {
  // Use a small epsilon to ignore touching edges
  const eps = 0.0001;
  return a.x < b.x + b.w - eps && a.x + a.w - eps > b.x &&
         a.y < b.y + b.h - eps && a.y + a.h - eps > b.y;
}
let overlaps = 0;
for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) {
    if (overlap(rects[i], rects[j])) {
      overlaps++;
      if (overlaps <= 3) console.log(`  overlap: ${rects[i].key} ↔ ${rects[j].key}`);
    }
  }
}
assert.equal(overlaps, 0, `${overlaps} sprite overlaps detected in atlas`);

// ── Test 6: 4 walk frames per bot get distinct UVs ────────────────────
const walkFrames = [0, 1, 2, 3].map(f => atlas.uvMap[`bot_0_walk_${f}`]);
const distinct = new Set(walkFrames.map(uv => `${uv.u0},${uv.v0},${uv.u1},${uv.v1}`));
assert.equal(distinct.size, 4, 'bot_0_walk frames should have 4 distinct UV rects');

console.log('webgl2 atlas mixed-sizes unit tests passed');
console.log(`  atlas size: ${atlas.atlasW}×${atlas.atlasH}`);
console.log(`  uv entries: ${Object.keys(atlas.uvMap).length}`);
