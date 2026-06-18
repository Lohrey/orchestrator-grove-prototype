import assert from 'node:assert/strict';

import { CAMERA_MIN_ZOOM, Game } from '../src/world.js';
import { createRenderState } from '../src/render-state.js';
import {
  BOT_RENDER_MIN_ZOOM,
  DECORATIVE_DETAIL_RENDER_MIN_ZOOM,
  LOOSE_ITEM_RENDER_MIN_ZOOM,
  drawWorld,
  shouldRenderBots,
  shouldRenderDecorativeDetails,
  shouldRenderLooseGroundItems
} from '../src/canvas-renderer.js';

assert.equal(CAMERA_MIN_ZOOM, 0.05, 'camera min zoom constant should allow zooming out to 5%');

const clampHarness = {
  W: 800,
  H: 600,
  map: { width: 3600, height: 2400 },
  camera: { x: 0, y: 0, zoom: 0.01 }
};
Game.prototype.clampCamera.call(clampHarness);
assert.equal(clampHarness.camera.zoom, 0.05, 'clampCamera should clamp to 5% minimum zoom');

const setZoomHarness = {
  W: 800,
  H: 600,
  map: { width: 3600, height: 2400 },
  camera: { x: 0, y: 0, zoom: 1 },
  mouse: { screenX: 0, screenY: 0 },
  screenToWorld: Game.prototype.screenToWorld,
  clampCamera: Game.prototype.clampCamera,
  refreshMouseWorld: Game.prototype.refreshMouseWorld,
  updateHover() {}
};
assert.equal(Game.prototype.setCameraZoom.call(setZoomHarness, 0.01, 400, 300), true);
assert.equal(setZoomHarness.camera.zoom, 0.05, 'setCameraZoom should clamp requests below 5%');

assert.equal(LOOSE_ITEM_RENDER_MIN_ZOOM, 0.55);
assert.equal(DECORATIVE_DETAIL_RENDER_MIN_ZOOM, 0.55);
assert.equal(BOT_RENDER_MIN_ZOOM, 0.30);
assert.equal(shouldRenderLooseGroundItems(0.55), true, 'items render at the 55% threshold');
assert.equal(shouldRenderLooseGroundItems(0.549), false, 'items are culled below 55%');
assert.equal(shouldRenderDecorativeDetails(0.55), true, 'decorative details render at the 55% threshold');
assert.equal(shouldRenderDecorativeDetails(0.549), false, 'decorative details are culled below 55%');
assert.equal(shouldRenderBots(0.30), true, 'bots render at the 30% threshold');
assert.equal(shouldRenderBots(0.299), false, 'bots are culled below 30%');
assert.equal(shouldRenderLooseGroundItems(undefined), true, 'missing zoom defaults to normal rendering');
assert.equal(shouldRenderDecorativeDetails(undefined), true, 'missing zoom defaults to normal rendering for decorative details');
assert.equal(shouldRenderBots(undefined), true, 'missing zoom defaults to normal rendering');

function makeRenderState(zoom, { mapWidth = 1000, mapHeight = 800 } = {}) {
  const item = { id: 1, type: 'log', x: 120, y: 130, bob: 0 };
  const bot = { id: 42, name: 'Cull Test Bot', x: 150, y: 160, r: 11, color: '#9abf8f', program: 'haul_logs' };
  const game = {
    W: 640,
    H: 480,
    map: { width: mapWidth, height: mapHeight },
    camera: { x: 0, y: 0, zoom },
    zones: [],
    mapFeatures: [],
    rocks: [],
    holes: [],
    trees: [],
    hempPlants: [],
    items: [item],
    structures: [],
    monsters: [],
    projectiles: [],
    bots: [bot],
    player: { x: 520, y: 420, r: 13 },
    assistant: { x: 560, y: 420, facingX: 1, facingY: 0 },
    placementType: null,
    zoneDraft: null,
    mouse: { hoverItem: item, hoverBot: bot },
    multiplayer: { players: {}, playerId: 'p1' },
    dayNight: null,
    fogOfWar: { enabled: false },
    nightSpawns: {},
    floaters: [],
    dynamicShadowsEnabled: false,
    lightingEffectsEnabled: false,
    showFpsOverlay: false,
    fps: 0,
    targetFps: 60,
    dom: { gameStage: { classList: { contains: () => false } } }
  };
  return { game, renderState: createRenderState(game), item, bot };
}

