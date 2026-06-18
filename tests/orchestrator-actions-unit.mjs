import assert from 'node:assert/strict';

import { ACTION_STEP_REGISTRY, actionStepOpsForPack } from '../src/action-steps.js';
import { parseAssistantRequest } from '../src/assistant.js';
import { ASSISTANT_KNOWLEDGE_PACKS } from '../src/data.js';
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

defineDocumentStub();

function defineDocumentStub() {
  globalThis.document ||= {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: noop,
    createElement: () => ({ style: {}, classList: { toggle: noop, add: noop, remove: noop }, appendChild: noop, querySelector: () => null, querySelectorAll: () => [] })
  };
}

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
  const renderBackend = { ctx: null, resize: noop, render: noop };
  const game = new Game({ canvas, renderBackend, chat: null, dom: {} });
  game.audio = { play: noop };
  game.addChat = noop;
  game.setManagerKnowledgePackCatalog?.(ASSISTANT_KNOWLEDGE_PACKS);
  return game;
}

function addItem(game, type, x, y) {
  const id = game.nextItemId++;
  const item = { id, ref: `item:${id}`, type, x, y, reservedBy: null, bob: 0 };
  game.items.push(item);
  return item;
}

function tick(game, seconds, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) {
    game.worldTime = (game.worldTime || 0) + dt;
    game.updateProductionStructures(dt);
    game.updateProjectiles(dt);
    for (const bot of game.bots) game.updateBot(bot, dt);
    game.updateProjectiles(dt);
    for (const monster of game.monsters) game.updateMonster(monster, dt);
  }
}

assert.ok(ACTION_STEP_REGISTRY.rename_bot.customLoop, 'rename_bot must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.promote_to_manager.customLoop, 'promote_to_manager must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.delegate_to_manager.customLoop, 'delegate_to_manager must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.guard_area.customLoop, 'guard_area must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.patrol_route.customLoop, 'patrol_route must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.equip_item.customLoop, 'equip_item must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.craft_smithery.customLoop, 'craft_smithery must be custom-loop executable');
assert.ok(ACTION_STEP_REGISTRY.craft_bowmaker.customLoop, 'craft_bowmaker must be custom-loop executable');
assert.ok(actionStepOpsForPack('combat').includes('rename_bot'), 'combat pack exposes rename_bot');
assert.ok(actionStepOpsForPack('starter_automation').includes('rename_bot'), 'starter pack exposes rename_bot');
assert.ok(actionStepOpsForPack('starter_automation').includes('promote_to_manager'), 'starter pack exposes promote_to_manager');
assert.ok(actionStepOpsForPack('starter_automation').includes('delegate_to_manager'), 'starter pack exposes delegate_to_manager');
assert.ok(actionStepOpsForPack('combat').includes('guard_area'), 'combat pack exposes guard_area');
assert.ok(actionStepOpsForPack('combat').includes('patrol_route'), 'combat pack exposes patrol_route');
assert.ok(actionStepOpsForPack('combat').includes('equip_item'), 'combat pack exposes equip_item');

const game = makeGame();

const valid = game.validateDslProgram({ steps: [
  { op: 'guard_area', radius: 240 },
  { op: 'patrol_route', points: [{ x: 300, y: 300 }, [420, 300]], radius: 150 },
  { op: 'equip_item', type: 'sword' },
  { op: 'craft_smithery', recipe: 'shield' },
  { op: 'craft_bowmaker', recipe: 'bow' },
  { op: 'loop' }
] });
assert.equal(valid.ok, true, valid);
assert.equal(valid.program.steps[2].type, 'wooden_sword', 'equip_item sword alias normalizes');
assert.equal(valid.program.steps[3].recipe, 'wooden_shield', 'craft_smithery shield alias normalizes');
assert.equal(valid.program.steps[4].recipe, 'bow', 'craft_bowmaker validates bow');

const renameValid = game.validateDslProgram({ steps: [{ op: 'rename_bot', name: '  Lumber\njack<>  ', target: 2 }, { op: 'loop' }] });
assert.equal(renameValid.ok, true, renameValid);
assert.equal(renameValid.program.steps[0].name, 'Lumberjack', 'rename_bot strips controls/unsafe display chars');
assert.equal(renameValid.program.steps[0].botId, 2, 'rename_bot resolves optional target bot');
const renameTooShort = game.validateDslProgram({ steps: [{ op: 'rename_bot', name: ' A ' }, { op: 'loop' }] });
assert.equal(renameTooShort.ok, false, 'rename_bot rejects names shorter than 2 chars');
assert.match(renameTooShort.error, /2-32 character name/);
const renameClamped = game.validateDslProgram({ steps: [{ op: 'rename_bot', name: 'abcdefghijklmnopqrstuvwxyz1234567890' }, { op: 'loop' }] });
assert.equal(renameClamped.ok, true, renameClamped);
assert.equal(renameClamped.program.steps[0].name.length, 32, 'rename_bot clamps names at 32 chars');

