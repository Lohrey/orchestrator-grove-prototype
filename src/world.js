import { BUILDING_TYPES, PROGRAMS, PROGRAM_TEMPLATES, ALLOWED_OPS, DEFAULT_WORLD_ZONES } from './data.js?v=t_fc028066';
import { drawWorld } from './canvas-renderer.js?v=t_fc028066';
import { createRenderState } from './render-state.js?v=t_fc028066';
import { clamp, rand, distXY, nearest, pointInRect, rectDistance, canvasPoint, escapeHtml } from './utils.js?v=20260613-player-tools';

const clone = value => JSON.parse(JSON.stringify(value));
const rectCenter = z => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
const FACTORY_BOT_RECIPE = { log: 1, plank: 3, pole: 1, tree_seed: 1 };
const BOW_RECIPE = { stick: 2, hemp: 3 };
const AXE_DURABILITY = 100;
const PICKAXE_DURABILITY = 80;
const SHOVEL_DURABILITY = 80;
const PRODUCTION_SOURCE_RADIUS = 150;
const STARTING_AXE_COUNT = 10;
const STARTING_PICKAXE_COUNT = 5;
const STARTING_SHOVEL_COUNT = 5;
const WORLD_MAP_SIZE = { width: 3600, height: 2400 };
const CAMERA_MIN_ZOOM = 0.55;
const CAMERA_MAX_ZOOM = 2.35;
const CAMERA_WHEEL_SENSITIVITY = 0.00135;
const MIN_DRAWN_ZONE_SIZE = 6;
const DEFAULT_RESOURCE_RADIUS = 150;
const TREE_SEARCH_SECONDS = 2.4;
const HEMP_SEARCH_SECONDS = 1.4;
const HEMP_CHOP_SECONDS = 1.8;
const MONSTER_AVOID_STRUCTURE_RADIUS = 260;
const MONSTER_ROAM_RADIUS = 340;
const MULTIPLAYER_STARTS = {
  p1: { id: 'p1', label: 'Player 1', corner: 'bottom-left', x: 260, y: WORLD_MAP_SIZE.height - 260, throneX: 160, throneY: WORLD_MAP_SIZE.height - 150 },
  p2: { id: 'p2', label: 'Player 2', corner: 'top-right', x: WORLD_MAP_SIZE.width - 260, y: 260, throneX: WORLD_MAP_SIZE.width - 170, throneY: 150 }
};
const THRONE_HP = 120;
const THRONE_ATTACK_DAMAGE = 10;
const DEFENSE_TOWER_ATTACK = { range: 260, damage: 1, cooldown: 1, projectileSpeed: 520 };
function createRangedAttackComponent(overrides = {}) {
  const stats = { ...DEFENSE_TOWER_ATTACK, ...overrides };
  return { ...stats, cooldownRemaining: 0, targetRef: null };
}
const TREE_GROWTH = {
  sapling: { radius: 7, maxHp: 1, next: 'small_tree', growSeconds: 8 },
  small_tree: { radius: 13, maxHp: 2, next: 'grown_tree', growSeconds: 10 },
  grown_tree: { radius: 20, maxHp: 4, next: null, growSeconds: 0 }
};
const ITEM_TYPES = ['log', 'plank', 'pole', 'stick', 'stone', 'tree_seed', 'crude_axe', 'crude_pickaxe', 'crude_shovel', 'wooden_sword', 'wooden_shield', 'hemp', 'hemp_seed', 'bow'];
const ITEM_LABELS = { log: 'log', plank: 'plank', pole: 'pole', stick: 'stick', stone: 'stone', tree_seed: 'tree seed', crude_axe: 'crude axe', crude_pickaxe: 'crude pickaxe', crude_shovel: 'crude shovel', wooden_sword: 'wooden sword', wooden_shield: 'wooden shield', hemp: 'hemp', hemp_seed: 'hemp seed', bow: 'bow' };
const itemLabel = type => ITEM_LABELS[type] || type;
const WORKBENCH_TOOL_RECIPES = ['crude_axe', 'crude_pickaxe', 'crude_shovel'];
const DEFAULT_WORKBENCH_RECIPE = 'crude_axe';
const SMITHERY_RECIPES = ['wooden_sword', 'wooden_shield'];
const DEFAULT_SMITHERY_RECIPE = 'wooden_sword';
const PRODUCTION_DEFAULTS = {
  sawbench: { log: 1.2, plank: 1.0 },
  workbench: { crude_axe: 1.1, crude_pickaxe: 1.1, crude_shovel: 1.1 },
  smithery: { wooden_sword: 1.0, wooden_shield: 1.0 },
  bowmaker: { bow: 5.5 },
  factory: { basic_bot: 1.5 }
};
const STRUCTURE_INFO = {
  sawbench: 'Processes wood into construction parts.',
  workbench: 'Crafts crude tools from basic materials.',
  factory: 'Assembles new Basic Bots when stocked.',
  smithery: 'Military building that turns wood into starter weapons.',
  bowmaker: 'Military building that binds sticks and hemp into bows.',
  defensetower: 'Military building with a reusable ranged-attack component. Fires one 1 HP arrow per second at hostile targets in range.',
  item_palette: 'Stores one item type for pickup tasks.',
  throne: 'Multiplayer objective. Destroy the enemy throne to win.'
};
function structureRecipeText(s) {
  if (s.type === 'sawbench') return '1 log → 2 planks; 1 plank → 2 wood poles.';
  if (s.type === 'workbench') return `1 stick + 1 stone → 1 selected crude tool. Current: ${itemLabel(workbenchRecipe(s))}.`;
  if (s.type === 'smithery') return `1 ${smitheryRecipe(s) === 'wooden_sword' ? 'stick' : 'plank'} → 1 ${itemLabel(smitheryRecipe(s))}. Current mode: ${itemLabel(smitheryRecipe(s))}.`;
  if (s.type === 'bowmaker') return '2 sticks + 3 hemp → 1 bow. Starts a long build as soon as the last ingredient is placed.';
  if (s.type === 'defensetower') return 'No recipe: auto-fires arrows at enemies in range; 1 HP damage, 1 arrow per second.';
  if (s.type === 'factory') return `${Object.entries(FACTORY_BOT_RECIPE).map(([type, cost]) => `${cost} ${itemLabel(type)}${cost === 1 ? '' : 's'}`).join(' + ')} → 1 Basic Bot.`;
  if (s.type === 'item_palette') return `No crafting recipe; stores up to ${s.capacity || BUILDING_TYPES.item_palette.capacity || 0} of one item type.`;
  return 'No recipe defined.';
}
function workbenchRecipe(s) {
  return WORKBENCH_TOOL_RECIPES.includes(s?.workbenchRecipe) ? s.workbenchRecipe : DEFAULT_WORKBENCH_RECIPE;
}
function smitheryRecipe(s) {
  return SMITHERY_RECIPES.includes(s?.smitheryRecipe) ? s.smitheryRecipe : DEFAULT_SMITHERY_RECIPE;
}
function smitheryInputFor(recipe) {
  return recipe === 'wooden_shield' ? 'plank' : 'stick';
}

export class Game {
  constructor({ canvas, chat, dom, isChatActive = () => false }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.chat = chat; this.dom = dom; this.isChatActive = isChatActive;
    this.W = canvas.width; this.H = canvas.height; this.keys = new Set();
    this.map = { ...WORLD_MAP_SIZE };
    this.camera = { x: 0, y: 0, speed: 520, zoom: 1, minZoom: CAMERA_MIN_ZOOM, maxZoom: CAMERA_MAX_ZOOM };
    this.player = { x: 480, y: 410, r: 13, speed: 170, target: null, inventory: null };
    this.assistant = { x: 452, y: 392 };
    this.trees = []; this.hempPlants = []; this.rocks = []; this.holes = []; this.items = []; this.bots = []; this.structures = []; this.monsters = []; this.projectiles = []; this.floaters = [];
    this.multiplayer = { enabled: false, sessionId: null, role: 'solo', playerId: 'p1', status: 'Solo prototype', players: {}, winner: null, syncTimer: 0 };
    this.recorder = { recording: false, steps: [], lastAssignedBotId: null, targetBotId: null, status: 'Teach: open a bot menu and press Record Loop.' };
    this.teachPanelOpened = false;
    this.teachLocationEdit = null;
    this.draggedTeachStepIndex = null;
    this.recordedLoop = [];
    this.zones = clone(DEFAULT_WORLD_ZONES); this.nextZoneId = 1;
    this.nextItemId = 1; this.nextRockId = 1; this.nextHoleId = 1; this.nextTreeId = 1; this.nextHempId = 1; this.nextMonsterId = 1; this.nextProjectileId = 1; this.nextBotId = 1; this.nextStructureId = 1;
    this.maxBots = 24; this.targetFps = 30; this.fps = 0; this.frameCount = 0; this.fpsAcc = 0; this.lastFrame = 0;
    this.mouse = { x: 0, y: 0, screenX: 0, screenY: 0, clientX: 0, clientY: 0, hoverBot: null, hoverStructure: null, hoverMonster: null, hoverItem: null, hoverHemp: null, hoverZone: null };
    this.placementType = null; this.zoneDraft = null; this.zoneDrag = null; this.justDrewZone = false; this.justDraggedZone = false;
    this.renderer = { text: 'Canvas 2D fallback', webgpu: false, reason: 'not probed' };
    this.lastBotListUpdate = 0;
    this.resizeCanvas(false);
    this.initWorld(); this.bindCanvas();
    window.addEventListener('resize', () => this.resizeCanvas(true), { passive: true });
  }

