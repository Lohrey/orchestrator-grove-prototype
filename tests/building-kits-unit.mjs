import assert from 'node:assert/strict';

import { Game } from '../src/world.js';
import { ACTION_STEP_REGISTRY } from '../src/action-steps.js';

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

function tick(game, seconds, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) {
    game.worldTime += dt;
    game.updatePlayer(dt);
    game.updateProductionStructures(dt);
    for (const bot of game.bots) game.updateBot(bot, dt);
  }
}

assert.ok(ACTION_STEP_REGISTRY.deploy_building_kit.customLoop, 'deploy_building_kit is executable');
assert.ok(ACTION_STEP_REGISTRY.disassemble_building_to_kit.customLoop, 'disassemble_building_to_kit is executable');

const game = makeGame();
game.resetSoloWorld();
game.structures = [];
game.items = [];
game.bots = [];
game.nextStructureId = 1;
game.nextItemId = 1;
game.nextBotId = 1;

const assembler = game.addStructure('assembler', 180, 180);
assert.equal(assembler.assemblerRecipe, 'sawbench_kit');
assert.equal(game.canStructureAcceptItem(assembler, 'plank'), true, 'assembler accepts planks');
assert.equal(game.depositHeldItemToStructure(assembler, 'plank'), true);
assert.equal(game.depositHeldItemToStructure(assembler, 'plank'), true);
assert.equal(game.depositHeldItemToStructure(assembler, 'pole'), true);
tick(game, 2.0);
assert.equal(game.items.filter(i => i.type === 'sawbench_kit').length, 1, 'assembler produces a sawbench kit item');

const kit = game.items.find(i => i.type === 'sawbench_kit');
assert.ok(game.queuePlayerDeployLooseKit(kit), 'loose kit can be queued for deployment');
assert.equal(game.player.target.action, 'deploy_loose_building_kit');
assert.ok(game.startPlayerBuildingKitAction(game.player.target), 'loose kit starts timed deploy');
tick(game, 0.8);
assert.equal(game.items.some(i => i.id === kit.id), true, 'loose kit remains during deploy time');
assert.equal(game.structures.some(s => s.type === 'sawbench'), false, 'building is not created immediately');
tick(game, 1.0);
assert.equal(game.items.some(i => i.id === kit.id), false, 'deployed loose kit is removed');
const sawbench = game.structures.find(s => s.type === 'sawbench');
assert.ok(sawbench, 'deploying kit creates the matching building');
assert.equal(sawbench.placed, true, 'deployed kit creates a placed building');

assert.ok(game.canDisassembleStructure(sawbench), 'deployed building is disassemblable');
assert.ok(game.startPlayerBuildingKitAction({ action: 'disassemble_building_to_kit', structureId: sawbench.id, x: sawbench.x, y: sawbench.y }), 'disassemble starts timed action');
tick(game, 0.9);
assert.equal(game.structures.some(s => s.id === sawbench.id), true, 'building remains while disassembling');
tick(game, 1.0);
assert.equal(game.structures.some(s => s.id === sawbench.id), false, 'disassembled building is removed');
assert.equal(game.player.inventory?.type, 'sawbench_kit', 'player carries the disassembled kit');
assert.ok(game.startPlayerBuildingKitAction({ action: 'deploy_building_kit', itemType: 'sawbench_kit', x: 320, y: 320 }), 'held kit starts timed deploy');
tick(game, 0.8);
assert.equal(game.player.inventory?.type, 'sawbench_kit', 'held kit remains while deploying');
tick(game, 1.0);
assert.equal(game.player.inventory, null, 'held kit is consumed by deploy');
assert.ok(game.structures.find(s => s.type === 'sawbench' && Math.round(s.x) === 320), 'held deploy creates building at target');

const bot = game.createBot(420, 420, 'idle');
const benchForBot = game.addStructure('workbench', 430, 420, { placed: true });
let valid = game.validateDslProgram({ steps: [
  { op: 'disassemble_building_to_kit', target: benchForBot.name },
  { op: 'deploy_building_kit', type: 'workbench kit', zone: { kind: 'radius', x: 470, y: 420, radius: 64 } },
  { op: 'loop' }
] });
assert.equal(valid.ok, true, valid);
assert.equal(valid.program.steps[1].type, 'workbench_kit', 'DSL normalizes kit aliases');
let assigned = game.assignCustomDslProgram({ botId: bot.id, program: valid.program });
assert.equal(assigned.ok, true, assigned);
tick(game, 1.5);
assert.equal(game.structures.some(s => s.id === benchForBot.id), true, 'bot disassemble is not immediate');
tick(game, 0.6);
assert.equal(game.structures.some(s => s.id === benchForBot.id), false, 'bot disassemble removes original building');
tick(game, 1.5);
assert.equal(game.structures.filter(s => s.type === 'workbench' && Math.abs(s.x - 470) < 5).length, 0, 'bot deploy is not immediate');
tick(game, 0.6);
assert.ok(game.structures.find(s => s.type === 'workbench' && Math.abs(s.x - 470) < 5), 'bot deploy action creates replacement workbench');
assert.equal(bot.inventory, null, 'bot deploy consumes kit');

console.log('building kits unit passed');