function makeRecordingContext() {
  const calls = { fillText: [], strokeText: [], methods: Object.create(null) };
  const gradient = { addColorStop() {} };
  const target = { calls };
  const recordMethod = prop => (...args) => {
    calls.methods[prop] = (calls.methods[prop] || 0) + 1;
    return args.length ? undefined : undefined;
  };
  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (prop === 'measureText') return text => ({ width: String(text).length * 8 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'fillText') return (text, x, y) => {
        calls.methods.fillText = (calls.methods.fillText || 0) + 1;
        calls.fillText.push({ text: String(text), x, y });
      };
      if (prop === 'strokeText') return (text, x, y) => {
        calls.methods.strokeText = (calls.methods.strokeText || 0) + 1;
        calls.strokeText.push({ text: String(text), x, y });
      };
      return recordMethod(prop);
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    }
  });
  target.canvas = {
    ownerDocument: {
      createElement() {
        return { width: 0, height: 0, getContext: () => proxy };
      }
    }
  };
  return proxy;
}

function drawnTextsAtZoom(zoom) {
  const { game, renderState, item, bot } = makeRenderState(zoom);
  const ctx = makeRecordingContext();
  drawWorld(renderState, ctx);
  assert.equal(game.items.length, 1, 'drawWorld must not remove loose items from game state');
  assert.equal(game.bots.length, 1, 'drawWorld must not remove bots from game state');
  assert.equal(game.items[0], item, 'drawWorld must preserve item object identity');
  assert.equal(game.bots[0], bot, 'drawWorld must preserve bot object identity');
  assert.equal(game.bots[0].program, 'haul_logs', 'drawWorld must not alter bot simulation/program state');
  return ctx.calls.fillText.map(call => call.text);
}

function drawMethodCountsAtZoom(zoom, options) {
  const { game, renderState } = makeRenderState(zoom, options);
  game.items = [];
  game.bots = [];
  game.mouse = { hoverItem: null, hoverBot: null };
  const ctx = makeRecordingContext();
  drawWorld(renderState, ctx);
  return ctx.calls.methods;
}

let texts = drawnTextsAtZoom(1);
assert(texts.includes('log'), texts);
assert(texts.includes('42'), texts);
assert(texts.includes('Cull Test Bot'), texts);

texts = drawnTextsAtZoom(0.50);
assert(!texts.includes('log'), texts);
assert(texts.includes('42'), texts);
assert(texts.includes('Cull Test Bot'), texts);

texts = drawnTextsAtZoom(0.25);
assert(!texts.includes('log'), texts);
assert(!texts.includes('42'), texts);
assert(!texts.includes('Cull Test Bot'), texts);

const normalZoomMethods = drawMethodCountsAtZoom(1, { mapWidth: 1103, mapHeight: 811 });
assert(
  (normalZoomMethods.quadraticCurveTo || 0) > 0,
  'normal zoom should draw decorative terrain detail paths such as grass blades'
);
assert(
  (normalZoomMethods.drawImage || 0) > 0,
  'normal zoom should still render the cached core map base'
);

const zoomedOutMethods = drawMethodCountsAtZoom(0.50, { mapWidth: 1109, mapHeight: 817 });
assert.equal(
  zoomedOutMethods.quadraticCurveTo || 0,
  0,
  'zoom below 55% should skip decorative terrain detail draw paths'
);
assert(
  (zoomedOutMethods.drawImage || 0) > 0,
  'zoom below 55% should still render the cached core map base'
);

console.log('zoom culling focused tests passed');