const promoteValid = game.validateDslProgram({ steps: [{ op: 'promote_to_manager', knowledgePacks: ['woodworking'], target: 2 }, { op: 'loop' }] });
assert.equal(promoteValid.ok, true, promoteValid);
assert.deepEqual(promoteValid.program.steps[0].knowledgePacks, ['woodworking'], 'promote_to_manager keeps known pack ids');
assert.equal(promoteValid.program.steps[0].botId, 2, 'promote_to_manager resolves optional target bot');
const delegateWorker = game.validateDslProgram({ steps: [{ op: 'delegate_to_manager', recipient: 2, message: 'make bot 3 chop trees' }, { op: 'loop' }] });
assert.equal(delegateWorker.ok, false, 'delegate_to_manager rejects non-manager recipients');
assert.match(delegateWorker.error, /recipient must be a manager bot/);

const invalidEquip = game.validateDslProgram({ steps: [{ op: 'equip_item', type: 'crude_axe' }] });
assert.equal(invalidEquip.ok, false, 'equip_item must reject tools/resources');
assert.match(invalidEquip.error, /only sword, shield, or bow/);

const parserRename = parseAssistantRequest('Bot 1 rename to Lumberjack', game, { enableTemplates: true, loadout: ['starter_automation'] });
assert.equal(parserRename.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'rename_bot', parserRename);
assert.equal(parserRename.dslAssignments?.[0]?.program?.steps?.[0]?.name, 'Lumberjack', parserRename);
const parserRenameGuard = parseAssistantRequest('Rename bot 2 to Guard', game, { enableTemplates: true, loadout: ['combat'] });
assert.equal(parserRenameGuard.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'rename_bot', parserRenameGuard);
assert.equal(parserRenameGuard.dslAssignments?.[0]?.botId, 2, parserRenameGuard);
assert.equal(parserRenameGuard.dslAssignments?.[0]?.program?.steps?.[0]?.name, 'Guard', parserRenameGuard);
const parserPromote = parseAssistantRequest('Promote bot 1 to manager', game, { enableTemplates: true, loadout: ['starter_automation'] });
assert.equal(parserPromote.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'promote_to_manager', parserPromote);
const parserDelegate = parseAssistantRequest('Bot 1 delegate to manager Bot 2: make bot 3 chop trees', game, { enableTemplates: true, loadout: ['starter_automation'] });
assert.equal(parserDelegate.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'delegate_to_manager', parserDelegate);
assert.equal(parserDelegate.dslAssignments?.[0]?.program?.steps?.[0]?.recipient, 'Bot 2', parserDelegate);
assert.equal(parserDelegate.dslAssignments?.[0]?.program?.steps?.[0]?.message, 'make bot 3 chop trees', parserDelegate);