  resizeCanvas(clampEntities = true) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
    const rect = canvasRect.width && canvasRect.height ? canvasRect : parentRect;
    const w = Math.max(1, Math.round(rect.width || window.innerWidth || this.canvas.width));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight || this.canvas.height));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.W = w;
    this.H = h;
    if (clampEntities && this.player) {
      this.player.x = clamp(this.player.x, 20, Math.max(20, this.map.width - 20));
      this.player.y = clamp(this.player.y, 20, Math.max(20, this.map.height - 20));
      this.assistant.x = clamp(this.assistant.x, 20, Math.max(20, this.map.width - 20));
      this.assistant.y = clamp(this.assistant.y, 20, Math.max(20, this.map.height - 20));
    }
    this.clampCamera();
  }

  clampCamera() {
    const zoom = clamp(this.camera.zoom || 1, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    this.camera.zoom = zoom;
    const maxX = Math.max(0, this.map.width - this.W / zoom);
    const maxY = Math.max(0, this.map.height - this.H / zoom);
    this.camera.x = clamp(this.camera.x, 0, maxX);
    this.camera.y = clamp(this.camera.y, 0, maxY);
  }

  screenToWorld(screenX, screenY) {
    const zoom = this.camera.zoom || 1;
    return {
      x: clamp(screenX / zoom + this.camera.x, 0, this.map.width),
      y: clamp(screenY / zoom + this.camera.y, 0, this.map.height)
    };
  }

  refreshMouseWorld() {
    const world = this.screenToWorld(this.mouse.screenX || 0, this.mouse.screenY || 0);
    this.mouse.x = world.x;
    this.mouse.y = world.y;
  }

  setCameraZoom(nextZoom, anchorScreenX = this.W / 2, anchorScreenY = this.H / 2) {
    const oldZoom = this.camera.zoom || 1;
    const zoom = clamp(nextZoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    if (Math.abs(zoom - oldZoom) < 0.001) return false;
    const anchorWorldX = anchorScreenX / oldZoom + this.camera.x;
    const anchorWorldY = anchorScreenY / oldZoom + this.camera.y;
    this.camera.zoom = zoom;
    this.camera.x = anchorWorldX - anchorScreenX / zoom;
    this.camera.y = anchorWorldY - anchorScreenY / zoom;
    this.clampCamera();
    this.refreshMouseWorld();
    this.updateHover();
    return true;
  }

  canvasToWorld(event) {
    const p = canvasPoint(this.canvas, event);
    const world = this.screenToWorld(p.x, p.y);
    return {
      ...p,
      screenX: p.x,
      screenY: p.y,
      x: world.x,
      y: world.y
    };
  }

  setPlayerDestination(x, y, options = {}) {
    this.releasePlayerTargetReservation();
    this.player.target = { x: clamp(x, 20, this.map.width - 20), y: clamp(y, 20, this.map.height - 20), ...options };
    if (this.player.target.action === 'pickup_item' && this.player.target.itemId) {
      const item = this.items.find(i => i.id === this.player.target.itemId);
      if (item) item.reservedBy = 'player';
    } else if (this.player.target.action === 'search_tree' && this.player.target.resourceId) {
      const tree = this.trees.find(t => t.id === this.player.target.resourceId);
      if (tree) tree.searchReservedBy = 'player';
    }
    this.addFloat(options.floatText || 'Move target', this.player.target.x, this.player.target.y - 18, '#80a9c9');
  }
  releasePlayerTargetReservation() {
    const target = this.player?.target;
    if (target?.action === 'pickup_item' && target.itemId) {
      const item = this.items.find(i => i.id === target.itemId && i.reservedBy === 'player');
      if (item) item.reservedBy = null;
    }
    if (target?.action === 'search_tree' && target.resourceId) {
      const tree = this.trees.find(t => t.id === target.resourceId && t.searchReservedBy === 'player');
      if (tree) tree.searchReservedBy = null;
    }
    if (target?.action === 'search_hemp' && target.resourceId) {
      const hemp = this.hempPlants.find(h => h.id === target.resourceId && h.searchReservedBy === 'player');
      if (hemp) hemp.searchReservedBy = null;
    }
  }
  queuePlayerItemPickup(item) {
    if (!item) return false;
    if (this.player.inventory) {
      this.addFloat(`No free space: carrying ${itemLabel(this.player.inventory.type)}`, item.x, item.y - 24, '#c86b5f');
      return false;
    }
    this.setPlayerDestination(item.x, item.y, { action: 'pickup_item', itemId: item.id, floatText: `Pick up ${itemLabel(item.type)}` });
    return true;
  }
  completePlayerTarget(target) {
    if (target?.action === 'pickup_item' && target.itemId) {
      const item = this.items.find(i => i.id === target.itemId);
      const picked = this.manualPickupItem(item);
      if (!picked && item?.reservedBy === 'player') item.reservedBy = null;
      return;
    }
    if (target?.action === 'chop_tree' && target.resourceId) { const tree = this.trees.find(t => t.id === target.resourceId); if (tree && this.manualChopTree()) this.recordTeachStep(this.resourceRadiusStep('chop_tree', tree, this.treeDisplayName(tree))); return; }
    if (target?.action === 'mine_stone' && target.resourceId) { const rock = this.rocks.find(r => r.id === target.resourceId); if (rock && this.manualMineStone()) this.recordTeachStep(this.resourceRadiusStep('mine_stone', rock, 'stone deposit')); return; }
    if (target?.action === 'attack_throne' && target.structureId) { const throne = this.structures.find(st => st.id === target.structureId); this.damageThrone(throne); return; }
    if (target?.action === 'deposit_to_structure' && target.structureId) {
      const s = this.structures.find(st => st.id === target.structureId);
      const held = this.player.inventory?.type;
      if (!s || !held) return;
      const deposited = this.manualDepositToStructure(s, { waitIfProcessing: true });
      if (!deposited && this.player.inventory?.type === held && this.isStructureProcessing(s)) {
        if (!target.waiting) this.addFloat(`Waiting for ${s.name}`, s.x, s.y - 35, '#c7b683');
        this.player.target = { ...target, x: s.x, y: s.y, waiting: true };
      }
    }
  }
  queuePlayerStructureDeposit(s) {
    const held = this.player.inventory?.type;
    if (!s || !held || !this.canStructureAcceptItem(s, held)) return false;
    this.setPlayerDestination(s.x, s.y, { action: 'deposit_to_structure', structureId: s.id, itemType: held, floatText: `Deposit ${itemLabel(held)} into ${s.name}` });
    return true;
  }

  updateCamera(dt) {
    let dx = 0, dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx--;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx++;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy--;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy++;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      this.camera.x += (dx / len) * this.camera.speed * dt;
      this.camera.y += (dy / len) * this.camera.speed * dt;
      this.clampCamera();
      this.refreshMouseWorld();
      this.updateHover();
    }
  }

  initWorld() {
    [
      [155,120],[265,115],[370,130],[655,110],[805,130],[150,505],[215,440],[600,520],[720,500],[850,470],[580,170],[95,215],[875,235],[390,535],[510,90],
      [1260,220],[1430,310],[1660,180],[1850,420],[2100,260],[2500,520],[2920,340],[3260,620],[1320,920],[1750,1120],[2260,980],[2820,1220],[3150,1580],[2480,1820],[1900,1700]
    ].forEach(([x,y]) => this.spawnTree(x, y));
    [[735,215],[780,255],[835,205],[1180,500],[1280,575],[1510,740],[2050,620],[2385,760],[2700,1040],[3100,1180],[3350,1680],[2220,1580],[1775,1450]].forEach(([x,y]) => this.spawnHemp(x, y));
    this.addStructure('sawbench', 320, 330); this.addStructure('workbench', 455, 330); this.addStructure('smithery', 525, 245); this.addStructure('bowmaker', 665, 245); this.addStructure('defensetower', 795, 330); this.addStructure('factory', 595, 330);
    [[1640,1120],[1785,1225],[1920,1145],[1840,990],[2040,1280]].forEach(([x,y]) => this.spawnMonster(x, y));
    [[470,500],[530,545],[720,565],[905,165],[1025,255],[660,705],[1320,650],[1600,850],[2100,700],[2500,940],[3060,880],[3350,1420],[2700,1760],[1500,1350]].forEach(([x,y]) => this.spawnStoneDeposit(x, y));
    this.createBot(175,250,'idle',true); this.createBot(205,265,'idle',true); this.createBot(235,250,'idle',true); this.createBot(185,290,'idle',true);
    this.spawnItem('log', 285, 500, 3); this.spawnItem('stick', 410, 500, 5); this.spawnItem('tree_seed', 535, 500, 3); this.spawnItem('crude_axe', 610, 500, STARTING_AXE_COUNT); this.spawnItem('crude_pickaxe', 665, 500, STARTING_PICKAXE_COUNT); this.spawnItem('crude_shovel', 720, 500, STARTING_SHOVEL_COUNT);
  }

  bindCanvas() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const p = canvasPoint(this.canvas, e);
      Object.assign(this.mouse, { ...p, screenX: p.x, screenY: p.y });
      const factor = Math.exp(-e.deltaY * CAMERA_WHEEL_SENSITIVITY);
      this.setCameraZoom((this.camera.zoom || 1) * factor, p.x, p.y);
    }, { passive: false });
    this.canvas.addEventListener('mousemove', e => {
      Object.assign(this.mouse, this.canvasToWorld(e));
      if (this.zoneDrag?.active) {
        const d = this.zoneDrag;
        const z = d.zone;
        z.x = clamp(this.mouse.x - d.offsetX, 0, this.map.width - z.w);
        z.y = clamp(this.mouse.y - d.offsetY, 0, this.map.height - z.h);
        d.moved = d.moved || distXY(z.x, z.y, d.startX, d.startY) > 2;
        this.updateHover();
        e.preventDefault();
        return;
      }
      if (this.zoneDraft?.active && this.zoneDraft.started) {
        this.zoneDraft.x2 = this.mouse.x; this.zoneDraft.y2 = this.mouse.y;
        if (this.zoneDraft.kind === 'radius') this.zoneDraft.radius = Math.max(8, distXY(this.zoneDraft.x1, this.zoneDraft.y1, this.mouse.x, this.mouse.y));
      }
      this.updateHover();
    });
    this.canvas.addEventListener('mouseleave', () => { this.finishZoneDrag(); this.mouse.hoverBot = null; this.mouse.hoverStructure = null; this.mouse.hoverMonster = null; this.mouse.hoverItem = null; this.mouse.hoverHemp = null; this.mouse.hoverZone = null; this.canvas.style.cursor = 'default'; });
    this.canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const chatRectMode = !this.zoneDraft?.active && !this.placementType && this.isChatActive?.();
      const p = this.canvasToWorld(e); Object.assign(this.mouse, p);
      if (!this.zoneDraft?.active && !this.placementType) {
        const z = this.zoneAt(p.x, p.y);
        if (z && !z.builtIn) {
          this.zoneDrag = { active: true, zone: z, offsetX: p.x - z.x, offsetY: p.y - z.y, startX: z.x, startY: z.y, moved: false };
          this.hideMenus();
          e.preventDefault();
          return;
        }
      }
      if (!this.zoneDraft?.active && !chatRectMode) return;
      if (chatRectMode) this.zoneDraft = { active: true, started: false, x1: 0, y1: 0, x2: 0, y2: 0, fromChatDrag: true };
      this.zoneDraft.started = true; this.zoneDraft.x1 = p.x; this.zoneDraft.y1 = p.y; this.zoneDraft.x2 = p.x; this.zoneDraft.y2 = p.y;
      e.preventDefault();
    });
    this.canvas.addEventListener('mouseup', e => {
      if (this.zoneDrag?.active && e.button === 0) {
        const p = this.canvasToWorld(e); Object.assign(this.mouse, p);
        this.finishZoneDrag();
        e.preventDefault();
        return;
      }
      if (!this.zoneDraft?.active || !this.zoneDraft.started || e.button !== 0) return;
      const p = this.canvasToWorld(e); this.zoneDraft.x2 = p.x; this.zoneDraft.y2 = p.y;
      const zone = this.finishZoneDrawing();
      if (zone && this.teachLocationEdit?.mode === 'draw_zone') this.applyTeachZoneToStep(zone);
      else if (zone) this.chat.insertAtCursor(this.rectangleText(zone));
      this.justDrewZone = Boolean(zone);
      e.preventDefault();
    });
    this.canvas.addEventListener('click', e => {
      const p = this.canvasToWorld(e); Object.assign(this.mouse, p); this.hideMenus();
      if (this.justDraggedZone) { this.justDraggedZone = false; return; }
      if (this.justDrewZone) { this.justDrewZone = false; return; }
      if (this.zoneDraft?.active) return;
      if (this.placementType) { this.placeStructure(this.placementType, p.x, p.y); return; }
      if (this.teachLocationEdit) { if (this.applyTeachLocationSelection(p.x, p.y)) return; }
      const bot = this.botAt(p.x, p.y); if (bot) return this.showBotMenu(bot, p.clientX, p.clientY);
      const s = this.structureAt(p.x, p.y); if (s) return this.showStructureMenu(s, p.clientX, p.clientY);
      const z = this.zoneAt(p.x, p.y); if (z) return this.showZoneMenu(z, p.clientX, p.clientY);
    });
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault(); const p = this.canvasToWorld(e); Object.assign(this.mouse, p);
      if (this.zoneDraft?.active) return;
      if (this.placementType) { this.cancelPlacement(); return; }
      if (this.teachLocationEdit) { if (this.applyTeachLocationSelection(p.x, p.y)) return; }
      const item = this.itemAt(p.x, p.y); if (item) return this.queuePlayerItemPickup(item);
      const s = this.structureAt(p.x, p.y); if (s) { if (this.queuePlayerThroneAttack(s)) return; return this.queuePlayerStructureDeposit(s) || this.showStructureMenu(s, p.clientX, p.clientY); }
      const hemp = this.hempAt(p.x, p.y); if (hemp && this.queuePlayerHempAction(hemp)) return;
      const tree = this.treeAt(p.x, p.y); if (tree && (this.queuePlayerResourceAction(tree, 'chop_tree') || this.queuePlayerTreeSearch(tree))) return;
      const rock = this.rockAt(p.x, p.y); if (rock && this.queuePlayerResourceAction(rock, 'mine_stone')) return;
      this.setPlayerDestination(p.x, p.y);
    });
  }

  finishZoneDrag() {
    const d = this.zoneDrag;
    if (!d?.active) return null;
    this.zoneDrag = null;
    this.justDraggedZone = Boolean(d.moved);
    if (d.moved) {
      this.syncZonesUi();
      this.addFloat(`Moved ${d.zone.name}`, d.zone.x + d.zone.w / 2, d.zone.y - 8, '#d3a95f');
      this.updateHover();
    }
    return d.zone;
  }

  updateHover() {
    this.mouse.hoverBot = this.botAt(this.mouse.x, this.mouse.y);
    this.mouse.hoverStructure = !this.mouse.hoverBot ? this.structureAt(this.mouse.x, this.mouse.y) : null;
    this.mouse.hoverMonster = !this.mouse.hoverBot && !this.mouse.hoverStructure ? this.monsterAt(this.mouse.x, this.mouse.y) : null;
    this.mouse.hoverHemp = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster ? this.hempAt(this.mouse.x, this.mouse.y) : null;
    this.mouse.hoverItem = !this.mouse.hoverBot && !this.mouse.hoverStructure && !this.mouse.hoverMonster && !this.mouse.hoverHemp ? this.itemAt(this.mouse.x, this.mouse.y) : null;
    this.mouse.hoverZone = !this.mouse.hoverStructure && !this.mouse.hoverBot && !this.mouse.hoverMonster && !this.mouse.hoverItem && !this.mouse.hoverHemp ? this.zoneAt(this.mouse.x, this.mouse.y) : null;
    this.canvas.style.cursor = this.zoneDraft?.active || this.placementType ? 'crosshair' : (this.zoneDrag?.active ? 'grabbing' : (this.mouse.hoverBot || this.mouse.hoverStructure || this.mouse.hoverMonster || this.mouse.hoverItem || this.mouse.hoverHemp || this.mouse.hoverZone ? 'pointer' : 'default'));
  }

  addStructure(type, x, y) {
    const def = BUILDING_TYPES[type]; const id = this.nextStructureId++;
    const countSame = this.structures.filter(s => s.type === type).length + 1;
    const baseName = type === 'factory' ? 'factory' : type === 'item_palette' ? 'item palette' : type === 'workbench' ? 'tool bench' : type === 'smithery' ? 'smithery' : type === 'bowmaker' ? 'bowmaker' : type === 'defensetower' ? 'defense tower' : type === 'throne' ? 'throne' : 'sawbench';
    const s = { id, ref: `structure:${id}`, type, name: `${baseName} ${countSame}`, label: def.label, x, y, w: def.w, h: def.h, logs: 0, planks: 0, poles: 0, sticks: 0, stones: 0, tree_seeds: 0, axes: 0, pickaxes: 0, shovels: 0, swords: 0, shields: 0, hemps: 0, bows: 0, timer: 0, processing: null };
    if (type === 'throne') Object.assign(s, { hp: def.maxHp || THRONE_HP, maxHp: def.maxHp || THRONE_HP, ownerId: null, ownerLabel: 'unclaimed' });
    if (type === 'workbench') s.workbenchRecipe = DEFAULT_WORKBENCH_RECIPE;
    if (type === 'smithery') s.smitheryRecipe = DEFAULT_SMITHERY_RECIPE;
    if (type === 'defensetower') s.rangedAttack = createRangedAttackComponent({ range: def.attackRange, damage: def.attackDamage, cooldown: def.attackCooldown });
    if (type === 'item_palette') Object.assign(s, { storageType: null, stored: 0, capacity: def.capacity || 40 });
    this.structures.push(s); this.addFloat(`Built ${s.name}`, x, y - 35, '#d3a95f'); return s;
  }
  placeStructure(type, x, y) { this.addStructure(type, clamp(x, 70, this.map.width - 70), clamp(y, 80, this.map.height - 70)); this.placementType = null; this.syncBuildUi(); }
  setPlacement(type) { this.cancelZoneDrawing(false); this.placementType = type; this.syncBuildUi(); }
  cancelPlacement() { this.placementType = null; this.syncBuildUi(); }

  beginZoneDrawing() {
    this.cancelPlacement(); this.hideMenus();
    this.zoneDraft = { active: true, started: false, kind: 'rect', x1: 0, y1: 0, x2: 0, y2: 0 };
    this.addFloat('Drag a rectangle; coordinates will be inserted into chat', this.player.x, this.player.y - 34, '#9abf8f');
  }
  cancelZoneDrawing(showFloat = true) { if (this.zoneDraft?.active && showFloat) this.addFloat('Zone draw cancelled', this.player.x, this.player.y - 34, '#c86b5f'); this.zoneDraft = null; }
  finishZoneDrawing() {
    const d = this.zoneDraft; this.zoneDraft = null;
    if (!d) return null;
    const numericId = this.nextZoneId++;
    if (d.kind === 'radius') {
      const radius = clamp(Number(d.radius || distXY(d.x1, d.y1, d.x2, d.y2) || DEFAULT_RESOURCE_RADIUS), 40, 420);
      const z = { id: `zone:${numericId}`, numericId, name: `radius ${numericId}`, kind: 'radius', x: clamp(d.x1, 0, this.map.width), y: clamp(d.y1, 0, this.map.height), radius, color: '#d3a95f', builtIn: false, hidden: false };
      this.zones.push(z); this.syncZonesUi(); this.addFloat(`Created ${z.name}`, z.x, z.y - radius - 8, '#d3a95f'); return z;
    }
    const x = clamp(Math.min(d.x1, d.x2), 0, this.map.width), y = clamp(Math.min(d.y1, d.y2), 0, this.map.height);
    const w = clamp(Math.abs(d.x2 - d.x1), 0, this.map.width - x), h = clamp(Math.abs(d.y2 - d.y1), 0, this.map.height - y);
    if (w < MIN_DRAWN_ZONE_SIZE || h < MIN_DRAWN_ZONE_SIZE) { this.addFloat('Zone too small', this.player.x, this.player.y - 34, '#c86b5f'); return null; }
    const z = { id: `zone:${numericId}`, numericId, name: `zone ${numericId}`, kind: 'rect', x, y, w, h, color: '#d3a95f', builtIn: false, hidden: false };
    this.zones.push(z); this.syncZonesUi(); this.addFloat(`Created ${z.name}`, x + w / 2, y - 8, '#d3a95f'); return z;
  }

  createBot(x, y, program = 'idle', force = false) {
    if (!force && this.bots.length >= this.maxBots) { this.addFloat(`Max bots ${this.maxBots}`, x, y - 18, '#c86b5f'); return null; }
    const id = this.nextBotId++;
    const bot = { id, ref: `bot:${id}`, x, y, r: 11, speed: 118, program, state: program, message: 'Waiting for assistant.', inventory: null, tool: null, target: null, targetItemId: null, targetItemPurpose: null, targetHoleId: null, targetStructureId: null, sourceStructureId: null, sourcePaletteId: null, targetFactoryId: null, targetWorkbenchId: null, zoneId: null, zoneSpec: null, pickupItemType: 'log', timer: 0, runtime: { pc: 0, memory: {}, wait: 0 }, color: ['#80a9c9','#9abf8f','#d3a95f','#c7b683','#8fb9b5'][id % 5] };
    this.bots.push(bot); this.addFloat(`Bot ${id} online`, x, y - 18, '#80a9c9'); return bot;
  }
  spawnTree(x, y, options = {}) {
    const stage = options.growthStage || 'grown_tree';
    const stats = TREE_GROWTH[stage] || TREE_GROWTH.grown_tree;
    const id = this.nextTreeId++;
    const tree = {
      id, ref: `tree:${id}`, x, y,
      hp: options.hp ?? stats.maxHp,
      maxHp: options.maxHp ?? stats.maxHp,
      stump: false, regrow: 0,
      radius: options.radius ?? (stage === 'grown_tree' ? rand(17, 24) : stats.radius),
      planted: !!options.planted,
      growthStage: stage,
      growTimer: options.growTimer ?? stats.growSeconds
    };
    this.trees.push(tree);
    return tree;
  }
  spawnItem(type, x, y, count = 1) { for (let i=0;i<count;i++) { const id = this.nextItemId++; this.items.push({ id, ref: `item:${id}`, type, x: x + rand(-13,13), y: y + rand(-10,10), reservedBy: null, bob: rand(0, Math.PI*2) }); } }
  spawnHemp(x, y) { const id = this.nextHempId++; const plant = { id, ref: `hemp:${id}`, type: 'hemp_plant', x, y, radius: rand(12, 16), searched: false, harvested: false, searchReservedBy: null }; this.hempPlants.push(plant); return plant; }
  spawnMonster(x, y, options = {}) {
    const id = this.nextMonsterId++;
    const monster = {
      id, ref: `monster:${id}`, kind: 'passive_monster', type: 'passive_monster', name: options.name || `passive monster ${id}`,
      x: clamp(x, 30, this.map.width - 30), y: clamp(y, 30, this.map.height - 30),
      homeX: options.homeX ?? x, homeY: options.homeY ?? y, radius: options.radius ?? rand(17, 21),
      hp: options.hp ?? 10, maxHp: options.maxHp ?? 10, passive: true, speed: options.speed ?? rand(38, 52),
      roamRadius: options.roamRadius ?? MONSTER_ROAM_RADIUS, avoidRadius: options.avoidRadius ?? MONSTER_AVOID_STRUCTURE_RADIUS,
      wanderTarget: null, phase: rand(0, Math.PI * 2)
    };
    this.monsters.push(monster);
    return monster;
  }
  createArrowProjectile(source, target) {
    const attack = source?.rangedAttack || DEFENSE_TOWER_ATTACK;
    const id = this.nextProjectileId++;
    return { id, ref: `projectile:${id}`, type: 'arrow', x: source.x, y: source.y, vx: 1, vy: 0, sourceStructureId: source.id, targetRef: target.ref, targetKind: target.kind || target.type || 'monster', targetId: target.id, speed: attack.projectileSpeed || DEFENSE_TOWER_ATTACK.projectileSpeed, damage: attack.damage || 1, ttl: 2.4 };
  }
  findProjectileTarget(projectile) {
    if (!projectile) return null;
    if (projectile.targetRef?.startsWith('monster:') || projectile.targetKind === 'passive_monster') return this.monsters.find(m => m.ref === projectile.targetRef && (m.hp || 0) > 0) || null;
    return null;
  }
  hostileTargetsForStructure(structure) {
    const attack = structure?.rangedAttack;
    if (!attack) return [];
    return this.monsters.filter(m => (m.hp || 0) > 0 && rectDistance(m.x, m.y, structure) <= (attack.range || DEFENSE_TOWER_ATTACK.range));
  }
  nearestRangedTarget(structure) { return nearest(this.hostileTargetsForStructure(structure), structure.x, structure.y); }
  fireRangedAttack(structure, target) {
    if (!structure?.rangedAttack || !target) return false;
    this.projectiles.push(this.createArrowProjectile(structure, target));
    structure.rangedAttack.cooldownRemaining = structure.rangedAttack.cooldown || DEFENSE_TOWER_ATTACK.cooldown;
    structure.rangedAttack.targetRef = target.ref;
    this.addFloat('Arrow!', structure.x, structure.y - 56, '#d3a95f');
    return true;
  }
  damageMonster(monster, damage = 1) {
    if (!monster || (monster.hp || 0) <= 0) return false;
    monster.hp = Math.max(0, (monster.hp || monster.maxHp || 1) - damage);
    this.addFloat(`${monster.name || 'enemy'} -${damage} HP`, monster.x, monster.y - 34, monster.hp <= 0 ? '#c86b5f' : '#d3a95f');
    if (monster.hp <= 0) this.addFloat(`${monster.name || 'enemy'} defeated`, monster.x, monster.y - 50, '#9abf8f');
    return true;
  }
  updateRangedAttackStructures(dt) {
    for (const s of this.structures) {
      const attack = s.rangedAttack;
      if (!attack) continue;
      attack.cooldownRemaining = Math.max(0, (attack.cooldownRemaining || 0) - dt);
      if (attack.cooldownRemaining > 0) continue;
      const target = this.nearestRangedTarget(s);
      if (target) this.fireRangedAttack(s, target);
      else attack.targetRef = null;
    }
  }
  updateProjectiles(dt) {
    const active = [];
    for (const p of this.projectiles) {
      p.ttl = (p.ttl ?? 2.4) - dt;
      const target = this.findProjectileTarget(p);
      if (!target || p.ttl <= 0) continue;
      const dx = target.x - p.x, dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      p.vx = dx / d; p.vy = dy / d;
      const step = (p.speed || DEFENSE_TOWER_ATTACK.projectileSpeed) * dt;
      if (d <= step + (target.radius || 16)) { this.damageMonster(target, p.damage || 1); continue; }
      p.x = clamp(p.x + p.vx * step, 0, this.map.width);
      p.y = clamp(p.y + p.vy * step, 0, this.map.height);
      active.push(p);
    }
    this.projectiles = active;
  }
  monsterStructureDistance(monster, structure) { return structure ? Math.max(0, rectDistance(monster.x, monster.y, structure) - (monster.radius || 18)) : Infinity; }
  nearestStructureToMonster(monster) { return nearest(this.structures, monster.x, monster.y, () => true); }
  monsterTargetAwayFromStructure(monster, structure) {
    const dx = monster.x - structure.x, dy = monster.y - structure.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: clamp(monster.x + dx / len * monster.avoidRadius, 30, this.map.width - 30), y: clamp(monster.y + dy / len * monster.avoidRadius, 30, this.map.height - 30) };
  }
  pickMonsterWanderTarget(monster) {
    for (let i = 0; i < 14; i++) {
      const angle = rand(0, Math.PI * 2);
      const distance = rand(45, monster.roamRadius);
      const target = { x: clamp(monster.homeX + Math.cos(angle) * distance, 30, this.map.width - 30), y: clamp(monster.homeY + Math.sin(angle) * distance, 30, this.map.height - 30) };
      const nearStructure = nearest(this.structures, target.x, target.y, () => true);
      if (!nearStructure || rectDistance(target.x, target.y, nearStructure) >= monster.avoidRadius) return target;
    }
    return { x: clamp(monster.homeX, 30, this.map.width - 30), y: clamp(monster.homeY, 30, this.map.height - 30) };
  }
  dropProducedItem(structure, type, count = 1) {
    if (!structure) return;
    const w = structure.w || BUILDING_TYPES[structure.type]?.w || 80;
    const h = structure.h || BUILDING_TYPES[structure.type]?.h || 50;
    const x = clamp(structure.x + w / 2 + 24, 16, this.map.width - 16);
    const y = clamp(structure.y + h / 2 + 18, 16, this.map.height - 16);
    this.spawnItem(type, x, y, count);
  }
  spawnStoneDeposit(x, y) { const id = this.nextRockId++; const maxHp = 5; this.rocks.push({ id, ref: `rock:${id}`, type: 'stone_deposit', x, y, hp: maxHp, maxHp, radius: rand(14,20), respawn: 0 }); return this.rocks[this.rocks.length - 1]; }
  spawnHole(x, y) {
    const id = this.nextHoleId++;
    const hole = { id, ref: `hole:${id}`, kind: 'dug_hole', x: clamp(x, 12, this.map.width - 12), y: clamp(y, 12, this.map.height - 12), planted: false, reservedBy: null, treeId: null };
    this.holes.push(hole);
    return hole;
  }
  openHoleInZone(hole, zone) { return hole && !hole.planted && this.objectInZone(hole, zone); }
  nearestOpenHole(x, y, zone = null, maxDistance = Infinity, reservedBy = null) {
    return nearest(this.holes, x, y, h => this.openHoleInZone(h, zone) && (!h.reservedBy || h.reservedBy === reservedBy) && distXY(x, y, h.x, h.y) <= maxDistance);
  }
  plantSeedInHole(hole, actor = null) {
    if (!hole || hole.planted) return false;
    this.spawnTree(hole.x, hole.y, { planted: true, growthStage: 'sapling' });
    this.holes = this.holes.filter(h => h.id !== hole.id);
    this.addFloat('Planted tree seed', hole.x, hole.y - 18, '#9abf8f');
    if (actor) actor.targetHoleId = null;
    return true;
  }
  addFloat(text, x, y, color = '#e5ece8') {
    const existing = this.floaters.find(f => f.text === text && distXY(f.x, f.y, x, y) < 8);
    if (existing) {
      Object.assign(existing, { x, y, color, life: existing.max || 1.3 });
      return;
    }
    this.floaters.push({ text, x, y, color, life: 1.3, max: 1.3 });
  }

  clearTeachConcreteLocation(step) {
    for (const key of ['structureId', 'structureRef', 'structureType', 'structureName', 'holeId', 'holeRef', 'holeName', 'treeId', 'treeRef', 'treeName', 'hempId', 'hempRef', 'hempName', 'rockId', 'rockRef', 'rockName', 'target']) delete step[key];
  }
  clearTeachZoneLocation(step) { delete step.zoneId; delete step.zoneSpec; delete step.zoneLabel; }
  resourceRadiusStep(op, resource, label = 'resource', radius = DEFAULT_RESOURCE_RADIUS) {
    const x = Math.round(resource?.x || this.player.x), y = Math.round(resource?.y || this.player.y);
    const zoneSpec = { kind: 'radius', x, y, radius, name: `${radius}px radius around ${label}` };
    return { op, zoneSpec, zoneLabel: zoneSpec.name };
  }
  stepText(step) {
    const where = step.zoneLabel ? ` in ${step.zoneLabel}` : '';
    if (step.op === 'pick_up') return `pick up nearest ${itemLabel(step.type)}${where}`;
    if (step.op === 'pick_up_from_storage') return `pick up ${itemLabel(step.type)} from ${step.structureName || step.target || 'storage'}`;
    if (step.op === 'move_to_structure') return `move_to ${step.structureName || step.target || 'structure'}`;
    if (step.op === 'deposit_to_structure') return `move to ${step.structureName || step.target || 'structure'} and deposit ${itemLabel(step.type)}`;
    if (step.op === 'plant_seed') return step.holeName ? `plant tree seed in ${step.holeName}` : 'plant tree seed in dug hole';
    if (step.op === 'chop_tree') return step.treeName ? `chop ${step.treeName}` : `chop nearest tree${where}`;
    if (step.op === 'search_tree') return step.treeName ? `move to ${step.treeName} and search for sticks and seeds` : `search trees${where} for sticks and seeds`;
    if (step.op === 'chop_hemp') return step.hempName ? `chop ${step.hempName}` : `chop nearest hemp${where}`;
    if (step.op === 'search_hemp') return step.hempName ? `move to ${step.hempName} and search for hemp seed` : `search hemp${where} for seeds`;
    if (step.op === 'mine_stone') return step.rockName ? `mine ${step.rockName}` : `mine nearest stone deposit${where}`;
    return step.op;
  }
  activeTeachSteps() { return this.recorder.steps.length ? this.recorder.steps : this.recordedLoop; }
  openTeachPanel(botId = null) {
    if (botId != null) this.recorder.targetBotId = Number(botId);
    this.teachPanelOpened = true;
    if (this.dom?.teachPanel) this.dom.teachPanel.hidden = false;
    if (this.dom?.teachBotId && this.recorder.targetBotId) this.dom.teachBotId.value = String(this.recorder.targetBotId);
  }
  teachStepLocationText(step) {
    if (step.zoneLabel) return step.zoneLabel;
    if (step.structureName) return step.structureName;
    if (step.holeName) return step.holeName;
    if (step.treeName) return step.treeName;
    if (step.hempName) return step.hempName;
    if (step.rockName) return step.rockName;
    return 'nearest';
  }
  renderTeachSteps(steps) {
    if (!steps.length) return '<li class="empty">No recorded steps yet.</li>';
    const options = '<option value="">Location…</option><option value="select_zone">Select zone</option><option value="draw_zone">Draw zone</option><option value="draw_radius">Draw radius</option><option value="nearest">Nearest</option>';
    return steps.map((s, i) => `<li class="teach-step-card" draggable="true" data-step-index="${i}"><div class="step-card-main"><b>${i + 1}.</b> <code>${escapeHtml(this.stepText(s))}</code></div><div class="step-card-actions"><button type="button" data-step-location="${i}">${escapeHtml(this.teachStepLocationText(s))}</button><select aria-label="Location mode" data-step-location-menu="${i}">${options}</select><button type="button" data-step-up="${i}" aria-label="Move step up">↑</button><button type="button" data-step-down="${i}" aria-label="Move step down">↓</button><button type="button" data-delete-step="${i}" aria-label="Delete step">Delete</button></div></li>`).join('');
  }
  syncTeachUi() {
    if (!this.dom?.teachStatus) return;
    const targetBotText = this.recorder.targetBotId ? ` for Bot ${this.recorder.targetBotId}` : '';
    const status = this.recorder.recording ? `Recording ${this.recorder.steps.length} step${this.recorder.steps.length === 1 ? '' : 's'}${targetBotText}…` : this.recorder.status;
    this.dom.teachStatus.textContent = status;
    if (this.dom.teachPanel) this.dom.teachPanel.hidden = !this.teachPanelOpened;
    if (this.dom.teachRecordBtn) this.dom.teachRecordBtn.textContent = this.recorder.recording ? 'Stop Recording' : 'Record Loop';
    if (this.dom.teachBotId && this.recorder.targetBotId) this.dom.teachBotId.value = String(this.recorder.targetBotId);
    if (this.dom.teachSteps) this.dom.teachSteps.innerHTML = this.renderTeachSteps(this.activeTeachSteps());
    this.bindTeachStepControls(this.dom.teachSteps);
  }
  startTeachRecording(botId = null) {
    this.openTeachPanel(botId);
    this.recorder.recording = true;
    this.recorder.steps = [];
    this.recordedLoop = [];
    this.recorder.status = `Recording${this.recorder.targetBotId ? ` for Bot ${this.recorder.targetBotId}` : ''}: right-click items/resources/buildings or press E near things.`;
    this.addFloat('Recording loop', this.player.x, this.player.y - 34, '#d3a95f');
    this.syncTeachUi();
    return this.getRecorderState();
  }
  stopTeachRecording() {
    this.recorder.recording = false;
    this.recordedLoop = clone(this.recorder.steps);
    this.recorder.status = this.recordedLoop.length ? `Recorded ${this.recordedLoop.length} steps. Assign to a bot.` : 'Recording stopped with no steps.';
    this.addFloat(this.recorder.status, this.player.x, this.player.y - 34, this.recordedLoop.length ? '#9abf8f' : '#c86b5f');
    this.syncTeachUi();
    return this.getRecorderState();
  }
  recordTeachStep(step) {
    if (!this.recorder.recording) return;
    const normalized = { ...step, text: this.stepText(step) };
    const last = this.recorder.steps[this.recorder.steps.length - 1];
    if (last && last.text === normalized.text) return;
    this.recorder.steps.push(normalized);
    this.recorder.status = normalized.text;
    this.addFloat(`Recorded: ${normalized.text}`, this.player.x, this.player.y - 42, '#d3a95f');
    this.syncTeachUi();
  }
  recordMoveToStructure(s) {
    if (!s) return;
    this.recordTeachStep({ op: 'move_to_structure', structureId: s.id, structureRef: s.ref, structureType: s.type, structureName: s.name, target: s.name });
  }
  setTeachSteps(steps) {
    if (this.recorder.recording) this.recorder.steps = steps;
    else this.recordedLoop = steps;
    for (const step of steps) step.text = this.stepText(step);
    this.syncTeachUi();
  }
  deleteTeachStep(index) { const steps = clone(this.activeTeachSteps()); if (index < 0 || index >= steps.length) return; steps.splice(index, 1); this.setTeachSteps(steps); }
  moveTeachStep(index, delta) { const steps = clone(this.activeTeachSteps()); const to = index + delta; if (index < 0 || to < 0 || index >= steps.length || to >= steps.length) return; [steps[index], steps[to]] = [steps[to], steps[index]]; this.setTeachSteps(steps); }
  beginTeachLocationEdit(index, mode = 'select_zone') {
    if (mode === 'nearest') return this.clearTeachStepLocation(index);
    this.teachLocationEdit = { index, mode };
    if (mode === 'draw_zone' || mode === 'draw_radius') {
      this.cancelPlacement(); this.hideMenus();
      this.zoneDraft = { active: true, started: false, kind: mode === 'draw_radius' ? 'radius' : 'rect', x1: 0, y1: 0, x2: 0, y2: 0, radius: DEFAULT_RESOURCE_RADIUS };
      this.addFloat(mode === 'draw_radius' ? 'Drag a radius for this step' : 'Drag a zone for this step', this.player.x, this.player.y - 44, '#d3a95f');
      return true;
    }
    this.addFloat('Click an existing zone for this step', this.player.x, this.player.y - 44, '#d3a95f');
    return true;
  }
  clearTeachStepLocation(index) {
    const steps = clone(this.activeTeachSteps());
    const step = steps[index];
    if (!step) return false;
    this.clearTeachConcreteLocation(step); this.clearTeachZoneLocation(step);
    step.text = this.stepText(step);
    this.teachLocationEdit = null;
    this.setTeachSteps(steps);
    this.addFloat(`Step ${index + 1}: nearest`, this.player.x, this.player.y - 36, '#9abf8f');
    return true;
  }
  applyTeachZoneToStep(zone) {
    const steps = clone(this.activeTeachSteps());
    const index = this.teachLocationEdit?.index;
    const step = steps[index];
    if (!step || !zone) { this.teachLocationEdit = null; return false; }
    this.clearTeachConcreteLocation(step);
    Object.assign(step, { zoneId: zone.id, zoneSpec: null, zoneLabel: zone.name });
    step.text = this.stepText(step);
    this.teachLocationEdit = null;
    this.setTeachSteps(steps);
    this.addFloat(`Updated step ${index + 1} location`, zone.x || this.player.x, (zone.y || this.player.y) - 22, '#9abf8f');
    return true;
  }
  applyTeachLocationSelection(x, y) {
    const steps = clone(this.activeTeachSteps());
    const index = this.teachLocationEdit?.index;
    const step = steps[index];
    if (!step) { this.teachLocationEdit = null; return false; }
    const z = this.zoneAt(x, y);
    if (!z) return false;
    this.clearTeachConcreteLocation(step);
    Object.assign(step, { zoneId: z.id, zoneSpec: null, zoneLabel: z.name });
    step.text = this.stepText(step);
    this.teachLocationEdit = null;
    this.setTeachSteps(steps);
    this.addFloat(`Updated step ${index + 1} location`, x, y - 22, '#9abf8f');
    return true;
  }
  bindTeachStepControls(root) {
    if (!root || root.dataset.boundTeachSteps === '1') return;
    root.dataset.boundTeachSteps = '1';
    root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const n = Number(b.dataset.deleteStep ?? b.dataset.stepUp ?? b.dataset.stepDown ?? b.dataset.stepLocation); if (!Number.isFinite(n)) return; if ('deleteStep' in b.dataset) this.deleteTeachStep(n); else if ('stepUp' in b.dataset) this.moveTeachStep(n, -1); else if ('stepDown' in b.dataset) this.moveTeachStep(n, 1); else this.beginTeachLocationEdit(n, 'select_zone'); });
    root.addEventListener('change', e => { const menu = e.target.closest('select[data-step-location-menu]'); if (!menu) return; const n = Number(menu.dataset.stepLocationMenu); const mode = menu.value; menu.value = ''; if (Number.isFinite(n) && mode) this.beginTeachLocationEdit(n, mode); });
    root.addEventListener('dragstart', e => { const card = e.target.closest('[data-step-index]'); if (!card) return; this.draggedTeachStepIndex = Number(card.dataset.stepIndex); e.dataTransfer?.setData('text/plain', String(this.draggedTeachStepIndex)); });
    root.addEventListener('dragover', e => { if (e.target.closest('[data-step-index]')) e.preventDefault(); });
    root.addEventListener('drop', e => { const card = e.target.closest('[data-step-index]'); const from = Number(e.dataTransfer?.getData('text/plain') || this.draggedTeachStepIndex); const to = Number(card?.dataset.stepIndex); if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return; e.preventDefault(); const steps = clone(this.activeTeachSteps()); const [moved] = steps.splice(from, 1); steps.splice(to, 0, moved); this.setTeachSteps(steps); });
  }
  getRecorderState() { return { recording: this.recorder.recording, steps: clone(this.recorder.steps), recordedLoop: clone(this.recordedLoop), status: this.recorder.status, lastAssignedBotId: this.recorder.lastAssignedBotId, targetBotId: this.recorder.targetBotId }; }
  assignRecordedLoopToBot(botId) {
    const bot = this.findBot(botId);
    if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    if (this.recorder.recording) this.stopTeachRecording();
    const source = this.recordedLoop.length ? this.recordedLoop : this.recorder.steps;
    if (!source.length) return { ok: false, error: 'No recorded loop to assign' };
    bot.paused = false; bot.program = 'taught_loop'; bot.state = 'taught_loop'; bot.message = 'Assigned recorded teach-by-doing loop.'; bot.taughtLoop = clone(source); bot.runtime = { pc: 0, memory: {}, wait: 0 }; bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0;
    this.recorder.lastAssignedBotId = bot.id;
    this.recorder.status = `Assigned recorded loop to Bot ${bot.id}.`;
    this.addFloat(`Bot ${bot.id}: taught loop`, bot.x, bot.y - 22, '#d3a95f');
    this.syncTeachUi();
    return { ok: true, bot, steps: clone(bot.taughtLoop) };
  }
  resolveRecordedStructure(step, from) {
    const byId = step.structureId ? this.structures.find(s => s.id === step.structureId && (!step.structureType || s.type === step.structureType)) : null;
    if (byId) return byId;
    const name = String(step.structureName || step.target || '').toLowerCase();
    return this.structures.find(s => (!step.structureType || s.type === step.structureType) && s.name.toLowerCase() === name) || this.nearestStructure(step.structureType || 'sawbench', from.x, from.y);
  }

  findBot(id) { return this.bots.find(b => b.id === Number(String(id).replace(/^bot:/,''))); }
  botAt(x, y) { return this.bots.find(b => distXY(x, y, b.x, b.y) <= b.r + 7) || null; }
  itemAt(x, y) { return nearest(this.items, x, y, i => distXY(x, y, i.x, i.y) <= 18) || null; }
  hempAt(x, y) { return nearest(this.hempPlants, x, y, h => !h.harvested && distXY(x, y, h.x, h.y) <= (h.radius || 14) + 8) || null; }
  structureAt(x, y) { return [...this.structures].reverse().find(s => pointInRect(x, y, s)) || null; }
  holeAt(x, y) { return nearest(this.holes, x, y, h => distXY(x, y, h.x, h.y) <= 18) || null; }
  treeAt(x, y) { return nearest(this.trees, x, y, t => !t.stump && distXY(x, y, t.x, t.y) <= (t.radius || 18) + 6) || null; }
  rockAt(x, y) { return nearest(this.rocks, x, y, r => !r.depleted && distXY(x, y, r.x, r.y) <= (r.radius || 18) + 6) || null; }
  monsterAt(x, y) { return nearest(this.monsters, x, y, m => (m.hp || 0) > 0 && distXY(x, y, m.x, m.y) <= (m.radius || 18) + 8) || null; }
  zoneAt(x, y) { return [...this.zones].reverse().find(z => !z.hidden && this.pointInZone(x, y, z)) || null; }
  nearestStructure(type, x, y, targetId = null) { return targetId ? this.structures.find(s => s.id === targetId && s.type === type) : nearest(this.structures, x, y, s => s.type === type); }
  countItems(type) { return this.items.filter(i => i.type === type).length; }

  normalizeStructureId(value, type = null) {
    if (value == null || value === '') return null;
    const text = String(value).trim().toLowerCase();
    const numeric = Number(text.replace(/^structure:/, ''));
    const found = Number.isFinite(numeric) && numeric > 0 ? this.structures.find(s => s.id === numeric) : this.structures.find(s => s.name.toLowerCase() === text || s.ref === text);
    return found && (!type || found.type === type) ? found.id : null;
  }
  findStructureMention(text, type = null) {
    const t = String(text || '').toLowerCase();
    return this.structures.find(s => (!type || s.type === type) && (t.includes(s.name.toLowerCase()) || t.includes(s.ref))) || null;
  }
  findZoneMention(text) {
    const t = String(text || '').toLowerCase();
    return this.zones.find(z => t.includes(z.name.toLowerCase()) || t.includes(z.id.toLowerCase())) || null;
  }
  parseRadiusZoneMention(text) {
    const lower = String(text || '').toLowerCase();
    if (!/(around|near|um|bereich|radius|small|klein|large|groß|gross)/.test(lower)) return null;
    const structure = this.findStructureMention(lower);
    if (!structure) return null;
    const radius = /(large|groß|gross|big|weiter|weiten)/.test(lower) ? 220 : /(small|klein|kleinen|tiny)/.test(lower) ? 95 : 150;
    return { kind: 'radius', centerStructureId: structure.id, radius, name: `${radius <= 100 ? 'small' : radius >= 200 ? 'large' : 'radius'} area around ${structure.name}` };
  }
  parseRectangleZoneMention(text) {
    const raw = String(text || '');
    const patterns = [
      /rect\s*\(\s*x\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*,\s*y\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*,\s*w(?:idth)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*,\s*h(?:eight)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*\)/i,
      /\{\s*"?kind"?\s*:\s*"?rect"?\s*,\s*"?x"?\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"?y"?\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"?w"?\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"?h"?\s*:\s*(\d+(?:\.\d+)?)\s*\}/i
    ];
    const m = patterns.map(p => raw.match(p)).find(Boolean);
    if (!m) return null;
    const x = clamp(Number(m[1]), 0, this.map.width), y = clamp(Number(m[2]), 0, this.map.height);
    const w = clamp(Number(m[3]), 1, this.map.width - x), h = clamp(Number(m[4]), 1, this.map.height - y);
    return { kind: 'rect', x, y, w, h, name: this.rectangleText({ x, y, w, h }) };
  }
  rectangleText(zone) { return `rect(x:${Math.round(zone.x)},y:${Math.round(zone.y)},w:${Math.round(zone.w)},h:${Math.round(zone.h)})`; }
  normalizeItemType(value, fallback = 'log') {
    const t = String(value || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    if (!t) return fallback;
    const aliases = { logs: 'log', log: 'log', planks: 'plank', boards: 'plank', board: 'plank', plank: 'plank', poles: 'pole', pole: 'pole', sticks: 'stick', stick: 'stick', rocks: 'stone', rock: 'stone', stones: 'stone', stone: 'stone', seeds: 'tree_seed', seed: 'tree_seed', 'tree seed': 'tree_seed', 'tree seeds': 'tree_seed', axes: 'crude_axe', axe: 'crude_axe', 'crude axe': 'crude_axe', pickaxes: 'crude_pickaxe', pickaxe: 'crude_pickaxe', 'crude pickaxe': 'crude_pickaxe', shovels: 'crude_shovel', shovel: 'crude_shovel', 'crude shovel': 'crude_shovel', swords: 'wooden_sword', sword: 'wooden_sword', 'wooden sword': 'wooden_sword', shields: 'wooden_shield', shield: 'wooden_shield', 'wooden shield': 'wooden_shield', hemp: 'hemp', 'hemp fibre': 'hemp', 'hemp fiber': 'hemp', 'hemp seed': 'hemp_seed', 'hemp seeds': 'hemp_seed', bow: 'bow', bows: 'bow' };
    return aliases[t] || ITEM_TYPES.find(type => t === type || t === itemLabel(type)) || fallback;
  }
  normalizeZoneSpec(input) {
    if (!input) return { zoneId: null, zoneSpec: null };
    if (typeof input === 'string') {
      const rect = this.parseRectangleZoneMention(input);
      if (rect) return { zoneId: null, zoneSpec: rect };
      const z = this.findZoneMention(input) || this.zones.find(zone => zone.id === input || String(zone.numericId) === input.replace(/^zone:/,''));
      return z ? { zoneId: z.id, zoneSpec: null } : { zoneId: null, zoneSpec: null };
    }
    if (typeof input === 'object') {
      if (input.kind === 'rect' || ('x' in input && 'y' in input && ('w' in input || 'width' in input) && ('h' in input || 'height' in input))) {
        const x = clamp(Number(input.x || 0), 0, this.map.width), y = clamp(Number(input.y || 0), 0, this.map.height);
        const w = clamp(Number(input.w ?? input.width ?? 0), 1, this.map.width - x), h = clamp(Number(input.h ?? input.height ?? 0), 1, this.map.height - y);
        return { zoneId: null, zoneSpec: { kind: 'rect', x, y, w, h, name: input.name || this.rectangleText({ x, y, w, h }) } };
      }
      if (input.kind === 'radius') {
        const centerStructureId = this.normalizeStructureId(input.centerStructureId || input.targetStructureId || input.structureId || input.center, null);
        const radius = clamp(Number(input.radius || DEFAULT_RESOURCE_RADIUS), 40, 420);
        if (centerStructureId) {
          const s = this.structures.find(st => st.id === centerStructureId);
          return { zoneId: null, zoneSpec: { kind: 'radius', centerStructureId, radius, name: input.name || `${radius}px around ${s?.name || 'structure'}` } };
        }
        const x = Number(input.x ?? input.centerX);
        const y = Number(input.y ?? input.centerY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return { zoneId: null, zoneSpec: null };
        return { zoneId: null, zoneSpec: { kind: 'radius', x: clamp(x, 0, this.map.width), y: clamp(y, 0, this.map.height), radius, name: input.name || `${radius}px radius` } };
      }
      if (input.id || input.name) return this.normalizeZoneSpec(String(input.id || input.name));
    }
    return { zoneId: null, zoneSpec: null };
  }
  getBotZone(bot) { return bot.zoneSpec || (bot.zoneId ? this.zones.find(z => z.id === bot.zoneId) : null); }
  zoneLabel(zone) { if (!zone) return 'anywhere'; if (zone.kind === 'radius') { const s = zone.centerStructureId ? this.structures.find(st => st.id === zone.centerStructureId) : null; return zone.name || `${zone.radius || DEFAULT_RESOURCE_RADIUS}px around ${s?.name || 'point'}`; } return zone.name || zone.id; }
  pointInZone(x, y, zone) {
    if (!zone) return true;
    if (zone.kind === 'radius') { const s = zone.centerStructureId ? this.structures.find(st => st.id === zone.centerStructureId) : null; const cx = s?.x ?? zone.x, cy = s?.y ?? zone.y; return Number.isFinite(cx) && Number.isFinite(cy) && distXY(x, y, cx, cy) <= (zone.radius || DEFAULT_RESOURCE_RADIUS); }
    return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
  }
  objectInZone(obj, zone) { return this.pointInZone(obj.x, obj.y, zone); }

  getBotProgram(bot) {
    const tpl = PROGRAM_TEMPLATES[bot.program] || PROGRAM_TEMPLATES.idle;
    if (bot.program === 'taught_loop' && bot.taughtLoop?.length) {
      return { ...tpl, steps: clone(bot.taughtLoop), parameters: { source: 'teach by doing recorder' }, resolvedSteps: clone(bot.taughtLoop) };
    }
    const targetSawbench = bot.targetStructureId ? this.structures.find(s => s.id === bot.targetStructureId) : null;
    const sourceSawbench = bot.sourceStructureId ? this.structures.find(s => s.id === bot.sourceStructureId) : null;
    const targetFactory = bot.targetFactoryId ? this.structures.find(s => s.id === bot.targetFactoryId) : null;
    const targetWorkbench = bot.targetWorkbenchId ? this.structures.find(s => s.id === bot.targetWorkbenchId) : null;
    const sourcePalette = bot.sourcePaletteId ? this.structures.find(s => s.id === bot.sourcePaletteId) : null;
    const zone = this.getBotZone(bot);
    return {
      ...tpl,
      parameters: {
        targetSawbench: targetSawbench ? { id: targetSawbench.ref, name: targetSawbench.name } : null,
        sourceSawbench: sourceSawbench ? { id: sourceSawbench.ref, name: sourceSawbench.name } : null,
        targetFactory: targetFactory ? { id: targetFactory.ref, name: targetFactory.name } : null,
        targetWorkbench: targetWorkbench ? { id: targetWorkbench.ref, name: targetWorkbench.name } : null,
        sourcePalette: sourcePalette ? { id: sourcePalette.ref, name: sourcePalette.name, storageType: sourcePalette.storageType, stored: sourcePalette.stored } : null,
        itemType: bot.pickupItemType || null,
        zone: zone ? { id: zone.id || null, name: this.zoneLabel(zone), kind: zone.kind, rect: zone.kind === 'rect' ? { x: Math.round(zone.x), y: Math.round(zone.y), w: Math.round(zone.w), h: Math.round(zone.h) } : undefined, radius: zone.kind === 'radius' ? { x: Math.round(zone.x || 0), y: Math.round(zone.y || 0), r: Math.round(zone.radius || DEFAULT_RESOURCE_RADIUS) } : undefined } : null
      },
      resolvedSteps: tpl.steps.map(step => this.resolveStepSlots(step, bot))
    };
  }
  resolveStepSlots(step, bot) {
    const zone = this.getBotZone(bot);
    const targetSawbench = bot.targetStructureId ? this.structures.find(s => s.id === bot.targetStructureId) : null;
    const sourceSawbench = bot.sourceStructureId ? this.structures.find(s => s.id === bot.sourceStructureId) : null;
    const targetFactory = bot.targetFactoryId ? this.structures.find(s => s.id === bot.targetFactoryId) : null;
    const targetWorkbench = bot.targetWorkbenchId ? this.structures.find(s => s.id === bot.targetWorkbenchId) : null;
    const sourcePalette = bot.sourcePaletteId ? this.structures.find(s => s.id === bot.sourcePaletteId) : null;
    const out = { ...step };
    for (const [k, v] of Object.entries(out)) {
      if (v === '$zone') out[k] = zone ? this.zoneLabel(zone) : 'anywhere';
      if (v === '$targetSawbench') out[k] = targetSawbench?.name || 'nearest sawbench';
      if (v === '$sourceSawbench') out[k] = sourceSawbench?.name || 'nearest sawbench with planks';
      if (v === '$targetFactory') out[k] = targetFactory?.name || 'nearest factory';
      if (v === '$targetWorkbench') out[k] = targetWorkbench?.name || 'nearest tool bench';
      if (v === '$sourcePalette') out[k] = sourcePalette?.name || 'ground items';
      if (v === '$itemType') out[k] = bot.pickupItemType || 'log';
    }
    return out;
  }
  validateDslProgram(candidate) { return candidate && Array.isArray(candidate.steps) && candidate.steps.every(s => ALLOWED_OPS.includes(s.op)) ? { ok: true } : { ok: false, error: 'Invalid DSL program' }; }

  assignBotProgram({ botId, program, targetStructureId = null, sourceStructureId = null, sourcePaletteId = null, itemType = null, targetFactoryId = null, targetWorkbenchId = null, zoneId = null, zone = null, reason = '' }) {
    const bot = this.findBot(botId); if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    if (!PROGRAMS.includes(program)) return { ok: false, error: `Program ${program} not allowed` };
    const anyTargetId = this.normalizeStructureId(targetStructureId, null);
    const anyTarget = anyTargetId ? this.structures.find(s => s.id === anyTargetId) : null;
    const sawTarget = this.normalizeStructureId(anyTarget?.type === 'sawbench' ? anyTarget.id : targetStructureId, 'sawbench');
    const sawSource = this.normalizeStructureId(sourceStructureId, 'sawbench');
    const paletteSource = this.normalizeStructureId(sourcePaletteId || (anyTarget?.type === 'item_palette' ? anyTarget.id : null) || (program === 'pickup_item' ? sourceStructureId : null), 'item_palette');
    const factoryTarget = this.normalizeStructureId(targetFactoryId || (anyTarget?.type === 'factory' ? anyTarget.id : null) || (program === 'build_bots' ? targetStructureId : null), 'factory');
    const workbenchTarget = this.normalizeStructureId(targetWorkbenchId || (anyTarget?.type === 'workbench' ? anyTarget.id : null) || (program === 'craft_axes' ? targetStructureId : null), 'workbench');
    const normalizedItemType = this.normalizeItemType(itemType, 'log');
    const normalizedZone = this.normalizeZoneSpec(zone || zoneId);
    const taughtLoop = program === 'taught_loop' ? clone(this.recordedLoop.length ? this.recordedLoop : this.recorder.steps) : null;
    if (program === 'taught_loop' && !taughtLoop.length) return { ok: false, error: 'No recorded loop to assign' };
    bot.paused = false; bot.program = program; bot.state = program; bot.message = reason || `Assigned ${program}`;
    bot.taughtLoop = taughtLoop;
    bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0; bot.runtime = { pc: 0, memory: {}, wait: 0 };
    bot.targetStructureId = sawTarget;
    bot.sourceStructureId = sawSource;
    bot.sourcePaletteId = paletteSource;
    bot.pickupItemType = normalizedItemType;
    bot.targetFactoryId = factoryTarget;
    bot.targetWorkbenchId = workbenchTarget;
    bot.zoneId = normalizedZone.zoneId;
    bot.zoneSpec = normalizedZone.zoneSpec;
    const targetLabel = ['haul_planks', 'build_bots'].includes(program) && factoryTarget ? this.structures.find(s => s.id === factoryTarget)?.name : sawTarget ? this.structures.find(s => s.id === sawTarget)?.name : factoryTarget ? this.structures.find(s => s.id === factoryTarget)?.name : workbenchTarget ? this.structures.find(s => s.id === workbenchTarget)?.name : paletteSource ? this.structures.find(s => s.id === paletteSource)?.name : '';
    const sourceLabel = sawSource && sawSource !== sawTarget ? this.structures.find(s => s.id === sawSource)?.name : '';
    const zoneLabel = this.zoneLabel(this.getBotZone(bot));
    this.addFloat(`Bot ${bot.id}: ${program}`, bot.x, bot.y - 22, '#d3a95f');
    return { ok: true, bot, targetLabel, sourceLabel, zoneLabel };
  }

  moveToward(entity, tx, ty, dt, speed = entity.speed || 100, close = 14) { const d = distXY(entity.x, entity.y, tx, ty); if (d <= close) return true; entity.x += ((tx - entity.x) / d) * speed * dt; entity.y += ((ty - entity.y) / d) * speed * dt; return false; }
  moveBotTo(bot, target, dt, close = 16) { if (!target) return false; return this.moveToward(bot, target.x, target.y, dt, bot.speed, close); }
  releaseReservation(bot) { for (const i of this.items) if (i.reservedBy === bot.id) i.reservedBy = null; for (const h of this.holes) if (h.reservedBy === bot.id) h.reservedBy = null; for (const t of this.trees) if (t.searchReservedBy === bot.id) t.searchReservedBy = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; }

  treeSearchAvailable(tree, actorId) { return !!tree && !tree.stump && (!tree.searchReservedBy || tree.searchReservedBy === actorId); }

  isChoppableTree(tree) { return !!tree && !tree.stump && (tree.growthStage || 'grown_tree') === 'grown_tree'; }
  updateTreeGrowth(tree, dt) {
    if (!tree || tree.stump || !tree.growthStage || tree.growthStage === 'grown_tree') return;
    tree.growTimer = (tree.growTimer ?? 0) - dt;
    if (tree.growTimer > 0) return;
    const nextStage = TREE_GROWTH[tree.growthStage]?.next || 'grown_tree';
    const stats = TREE_GROWTH[nextStage] || TREE_GROWTH.grown_tree;
    Object.assign(tree, {
      growthStage: nextStage,
      growTimer: stats.growSeconds,
      radius: nextStage === 'grown_tree' ? rand(17, 24) : stats.radius,
      maxHp: stats.maxHp,
      hp: stats.maxHp
    });
    this.addFloat(nextStage === 'grown_tree' ? 'Tree fully grown' : 'Sapling grew into a small tree', tree.x, tree.y - 22, '#9abf8f');
  }

  resetWorldCollections() {
    this.trees = []; this.hempPlants = []; this.rocks = []; this.holes = []; this.items = []; this.bots = []; this.structures = []; this.monsters = []; this.projectiles = []; this.floaters = [];
    this.nextItemId = 1; this.nextRockId = 1; this.nextHoleId = 1; this.nextTreeId = 1; this.nextHempId = 1; this.nextMonsterId = 1; this.nextProjectileId = 1; this.nextBotId = 1; this.nextStructureId = 1;
    this.zones = []; this.nextZoneId = 1;
  }

  startMultiplayerSession({ sessionId = `grove-${Date.now().toString(36)}`, role = 'host', playerId = 'p1', players = null } = {}) {
    const localStart = MULTIPLAYER_STARTS[playerId] || MULTIPLAYER_STARTS.p1;
    this.resetWorldCollections();
    this.player.x = localStart.x; this.player.y = localStart.y; this.player.target = null; this.player.inventory = null;
    this.assistant.x = localStart.x - 30; this.assistant.y = localStart.y + 24;
    this.camera.x = clamp(localStart.x - this.W / 2, 0, Math.max(0, this.map.width - this.W / (this.camera.zoom || 1)));
    this.camera.y = clamp(localStart.y - this.H / 2, 0, Math.max(0, this.map.height - this.H / (this.camera.zoom || 1)));
    this.clampCamera();

    const p1 = { ...MULTIPLAYER_STARTS.p1, ...(players?.p1 || {}) };
    const p2 = { ...MULTIPLAYER_STARTS.p2, ...(players?.p2 || {}) };
    this.multiplayer = { enabled: true, sessionId, role, playerId, status: `${role === 'host' ? 'Hosting' : 'Joined'} ${sessionId}`, players: { p1, p2 }, winner: null, syncTimer: 0 };

    const throne1 = this.addStructure('throne', p1.throneX, p1.throneY);
    Object.assign(throne1, { name: 'bottom-left throne', ownerId: 'p1', ownerLabel: 'Player 1', hp: THRONE_HP, maxHp: THRONE_HP });
    const throne2 = this.addStructure('throne', p2.throneX, p2.throneY);
    Object.assign(throne2, { name: 'top-right throne', ownerId: 'p2', ownerLabel: 'Player 2', hp: THRONE_HP, maxHp: THRONE_HP });

    [[720,1880],[920,2050],[1180,1740],[2440,520],[2680,380],[2940,690],[1720,1040],[1940,1260]].forEach(([x,y]) => this.spawnTree(x, y));
    [[820,1760],[1050,1940],[2380,620],[2820,760],[1840,1120]].forEach(([x,y]) => this.spawnHemp(x, y));
    [[940,1660],[1240,1900],[2280,720],[2800,560],[1780,1260]].forEach(([x,y]) => this.spawnStoneDeposit(x, y));
    this.addStructure('sawbench', localStart.x + (playerId === 'p1' ? 120 : -120), localStart.y - (playerId === 'p1' ? 120 : -80));
    this.addStructure('workbench', localStart.x + (playerId === 'p1' ? 230 : -230), localStart.y - (playerId === 'p1' ? 120 : -80));
    this.createBot(localStart.x + 45, localStart.y + 55, 'idle', true);
    this.createBot(localStart.x + 75, localStart.y + 30, 'idle', true);
    this.spawnItem('crude_axe', localStart.x + 95, localStart.y + 80, 2);
    this.spawnItem('stick', localStart.x + 130, localStart.y + 86, 4);
    this.spawnItem('stone', localStart.x + 160, localStart.y + 75, 2);
    this.syncBuildUi(); this.syncZonesUi?.(); this.updateHover();
    return this.getMultiplayerSnapshot();
  }

  isEnemyThrone(s) { return !!(this.multiplayer?.enabled && s?.type === 'throne' && s.ownerId && s.ownerId !== this.multiplayer.playerId && (s.hp || 0) > 0); }
  queuePlayerThroneAttack(s) {
    if (!this.isEnemyThrone(s)) return false;
    const side = this.player.x < s.x ? -1 : 1;
    this.setPlayerDestination(s.x + side * Math.max(42, s.w / 2), s.y, { action: 'attack_throne', structureId: s.id, floatText: `Attack ${s.name}` });
    return true;
  }
  damageThrone(s, damage = THRONE_ATTACK_DAMAGE) {
    if (!s || s.type !== 'throne' || (s.hp || 0) <= 0) return false;
    s.hp = Math.max(0, (s.hp || s.maxHp || THRONE_HP) - damage);
    this.addFloat(`${s.name} -${damage} HP`, s.x, s.y - 55, s.ownerId === 'p1' ? '#80a9c9' : '#c86b5f');
    if (s.hp <= 0) {
      this.multiplayer.winner = s.ownerId === 'p1' ? 'p2' : 'p1';
      this.multiplayer.status = `${this.multiplayer.winner === this.multiplayer.playerId ? 'Victory' : 'Defeat'}: ${s.name} destroyed`;
      this.addFloat(this.multiplayer.status, this.player.x, this.player.y - 45, '#fff4d0');
    }
    if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
    return true;
  }
  getLocalPlayerNetState() {
    return { sessionId: this.multiplayer?.sessionId, playerId: this.multiplayer?.playerId, x: Math.round(this.player.x), y: Math.round(this.player.y), inventory: this.player.inventory, thrones: this.structures.filter(s => s.type === 'throne').map(s => ({ id: s.id, ownerId: s.ownerId, hp: s.hp, maxHp: s.maxHp })), winner: this.multiplayer?.winner || null };
  }
  applyRemoteMultiplayerState(state = {}) {
    if (!this.multiplayer?.enabled || !state.playerId || state.playerId === this.multiplayer.playerId) return false;
    const current = this.multiplayer.players[state.playerId] || { id: state.playerId, label: state.playerId };
    this.multiplayer.players[state.playerId] = { ...current, x: Number(state.x ?? current.x), y: Number(state.y ?? current.y), inventory: state.inventory || null, disconnected: false, lastSeenAt: Date.now() };
    for (const remoteThrone of state.thrones || []) {
      const local = this.structures.find(s => s.type === 'throne' && s.ownerId === remoteThrone.ownerId);
      if (local) local.hp = remoteThrone.hp;
    }
    if (state.winner) this.multiplayer.winner = state.winner;
    return true;
  }
  updateMultiplayer(dt) {
    if (!this.multiplayer?.enabled) return;
    const local = this.multiplayer.players[this.multiplayer.playerId] || MULTIPLAYER_STARTS[this.multiplayer.playerId] || MULTIPLAYER_STARTS.p1;
    this.multiplayer.players[this.multiplayer.playerId] = { ...local, x: Math.round(this.player.x), y: Math.round(this.player.y), inventory: this.player.inventory || null };
    this.multiplayer.syncTimer = (this.multiplayer.syncTimer || 0) + dt;
    if (this.multiplayer.syncTimer >= 0.12) {
      this.multiplayer.syncTimer = 0;
      if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
    }
  }
  getMultiplayerSnapshot() {
    return { ...(this.multiplayer || {}), players: { ...(this.multiplayer?.players || {}) }, thrones: this.structures.filter(s => s.type === 'throne').map(s => ({ id: s.id, ref: s.ref, name: s.name, ownerId: s.ownerId, ownerLabel: s.ownerLabel, hp: s.hp, maxHp: s.maxHp, x: Math.round(s.x), y: Math.round(s.y) })) };
  }
  exportMultiplayerSave() { return { schema: 'orchestrator-grove-multiplayer-session-v1', exportedAt: new Date().toISOString(), session: this.getMultiplayerSnapshot(), state: this.getState() }; }

  updateMonster(monster, dt) {
    if (!monster || (monster.hp || 0) <= 0) return;
    const nearestStructure = this.nearestStructureToMonster(monster);
    const structureDistance = this.monsterStructureDistance(monster, nearestStructure);
    if (nearestStructure && structureDistance < monster.avoidRadius) {
      monster.wanderTarget = this.monsterTargetAwayFromStructure(monster, nearestStructure);
    } else if (!monster.wanderTarget || distXY(monster.x, monster.y, monster.wanderTarget.x, monster.wanderTarget.y) < 10) {
      monster.wanderTarget = this.pickMonsterWanderTarget(monster);
    } else if (distXY(monster.x, monster.y, monster.homeX, monster.homeY) > monster.roamRadius * 1.35) {
      monster.wanderTarget = { x: monster.homeX, y: monster.homeY };
    }
    const target = monster.wanderTarget;
    if (!target) return;
    const dx = target.x - monster.x, dy = target.y - monster.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const step = Math.min(len, monster.speed * dt);
    monster.x = clamp(monster.x + dx / len * step, 30, this.map.width - 30);
    monster.y = clamp(monster.y + dy / len * step, 30, this.map.height - 30);
  }

  update(dt) {
    this.updatePlayer(dt); this.updateProductionStructures(dt); this.updateRangedAttackStructures(dt); this.updateProjectiles(dt); this.updateAssistant(dt); for (const bot of this.bots) this.updateBot(bot, dt);
    for (const monster of this.monsters) this.updateMonster(monster, dt);
    this.updateMultiplayer(dt);
    for (const t of this.trees) this.updateTreeGrowth(t, dt);
    for (const r of this.rocks) if (r.depleted) { r.respawn -= dt; if (r.respawn <= 0) Object.assign(r, { depleted: false, hp: r.maxHp }); }
    for (const f of this.floaters) { f.y -= 18 * dt; f.life -= dt; } this.floaters = this.floaters.filter(f => f.life > 0);
    this.updateUI(dt);
  }
  updatePlayer(dt) {
    this.updateCamera(dt);
    const target = this.player.target;
    if (!target) return;
    if (target.started && ['search_tree', 'search_hemp', 'chop_hemp'].includes(target.action)) {
      const tree = target.action === 'search_tree' ? this.trees.find(t => t.id === target.resourceId && !t.stump) : null;
      const hemp = target.action !== 'search_tree' ? this.hempPlants.find(h => h.id === target.resourceId && !h.harvested) : null;
      if (target.action === 'search_tree' && (!tree || this.player.inventory)) { this.releasePlayerTargetReservation(); this.player.target = null; return; }
      if (target.action === 'search_hemp' && (!hemp || hemp.searched || this.player.inventory)) { this.releasePlayerTargetReservation(); this.player.target = null; return; }
      if (target.action === 'chop_hemp' && (!hemp || this.player.inventory?.type !== 'crude_axe')) { this.releasePlayerTargetReservation(); this.player.target = null; return; }
      target.remaining = Math.max(0, (target.remaining ?? target.total ?? TREE_SEARCH_SECONDS) - dt);
      if (target.remaining <= 0) {
        this.releasePlayerTargetReservation();
        this.player.target = null;
        if (target.action === 'search_tree') this.finishTreeSearch(tree);
        if (target.action === 'search_hemp') this.finishHempSearch(hemp);
        if (target.action === 'chop_hemp') this.finishHempChop(hemp);
      }
      return;
    }
    const d = distXY(this.player.x, this.player.y, target.x, target.y);
    const step = this.player.speed * dt;
    if (d <= Math.max(4, step)) {
      this.player.x = target.x;
      this.player.y = target.y;
      if (['search_tree', 'search_hemp', 'chop_hemp'].includes(target.action)) {
        if (target.action === 'search_tree') {
          const tree = this.trees.find(t => t.id === target.resourceId && !t.stump);
          if (!tree || this.player.inventory) { this.releasePlayerTargetReservation(); this.player.target = null; return; }
          if (!this.treeSearchAvailable(tree, 'player')) { this.player.target = null; this.addFloat('Tree already being searched', tree.x, tree.y - 34, '#c86b5f'); return; }
          tree.searchReservedBy = 'player';
          this.player.target = { ...target, started: true, remaining: TREE_SEARCH_SECONDS, total: TREE_SEARCH_SECONDS, processLabel: 'searching tree' };
          this.addFloat('Searching tree…', tree.x, tree.y - 34, '#d3a95f');
          return;
        }
        const hemp = this.hempPlants.find(h => h.id === target.resourceId && !h.harvested);
        if (!hemp) { this.player.target = null; return; }
        if (target.action === 'search_hemp') {
          if (this.player.inventory || hemp.searched) { this.player.target = null; this.addFloat(hemp.searched ? 'Hemp already searched' : 'Hands must be empty', hemp.x, hemp.y - 28, '#c86b5f'); return; }
          hemp.searchReservedBy = 'player';
          this.player.target = { ...target, started: true, remaining: HEMP_SEARCH_SECONDS, total: HEMP_SEARCH_SECONDS, processLabel: 'searching hemp' };
          this.addFloat('Searching hemp…', hemp.x, hemp.y - 28, '#d3a95f');
          return;
        }
        if (this.player.inventory?.type !== 'crude_axe') { this.player.target = null; this.addFloat('Need crude axe to chop hemp', hemp.x, hemp.y - 28, '#c86b5f'); return; }
        this.player.target = { ...target, started: true, remaining: HEMP_CHOP_SECONDS, total: HEMP_CHOP_SECONDS, processLabel: 'chopping hemp' };
        this.addFloat('Chopping hemp…', hemp.x, hemp.y - 28, '#d3a95f');
        return;
      }
      this.player.target = null;
      this.completePlayerTarget(target);
      return;
    }
    this.player.x = clamp(this.player.x + ((target.x - this.player.x) / d) * step, 20, this.map.width - 20);
    this.player.y = clamp(this.player.y + ((target.y - this.player.y) / d) * step, 20, this.map.height - 20);
  }
  updateAssistant(dt) { const tx = this.player.x - 30, ty = this.player.y + 24; this.moveToward(this.assistant, tx, ty, dt, 135, 28); }

  updateBot(bot, dt) {
    if (bot.paused) { bot.state = 'paused'; bot.message = `Paused ${bot.program} workflow.`; return; }
    bot.state = bot.program;
    if (bot.program === 'chop_wood') return this.programChopWood(bot, dt);
    if (bot.program === 'mine_stone') return this.programMineStone(bot, dt);
    if (bot.program === 'dig_holes') return this.programDigHoles(bot, dt);
    if (bot.program === 'pickup_item') return this.programPickupItem(bot, dt);
    if (bot.program === 'plant_trees') return this.programPlantTrees(bot, dt);
    if (bot.program === 'haul_logs') return this.programHaulLogs(bot, dt);
    if (bot.program === 'make_planks') return this.programMakePlanks(bot, dt);
    if (bot.program === 'make_poles') return this.programMakePoles(bot, dt);
    if (bot.program === 'haul_planks') return this.programHaulPlanks(bot, dt);
    if (bot.program === 'craft_axes') return this.programCraftAxes(bot, dt);
    if (bot.program === 'build_bots') return this.programBuildBots(bot, dt);
    if (bot.program === 'taught_loop') return this.programTaughtLoop(bot, dt);
    return this.programIdle(bot, dt);
  }
  programIdle(bot, dt) { this.releaseReservation(bot); const angle = (bot.id / Math.max(1,this.bots.length)) * Math.PI*2; const tx=115+Math.cos(angle)*42, ty=245+Math.sin(angle)*32; bot.message='Parked at idle depot.'; this.moveToward(bot, tx, ty, dt, bot.speed*0.6, 6); }
  programChopWood(bot, dt) {
    if (!this.ensureChopTool(bot, dt)) return;
    const zone = this.getBotZone(bot);
    let tree = this.isChoppableTree(bot.target) && this.objectInZone(bot.target, zone) ? bot.target : null;
    if (!tree) { tree = nearest(this.trees, bot.x, bot.y, t => this.isChoppableTree(t) && this.objectInZone(t, zone)); bot.target = tree; }
    if (!tree) return bot.message=`No living trees in ${this.zoneLabel(zone)}.`;
    if (!this.moveBotTo(bot, tree, dt, tree.radius + 14)) return bot.message=`Walking to tree in ${this.zoneLabel(zone)} with ${itemLabel(bot.tool.type)}.`;
    bot.timer += dt; bot.message = `Chopping with ${itemLabel(bot.tool.type)} (${Math.ceil(bot.timer*2)}/2).`;
    if (bot.timer >= 1) {
      bot.timer=0; tree.hp--; bot.tool.durability--; this.spawnItem('log', tree.x, tree.y, 1);
      if (bot.tool.durability <= 0) { this.addFloat(`${itemLabel(bot.tool.type)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.tool = null; }
      if (tree.hp <= 0) { tree.stump = true; tree.regrow = 0; bot.target = null; this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); }
    }
  }
  ensureChopTool(bot, dt) {
    if (bot.tool?.type === 'crude_axe') return true;
    if (bot.tool && bot.tool.type !== 'crude_axe') { bot.message = `Holding ${itemLabel(bot.tool.type)}; needs crude axe to chop.`; return false; }
    let item = bot.targetItemPurpose === 'tool' && bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === 'crude_axe') : null;
    if (!item) {
      item = nearest(this.items, bot.x, bot.y, i => i.type === 'crude_axe' && (!i.reservedBy || i.reservedBy === bot.id));
      if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'tool'; bot.target = null; }
    }
    if (!item) { bot.message = `Needs crude axe lying on the map to chop.`; return false; }
    if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Fetching ${itemLabel(item.type)} for chopping.`; return false; }
    bot.tool = { type: item.type, durability: AXE_DURABILITY };
    this.items = this.items.filter(i => i.id !== item.id);
    bot.targetItemId = null; bot.targetItemPurpose = null;
    bot.message = `Equipped ${itemLabel(bot.tool.type)}.`;
    return true;
  }
  ensureMineTool(bot, dt) {
    if (bot.tool?.type === 'crude_pickaxe') return true;
    if (bot.tool && bot.tool.type !== 'crude_pickaxe') { bot.message = `Holding ${itemLabel(bot.tool.type)}; needs crude pickaxe to mine stone.`; return false; }
    let item = bot.targetItemPurpose === 'tool' && bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === 'crude_pickaxe') : null;
    if (!item) {
      item = nearest(this.items, bot.x, bot.y, i => i.type === 'crude_pickaxe' && (!i.reservedBy || i.reservedBy === bot.id));
      if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'tool'; bot.target = null; }
    }
    if (!item) { bot.message = 'Needs crude pickaxe lying on the map to mine stone.'; return false; }
    if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Fetching ${itemLabel(item.type)} for mining.`; return false; }
    bot.tool = { type: item.type, durability: PICKAXE_DURABILITY };
    this.items = this.items.filter(i => i.id !== item.id);
    bot.targetItemId = null; bot.targetItemPurpose = null;
    bot.message = `Equipped ${itemLabel(bot.tool.type)}.`;
    return true;
  }
  programMineStone(bot, dt) {
    if (!this.ensureMineTool(bot, dt)) return;
    const zone = this.getBotZone(bot);
    let rock = bot.target?.type === 'stone_deposit' && !bot.target.depleted && this.objectInZone(bot.target, zone) ? bot.target : null;
    if (!rock) { rock = nearest(this.rocks, bot.x, bot.y, r => !r.depleted && this.objectInZone(r, zone)); bot.target = rock; }
    if (!rock) return bot.message = `No stone deposits in ${this.zoneLabel(zone)}.`;
    if (!this.moveBotTo(bot, rock, dt, rock.radius + 14)) return bot.message = `Walking to stone deposit in ${this.zoneLabel(zone)} with ${itemLabel(bot.tool.type)}.`;
    bot.timer += dt; bot.message = `Mining stone with ${itemLabel(bot.tool.type)} (${Math.ceil(bot.timer*2)}/2).`;
    if (bot.timer >= 1) {
      bot.timer = 0; rock.hp--; bot.tool.durability--; this.spawnItem('stone', rock.x, rock.y, 1);
      if (bot.tool.durability <= 0) { this.addFloat(`${itemLabel(bot.tool.type)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.tool = null; }
      if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; bot.target = null; this.addFloat('Stone deposit depleted', rock.x, rock.y - 24, '#9aa09d'); }
    }
  }
  ensureDigTool(bot, dt) {
    if (bot.tool?.type === 'crude_shovel') return true;
    if (bot.tool && bot.tool.type !== 'crude_shovel') { bot.message = `Holding ${itemLabel(bot.tool.type)}; needs crude shovel to dig.`; return false; }
    let item = bot.targetItemPurpose === 'tool' && bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === 'crude_shovel') : null;
    if (!item) {
      item = nearest(this.items, bot.x, bot.y, i => i.type === 'crude_shovel' && (!i.reservedBy || i.reservedBy === bot.id));
      if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'tool'; bot.target = null; }
    }
    if (!item) { bot.message = 'Needs crude shovel lying on the map to dig.'; return false; }
    if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Fetching ${itemLabel(item.type)} for digging.`; return false; }
    bot.tool = { type: item.type, durability: SHOVEL_DURABILITY };
    this.items = this.items.filter(i => i.id !== item.id);
    bot.targetItemId = null; bot.targetItemPurpose = null;
    bot.message = `Equipped ${itemLabel(bot.tool.type)}.`;
    return true;
  }
  digBoundsForZone(zone, from) {
    if (!zone) return { x: clamp(from.x - 120, 0, this.map.width - 1), y: clamp(from.y - 120, 0, this.map.height - 1), w: 240, h: 240 };
    if (zone.kind === 'radius') {
      const s = this.structures.find(st => st.id === zone.centerStructureId);
      const c = s || from, r = zone.radius || 120;
      return { x: clamp(c.x - r, 0, this.map.width - 1), y: clamp(c.y - r, 0, this.map.height - 1), w: Math.min(r * 2, this.map.width), h: Math.min(r * 2, this.map.height) };
    }
    return zone;
  }
  isDiggable(x, y, clearance = 28) {
    if (this.holes.some(h => distXY(x, y, h.x, h.y) < clearance)) return false;
    if (this.structures.some(s => rectDistance(x, y, s) < clearance)) return false;
    if (this.trees.some(t => !t.stump && distXY(x, y, t.x, t.y) < t.radius + clearance)) return false;
    if (this.rocks.some(r => !r.depleted && distXY(x, y, r.x, r.y) < r.radius + clearance)) return false;
    return x >= 12 && y >= 12 && x <= this.map.width - 12 && y <= this.map.height - 12;
  }
  findDigSpot(bot) {
    const zone = this.getBotZone(bot);
    const b = this.digBoundsForZone(zone, bot);
    const step = 36;
    const spots = [];
    for (let y = b.y + step / 2; y <= b.y + b.h - step / 2; y += step) {
      for (let x = b.x + step / 2; x <= b.x + b.w - step / 2; x += step) {
        if (this.pointInZone(x, y, zone) && this.isDiggable(x, y)) spots.push({ kind: 'dig_spot', x, y });
      }
    }
    return nearest(spots, bot.x, bot.y);
  }
  programDigHoles(bot, dt) {
    if (!this.ensureDigTool(bot, dt)) return;
    const zone = this.getBotZone(bot);
    let spot = bot.target?.kind === 'dig_spot' && this.pointInZone(bot.target.x, bot.target.y, zone) && this.isDiggable(bot.target.x, bot.target.y) ? bot.target : null;
    if (!spot) { spot = this.findDigSpot(bot); bot.target = spot; bot.timer = 0; }
    if (!spot) return bot.message = `No open dirt to dig in ${this.zoneLabel(zone)}.`;
    if (!this.moveBotTo(bot, spot, dt, 12)) return bot.message = `Walking to dig spot in ${this.zoneLabel(zone)} with ${itemLabel(bot.tool.type)}.`;
    bot.timer += dt; bot.message = `Digging hole with ${itemLabel(bot.tool.type)} (${Math.ceil(bot.timer*2)}/2).`;
    if (bot.timer >= 1) {
      bot.timer = 0; bot.tool.durability--; this.spawnHole(spot.x, spot.y); this.addFloat('Dug hole', spot.x, spot.y - 16, '#6b4a28'); bot.target = null;
      if (bot.tool.durability <= 0) { this.addFloat(`${itemLabel(bot.tool.type)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.tool = null; }
    }
  }
  programPickupItem(bot, dt) {
    const type = this.normalizeItemType(bot.pickupItemType, 'log');
    if (bot.inventory?.type === type) { bot.message = `Holding ${itemLabel(type)} from pickup loop.`; return; }
    if (bot.inventory) { bot.message = `Holding ${itemLabel(bot.inventory.type)}; empty hands needed for ${itemLabel(type)}.`; return; }
    if (bot.sourcePaletteId && this.takeFromPalette(bot, type, dt, bot.sourcePaletteId)) return;
    if (bot.sourcePaletteId) return;
    this.takeLooseItem(bot, type, dt);
  }
  programPlantTrees(bot, dt) {
    const zone = this.getBotZone(bot);
    if (!bot.inventory) { this.takeLooseItem(bot, 'tree_seed', dt); return; }
    if (bot.inventory.type !== 'tree_seed') { bot.message = `Holding ${itemLabel(bot.inventory.type)}; needs tree seed for planting.`; return; }
    let hole = bot.targetHoleId ? this.holes.find(h => h.id === bot.targetHoleId && this.openHoleInZone(h, zone) && (!h.reservedBy || h.reservedBy === bot.id)) : null;
    if (!hole) {
      hole = this.nearestOpenHole(bot.x, bot.y, zone, Infinity, bot.id);
      if (hole) { hole.reservedBy = bot.id; bot.targetHoleId = hole.id; bot.target = hole; }
    }
    if (!hole) return bot.message = `No open dug holes in ${this.zoneLabel(zone)}.`;
    if (!this.moveBotTo(bot, hole, dt, 12)) return bot.message = `Carrying tree seed to hole in ${this.zoneLabel(zone)}.`;
    this.plantSeedInHole(hole, bot);
    bot.inventory = null;
    bot.target = null;
    bot.message = `Planted tree seed in ${this.zoneLabel(zone)}.`;
  }
  takeFromPalette(bot, type, dt, sourceId = null) {
    const palette = sourceId ? this.nearestStructure('item_palette', bot.x, bot.y, sourceId) : nearest(this.structures, bot.x, bot.y, s => s.type === 'item_palette' && s.storageType === type && s.stored > 0);
    if (!palette) { bot.message = `No item palette with ${itemLabel(type)}.`; return false; }
    if (palette.storageType !== type || palette.stored <= 0) { bot.message = `${palette.name} has no ${itemLabel(type)}.`; return false; }
    if (!this.moveBotTo(bot, palette, dt, 34)) { bot.message = `Picking up ${itemLabel(type)} from ${palette.name}.`; return false; }
    palette.stored--; if (palette.stored <= 0) { palette.stored = 0; palette.storageType = null; }
    bot.inventory = { type, count: 1 }; bot.message = `Picked up ${itemLabel(type)} from ${palette.name}.`; return true;
  }
  findItemFor(bot, type) {
    const zone = this.getBotZone(bot);
    return nearest(this.items, bot.x, bot.y, i => i.type === type && (!i.reservedBy || i.reservedBy === bot.id) && this.objectInZone(i, zone));
  }
  findItemNearStructureFor(bot, type, structure, radius = PRODUCTION_SOURCE_RADIUS) {
    const zone = this.getBotZone(bot);
    return nearest(this.items, bot.x, bot.y, i => i.type === type && (!i.reservedBy || i.reservedBy === bot.id) && rectDistance(i.x, i.y, structure) <= radius && this.objectInZone(i, zone));
  }
  pickItem(bot, item) { bot.inventory = { type: item.type, count: 1 }; this.items = this.items.filter(i => i.id !== item.id); bot.targetItemId = null; bot.targetItemPurpose = null; bot.target = null; }
  productionDuration(s, recipe) { return BUILDING_TYPES[s.type]?.processingDurations?.[recipe] ?? PRODUCTION_DEFAULTS[s.type]?.[recipe] ?? 1; }
  isStructureProcessing(s) { return !!s?.processing && s.processing.remaining > 0; }
  setWorkbenchRecipe(s, recipe) {
    if (!s || s.type !== 'workbench' || !WORKBENCH_TOOL_RECIPES.includes(recipe)) return false;
    if (this.isStructureProcessing(s)) { this.addFloat(`${s.name} is processing; output stays ${itemLabel(workbenchRecipe(s))}`, s.x, s.y - 35, '#c7b683'); return false; }
    s.workbenchRecipe = recipe;
    this.addFloat(`${s.name}: produce ${itemLabel(recipe)}`, s.x, s.y - 35, '#d3a95f');
    return true;
  }
  setSmitheryRecipe(s, recipe) {
    if (!s || s.type !== 'smithery' || !SMITHERY_RECIPES.includes(recipe)) return false;
    if (this.isStructureProcessing(s)) { this.addFloat(`${s.name} is processing; output stays ${itemLabel(smitheryRecipe(s))}`, s.x, s.y - 35, '#c7b683'); return false; }
    s.smitheryRecipe = recipe;
    this.addFloat(`${s.name}: produce ${itemLabel(recipe)}`, s.x, s.y - 35, '#d3a95f');
    return true;
  }
  switchSmitheryRecipe(s) {
    const next = smitheryRecipe(s) === 'wooden_sword' ? 'wooden_shield' : 'wooden_sword';
    return this.setSmitheryRecipe(s, next);
  }
  canStructureAcceptItem(s, type) {
    if (!s || !type || this.isStructureProcessing(s)) return false;
    if (s.type === 'sawbench') return ['log', 'plank'].includes(type);
    if (s.type === 'workbench') return ['stick', 'stone'].includes(type);
    if (s.type === 'smithery') return type === smitheryInputFor(smitheryRecipe(s));
    if (s.type === 'bowmaker') return Object.prototype.hasOwnProperty.call(BOW_RECIPE, type) && ((s[`${type}s`] ?? s[type] ?? 0) < BOW_RECIPE[type]);
    if (s.type === 'factory') return Object.prototype.hasOwnProperty.call(FACTORY_BOT_RECIPE, type);
    return false;
  }
  depositHeldItemToStructure(s, type) {
    if (!s || !type) return false;
    if (this.isStructureProcessing(s)) return false;
    if (!this.canStructureAcceptItem(s, type)) { this.addFloat(`${s.name} cannot take ${itemLabel(type)}`, s.x, s.y - 35, '#c86b5f'); return false; }
    if (s.type === 'sawbench') {
      if (type === 'log') s.logs++;
      if (type === 'plank') s.planks++;
      this.addFloat(`+ ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
      return true;
    }
    if (s.type === 'workbench') {
      if (type === 'stick') s.sticks++;
      if (type === 'stone') s.stones++;
      this.addFloat(`${s.name}: ${s.sticks} sticks, ${s.stones} stones`, s.x, s.y - 35, '#d3a95f');
      return true;
    }
    if (s.type === 'smithery') {
      if (type === 'stick') s.sticks++;
      if (type === 'plank') s.planks++;
      this.addFloat(`+ ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
      return true;
    }
    if (s.type === 'bowmaker') {
      const key = `${type}s` in s ? `${type}s` : type;
      s[key]++;
      this.addFloat(`${s.name}: ${s.sticks || 0}/2 sticks, ${s.hemps || 0}/3 hemp`, s.x, s.y - 35, '#d3a95f');
      return true;
    }
    if (s.type === 'factory') {
      const key = `${type}s` in s ? `${type}s` : type;
      s[key]++;
      this.addFloat(`+ ${itemLabel(type)}`, s.x, s.y - 35, '#d3a95f');
      return true;
    }
    return false;
  }
  depositToSawbench(s, type) { return this.depositHeldItemToStructure(s, type); }
  startStructureProcessing(s, recipe, label) {
    s.processing = { recipe, label, remaining: this.productionDuration(s, recipe), total: this.productionDuration(s, recipe) };
    this.addFloat(`${s.name}: ${label}`, s.x, s.y - 35, '#c7b683');
  }
  maybeStartStructureProcessing(s) {
    if (this.isStructureProcessing(s)) return;
    if (s.type === 'sawbench') {
      if (s.logs > 0) { s.logs--; this.startStructureProcessing(s, 'log', 'sawing log'); return; }
      if (s.planks > 0) { s.planks--; this.startStructureProcessing(s, 'plank', 'shaping pole'); return; }
    }
    if (s.type === 'workbench' && s.sticks >= 1 && s.stones >= 1) {
      const recipe = workbenchRecipe(s);
      s.sticks--; s.stones--; this.startStructureProcessing(s, recipe, `crafting ${itemLabel(recipe)}`); return;
    }
    if (s.type === 'smithery') {
      const recipe = smitheryRecipe(s);
      const input = smitheryInputFor(recipe);
      const key = input === 'stick' ? 'sticks' : 'planks';
      if ((s[key] || 0) > 0) { s[key]--; this.startStructureProcessing(s, recipe, `crafting ${itemLabel(recipe)}`); return; }
    }
    if (s.type === 'bowmaker' && Object.entries(BOW_RECIPE).every(([type, cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost)) {
      for (const [type, cost] of Object.entries(BOW_RECIPE)) { const key = `${type}s` in s ? `${type}s` : type; s[key] -= cost; }
      this.startStructureProcessing(s, 'bow', 'binding bow');
      return;
    }
    if (s.type === 'factory' && Object.entries(FACTORY_BOT_RECIPE).every(([type, cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost)) {
      for (const [type, cost] of Object.entries(FACTORY_BOT_RECIPE)) { const key = `${type}s` in s ? `${type}s` : type; s[key] -= cost; }
      this.startStructureProcessing(s, 'basic_bot', 'assembling bot');
    }
  }
  finishStructureProcessing(s, job) {
    if (s.type === 'sawbench' && job.recipe === 'log') { this.dropProducedItem(s, 'plank', 2); this.addFloat('+2 planks dropped', s.x, s.y - 35, '#d3a95f'); return; }
    if (s.type === 'sawbench' && job.recipe === 'plank') { this.dropProducedItem(s, 'pole', 2); this.addFloat('+2 wood poles dropped', s.x, s.y - 35, '#c7b683'); return; }
    if (s.type === 'workbench' && WORKBENCH_TOOL_RECIPES.includes(job.recipe)) {
      const key = job.recipe === 'crude_pickaxe' ? 'pickaxes' : job.recipe === 'crude_shovel' ? 'shovels' : 'axes';
      s[key]++;
      this.dropProducedItem(s, job.recipe, 1);
      this.addFloat(`+ ${itemLabel(job.recipe)} dropped`, s.x, s.y - 35, '#d3a95f');
      return;
    }
    if (s.type === 'smithery' && SMITHERY_RECIPES.includes(job.recipe)) {
      const key = job.recipe === 'wooden_shield' ? 'shields' : 'swords';
      s[key]++;
      this.dropProducedItem(s, job.recipe, 1);
      this.addFloat(`+ ${itemLabel(job.recipe)} dropped`, s.x, s.y - 35, '#d3a95f');
      return;
    }
    if (s.type === 'bowmaker' && job.recipe === 'bow') { s.bows++; this.dropProducedItem(s, 'bow', 1); this.addFloat('+ bow dropped', s.x, s.y - 35, '#d3a95f'); return; }
    if (s.type === 'factory' && job.recipe === 'basic_bot') { const nb = this.createBot(s.x + rand(-30, 30), s.y + 72, 'idle'); if (nb) this.addChat?.('assistant', `Factory created Basic Bot ${nb.id}.`); }
  }
  updateProductionStructures(dt) {
    for (const s of this.structures) {
      if (!['sawbench', 'workbench', 'factory', 'smithery', 'bowmaker'].includes(s.type)) continue;
      if (this.isStructureProcessing(s)) {
        s.processing.remaining -= dt;
        if (s.processing.remaining <= 0) { const job = s.processing; s.processing = null; this.finishStructureProcessing(s, job); }
      }
      if (!this.isStructureProcessing(s)) this.maybeStartStructureProcessing(s);
    }
  }
  programHaulLogs(bot, dt) {
    const zone = this.getBotZone(bot);
    if (bot.inventory?.type === 'log') { const s = this.nearestStructure('sawbench', bot.x, bot.y, bot.targetStructureId); if (!s) return bot.message='No sawbench.'; if (!this.moveBotTo(bot, s, dt, 32)) return bot.message=`Delivering log to ${s.name}.`; this.depositToSawbench(s, 'log'); bot.inventory=null; bot.message=`Delivered log to ${s.name}.`; return; }
    let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && this.objectInZone(i, zone)) : null;
    if (!item) { item = this.findItemFor(bot,'log'); if (item) { item.reservedBy=bot.id; bot.targetItemId=item.id; } }
    if (!item) return bot.message=`Waiting for loose logs in ${this.zoneLabel(zone)}.`;
    if (!this.moveBotTo(bot,item,dt,12)) return bot.message=`Picking up log in ${this.zoneLabel(zone)}.`;
    this.pickItem(bot,item);
  }
  programTaughtLoop(bot, dt) {
    const steps = bot.taughtLoop || [];
    if (!steps.length) { bot.message = 'No taught loop assigned.'; return; }
    if (bot.runtime.pc >= steps.length) bot.runtime.pc = 0;
    const step = steps[bot.runtime.pc] || steps[0];
    const advance = () => { this.releaseReservation(bot); bot.runtime.pc = (bot.runtime.pc + 1) % steps.length; bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0; };
    if (step.op === 'pick_up' || step.op === 'pick_up_from_storage') {
      if (bot.inventory?.type === step.type) { advance(); return; }
      if (step.op === 'pick_up_from_storage') { const s = this.resolveRecordedStructure(step, bot); if (s && this.takeStoredItemFromStructure(bot, s, step.type, dt)) { advance(); return; } if (s) { bot.message = `Taught loop waiting for ${itemLabel(step.type)} in ${s.name}.`; return; } }
      const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
      let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === step.type && this.objectInZone(i, zone)) : null;
      if (!item) { item = nearest(this.items, bot.x, bot.y, i => i.type === step.type && this.objectInZone(i, zone) && (!i.reservedBy || i.reservedBy === bot.id)); if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'taught_loop'; } }
      if (!item) { bot.message = `Taught loop waiting for loose ${itemLabel(step.type)}.`; return; }
      if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Taught loop: pick_up ${itemLabel(step.type)}.`; return; }
      this.pickItem(bot, item); bot.message = `Taught loop picked up ${itemLabel(step.type)}.`; advance(); return;
    }
    if (step.op === 'move_to_structure') {
      const s = this.resolveRecordedStructure(step, bot);
      if (!s) { bot.message = `Taught loop cannot find ${step.structureName || 'structure'}.`; return; }
      if (!this.moveBotTo(bot, s, dt, 32)) { bot.message = `Taught loop: move_to ${s.name}.`; return; }
      bot.message = `Taught loop reached ${s.name}.`; advance(); return;
    }
    if (step.op === 'deposit_to_structure') {
      const s = this.resolveRecordedStructure(step, bot);
      if (!s) { bot.message = `Taught loop cannot find ${step.structureName || 'structure'}.`; return; }
      if (!bot.inventory || bot.inventory.type !== step.type) { bot.message = `Taught loop needs ${itemLabel(step.type)} before depositing.`; bot.runtime.pc = 0; return; }
      if (!this.moveBotTo(bot, s, dt, 32)) { bot.message = `Taught loop: deposit ${itemLabel(step.type)} into ${s.name}.`; return; }
      if (!this.depositHeldItemToStructure(s, step.type)) { bot.message = this.isStructureProcessing(s) ? `Taught loop waiting for ${s.name} to finish.` : `${s.name} cannot take ${itemLabel(step.type)}.`; return; }
      bot.inventory = null; bot.message = `Taught loop deposited ${itemLabel(step.type)} into ${s.name}.`; advance(); return;
    }
    if (step.op === 'plant_seed') {
      if (!bot.inventory || bot.inventory.type !== 'tree_seed') { bot.message = 'Taught loop needs tree seed before planting.'; bot.runtime.pc = 0; return; }
      let hole = step.holeId ? this.holes.find(h => h.id === step.holeId && !h.planted) : null;
      if (!hole) hole = this.nearestOpenHole(bot.x, bot.y, null, Infinity, bot.id);
      if (!hole) { bot.message = 'Taught loop waiting for an open dug hole.'; return; }
      if (!this.moveBotTo(bot, hole, dt, 12)) { bot.message = 'Taught loop: plant tree seed in dug hole.'; return; }
      this.plantSeedInHole(hole, bot); bot.inventory = null; bot.message = 'Taught loop planted tree seed.'; advance(); return;
    }
    if (step.op === 'chop_tree') {
      if (!this.ensureChopTool(bot, dt)) return;
      const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
      let tree = bot.target && this.isChoppableTree(bot.target) && this.objectInZone(bot.target, zone) ? bot.target : null;
      if (!tree && step.treeId) tree = this.trees.find(t => t.id === step.treeId && this.isChoppableTree(t) && this.objectInZone(t, zone)) || null;
      if (!tree) tree = nearest(this.trees, bot.x, bot.y, t => this.isChoppableTree(t) && this.objectInZone(t, zone));
      if (!tree) { bot.message = `Taught loop waiting for a grown tree in ${this.zoneLabel(zone)}.`; return; }
      bot.target = tree;
      if (!this.moveBotTo(bot, tree, dt, tree.radius + 14)) { bot.message = `Taught loop: move to tree in ${this.zoneLabel(zone)}.`; return; }
      tree.hp--; this.spawnItem('log', tree.x, tree.y, 1); bot.tool.durability--; if (tree.hp <= 0) { tree.stump = true; tree.regrow = 0; this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); advance(); } return;
    }
    if (step.op === 'search_tree') {
      const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
      let tree = bot.target && this.treeSearchAvailable(bot.target, bot.id) && this.objectInZone(bot.target, zone) ? bot.target : null;
      if (!tree && step.treeId) tree = this.trees.find(t => t.id === step.treeId && this.treeSearchAvailable(t, bot.id) && this.objectInZone(t, zone)) || null;
      if (!tree) tree = nearest(this.trees, bot.x, bot.y, t => this.treeSearchAvailable(t, bot.id) && this.objectInZone(t, zone));
      if (!tree) { bot.message = `Taught loop waiting for an unsearched tree in ${this.zoneLabel(zone)}.`; return; }
      tree.searchReservedBy = bot.id;
      bot.target = tree;
      if (!this.moveBotTo(bot, tree, dt, tree.radius + 14)) { bot.message = 'Taught loop: move to tree and search for sticks/seeds.'; return; }
      bot.timer += dt;
      bot.message = `Searching tree for sticks/seeds (${Math.ceil(bot.timer)}/${Math.ceil(TREE_SEARCH_SECONDS)}).`;
      if (bot.timer >= TREE_SEARCH_SECONDS) { this.dropTreeSearchFinds(tree); this.addFloat('Found stick + seed', tree.x, tree.y - 34, '#d3a95f'); advance(); }
      return;
    }
    if (step.op === 'chop_hemp' || step.op === 'search_hemp') {
      const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
      if (step.op === 'chop_hemp' && !this.ensureChopTool(bot, dt)) return;
      if (step.op === 'search_hemp' && bot.inventory) { bot.message = `Taught loop needs empty hands to search hemp.`; return; }
      let hemp = bot.target && !bot.target.harvested && this.objectInZone(bot.target, zone) ? bot.target : null;
      if (!hemp && step.hempId) hemp = this.hempPlants.find(h => h.id === step.hempId && !h.harvested && this.objectInZone(h, zone)) || null;
      if (!hemp) hemp = nearest(this.hempPlants, bot.x, bot.y, h => !h.harvested && this.objectInZone(h, zone) && (step.op === 'chop_hemp' || !h.searched));
      if (!hemp) { bot.message = `Taught loop waiting for hemp in ${this.zoneLabel(zone)}.`; return; }
      bot.target = hemp;
      if (!this.moveBotTo(bot, hemp, dt, (hemp.radius || 14) + 12)) { bot.message = step.op === 'chop_hemp' ? 'Taught loop: move to hemp with axe.' : 'Taught loop: move to hemp and search.'; return; }
      bot.timer += dt;
      const total = step.op === 'chop_hemp' ? HEMP_CHOP_SECONDS : HEMP_SEARCH_SECONDS;
      bot.message = `${step.op === 'chop_hemp' ? 'Chopping' : 'Searching'} hemp (${Math.ceil(bot.timer)}/${Math.ceil(total)}).`;
      if (bot.timer >= total) {
        if (step.op === 'chop_hemp') { hemp.harvested = true; this.hempPlants = this.hempPlants.filter(h => h.id !== hemp.id); this.spawnItem('hemp', hemp.x, hemp.y, 1); this.spawnItem('hemp_seed', hemp.x, hemp.y, 1); }
        else { hemp.searched = true; this.spawnItem('hemp_seed', hemp.x, hemp.y, 1); }
        advance();
      }
      return;
    }
    if (step.op === 'mine_stone') {
      if (!this.ensureMineTool(bot, dt)) return;
      const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
      let rock = bot.target?.type === 'stone_deposit' && !bot.target.depleted && this.objectInZone(bot.target, zone) ? bot.target : null;
      if (!rock && step.rockId) rock = this.rocks.find(r => r.id === step.rockId && !r.depleted && this.objectInZone(r, zone)) || null;
      if (!rock) rock = nearest(this.rocks, bot.x, bot.y, r => !r.depleted && this.objectInZone(r, zone));
      if (!rock) { bot.message = `Taught loop waiting for a stone deposit in ${this.zoneLabel(zone)}.`; return; }
      bot.target = rock;
      if (!this.moveBotTo(bot, rock, dt, rock.radius + 14)) { bot.message = `Taught loop: move to stone deposit in ${this.zoneLabel(zone)}.`; return; }
      rock.hp--; this.spawnItem('stone', rock.x, rock.y, 1); bot.tool.durability--; if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; advance(); } return;
    }
    advance();
  }
  programMakePlanks(bot, dt) {
    const s = this.nearestStructure('sawbench', bot.x, bot.y, bot.targetStructureId);
    if (!s) return bot.message='No sawbench.';
    if (!this.moveBotTo(bot, s, dt, 34)) return bot.message=`Going to ${s.name}.`;
    if (this.isStructureProcessing(s)) return bot.message = `${s.name} is processing ${s.processing.label}.`;
    if (s.logs <= 0) return bot.message=`${s.name} needs logs.`;
    this.maybeStartStructureProcessing(s);
    bot.message=`Started sawing logs at ${s.name}.`;
  }
  programMakePoles(bot, dt) {
    const s = this.nearestStructure('sawbench', bot.x, bot.y, bot.targetStructureId);
    if (!s) return bot.message='No sawbench.';
    if (!bot.inventory) { this.takePlankSource(bot, dt); return; }
    if (bot.inventory.type !== 'plank') return bot.message=`Holding ${itemLabel(bot.inventory.type)}; needs plank for ${s.name}.`;
    if (!this.moveBotTo(bot, s, dt, 34)) return bot.message=`Putting plank into ${s.name}.`;
    if (!this.depositToSawbench(s, 'plank')) { bot.message = this.isStructureProcessing(s) ? `${s.name} is processing; waiting to add plank.` : `${s.name} cannot take plank.`; return; }
    bot.inventory = null;
    bot.message = `Delivered plank to ${s.name} for pole production.`;
  }
  takePlankSource(bot, dt) {
    const explicitSource = Boolean(bot.sourceStructureId);
    const sourceId = bot.sourceStructureId || bot.targetStructureId;
    const saw = sourceId ? this.nearestStructure('sawbench', bot.x, bot.y, sourceId) : null;
    if (saw && this.takeLooseItemNearStructure(bot, 'plank', dt, saw)) return true;
    if (saw && explicitSource) return false;
    return this.takeLooseItem(bot, 'plank', dt);
  }
  takePoleSource(bot, dt) {
    const explicitSource = Boolean(bot.sourceStructureId);
    const sourceId = bot.sourceStructureId || bot.targetStructureId;
    const saw = sourceId ? this.nearestStructure('sawbench', bot.x, bot.y, sourceId) : null;
    if (saw && this.takeLooseItemNearStructure(bot, 'pole', dt, saw)) return true;
    if (saw && explicitSource) return false;
    return this.takeLooseItem(bot, 'pole', dt);
  }
  takeLogSource(bot, dt) {
    const saw = bot.sourceStructureId ? this.nearestStructure('sawbench', bot.x, bot.y, bot.sourceStructureId) : null;
    if (saw) return this.takeLooseItemNearStructure(bot, 'log', dt, saw);
    return this.takeLooseItem(bot, 'log', dt);
  }
  takeLooseItemNearStructure(bot, type, dt, structure, radius = PRODUCTION_SOURCE_RADIUS) {
    let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === type && rectDistance(i.x, i.y, structure) <= radius && this.objectInZone(i, this.getBotZone(bot))) : null;
    if (!item) { item = this.findItemNearStructureFor(bot, type, structure, radius); if (item) { item.reservedBy=bot.id; bot.targetItemId=item.id; bot.targetItemPurpose='production_radius'; } }
    if (!item) { bot.message=`Waiting for loose ${itemLabel(type)}s around ${structure.name}.`; return false; }
    if (!this.moveBotTo(bot,item,dt,12)) { bot.message=`Picking up loose ${itemLabel(type)} near ${structure.name}.`; return false; }
    this.pickItem(bot,item); return true;
  }
  takeLooseItem(bot, type, dt) {
    let item = bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === type && this.objectInZone(i, this.getBotZone(bot))) : null;
    if (!item) { item = this.findItemFor(bot,type); if (item) { item.reservedBy=bot.id; bot.targetItemId=item.id; bot.targetItemPurpose='haul'; } }
    if (!item) { bot.message=`Waiting for ${itemLabel(type)}s in ${this.zoneLabel(this.getBotZone(bot))}.`; return false; }
    if (!this.moveBotTo(bot,item,dt,12)) { bot.message=`Picking up ${itemLabel(type)}.`; return false; }
    this.pickItem(bot,item); return true;
  }
  takeFactoryResource(bot, type, dt) {
    if (type === 'log') return this.takeLogSource(bot, dt);
    if (type === 'plank') return this.takePlankSource(bot, dt);
    if (type === 'pole') return this.takePoleSource(bot, dt);
    return this.takeLooseItem(bot, type, dt);
  }
  programHaulPlanks(bot, dt) { if (!bot.inventory) { this.takePlankSource(bot, dt); return; } const f = this.nearestStructure('factory', bot.x, bot.y, bot.targetFactoryId); if (!f) return bot.message='No factory.'; if (!this.moveBotTo(bot, f, dt, 36)) return bot.message=`Delivering plank to ${f.name}.`; f.planks++; bot.inventory=null; bot.message=`Delivered plank to ${f.name}.`; }
  programCraftAxes(bot, dt) {
    const w = this.nearestStructure('workbench', bot.x, bot.y, bot.targetWorkbenchId); if (!w) return bot.message='No crude tool bench.';
    if (bot.inventory?.type === 'stick' || bot.inventory?.type === 'stone') { if (!this.moveBotTo(bot, w, dt, 34)) return bot.message=`Supplying ${itemLabel(bot.inventory.type)} to ${w.name}.`; if (bot.inventory.type === 'stick') w.sticks++; else w.stones++; bot.inventory=null; bot.message=`Delivered material to ${w.name}.`; return; }
    if (this.isStructureProcessing(w) || (w.sticks >= 1 && w.stones >= 1)) { if (!this.moveBotTo(bot, w, dt, 34)) return bot.message=`Going to craft at ${w.name}.`; this.maybeStartStructureProcessing(w); bot.message = this.isStructureProcessing(w) ? `${w.name} is crafting ${w.processing.label}.` : `${w.name} needs materials.`; return; }
    const needed = w.sticks < 1 ? 'stick' : 'stone';
    this.takeLooseItem(bot, needed, dt);
  }
  programBuildBots(bot, dt) {
    const f = this.nearestStructure('factory', bot.x, bot.y, bot.targetFactoryId); if (!f) return bot.message='No factory.';
    const ready = Object.entries(FACTORY_BOT_RECIPE).every(([type, cost]) => (f[`${type}s`] ?? f[type] ?? 0) >= cost);
    if (ready || this.isStructureProcessing(f)) { if (!this.moveBotTo(bot, f, dt, 38)) return bot.message=`Assembling bot at ${f.name}.`; this.maybeStartStructureProcessing(f); bot.message = this.isStructureProcessing(f) ? `${f.name} is assembling a bot.` : `${f.name} needs materials.`; return; }
    if (bot.inventory && FACTORY_BOT_RECIPE[bot.inventory.type]) { if (!this.moveBotTo(bot, f, dt, 36)) return bot.message=`Supplying ${itemLabel(bot.inventory.type)} to ${f.name}.`; const key = `${bot.inventory.type}s` in f ? `${bot.inventory.type}s` : bot.inventory.type; f[key]++; bot.inventory=null; return; }
    const missing = Object.entries(FACTORY_BOT_RECIPE).find(([type, cost]) => (f[`${type}s`] ?? f[type] ?? 0) < cost)?.[0];
    if (missing) this.takeFactoryResource(bot, missing, dt);
  }

  acceptNearestItemForPalette(palette) {
    const item = nearest(this.items, palette.x, palette.y, i => distXY(i.x, i.y, palette.x, palette.y) < 70 && (!palette.storageType || i.type === palette.storageType));
    if (!item) {
      const wrong = nearest(this.items, palette.x, palette.y, i => distXY(i.x, i.y, palette.x, palette.y) < 70);
      if (wrong && palette.storageType && wrong.type !== palette.storageType) this.addFloat(`${palette.name} locked to ${palette.storageType}s`, palette.x, palette.y - 34, '#c86b5f');
      else this.addFloat('No matching loose item nearby', palette.x, palette.y - 34, '#c86b5f');
      return false;
    }
    if (palette.stored >= palette.capacity) { this.addFloat(`${palette.name} full`, palette.x, palette.y - 34, '#c86b5f'); return false; }
    if (!palette.storageType) palette.storageType = item.type;
    palette.stored++;
    this.items = this.items.filter(i => i.id !== item.id);
    this.addFloat(`${palette.name}: ${palette.stored} ${palette.storageType}${palette.stored === 1 ? '' : 's'}`, palette.x, palette.y - 34, '#d3a95f');
    return true;
  }

  queuePlayerResourceAction(resource, op) {
    if (op === 'chop_tree' && this.player.inventory?.type !== 'crude_axe') return false;
    if (op === 'mine_stone' && this.player.inventory?.type !== 'crude_pickaxe') return false;
    const label = op === 'chop_tree' ? 'Chop tree' : 'Mine stone deposit';
    this.setPlayerDestination(resource.x, resource.y, { action: op, resourceId: resource.id, floatText: label });
    return true;
  }
  queuePlayerTreeSearch(tree) {
    if (!tree || tree.stump || this.player.inventory) return false;
    if (!this.treeSearchAvailable(tree, 'player')) { this.addFloat('Tree already being searched', tree.x, tree.y - 34, '#c86b5f'); return true; }
    this.setPlayerDestination(tree.x, tree.y, { action: 'search_tree', resourceId: tree.id, floatText: 'Search tree for sticks/seeds' });
    return true;
  }
  queuePlayerHempAction(hemp) {
    if (!hemp || hemp.harvested) return false;
    if (this.player.inventory?.type === 'crude_axe') {
      this.setPlayerDestination(hemp.x, hemp.y, { action: 'chop_hemp', resourceId: hemp.id, floatText: 'Chop hemp' });
      return true;
    }
    if (!this.player.inventory && !hemp.searched) {
      this.setPlayerDestination(hemp.x, hemp.y, { action: 'search_hemp', resourceId: hemp.id, floatText: 'Search hemp for seed' });
      return true;
    }
    this.addFloat(this.player.inventory ? `Need empty hands or crude axe (holding ${itemLabel(this.player.inventory.type)})` : 'Hemp already searched', hemp.x, hemp.y - 28, '#c86b5f');
    return true;
  }
  treeDisplayName(tree) {
    return tree?.stump ? 'tree stump' : tree?.growthStage === 'sapling' ? 'small sapling' : tree?.growthStage === 'small_tree' ? 'small tree' : 'grown tree';
  }
  dropTreeSearchFinds(tree) {
    this.spawnItem('stick', tree.x, tree.y, 1);
    this.spawnItem('tree_seed', tree.x, tree.y, 1);
  }
  finishHempSearch(hemp) {
    if (!hemp || hemp.harvested || hemp.searched || this.player.inventory) return false;
    hemp.searched = true;
    hemp.searchReservedBy = null;
    this.spawnItem('hemp_seed', hemp.x, hemp.y, 1);
    this.addFloat('Found hemp seed', hemp.x, hemp.y - 28, '#d3a95f');
    this.recordTeachStep(this.resourceRadiusStep('search_hemp', hemp, 'hemp plant'));
    this.syncTeachUi();
    return true;
  }
  finishHempChop(hemp) {
    if (!hemp || hemp.harvested || this.player.inventory?.type !== 'crude_axe') return false;
    hemp.harvested = true;
    this.hempPlants = this.hempPlants.filter(h => h.id !== hemp.id);
    this.spawnItem('hemp', hemp.x, hemp.y, 1);
    this.spawnItem('hemp_seed', hemp.x, hemp.y, 1);
    this.addFloat('Harvested hemp + seed', hemp.x, hemp.y - 28, '#9abf8f');
    this.recordTeachStep(this.resourceRadiusStep('chop_hemp', hemp, 'hemp plant'));
    this.syncTeachUi();
    return true;
  }
  finishTreeSearch(tree) {
    if (!tree || tree.stump || this.player.inventory) return false;
    this.dropTreeSearchFinds(tree);
    this.addFloat('Found stick + tree seed', tree.x, tree.y - 34, '#d3a95f');
    this.recordTeachStep(this.resourceRadiusStep('search_tree', tree, this.treeDisplayName(tree)));
    this.syncTeachUi();
    return true;
  }
  manualChopTool() {
    if (this.player.inventory) return this.player.inventory.type === 'crude_axe' ? this.player.inventory.type : null;
    const axe = nearest(this.items, this.player.x, this.player.y, i => i.type === 'crude_axe' && distXY(i.x, i.y, this.player.x, this.player.y) < 65);
    if (!axe) return null;
    this.items = this.items.filter(i => i.id !== axe.id);
    return axe.type;
  }
  manualMineStone() {
    const rock = nearest(this.rocks, this.player.x, this.player.y, r => !r.depleted && distXY(this.player.x,this.player.y,r.x,r.y)<48);
    if (!rock) return false;
    if (this.player.inventory) {
      if (this.player.inventory.type !== 'crude_pickaxe') {
        this.addFloat(`Need crude pickaxe in hands (holding ${itemLabel(this.player.inventory.type)})`, this.player.x, this.player.y - 30, '#c86b5f');
        return true;
      }
      rock.hp--; this.spawnItem('stone', rock.x, rock.y, 1); this.addFloat('Mined stone with crude pickaxe', this.player.x, this.player.y - 30, '#d3a95f');
      if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; this.addFloat('Stone deposit depleted', rock.x, rock.y - 24, '#9aa09d'); }
      return true;
    }
    const pickaxe = nearest(this.items, this.player.x, this.player.y, i => i.type === 'crude_pickaxe' && distXY(i.x, i.y, this.player.x, this.player.y) < 65);
    if (!pickaxe) { this.addFloat('Need crude pickaxe in hands or nearby to mine stone', this.player.x, this.player.y - 30, '#c86b5f'); return true; }
    this.items = this.items.filter(i => i.id !== pickaxe.id);
    rock.hp--; this.spawnItem('stone', rock.x, rock.y, 1); this.addFloat('Mined stone with crude pickaxe', this.player.x, this.player.y - 30, '#d3a95f');
    if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; this.addFloat('Stone deposit depleted', rock.x, rock.y - 24, '#9aa09d'); }
    return true;
  }
  manualChopTree() {
    const tree = nearest(this.trees, this.player.x, this.player.y, t => this.isChoppableTree(t) && distXY(this.player.x,this.player.y,t.x,t.y)<45);
    if (!tree) return false;
    const tool = this.manualChopTool();
    if (!tool) {
      const held = this.player.inventory ? ` (holding ${itemLabel(this.player.inventory.type)})` : '';
      this.addFloat(`Need crude axe in hands or nearby${held}`, this.player.x, this.player.y - 30, '#c86b5f');
      return true;
    }
    tree.hp--; this.spawnItem('log', tree.x, tree.y, 1); this.addFloat(`Used ${itemLabel(tool)}`, this.player.x, this.player.y - 30, '#d3a95f');
    if (tree.hp<=0) { tree.stump=true; tree.regrow=0; this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); }
    return true;
  }
  manualDigHole() {
    if (this.player.inventory?.type !== 'crude_shovel') return false;
    if (!this.isDiggable(this.player.x, this.player.y, 24)) { this.addFloat('Need clear dirt to dig', this.player.x, this.player.y - 30, '#c86b5f'); return true; }
    this.spawnHole(this.player.x, this.player.y);
    this.addFloat('Dug hole with crude shovel', this.player.x, this.player.y - 30, '#d3a95f');
    return true;
  }
  manualPlantSeed() {
    if (this.player.inventory?.type !== 'tree_seed') return false;
    const hole = this.nearestOpenHole(this.player.x, this.player.y, null, 46, null);
    if (!hole) return false;
    this.plantSeedInHole(hole);
    this.player.inventory = null;
    this.addFloat('Planted tree seed', this.player.x, this.player.y - 30, '#9abf8f');
    this.recordTeachStep({ op: 'plant_seed', holeId: hole.id, holeRef: hole.ref });
    this.syncTeachUi();
    return true;
  }
  manualPickupItem(item) {
    if (this.player.inventory) { this.addFloat(`Carrying ${itemLabel(this.player.inventory.type)}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
    if (!item) return false;
    if (item.reservedBy && item.reservedBy !== 'player') { this.addFloat(`${itemLabel(item.type)} is reserved`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
    if (distXY(item.x, item.y, this.player.x, this.player.y) >= 44) return false;
    this.player.inventory = { type: item.type, count: 1 };
    this.items = this.items.filter(i => i.id !== item.id);
    this.addFloat(`Picked up ${itemLabel(item.type)}`, this.player.x, this.player.y - 30, '#d3a95f');
    this.recordTeachStep({ op: 'pick_up', type: item.type });
    this.syncTeachUi();
    return true;
  }
  manualPickupNearest(type = null) {
    const item = nearest(this.items, this.player.x, this.player.y, i => (!type || i.type === type) && (!i.reservedBy || i.reservedBy === 'player') && distXY(i.x, i.y, this.player.x, this.player.y) < 44);
    return this.manualPickupItem(item);
  }
  takeStoredItemFromStructure(bot, s, type, dt) {
    if (!s || bot.inventory || s.type !== 'item_palette' || s.storageType !== type || (s.stored || 0) <= 0) return false;
    if (!this.moveBotTo(bot, s, dt, 32)) { bot.message = `Taught loop: pick up ${itemLabel(type)} from ${s.name}.`; return false; }
    s.stored--; if (s.stored <= 0) s.storageType = null; bot.inventory = { type, count: 1 }; bot.message = `Taught loop took ${itemLabel(type)} from ${s.name}.`; return true;
  }
  manualDropItem() {
    const held = this.player.inventory;
    if (!held) { this.addFloat('Hands empty', this.player.x, this.player.y - 30, '#c86b5f'); return false; }
    this.spawnItem(held.type, this.player.x, this.player.y + 18, held.count || 1);
    this.player.inventory = null;
    this.addFloat(`Dropped ${itemLabel(held.type)}`, this.player.x, this.player.y - 30, '#d3a95f');
    this.syncTeachUi();
    return true;
  }
  manualDepositToStructure(s = null, { waitIfProcessing = false } = {}) {
    if (!this.player.inventory) return false;
    const target = s || this.structures.find(st => rectDistance(this.player.x, this.player.y, st) < 45 && ['sawbench', 'workbench', 'factory', 'smithery', 'bowmaker'].includes(st.type));
    if (!target) { this.addFloat(`No production building nearby for ${itemLabel(this.player.inventory.type)}`, this.player.x, this.player.y - 30, '#c86b5f'); return false; }
    const type = this.player.inventory.type;
    if (this.isStructureProcessing(target)) { if (!waitIfProcessing) this.addFloat(`${target.name} is processing`, target.x, target.y - 35, '#c7b683'); return false; }
    if (!this.depositHeldItemToStructure(target, type)) return false;
    this.player.inventory = null;
    this.addFloat(`Deposited ${itemLabel(type)} into ${target.name}`, target.x, target.y - 35, '#d3a95f');
    this.recordTeachStep({ op: 'deposit_to_structure', type, structureId: target.id, structureRef: target.ref, structureType: target.type, structureName: target.name, target: target.name });
    this.syncTeachUi();
    return true;
  }
  interact() {
    const s = this.structures.find(st => rectDistance(this.player.x,this.player.y,st)<45);
    if (this.manualPlantSeed()) return;
    if (this.player.inventory?.type === 'crude_shovel') { this.manualDigHole(); return; }
    if (this.player.inventory?.type === 'crude_pickaxe' && this.manualMineStone()) return;
    if (this.player.inventory?.type === 'crude_axe' && this.manualChopTree()) return;
    const hemp = nearest(this.hempPlants, this.player.x, this.player.y, h => !h.harvested && distXY(this.player.x, this.player.y, h.x, h.y) < 46);
    if (hemp && this.queuePlayerHempAction(hemp)) return;
    if (this.player.inventory && s && this.manualDepositToStructure(s)) return;
    if (!this.player.inventory && this.player.target?.action === 'pickup_item') {
      const targetItem = this.items.find(i => i.id === this.player.target.itemId);
      if (this.manualPickupItem(targetItem)) { this.player.target = null; return; }
    }
    if (!this.player.inventory && this.manualPickupNearest()) return;
    if (this.manualMineStone()) return;
    if (this.manualChopTree()) return;
    if (s?.type==='item_palette') { this.acceptNearestItemForPalette(s); return; }
    if (s?.type==='workbench') { if (this.isStructureProcessing(s) || (s.sticks>=1 && s.stones>=1)) { this.maybeStartStructureProcessing(s); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; } const item = nearest(this.items, s.x, s.y, i => ['stick','stone'].includes(i.type) && distXY(i.x,i.y,s.x,s.y)<70); if (item) { this.depositHeldItemToStructure(s, item.type); this.items = this.items.filter(i => i.id !== item.id); } return; }
    if (s?.type==='sawbench' && (s.logs>0 || s.planks>0 || this.isStructureProcessing(s))) { this.maybeStartStructureProcessing(s); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; }
    if (s?.type==='smithery') { const input = smitheryInputFor(smitheryRecipe(s)); const key = input === 'stick' ? 'sticks' : 'planks'; if (this.isStructureProcessing(s) || (s[key] || 0) > 0) { this.maybeStartStructureProcessing(s); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; } }
    if (s?.type==='bowmaker' && (this.isStructureProcessing(s) || Object.entries(BOW_RECIPE).every(([type,cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost))) { this.maybeStartStructureProcessing(s); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; }
    if (s?.type==='factory' && (this.isStructureProcessing(s) || Object.entries(FACTORY_BOT_RECIPE).every(([type,cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost))) { this.maybeStartStructureProcessing(s); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); }
  }

  showBotMenu(bot, x, y) {
    const el = this.dom.botMenu;
    const tpl = JSON.stringify(this.getBotProgram(bot), null, 2);
    const steps = this.activeTeachSteps();
    const teachSteps = this.renderTeachSteps(steps);
    const recordLabel = this.recorder.recording ? 'Stop recording' : 'Start recording';
    const assignDisabled = (this.recordedLoop.length || this.recorder.steps.length) ? '' : ' disabled';
    const stopLabel = bot.paused ? 'Resume workflow' : 'Stop workflow';
    el.innerHTML = `<b>Bot ${bot.id}</b><button data-close>×</button><p>${escapeHtml(bot.message)}</p><p><b>Program:</b> ${escapeHtml(bot.program)}</p><p><b>Ref:</b> <code>${escapeHtml(bot.ref)}</code></p><button data-stop-workflow>${stopLabel}</button><section class="teach-menu"><b>Teach by doing</b><p>${escapeHtml(this.recorder.recording ? `Recording ${this.recorder.steps.length} steps for Bot ${this.recorder.targetBotId || bot.id}…` : this.recorder.status)}</p><ol class="teach-steps menu-teach-steps">${teachSteps}</ol><button data-teach-record>${recordLabel}</button><button data-assign-taught${assignDisabled}>Assign to Bot ${bot.id}</button></section><pre>${escapeHtml(tpl)}</pre><button data-add>Add bot to chat</button>`;
    this.placeMenu(el,x,y);
    this.bindTeachStepControls(el.querySelector('.menu-teach-steps'));
    el.querySelector('[data-close]').onclick=()=>this.hideMenus();
    el.querySelector('[data-add]').onclick=()=>{this.chat.insertAtCursor(`Bot ${bot.id} `); this.hideMenus();};
    el.querySelector('[data-stop-workflow]').onclick=()=>{ bot.paused = !bot.paused; bot.message = bot.paused ? `Paused ${bot.program} workflow.` : `Resumed ${bot.program} workflow.`; this.showBotMenu(bot, x, y); };
    el.querySelector('[data-teach-record]').onclick=()=>{ this.recorder.recording ? this.stopTeachRecording() : this.startTeachRecording(bot.id); this.showBotMenu(bot, x, y); };
    el.querySelector('[data-assign-taught]')?.addEventListener('click',()=>{ this.assignRecordedLoopToBot(bot.id); this.hideMenus(); });
  }
  showStructureMenu(s, x, y) {
    const el = this.dom.structureMenu;
    const processing = s.processing ? `<br>processing ${escapeHtml(s.processing.label)} · ${Math.max(0, s.processing.remaining).toFixed(1)}s left` : '';
    const storage = (s.type === 'throne' ? `<br>owner ${s.ownerLabel || s.ownerId || 'none'} · HP ${Math.max(0, s.hp || 0)}/${s.maxHp || THRONE_HP}` : s.type === 'defensetower' ? `<br>range ${s.rangedAttack?.range || DEFENSE_TOWER_ATTACK.range} · damage ${s.rangedAttack?.damage || 1} · cooldown ${s.rangedAttack?.cooldown || 1}s${s.rangedAttack?.targetRef ? ` · target ${s.rangedAttack.targetRef}` : ''}` : s.type === 'item_palette' ? `<br>locked type ${s.storageType || 'empty/unlocked'} · stored ${s.stored || 0}/${s.capacity || 0}` : s.type === 'workbench' ? `<br>sticks ${s.sticks||0} · stones ${s.stones||0} · output ${escapeHtml(itemLabel(workbenchRecipe(s)))} · made A${s.axes||0} P${s.pickaxes||0} S${s.shovels||0}` : s.type === 'smithery' ? `<br>sticks ${s.sticks||0} · planks ${s.planks||0} · mode ${escapeHtml(itemLabel(smitheryRecipe(s)))} · made swords ${s.swords||0} shields ${s.shields||0}` : s.type === 'bowmaker' ? `<br>sticks ${s.sticks||0}/2 · hemp ${s.hemps||0}/3 · made bows ${s.bows||0}` : s.type === 'factory' ? `<br>logs ${s.logs||0} · planks ${s.planks||0} · poles ${s.poles||0} · seeds ${s.tree_seeds||0}` : `<br>logs ${s.logs||0} · planks ${s.planks||0} · poles ${s.poles||0}`) + processing;
    const insertButton = s.type === 'item_palette' ? '<button data-insert-nearby>Insert nearby item</button>' : '<button data-add-radius>Add small radius</button>';
    const selectedRecipe = workbenchRecipe(s);
    const selector = s.type === 'workbench' ? `<section class="tool-selector" aria-label="Tool bench output"><b>Produce:</b> ${WORKBENCH_TOOL_RECIPES.map(type => `<button type="button" data-select-tool="${type}"${type === selectedRecipe ? ' aria-pressed="true" class="is-active"' : ' aria-pressed="false"'}>${escapeHtml(itemLabel(type))}</button>`).join('')}</section>` : s.type === 'smithery' ? `<section class="tool-selector" aria-label="Smithery production mode"><b>Production mode:</b> <button type="button" data-switch-smithery>${escapeHtml(itemLabel(smitheryRecipe(s)))} (switch)</button></section>` : '';
    const info = STRUCTURE_INFO[s.type] || 'Building.';
    el.innerHTML = `<b>${escapeHtml(s.name)}</b><button data-close>×</button><p>${escapeHtml(s.label)} · type <code>${escapeHtml(s.type)}</code> · ref <code>${escapeHtml(s.ref)}</code>${storage}<br><b>Info:</b> ${escapeHtml(info)}<br><b>Recipe:</b> ${escapeHtml(structureRecipeText(s))}</p>${selector}<button data-add-name>Add name</button><button data-add-ref>Add ref</button>${insertButton}`;
    this.placeMenu(el,x,y);
    el.querySelector('[data-close]').onclick=()=>this.hideMenus();
    el.querySelectorAll('[data-select-tool]').forEach(btn => btn.addEventListener('click', () => {
      if (this.setWorkbenchRecipe(s, btn.dataset.selectTool)) this.showStructureMenu(s, x, y);
    }));
    el.querySelector('[data-switch-smithery]')?.addEventListener('click', () => {
      if (this.switchSmitheryRecipe(s)) this.showStructureMenu(s, x, y);
    });
    el.querySelector('[data-add-name]').onclick=()=>{this.chat.insertAtCursor(s.name); this.hideMenus();};
    el.querySelector('[data-add-ref]').onclick=()=>{this.chat.insertAtCursor(s.ref); this.hideMenus();};
    el.querySelector('[data-add-radius]')?.addEventListener('click',()=>{this.chat.insertAtCursor(`small area around ${s.name}`); this.hideMenus();});
    el.querySelector('[data-insert-nearby]')?.addEventListener('click',()=>{this.acceptNearestItemForPalette(s); this.hideMenus();});
  }
  syncZonesUi() {
    const list = this.dom.zoneList;
    if (!list) return;
    if (!this.zones.length) { list.innerHTML = '<p class="empty">No zones yet.</p>'; return; }
    list.innerHTML = this.zones.map(z => `<div class="zone-card${z.hidden ? ' is-hidden' : ''}" data-zone-id="${escapeHtml(z.id)}"><div><b>${escapeHtml(z.name)}</b><p>${escapeHtml(z.id)} · ${Math.round(z.w || 0)}×${Math.round(z.h || 0)}${z.hidden ? ' · hidden' : ''}</p></div><div class="zone-card-actions"><button type="button" data-rename-zone="${escapeHtml(z.id)}">Rename</button><button type="button" data-toggle-zone-hidden="${escapeHtml(z.id)}">${z.hidden ? 'Show' : 'Hide'}</button><button type="button" data-add-zone-name="${escapeHtml(z.id)}">Add name</button></div></div>`).join('');
    list.querySelectorAll('[data-rename-zone]').forEach(btn => btn.addEventListener('click', () => this.promptRenameZone(this.zones.find(z => z.id === btn.dataset.renameZone))));
    list.querySelectorAll('[data-toggle-zone-hidden]').forEach(btn => btn.addEventListener('click', () => { const z = this.zones.find(zone => zone.id === btn.dataset.toggleZoneHidden); if (z) this.setZoneHidden(z, !z.hidden); }));
    list.querySelectorAll('[data-add-zone-name]').forEach(btn => btn.addEventListener('click', () => { const z = this.zones.find(zone => zone.id === btn.dataset.addZoneName); if (z) this.chat.insertAtCursor(z.name); }));
  }
  promptRenameZone(z) { const next = z ? window.prompt('Rename zone', z.name) : null; if (next != null) this.renameZone(z, next); }
  renameZone(z, name) {
    const next = String(name || '').trim();
    if (!z || !next) return false;
    z.name = next;
    this.syncZonesUi();
    this.addFloat(`Renamed ${z.id} to ${z.name}`, z.x + z.w / 2, z.y - 8, '#d3a95f');
    return true;
  }
  setZoneHidden(z, hidden) {
    if (!z) return false;
    z.hidden = Boolean(hidden);
    if (z.hidden && this.mouse.hoverZone === z) this.mouse.hoverZone = null;
    this.syncZonesUi();
    this.addFloat(`${z.hidden ? 'Hid' : 'Showed'} ${z.name}`, z.x + z.w / 2, z.y - 8, z.hidden ? '#c7b683' : '#9abf8f');
    return true;
  }
  showZoneMenu(z, x, y) {
    const el = this.dom.structureMenu;
    const rect = this.rectangleText(z);
    el.innerHTML = `<b>${escapeHtml(z.name)}</b><button data-close>×</button><p>Zone ref <code>${escapeHtml(z.id)}</code><br>${Math.round(z.w || 0)}×${Math.round(z.h || 0)} px<br><code>${escapeHtml(rect)}</code></p><button data-add-rect>Add rectangle coords</button><button data-add-name>Add zone name</button><button data-add-ref>Add zone ref</button><button data-rename-zone>Rename</button><button data-hide-zone>Hide zone</button>`;
    this.placeMenu(el,x,y);
    el.querySelector('[data-close]').onclick=()=>this.hideMenus();
    el.querySelector('[data-add-rect]').onclick=()=>{this.chat.insertAtCursor(rect); this.hideMenus();};
    el.querySelector('[data-add-name]').onclick=()=>{this.chat.insertAtCursor(z.name); this.hideMenus();};
    el.querySelector('[data-add-ref]').onclick=()=>{this.chat.insertAtCursor(z.id); this.hideMenus();};
    el.querySelector('[data-rename-zone]').onclick=()=>{this.promptRenameZone(z); this.showZoneMenu(z, x, y);};
    el.querySelector('[data-hide-zone]').onclick=()=>{this.setZoneHidden(z, true); this.hideMenus();};
  }
  placeMenu(el,x,y) { this.hideMenus(); el.style.left=`${Math.min(x, window.innerWidth-310)}px`; el.style.top=`${Math.min(y, window.innerHeight-260)}px`; el.hidden=false; }
  hideMenus(){ this.dom.botMenu.hidden=true; this.dom.structureMenu.hidden=true; }

  syncBuildUi() { if (!this.dom.buildStatus) return; this.dom.buildStatus.textContent = this.placementType ? `Click map to place ${BUILDING_TYPES[this.placementType].label}.` : 'Choose a building, then click the map.'; for (const b of this.dom.buildPanel.querySelectorAll('[data-build]')) b.classList.toggle('is-active', b.dataset.build === this.placementType); }
  updateUI(dt) { this.dom.sawLogs.textContent = this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.logs,0); this.dom.sawPlanks.textContent = this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.planks,0); if (this.dom.sawPoles) this.dom.sawPoles.textContent = this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+(s.poles||0),0); this.dom.factoryPlanks.textContent = this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+s.planks,0); if (this.dom.factoryRecipe) this.dom.factoryRecipe.textContent = this.structures.filter(s=>s.type==='factory').map(s=>`L${s.logs||0} P${s.planks||0} Po${s.poles||0} S${s.tree_seeds||0}`).join(' · '); this.dom.looseLogs.textContent = this.countItems('log'); this.dom.loosePlanks.textContent = this.countItems('plank'); if (this.dom.looseBase) this.dom.looseBase.textContent = `sticks ${this.countItems('stick')} · stones ${this.countItems('stone')} · seeds ${this.countItems('tree_seed')} · poles ${this.countItems('pole')} · axes ${this.countItems('crude_axe')} · pickaxes ${this.countItems('crude_pickaxe')} · shovels ${this.countItems('crude_shovel')} · swords ${this.countItems('wooden_sword')} · shields ${this.countItems('wooden_shield')}`; if (this.dom.paletteItems) this.dom.paletteItems.textContent = this.structures.filter(s=>s.type==='item_palette').reduce((n,s)=>n+(s.stored||0),0); this.dom.statline.innerHTML = `<span>FPS <b>${this.fps} / ${this.targetFps}</b></span><span>Bots <b>${this.bots.length} / ${this.maxBots}</b></span><span>Buildings <b>${this.structures.length}</b></span><span>Zones <b>${this.zones.length}</b></span>`; this.dom.rendererStatus.textContent = `Renderer: ${this.renderer.text}`; this.lastBotListUpdate += dt; if (this.lastBotListUpdate > .35) { this.lastBotListUpdate=0; this.dom.botList.innerHTML = this.bots.slice(0,14).map(b => `<div class="bot-card" data-bot-id="${b.id}"><div class="bot-badge">#${b.id}</div><div><b>${escapeHtml(b.program)}</b><p>${escapeHtml(b.message)}</p></div></div>`).join(''); } }

  getRenderState() { return createRenderState(this); }
  draw() { drawWorld(this.getRenderState(), this.ctx); }

  getHoverState(){ const item = this.mouse.hoverItem; return { item: item ? { id: item.id, ref: item.ref, type: item.type, name: itemLabel(item.type), x: Math.round(item.x), y: Math.round(item.y) } : null, cursor: this.canvas.style.cursor }; }

  getObjectRegistry(){ return [
    ...this.zones.map(z=>({ id:z.id, name:z.name, kind:'zone', zoneKind:z.kind, rect:z.kind==='rect'?{x:Math.round(z.x),y:Math.round(z.y),w:Math.round(z.w),h:Math.round(z.h)}:undefined, builtIn:!!z.builtIn, hidden:!!z.hidden })),
    ...this.structures.map(s=>({ id:s.ref, numericId:s.id, kind:'structure', type:s.type, name:s.name, x:Math.round(s.x), y:Math.round(s.y), logs:s.logs||0, planks:s.planks||0, poles:s.poles||0, sticks:s.sticks||0, stones:s.stones||0, tree_seeds:s.tree_seeds||0, axes:s.axes||0, pickaxes:s.pickaxes||0, shovels:s.shovels||0, swords:s.swords||0, shields:s.shields||0, hemps:s.hemps||0, bows:s.bows||0, workbenchRecipe:s.workbenchRecipe||null, smitheryRecipe:s.smitheryRecipe||null, rangedAttack:s.rangedAttack?{...s.rangedAttack}:null, storageType:s.storageType||null, stored:s.stored||0, capacity:s.capacity||0, processing:s.processing?{...s.processing}:null })),
    ...this.items.map(i=>({ id:i.ref, numericId:i.id, kind:'item', type:i.type, name:itemLabel(i.type), x:Math.round(i.x), y:Math.round(i.y), reservedBy:i.reservedBy||null })),
    ...this.holes.map(h=>({ id:h.ref, numericId:h.id, kind:'hole', type:'dug_hole', name:h.planted ? 'planted hole' : 'dug hole', x:Math.round(h.x), y:Math.round(h.y), planted:!!h.planted, reservedBy:h.reservedBy||null, treeId:h.treeId||null })),
    ...this.hempPlants.map(h=>({ id:h.ref||`hemp:${h.id}`, numericId:h.id||null, kind:'resource', type:'hemp_plant', name:h.searched ? 'searched hemp' : 'hemp plant', x:Math.round(h.x), y:Math.round(h.y), radius:h.radius, searched:!!h.searched, harvested:!!h.harvested, searchReservedBy:h.searchReservedBy||null })),
    ...this.trees.map(t=>({ id:t.ref||`tree:${t.id}`, numericId:t.id||null, kind:'resource', type:'tree', name:t.stump ? 'tree stump' : (t.growthStage === 'sapling' ? 'small sapling' : t.growthStage === 'small_tree' ? 'small tree' : 'grown tree'), x:Math.round(t.x), y:Math.round(t.y), hp:t.hp, maxHp:t.maxHp, radius:t.radius, stump:!!t.stump, planted:!!t.planted, growthStage:t.growthStage||'grown_tree', growTimer:Math.max(0, Math.round((t.growTimer||0)*10)/10), searchReservedBy:t.searchReservedBy||null })),
    ...this.projectiles.map(p=>({ id:p.ref, numericId:p.id, kind:'projectile', type:p.type, sourceStructureId:p.sourceStructureId, targetRef:p.targetRef, x:Math.round(p.x), y:Math.round(p.y), damage:p.damage })),
    ...this.monsters.map(m=>({ id:m.ref||`monster:${m.id}`, numericId:m.id||null, kind:'monster', type:m.type||'passive_monster', name:m.name||'passive monster', x:Math.round(m.x), y:Math.round(m.y), hp:m.hp, maxHp:m.maxHp, radius:m.radius, passive:!!m.passive, avoidRadius:m.avoidRadius, roamRadius:m.roamRadius })),
    ...this.rocks.map(r=>({ id:r.ref, numericId:r.id, kind:'resource', type:'stone_deposit', name:'stone deposit', x:Math.round(r.x), y:Math.round(r.y), hp:r.hp, maxHp:r.maxHp, depleted:!!r.depleted })),
    ...this.bots.map(b=>({ id:b.ref, numericId:b.id, kind:'bot', name:`Bot ${b.id}`, x:Math.round(b.x), y:Math.round(b.y), program:b.program }))
  ]; }
  getState(){ return { multiplayer:this.getMultiplayerSnapshot(), player:{x:Math.round(this.player.x),y:Math.round(this.player.y),inventory:this.player.inventory,target:this.player.target?{...this.player.target,x:Math.round(this.player.target.x),y:Math.round(this.player.target.y)}:null}, recorder:this.getRecorderState(), bots:this.bots.map(b=>({id:b.id,ref:b.ref,x:Math.round(b.x),y:Math.round(b.y),program:b.program,paused:!!b.paused,message:b.message,inventory:b.inventory,tool:b.tool,taughtLoop:b.taughtLoop?clone(b.taughtLoop):null,targetStructureId:b.targetStructureId,sourceStructureId:b.sourceStructureId,sourcePaletteId:b.sourcePaletteId,pickupItemType:b.pickupItemType,targetFactoryId:b.targetFactoryId,targetWorkbenchId:b.targetWorkbenchId,zoneId:b.zoneId,zone:this.getBotZone(b)?this.zoneLabel(this.getBotZone(b)):null})), structures:this.structures.map(s=>({id:s.id,ref:s.ref,name:s.name,type:s.type,logs:s.logs,planks:s.planks,poles:s.poles,sticks:s.sticks,stones:s.stones,tree_seeds:s.tree_seeds,axes:s.axes,pickaxes:s.pickaxes||0,shovels:s.shovels||0,swords:s.swords||0,shields:s.shields||0,hemps:s.hemps||0,bows:s.bows||0,workbenchRecipe:s.workbenchRecipe||null,smitheryRecipe:s.smitheryRecipe||null,rangedAttack:s.rangedAttack?{...s.rangedAttack}:null,storageType:s.storageType||null,stored:s.stored||0,capacity:s.capacity||0,processing:s.processing?{...s.processing}:null,x:Math.round(s.x),y:Math.round(s.y)})), projectiles:this.projectiles.map(p=>({...p,x:Math.round(p.x),y:Math.round(p.y)})), zones:this.zones.map(z=>({...z,x:Math.round(z.x),y:Math.round(z.y),w:Math.round(z.w),h:Math.round(z.h)})), hempPlants:this.hempPlants.map(h=>({...h,x:Math.round(h.x),y:Math.round(h.y)})), monsters:this.monsters.map(m=>({...m,x:Math.round(m.x),y:Math.round(m.y),wanderTarget:m.wanderTarget?{x:Math.round(m.wanderTarget.x),y:Math.round(m.wanderTarget.y)}:null})), holes:this.holes.map(h=>({...h,x:Math.round(h.x),y:Math.round(h.y)})), objectRegistry:this.getObjectRegistry(), stores:{sawbenchLogs:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.logs,0),sawbenchPlanks:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.planks,0),sawbenchPoles:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+(s.poles||0),0),factoryLogs:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.logs||0),0),factoryPlanks:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+s.planks,0),factoryPoles:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.poles||0),0),factorySeeds:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.tree_seeds||0),0),looseLogs:this.countItems('log'),loosePlanks:this.countItems('plank'),loosePoles:this.countItems('pole'),looseSticks:this.countItems('stick'),looseStones:this.countItems('stone'),looseTreeSeeds:this.countItems('tree_seed'),looseAxes:this.countItems('crude_axe'),loosePickaxes:this.countItems('crude_pickaxe'),looseShovels:this.countItems('crude_shovel'),dugHoles:this.holes.length,stoneDeposits:this.rocks.filter(r=>!r.depleted).length,paletteItems:this.structures.filter(s=>s.type==='item_palette').reduce((n,s)=>n+(s.stored||0),0)}, hover:{bot:this.mouse.hoverBot?.id||null,structure:this.mouse.hoverStructure?.name||null,zone:this.mouse.hoverZone?.name||null}, placementType:this.placementType, zoneDrawing:!!this.zoneDraft?.active, renderer:this.renderer.text, webgpuAvailable:this.renderer.webgpu, fps:this.fps, maxBots:this.maxBots, dslTemplates:PROGRAM_TEMPLATES, asr:this.chat.asr ? {endpoint:this.chat.wsUrl(),recording:this.chat.asr.recording,segment:this.chat.asr.segment}:null }; }
}
