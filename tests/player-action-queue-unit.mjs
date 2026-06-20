import assert from 'node:assert/strict';

import { Game } from '../src/world.js';

const noop = () => {};

globalThis.window ||= {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: noop,
  removeEventListener: noop,
  requestAnimationFrame: noop
};
globalThis.requestAnimationFrame ||= noop;
globalThis.document ||= {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: noop,
  createElement: () => ({ style: {}, classList: { toggle: noop, add: noop, remove: noop }, appendChild: noop, querySelector: () => null, querySelectorAll: () => [] })
};

function makeGame() {
  const rect = { width: 1024, height: 768, left: 0, top: 0 };
  const canvas = {
    width: 1024,
    height: 768,
    style: {},
    parentElement: { getBoundingClientRect: () => rect },
    getBoundingClientRect: () => rect,
    addEventListener: noop,
    removeEventListener: noop
  };
  const game = new Game({ canvas, renderBackend: { ctx: null, resize: noop, render: noop }, chat: null, dom: {} });
  game.audio = { play: noop };
  game.addChat = noop;
  return game;
}

function tickPlayer(game, seconds, dt = 0.05) {
  for (let t = 0; t < seconds; t += dt) game.updatePlayer(dt);
}

const game = makeGame();
game.resetSoloWorld();
game.structures = [];
game.items = [];
game.bots = [];
game.trees = [];
game.hempPlants = [];
game.holes = [];
game.rocks = [];
game.monsters = [];
game.player.x = 100;
game.player.y = 100;
game.player.target = null;
game.player.targetQueue = [];

game.handleCanvasContextAction({ x: 160, y: 100, clientX: 0, clientY: 0 });
assert.equal(game.player.target?.x, 160, 'plain right-click sets active command');
assert.equal(game.player.targetQueue.length, 0, 'plain right-click clears queue');

game.keys.add('shift');
game.handleCanvasContextAction({ x: 220, y: 100, clientX: 0, clientY: 0 });
game.keys.delete('shift');
assert.equal(game.player.target?.x, 160, 'shift-right-click keeps current command active');
assert.equal(game.player.targetQueue.length, 1, 'shift-right-click appends one queued command');
assert.equal(game.player.targetQueue[0]?.x, 220, 'queued command keeps target position');

tickPlayer(game, 0.2);
assert.equal(game.player.target?.x, 160, 'first command remains active before arrival');
assert.equal(game.player.targetQueue.length, 1, 'queue remains pending before first arrival');

tickPlayer(game, 0.25);
assert.equal(game.player.target?.x, 220, 'queued command activates after first command completes');
assert.equal(game.player.targetQueue.length, 0, 'queue drains when next command activates');

tickPlayer(game, 0.45);
assert.equal(game.player.target, null, 'player becomes idle after final queued command');
assert.ok(Math.abs(game.player.x - 220) < 1, 'player ends at the queued destination');

game.handleCanvasContextAction({ x: 260, y: 100, clientX: 0, clientY: 0 });
game.keys.add('shift');
game.handleCanvasContextAction({ x: 320, y: 100, clientX: 0, clientY: 0 });
game.keys.delete('shift');
assert.equal(game.player.targetQueue.length, 1, 'second scenario queues a follow-up command');

game.handleCanvasContextAction({ x: 400, y: 100, clientX: 0, clientY: 0 });
assert.equal(game.player.target?.x, 400, 'non-shift right-click replaces active command');
assert.equal(game.player.targetQueue.length, 0, 'non-shift right-click clears queued commands');

console.log('player action queue unit passed');