const bot1 = game.findBot(1);
let assigned = game.assignCustomDslProgram({ botId: 1, program: { steps: [{ op: 'rename_bot', name: 'Lumberjack' }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 0.2);
assert.equal(bot1.name, 'Lumberjack', bot1);
const bot2 = game.findBot(2);
assigned = game.assignCustomDslProgram({ botId: 1, program: { steps: [{ op: 'rename_bot', name: 'Guard', target: 2 }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 0.2);
assert.equal(bot2.name, 'Guard', bot2);
assigned = game.assignCustomDslProgram({ botId: 1, program: { steps: [{ op: 'promote_to_manager', target: 'Guard', knowledgePacks: ['woodworking'] }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 0.2);
assert.equal(bot2.status, 'manager', bot2);
assert.deepEqual(bot2.managerKnowledgePacks, ['woodworking'], bot2);
const delegateValid = game.validateDslProgram({ steps: [{ op: 'delegate_to_manager', recipient: 'Guard', message: ' make bot 3 chop trees<> ' }, { op: 'loop' }] });
assert.equal(delegateValid.ok, true, delegateValid);
assert.equal(delegateValid.program.steps[0].recipientBotId, 2, delegateValid);
assert.equal(delegateValid.program.steps[0].message, 'make bot 3 chop trees', delegateValid);
let managerHandled = null;
game.managerMessageHandler = ({ manager, sender, message, entry }) => {
  managerHandled = { managerId: manager.id, senderId: sender?.id || null, message, packs: entry.packs };
  return { ok: true };
};
assigned = game.assignCustomDslProgram({ botId: 1, program: { steps: [{ op: 'delegate_to_manager', recipient: 'Guard', message: 'make bot 3 chop trees' }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 0.2);
assert.deepEqual(managerHandled, { managerId: 2, senderId: 1, message: 'make bot 3 chop trees', packs: ['woodworking'] }, managerHandled);
assert.equal(game.managerMessageLog.at(-1).managerBotId, 2, game.managerMessageLog);

const parserGuard = parseAssistantRequest('Bot 1 guard nearby radius 240', game, { enableTemplates: true, loadout: ['combat'] });
assert.equal(parserGuard.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'guard_area', parserGuard);
const parserPatrol = parseAssistantRequest('Bot 2 patrol radius 180', game, { enableTemplates: true, loadout: ['combat'] });
assert.equal(parserPatrol.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'patrol_route', parserPatrol);
const parserEquip = parseAssistantRequest('Bot 3 equip bow', game, { enableTemplates: true, loadout: ['combat'] });
assert.equal(parserEquip.dslAssignments?.[0]?.program?.steps?.[0]?.op, 'equip_item', parserEquip);

bot1.x = 300; bot1.y = 300; bot1.speed = 150;
addItem(game, 'wooden_sword', 300, 300);
addItem(game, 'wooden_shield', 303, 300);
addItem(game, 'bow', 306, 300);
assigned = game.assignCustomDslProgram({ botId: 1, program: { steps: [
  { op: 'equip_item', type: 'sword' },
  { op: 'equip_item', type: 'shield' },
  { op: 'equip_item', type: 'bow' },
  { op: 'loop' }
] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 2);
const sets = bot1.equipment.weaponSets;
assert.equal(sets.length, 2, bot1.equipment);
assert.ok(sets.some(set => set.weapon === 'wooden_sword' && set.shield === 'wooden_shield'), bot1.equipment);
assert.ok(sets.some(set => set.weapon === 'bow' && !set.shield), bot1.equipment);

bot1.x = 520; bot1.y = 520;
assigned = game.assignCustomDslProgram({ botId: 1, program: { steps: [{ op: 'guard_area', radius: 180 }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 0.2);
const guardCenter = { x: bot1.x, y: bot1.y };
const monster = game.spawnMonster(bot1.x + 80, bot1.y, { name: 'guard test hostile', type: 'night_monster', kind: 'night_monster', hostile: true, passive: false, hp: 3, maxHp: 3, ownerId: 'wild', speed: 0, roamRadius: 0 });
tick(game, 4);
assert.equal(monster.hp <= 0, true, { monster, bot: bot1 });
bot1.x = guardCenter.x + 140; bot1.y = guardCenter.y + 10;
tick(game, 2);
assert.ok(Math.hypot(bot1.x - guardCenter.x, bot1.y - guardCenter.y) < 80, { bot: bot1, guardCenter });

bot2.x = 700; bot2.y = 300; bot2.speed = 150;
const route = [{ x: 700, y: 300 }, { x: 820, y: 300 }];
assigned = game.assignCustomDslProgram({ botId: 2, program: { steps: [{ op: 'patrol_route', points: route, radius: 140 }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
const patrolMonster = game.spawnMonster(760, 300, { name: 'patrol test hostile', type: 'night_monster', kind: 'night_monster', hostile: true, passive: false, hp: 2, maxHp: 2, ownerId: 'wild', speed: 0, roamRadius: 0 });
tick(game, 4);
assert.equal(patrolMonster.hp <= 0, true, { patrolMonster, bot: bot2 });
tick(game, 3);
assert.ok(route.some(p => Math.hypot(bot2.x - p.x, bot2.y - p.y) < 80), { bot: bot2, route });

const bot3 = game.findBot(3);
const smithery = game.structures.find(s => s.type === 'smithery');
bot3.x = smithery.x - 48; bot3.y = smithery.y;
addItem(game, 'stick', bot3.x, bot3.y);
assigned = game.assignCustomDslProgram({ botId: 3, program: { steps: [{ op: 'craft_smithery', recipe: 'sword', target: smithery.name }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 5);
assert.ok(game.items.some(item => item.type === 'wooden_sword'), { items: game.items, smithery });

const bot4 = game.findBot(4);
const bowmaker = game.structures.find(s => s.type === 'bowmaker');
bot4.x = bowmaker.x - 56; bot4.y = bowmaker.y;
for (let i = 0; i < 2; i++) addItem(game, 'stick', bot4.x + i * 2, bot4.y);
for (let i = 0; i < 3; i++) addItem(game, 'hemp', bot4.x + i * 2, bot4.y + 2);
assigned = game.assignCustomDslProgram({ botId: 4, program: { steps: [{ op: 'craft_bowmaker', recipe: 'bow', target: bowmaker.name }, { op: 'loop' }] } });
assert.equal(assigned.ok, true, assigned);
tick(game, 14);
assert.ok(game.items.some(item => item.type === 'bow'), { items: game.items, bowmaker });

console.log('orchestrator executable action steps passed');
