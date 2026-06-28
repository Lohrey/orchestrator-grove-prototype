import { BUILDING_TYPES, PROGRAMS, PROGRAM_TEMPLATES, ALLOWED_OPS, DEFAULT_WORLD_ZONES } from './data.js?v=t_building_kits_0618';
import { CAMPAIGN_MAP_FEATURES, CAMPAIGN_MAP_SIZE, CAMPAIGN_START, getCampaignArrivalScene } from './campaign-scenes.js?v=t_campaign_scenes_0623';
import { createCanvas2dRenderer } from './renderers/canvas2d-renderer.js?v=t_building_kits_0618';
import { createRenderState } from './render-state.js?v=t_building_kits_0618';
import { installCombatSystem, IDLE_BOT_AUTO_ATTACK_RANGE } from './systems/combat/combat-system.js?v=t_combat_system_0627';
import { BOW_ATTACK, DEFENSE_TOWER_ATTACK, MELEE_AUTO_ATTACK, MONSTER_MELEE_ATTACK } from './systems/combat/combat-config.js?v=t_combat_system_0627';
import { installTaughtLoopSystem } from './systems/dsl/taught-loop-system.js?v=t_taught_loop_system_0627';
import { installInventorySystem } from './systems/inventory/inventory-system.js?v=t_inventory_system_0627';
import { assemblerRecipe as getAssemblerRecipe, DEFAULT_SMITHERY_RECIPE, DEFAULT_WORKBENCH_RECIPE, installProductionSystem, productionInputCount, productionInputNeeds as getProductionInputNeeds, SMITHERY_RECIPES, smitheryInputFor, smitheryRecipe, WORKBENCH_TOOL_RECIPES, workbenchRecipe } from './systems/production/production-system.js?v=t_production_system_0627';
import { FOG_CELL_SIZE, createFogOfWar, fogRevealSources as createFogRevealSources, getFogStats, isLightEmittingStructure as isFogLightEmittingStructure, normalizeFogOfWar, revealFogCircle, serializeFogOfWar, structureLightRadius as fogStructureLightRadius, updateFogOfWarState } from './fog-of-war.js?v=t_building_kits_0618';
import { clamp, rand, distXY, nearest, pointInRect, rectDistance, canvasPoint, escapeHtml } from './utils.js?v=20260613-player-tools';
import { installCameraSystem } from './systems/camera-system.js?v=t_camera_system_0627';
import { installPlayerSystem } from './systems/player-system.js?v=t_player_system_0627';
import { installMonsterSystem } from './systems/monster-system.js?v=grove_fixes_0628';
import { installStructureSystem } from './systems/structure-system.js?v=t_structure_system_0627';
import { installBotSystem } from './systems/bot-system.js?v=t_bot_system_0627';
import { installTeachSystem } from './systems/teach-system.js?v=t_teach_system_0627';
import { installSpawnSystem } from './systems/spawn-system.js?v=t_spawn_system_0627';
import { installInteractionSystem } from './systems/interaction-system.js?v=t_health_system_0628';
import { installHealthSystem } from './systems/health-system.js?v=t_health_system_0628';

const clone = value => JSON.parse(JSON.stringify(value));
const rectCenter = z => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
const FACTORY_BOT_RECIPE = { log: 1, plank: 3, pole: 1, tree_seed: 1 };
const BOW_RECIPE = { stick: 2, hemp: 3 };
const BUILDING_KIT_EXCLUDED_TYPES = ['throne', 'assembler'];
const BUILDING_KIT_BUILDING_TYPES = Object.freeze(Object.keys(BUILDING_TYPES).filter(type => !BUILDING_KIT_EXCLUDED_TYPES.includes(type)));
const BUILDING_KIT_ITEM_TYPES = Object.freeze(BUILDING_KIT_BUILDING_TYPES.map(type => `${type}_kit`));
const ASSEMBLER_KIT_RECIPE = Object.freeze({ plank: 2, pole: 1 });
const DEFAULT_ASSEMBLER_RECIPE = 'sawbench_kit';
const assemblerRecipe = s => getAssemblerRecipe(s, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE);
const productionInputNeeds = s => getProductionInputNeeds(s, { ASSEMBLER_KIT_RECIPE, BOW_RECIPE, BUILDING_KIT_ITEM_TYPES, DEFAULT_ASSEMBLER_RECIPE, FACTORY_BOT_RECIPE });
function buildingTypeFromKitItem(type) {
  const text = String(type || '').trim();
  const match = text.match(/^(.+)_kit$/);
  return match && BUILDING_KIT_BUILDING_TYPES.includes(match[1]) ? match[1] : null;
}
function buildingKitItemTypeFor(type) { return BUILDING_KIT_BUILDING_TYPES.includes(type) ? `${type}_kit` : null; }
function isBuildingKitItemType(type) { return !!buildingTypeFromKitItem(type); }
function buildingKitLabel(type) {
  const buildingType = buildingTypeFromKitItem(type) || type;
  const label = BUILDING_TYPES[buildingType]?.label || String(buildingType || '').replace(/_/g, ' ');
  return `${label.toLowerCase()} kit`;
}
const AXE_DURABILITY = 100;
const PICKAXE_DURABILITY = 80;
const SHOVEL_DURABILITY = 80;
const TOOL_DURABILITY = {
  crude_axe: AXE_DURABILITY,
  crude_pickaxe: PICKAXE_DURABILITY,
  crude_shovel: SHOVEL_DURABILITY,
  crude_hammer: AXE_DURABILITY
};
const PRODUCTION_SOURCE_RADIUS = 150;
const STARTING_AXE_COUNT = 10;
const STARTING_PICKAXE_COUNT = 5;
const STARTING_SHOVEL_COUNT = 5;
const WORLD_MAP_SIZE = { width: 3600, height: 2400 };
export const CAMERA_MIN_ZOOM = 0.05;
const CAMERA_MAX_ZOOM = 2.35;
const CAMERA_WHEEL_SENSITIVITY = 0.00135;
const CAMERA_EDGE_VIEWPORT_PADDING_RATIO = 0.5;
const MIN_DRAWN_ZONE_SIZE = 6;
const DEFAULT_RESOURCE_RADIUS = 150;
const DEFAULT_NEARBY_RADIUS = DEFAULT_RESOURCE_RADIUS;
const MAX_NEARBY_RADIUS = 1200;
const DEFAULT_FOLLOW_DISTANCE = 54;
const DIG_ZONE_RADIUS = 96;
const HOLE_VISUAL_RADIUS = 16;
const HOLE_BLOCK_RADIUS = 42;
const RESOURCE_HIT_SECONDS = 3;
const BUILDING_KIT_DEPLOY_SECONDS = 1.6;
const BUILDING_DISASSEMBLE_SECONDS = 1.8;
const TREE_SEARCH_SECONDS = 2.4;
const HEMP_SEARCH_SECONDS = 1.4;
const HEMP_CHOP_SECONDS = 1.8;
const MONSTER_AVOID_STRUCTURE_RADIUS = 260;
const MONSTER_ROAM_RADIUS = 340;
const MULTIPLAYER_STARTS = {
  p1: { id: 'p1', label: 'Player 1', corner: 'bottom-left', x: 260, y: WORLD_MAP_SIZE.height - 260, throneX: 160, throneY: WORLD_MAP_SIZE.height - 150 },
  p2: { id: 'p2', label: 'Player 2', corner: 'top-right', x: WORLD_MAP_SIZE.width - 260, y: 260, throneX: WORLD_MAP_SIZE.width - 170, throneY: 150 }
};
const ONLINE_MULTIPLAYER_FEATURES = [
  { id: 'p1_lake', type: 'lake', ownerId: 'p1', x: 330, y: WORLD_MAP_SIZE.height - 330, rx: 230, ry: 125 },
  { id: 'p1_camper', type: 'camper_van', ownerId: 'p1', label: 'Player 1 camper van', x: 565, y: WORLD_MAP_SIZE.height - 360, w: 118, h: 58, rotation: -0.08 },
  { id: 'p2_lake', type: 'lake', ownerId: 'p2', x: WORLD_MAP_SIZE.width - 330, y: 330, rx: 230, ry: 125 },
  { id: 'p2_camper', type: 'camper_van', ownerId: 'p2', label: 'Player 2 camper van', x: WORLD_MAP_SIZE.width - 565, y: 360, w: 118, h: 58, rotation: 0.08, flipX: true }
];
const THRONE_HP = 120;
const THRONE_ATTACK_DAMAGE = 10;
const MONSTER_WAVE_CONFIG = { spawnEverySeconds: 15, extraMonsterEverySeconds: 180, maxWaveSize: 8 };
const DAY_NIGHT_CYCLE_SECONDS = 96;
const NIGHT_PHASE_START = 0.58;
const NIGHT_PHASE_END = 0.18;
const NIGHT_MONSTER_CONFIG = { spawnEverySeconds: 10, minDistanceFromStructures: 720, minDistanceFromPlayer: 620, maxActive: 8, maxPerNight: 5, roamRadius: 520, avoidRadius: 680 };
const MULTIPLAYER_LANE_TOWERS = {
  p1: [
    { x: 650, y: 1900, name: 'bottom outer tower' },
    { x: 1260, y: 1500, name: 'bottom middle tower' },
    { x: 1850, y: 1080, name: 'bottom inner tower' }
  ],
  p2: [
    { x: 1750, y: 1320, name: 'top inner tower' },
    { x: 2360, y: 900, name: 'top middle tower' },
    { x: 2980, y: 500, name: 'top outer tower' }
  ]
};
const BOT_STORAGE_RETRY_SECONDS = 10;
const DEFAULT_MANAGER_KNOWLEDGE_PACKS = ['starter_automation'];
const MANAGER_DELEGATE_THROTTLE_SECONDS = 3;
const EQUIPMENT_WEAPONS = ['wooden_sword', 'bow'];
const PLAYER_MAX_HP = 10;
const PLAYER_REGEN_DELAY_MS = 10000;
const PLAYER_REGEN_INTERVAL_MS = 3000;
const PLAYER_REGEN_AMOUNT = 1;
const EQUIPMENT_SHIELDS = ['wooden_shield'];
const MAX_WEAPON_SETS = 2;
const DOG_FETCH_SEARCH_RADIUS = 2000;
const DOG_FETCH_PRAISE_TARGET = 10;
function createRangedAttackComponent(overrides = {}) {
  const stats = { ...DEFENSE_TOWER_ATTACK, ...overrides };
  return { ...stats, cooldownRemaining: 0, targetRef: null };
}
function createAutoAttackComponent(overrides = {}) {
  const stats = { ...MELEE_AUTO_ATTACK, ...overrides };
  return { ...stats, cooldownRemaining: 0, targetRef: null };
}
function createEquipment() {
  return { weapon: null, shield: null, activeWeaponSetId: null, nextWeaponSetId: 1, weaponSets: [], rangedAttack: createRangedAttackComponent(BOW_ATTACK), autoAttack: createAutoAttackComponent() };
}
function syncActiveEquipmentSet(eq) {
  if (!eq) return null;
  if (!Array.isArray(eq.weaponSets)) eq.weaponSets = [];
  eq.weaponSets = eq.weaponSets.filter(set => set && (set.weapon || set.shield));
  if (eq.weaponSets.length && !eq.weaponSets.some(set => set.id === eq.activeWeaponSetId)) eq.activeWeaponSetId = eq.weaponSets[0].id;
  if (!eq.weaponSets.length) eq.activeWeaponSetId = null;
  const active = eq.weaponSets.find(set => set.id === eq.activeWeaponSetId) || null;
  eq.weapon = active?.weapon || null;
  eq.shield = active?.shield || null;
  return active;
}
function ensureEquipment(actor) {
  if (!actor.equipment) actor.equipment = createEquipment();
  const eq = actor.equipment;
  if (!eq.rangedAttack) eq.rangedAttack = createRangedAttackComponent(BOW_ATTACK);
  if (!eq.autoAttack) eq.autoAttack = createAutoAttackComponent();
  if (!Array.isArray(eq.weaponSets)) eq.weaponSets = [];
  if (!Number.isFinite(eq.nextWeaponSetId)) eq.nextWeaponSetId = eq.weaponSets.length + 1;
  if (!eq.weaponSets.length && (eq.weapon || eq.shield)) {
    eq.weaponSets.push({ id: `legacy_${eq.nextWeaponSetId++}`, weapon: eq.weapon || null, shield: eq.weapon === 'bow' ? null : (eq.shield || null) });
  }
  syncActiveEquipmentSet(eq);
  return eq;
}
const TREE_GROWTH = {
  sapling: { radius: 7, maxHp: 1, next: 'small_tree', growSeconds: 8 },
  small_tree: { radius: 13, maxHp: 2, next: 'grown_tree', growSeconds: 10 },
  grown_tree: { radius: 20, maxHp: 4, next: null, growSeconds: 0 }
};
const STORY_ITEM_TYPES = ['camper_van', 'hammock', 'ultrabook', 'solar_panel', 'power_station', 'portable_3d_printer', 'assembler', 'robotics_parts'];
const ITEM_TYPES = ['log', 'plank', 'pole', 'stick', 'stone', 'tree_seed', 'crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer', 'wooden_sword', 'wooden_shield', 'hemp', 'hemp_seed', 'bow', 'arrow_pack', ...STORY_ITEM_TYPES, ...BUILDING_KIT_ITEM_TYPES];
const ITEM_LABELS = { log: 'log', plank: 'plank', pole: 'pole', stick: 'stick', stone: 'stone', tree_seed: 'tree seed', crude_axe: 'crude axe', crude_pickaxe: 'crude pickaxe', crude_shovel: 'crude shovel', crude_hammer: 'crude hammer', wooden_sword: 'wooden sword', wooden_shield: 'wooden shield', hemp: 'hemp', hemp_seed: 'hemp seed', bow: 'bow', arrow_pack: 'arrow pack', camper_van: 'white camper van', hammock: 'hammock', ultrabook: 'ultrabook laptop', solar_panel: 'solar panel', power_station: 'power station', portable_3d_printer: 'portable 3d printer', assembler: 'portable assembler', robotics_parts: 'DIY robotics parts' };
const itemLabel = type => isBuildingKitItemType(type) ? buildingKitLabel(type) : (ITEM_LABELS[type] || type);
const STORAGE_STRUCTURE_TYPES = ['item_palette', 'power_station', 'robotics_parts_bin'];
const STRUCTURE_INFO = {
  sawbench: 'Processes wood into construction parts.',
  workbench: 'Crafts crude tools from basic materials.',
  factory: 'Assembles new Basic Bots when stocked.',
  smithery: 'Military building that turns wood into starter weapons.',
  bowmaker: 'Military building that binds sticks and hemp into bows.',
  arrowmaker: 'Military building that fletches sticks and stone into arrow packs.',
  defensetower: 'Military building with a reusable ranged-attack component. Fires one 1 HP arrow per second at hostile targets in range.',
  item_palette: 'Stores one item type for pickup tasks.',
  throne: 'Multiplayer objective. Destroy the enemy throne to win.',
  camper_van: "Simple white camper van: the character's mobile base for driving to the childhood lake.",
  hammock_camp: 'Rest camp built around the bought hammock for sleeping by the lake.',
  ultrabook_desk: 'Remote-work field desk with the ultrabook laptop open.',
  solar_array: 'Fold-out solar panels for charging the camp kit.',
  power_station: 'Portable battery station that stores power-oriented story objects.',
  portable_3d_printer: 'Portable 3D printer for field fabrication.',
  assembler: 'Portable assembler with a small robotic arm for DIY automation.',
  robotics_parts_bin: 'Parts bin for DIY robotics components.'
};
function structureRecipeText(s) {
  if (s.type === 'sawbench') return '1 log → 2 planks; 1 plank → 2 wood poles. Last depositor works the job.';
  if (s.type === 'workbench') return `1 stick + 1 stone → 1 selected crude tool. Current: ${itemLabel(workbenchRecipe(s))}. Last depositor works the job.`;
  if (s.type === 'smithery') return `1 ${smitheryRecipe(s) === 'wooden_sword' ? 'stick' : 'plank'} → 1 ${itemLabel(smitheryRecipe(s))}. Current mode: ${itemLabel(smitheryRecipe(s))}. Last depositor works the job.`;
  if (s.type === 'bowmaker') return '2 sticks + 3 hemp → 1 bow. Last depositor works the long build.';
  if (s.type === 'arrowmaker') return '1 stick + 1 stone → 1 arrow pack. Packs load 10 arrows when equipped. Last depositor works the fletching job.';
  if (s.type === 'defensetower') return 'No recipe: auto-fires arrows at enemies in range; 1 HP damage, 1 arrow per second.';
  if (s.type === 'factory') return `${Object.entries(FACTORY_BOT_RECIPE).map(([type, cost]) => `${cost} ${itemLabel(type)}${cost === 1 ? '' : 's'}`).join(' + ')} → 1 Basic Bot. Last depositor assembles it.`;
  if (s.type === 'assembler') return `${Object.entries(ASSEMBLER_KIT_RECIPE).map(([type, cost]) => `${cost} ${itemLabel(type)}${cost === 1 ? '' : 's'}`).join(' + ')} → 1 ${itemLabel(assemblerRecipe(s))}. Current: ${itemLabel(assemblerRecipe(s))}.`;
  if (s.type === 'item_palette') return `No crafting recipe; stores up to ${s.capacity || BUILDING_TYPES.item_palette.capacity || 0} of one item type.`;
  if (s.type === 'power_station') return `No crafting recipe; stores up to ${s.capacity || BUILDING_TYPES.power_station.capacity || 0} power-kit items.`;
  if (s.type === 'robotics_parts_bin') return `No crafting recipe; stores up to ${s.capacity || BUILDING_TYPES.robotics_parts_bin.capacity || 0} robotics parts.`;
  if (['camper_van', 'hammock_camp', 'ultrabook_desk', 'solar_array', 'portable_3d_printer', 'assembler'].includes(s.type)) return STRUCTURE_INFO[s.type] || 'Story camp object.';
  return 'No recipe defined.';
}
function createCarriedTool(type) {
  return { type, count: 1, durability: TOOL_DURABILITY[type] || 1 };
}

export class Game {
  constructor({ canvas, chat, dom, isChatActive = () => false, renderBackend = null }) {
    this.canvas = canvas; this.renderBackend = renderBackend || createCanvas2dRenderer({ canvas }); this.ctx = this.renderBackend.ctx || null; this.chat = chat; this.dom = dom; this.isChatActive = isChatActive;
    this.W = canvas.width; this.H = canvas.height; this.keys = new Set();
    this.map = { ...WORLD_MAP_SIZE };
    this.gameMode = 'test';
    this.camera = { x: 0, y: 0, speed: 520, fastMultiplier: 2.35, zoom: 1, minZoom: CAMERA_MIN_ZOOM, maxZoom: CAMERA_MAX_ZOOM };
    this.player = { x: 480, y: 410, r: 13, speed: 170, target: null, targetQueue: [], inventory: null, equipment: createEquipment(), ammunition: 0, attackCooldown: 0, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, facingX: 1, facingY: 0, dead: false, lastDamageTime: -Infinity, regenTimer: 0 };
    this.assistant = { x: 452, y: 392, facingX: 1, facingY: 0 };
    this.trees = []; this.hempPlants = []; this.rocks = []; this.holes = []; this.items = []; this.bots = []; this.structures = []; this.monsters = []; this.projectiles = []; this.floaters = []; this.mapFeatures = []; this.mapFeatures = [];
    this.dayNight = { cycleSeconds: DAY_NIGHT_CYCLE_SECONDS };
    this.fogOfWar = createFogOfWar();
    this.nightSpawns = { active: false, timer: 1.5, spawnedThisNight: 0 };
    this.paused = false;
    this.multiplayer = { enabled: false, sessionId: null, role: 'solo', playerId: 'p1', status: 'Solo prototype', players: {}, winner: null, syncTimer: 0 };
    this.recorder = { recording: false, steps: [], lastAssignedBotId: null, targetBotId: null, status: '' };
    this.teachPanelOpened = false;
    this.teachLocationEdit = null;
    this.draggedTeachStepIndex = null;
    this.botMenuEdit = null;
    this.botMenuEditRoot = null;
    this.dogPopupState = null;
    this.botSearchQuery = '';
    this.botDrawerDragging = false;
    this.botTeams = [];
    this.nextBotTeamId = 1;
    this.customTemplates = [];
    this.nextCustomTemplateId = 1;
    this.managerKnowledgePackCatalog = null;
    this.managerMessageHandler = null;
    this.getDefaultManagerKnowledgePacks = null;
    this.managerMessageLog = [];
    this.recordedLoop = [];
    this.zones = clone(DEFAULT_WORLD_ZONES); this.nextZoneId = 1;
    this.idleDepot = { x: 115, y: 245, label: 'idle depot' };
    this.nextItemId = 1; this.nextRockId = 1; this.nextHoleId = 1; this.nextTreeId = 1; this.nextHempId = 1; this.nextMonsterId = 1; this.nextProjectileId = 1; this.nextBotId = 1; this.nextStructureId = 1;
    this.maxBots = 24; this.targetFps = 30; this.dynamicShadowsEnabled = false; this.lightingEffectsEnabled = true; this.showFpsOverlay = true; this.fps = 0; this.frameCount = 0; this.fpsAcc = 0; this.lastFrame = 0; this.worldTime = 0; this._lastFogSignature = '';
    this.mouse = { x: 0, y: 0, screenX: 0, screenY: 0, clientX: 0, clientY: 0, hoverBot: null, hoverStructure: null, hoverMonster: null, hoverTree: null, hoverHole: null, hoverItem: null, hoverHemp: null, hoverZone: null };
    this.placementType = null; this.zoneDraft = null; this.zoneDrag = null; this.zoneResize = null; this.justDrewZone = false; this.justDraggedZone = false;
    this.renderer = { text: this.renderBackend?.text || 'Renderer pending', webgpu: false, reason: 'not probed', backend: this.renderBackend?.kind || 'canvas2d' };
    this.audio = null;
    this.lastBotListUpdate = 0;
    this.resizeCanvas(false);
    this.initWorld(); this.bindCanvas(); this.bindBotDrawerControls();
    window.addEventListener('resize', () => this.resizeCanvas(true), { passive: true });
  }






  emitSound(name, detail = {}) {
    const alias = { pickup_item: 'pickup', take_from_storage: 'storage', deposit_to_structure: 'deposit', search_tree: 'search', search_hemp: 'search', chop_tree: 'chop', chop_hemp: 'chop', mine_stone: 'mine', attack_target: 'hit', attack_throne: 'hit', structure_processing: 'craft_start' };
    try { this.audio?.play?.(alias[name] || name, detail); } catch {}
  }




  dayNightPhase() { return (((this.worldTime || 0) % DAY_NIGHT_CYCLE_SECONDS) + DAY_NIGHT_CYCLE_SECONDS) % DAY_NIGHT_CYCLE_SECONDS / DAY_NIGHT_CYCLE_SECONDS; }
  getDayNightState() {
    const phase = this.dayNightPhase();
    const daylight = clamp((Math.cos((phase - 0.25) * Math.PI * 2) + 1) / 2, 0, 1);
    const nightAmount = clamp(1 - daylight * 1.18, 0, 1);
    const label = phase >= NIGHT_PHASE_START || phase < NIGHT_PHASE_END ? 'Night' : phase < 0.3 ? 'Dawn' : phase < 0.52 ? 'Day' : 'Dusk';
    return { phase, daylight, nightAmount, label, cycleSeconds: DAY_NIGHT_CYCLE_SECONDS, isNight: label === 'Night' };
  }
  isNightTime() { return this.getDayNightState().isNight; }
  isLightEmittingStructure(s) { return isFogLightEmittingStructure(s); }
  structureLightRadius(s) { return fogStructureLightRadius(s); }
  fogSources() {
    return createFogRevealSources({ player: this.player, assistant: this.assistant, bots: this.bots, structures: this.structures, multiplayer: this.multiplayer });
  }
  markFogExplored(x, y, radius) {
    this.fogOfWar = revealFogCircle(this.fogOfWar, { x, y, radius }, { map: this.map, time: this.worldTime, visible: true });
  }
  updateFogOfWar() {
    if (!this.fogOfWar?.enabled) {
      if (this.fogOfWar?.visible && Object.keys(this.fogOfWar.visible).length) this.fogOfWar = { ...this.fogOfWar, visible: {} };
      this._lastFogSignature = '';
      return;
    }
    const sources = this.fogSources();
    const cell = this.fogOfWar.cellSize || FOG_CELL_SIZE;
    const signature = sources.map(source => `${source.kind}:${Math.floor(source.x / cell)},${Math.floor(source.y / cell)}:${Math.round(source.radius || 0)}`).join('|');
    if (signature === this._lastFogSignature && (this.fogOfWar.revision || 0) > 0) return;
    this._lastFogSignature = signature;
    this.fogOfWar = updateFogOfWarState(this.fogOfWar, { map: this.map, sources, time: this.worldTime });
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
    this.spawnStarterDog(452, 436);
    this.spawnItem('log', 285, 500, 3); this.spawnItem('stick', 410, 500, 5); this.spawnItem('tree_seed', 535, 500, 3); this.spawnItem('crude_axe', 610, 500, STARTING_AXE_COUNT); this.spawnItem('crude_pickaxe', 665, 500, STARTING_PICKAXE_COUNT); this.spawnItem('crude_shovel', 720, 500, STARTING_SHOVEL_COUNT);
  }









  findTargetByRef(ref) {
    if (!ref) return null;
    if (ref === 'player:local') { Object.assign(this.player, { ref: 'player:local', id: this.multiplayer?.playerId || 'p1' }); return (this.player.hp ?? 1) > 0 ? this.player : null; }
    if (ref.startsWith('monster:')) return this.monsters.find(m => m.ref === ref && (m.hp || 0) > 0) || null;
    if (ref.startsWith('bot:')) return this.bots.find(b => b.ref === ref && (b.hp ?? 1) > 0) || null;
    if (ref.startsWith('player:')) { const player = Object.values(this.multiplayer?.players || {}).find(p => `player:${p.id}` === ref && (p.hp ?? 10) > 0) || null; if (player) player.ref = `player:${player.id}`; return player; }
    if (ref.startsWith('structure:')) return this.structures.find(st => st.ref === ref && (st.hp ?? 1) > 0) || null;
    return null;
  }
  openHoleInZone(hole, zone, anchor = null) { return hole && !hole.planted && this.objectInZone(hole, zone, anchor); }
  nearestOpenHole(x, y, zone = null, maxDistance = Infinity, reservedBy = null, anchor = null) {
    return nearest(this.holes, x, y, h => this.openHoleInZone(h, zone, anchor) && (!h.reservedBy || h.reservedBy === reservedBy) && distXY(x, y, h.x, h.y) <= maxDistance);
  }
  addFloat(text, x, y, color = '#e5ece8') {
    const existing = this.floaters.find(f => f.text === text && distXY(f.x, f.y, x, y) < 8);
    if (existing) {
      Object.assign(existing, { x, y, color, life: existing.max || 1.3 });
      return;
    }
    this.floaters.push({ text, x, y, color, life: 1.3, max: 1.3 });
  }

  normalizeDogFetchMemory(memory = null) {
    const praiseCounts = Object.fromEntries(Object.entries(memory?.praiseCounts || memory?.praises || {})
      .map(([type, count]) => [this.normalizeItemType(type, null), Math.max(0, Math.floor(Number(count) || 0))])
      .filter(([type]) => !!type));
    const preferredType = this.normalizeItemType(memory?.preferredType || memory?.lastTargetType || memory?.targetType || null, null);
    const lastTargetType = this.normalizeItemType(memory?.lastTargetType || memory?.targetType || null, null);
    return { praiseCounts, preferredType, lastTargetType };
  }
  normalizeDogFetchState(state = null) {
    if (!state || typeof state !== 'object') return null;
    const requestedType = this.normalizeItemType(state.requestedType || state.targetType || null, null);
    const targetType = this.normalizeItemType(state.targetType || requestedType || null, null);
    const targetItemId = Number.isFinite(Number(state.targetItemId)) ? Number(state.targetItemId) : null;
    return {
      requestedText: String(state.requestedText || state.command || '').trim(),
      requestedType,
      targetType,
      targetItemId,
      awaitingReward: !!state.awaitingReward,
      source: String(state.source || 'dog menu').trim() || 'dog menu'
    };
  }
  spawnStarterDog(x, y) {
    const dog = this.createBot(x, y, 'dog_fetch', true);
    if (!dog) return null;
    dog.kind = 'dog';
    dog.knowledgePacks = ['dog_fetch'];
    dog.dogFetchMemory = this.normalizeDogFetchMemory(dog.dogFetchMemory);
    dog.dogFetchState = null;
    dog.program = 'dog_fetch';
    dog.state = 'dog_fetch';
    dog.name = 'Dog';
    dog.message = 'Following the player.';
    dog.dogFetchState = null;
    this.syncBotDrawerUi?.(true);
    return dog;
  }
  showDogPopup(bot, mode = null) {
    if (!bot) return;
    this.dogPopupState = { botId: bot.id, mode: mode || (bot.inventory ? 'reward' : 'progress') };
    this.syncDogPopupUi(true);
  }
  isDogFetchPraiseAllowed(bot) {
    if (!bot || !bot.inventory) return false;
    const request = this.normalizeDogFetchState(bot.dogFetchState);
    if (!request?.requestedType) return true;
    return bot.inventory.type === request.requestedType;
  }
  dogFetchPraiseProgress(bot) {
    const memory = this.normalizeDogFetchMemory(bot?.dogFetchMemory);
    const entries = Object.entries(memory.praiseCounts || {}).filter(([, count]) => Number(count) > 0).sort((a, b) => b[1] - a[1]);
    return entries.map(([type, count]) => ({ type, count, ratio: Math.min(1, count / DOG_FETCH_PRAISE_TARGET) }));
  }
  closeDogPopup() {
    window.voiceInputDebug?.clearVoiceTargetInput?.();
    if (this.dom.dogPopup) this.dom.dogPopup.hidden = true;
    this.dogPopupState = null;
  }
  placeDogPopup(el, bot, { above = 52 } = {}) {
    const point = this.worldToScreen(bot.x, bot.y - (bot.r || 11) - above);
    const pad = 12;
    const width = Math.min(320, Math.max(240, el.offsetWidth || 280));
    const height = Math.min(340, Math.max(120, el.offsetHeight || 160));
    const x = clamp(point.x, width / 2 + pad, Math.max(width / 2 + pad, window.innerWidth - width / 2 - pad));
    const y = clamp(point.y, height + pad, Math.max(height + pad, window.innerHeight - pad));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%, -100%)';
  }
  dogPopupRenderKey(bot, mode) {
    const request = this.normalizeDogFetchState(bot?.dogFetchState);
    const praiseCounts = bot?.dogFetchMemory?.praiseCounts || {};
    return JSON.stringify({
      botId: bot?.id || null,
      mode,
      carrying: !!bot?.inventory,
      itemType: bot?.inventory?.type || null,
      requestedType: request?.requestedType || null,
      targetType: request?.targetType || null,
      praiseCounts
    });
  }
  renderDogPopup(bot, mode = 'progress') {
    const el = this.dom.dogPopup;
    if (!el || !bot) return;
    const carrying = !!bot.inventory;
    const requestedType = this.normalizeDogFetchState(bot.dogFetchState)?.requestedType || null;
    const currentType = bot.inventory?.type || null;
    const isReward = mode === 'reward' && carrying;
    const progress = this.dogFetchPraiseProgress(bot);
    const draft = bot.dogCommandDraft || '';
    const currentLabel = currentType ? itemLabel(currentType) : '';
    const requestedLabel = requestedType ? itemLabel(requestedType) : '';
    const progressSummary = progress.length
      ? progress.map(entry => `<div class="dog-progress-row"><span>${escapeHtml(itemLabel(entry.type))}</span><span>${entry.count}/${DOG_FETCH_PRAISE_TARGET}</span><div class="dog-progress-bar"><i style="width:${Math.round(entry.ratio * 100)}%"></i></div></div>`).join('')
      : '<p class="dog-popup-empty">No fetches praised yet.</p>';
    const rewardSummary = requestedType
      ? `Requested ${escapeHtml(requestedLabel)}. Brought ${escapeHtml(currentLabel)}.`
      : `Brought ${escapeHtml(currentLabel)}.`;
    el.innerHTML = isReward
      ? `<div class="dog-popup-panel dog-popup-reward" data-dog-popup-panel><header><b>Good dog?</b><span>${escapeHtml(currentLabel)}</span></header><p class="dog-popup-summary">${rewardSummary}</p><div class="dog-popup-buttons"><button type="button" class="dog-popup-button is-yes" data-dog-popup-praise${this.isDogFetchPraiseAllowed(bot) ? '' : ' data-disabled="true" aria-disabled="true"'} aria-label="Praise dog">✓</button><button type="button" class="dog-popup-button is-no" data-dog-popup-reject aria-label="Reject dog">✕</button></div><p class="dog-popup-hint">${requestedType ? `Praise only works for ${escapeHtml(requestedLabel)}.` : 'Praise increases the learned chance for this item type.'}</p></div>`
      : `<div class="dog-popup-panel dog-popup-progress" data-dog-popup-panel><header><b>Dog fetch</b><span>Learning progress</span></header><label class="dog-fetch-input dog-popup-input"><span>Teach command</span><input data-dog-fetch-command placeholder="go fetch me a stick" value="${escapeHtml(draft)}" autocomplete="off"></label><div class="dog-popup-actions"><button type="button" data-dog-fetch-submit>Send</button><button type="button" data-dog-popup-mic aria-label="Dictate command">Mic</button></div><p class="dog-popup-hint">The dog follows you, picks up nearby items, then comes back for praise.</p><div class="dog-popup-progress-list">${progressSummary}</div><p class="dog-popup-hint">10 praises for one item type makes it a guaranteed choice when that item is available.</p></div>`;
    el.dataset.dogPopupKey = this.dogPopupRenderKey(bot, mode);
    if (!el.dataset.dogPopupBound) {
      el.dataset.dogPopupBound = 'true';
    }
    const handleRewardAction = action => {
      const state = this.dogPopupState;
      const currentBot = state?.botId ? this.findBot(state.botId) : null;
      if (!currentBot) return;
      if (action === 'praise') {
        if (!this.isDogFetchPraiseAllowed(currentBot)) {
          const btn = el.querySelector('[data-dog-popup-praise]');
          if (btn) {
            btn.classList.remove('is-wobble');
            void btn.offsetWidth;
            btn.classList.add('is-wobble');
            setTimeout(() => btn.classList.remove('is-wobble'), 280);
          }
          currentBot.message = 'Not possible.';
          this.emitSound('ui_error', { cooldownKey: `dog:not_possible:${currentBot.id}`, minGapMs: 150 });
          this.renderDogPopup(currentBot, 'reward');
          return;
        }
        const res = this.praiseDogFetch(currentBot);
        if (res.ok) this.closeDogPopup();
        return;
      }
      if (action === 'reject') {
        const res = this.rejectDogFetch(currentBot);
        if (res.ok) this.closeDogPopup();
      }
    };
    el.querySelector('[data-dog-popup-praise]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handleRewardAction('praise');
    });
    el.querySelector('[data-dog-popup-reject]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handleRewardAction('reject');
    });
    el.querySelector('[data-dog-popup-praise]')?.addEventListener('pointerdown', event => event.stopPropagation());
    el.querySelector('[data-dog-popup-reject]')?.addEventListener('pointerdown', event => event.stopPropagation());
    this.placeDogPopup(el, bot, { above: isReward ? 58 : 54 });
    el.hidden = false;
    requestAnimationFrame(() => {
      const input = el.querySelector('[data-dog-fetch-command]');
      if (input) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(0, input.value.length);
      }
    });
  }
  syncDogPopupUi(force = false) {
    const el = this.dom.dogPopup;
    if (!el) return;
    const state = this.dogPopupState;
    const bot = state?.botId ? this.findBot(state.botId) : this.bots.find(entry => entry.kind === 'dog' && entry.inventory && distXY(entry.x, entry.y, this.player.x, this.player.y) <= 64) || this.bots.find(entry => entry.kind === 'dog') || null;
    if (!bot || (!state && !bot.inventory)) { if (!force) el.hidden = true; return; }
    const carrying = !!bot.inventory;
    const nearPlayer = carrying && distXY(bot.x, bot.y, this.player.x, this.player.y) <= 72;
    const mode = carrying && nearPlayer ? 'reward' : (state?.mode || 'progress');
    if (!carrying && mode === 'reward') {
      el.hidden = true;
      return;
    }
    this.dogPopupState = { botId: bot.id, mode };
    const renderKey = this.dogPopupRenderKey(bot, mode);
    const shouldRender = force || el.hidden || el.dataset.dogPopupKey !== renderKey;
    if (shouldRender) this.renderDogPopup(bot, mode);
    else if (mode !== 'reward') this.placeDogPopup(el, bot, { above: carrying ? 58 : 54 });
    if (!shouldRender) return;
    el.querySelector('[data-dog-fetch-submit]')?.addEventListener('click', () => {
      const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
      const res = this.setDogFetchCommand(bot, text);
      if (res.ok) this.renderDogPopup(bot, 'progress');
    });
    el.querySelector('[data-dog-fetch-command]')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
        const res = this.setDogFetchCommand(bot, text);
        if (res.ok) this.renderDogPopup(bot, 'progress');
      }
    });
    el.querySelector('[data-dog-popup-mic]')?.addEventListener('click', async () => {
      const input = el.querySelector('[data-dog-fetch-command]');
      if (!input) return;
      const voice = window.voiceInputDebug;
      if (!voice) return;
      if (voice.isRecording?.()) {
        await voice.stopVoice?.();
        voice.clearVoiceTargetInput?.();
      } else {
        voice.setVoiceTargetInput?.(input);
        await voice.startVoice?.();
      }
    });
  }
  extractDogRequestedItemType(text) {
    const lower = String(text || '').toLowerCase();
    const candidates = ['arrow pack', 'log', 'plank', 'pole', 'stick', 'stone', 'tree seed', 'hemp seed', 'hemp', 'crude axe', 'crude pickaxe', 'crude shovel', 'crude hammer', 'wooden sword', 'wooden shield', 'bow'];
    for (const candidate of candidates) {
      if (new RegExp(`\\b${candidate.replace(/ /g, '\\s+')}\\b`).test(lower)) {
        const type = this.normalizeItemType(candidate, null);
        if (type && !this.isEquipmentItem(type)) return type;
      }
    }
    return null;
  }
  chooseDogFetchTargetType(bot, requestedType = null) {
    const nearbyItems = this.items.filter(item => distXY(bot.x, bot.y, item.x, item.y) <= DOG_FETCH_SEARCH_RADIUS && (!item.reservedBy || item.reservedBy === bot.id) && !this.isEquipmentItem(item.type));
    if (!nearbyItems.length) return null;
    if (requestedType) {
      const exactItems = nearbyItems.filter(item => item.type === requestedType);
      if (exactItems.length) return exactItems[0].type;
    }
    const memory = this.normalizeDogFetchMemory(bot.dogFetchMemory);
    const praiseCounts = memory.praiseCounts || {};
    const countsByType = nearbyItems.reduce((acc, item) => {
      acc[item.type] = Math.max(acc[item.type] || 0, praiseCounts[item.type] || 0);
      return acc;
    }, {});
    const sorted = Object.entries(countsByType).sort((a, b) => b[1] - a[1]);
    const [bestType, bestCount] = sorted[0] || [];
    if (bestType && bestCount > 0) {
      const chance = Math.min(1, bestCount / DOG_FETCH_PRAISE_TARGET);
      if (chance >= 1 || Math.random() < chance) return bestType;
    }
    return nearbyItems[Math.floor(Math.random() * nearbyItems.length)]?.type || null;
  }
  setDogFetchCommand(botRef, text) {
    const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
    if (!bot) return { ok: false, error: `Bot ${botRef} not found` };
    if (bot.inventory) return { ok: false, error: 'Dog must have empty paws before a new fetch command.' };
    if (!this.isDogBot(bot)) return { ok: false, error: 'Only the starter dog can learn fetch commands.' };
    const requestedText = String(text || '').trim();
    const requestedType = this.extractDogRequestedItemType(requestedText);
    const targetType = this.chooseDogFetchTargetType(bot, requestedType);
    bot.dogCommandDraft = requestedText;
    bot.dogFetchState = this.normalizeDogFetchState({ requestedText, requestedType, targetType, targetItemId: null, awaitingReward: false, source: 'dog menu' });
    bot.program = 'dog_fetch';
    bot.state = 'dog_fetch';
    bot.message = targetType ? `Fetching ${itemLabel(targetType)}.` : 'No nearby item to fetch.';
    this.releaseReservation(bot);
    this.syncDogPopupUi?.(true);
    this.syncBotDrawerUi?.(true);
    return { ok: true, bot, targetType };
  }
  praiseDogFetch(botRef) {
    const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
    if (!bot || !this.isDogBot(bot) || !bot.inventory) return { ok: false, error: 'Dog has no fetched item to praise.' };
    const type = bot.dogFetchState?.targetType || bot.inventory.type;
    bot.dogFetchMemory = this.normalizeDogFetchMemory(bot.dogFetchMemory);
    bot.dogFetchMemory.praiseCounts[type] = (bot.dogFetchMemory.praiseCounts[type] || 0) + 1;
    bot.dogFetchMemory.preferredType = type;
    bot.dogFetchMemory.lastTargetType = type;
    if (this.canPlayerAcceptItem(type)) {
      this.player.inventory = { type, count: bot.inventory.count || 1 };
      this.addFloat(`Good dog: ${itemLabel(type)} delivered`, bot.x, bot.y - 34, '#9abf8f');
    } else {
      this.spawnItem(type, bot.x + 8, bot.y + 8, bot.inventory.count || 1);
      this.addFloat(`Good dog: dropped ${itemLabel(type)}`, bot.x, bot.y - 34, '#9abf8f');
    }
    bot.inventory = null;
    bot.dogFetchState = null;
    bot.target = null;
    this.releaseReservation(bot);
    bot.message = 'Awaiting fetch command.';
    this.closeDogPopup();
    this.syncBotDrawerUi?.(true);
    return { ok: true, bot, type, praiseCount: bot.dogFetchMemory.praiseCounts[type] };
  }
  rejectDogFetch(botRef) {
    const bot = botRef && typeof botRef === 'object' ? botRef : this.resolveBotReference(botRef);
    if (!bot || !this.isDogBot(bot) || !bot.inventory) return { ok: false, error: 'Dog has no fetched item to reject.' };
    const type = bot.inventory.type;
    this.spawnItem(type, bot.x + 8, bot.y + 8, bot.inventory.count || 1);
    bot.inventory = null;
    bot.dogFetchState = null;
    bot.target = null;
    this.releaseReservation(bot);
    bot.message = `Rejected ${itemLabel(type)}.`;
    this.addFloat(`Dog dropped ${itemLabel(type)}`, bot.x, bot.y - 34, '#c86b5f');
    this.closeDogPopup();
    this.syncBotDrawerUi?.(true);
    return { ok: true, bot, type };
  }
  delegateMessageToManager(senderBot, recipientRef, message, { throttleKey = '' } = {}) {
    const manager = recipientRef && typeof recipientRef === 'object' ? recipientRef : this.resolveBotReference(recipientRef);
    const clean = this.sanitizeManagerMessage(message);
    if (!manager) return { ok: false, error: `Manager ${recipientRef} not found` };
    if (!this.isManagerBot(manager)) return { ok: false, error: `${this.botDisplayName(manager)} is not a manager` };
    if (!clean) return { ok: false, error: 'delegate_to_manager requires message' };
    const key = throttleKey || `${senderBot?.id || 'manual'}:${manager.id}:${clean}`;
    const throttleActor = senderBot || manager;
    throttleActor.runtime ||= { pc: 0, memory: {}, wait: 0 };
    throttleActor.runtime.managerDelegations ||= {};
    const now = this.worldTime || 0;
    const last = throttleActor.runtime.managerDelegations[key] || -Infinity;
    if (now - last < MANAGER_DELEGATE_THROTTLE_SECONDS) return { ok: true, throttled: true, manager, message: clean };
    throttleActor.runtime.managerDelegations[key] = now;
    const entry = { at: now, senderBotId: senderBot?.id || null, managerBotId: manager.id, message: clean, packs: (manager.managerKnowledgePacks || []).slice() };
    this.managerMessageLog.push(entry);
    if (this.managerMessageLog.length > 50) this.managerMessageLog.shift();
    manager.message = `Manager received: ${clean}`;
    const handled = this.managerMessageHandler?.({ manager, sender: senderBot, message: clean, entry, game: this });
    return { ok: true, manager, message: clean, handled, entry };
  }
  normalizeAttackType(value) {
    const raw = String(value || 'monster').toLowerCase().replace(/[\s-]+/g, '_').trim();
    const aliases = { enemy: 'monster', enemies: 'monster', hostile: 'monster', hostiles: 'monster', monsters: 'monster', night: 'night_monster', night_monsters: 'night_monster', passive_monsters: 'passive_monster', tower: 'structure', towers: 'structure', throne: 'structure' };
    return aliases[raw] || raw || 'monster';
  }
  normalizeTemplateName(name) { return String(name || '').trim().replace(/\s+/g, ' '); }
  findCustomTemplate(nameOrId) {
    const raw = this.normalizeTemplateName(nameOrId).toLowerCase();
    return (this.customTemplates || []).find(template => String(template.id || '').toLowerCase() === raw || String(template.name || '').toLowerCase() === raw) || null;
  }
  saveRecordedLoopAsTemplate(name) {
    if (this.recorder.recording) this.stopTeachRecording();
    const templateName = this.normalizeTemplateName(name);
    if (!templateName) return { ok: false, error: 'Template name is required.' };
    const source = this.recordedLoop.length ? this.recordedLoop : this.recorder.steps;
    if (!source.length) return { ok: false, error: 'Record at least one teach-by-doing step before saving a template.' };
    const steps = clone(source).map(step => ({ ...step, text: this.stepText(step) }));
    const existing = this.findCustomTemplate(templateName);
    const now = new Date().toISOString();
    const template = existing || { id: `template:${this.nextCustomTemplateId}`, numericId: this.nextCustomTemplateId++ };
    Object.assign(template, { name: templateName, steps, updatedAt: now, createdAt: template.createdAt || now });
    if (!existing) this.customTemplates.push(template);
    this.recorder.status = `Saved template ${template.name} (${steps.length} steps).`;
    this.syncTemplateDrawerUi();
    this.syncTeachUi();
    this.addFloat(`Saved template: ${template.name}`, this.player.x, this.player.y - 46, '#9abf8f');
    return { ok: true, template: clone(template) };
  }
  deleteCustomTemplate(nameOrId) {
    const template = this.findCustomTemplate(nameOrId);
    if (!template) return { ok: false, error: 'Template not found.' };
    this.customTemplates = this.customTemplates.filter(item => item !== template);
    this.syncTemplateDrawerUi();
    return { ok: true, template: clone(template) };
  }
  assignTemplateToBot(botRef, templateName, { actorBot = null, reason = '' } = {}) {
    const bot = this.resolveBotReference(botRef);
    if (!bot) return { ok: false, error: `Bot ${botRef} not found` };
    const template = this.findCustomTemplate(templateName);
    if (!template) return { ok: false, error: `Template ${templateName} not found` };
    const checked = this.validateDslProgram({ id: template.id, name: template.name, steps: template.steps });
    if (!checked.ok) return { ok: false, error: `Template ${template.name} is invalid: ${checked.error}`, validation: checked };
    bot.paused = false;
    bot.program = 'taught_loop';
    bot.state = 'taught_loop';
    bot.message = reason || `Assigned template: ${template.name}`;
    bot.customTemplateName = template.name;
    bot.taughtLoop = clone(checked.program.steps);
    bot.taughtLoopRepeat = checked.program.repeat !== false;
    bot.runtime = { pc: 0, memory: {}, wait: 0 };
    bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0;
    this.addFloat(`Bot ${bot.id}: ${template.name}`, bot.x, bot.y - 22, '#d3a95f');
    if (!actorBot || actorBot.id !== bot.id) this.syncBotDrawerUi?.();
    this.syncTemplateDrawerUi();
    return { ok: true, bot, template: clone(template), steps: clone(bot.taughtLoop) };
  }
  renderTemplateSteps(steps = []) {
    if (!steps.length) return '<ol class="teach-steps"><li class="empty">No steps saved.</li></ol>';
    return `<ol class="teach-steps">${steps.map((step, index) => `<li class="teach-step-card"><div class="step-card-main"><b class="step-card-number">${index + 1}.</b><code>${escapeHtml(step.text || this.stepText(step))}</code></div></li>`).join('')}</ol>`;
  }
  renderTemplateCard(template) {
    const steps = template.steps || [];
    const updated = template.updatedAt ? new Date(template.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `<article class="template-card" data-template-id="${escapeHtml(template.id)}"><header><b>${escapeHtml(template.name)}</b><small>${steps.length} step${steps.length === 1 ? '' : 's'}${updated ? ` · ${escapeHtml(updated)}` : ''}</small></header>${this.renderTemplateSteps(steps)}<div class="template-card-actions"><label>Assign to bot <input data-template-bot-id="${escapeHtml(template.id)}" type="number" min="1" value="1"></label><button type="button" data-assign-template="${escapeHtml(template.id)}">Assign</button><button type="button" data-delete-template="${escapeHtml(template.id)}">Delete</button></div></article>`;
  }
  syncTemplateDrawerUi() {
    const list = this.dom?.templateList;
    if (!list) return;
    if (!this.customTemplates?.length) {
      list.innerHTML = '<p class="empty">No saved templates yet. Use Teach by doing, stop recording, enter a name, then save.</p>';
      return;
    }
    list.innerHTML = this.customTemplates.map(template => this.renderTemplateCard(template)).join('');
  }

  itemAt(x, y) { return nearest(this.items, x, y, i => distXY(x, y, i.x, i.y) <= 18) || null; }
  hempAt(x, y) { return nearest(this.hempPlants, x, y, h => !h.harvested && distXY(x, y, h.x, h.y) <= (h.radius || 14) + 8) || null; }
  structureAt(x, y) {
    for (let i = this.structures.length - 1; i >= 0; i -= 1) {
      const structure = this.structures[i];
      if (pointInRect(x, y, structure)) return structure;
    }
    return null;
  }
  holeAt(x, y) { return nearest(this.holes, x, y, h => distXY(x, y, h.x, h.y) <= 18) || null; }
  treeAt(x, y) { return nearest(this.trees, x, y, t => !t.stump && distXY(x, y, t.x, t.y) <= (t.radius || 18) + 6) || null; }
  rockAt(x, y) { return nearest(this.rocks, x, y, r => !r.depleted && distXY(x, y, r.x, r.y) <= (r.radius || 18) + 6) || null; }
  monsterAt(x, y) { return nearest(this.monsters, x, y, m => (m.hp || 0) > 0 && distXY(x, y, m.x, m.y) <= (m.radius || 18) + 8) || null; }
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
    const raw = String(text || '');
    const direct = raw.match(/radius\s*\(\s*x\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*,\s*y\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*,\s*r(?:adius)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*\)/i);
    if (direct) {
      const x = clamp(Number(direct[1]), 0, this.map.width), y = clamp(Number(direct[2]), 0, this.map.height);
      const radius = clamp(Number(direct[3]), 40, 420);
      return { kind: 'radius', x, y, radius, name: this.radiusText({ x, y, radius }) };
    }
    const lower = raw.toLowerCase();
    if (!/(around|near|um|bereich|radius|small|klein|large|groß|gross)/.test(lower)) return null;
    const structure = this.findStructureMention(lower);
    if (!structure) return null;
    const radius = /(large|groß|gross|big|weiter|weiten)/.test(lower) ? 220 : /(small|klein|kleinen|tiny)/.test(lower) ? 95 : 150;
    return { kind: 'radius', centerStructureId: structure.id, radius, name: `${radius <= 100 ? 'small' : radius >= 200 ? 'large' : 'radius'} area around ${structure.name}` };
  }
  parseNearbyZoneMention(text) {
    const raw = String(text || '').toLowerCase();
    if (!/\bnearby\b/.test(raw)) return null;
    const radiusMatch = raw.match(/\bnearby\D{0,16}(\d+(?:\.\d+)?)\b/) || raw.match(/\b(\d+(?:\.\d+)?)\D{0,16}\bnearby\b/) || raw.match(/\b(?:radius|range|within)\D{0,16}(\d+(?:\.\d+)?)\b/);
    const radius = clamp(Number(radiusMatch?.[1] || DEFAULT_NEARBY_RADIUS), 40, MAX_NEARBY_RADIUS);
    return { kind: 'nearby', radius, name: `${Math.round(radius)}px nearby around bot` };
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
  radiusText(zone) { return `radius(x:${Math.round(zone.x)},y:${Math.round(zone.y)},r:${Math.round(zone.radius || DEFAULT_RESOURCE_RADIUS)})`; }
  zoneText(zone) { return zone?.kind === 'nearby' ? `nearby ${Math.round(zone.radius || DEFAULT_NEARBY_RADIUS)}` : zone?.kind === 'radius' ? this.radiusText(zone) : this.rectangleText(zone); }
  zoneAnchorPoint(zone) {
    if (!zone) return { x: this.player.x, y: this.player.y };
    if (zone.kind === 'nearby') return { x: this.player.x, y: this.player.y - (zone.radius || DEFAULT_NEARBY_RADIUS) };
    if (zone.kind === 'radius') return { x: zone.x, y: zone.y - (zone.radius || DEFAULT_RESOURCE_RADIUS) };
    return { x: zone.x + (zone.w || 0) / 2, y: zone.y };
  }
  moveZoneFromPointer(d, x, y) {
    const z = d?.zone;
    if (!z) return;
    const b = this.zoneBounds(z);
    const nextX = clamp(x - d.offsetX, 0, Math.max(0, this.map.width - b.w));
    const nextY = clamp(y - d.offsetY, 0, Math.max(0, this.map.height - b.h));
    if (z.kind === 'radius') { const r = z.radius || DEFAULT_RESOURCE_RADIUS; z.x = nextX + r; z.y = nextY + r; }
    else { z.x = nextX; z.y = nextY; }
  }
  zoneResizeHandleAt(x, y, zone = null) {
    const scanZone = z => {
      if (!z || z.builtIn || z.hidden) return null;
      const b = this.zoneBounds(z);
      const handles = z.kind === 'radius'
        ? [{ handle: 'e', x: z.x + (z.radius || DEFAULT_RESOURCE_RADIUS), y: z.y }]
        : [{ handle: 'nw', x: b.x, y: b.y }, { handle: 'ne', x: b.x + b.w, y: b.y }, { handle: 'sw', x: b.x, y: b.y + b.h }, { handle: 'se', x: b.x + b.w, y: b.y + b.h }];
      const hit = handles.find(h => distXY(x, y, h.x, h.y) <= 6);
      return hit ? { zone: z, handle: hit.handle } : null;
    };
    if (zone) return scanZone(zone);
    for (let i = this.zones.length - 1; i >= 0; i -= 1) {
      const hit = scanZone(this.zones[i]);
      if (hit) return hit;
    }
    return null;
  }
  resizeZoneFromPointer(d, x, y) {
    const z = d?.zone;
    const b = d?.startBounds;
    if (!z || !b) return;
    if (z.kind === 'radius') {
      z.radius = clamp(distXY(z.x, z.y, x, y), 40, 420);
      z.x = clamp(z.x, z.radius, this.map.width - z.radius);
      z.y = clamp(z.y, z.radius, this.map.height - z.radius);
      return;
    }
    let left = b.x, top = b.y, right = b.x + b.w, bottom = b.y + b.h;
    if (d.handle.includes('w')) left = clamp(x, 0, right - MIN_DRAWN_ZONE_SIZE);
    if (d.handle.includes('e')) right = clamp(x, left + MIN_DRAWN_ZONE_SIZE, this.map.width);
    if (d.handle.includes('n')) top = clamp(y, 0, bottom - MIN_DRAWN_ZONE_SIZE);
    if (d.handle.includes('s')) bottom = clamp(y, top + MIN_DRAWN_ZONE_SIZE, this.map.height);
    z.x = left; z.y = top; z.w = right - left; z.h = bottom - top;
  }
  normalizeItemType(value, fallback = 'log') {
    const t = String(value || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    if (!t) return fallback;
    const kitType = this.normalizeBuildingKitItemType(value, null);
    if (kitType) return kitType;
    const aliases = { logs: 'log', log: 'log', planks: 'plank', boards: 'plank', board: 'plank', plank: 'plank', poles: 'pole', pole: 'pole', sticks: 'stick', stick: 'stick', rocks: 'stone', rock: 'stone', stones: 'stone', stone: 'stone', seeds: 'tree_seed', seed: 'tree_seed', 'tree seed': 'tree_seed', 'tree seeds': 'tree_seed', axes: 'crude_axe', axe: 'crude_axe', 'crude axe': 'crude_axe', pickaxes: 'crude_pickaxe', pickaxe: 'crude_pickaxe', 'crude pickaxe': 'crude_pickaxe', shovels: 'crude_shovel', shovel: 'crude_shovel', 'crude shovel': 'crude_shovel', hammers: 'crude_hammer', hammer: 'crude_hammer', 'crude hammer': 'crude_hammer', swords: 'wooden_sword', sword: 'wooden_sword', 'wooden sword': 'wooden_sword', shields: 'wooden_shield', shield: 'wooden_shield', 'wooden shield': 'wooden_shield', hemp: 'hemp', 'hemp fibre': 'hemp', 'hemp fiber': 'hemp', 'hemp seed': 'hemp_seed', 'hemp seeds': 'hemp_seed', bow: 'bow', bows: 'bow', camper: 'camper_van', van: 'camper_van', 'camper van': 'camper_van', 'white camper': 'camper_van', 'white camper van': 'camper_van', hammock: 'hammock', laptop: 'ultrabook', ultrabook: 'ultrabook', 'ultrabook laptop': 'ultrabook', 'solar panel': 'solar_panel', 'solar panels': 'solar_panel', battery: 'power_station', 'power station': 'power_station', printer: 'portable_3d_printer', '3d printer': 'portable_3d_printer', 'portable 3d printer': 'portable_3d_printer', assembler: 'assembler', 'portable assembler': 'assembler', parts: 'robotics_parts', 'robotics parts': 'robotics_parts', 'diy robotics parts': 'robotics_parts' };
    return aliases[t] || ITEM_TYPES.find(type => t === type || t === itemLabel(type)) || fallback;
  }
  normalizeBuildingKitItemType(value, fallback = null) {
    const raw = String(value || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    if (!raw) return fallback;
    for (const kitType of BUILDING_KIT_ITEM_TYPES) {
      const buildingType = buildingTypeFromKitItem(kitType);
      const buildingLabel = String(BUILDING_TYPES[buildingType]?.label || buildingType).toLowerCase().replace(/[_-]/g, ' ').trim();
      const forms = new Set([
        kitType,
        kitType.replace(/_/g, ' '),
        `${buildingType}_kit`,
        `${buildingType.replace(/_/g, ' ')} kit`,
        `${buildingLabel} kit`,
        buildingType,
        buildingType.replace(/_/g, ' '),
        buildingLabel,
        itemLabel(kitType)
      ].map(v => String(v || '').toLowerCase().replace(/[_-]/g, ' ').trim()));
      if (forms.has(raw)) return kitType;
    }
    return fallback;
  }
  normalizeWeaponItemType(value, fallback = null) {
    const type = this.normalizeItemType(value, fallback || String(value || '').trim());
    return this.isEquipmentItem(type) ? type : null;
  }
  normalizeSmitheryRecipe(value, fallback = DEFAULT_SMITHERY_RECIPE) {
    const raw = String(value || fallback || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    const aliases = { sword: 'wooden_sword', swords: 'wooden_sword', 'wooden sword': 'wooden_sword', wooden_sword: 'wooden_sword', shield: 'wooden_shield', shields: 'wooden_shield', 'wooden shield': 'wooden_shield', wooden_shield: 'wooden_shield' };
    return SMITHERY_RECIPES.includes(aliases[raw] || raw) ? (aliases[raw] || raw) : null;
  }
  normalizeBowmakerRecipe(value, fallback = 'bow') {
    const raw = String(value || fallback || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    return ['bow', 'bows'].includes(raw) ? 'bow' : null;
  }
  normalizeArrowmakerRecipe(value, fallback = 'arrow_pack') {
    const raw = String(value || fallback || '').toLowerCase().replace(/[_-]/g, ' ').trim();
    return ['arrow pack', 'arrow packs', 'arrow_pack', 'arrowpacks', 'arrows'].includes(raw) ? 'arrow_pack' : null;
  }
  normalizePatrolPoints(input) {
    let raw = input;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); }
      catch {
        raw = raw.split(/;|\n/).map(part => part.trim()).filter(Boolean).map(part => {
          const m = part.match(/(-?\d+(?:\.\d+)?)\D+(-?\d+(?:\.\d+)?)/);
          return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
        }).filter(Boolean);
      }
    }
    if (!Array.isArray(raw)) return [];
    return raw.map((point, index) => {
      if (Array.isArray(point)) point = { x: point[0], y: point[1], name: point[2] };
      const x = Number(point?.x ?? point?.centerX);
      const y = Number(point?.y ?? point?.centerY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x: clamp(x, 20, this.map.width - 20), y: clamp(y, 20, this.map.height - 20), name: String(point?.name || point?.label || `checkpoint ${index + 1}`) };
    }).filter(Boolean);
  }
  normalizeZoneSpec(input) {
    if (!input) return { zoneId: null, zoneSpec: null };
    if (typeof input === 'string') {
      const nearby = this.parseNearbyZoneMention(input);
      if (nearby) return { zoneId: null, zoneSpec: nearby };
      const rect = this.parseRectangleZoneMention(input);
      if (rect) return { zoneId: null, zoneSpec: rect };
      const radius = this.parseRadiusZoneMention(input);
      if (radius) return { zoneId: null, zoneSpec: radius };
      const z = this.findZoneMention(input) || this.zones.find(zone => zone.id === input || String(zone.numericId) === input.replace(/^zone:/,''));
      return z ? { zoneId: z.id, zoneSpec: null } : { zoneId: null, zoneSpec: null };
    }
    if (typeof input === 'object') {
      if (input.kind === 'rect' || ('x' in input && 'y' in input && ('w' in input || 'width' in input) && ('h' in input || 'height' in input))) {
        const x = clamp(Number(input.x || 0), 0, this.map.width), y = clamp(Number(input.y || 0), 0, this.map.height);
        const w = clamp(Number(input.w ?? input.width ?? 0), 1, this.map.width - x), h = clamp(Number(input.h ?? input.height ?? 0), 1, this.map.height - y);
        return { zoneId: null, zoneSpec: { kind: 'rect', x, y, w, h, name: input.name || this.rectangleText({ x, y, w, h }) } };
      }
      if (input.kind === 'nearby') {
        const radius = clamp(Number(input.radius ?? input.r ?? DEFAULT_NEARBY_RADIUS), 40, MAX_NEARBY_RADIUS);
        return { zoneId: null, zoneSpec: { kind: 'nearby', radius, name: input.name || `${Math.round(radius)}px nearby around bot` } };
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
  zoneLabel(zone) { if (!zone) return 'anywhere'; if (zone.kind === 'nearby') return zone.name || `${zone.radius || DEFAULT_NEARBY_RADIUS}px nearby around bot`; if (zone.kind === 'radius') { const s = zone.centerStructureId ? this.structures.find(st => st.id === zone.centerStructureId) : null; return zone.name || `${zone.radius || DEFAULT_RESOURCE_RADIUS}px around ${s?.name || 'point'}`; } return zone.name || zone.id; }

  getBotProgram(bot) {
    const tpl = PROGRAM_TEMPLATES[bot.program] || PROGRAM_TEMPLATES.idle;
    if (bot.program === 'taught_loop' && bot.taughtLoop?.length) {
      return { ...tpl, repeat: bot.taughtLoopRepeat !== false, steps: clone(bot.taughtLoop), parameters: { source: bot.customTemplateName ? `template: ${bot.customTemplateName}` : 'teach by doing recorder' }, resolvedSteps: clone(bot.taughtLoop) };
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
  normalizeUseHeldItemDslStep(raw, priorSteps = []) {
    const rawKind = raw.targetKind ?? raw.targetType ?? raw.useOn ?? raw.resourceKind ?? raw.resourceType ?? raw.resource ?? raw.objectKind ?? raw.object ?? raw.target ?? raw.structureType;
    const kind = String(rawKind || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
      tree: 'chop_tree', trees: 'chop_tree', wood: 'chop_tree', log_source: 'chop_tree',
      hemp: 'chop_hemp', hemp_plant: 'chop_hemp',
      stone: 'mine_stone', rock: 'mine_stone', rocks: 'mine_stone', stone_deposit: 'mine_stone', stone_node: 'mine_stone',
      dirt: 'dig_hole', ground_to_dig: 'dig_hole', dig_spot: 'dig_hole', open_dirt: 'dig_hole',
      hole: 'plant_seed', dug_hole: 'plant_seed', planting_hole: 'plant_seed',
      structure: 'deposit_to_structure', building: 'deposit_to_structure', sawbench: 'deposit_to_structure', workbench: 'deposit_to_structure', factory: 'deposit_to_structure', item_palette: 'deposit_to_structure', palette: 'deposit_to_structure', storage: 'deposit_to_structure',
      ground: 'drop_item', floor: 'drop_item', zone: 'drop_item', drop_zone: 'drop_item'
    };
    const op = aliases[kind];
    if (!op) return { error: 'use_held_item requires targetKind tree/hemp/stone_deposit/dig_spot/dug_hole/structure/ground' };
    const step = { ...raw, op };
    if (op === 'deposit_to_structure' && !step.type && !step.itemType && !step.item && !step.resource) {
      const previousPickup = [...priorSteps].reverse().find(prev => ['pick_up', 'pick_up_from_storage', 'pick_up_specific'].includes(prev.op) && prev.type);
      if (previousPickup?.type) step.type = previousPickup.type;
    }
    return { step };
  }
  validateDslProgram(candidate) {
    const program = candidate?.program || candidate;
    const errors = [];
    const details = [];
    const recordError = (message, detail = null) => {
      errors.push(message);
      if (detail) details.push({ message, ...detail });
    };
    const resolveKnownItemType = rawValue => {
      const type = this.normalizeItemType(rawValue, null);
      return ITEM_TYPES.includes(type) ? type : null;
    };
    const resolveStrictZone = (rawValue, stepIndex, op) => {
      const normalized = this.normalizeZoneSpec(rawValue);
      if (normalized.zoneId || normalized.zoneSpec) return normalized;
      recordError(`Step ${stepIndex}: ${op} references an unknown zone/location`, { code: 'unknown_zone_ref', field: 'zone', stepIndex, value: rawValue });
      return { zoneId: null, zoneSpec: null };
    };
    const steps = Array.isArray(program?.steps) ? program.steps : null;
    if (!steps) return { ok: false, error: 'DSL program must include a steps array' };
    if (!steps.length) errors.push('DSL program needs at least one step');
    if (steps.length > 24) errors.push('DSL program exceeds 24 step limit');
    const hasLegacyLoopStep = steps.at(-1)?.op === 'loop';
    const repeat = typeof program.repeat === 'boolean' ? program.repeat : hasLegacyLoopStep;
    if (typeof program.repeat === 'boolean' && !program.repeat && hasLegacyLoopStep) {
      recordError('program.repeat false conflicts with a final loop step', { code: 'repeat_conflict', field: 'program.repeat', stepIndex: 0, value: false });
    }
    const normalizedSteps = [];
    const requireItemType = new Set(['pick_up', 'pick_up_from_storage', 'pick_up_specific', 'deposit_to_structure', 'deposit_to_player', 'take_from_player', 'deploy_building_kit', 'find_item', 'deliver_to_sawbench', 'deliver_to_workbench', 'deliver_to_factory', 'if_inventory']);
    const zoneOps = new Set(['pick_up', 'drop_item', 'deploy_building_kit', 'find_item', 'find_nearest_tree', 'find_stone_deposit', 'find_hemp', 'find_dig_spot', 'find_dug_hole', 'chop_tree', 'search_tree', 'chop_hemp', 'search_hemp', 'mine_stone', 'dig_hole', 'plant_seed', 'guard_area']);
    for (let index = 0; index < steps.length; index++) {
      let raw = steps[index] || {};
      let op = String(raw.op || '').trim();
      if (op === 'use_held_item') {
        const resolved = this.normalizeUseHeldItemDslStep(raw, normalizedSteps);
        if (resolved.error) { recordError(`Step ${index + 1}: ${resolved.error}`, { code: 'invalid_use_held_item', field: 'targetKind', stepIndex: index + 1, value: raw.targetKind ?? raw.target ?? null }); continue; }
        raw = resolved.step;
        op = String(raw.op || '').trim();
      }
      if (!op || !ALLOWED_OPS.includes(op)) { recordError(`Step ${index + 1}: op ${op || '(missing)'} is not allowed`, { code: 'unknown_op', field: 'op', stepIndex: index + 1, value: op || null }); continue; }
      if (raw.steps || raw.children) recordError(`Step ${index + 1}: nested steps are not allowed`, { code: 'nested_steps_not_allowed', field: 'steps', stepIndex: index + 1 });
      if (op === 'loop') {
        if (index !== steps.length - 1) recordError('loop is only allowed as the final step', { code: 'misplaced_loop', field: 'op', stepIndex: index + 1, value: 'loop' });
        continue;
      }
      const step = { op };
      if (requireItemType.has(op)) {
        const rawType = raw.type || raw.itemType || raw.item || raw.resource;
        if (!rawType) recordError(`Step ${index + 1}: ${op} requires type`, { code: 'missing_item_type', field: 'type', stepIndex: index + 1 });
        else if (op === 'deploy_building_kit') {
          const kitType = this.normalizeBuildingKitItemType(rawType);
          if (!kitType) recordError(`Step ${index + 1}: deploy_building_kit requires a deployable building kit type`, { code: 'unknown_building_kit_type', field: 'type', stepIndex: index + 1, value: rawType });
          else step.type = kitType;
        } else {
          const knownType = resolveKnownItemType(rawType);
          if (!knownType) recordError(`Step ${index + 1}: unknown item type ${JSON.stringify(String(rawType))}`, { code: 'unknown_item_type', field: 'type', stepIndex: index + 1, value: rawType });
          else step.type = knownType;
        }
      }
      if (zoneOps.has(op) && (raw.zone || raw.zoneId || raw.zoneSpec || raw.area)) {
        const normalizedZone = resolveStrictZone(raw.zone || raw.zoneId || raw.zoneSpec || raw.area, index + 1, op);
        if (normalizedZone.zoneId) {
          step.zoneId = normalizedZone.zoneId;
          const zone = this.zones.find(z => z.id === normalizedZone.zoneId);
          if (zone) step.zoneLabel = this.zoneLabel(zone);
        }
        if (normalizedZone.zoneSpec) {
          step.zoneSpec = normalizedZone.zoneSpec;
          step.zoneLabel = this.zoneLabel(normalizedZone.zoneSpec);
        }
      }
      if (op === 'wait') step.seconds = clamp(Number(raw.seconds ?? raw.duration ?? 1), 0.1, 30);
      if (op === 'equip_item') {
        const rawType = raw.type || raw.itemType || raw.item || raw.weapon;
        const type = this.normalizeWeaponItemType(rawType);
        if (!type) recordError(`Step ${index + 1}: equip_item supports only sword, shield, or bow weaponry`, { code: 'unknown_equipment_type', field: 'type', stepIndex: index + 1, value: rawType });
        else step.type = type;
      }
      if (op === 'guard_area') {
        const radiusValue = Number(raw.radius ?? raw.range ?? raw.distance);
        if (Number.isFinite(radiusValue)) step.radius = clamp(radiusValue, 40, MAX_NEARBY_RADIUS);
        if (!step.zoneSpec && !step.zoneId && Number.isFinite(radiusValue)) {
          step.zoneSpec = { kind: 'nearby', radius: step.radius, name: `${Math.round(step.radius)}px nearby around bot` };
          step.zoneLabel = this.zoneLabel(step.zoneSpec);
        }
      }
      if (op === 'patrol_route') {
        const points = this.normalizePatrolPoints(raw.points ?? raw.route ?? raw.checkpoints);
        if (points.length < 2) errors.push(`Step ${index + 1}: patrol_route requires at least two points`);
        else step.points = points;
        step.radius = clamp(Number(raw.radius ?? raw.range ?? raw.distance ?? DEFAULT_NEARBY_RADIUS), 40, MAX_NEARBY_RADIUS);
      }
      if (op === 'craft_smithery') {
        const rawRecipe = raw.recipe || raw.type || raw.item || raw.itemType;
        const recipe = this.normalizeSmitheryRecipe(rawRecipe);
        if (!recipe) recordError(`Step ${index + 1}: craft_smithery supports sword/wooden_sword or shield/wooden_shield`, { code: 'unknown_recipe', field: 'recipe', stepIndex: index + 1, value: rawRecipe });
        else step.recipe = recipe;
      }
      if (op === 'craft_bowmaker') {
        const rawRecipe = raw.recipe || raw.type || raw.item || raw.itemType;
        const recipe = this.normalizeBowmakerRecipe(rawRecipe);
        if (!recipe) recordError(`Step ${index + 1}: craft_bowmaker supports only bow`, { code: 'unknown_recipe', field: 'recipe', stepIndex: index + 1, value: rawRecipe });
        else step.recipe = recipe;
      }
      if (op === 'craft_arrowmaker') {
        const rawRecipe = raw.recipe || raw.type || raw.item || raw.itemType;
        const recipe = this.normalizeArrowmakerRecipe(rawRecipe);
        if (!recipe) recordError(`Step ${index + 1}: craft_arrowmaker supports only arrow_pack`, { code: 'unknown_recipe', field: 'recipe', stepIndex: index + 1, value: rawRecipe });
        else step.recipe = recipe;
      }
      if (op === 'if_inventory') {
        const goto = Number(raw.goto);
        if (!Number.isInteger(goto) || goto < 0 || goto >= steps.length) errors.push(`Step ${index + 1}: if_inventory goto must be a valid zero-based step index`);
        else step.goto = goto;
      }
      if (op === 'assign_template') {
        const botRef = raw.botId ?? raw.bot ?? raw.targetBotId ?? raw.target ?? raw.botName;
        const targetBot = this.resolveBotReference(botRef);
        const templateName = String(raw.templateName || raw.template || raw.name || '').trim();
        if (!targetBot) recordError(`Step ${index + 1}: assign_template requires an existing bot`, { code: 'unknown_bot_ref', field: 'bot', stepIndex: index + 1, value: botRef });
        else Object.assign(step, { botId: targetBot.id, botName: this.botDisplayName?.(targetBot) || targetBot.name || `Bot ${targetBot.id}` });
        if (!templateName) recordError(`Step ${index + 1}: assign_template requires templateName`, { code: 'missing_template_name', field: 'templateName', stepIndex: index + 1 });
        else {
          step.templateName = templateName;
          const template = this.findCustomTemplate(templateName);
          if (!template) recordError(`Step ${index + 1}: template ${templateName} not found`, { code: 'unknown_template_name', field: 'templateName', stepIndex: index + 1, value: templateName });
        }
      }
      if (op === 'rename_bot') {
        const normalizedName = this.normalizeBotDisplayName(raw.name ?? raw.newName ?? raw.displayName ?? raw.label, { minLength: 2, maxLength: 32 });
        if (!normalizedName) errors.push(`Step ${index + 1}: rename_bot requires a 2-32 character name`);
        else step.name = normalizedName;
        const targetRaw = raw.target ?? raw.bot ?? raw.botId ?? raw.targetBotId;
        const selfTarget = targetRaw == null || targetRaw === '' || ['self', 'itself', 'this bot'].includes(String(targetRaw).trim().toLowerCase());
        if (!selfTarget) {
          const targetBot = this.resolveBotReference(targetRaw);
          if (!targetBot) recordError(`Step ${index + 1}: rename_bot target must be an existing bot`, { code: 'unknown_bot_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
          else Object.assign(step, { botId: targetBot.id, target: targetBot.name || `Bot ${targetBot.id}`, targetName: this.botDisplayName?.(targetBot) || targetBot.name || `Bot ${targetBot.id}` });
        }
      }
      if (op === 'promote_to_manager') {
        const targetRaw = raw.target ?? raw.bot ?? raw.botId ?? raw.targetBotId;
        const selfTarget = targetRaw == null || targetRaw === '' || ['self', 'itself', 'this bot'].includes(String(targetRaw).trim().toLowerCase());
        if (!selfTarget) {
          const targetBot = this.resolveBotReference(targetRaw);
          if (!targetBot) recordError(`Step ${index + 1}: promote_to_manager target must be an existing bot`, { code: 'unknown_bot_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
          else Object.assign(step, { botId: targetBot.id, target: targetBot.name || `Bot ${targetBot.id}`, targetName: this.botDisplayName?.(targetBot) || targetBot.name || `Bot ${targetBot.id}` });
        }
        step.knowledgePacks = this.normalizeManagerKnowledgePacks(raw.knowledgePacks ?? raw.packs ?? raw.loadout, DEFAULT_MANAGER_KNOWLEDGE_PACKS);
      }
      if (op === 'delegate_to_manager') {
        const message = this.sanitizeManagerMessage(raw.message ?? raw.text ?? raw.prompt ?? raw.instruction);
        if (!message) recordError(`Step ${index + 1}: delegate_to_manager requires message`, { code: 'missing_message', field: 'message', stepIndex: index + 1 });
        else step.message = message;
        const recipientRaw = raw.recipient ?? raw.manager ?? raw.target ?? raw.bot ?? raw.botId;
        const managerBot = this.resolveBotReference(recipientRaw);
        if (!managerBot) recordError(`Step ${index + 1}: delegate_to_manager recipient must be an existing manager bot`, { code: 'unknown_bot_ref', field: 'recipient', stepIndex: index + 1, value: recipientRaw });
        else if (!this.isManagerBot(managerBot)) recordError(`Step ${index + 1}: delegate_to_manager recipient must be a manager bot`, { code: 'bot_not_manager', field: 'recipient', stepIndex: index + 1, value: recipientRaw });
        else Object.assign(step, { recipient: managerBot.name || `Bot ${managerBot.id}`, recipientBotId: managerBot.id, recipientName: this.botDisplayName?.(managerBot) || managerBot.name || `Bot ${managerBot.id}` });
      }
      if (op === 'follow') {
        const targetRaw = raw.targetRef ?? raw.target ?? raw.follow ?? raw.player ?? raw.bot ?? 'me';
        const placeholder = typeof targetRaw === 'string' && targetRaw.startsWith('$');
        const target = placeholder ? null : this.resolveActorReference(targetRaw);
        if (!placeholder && !target) recordError(`Step ${index + 1}: follow requires an existing target actor`, { code: 'unknown_actor_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
        step.target = String(targetRaw || 'me');
        step.distance = clamp(Number(raw.distance ?? raw.spacing ?? DEFAULT_FOLLOW_DISTANCE), 18, 220);
        if (target) Object.assign(step, { targetRef: target.ref || (target === this.player ? 'player:local' : null), targetName: this.actorLabel(target) });
      }
      if (op === 'attack') {
        const rawType = raw.type ?? raw.monsterType ?? raw.kind ?? null;
        const targetRaw = raw.targetRef ?? raw.target ?? raw.enemy ?? raw.monster ?? raw.targetName ?? null;
        const genericTargetTypes = new Set(['monster', 'monsters', 'enemy', 'enemies', 'hostile', 'hostiles', 'night monster', 'night monsters', 'passive monster', 'passive monsters']);
        const targetText = String(targetRaw || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
        step.type = this.normalizeAttackType(rawType || (genericTargetTypes.has(targetText) ? targetText : 'monster'));
        const radiusValue = Number(raw.radius ?? raw.range ?? raw.distance);
        const zoneInput = raw.zone ?? raw.zoneId ?? raw.zoneSpec ?? raw.area ?? raw.location ?? (Number.isFinite(radiusValue) ? { kind: 'nearby', radius: radiusValue } : null);
        if (zoneInput) {
          const normalizedZone = resolveStrictZone((typeof zoneInput === 'string' && /\bnearby\b/i.test(zoneInput) && Number.isFinite(radiusValue)) ? { kind: 'nearby', radius: radiusValue } : zoneInput, index + 1, op);
          if (normalizedZone.zoneId) {
            step.zoneId = normalizedZone.zoneId;
            const zone = this.zones.find(z => z.id === normalizedZone.zoneId);
            if (zone) step.zoneLabel = this.zoneLabel(zone);
          }
          if (normalizedZone.zoneSpec) {
            step.zoneSpec = normalizedZone.zoneSpec;
            if (step.zoneSpec.kind === 'nearby' && Number.isFinite(radiusValue)) {
              step.zoneSpec.radius = clamp(radiusValue, 40, MAX_NEARBY_RADIUS);
              step.zoneSpec.name = `${Math.round(step.zoneSpec.radius)}px nearby around bot`;
            }
            step.zoneLabel = this.zoneLabel(step.zoneSpec);
          }
        }
        if (Number.isFinite(radiusValue)) step.radius = clamp(radiusValue, 40, MAX_NEARBY_RADIUS);
        if (targetRaw && !genericTargetTypes.has(targetText)) {
          const placeholder = typeof targetRaw === 'string' && targetRaw.startsWith('$');
          const target = placeholder ? null : this.resolveActorReference(targetRaw);
          if (target && this.isHostileTarget(target)) Object.assign(step, { target: String(targetRaw), targetRef: target.ref, targetName: this.actorLabel(target) });
          else if (!placeholder) recordError(`Step ${index + 1}: attack target must resolve to an existing hostile actor`, { code: 'unknown_actor_ref', field: 'target', stepIndex: index + 1, value: targetRaw });
        }
      }
      if (op === 'pick_up_from_storage' || op === 'move_to_structure' || op === 'deposit_to_structure' || op === 'craft_smithery' || op === 'craft_bowmaker' || op === 'craft_arrowmaker' || op === 'disassemble_building_to_kit') {
        const sourceRaw = raw.sourceStructureId ?? raw.sourceId ?? raw.source;
        const targetRaw = raw.structureId ?? raw.targetStructureId ?? raw.targetId ?? raw.target ?? raw.structureName;
        const wantedType = op === 'pick_up_from_storage' ? 'item_palette' : op === 'craft_smithery' ? 'smithery' : op === 'craft_bowmaker' ? 'bowmaker' : op === 'craft_arrowmaker' ? 'arrowmaker' : (raw.structureType || null);
        const lookup = op === 'pick_up_from_storage' ? (sourceRaw ?? targetRaw) : targetRaw;
        const placeholder = typeof lookup === 'string' && lookup.startsWith('$');
        const structureId = placeholder ? null : this.normalizeStructureId(lookup, wantedType) || ((op === 'craft_smithery' || op === 'craft_bowmaker' || op === 'craft_arrowmaker') ? null : this.normalizeStructureId(lookup, null));
        const structure = structureId ? this.structures.find(s => s.id === structureId) : null;
        if (!placeholder && lookup != null && lookup !== '' && !structure) recordError(`Step ${index + 1}: ${op} requires an existing ${wantedType || 'structure'} target/source`, { code: 'unknown_structure_ref', field: op === 'pick_up_from_storage' ? 'source' : 'target', stepIndex: index + 1, value: lookup });
        if (!placeholder && op === 'disassemble_building_to_kit' && !this.canDisassembleStructure(structure)) recordError(`Step ${index + 1}: disassemble_building_to_kit requires a disassemblable building`, { code: 'structure_not_disassemblable', field: 'target', stepIndex: index + 1, value: lookup });
        if (structure) Object.assign(step, { structureId: structure.id, structureName: structure.name, structureType: structure.type, target: structure.name });
        else if (placeholder) Object.assign(step, { target: lookup, structureType: wantedType || raw.structureType || null });
      }
      normalizedSteps.push(step);
    }
    let held = null;
    for (let index = 0; index < normalizedSteps.length; index++) {
      const step = normalizedSteps[index];
      if (step.op === 'loop') break;
      if (step.op === 'pick_up' || step.op === 'pick_up_from_storage' || step.op === 'pick_up_specific' || step.op === 'take_from_player') {
        if (held && held !== step.type) errors.push(`Step ${index + 1}: cannot pick up ${itemLabel(step.type)} while already holding ${itemLabel(held)}`);
        held = step.type;
      }
      if (step.op === 'deposit_to_structure' || step.op === 'deposit_to_player' || step.op === 'deploy_building_kit') {
        if (!held) errors.push(`Step ${index + 1}: ${step.op} requires a prior pick_up step for ${itemLabel(step.type)}`);
        else if (held !== step.type) errors.push(`Step ${index + 1}: holds ${itemLabel(held)} but ${step.op} needs ${itemLabel(step.type)}`);
        held = null;
      }
      if (step.op === 'drop_item') {
        if (!held) errors.push(`Step ${index + 1}: drop_item requires a prior pick_up step for something to drop`);
        held = null;
      }
      if (step.op === 'disassemble_building_to_kit') {
        if (held) errors.push(`Step ${index + 1}: disassemble_building_to_kit needs empty hands, but holds ${itemLabel(held)}`);
        const kitType = buildingKitItemTypeFor(step.structureType);
        if (kitType) held = kitType;
      }
      if (step.op === 'plant_seed') {
        if (held && held !== 'tree_seed') errors.push(`Step ${index + 1}: plant_seed requires tree_seed, not ${itemLabel(held)}`);
        if (held === 'tree_seed') held = null;
      }
    }
    const normalizedProgram = { id: program.id || 'custom_loop', name: program.name || 'Generated DSL Loop', repeat: !!repeat, steps: normalizedSteps };
    return errors.length ? { ok: false, error: errors.join('; '), errors, details, program: normalizedProgram } : { ok: true, program: normalizedProgram, normalizedProgram, details };
  }

  assignCustomDslProgram({ botId, assignee = null, program, reason = '' }) {
    let bot = botId != null ? this.findBot(botId) : null;
    if (!bot && assignee?.strategy === 'any_eligible') {
      bot = this.findAnyEligibleWorkerBot();
      if (!bot) return { ok: false, error: 'No idle standard worker bot is available for assignee any_eligible' };
    }
    if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    if (assignee?.strategy === 'any_eligible') {
      if (!this.isStandardWorkerBot(bot)) return { ok: false, error: `${this.botDisplayName?.(bot) || `Bot ${bot.id}`} is not a standard worker bot` };
      if (!this.isIdleStandardWorkerBot(bot)) return { ok: false, error: `${this.botDisplayName?.(bot) || `Bot ${bot.id}`} is not idle` };
    }
    const checked = this.validateDslProgram(program);
    if (!checked.ok) return { ok: false, error: checked.error, validation: checked };
    bot.paused = false;
    bot.program = 'taught_loop';
    bot.state = 'taught_loop';
    bot.message = reason || `Generated DSL: ${checked.program.name}`;
    bot.customTemplateName = '';
    bot.taughtLoop = clone(checked.program.steps);
    bot.taughtLoopRepeat = checked.program.repeat !== false;
    bot.target = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; bot.timer = 0; bot.runtime = { pc: 0, memory: {}, wait: 0 };
    this.addFloat(`Bot ${bot.id}: generated DSL`, bot.x, bot.y - 22, '#d3a95f');
    this.syncTeachUi?.();
    return { ok: true, bot, program: checked.program, steps: clone(bot.taughtLoop) };
  }

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
    bot.customTemplateName = '';
    bot.taughtLoop = taughtLoop;
    bot.taughtLoopRepeat = true;
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

  moveToward(entity, tx, ty, dt, speed = entity.speed || 100, close = 14) { const d = distXY(entity.x, entity.y, tx, ty); if (d <= close) return true; const dx = (tx - entity.x) / d, dy = (ty - entity.y) / d; entity.facingX = dx; entity.facingY = dy; entity.x += dx * speed * dt; entity.y += dy * speed * dt; return false; }
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
    this.mapFeatures = [];
    this.campaignArrival = null;
    this.worldTime = 0;
    this.fogOfWar = createFogOfWar();
    this.nightSpawns = { active: false, timer: 1.5, spawnedThisNight: 0 };
  }

  setPaused(paused) {
    this.paused = !!paused;
    if (this.paused) this.keys.clear();
    return this.paused;
  }

  beginCampaignArrival() {
    const scene = getCampaignArrivalScene();
    if (!scene) return null;
    const points = scene.path || [];
    if (points.length >= 2) {
      const start = this.sampleCampaignArrivalPath(points, 0);
      const zoom = this.camera.zoom || 1;
      const viewW = this.W / zoom;
      const viewH = this.H / zoom;
      this.camera.x = clamp(start.x - viewW / 2, -Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2), Math.max(0, this.map.width - viewW) + Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2));
      this.camera.y = clamp(start.y - viewH / 2, -Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2), Math.max(0, this.map.height - viewH) + Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2));
    }
    this.campaignArrival = {
      active: true,
      sceneId: scene.id,
      startedAt: performance.now(),
      durationMs: scene.durationMs || 4600
    };
    this.setPaused(true);
    return this.campaignArrival;
  }

  updateCampaignArrivalState(now = performance.now()) {
    if (!this.campaignArrival?.active) return null;
    const scene = getCampaignArrivalScene(this.campaignArrival.sceneId);
    const durationMs = Math.max(1, Number(this.campaignArrival.durationMs || scene?.durationMs || 4600));
    const startedAt = Number(this.campaignArrival.startedAt || now);
    const progress = clamp((now - startedAt) / durationMs, 0, 1);
    this.campaignArrival.progress = progress;
    const points = scene?.path || [];
    if (points.length >= 2) {
      const state = this.sampleCampaignArrivalPath(points, progress);
      const zoom = this.camera.zoom || 1;
      const viewW = this.W / zoom;
      const viewH = this.H / zoom;
      const leadX = Number(scene?.cameraFollow?.offsetX || 0);
      const leadY = Number(scene?.cameraFollow?.offsetY || 0);
      const targetX = clamp(state.x - (viewW / 2) + leadX, -Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2), Math.max(0, this.map.width - viewW) + Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2));
      const targetY = clamp(state.y - (viewH / 2) + leadY, -Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2), Math.max(0, this.map.height - viewH) + Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2));
      const smoothing = clamp(Number(scene?.cameraFollow?.smoothing ?? 0.14), 0.01, 1);
      this.camera.x += (targetX - this.camera.x) * smoothing;
      this.camera.y += (targetY - this.camera.y) * smoothing;
    }
    if (progress >= 1) {
      this.campaignArrival.active = false;
      this.campaignArrival.completedAt = now;
      const zoom = this.camera.zoom || 1;
      const viewW = this.W / zoom;
      const viewH = this.H / zoom;
      this.camera.x = clamp(CAMPAIGN_START.x - viewW / 2, -Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2), Math.max(0, this.map.width - viewW) + Math.min(viewW * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.width / 2));
      this.camera.y = clamp(CAMPAIGN_START.y - viewH / 2, -Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2), Math.max(0, this.map.height - viewH) + Math.min(viewH * CAMERA_EDGE_VIEWPORT_PADDING_RATIO, this.map.height / 2));
      this.setPaused(false);
    }
    return this.campaignArrival;
  }

  sampleCampaignArrivalPath(points, progress) {
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) continue;
      const ax = a.x ?? a[0] ?? 0;
      const ay = a.y ?? a[1] ?? 0;
      const bx = b.x ?? b[0] ?? 0;
      const by = b.y ?? b[1] ?? 0;
      const length = Math.hypot(bx - ax, by - ay);
      if (length <= 0) continue;
      segments.push({ ax, ay, bx, by, length, angle: Math.atan2(by - ay, bx - ax) });
      total += length;
    }
    if (!segments.length || total <= 0) {
      const first = points[0] || {};
      return { x: first.x ?? first[0] ?? 0, y: first.y ?? first[1] ?? 0, angle: 0 };
    }
    const target = total * clamp(progress, 0, 1);
    let traveled = 0;
    for (const segment of segments) {
      const next = traveled + segment.length;
      if (target <= next) {
        const local = segment.length ? (target - traveled) / segment.length : 0;
        return {
          x: segment.ax + ((segment.bx - segment.ax) * local),
          y: segment.ay + ((segment.by - segment.ay) * local),
          angle: segment.angle
        };
      }
      traveled = next;
    }
    const last = segments[segments.length - 1];
    return { x: last.bx, y: last.by, angle: last.angle };
  }

  resetSoloWorld() {
    this.resetWorldCollections();
    this.gameMode = 'test';
    this.map = { ...WORLD_MAP_SIZE };
    this.player = { x: 480, y: 410, r: 13, speed: 170, target: null, targetQueue: [], inventory: null, equipment: createEquipment(), attackCooldown: 0, hp: 10, maxHp: 10 };
    this.assistant = { x: 452, y: 392 };
    this.camera = { x: 0, y: 0, speed: 520, fastMultiplier: 2.35, zoom: this.camera?.zoom || 1, minZoom: CAMERA_MIN_ZOOM, maxZoom: CAMERA_MAX_ZOOM };
    this.multiplayer = { enabled: false, sessionId: null, role: 'solo', playerId: 'p1', mapMode: 'test', status: 'Test mode prototype', players: {}, winner: null, syncTimer: 0 };
    this.recorder = { recording: false, steps: [], lastAssignedBotId: null, targetBotId: null, status: '' };
    this.teachPanelOpened = false;
    this.teachLocationEdit = null;
    this.draggedTeachStepIndex = null;
    this.botMenuEdit = null;
    this.botSearchQuery = '';
    this.botDrawerDragging = false;
    this.botTeams = [];
    this.nextBotTeamId = 1;
    this.customTemplates = this.customTemplates || [];
    this.nextCustomTemplateId = this.nextCustomTemplateId || 1;
    this.recordedLoop = [];
    this.zones = clone(DEFAULT_WORLD_ZONES);
    this.nextZoneId = 1;
    this.idleDepot = { x: 115, y: 245, label: 'idle depot' };
    this.placementType = null; this.zoneDraft = null; this.zoneDrag = null; this.zoneResize = null; this.justDrewZone = false; this.justDraggedZone = false;
    this.initWorld();
    this.clampCamera();
    this.syncBuildUi(); this.syncTeachUi?.(); this.syncZonesUi?.(); this.syncTemplateDrawerUi?.(); this.syncBotDrawerUi?.(); this.updateHover();
    return this.exportSave();
  }

  startCampaignMode() {
    this.resetWorldCollections();
    this.gameMode = 'campaign';
    this.map = { ...CAMPAIGN_MAP_SIZE };
    this.player = { x: CAMPAIGN_START.x, y: CAMPAIGN_START.y, r: 13, speed: 170, target: null, targetQueue: [], inventory: null, equipment: createEquipment(), attackCooldown: 0, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, facingX: 1, facingY: 0, dead: false, lastDamageTime: -Infinity, regenTimer: 0 };
    this.assistant = { x: CAMPAIGN_START.x - 32, y: CAMPAIGN_START.y + 24, facingX: 1, facingY: 0 };
    this.camera = { x: clamp(CAMPAIGN_START.x - this.W / 2, 0, Math.max(0, this.map.width - this.W / (this.camera?.zoom || 1))), y: clamp(CAMPAIGN_START.y - this.H / 2, 0, Math.max(0, this.map.height - this.H / (this.camera?.zoom || 1))), speed: 520, fastMultiplier: 2.35, zoom: this.camera?.zoom || 1, minZoom: CAMERA_MIN_ZOOM, maxZoom: CAMERA_MAX_ZOOM };
    this.multiplayer = { enabled: false, sessionId: null, role: 'solo', playerId: 'p1', mapMode: 'campaign', status: 'Campaign mode: glowing lake road camp', players: {}, winner: null, syncTimer: 0, aiWave: { enabled: false }, mapFeatures: clone(CAMPAIGN_MAP_FEATURES) };
    this.mapFeatures = clone(CAMPAIGN_MAP_FEATURES);
    this.recorder = { recording: false, steps: [], lastAssignedBotId: null, targetBotId: null, status: '' };
    this.teachPanelOpened = false;
    this.teachLocationEdit = null;
    this.draggedTeachStepIndex = null;
    this.botMenuEdit = null;
    this.botSearchQuery = '';
    this.botDrawerDragging = false;
    this.botTeams = [];
    this.nextBotTeamId = 1;
    this.customTemplates = this.customTemplates || [];
    this.nextCustomTemplateId = this.nextCustomTemplateId || 1;
    this.recordedLoop = [];
    this.zones = clone(DEFAULT_WORLD_ZONES);
    this.nextZoneId = 1;
    this.idleDepot = { x: 1190, y: CAMPAIGN_MAP_SIZE.height - 610, label: 'trusty camper van' };
    this.placementType = null; this.zoneDraft = null; this.zoneDrag = null; this.zoneResize = null; this.justDrewZone = false; this.justDraggedZone = false;

    [[910, 2790], [1220, 2830], [1500, 3000], [1730, 2540], [2080, 2760], [2460, 2440], [2920, 2720], [3400, 2380], [3920, 2820], [4580, 2500], [5100, 3060], [760, 2250], [1360, 2140], [2240, 1960], [3200, 1840], [4300, 1720]].forEach(([x, y]) => this.spawnTree(x, y));
    [[1340, 3060], [1660, 3180], [2420, 2920], [3050, 2620], [3800, 2920], [4800, 2750], [1850, 2320], [4200, 2120]].forEach(([x, y]) => this.spawnHemp(x, y));
    [[1480, 3240], [2080, 3120], [2700, 2860], [3480, 3060], [4320, 2860], [5000, 3220], [2380, 2180], [3760, 2060]].forEach(([x, y]) => this.spawnStoneDeposit(x, y));
    this.addStructure('sawbench', CAMPAIGN_START.x + 95, CAMPAIGN_START.y - 130);
    this.addStructure('workbench', CAMPAIGN_START.x + 225, CAMPAIGN_START.y - 130);
    this.addStructure('hammock_camp', CAMPAIGN_START.x - 120, CAMPAIGN_START.y - 205);
    this.addStructure('ultrabook_desk', CAMPAIGN_START.x + 18, CAMPAIGN_START.y - 230);
    this.addStructure('solar_array', CAMPAIGN_START.x + 300, CAMPAIGN_START.y - 245);
    this.addStructure('power_station', CAMPAIGN_START.x + 240, CAMPAIGN_START.y - 55);
    this.addStructure('portable_3d_printer', CAMPAIGN_START.x + 375, CAMPAIGN_START.y - 122);
    this.addStructure('assembler', CAMPAIGN_START.x + 500, CAMPAIGN_START.y - 122);
    this.addStructure('robotics_parts_bin', CAMPAIGN_START.x + 435, CAMPAIGN_START.y - 38);
    this.createBot(CAMPAIGN_START.x - 45, CAMPAIGN_START.y + 56, 'idle', true);
    this.createBot(CAMPAIGN_START.x - 10, CAMPAIGN_START.y + 86, 'idle', true);
    this.spawnStarterDog(CAMPAIGN_START.x + 28, CAMPAIGN_START.y + 70);
    this.spawnItem('crude_axe', CAMPAIGN_START.x + 80, CAMPAIGN_START.y + 95, 2);
    this.spawnItem('stick', CAMPAIGN_START.x + 126, CAMPAIGN_START.y + 102, 4);
    this.spawnItem('stone', CAMPAIGN_START.x + 170, CAMPAIGN_START.y + 92, 2);
    this.spawnItem('hammock', CAMPAIGN_START.x - 135, CAMPAIGN_START.y - 95, 1);
    this.spawnItem('ultrabook', CAMPAIGN_START.x + 4, CAMPAIGN_START.y - 94, 1);
    this.spawnItem('solar_panel', CAMPAIGN_START.x + 322, CAMPAIGN_START.y - 110, 2);
    this.spawnItem('power_station', CAMPAIGN_START.x + 245, CAMPAIGN_START.y + 42, 1);
    this.spawnItem('portable_3d_printer', CAMPAIGN_START.x + 380, CAMPAIGN_START.y - 4, 1);
    this.spawnItem('assembler', CAMPAIGN_START.x + 482, CAMPAIGN_START.y - 6, 1);
    this.spawnItem('robotics_parts', CAMPAIGN_START.x + 438, CAMPAIGN_START.y + 56, 3);
    this.clampCamera();
    this.syncBuildUi(); this.syncTeachUi?.(); this.syncZonesUi?.(); this.syncTemplateDrawerUi?.(); this.syncBotDrawerUi?.(); this.updateHover();
    return this.exportSave();
  }

  exportSave() {
    return {
      schema: 'orchestrator-grove-save-v1',
      savedAt: new Date().toISOString(),
      worldTime: this.worldTime || 0,
      dayNight: this.getDayNightState(),
      fogOfWar: serializeFogOfWar(this.fogOfWar),
      nightSpawns: clone(this.nightSpawns || {}),
      mode: this.gameMode || (this.multiplayer?.enabled ? 'multiplayer' : 'solo'),
      map: clone(this.map),
      camera: clone(this.camera),
      player: clone(this.player),
      assistant: clone(this.assistant),
      multiplayer: clone(this.multiplayer),
      mapFeatures: clone(this.mapFeatures || []),
      recorder: clone(this.recorder),
      recordedLoop: clone(this.recordedLoop),
      customTemplates: clone(this.customTemplates || []),
      botTeams: clone(this.botTeams),
      zones: clone(this.zones),
      idleDepot: clone(this.idleDepot),
      trees: clone(this.trees), hempPlants: clone(this.hempPlants), rocks: clone(this.rocks), holes: clone(this.holes), items: clone(this.items), bots: clone(this.bots), structures: clone(this.structures), monsters: clone(this.monsters), projectiles: clone(this.projectiles),
      counters: { nextItemId: this.nextItemId, nextRockId: this.nextRockId, nextHoleId: this.nextHoleId, nextTreeId: this.nextTreeId, nextHempId: this.nextHempId, nextMonsterId: this.nextMonsterId, nextProjectileId: this.nextProjectileId, nextBotId: this.nextBotId, nextStructureId: this.nextStructureId, nextZoneId: this.nextZoneId, nextBotTeamId: this.nextBotTeamId, nextCustomTemplateId: this.nextCustomTemplateId },
      settings: { maxBots: this.maxBots, targetFps: this.targetFps }
    };
  }

  loadSave(payload) {
    if (!payload || payload.schema !== 'orchestrator-grove-save-v1') throw new Error('Unsupported save format');
    this.map = { ...WORLD_MAP_SIZE, ...(payload.map || {}) };
    this.gameMode = payload.mode || (payload.multiplayer?.enabled ? 'multiplayer' : 'test');
    this.camera = { x: 0, y: 0, speed: 520, fastMultiplier: 2.35, zoom: 1, minZoom: CAMERA_MIN_ZOOM, maxZoom: CAMERA_MAX_ZOOM, ...(payload.camera || {}) };
    this.player = { x: 480, y: 410, r: 13, speed: 170, target: null, targetQueue: [], inventory: null, equipment: createEquipment(), attackCooldown: 0, hp: 10, maxHp: 10, ...(payload.player || {}) };
    ensureEquipment(this.player);
    this.assistant = { x: 452, y: 392, ...(payload.assistant || {}) };
    this.multiplayer = { enabled: false, sessionId: null, role: 'solo', playerId: 'p1', status: 'Solo prototype', players: {}, winner: null, syncTimer: 0, ...(payload.multiplayer || {}) };
    this.worldTime = Number(payload.worldTime || 0);
    this.fogOfWar = normalizeFogOfWar(payload.fogOfWar || {}, { cellSize: FOG_CELL_SIZE });
    this.nightSpawns = { active: false, timer: 1.5, spawnedThisNight: 0, ...(payload.nightSpawns || {}) };
    this.mapFeatures = clone(payload.mapFeatures || []);
    this.recorder = { recording: false, steps: [], lastAssignedBotId: null, targetBotId: null, status: '', ...(payload.recorder || {}) };
    this.recordedLoop = clone(payload.recordedLoop || []);
    this.customTemplates = clone(payload.customTemplates || []);
    this.nextCustomTemplateId = Math.max(1, ...this.customTemplates.map(template => Number(template.numericId || String(template.id || '').replace(/^template:/, '')) || 0)) + 1;
    this.botTeams = clone(payload.botTeams || []);
    this.nextBotTeamId = Math.max(1, ...this.botTeams.map(team => Number(team.numericId || String(team.id || '').replace(/^team:/, '')) || 0)) + 1;
    this.zones = clone(payload.zones || DEFAULT_WORLD_ZONES);
    this.idleDepot = { x: 115, y: 245, label: 'idle depot', ...(payload.idleDepot || {}) };
    this.trees = clone(payload.trees || []); this.hempPlants = clone(payload.hempPlants || []); this.rocks = clone(payload.rocks || []); this.holes = clone(payload.holes || []); this.items = clone(payload.items || []); this.bots = clone(payload.bots || []); this.structures = clone(payload.structures || []); this.monsters = clone(payload.monsters || []); this.projectiles = clone(payload.projectiles || []); this.floaters = [];
    for (const bot of this.bots) { ensureEquipment(bot); bot.name = bot.name || `Bot ${bot.id}`; bot.kind = bot.kind === 'dog' ? 'dog' : 'bot'; bot.status = bot.status === 'manager' ? 'manager' : 'worker'; bot.taughtLoopRepeat = bot.taughtLoopRepeat !== false; bot.managerKnowledgePacks = this.normalizeManagerKnowledgePacks(bot.managerKnowledgePacks || bot.knowledgePacks || [], bot.status === 'manager' ? DEFAULT_MANAGER_KNOWLEDGE_PACKS : []); bot.knowledgePacks = bot.kind === 'dog' ? (Array.isArray(bot.knowledgePacks) && bot.knowledgePacks.length ? bot.knowledgePacks : ['dog_fetch']) : (Array.isArray(bot.knowledgePacks) ? bot.knowledgePacks : bot.managerKnowledgePacks); bot.dogFetchMemory = this.normalizeDogFetchMemory(bot.dogFetchMemory); bot.dogFetchState = this.normalizeDogFetchState(bot.dogFetchState); if (bot.teamId && !this.findBotTeam(bot.teamId)) bot.teamId = null; }
    const counters = payload.counters || {};
    this.nextItemId = Number(counters.nextItemId || 1); this.nextRockId = Number(counters.nextRockId || 1); this.nextHoleId = Number(counters.nextHoleId || 1); this.nextTreeId = Number(counters.nextTreeId || 1); this.nextHempId = Number(counters.nextHempId || 1); this.nextMonsterId = Number(counters.nextMonsterId || 1); this.nextProjectileId = Number(counters.nextProjectileId || 1); this.nextBotId = Number(counters.nextBotId || 1); this.nextStructureId = Number(counters.nextStructureId || 1); this.nextZoneId = Number(counters.nextZoneId || 1); this.nextBotTeamId = Number(counters.nextBotTeamId || this.nextBotTeamId || 1); this.nextCustomTemplateId = Number(counters.nextCustomTemplateId || this.nextCustomTemplateId || 1);
    if (payload.settings?.maxBots) this.maxBots = Number(payload.settings.maxBots);
    if (payload.settings?.targetFps) this.targetFps = Number(payload.settings.targetFps);
    this.placementType = null; this.zoneDraft = null; this.zoneDrag = null; this.justDrewZone = false; this.justDraggedZone = false;
    this.clampCamera();
    this.syncBuildUi(); this.syncTeachUi?.(); this.syncZonesUi?.(); this.syncTemplateDrawerUi?.(); this.syncBotDrawerUi?.(); this.updateHover();
    return this.getState();
  }

  startLocalAiMatch({ sessionId = `local-ai-${Date.now().toString(36)}`, playerId = 'p1' } = {}) {
    const role = 'local_ai';
    const localStart = MULTIPLAYER_STARTS.p1;
    this.resetWorldCollections();
    this.gameMode = 'local_ai';
    this.map = { ...WORLD_MAP_SIZE };
      this.player.x = localStart.x; this.player.y = localStart.y; this.player.target = null; this.player.targetQueue = []; this.player.inventory = null; this.player.equipment = createEquipment(); this.player.ammunition = 0; this.player.hp = this.player.maxHp || 10; this.player.facingX = 1; this.player.facingY = 0;
      this.assistant.x = localStart.x - 30; this.assistant.y = localStart.y + 24; this.assistant.facingX = 1; this.assistant.facingY = 0;
    this.camera.x = localStart.x - (this.W / (this.camera.zoom || 1)) / 2;
    this.camera.y = localStart.y - (this.H / (this.camera.zoom || 1)) / 2;
    this.clampCamera();

    const p1 = { ...MULTIPLAYER_STARTS.p1, label: 'Player' };
    const p2 = { ...MULTIPLAYER_STARTS.p2, label: 'Enemy AI' };
    this.multiplayer = { enabled: true, sessionId, role, playerId, mapMode: 'local_ai', status: `Local vs AI ${sessionId}`, players: { p1, p2 }, winner: null, syncTimer: 0, aiWave: { enabled: true, enemyOwnerId: 'p2', targetOwnerId: 'p1', elapsed: 0, spawnTimer: MONSTER_WAVE_CONFIG.spawnEverySeconds, waveIndex: 0, lastWaveSize: 0 } };

    const throne1 = this.addStructure('throne', p1.throneX, p1.throneY);
    Object.assign(throne1, { name: 'bottom-left throne', ownerId: 'p1', ownerLabel: 'Player', hp: THRONE_HP, maxHp: THRONE_HP });
    const throne2 = this.addStructure('throne', p2.throneX, p2.throneY);
    Object.assign(throne2, { name: 'top-right throne', ownerId: 'p2', ownerLabel: 'Enemy AI', hp: THRONE_HP, maxHp: THRONE_HP });
    this.buildMultiplayerLane();
    const homeSide = 1;
    this.idleDepot = { x: throne1.x + homeSide * 86, y: throne1.y + 10, label: 'own throne' };

    [[720,1880],[920,2050],[1180,1740],[2440,520],[2680,380],[2940,690],[1720,1040],[1940,1260]].forEach(([x,y]) => this.spawnTree(x, y));
    [[820,1760],[1050,1940],[2380,620],[2820,760],[1840,1120]].forEach(([x,y]) => this.spawnHemp(x, y));
    [[940,1660],[1240,1900],[2280,720],[2800,560],[1780,1260]].forEach(([x,y]) => this.spawnStoneDeposit(x, y));
    this.addStructure('sawbench', localStart.x + 120, localStart.y - 120);
    this.addStructure('workbench', localStart.x + 230, localStart.y - 120);
    this.createBot(this.idleDepot.x - homeSide * 22, this.idleDepot.y - 24, 'idle', true);
    this.createBot(this.idleDepot.x + homeSide * 18, this.idleDepot.y + 18, 'idle', true);
    this.spawnStarterDog(localStart.x + 28, localStart.y + 34);
    this.spawnItem('crude_axe', localStart.x + 95, localStart.y + 80, 2);
    this.spawnItem('stick', localStart.x + 130, localStart.y + 86, 4);
    this.spawnItem('stone', localStart.x + 160, localStart.y + 75, 2);
    this.syncBuildUi(); this.syncZonesUi?.(); this.updateHover();
    return this.getMultiplayerSnapshot();
  }

  startMultiplayerSession({ sessionId = `grove-${Date.now().toString(36)}`, role = 'host', playerId = 'p1', players = null } = {}) {
    const localStart = MULTIPLAYER_STARTS[playerId] || MULTIPLAYER_STARTS.p1;
    this.resetWorldCollections();
    this.gameMode = 'online_lakes';
    this.map = { ...WORLD_MAP_SIZE };
    this.mapFeatures = clone(ONLINE_MULTIPLAYER_FEATURES);
      this.player.x = localStart.x; this.player.y = localStart.y; this.player.target = null; this.player.targetQueue = []; this.player.inventory = null; this.player.equipment = createEquipment(); this.player.ammunition = 0; this.player.hp = this.player.maxHp || 10; this.player.facingX = 1; this.player.facingY = 0;
      this.assistant.x = localStart.x - 30; this.assistant.y = localStart.y + 24; this.assistant.facingX = 1; this.assistant.facingY = 0;
    this.camera.x = localStart.x - (this.W / (this.camera.zoom || 1)) / 2;
    this.camera.y = localStart.y - (this.H / (this.camera.zoom || 1)) / 2;
    this.clampCamera();

    const p1 = { ...MULTIPLAYER_STARTS.p1, label: 'Player 1', ...(players?.p1 || {}) };
    const p2 = { ...MULTIPLAYER_STARTS.p2, label: 'Player 2', ...(players?.p2 || {}) };
    this.multiplayer = { enabled: true, sessionId, role, playerId, mapMode: 'online_lakes', status: `${role === 'host' ? 'Hosting' : 'Joined'} online lake camp ${sessionId}`, players: { p1, p2 }, winner: null, syncTimer: 0, aiWave: { enabled: false }, mapFeatures: clone(this.mapFeatures) };

    const camper = this.mapFeatures.find(feature => feature.type === 'camper_van' && feature.ownerId === playerId) || localStart;
    const homeSide = playerId === 'p2' ? -1 : 1;
    this.idleDepot = { x: camper.x + homeSide * 86, y: camper.y + 12, label: 'camper van' };

    [[720,1880],[940,2020],[1180,1740],[2460,520],[2700,390],[2940,690],[1720,1040],[1940,1260]].forEach(([x,y]) => this.spawnTree(x, y));
    [[820,1760],[1050,1940],[2380,620],[2820,760],[1840,1120]].forEach(([x,y]) => this.spawnHemp(x, y));
    [[940,1660],[1240,1900],[2280,720],[2800,560],[1780,1260]].forEach(([x,y]) => this.spawnStoneDeposit(x, y));
    this.addStructure('sawbench', localStart.x + (playerId === 'p1' ? 120 : -120), localStart.y - (playerId === 'p1' ? 120 : -80));
    this.addStructure('workbench', localStart.x + (playerId === 'p1' ? 230 : -230), localStart.y - (playerId === 'p1' ? 120 : -80));
    this.createBot(this.idleDepot.x - homeSide * 22, this.idleDepot.y - 24, 'idle', true);
    this.createBot(this.idleDepot.x + homeSide * 18, this.idleDepot.y + 18, 'idle', true);
    this.spawnStarterDog(localStart.x + 28, localStart.y + 34);
    this.spawnItem('crude_axe', localStart.x + 95, localStart.y + 80, 2);
    this.spawnItem('stick', localStart.x + 130, localStart.y + 86, 4);
    this.spawnItem('stone', localStart.x + 160, localStart.y + 75, 2);
    this.syncBuildUi(); this.syncZonesUi?.(); this.updateHover();
    return this.getMultiplayerSnapshot();
  }
  isEnemyThrone(s) { return !!(this.multiplayer?.enabled && s?.type === 'throne' && s.ownerId && s.ownerId !== this.multiplayer.playerId && (s.hp || 0) > 0); }
  damageThrone(s, damage = THRONE_ATTACK_DAMAGE) {
    if (!s || s.type !== 'throne' || (s.hp || 0) <= 0) return false;
    s.hp = Math.max(0, (s.hp || s.maxHp || THRONE_HP) - damage);
    this.addFloat(`${s.name} -${damage} HP`, s.x, s.y - 55, s.ownerId === 'p1' ? '#80a9c9' : '#c86b5f');
    this.emitSound('hit', { cooldownKey: `throne:${s.id}`, minGapMs: 150 });
    if (s.hp <= 0) {
      this.multiplayer.winner = s.ownerId === 'p1' ? 'p2' : 'p1';
      this.multiplayer.status = `${this.multiplayer.winner === this.multiplayer.playerId ? 'Victory' : 'Defeat'}: ${s.name} destroyed`;
      this.addFloat(this.multiplayer.status, this.player.x, this.player.y - 45, '#fff4d0');
      this.emitSound('victory', { cooldownKey: 'throne-victory', minGapMs: 1000 });
    }
    if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
    return true;
  }
  getLocalPlayerNetState() {
    return { sessionId: this.multiplayer?.sessionId, playerId: this.multiplayer?.playerId, x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, maxHp: this.player.maxHp, inventory: this.player.inventory, equipment: this.equipmentSummary(this.player), thrones: this.structures.filter(s => s.type === 'throne').map(s => ({ id: s.id, ownerId: s.ownerId, hp: s.hp, maxHp: s.maxHp })), winner: this.multiplayer?.winner || null };
  }
  applyRemoteMultiplayerState(state = {}) {
    if (!this.multiplayer?.enabled || !state.playerId || state.playerId === this.multiplayer.playerId) return false;
    const current = this.multiplayer.players[state.playerId] || { id: state.playerId, label: state.playerId };
    this.multiplayer.players[state.playerId] = { ...current, x: Number(state.x ?? current.x), y: Number(state.y ?? current.y), hp: Number(state.hp ?? current.hp ?? 10), maxHp: Number(state.maxHp ?? current.maxHp ?? 10), inventory: state.inventory || null, equipment: state.equipment || current.equipment || null, disconnected: false, lastSeenAt: Date.now() };
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
    this.multiplayer.players[this.multiplayer.playerId] = { ...local, x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, maxHp: this.player.maxHp, inventory: this.player.inventory || null, equipment: this.equipmentSummary(this.player) };
    this.multiplayer.syncTimer = (this.multiplayer.syncTimer || 0) + dt;
    if (this.multiplayer.syncTimer >= 0.12) {
      this.multiplayer.syncTimer = 0;
      if (typeof this.onMultiplayerState === 'function') this.onMultiplayerState(this.getLocalPlayerNetState());
    }
  }
  getMultiplayerSnapshot() {
    return { ...(this.multiplayer || {}), players: { ...(this.multiplayer?.players || {}) }, mapFeatures: clone(this.mapFeatures || this.multiplayer?.mapFeatures || []), thrones: this.structures.filter(s => s.type === 'throne').map(s => ({ id: s.id, ref: s.ref, name: s.name, ownerId: s.ownerId, ownerLabel: s.ownerLabel, hp: s.hp, maxHp: s.maxHp, x: Math.round(s.x), y: Math.round(s.y) })), towers: this.structures.filter(s => s.type === 'defensetower' && s.ownerId).map(s => ({ id: s.id, ref: s.ref, name: s.name, ownerId: s.ownerId, ownerLabel: s.ownerLabel, hp: s.hp, maxHp: s.maxHp, x: Math.round(s.x), y: Math.round(s.y), range: s.rangedAttack?.range, damage: s.rangedAttack?.damage })) };
  }
  addMultiplayerTower(ownerId, point) {
    const tower = this.addStructure('defensetower', point.x, point.y);
    Object.assign(tower, { name: point.name, ownerId, ownerLabel: ownerId === 'p1' ? 'Player 1' : 'Enemy AI', hp: 20, maxHp: 20 });
    return tower;
  }
  buildMultiplayerLane() {
    for (const point of MULTIPLAYER_LANE_TOWERS.p1) this.addMultiplayerTower('p1', point);
    for (const point of MULTIPLAYER_LANE_TOWERS.p2) this.addMultiplayerTower('p2', point);
  }
  spawnEnemyWave(ownerId = 'p2', targetOwnerId = 'p1') {
    const ai = this.multiplayer?.aiWave;
    const source = this.structures.find(s => s.type === 'throne' && s.ownerId === ownerId);
    const target = this.structures.find(s => s.type === 'throne' && s.ownerId === targetOwnerId);
    if (!source || !target) return [];
    const waveIndex = (ai.waveIndex || 0) + 1;
    const size = Math.min(MONSTER_WAVE_CONFIG.maxWaveSize, 1 + Math.floor((ai.elapsed || 0) / MONSTER_WAVE_CONFIG.extraMonsterEverySeconds));
    ai.waveIndex = waveIndex; ai.lastWaveSize = size;
    const spawned = [];
    for (let i = 0; i < size; i++) {
      const offset = (i - (size - 1) / 2) * 28;
      spawned.push(this.spawnMonster(source.x - 58 - offset, source.y + 72 + offset, { name: `AI creep ${waveIndex}.${i + 1}`, type: 'lane_creep', kind: 'lane_creep', ownerId, ownerLabel: 'Enemy AI', hostile: true, passive: false, speed: 50, hp: 10, maxHp: 10, roamRadius: 9999, avoidRadius: 0, aggroRange: 155, laneTargetRef: target.ref, autoAttack: MONSTER_MELEE_ATTACK }));
    }
    this.addFloat(`Enemy wave ${waveIndex}: ${size}`, source.x, source.y + 86, '#c86b5f');
    return spawned;
  }
  updateAiWaves(dt) {
    const ai = this.multiplayer?.aiWave;
    if (!this.multiplayer?.enabled || !ai?.enabled || this.multiplayer.winner) return;
    ai.elapsed = (ai.elapsed || 0) + dt;
    ai.spawnTimer = (ai.spawnTimer ?? MONSTER_WAVE_CONFIG.spawnEverySeconds) - dt;
    while (ai.spawnTimer <= 0) {
      this.spawnEnemyWave(ai.enemyOwnerId || 'p2', ai.targetOwnerId || 'p1');
      ai.spawnTimer += MONSTER_WAVE_CONFIG.spawnEverySeconds;
    }
  }
  exportMultiplayerSave() { return { schema: 'orchestrator-grove-multiplayer-session-v1', exportedAt: new Date().toISOString(), session: this.getMultiplayerSnapshot(), state: this.getState() }; }

  update(dt) {
    if (this.paused) { this.updateCampaignArrivalState(); this.updateFogOfWar(); this.updateUI(dt); return; }
    this.worldTime = (this.worldTime || 0) + dt;
    this.updateFogOfWar();
    this.updatePlayerHealth(dt);
    this.updatePlayer(dt); this.updateProductionStructures(dt); this.updateRangedAttackStructures(dt); this.updateProjectiles(dt); this.updateAssistant(dt); for (const bot of this.bots) this.updateBot(bot, dt);
    this.updateAiWaves(dt);
    this.updateNightMonsterSpawns(dt);
    for (const monster of this.monsters) this.updateMonster(monster, dt);
    this.updateMultiplayer(dt);
    for (const t of this.trees) this.updateTreeGrowth(t, dt);
    for (const r of this.rocks) if (r.depleted) { r.respawn -= dt; if (r.respawn <= 0) Object.assign(r, { depleted: false, hp: r.maxHp }); }
    for (const f of this.floaters) { f.y -= 18 * dt; f.life -= dt; } this.floaters = this.floaters.filter(f => f.life > 0);
    this.updateUI(dt);
  }
  updatePlayer(dt) {
    if (this.player.dead) { this.updateCamera(dt); return; }
    this.updateCamera(dt);
    const eq = ensureEquipment(this.player);
    eq.rangedAttack.cooldownRemaining = Math.max(0, (eq.rangedAttack.cooldownRemaining || 0) - dt);
    this.player.attackCooldown = Math.max(0, (this.player.attackCooldown || 0) - dt);
    const target = this.player.target;
    if (!target) {
      if (this.advancePlayerTargetQueue()) return;
      this.updateActorAutoAttack(this.player, dt);
      return;
    }
    if (target.started && ['search_tree', 'search_hemp', 'chop_hemp', 'chop_tree', 'mine_stone', 'structure_processing', 'deploy_loose_building_kit', 'deploy_building_kit', 'disassemble_building_to_kit'].includes(target.action)) {
      if (target.action === 'structure_processing') {
        const s = this.structures.find(st => st.id === target.structureId);
        if (!this.isStructureProcessing(s)) { this.advancePlayerTargetQueue(); return; }
        target.remaining = s.processing.remaining;
        target.total = s.processing.total;
        target.processLabel = s.processing.label;
        return;
      }
      if (target.action === 'deploy_loose_building_kit' && !this.canFinishPlayerDeployLooseKit(target)) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
      if (target.action === 'deploy_building_kit' && !this.canFinishPlayerDeployHeldKit(target)) { this.advancePlayerTargetQueue(); return; }
      if (target.action === 'disassemble_building_to_kit' && !this.canFinishPlayerDisassembleStructure(target)) { this.advancePlayerTargetQueue(); return; }
      const tree = target.action === 'search_tree' ? this.trees.find(t => t.id === target.resourceId && !t.stump) : null;
      const hemp = target.action !== 'search_tree' ? this.hempPlants.find(h => h.id === target.resourceId && !h.harvested) : null;
      if (target.action === 'search_tree' && (!tree || this.player.inventory)) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
      if (target.action === 'search_hemp' && (!hemp || hemp.searched || this.player.inventory)) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
      if (target.action === 'chop_hemp' && (!hemp || this.player.inventory?.type !== 'crude_axe')) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
      if (target.action === 'chop_tree' && !this.canFinishPlayerChopTree(target)) { this.advancePlayerTargetQueue(); return; }
      if (target.action === 'mine_stone' && !this.canFinishPlayerMineStone(target)) { this.advancePlayerTargetQueue(); return; }
      target.remaining = Math.max(0, (target.remaining ?? target.total ?? TREE_SEARCH_SECONDS) - dt);
      if (target.remaining <= 0) {
        this.releasePlayerTargetReservation();
        this.player.target = null;
        if (target.action === 'search_tree') this.finishTreeSearch(tree);
        if (target.action === 'search_hemp') this.finishHempSearch(hemp);
        if (target.action === 'chop_hemp') this.finishHempChop(hemp);
        if (target.action === 'chop_tree') this.finishPlayerChopTree(target);
        if (target.action === 'mine_stone') this.finishPlayerMineStone(target);
        if (target.action === 'deploy_loose_building_kit') this.finishPlayerDeployLooseKit(target);
        if (target.action === 'deploy_building_kit') this.finishPlayerDeployHeldKit(target);
        if (target.action === 'disassemble_building_to_kit') this.finishPlayerDisassembleStructure(target);
        if (!this.player.target) this.advancePlayerTargetQueue();
      }
      return;
      }
      const d = distXY(this.player.x, this.player.y, target.x, target.y);
      const step = this.player.speed * dt;
      if (d > 0.001) {
        this.player.facingX = (target.x - this.player.x) / d;
        this.player.facingY = (target.y - this.player.y) / d;
      }
      if (d <= Math.max(4, step)) {
        this.player.x = target.x;
        this.player.y = target.y;
      if (['search_tree', 'search_hemp', 'chop_hemp', 'chop_tree', 'mine_stone'].includes(target.action)) {
        if (target.action === 'chop_tree') { this.completePlayerTarget(target); return; }
        if (target.action === 'mine_stone') { this.completePlayerTarget(target); return; }
        if (target.action === 'search_tree') {
          const tree = this.trees.find(t => t.id === target.resourceId && !t.stump);
          if (!tree || this.player.inventory) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
          if (!this.treeSearchAvailable(tree, 'player')) { this.advancePlayerTargetQueue(); this.addFloat('Tree already being searched', tree.x, tree.y - 34, '#c86b5f'); return; }
          tree.searchReservedBy = 'player';
          this.player.target = { ...target, started: true, remaining: TREE_SEARCH_SECONDS, total: TREE_SEARCH_SECONDS, processLabel: 'searching tree' };
          this.addFloat('Searching tree…', tree.x, tree.y - 34, '#d3a95f');
          return;
        }
        const hemp = this.hempPlants.find(h => h.id === target.resourceId && !h.harvested);
        if (!hemp) { this.advancePlayerTargetQueue(); return; }
        if (target.action === 'search_hemp') {
          if (this.player.inventory || hemp.searched) { this.advancePlayerTargetQueue(); this.addFloat(hemp.searched ? 'Hemp already searched' : 'Hands must be empty', hemp.x, hemp.y - 28, '#c86b5f'); return; }
          hemp.searchReservedBy = 'player';
          this.player.target = { ...target, started: true, remaining: HEMP_SEARCH_SECONDS, total: HEMP_SEARCH_SECONDS, processLabel: 'searching hemp' };
          this.addFloat('Searching hemp…', hemp.x, hemp.y - 28, '#d3a95f');
          return;
        }
        if (this.player.inventory?.type !== 'crude_axe') { this.advancePlayerTargetQueue(); this.addFloat('Need crude axe to chop hemp', hemp.x, hemp.y - 28, '#c86b5f'); return; }
        this.player.target = { ...target, started: true, remaining: HEMP_CHOP_SECONDS, total: HEMP_CHOP_SECONDS, processLabel: 'chopping hemp' };
        this.addFloat('Chopping hemp…', hemp.x, hemp.y - 28, '#d3a95f');
        return;
      }
      this.player.target = null;
      this.completePlayerTarget(target);
      if (!this.player.target) this.advancePlayerTargetQueue();
      return;
    }
    this.player.x = clamp(this.player.x + ((target.x - this.player.x) / d) * step, 20, this.map.width - 20);
    this.player.y = clamp(this.player.y + ((target.y - this.player.y) / d) * step, 20, this.map.height - 20);
  }
  updateAssistant(dt) {
    const tx = this.player.x - 30, ty = this.player.y + 24;
    const beforeX = this.assistant.x;
    const beforeY = this.assistant.y;
    this.moveToward(this.assistant, tx, ty, dt, 135, 28);
    const dx = this.assistant.x - beforeX;
    const dy = this.assistant.y - beforeY;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) { this.assistant.facingX = dx / len; this.assistant.facingY = dy / len; }
  }

  updateBot(bot, dt) {
    if (bot.paused) { bot.state = 'paused'; bot.message = `Paused ${bot.program} workflow.`; return; }
    if (this.updateBotProductionBusy(bot)) return;
    if (bot.program === 'idle') {
      if (this.updateActorAutoAttack(bot, dt, { searchRange: IDLE_BOT_AUTO_ATTACK_RANGE })) return;
    } else {
      this.updateActorAutoAttack(bot, dt);
    }
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
    if (bot.program === 'dog_fetch') return this.programDogFetch(bot, dt);
    if (bot.program === 'taught_loop') return this.programTaughtLoop(bot, dt);
    return this.programIdle(bot, dt);
  }
  programIdle(bot, dt) { this.releaseReservation(bot); const depot = this.idleDepot || { x: 115, y: 245, label: 'idle depot' }; const angle = (bot.id / Math.max(1,this.bots.length)) * Math.PI*2; const tx=depot.x+Math.cos(angle)*42, ty=depot.y+Math.sin(angle)*32; bot.message=`Parked at ${depot.label || 'idle depot'}.`; this.moveToward(bot, tx, ty, dt, bot.speed*0.6, 6); }
  programDogFetch(bot, dt) {
    bot.kind = 'dog';
    bot.knowledgePacks = bot.knowledgePacks?.length ? bot.knowledgePacks : ['dog_fetch'];
    bot.dogFetchMemory = this.normalizeDogFetchMemory(bot.dogFetchMemory);
    const request = this.normalizeDogFetchState(bot.dogFetchState);
    bot.dogFetchState = request;
    if (!request) {
      this.releaseReservation(bot);
      const reached = this.moveBotTo(bot, this.player, dt, 42);
      bot.message = reached ? 'At heel. Awaiting fetch command.' : 'Following the player.';
      return;
    }
    if (bot.inventory) {
      const reached = this.moveBotTo(bot, this.player, dt, 38);
      const wasAwaitingReward = !!request.awaitingReward;
      request.awaitingReward = reached || request.awaitingReward;
      bot.message = reached ? `Returning ${itemLabel(bot.inventory.type)} for praise.` : `Following player with ${itemLabel(bot.inventory.type)}.`;
      bot.target = null;
      if (reached && !wasAwaitingReward) this.syncDogPopupUi?.(true);
      return;
    }
    let targetItem = request.targetItemId ? this.items.find(item => item.id === request.targetItemId && (!item.reservedBy || item.reservedBy === bot.id) && item.type === request.targetType && distXY(bot.x, bot.y, item.x, item.y) <= DOG_FETCH_SEARCH_RADIUS) : null;
    if (!targetItem) {
      const targetType = request.requestedType || request.targetType || this.chooseDogFetchTargetType(bot, null);
      request.targetType = targetType;
      targetItem = targetType ? nearest(this.items, bot.x, bot.y, item => item.type === targetType && (!item.reservedBy || item.reservedBy === bot.id) && !this.isEquipmentItem(item.type) && distXY(bot.x, bot.y, item.x, item.y) <= DOG_FETCH_SEARCH_RADIUS) : null;
      if (!targetItem && request.requestedType) {
        const fallbackType = this.chooseDogFetchTargetType(bot, null);
        if (fallbackType && fallbackType !== request.requestedType) {
          request.targetType = fallbackType;
          targetItem = nearest(this.items, bot.x, bot.y, item => item.type === fallbackType && (!item.reservedBy || item.reservedBy === bot.id) && !this.isEquipmentItem(item.type) && distXY(bot.x, bot.y, item.x, item.y) <= DOG_FETCH_SEARCH_RADIUS) || null;
        }
      }
      if (!targetItem && !request.requestedType && !request.targetType) targetItem = nearest(this.items, bot.x, bot.y, item => (!item.reservedBy || item.reservedBy === bot.id) && !this.isEquipmentItem(item.type) && distXY(bot.x, bot.y, item.x, item.y) <= DOG_FETCH_SEARCH_RADIUS) || null;
      if (targetItem) {
        request.targetItemId = targetItem.id;
        request.targetType = targetItem.type;
        targetItem.reservedBy = bot.id;
      }
    }
    if (!targetItem) {
      bot.message = `No nearby ${request.requestedType ? itemLabel(request.requestedType) : 'item'} to fetch.`;
      this.releaseReservation(bot);
      return;
    }
    if (!this.moveBotTo(bot, targetItem, dt, 12)) {
      bot.message = `Fetching ${itemLabel(targetItem.type)}.`;
      return;
    }
    if (!this.pickItem(bot, targetItem)) {
      bot.message = `Could not fetch ${itemLabel(targetItem.type)}.`;
      request.targetItemId = null;
      return;
    }
    request.targetItemId = null;
    request.targetType = targetItem.type;
    request.awaitingReward = true;
    bot.message = `Fetched ${itemLabel(targetItem.type)}.`;
    bot.target = null;
    this.syncBotDrawerUi?.();
  }
  programChopWood(bot, dt) {
    if (!this.ensureChopTool(bot, dt)) return;
    const zone = this.getBotZone(bot);
    let tree = this.isChoppableTree(bot.target) && this.objectInZone(bot.target, zone, bot) ? bot.target : null;
    if (!tree) { tree = nearest(this.trees, bot.x, bot.y, t => this.isChoppableTree(t) && this.objectInZone(t, zone, bot)); bot.target = tree; }
    if (!tree) return bot.message=`No living trees in ${this.zoneLabel(zone)}.`;
    const toolType = bot.inventory?.type;
    if (!this.moveBotTo(bot, tree, dt, tree.radius + 14)) return bot.message=`Walking to tree in ${this.zoneLabel(zone)} with ${itemLabel(toolType)}.`;
    bot.timer += dt; bot.message = `Chopping with ${itemLabel(toolType)} (${Math.min(RESOURCE_HIT_SECONDS, Math.ceil(bot.timer))}/${RESOURCE_HIT_SECONDS}).`;
    if (bot.timer >= RESOURCE_HIT_SECONDS) {
      bot.timer=0; tree.hp--; bot.inventory.durability--; this.spawnItem('log', tree.x, tree.y, 1);
      this.emitSound('chop', { cooldownKey: `bot:chop:${bot.id}`, minGapMs: 220 });
      if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(toolType)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
      if (tree.hp <= 0) { tree.stump = true; tree.regrow = 0; bot.target = null; this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); }
    }
  }
  ensureChopTool(bot, dt) {
    const held = this.carriedTool(bot);
    if (held?.type === 'crude_axe') return true;
    if (bot.inventory) { bot.message = `Holding ${itemLabel(bot.inventory.type)}; needs crude axe to chop.`; return false; }
    let item = bot.targetItemPurpose === 'tool' && bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === 'crude_axe') : null;
    if (!item) {
      item = nearest(this.items, bot.x, bot.y, i => i.type === 'crude_axe' && (!i.reservedBy || i.reservedBy === bot.id));
      if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'tool'; bot.target = null; }
    }
    if (!item) { bot.message = `Needs crude axe lying on the map to chop.`; return false; }
    if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Fetching ${itemLabel(item.type)} for chopping.`; return false; }
    if (!this.carryToolItem(bot, item.type)) { bot.message = `Holding ${itemLabel(bot.inventory?.type || 'item')}; needs crude axe to chop.`; return false; }
    this.items = this.items.filter(i => i.id !== item.id);
    bot.targetItemId = null; bot.targetItemPurpose = null;
    bot.message = `Holding ${itemLabel(bot.inventory.type)}.`;
    return true;
  }
  ensureMineTool(bot, dt) {
    const held = this.carriedTool(bot);
    if (held?.type === 'crude_pickaxe') return true;
    if (bot.inventory) { bot.message = `Holding ${itemLabel(bot.inventory.type)}; needs crude pickaxe to mine stone.`; return false; }
    let item = bot.targetItemPurpose === 'tool' && bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === 'crude_pickaxe') : null;
    if (!item) {
      item = nearest(this.items, bot.x, bot.y, i => i.type === 'crude_pickaxe' && (!i.reservedBy || i.reservedBy === bot.id));
      if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'tool'; bot.target = null; }
    }
    if (!item) { bot.message = 'Needs crude pickaxe lying on the map to mine stone.'; return false; }
    if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Fetching ${itemLabel(item.type)} for mining.`; return false; }
    if (!this.carryToolItem(bot, item.type)) { bot.message = `Holding ${itemLabel(bot.inventory?.type || 'item')}; needs crude pickaxe to mine stone.`; return false; }
    this.items = this.items.filter(i => i.id !== item.id);
    bot.targetItemId = null; bot.targetItemPurpose = null;
    bot.message = `Holding ${itemLabel(bot.inventory.type)}.`;
    return true;
  }
  programMineStone(bot, dt) {
    if (!this.ensureMineTool(bot, dt)) return;
    const zone = this.getBotZone(bot);
    let rock = bot.target?.type === 'stone_deposit' && !bot.target.depleted && this.objectInZone(bot.target, zone, bot) ? bot.target : null;
    if (!rock) { rock = nearest(this.rocks, bot.x, bot.y, r => !r.depleted && this.objectInZone(r, zone, bot)); bot.target = rock; }
    if (!rock) return bot.message = `No stone deposits in ${this.zoneLabel(zone)}.`;
    const toolType = bot.inventory?.type;
    if (!this.moveBotTo(bot, rock, dt, rock.radius + 14)) return bot.message = `Walking to stone deposit in ${this.zoneLabel(zone)} with ${itemLabel(toolType)}.`;
    bot.timer += dt; bot.message = `Mining stone with ${itemLabel(toolType)} (${Math.min(RESOURCE_HIT_SECONDS, Math.ceil(bot.timer))}/${RESOURCE_HIT_SECONDS}).`;
    if (bot.timer >= RESOURCE_HIT_SECONDS) {
      bot.timer = 0; rock.hp--; bot.inventory.durability--; this.spawnItem('stone', rock.x, rock.y, 1);
      this.emitSound('mine', { cooldownKey: `bot:mine:${bot.id}`, minGapMs: 220 });
      if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(toolType)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
      if (rock.hp <= 0) { rock.depleted = true; rock.respawn = 24; bot.target = null; this.addFloat('Stone deposit depleted', rock.x, rock.y - 24, '#9aa09d'); }
    }
  }
  ensureDigTool(bot, dt) {
    const held = this.carriedTool(bot);
    if (held?.type === 'crude_shovel') return true;
    if (bot.inventory) { bot.message = `Holding ${itemLabel(bot.inventory.type)}; needs crude shovel to dig.`; return false; }
    let item = bot.targetItemPurpose === 'tool' && bot.targetItemId ? this.items.find(i => i.id === bot.targetItemId && i.type === 'crude_shovel') : null;
    if (!item) {
      item = nearest(this.items, bot.x, bot.y, i => i.type === 'crude_shovel' && (!i.reservedBy || i.reservedBy === bot.id));
      if (item) { item.reservedBy = bot.id; bot.targetItemId = item.id; bot.targetItemPurpose = 'tool'; bot.target = null; }
    }
    if (!item) { bot.message = 'Needs crude shovel lying on the map to dig.'; return false; }
    if (!this.moveBotTo(bot, item, dt, 12)) { bot.message = `Fetching ${itemLabel(item.type)} for digging.`; return false; }
    if (!this.carryToolItem(bot, item.type)) { bot.message = `Holding ${itemLabel(bot.inventory?.type || 'item')}; needs crude shovel to dig.`; return false; }
    this.items = this.items.filter(i => i.id !== item.id);
    bot.targetItemId = null; bot.targetItemPurpose = null;
    bot.message = `Holding ${itemLabel(bot.inventory.type)}.`;
    return true;
  }
  digBoundsForZone(zone, from) {
    if (!zone) return { x: clamp(from.x - 120, 0, this.map.width - 1), y: clamp(from.y - 120, 0, this.map.height - 1), w: 240, h: 240 };
    if (zone.kind === 'radius') {
      const s = zone.centerStructureId ? this.structures.find(st => st.id === zone.centerStructureId) : null;
      const c = s || (Number.isFinite(zone.x) && Number.isFinite(zone.y) ? zone : from), r = zone.radius || 120;
      return { x: clamp(c.x - r, 0, this.map.width - 1), y: clamp(c.y - r, 0, this.map.height - 1), w: Math.min(r * 2, this.map.width), h: Math.min(r * 2, this.map.height) };
    }
    return zone;
  }
  isDiggable(x, y, clearance = HOLE_BLOCK_RADIUS) {
    if (this.holes.some(h => distXY(x, y, h.x, h.y) < Math.max(clearance, h.blockRadius || HOLE_BLOCK_RADIUS))) return false;
    if (this.structures.some(s => rectDistance(x, y, s) < clearance)) return false;
    if (this.trees.some(t => !t.stump && distXY(x, y, t.x, t.y) < t.radius + clearance)) return false;
    if (this.rocks.some(r => !r.depleted && distXY(x, y, r.x, r.y) < r.radius + clearance)) return false;
    return x >= 12 && y >= 12 && x <= this.map.width - 12 && y <= this.map.height - 12;
  }
  findDigSpotInZone(bot, zone) {
    const b = this.digBoundsForZone(zone, bot);
    const step = HOLE_BLOCK_RADIUS + 8;
    const spots = [];
    for (let y = b.y + step / 2; y <= b.y + b.h - step / 2; y += step) {
      for (let x = b.x + step / 2; x <= b.x + b.w - step / 2; x += step) {
        if (this.pointInZone(x, y, zone, bot) && this.isDiggable(x, y)) spots.push({ kind: 'dig_spot', x, y });
      }
    }
    return nearest(spots, bot.x, bot.y);
  }
  findDigSpot(bot) {
    return this.findDigSpotInZone(bot, this.getBotZone(bot));
  }
  programDigHoles(bot, dt) {
    if (!this.ensureDigTool(bot, dt)) return;
    const zone = this.getBotZone(bot);
    let spot = bot.target?.kind === 'dig_spot' && this.pointInZone(bot.target.x, bot.target.y, zone, bot) && this.isDiggable(bot.target.x, bot.target.y) ? bot.target : null;
    if (!spot) { spot = this.findDigSpot(bot); bot.target = spot; bot.timer = 0; }
    if (!spot) return bot.message = `No open dirt to dig in ${this.zoneLabel(zone)}.`;
    const toolType = bot.inventory?.type;
    if (!this.moveBotTo(bot, spot, dt, 12)) return bot.message = `Walking to dig spot in ${this.zoneLabel(zone)} with ${itemLabel(toolType)}.`;
    bot.timer += dt; bot.message = `Digging hole with ${itemLabel(toolType)} (${Math.ceil(bot.timer*2)}/2).`;
    if (bot.timer >= 1) {
      bot.timer = 0; bot.inventory.durability--; this.spawnHole(spot.x, spot.y); this.addFloat('Dug hole', spot.x, spot.y - 16, '#6b4a28'); bot.target = null;
      this.emitSound('dig', { cooldownKey: `bot:dig:${bot.id}`, minGapMs: 220 });
      if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(toolType)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
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
    let hole = bot.targetHoleId ? this.holes.find(h => h.id === bot.targetHoleId && this.openHoleInZone(h, zone, bot) && (!h.reservedBy || h.reservedBy === bot.id)) : null;
    if (!hole) {
      hole = this.nearestOpenHole(bot.x, bot.y, zone, Infinity, bot.id, bot);
      if (hole) { hole.reservedBy = bot.id; bot.targetHoleId = hole.id; bot.target = hole; }
    }
    if (!hole) return bot.message = `No open dug holes in ${this.zoneLabel(zone)}.`;
    if (!this.moveBotTo(bot, hole, dt, 12)) return bot.message = `Carrying tree seed to hole in ${this.zoneLabel(zone)}.`;
    this.plantSeedInHole(hole, bot);
    bot.inventory = null;
    bot.target = null;
    bot.message = `Planted tree seed in ${this.zoneLabel(zone)}.`;
  }
  botStorageRetryReady(bot, key, label, x = bot?.x || this.player.x, y = bot?.y || this.player.y) {
    if (!bot) return true;
    if (!bot.runtime) bot.runtime = { pc: 0, memory: {}, wait: 0 };
    if (!bot.runtime.retryUntil) bot.runtime.retryUntil = {};
    const now = this.worldTime || 0;
    const until = Number(bot.runtime.retryUntil[key] || 0);
    if (until > now) {
      bot.message = `${label} Retry in ${Math.ceil(until - now)}s.`;
      return false;
    }
    bot.runtime.retryUntil[key] = now + BOT_STORAGE_RETRY_SECONDS;
    return true;
  }
  workerBot(worker) { return worker?.bot || (worker?.id ? worker : null); }
  takePlayerItemForBot(bot, type) {
    if (!bot || bot.inventory) return false;
    if (this.player.inventory?.type !== type) { bot.message = `Player has no ${itemLabel(type)} to take.`; return false; }
    bot.inventory = { type, count: this.player.inventory.count || 1 };
    this.player.inventory = null;
    this.addFloat(`Bot ${bot.id} took ${itemLabel(type)} from player`, this.player.x, this.player.y - 35, '#d3a95f');
    this.emitSound('storage', { cooldownKey: `bot:player-take:${bot.id}`, minGapMs: 120 });
    return true;
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

  executeDeployBuildingKitStep(bot, step, dt) {
    const kitType = this.normalizeBuildingKitItemType(step.type);
    if (!kitType) { bot.message = 'deploy_building_kit needs a building kit type.'; return false; }
    if (!bot.inventory || bot.inventory.type !== kitType) { bot.message = `Taught loop needs ${itemLabel(kitType)} before deploying.`; bot.runtime.pc = 0; return false; }
    const zone = step.zoneSpec || (step.zoneId ? this.zones.find(z => z.id === step.zoneId) : null);
    const target = this.zoneCenter(zone, bot) || bot;
    if (target && !this.moveBotTo(bot, target, dt, 12)) { bot.timer = 0; bot.message = `Taught loop: deploy ${itemLabel(kitType)} in ${this.zoneLabel(zone)}.`; return false; }
    bot.timer += dt;
    bot.message = `Deploying ${itemLabel(kitType)} (${Math.min(BUILDING_KIT_DEPLOY_SECONDS, bot.timer).toFixed(1)}/${BUILDING_KIT_DEPLOY_SECONDS.toFixed(1)}s).`;
    if (bot.timer < BUILDING_KIT_DEPLOY_SECONDS) return false;
    const s = this.deployBuildingKitAt(kitType, target.x, target.y);
    if (!s) { bot.message = `Cannot deploy ${itemLabel(kitType)}.`; return false; }
    bot.inventory = null;
    bot.message = `Deployed ${itemLabel(kitType)} as ${s.name}.`;
    return true;
  }
  executeDisassembleBuildingToKitStep(bot, step, dt) {
    if (bot.inventory) { bot.message = `Disassemble needs empty hands; holding ${itemLabel(bot.inventory.type)}.`; return false; }
    let s = this.resolveRecordedStructure(step, bot);
    if (!this.canDisassembleStructure(s)) s = nearest(this.structures, bot.x, bot.y, st => this.canDisassembleStructure(st) && (!step.structureType || st.type === step.structureType));
    if (!s) { bot.message = `No disassemblable ${step.structureName || step.structureType || 'building'} found.`; return false; }
    if (!this.moveBotTo(bot, s, dt, 34)) { bot.timer = 0; bot.message = `Taught loop: disassemble ${s.name}.`; return false; }
    bot.timer += dt;
    bot.message = `Disassembling ${s.name} (${Math.min(BUILDING_DISASSEMBLE_SECONDS, bot.timer).toFixed(1)}/${BUILDING_DISASSEMBLE_SECONDS.toFixed(1)}s).`;
    if (bot.timer < BUILDING_DISASSEMBLE_SECONDS) return false;
    const kitType = this.disassembleStructureToKit(s, bot);
    if (!kitType) { bot.message = `Cannot disassemble ${s.name}.`; return false; }
    bot.message = `Disassembled ${s.name} into ${itemLabel(kitType)}.`;
    return true;
  }
  manualMineStone() {
    const rock = nearest(this.rocks, this.player.x, this.player.y, r => !r.depleted && distXY(this.player.x,this.player.y,r.x,r.y)<48);
    if (!rock) return false;
    if (this.player.inventory?.type !== 'crude_pickaxe') {
      const held = this.player.inventory ? ` (holding ${itemLabel(this.player.inventory.type)})` : '';
      this.addFloat(`Need crude pickaxe in hands${held}`, this.player.x, this.player.y - 30, '#c86b5f');
      return true;
    }
    return this.startPlayerResourceWork({ action: 'mine_stone', resourceId: rock.id, x: rock.x, y: rock.y }, rock, 'mining stone');
  }
  manualChopTree() {
    const tree = nearest(this.trees, this.player.x, this.player.y, t => this.isChoppableTree(t) && distXY(this.player.x,this.player.y,t.x,t.y)<45);
    if (!tree) return false;
    if (this.player.inventory?.type !== 'crude_axe') {
      const held = this.player.inventory ? ` (holding ${itemLabel(this.player.inventory.type)})` : '';
      this.addFloat(`Need crude axe in hands${held}`, this.player.x, this.player.y - 30, '#c86b5f');
      return true;
    }
    return this.startPlayerResourceWork({ action: 'chop_tree', resourceId: tree.id, x: tree.x, y: tree.y }, tree, 'chopping tree');
  }
  manualDigHole() {
    if (this.player.inventory?.type !== 'crude_shovel') return false;
    if (!this.isDiggable(this.player.x, this.player.y)) { this.addFloat('Need clear dirt to dig', this.player.x, this.player.y - 30, '#c86b5f'); return true; }
    const x = this.player.x, y = this.player.y;
    this.spawnHole(x, y);
    this.addFloat('Dug hole with crude shovel', this.player.x, this.player.y - 30, '#d3a95f');
    this.emitSound('dig', { cooldownKey: 'player:dig', minGapMs: 120 });
    this.recordTeachStep(this.digRadiusStep(x, y));
    this.syncTeachUi();
    return true;
  }
  manualPlantSeed() {
    if (this.player.inventory?.type !== 'tree_seed') return false;
    const hole = this.nearestOpenHole(this.player.x, this.player.y, null, 46, null);
    if (!hole) return false;
    return this.manualPlantSeedAtHole(hole);
  }
  manualPlantSeedAtHole(hole) {
    if (!hole || hole.planted || this.player.inventory?.type !== 'tree_seed') return false;
    this.plantSeedInHole(hole);
    this.player.inventory = null;
    this.addFloat('Planted tree seed', this.player.x, this.player.y - 30, '#9abf8f');
    this.recordTeachStep({ op: 'plant_seed', holeId: hole.id, holeRef: hole.ref, holeName: hole.ref, zoneSpec: { kind: 'radius', x: Math.round(hole.x), y: Math.round(hole.y), radius: 64, name: `planting radius around ${hole.ref}` }, zoneLabel: `planting radius around ${hole.ref}` });
    this.syncTeachUi();
    return true;
  }
  interact() {
    const s = this.structures.find(st => rectDistance(this.player.x,this.player.y,st)<45);
    if (this.player.inventory?.type === 'crude_hammer' && this.manualDemolishStructure(s)) return;
    if (isBuildingKitItemType(this.player.inventory?.type) && this.queuePlayerDeployHeldKit(this.player.x, this.player.y + 42)) return;
    if (this.player.inventory?.type === 'crude_shovel') { this.manualDigHole(); return; }
    if (this.player.inventory?.type === 'crude_pickaxe' && this.manualMineStone()) return;
    if (this.player.inventory?.type === 'crude_axe' && this.manualChopTree()) return;
    const hemp = nearest(this.hempPlants, this.player.x, this.player.y, h => !h.harvested && distXY(this.player.x, this.player.y, h.x, h.y) < 46);
    if (hemp && this.queuePlayerHempAction(hemp)) return;
    if (this.player.inventory && s) {
      if (this.manualDepositToStructure(s, { waitIfProcessing: true })) return;
      if (this.player.inventory && this.isStructureProcessing(s) && this.queuePlayerStructureDeposit(s)) return;
    }
    if (!this.player.inventory && this.player.target?.action === 'pickup_item') {
      const targetItem = this.items.find(i => i.id === this.player.target.itemId);
      if (this.manualPickupItem(targetItem)) { this.player.target = null; return; }
    }
    if (!this.player.inventory && this.manualPickupNearest()) return;
    if (this.manualMineStone()) return;
    if (this.manualChopTree()) return;
    if (STORAGE_STRUCTURE_TYPES.includes(s?.type)) { this.acceptNearestItemForPalette(s); return; }
    if (s?.type==='workbench') { if (this.isStructureProcessing(s) || (s.sticks>=1 && s.stones>=1)) { this.maybeStartStructureProcessing(s, { kind: 'player' }); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; } const item = nearest(this.items, s.x, s.y, i => ['stick','stone'].includes(i.type) && distXY(i.x,i.y,s.x,s.y)<70); if (item && this.depositHeldItemToStructure(s, item.type, { worker: { kind: 'player' } })) { this.items = this.items.filter(i => i.id !== item.id); } return; }
    if (s?.type==='sawbench' && (s.logs>0 || s.planks>0 || this.isStructureProcessing(s))) { this.maybeStartStructureProcessing(s, { kind: 'player' }); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; }
    if (s?.type==='smithery') { const input = smitheryInputFor(smitheryRecipe(s)); const key = input === 'stick' ? 'sticks' : 'planks'; if (this.isStructureProcessing(s) || (s[key] || 0) > 0) { this.maybeStartStructureProcessing(s, { kind: 'player' }); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; } }
    if (s?.type==='bowmaker' && (this.isStructureProcessing(s) || Object.entries(BOW_RECIPE).every(([type,cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost))) { this.maybeStartStructureProcessing(s, { kind: 'player' }); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; }
    if (s?.type==='arrowmaker' && (this.isStructureProcessing(s) || (s.sticks >= 1 && s.stones >= 1))) { this.maybeStartStructureProcessing(s, { kind: 'player' }); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); return; }
    if (s?.type==='factory' && (this.isStructureProcessing(s) || Object.entries(FACTORY_BOT_RECIPE).every(([type,cost]) => (s[`${type}s`] ?? s[type] ?? 0) >= cost))) { this.maybeStartStructureProcessing(s, { kind: 'player' }); this.addFloat(`${s.name} processing`, s.x, s.y-35, '#d3a95f'); }
  }












  renderBotDrawerCard(bot) {
    const team = this.botTeam(bot);
    const name = this.botDisplayName(bot);
    const color = this.teamColor(team?.color || '#101413');
    const teamText = team ? team.name : 'No team';
    const roleLabel = this.isDogBot(bot) ? 'dog' : (bot.status === 'manager' ? 'manager' : 'worker');
    return `<article class="bot-card bot-team-card" draggable="true" data-bot-card data-bot-id="${bot.id}" style="--team-color:${escapeHtml(color)}"><button type="button" class="bot-badge bot-card-menu-button" data-open-bot-menu="${bot.id}" aria-label="Open ${escapeHtml(name)} menu">#${bot.id}</button><div class="bot-card-body"><div class="bot-card-topline"><label class="bot-name-edit">Name <input data-bot-name-input="${bot.id}" value="${escapeHtml(name)}" maxlength="32" /></label><button type="button" class="bot-card-inline-action" data-open-bot-menu="${bot.id}">Open menu</button></div><p><span class="program">${escapeHtml(bot.program)}</span> · ${escapeHtml(teamText)} · ${escapeHtml(roleLabel)}</p><p>${escapeHtml(bot.message)}</p></div></article>`;
  }

  renderBotDrawerTeam(team, bots) {
    const color = this.teamColor(team.color);
    const body = bots.length ? bots.map(bot => this.renderBotDrawerCard(bot)).join('') : '<p class="empty">Drop bot cards here to assign this team.</p>';
    return `<section class="bot-team-section" data-team-dropzone data-team-id="${escapeHtml(team.id)}" style="--team-color:${escapeHtml(color)}"><header><span class="team-color-dot" aria-hidden="true"></span><b>${escapeHtml(team.name)}</b><small>${bots.length} bot${bots.length === 1 ? '' : 's'}</small><label class="team-color-edit">Color <input type="color" data-team-color-input="${escapeHtml(team.id)}" value="${escapeHtml(color)}"></label></header><div class="bot-team-cards">${body}</div></section>`;
  }

  syncBotDrawerUi(force = false) {
    const list = this.dom.botList;
    if (!list || (this.botDrawerDragging && !force)) return;
    const active = document.activeElement;
    if (!force && active?.matches?.('[data-bot-name-input]')) return;
    const query = String(this.botSearchQuery || this.dom.botSearch?.value || '').trim().toLowerCase();
    const matches = bot => !query || this.botDisplayName(bot).toLowerCase().includes(query);
    const bots = this.bots.filter(matches);
    const sections = this.botTeams.map(team => this.renderBotDrawerTeam(team, bots.filter(bot => bot.teamId === team.id)));
    const unassigned = bots.filter(bot => !this.findBotTeam(bot.teamId));
    const unassignedBody = unassigned.length ? unassigned.map(bot => this.renderBotDrawerCard(bot)).join('') : `<p class="empty">${query ? 'No unassigned bots match this search.' : 'No unassigned bots.'}</p>`;
    const emptySearch = query && !bots.length ? '<p class="empty bot-search-empty">No bots match that name.</p>' : '';
    const teamHint = this.botTeams.length ? '' : '<p class="empty bot-team-hint">Create a team above, then drag bot cards into it.</p>';
    list.innerHTML = `${emptySearch}${teamHint}${sections.join('')}<section class="bot-team-section bot-team-unassigned" data-team-dropzone data-team-id=""><header><span class="team-color-dot" aria-hidden="true"></span><b>No team</b><small>${unassigned.length} bot${unassigned.length === 1 ? '' : 's'}</small></header><div class="bot-team-cards">${unassignedBody}</div></section>`;
  }

  bindBotDrawerControls() {
    this.dom.botSearch?.addEventListener('input', () => { this.botSearchQuery = this.dom.botSearch.value; this.syncBotDrawerUi(); });
    this.dom.botTeamForm?.addEventListener('submit', event => {
      event.preventDefault();
      const team = this.createBotTeam(this.dom.botTeamName?.value, this.dom.botTeamColor?.value);
      if (this.dom.botTeamName) this.dom.botTeamName.value = '';
      if (this.dom.botTeamColor) this.dom.botTeamColor.value = team.color;
    });
    this.dom.botList?.addEventListener('change', event => {
      const nameInput = event.target.closest('[data-bot-name-input]');
      if (nameInput) { this.setBotName(nameInput.dataset.botNameInput, nameInput.value); return; }
      const colorInput = event.target.closest('[data-team-color-input]');
      if (colorInput) this.setBotTeamColor(colorInput.dataset.teamColorInput, colorInput.value);
    });
    this.dom.botList?.addEventListener('keydown', event => {
      const input = event.target.closest('[data-bot-name-input]');
      if (input && event.key === 'Enter') { event.preventDefault(); input.blur(); this.setBotName(input.dataset.botNameInput, input.value); }
    });
    this.dom.botList?.addEventListener('click', event => {
      const button = event.target.closest('[data-open-bot-menu]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const card = button.closest('[data-bot-card]');
      const bot = this.findBot(Number(button.dataset.openBotMenu || card?.dataset.botId || 0));
      if (!bot || !card) return;
      const rect = card.getBoundingClientRect();
      this.showBotMenu(bot, rect.right - 8, rect.top + Math.min(rect.height * 0.5, 40), { refreshEdit: true });
    });
    this.dom.botList?.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-bot-card]');
      if (!card) return;
      this.botDrawerDragging = true;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.botId);
      card.classList.add('is-dragging');
    });
    this.dom.botList?.addEventListener('dragend', event => {
      event.target.closest('[data-bot-card]')?.classList.remove('is-dragging');
      this.botDrawerDragging = false;
      this.dom.botList?.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
      this.syncBotDrawerUi(true);
    });
    this.dom.botList?.addEventListener('dragover', event => {
      const zone = event.target.closest('[data-team-dropzone]');
      if (!zone) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      zone.classList.add('is-drop-target');
    });
    this.dom.botList?.addEventListener('dragleave', event => {
      const zone = event.target.closest('[data-team-dropzone]');
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('is-drop-target');
    });
    this.dom.botList?.addEventListener('drop', event => {
      const zone = event.target.closest('[data-team-dropzone]');
      if (!zone) return;
      event.preventDefault();
      const botId = event.dataTransfer.getData('text/plain');
      this.assignBotToTeam(botId, zone.dataset.teamId || null);
      this.botDrawerDragging = false;
      zone.classList.remove('is-drop-target');
      this.syncBotDrawerUi(true);
    });
  }

  editableBotProgramFrom(bot) {
    const current = this.getBotProgram(bot);
    const steps = clone(current.resolvedSteps || current.steps || []);
    return {
      id: current.id || `${bot.program || 'bot'}_editable`,
      name: current.name || `Bot ${bot.id} editable loop`,
      description: current.description || 'Editable bot DSL program from the bot context menu.',
      steps
    };
  }

  ensureBotMenuEdit(bot, { refresh = false } = {}) {
    const nextProgram = this.editableBotProgramFrom(bot);
    const sameBot = this.botMenuEdit?.botId === bot.id;
    const shouldRefresh = refresh || !sameBot || JSON.stringify(this.botMenuEdit?.program || null) !== JSON.stringify(nextProgram);
    if (shouldRefresh) {
      this.botMenuEdit = {
        botId: bot.id,
        program: nextProgram,
        status: sameBot ? this.botMenuEdit.status : '',
        nameStatus: sameBot ? this.botMenuEdit.nameStatus : '',
        nameEditing: sameBot ? this.botMenuEdit.nameEditing : false,
        nameDraft: sameBot ? this.botMenuEdit.nameDraft : ''
      };
    }
    return this.botMenuEdit;
  }

  renderBotProgramEditSteps(steps = []) {
    if (!steps.length) return '<li class="empty">No DSL steps yet.</li>';
    return steps.map((step, index) => this.renderStepCard(step, index, { mode: 'bot-edit' })).join('');
  }

  syncBotMenuEditSurface(root) {
    const edit = this.botMenuEdit;
    if (root) this.botMenuEditRoot = root;
    if (!root || !edit) return;
    const json = root.querySelector('[data-bot-json-editor]');
    if (json && document.activeElement !== json) json.value = JSON.stringify(edit.program, null, 2);
    const list = root.querySelector('[data-bot-program-steps]');
    if (list) list.innerHTML = this.renderBotProgramEditSteps(edit.program.steps || []);
    const status = root.querySelector('[data-bot-edit-status]');
    if (status) status.textContent = edit.status || 'Edit JSON, or adjust the DSL cards and accept them.';
  }

  setBotMenuEditSteps(steps, status = 'DSL cards edited. Accept card flow to activate.') {
    if (!this.botMenuEdit) return false;
    const nextSteps = clone(steps || []);
    for (const step of nextSteps) step.text = this.stepText(step);
    this.botMenuEdit.program = { ...this.botMenuEdit.program, steps: nextSteps };
    if (status !== null) this.botMenuEdit.status = status;
    return true;
  }

  updateBotMenuEditStep(index, patch) {
    if (!this.botMenuEdit) return false;
    const steps = clone(this.botMenuEdit.program.steps || []);
    const step = steps[index];
    if (!step) return false;
    Object.assign(step, patch);
    if (patch.type === '') delete step.type;
    if (patch.name === '') delete step.name;
    if (patch.target === '') { delete step.target; delete step.botId; delete step.botName; delete step.targetName; }
    if (patch.recipient === '') { delete step.recipient; delete step.recipientBotId; delete step.recipientName; }
    if (patch.message === '') delete step.message;
    step.text = this.stepText(step);
    return this.setBotMenuEditSteps(steps);
  }

  moveBotMenuEditStep(index, delta) {
    if (!this.botMenuEdit) return false;
    const steps = clone(this.botMenuEdit.program.steps || []);
    const to = index + delta;
    if (index < 0 || to < 0 || index >= steps.length || to >= steps.length) return false;
    [steps[index], steps[to]] = [steps[to], steps[index]];
    return this.setBotMenuEditSteps(steps);
  }

  deleteBotMenuEditStep(index) {
    if (!this.botMenuEdit) return false;
    const steps = clone(this.botMenuEdit.program.steps || []);
    if (index < 0 || index >= steps.length) return false;
    steps.splice(index, 1);
    return this.setBotMenuEditSteps(steps);
  }

  addBotMenuEditLoopStep() {
    if (!this.botMenuEdit) return false;
    const steps = clone(this.botMenuEdit.program.steps || []);
    if (steps.some(step => step.op === 'loop')) this.botMenuEdit.status = 'This DSL already has a loop step.';
    else {
      steps.push({ op: 'loop', text: 'loop' });
      this.setBotMenuEditSteps(steps);
    }
    return true;
  }

  saveBotMenuJson(bot, text) {
    this.ensureBotMenuEdit(bot);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (err) { this.botMenuEdit.status = `JSON error: ${err.message}`; return { ok: false, error: err.message }; }
    const program = parsed?.program || parsed;
    const checked = this.validateDslProgram(program);
    if (!checked.ok) { this.botMenuEdit.status = `Validation failed: ${checked.error}`; return checked; }
    const nextProgram = { ...program, id: checked.program.id, name: checked.program.name, steps: checked.program.steps };
    const res = this.assignCustomDslProgram({ botId: bot.id, program: nextProgram, reason: 'Edited from bot menu JSON.' });
    this.botMenuEdit = { botId: bot.id, program: clone(res.program || nextProgram), status: res.ok ? `Saved JSON and refreshed Bot ${bot.id}.` : `Save failed: ${res.error}` };
    return res;
  }

  acceptBotMenuDslCards(bot) {
    const edit = this.ensureBotMenuEdit(bot);
    const checked = this.validateDslProgram(edit.program);
    if (!checked.ok) { edit.status = `Validation failed: ${checked.error}`; return checked; }
    const res = this.assignCustomDslProgram({ botId: bot.id, program: { ...edit.program, steps: checked.program.steps }, reason: 'Accepted DSL card flow from bot menu.' });
    this.botMenuEdit = { botId: bot.id, program: clone(res.program || checked.program), status: res.ok ? `Accepted card flow and refreshed Bot ${bot.id}.` : `Accept failed: ${res.error}` };
    return res;
  }

  bindBotProgramEditControls(el, bot, x, y) {
    el.querySelector('[data-save-json]')?.addEventListener('click', () => {
      const res = this.saveBotMenuJson(bot, el.querySelector('[data-bot-json-editor]')?.value || '{}');
      if (res.ok) this.showBotMenu(bot, x, y);
      else this.syncBotMenuEditSurface(el);
    });
    el.querySelector('[data-accept-dsl-cards]')?.addEventListener('click', () => {
      const res = this.acceptBotMenuDslCards(bot);
      if (res.ok) this.showBotMenu(bot, x, y);
      else this.syncBotMenuEditSurface(el);
    });
    el.querySelector('[data-add-loop-step]')?.addEventListener('click', () => { this.addBotMenuEditLoopStep(); this.syncBotMenuEditSurface(el); });
    el.addEventListener('click', event => {
      const location = event.target.closest('[data-bot-step-location]');
      if (location) {
        const index = Number(location.dataset.botStepLocation);
        if (Number.isFinite(index)) this.beginTeachLocationEdit(index, 'select_zone', 'bot-edit');
        return;
      }
      const button = event.target.closest('[data-bot-step-up], [data-bot-step-down], [data-bot-step-delete]');
      if (!button) return;
      const index = Number(button.dataset.botStepUp ?? button.dataset.botStepDown ?? button.dataset.botStepDelete);
      if (!Number.isFinite(index)) return;
      if ('botStepUp' in button.dataset) this.moveBotMenuEditStep(index, -1);
      else if ('botStepDown' in button.dataset) this.moveBotMenuEditStep(index, 1);
      else this.deleteBotMenuEditStep(index);
      this.syncBotMenuEditSurface(el);
    });
    el.addEventListener('change', event => {
      const op = event.target.closest('[data-bot-step-op]');
      const type = event.target.closest('[data-bot-step-type]');
      const name = event.target.closest('[data-bot-step-name]');
      const target = event.target.closest('[data-bot-step-target]');
      const packs = event.target.closest('[data-bot-step-packs]');
      const recipient = event.target.closest('[data-bot-step-recipient]');
      const message = event.target.closest('[data-bot-step-message]');
      const locationMenu = event.target.closest('select[data-bot-step-location-menu]');
      if (op) this.updateBotMenuEditStep(Number(op.dataset.botStepOp), { op: op.value });
      if (type) this.updateBotMenuEditStep(Number(type.dataset.botStepType), { type: type.value.trim() });
      if (name) this.updateBotMenuEditStep(Number(name.dataset.botStepName), { name: name.value.trim() });
      if (target) this.updateBotMenuEditStep(Number(target.dataset.botStepTarget), { target: target.value.trim() });
      if (packs) this.updateBotMenuEditStep(Number(packs.dataset.botStepPacks), { knowledgePacks: this.normalizeManagerKnowledgePacks(packs.value) });
      if (recipient) this.updateBotMenuEditStep(Number(recipient.dataset.botStepRecipient), { recipient: recipient.value.trim() });
      if (message) this.updateBotMenuEditStep(Number(message.dataset.botStepMessage), { message: this.sanitizeManagerMessage(message.value) });
      if (locationMenu) {
        const index = Number(locationMenu.dataset.botStepLocationMenu);
        const mode = locationMenu.value;
        locationMenu.value = '';
        if (Number.isFinite(index) && mode) this.beginTeachLocationEdit(index, mode, 'bot-edit');
      }
      if (op || type || name || target || packs || recipient || message || locationMenu) this.syncBotMenuEditSurface(el);
    });
    el.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-bot-step-index]');
      if (!card) return;
      this.draggedBotProgramStepIndex = Number(card.dataset.botStepIndex);
      event.dataTransfer?.setData('text/plain', String(this.draggedBotProgramStepIndex));
    });
    el.addEventListener('dragover', event => { if (event.target.closest('[data-bot-step-index]')) event.preventDefault(); });
    el.addEventListener('drop', event => {
      const card = event.target.closest('[data-bot-step-index]');
      const from = Number(event.dataTransfer?.getData('text/plain') || this.draggedBotProgramStepIndex);
      const to = Number(card?.dataset.botStepIndex);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from === to || !this.botMenuEdit) return;
      event.preventDefault();
      const steps = clone(this.botMenuEdit.program.steps || []);
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      this.setBotMenuEditSteps(steps);
      this.syncBotMenuEditSurface(el);
    });
  }

  renderManagerPackControls(bot) {
    const catalog = this.managerKnowledgePackCatalog || {};
    const selected = new Set(bot.managerKnowledgePacks?.length ? bot.managerKnowledgePacks : DEFAULT_MANAGER_KNOWLEDGE_PACKS);
    const ids = Object.keys(catalog).length ? Object.keys(catalog) : DEFAULT_MANAGER_KNOWLEDGE_PACKS;
    return ids.map(id => {
      const pack = catalog[id] || { id, name: id };
      return `<label class="manager-pack-option"><input type="checkbox" data-manager-pack="${escapeHtml(id)}"${selected.has(id) ? ' checked' : ''}> ${escapeHtml(pack.name || id)}</label>`;
    }).join('');
  }

  showBotMenu(bot, x, y, { refreshEdit = false } = {}) {
    if (this.isDogBot(bot)) {
      this.showDogPopup(bot, bot.inventory ? 'reward' : 'progress');
      return;
    }
    const el = this.dom.botMenu;
    const edit = this.ensureBotMenuEdit(bot, { refresh: refreshEdit });
    const tpl = JSON.stringify(edit.program, null, 2);
    const steps = this.activeTeachSteps();
    const teachSteps = this.renderTeachSteps(steps);
    const editSteps = this.renderBotProgramEditSteps(edit.program.steps || []);
    const recordLabel = this.recorder.recording ? 'Stop recording' : 'Start recording';
    const assignDisabled = (this.recordedLoop.length || this.recorder.steps.length) ? '' : ' disabled';
    const hasWorkflow = !!bot.program && bot.program !== 'idle';
    const stopLabel = bot.paused ? 'Resume workflow' : 'Stop workflow';
    const displayName = this.botDisplayName(bot);
    const statusLabel = this.isManagerBot(bot) ? 'manager' : ((this.isDogBot(bot) || bot.program === 'dog_fetch') ? 'dog' : (bot.status || 'worker'));
    const promoteButton = this.isManagerBot(bot) ? '' : '<button type="button" data-promote-manager>Promote to Manager</button>';
    const managerSection = this.isManagerBot(bot) ? `<section class="manager-menu" data-manager-section><b>Manager controls</b><p>Status: <code>manager</code> · Known packs: <span data-manager-pack-summary>${escapeHtml((bot.managerKnowledgePacks || []).join(', ') || 'none')}</span></p><div class="manager-pack-list">${this.renderManagerPackControls(bot)}</div><label class="manager-message-input">Message manager <textarea data-manager-message rows="3" placeholder="make bot 2 chop trees"></textarea></label><button type="button" data-send-manager-message>Send to Manager</button><p class="manager-message-status" data-manager-status></p></section>` : '';
    const dogPackSummary = `<span>${escapeHtml((bot.knowledgePacks || []).join(', ') || 'dog_fetch')}</span>`;
    const dogSection = (() => {
      if (!this.isDogBot(bot) && bot.program !== 'dog_fetch') return '';
      const fetchedType = bot.inventory?.type ? itemLabel(bot.inventory.type) : '';
      const praiseCount = bot.inventory?.type ? (bot.dogFetchMemory?.praiseCounts?.[bot.inventory.type] || 0) : 0;
      const dogControls = bot.inventory
        ? `<div class="dog-reward-buttons" data-dog-reward-buttons><button type="button" class="dog-reward-button is-yes" data-dog-praise aria-label="Praise dog and take item">&#10003;</button><button type="button" class="dog-reward-button is-no" data-dog-reject aria-label="Reject fetched item">&#10007;</button></div><p class="dog-reward-hint">Right now: ${escapeHtml(fetchedType)} · praises ${praiseCount}/${DOG_FETCH_PRAISE_TARGET}</p>`
        : `<label class="dog-fetch-input"><span>Fetch command</span><input data-dog-fetch-command placeholder="go fetch me a stick" value="${escapeHtml(edit.dogCommandDraft || '')}"></label><button type="button" data-dog-fetch-submit>Fetch</button><p class="dog-reward-hint">Dog pack: pick up + follow. Assigned pack: ${dogPackSummary}</p>`;
      return `<section class="dog-menu" data-dog-section><b>Dog fetch</b><p>Status: <code>dog</code> · Assigned pack: ${dogPackSummary}</p>${dogControls}</section>`;
    })();
    const nameStatus = edit.nameStatus ? `<p class="bot-menu-name-status" data-bot-name-status>${escapeHtml(edit.nameStatus)}</p>` : '';
    const nameEditor = edit.nameEditing ? `<label class="bot-menu-name-edit">Bot name <input data-menu-bot-name value="${escapeHtml(edit.nameDraft || displayName)}" maxlength="32"></label>` : '';
    const workflowButton = hasWorkflow ? `<button data-stop-workflow>${stopLabel}</button>` : '';
    el.innerHTML = `<div class="bot-menu-title"><div class="bot-menu-title-row"><b>${escapeHtml(displayName)}</b><button type="button" data-edit-bot-name aria-label="Edit bot name">Edit</button></div>${nameStatus}${nameEditor}</div><button data-close>×</button><p>${escapeHtml(bot.message)}</p><p><b>Status:</b> ${escapeHtml(statusLabel)}</p><p><b>Program:</b> ${escapeHtml(bot.program)}</p><p><b>Ref:</b> <code>${escapeHtml(bot.ref)}</code></p>${promoteButton}${managerSection}${dogSection}${workflowButton}<section class="teach-menu"><b>Teach by doing</b><p>${escapeHtml(this.recorder.recording ? `Recording ${this.recorder.steps.length} steps for Bot ${this.recorder.targetBotId || bot.id}…` : this.recorder.status)}</p><ol class="teach-steps menu-teach-steps">${teachSteps}</ol><button data-teach-record>${recordLabel}</button><button data-assign-taught${assignDisabled}>Assign to ${escapeHtml(displayName)}</button></section><section class="bot-program-editor"><b>Assigned JSON</b><p data-bot-edit-status>${escapeHtml(edit.status || 'Edit JSON, or adjust the DSL cards and accept them.')}</p><textarea data-bot-json-editor spellcheck="false">${escapeHtml(tpl)}</textarea><button type="button" data-save-json>Save JSON + refresh Bot ${bot.id}</button><div class="bot-card-flow-head"><b>DSL card flow</b><button type="button" data-add-loop-step>Add loop</button></div><ol class="teach-steps bot-program-steps" data-bot-program-steps>${editSteps}</ol><button type="button" data-accept-dsl-cards>Accept card flow + refresh Bot ${bot.id}</button></section><button data-add>Add bot to chat</button>`;
    this.placeMenu(el,x,y);
    this.bindTeachStepControls(el.querySelector('.menu-teach-steps'));
    this.bindBotProgramEditControls(el, bot, x, y);
    el.querySelector('[data-close]').onclick=()=>this.hideMenus();
    el.querySelector('[data-promote-manager]')?.addEventListener('click', event => {
      event.stopPropagation();
      this.promoteBotToManager(bot, bot.managerKnowledgePacks?.length ? bot.managerKnowledgePacks : (this.getDefaultManagerKnowledgePacks?.() || DEFAULT_MANAGER_KNOWLEDGE_PACKS));
      this.showBotMenu(bot, x, y, { refreshEdit: true });
    });
    el.querySelectorAll('[data-manager-pack]')?.forEach(input => input.addEventListener('change', () => {
      const ids = [...el.querySelectorAll('[data-manager-pack]:checked')].map(box => box.dataset.managerPack);
      this.setManagerKnowledgePacks(bot.id, ids);
      const summary = el.querySelector('[data-manager-pack-summary]');
      if (summary) summary.textContent = (bot.managerKnowledgePacks || []).join(', ') || 'none';
    }));
    el.querySelector('[data-send-manager-message]')?.addEventListener('click', () => {
      const text = el.querySelector('[data-manager-message]')?.value || '';
      const res = this.delegateMessageToManager(bot, bot.id, text, { throttleKey: `manual:${bot.id}:${this.sanitizeManagerMessage(text)}` });
      const status = el.querySelector('[data-manager-status]');
      if (status) status.textContent = res.ok ? `Sent to ${this.botDisplayName(bot)}.` : res.error;
    });
    el.querySelector('[data-dog-fetch-submit]')?.addEventListener('click', () => {
      const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
      const res = this.setDogFetchCommand(bot, text);
      if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
    });
    el.querySelector('[data-dog-fetch-command]')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const text = el.querySelector('[data-dog-fetch-command]')?.value || '';
        const res = this.setDogFetchCommand(bot, text);
        if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
      }
    });
    el.querySelector('[data-dog-praise]')?.addEventListener('click', () => {
      const res = this.praiseDogFetch(bot);
      if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
    });
    el.querySelector('[data-dog-reject]')?.addEventListener('click', () => {
      const res = this.rejectDogFetch(bot);
      if (res.ok) this.showBotMenu(bot, x, y, { refreshEdit: true });
    });
    el.querySelector('[data-edit-bot-name]')?.addEventListener('click', () => this.beginBotMenuNameEdit(bot, x, y));
    el.querySelector('[data-menu-bot-name]')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); this.saveBotMenuName(bot, x, y, el.querySelector('[data-menu-bot-name]')?.value || ''); } });
    el.querySelector('[data-add]').onclick=()=>{this.chat.insertAtCursor(`Bot ${bot.id} `);};
    el.querySelector('[data-stop-workflow]')?.addEventListener('click',()=>{ bot.paused = !bot.paused; bot.message = bot.paused ? `Paused ${bot.program} workflow.` : `Resumed ${bot.program} workflow.`; this.showBotMenu(bot, x, y); });
    el.querySelector('[data-teach-record]').onclick=()=>{ this.recorder.recording ? this.stopTeachRecording() : this.startTeachRecording(bot.id); this.showBotMenu(bot, x, y); };
    el.querySelector('[data-assign-taught]')?.addEventListener('click',()=>{ this.assignRecordedLoopToBot(bot.id); this.showBotMenu(bot, x, y, { refreshEdit: true }); });
    if (edit.nameEditing) requestAnimationFrame(() => {
      const input = el.querySelector('[data-menu-bot-name]');
      if (!input) return;
      input.focus();
      input.select();
    });
  }
  showStructureMenu(s, x, y) {
    const el = this.dom.structureMenu;
    const processing = s.processing ? `<br>processing ${escapeHtml(s.processing.label)} · ${Math.max(0, s.processing.remaining).toFixed(1)}s left` : '';
    const storage = (s.type === 'throne' ? `<br>owner ${s.ownerLabel || s.ownerId || 'none'} · HP ${Math.max(0, s.hp || 0)}/${s.maxHp || THRONE_HP}` : s.type === 'defensetower' ? `<br>range ${s.rangedAttack?.range || DEFENSE_TOWER_ATTACK.range} · damage ${s.rangedAttack?.damage || 1} · cooldown ${s.rangedAttack?.cooldown || 1}s${s.rangedAttack?.targetRef ? ` · target ${s.rangedAttack.targetRef}` : ''}` : STORAGE_STRUCTURE_TYPES.includes(s.type) ? `<br>locked type ${s.storageType || 'empty/unlocked'} · stored ${s.stored || 0}/${s.capacity || 0}` : s.type === 'workbench' ? `<br>sticks ${s.sticks||0} · stones ${s.stones||0} · output ${escapeHtml(itemLabel(workbenchRecipe(s)))} · made A${s.axes||0} P${s.pickaxes||0} S${s.shovels||0} H${s.hammers||0}` : s.type === 'smithery' ? `<br>sticks ${s.sticks||0} · planks ${s.planks||0} · mode ${escapeHtml(itemLabel(smitheryRecipe(s)))} · made swords ${s.swords||0} shields ${s.shields||0}` : s.type === 'bowmaker' ? `<br>sticks ${s.sticks||0}/2 · hemp ${s.hemps||0}/3 · made bows ${s.bows||0}` : s.type === 'arrowmaker' ? `<br>sticks ${s.sticks||0}/1 · stones ${s.stones||0}/1 · arrow packs ${s.arrow_packs||0}` : s.type === 'factory' ? `<br>logs ${s.logs||0} · planks ${s.planks||0} · poles ${s.poles||0} · seeds ${s.tree_seeds||0}` : s.type === 'assembler' ? `<br>planks ${s.planks||0}/2 · poles ${s.poles||0}/1 · output ${escapeHtml(itemLabel(assemblerRecipe(s)))}` : `<br>logs ${s.logs||0} · planks ${s.planks||0} · poles ${s.poles||0}`) + processing;
    const insertButton = STORAGE_STRUCTURE_TYPES.includes(s.type) ? '<button data-insert-nearby>Insert nearby item</button>' : '<button data-add-radius>Add small radius</button>';
    const demolishButton = this.canDemolishStructure(s) ? '<button data-demolish-structure>Demolish with hammer</button>' : '';
    const disassembleButton = this.canDisassembleStructure(s) ? '<button data-disassemble-structure>Disassemble into kit</button>' : '';
    const selectedRecipe = workbenchRecipe(s);
    const selector = s.type === 'workbench' ? `<section class="tool-selector" aria-label="Tool bench output"><b>Produce:</b> ${WORKBENCH_TOOL_RECIPES.map(type => `<button type="button" data-select-tool="${type}"${type === selectedRecipe ? ' aria-pressed="true" class="is-active"' : ' aria-pressed="false"'}>${escapeHtml(itemLabel(type))}</button>`).join('')}</section>` : s.type === 'smithery' ? `<section class="tool-selector" aria-label="Smithery production mode"><b>Production mode:</b> <button type="button" data-switch-smithery>${escapeHtml(itemLabel(smitheryRecipe(s)))} (switch)</button></section>` : s.type === 'assembler' ? `<section class="tool-selector" aria-label="Assembler building kit output"><b>Assemble:</b> ${BUILDING_KIT_ITEM_TYPES.map(type => `<button type="button" data-select-kit="${type}"${type === assemblerRecipe(s) ? ' aria-pressed="true" class="is-active"' : ' aria-pressed="false"'}>${escapeHtml(itemLabel(type))}</button>`).join('')}</section>` : '';
    const info = STRUCTURE_INFO[s.type] || 'Building.';
    const visibleType = BUILDING_TYPES[s.type]?.category || s.type;
    el.innerHTML = `<b>${escapeHtml(s.name)}</b><button data-close>×</button><p>${escapeHtml(s.label)} · type <code>${escapeHtml(visibleType)}</code> · ref <code>${escapeHtml(s.ref)}</code>${storage}<br><b>Info:</b> ${escapeHtml(info)}<br><b>Recipe:</b> ${escapeHtml(structureRecipeText(s))}</p>${selector}${demolishButton}${disassembleButton}<button data-add-name>Add name</button><button data-add-ref>Add ref</button>${insertButton}`;
    this.placeMenu(el,x,y);
    el.querySelector('[data-close]').onclick=()=>this.hideMenus();
    el.querySelectorAll('[data-select-tool]').forEach(btn => btn.addEventListener('click', () => {
      if (this.setWorkbenchRecipe(s, btn.dataset.selectTool)) this.showStructureMenu(s, x, y);
    }));
    el.querySelectorAll('[data-select-kit]').forEach(btn => btn.addEventListener('click', () => {
      if (this.setAssemblerRecipe(s, btn.dataset.selectKit)) this.showStructureMenu(s, x, y);
    }));
    el.querySelector('[data-switch-smithery]')?.addEventListener('click', () => {
      if (this.switchSmitheryRecipe(s)) this.showStructureMenu(s, x, y);
    });
    el.querySelector('[data-demolish-structure]')?.addEventListener('click', () => { this.queuePlayerDemolishStructure(s) || this.manualDemolishStructure(s); this.hideMenus(); });
    el.querySelector('[data-disassemble-structure]')?.addEventListener('click', () => { this.queuePlayerDisassembleStructure(s); this.hideMenus(); });
    el.querySelector('[data-add-name]').onclick=()=>{this.chat.insertAtCursor(s.name); this.hideMenus();};
    el.querySelector('[data-add-ref]').onclick=()=>{this.chat.insertAtCursor(s.ref); this.hideMenus();};
    el.querySelector('[data-add-radius]')?.addEventListener('click',()=>{this.chat.insertAtCursor(`small area around ${s.name}`); this.hideMenus();});
    el.querySelector('[data-insert-nearby]')?.addEventListener('click',()=>{this.acceptNearestItemForPalette(s); this.hideMenus();});
  }
  showBuildingKitItemMenu(item, x, y) {
    const el = this.dom.structureMenu;
    const kitType = this.normalizeBuildingKitItemType(item?.type);
    const buildingType = buildingTypeFromKitItem(kitType);
    const buildingLabel = BUILDING_TYPES[buildingType]?.label || buildingType || 'building';
    el.innerHTML = `<b>${escapeHtml(itemLabel(kitType || item?.type || 'kit'))}</b><button data-close>×</button><p>Building kit item · ref <code>${escapeHtml(item?.ref || '')}</code><br>Deploys into ${escapeHtml(buildingLabel)}.</p><button data-kit-pickup>Pick up kit</button><button data-kit-deploy>Deploy here</button>`;
    this.placeMenu(el, x, y);
    el.querySelector('[data-close]').onclick = () => this.hideMenus();
    el.querySelector('[data-kit-pickup]')?.addEventListener('click', () => { this.queuePlayerItemPickup(item); this.hideMenus(); });
    el.querySelector('[data-kit-deploy]')?.addEventListener('click', () => { this.queuePlayerDeployLooseKit(item); this.hideMenus(); });
  }
  showTreeMenu(tree, x, y) {
    const el = this.dom.structureMenu;
    const displayName = this.treeDisplayName(tree);
    const searchState = tree.searchReservedBy ? `reserved by ${tree.searchReservedBy}` : 'unreserved';
    const hpLine = tree.stump ? 'stump' : `HP ${Math.max(0, tree.hp || 0)}/${tree.maxHp || 1}`;
    el.innerHTML = `<b>${escapeHtml(displayName)}</b><button data-close>×</button><p>Resource type <code>tree</code> · ref <code>${escapeHtml(tree.ref || `tree:${tree.id}`)}</code><br>${escapeHtml(hpLine)} · stage ${escapeHtml(tree.growthStage || 'grown_tree')}<br>search ${escapeHtml(searchState)}</p><button data-add-tree-name>Add name</button><button data-add-tree-ref>Add ref</button><button data-add-tree-radius>Add small radius</button>`;
    this.placeMenu(el, x, y);
    el.querySelector('[data-close]').onclick = () => this.hideMenus();
    el.querySelector('[data-add-tree-name]')?.addEventListener('click', () => {
      this.chat.insertAtCursor(displayName);
      this.hideMenus();
    });
    el.querySelector('[data-add-tree-ref]')?.addEventListener('click', () => {
      this.chat.insertAtCursor(tree.ref || `tree:${tree.id}`);
      this.hideMenus();
    });
    el.querySelector('[data-add-tree-radius]')?.addEventListener('click', () => {
      this.chat.insertAtCursor(`small area around ${displayName}`);
      this.hideMenus();
    });
  }  showHoleMenu(hole, x, y) {
    const el = this.dom.structureMenu;
    const canPlant = this.player.inventory?.type === 'tree_seed' && !hole.planted;
    el.innerHTML = `<b>${escapeHtml(hole.planted ? 'planted hole' : 'dug hole')}</b><button data-close>×</button><p>Resource type <code>dug_hole</code> · ref <code>${escapeHtml(hole.ref || `hole:${hole.id}`)}</code><br>${hole.planted ? 'already planted' : 'open for tree seed'}${hole.reservedBy ? ` · reserved by ${escapeHtml(String(hole.reservedBy))}` : ''}</p>${canPlant ? '<button data-plant-seed>Plant tree seed</button>' : ''}<button data-add-hole-name>Add name</button><button data-add-hole-ref>Add ref</button><button data-add-hole-radius>Add small radius</button>`;
    this.placeMenu(el, x, y);
    el.querySelector('[data-close]').onclick = () => this.hideMenus();
    el.querySelector('[data-plant-seed]')?.addEventListener('click', () => {
      this.queuePlayerPlantSeedAtHole(hole);
      this.hideMenus();
    });
    el.querySelector('[data-add-hole-name]')?.addEventListener('click', () => {
      this.chat.insertAtCursor(hole.planted ? 'planted hole' : 'dug hole');
      this.hideMenus();
    });
    el.querySelector('[data-add-hole-ref]')?.addEventListener('click', () => {
      this.chat.insertAtCursor(hole.ref || `hole:${hole.id}`);
      this.hideMenus();
    });
    el.querySelector('[data-add-hole-radius]')?.addEventListener('click', () => {
      this.chat.insertAtCursor(`small area around ${hole.ref || `hole:${hole.id}`}`);
      this.hideMenus();
    });
  }
  syncZonesUi() {
    const list = this.dom.zoneList;
    if (!list) return;
    if (!this.zones.length) { list.innerHTML = '<p class="empty">No zones yet.</p>'; return; }
    list.innerHTML = this.zones.map(z => `<div class="zone-card${z.hidden ? ' is-hidden' : ''}" data-zone-id="${escapeHtml(z.id)}"><div><b>${escapeHtml(z.name)}</b><p>${escapeHtml(z.id)} · ${escapeHtml(z.kind === 'radius' ? `radius ${Math.round(z.radius || DEFAULT_RESOURCE_RADIUS)}px` : `${Math.round(z.w || 0)}×${Math.round(z.h || 0)}`)}${z.hidden ? ' · hidden' : ''}</p></div><div class="zone-card-actions"><button type="button" data-rename-zone="${escapeHtml(z.id)}">Rename</button><button type="button" data-toggle-zone-hidden="${escapeHtml(z.id)}">${z.hidden ? 'Show' : 'Hide'}</button><button type="button" data-add-zone-name="${escapeHtml(z.id)}">Add name</button></div></div>`).join('');
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
    { const p = this.zoneAnchorPoint(z); this.addFloat(`Renamed ${z.id} to ${z.name}`, p.x, p.y - 8, '#d3a95f'); }
    return true;
  }
  setZoneHidden(z, hidden) {
    if (!z) return false;
    z.hidden = Boolean(hidden);
    if (z.hidden && this.mouse.hoverZone === z) this.mouse.hoverZone = null;
    this.syncZonesUi();
    { const p = this.zoneAnchorPoint(z); this.addFloat(`${z.hidden ? 'Hid' : 'Showed'} ${z.name}`, p.x, p.y - 8, z.hidden ? '#c7b683' : '#9abf8f'); }
    return true;
  }
  showZoneMenu(z, x, y) {
    const el = this.dom.structureMenu;
    const text = this.zoneText(z);
    const size = z.kind === 'radius' ? `radius ${Math.round(z.radius || DEFAULT_RESOURCE_RADIUS)} px` : `${Math.round(z.w || 0)}×${Math.round(z.h || 0)} px`;
    el.innerHTML = `<b>${escapeHtml(z.name)}</b><button data-close>×</button><p>Zone ref <code>${escapeHtml(z.id)}</code><br>${escapeHtml(size)}<br><code>${escapeHtml(text)}</code></p><button data-add-rect>Add zone coords</button><button data-add-name>Add zone name</button><button data-add-ref>Add zone ref</button><button data-rename-zone>Rename</button><button data-hide-zone>Hide zone</button>`;
    this.placeMenu(el,x,y);
    el.querySelector('[data-close]').onclick=()=>this.hideMenus();
    el.querySelector('[data-add-rect]').onclick=()=>{this.chat.insertAtCursor(text); this.hideMenus();};
    el.querySelector('[data-add-name]').onclick=()=>{this.chat.insertAtCursor(z.name); this.hideMenus();};
    el.querySelector('[data-add-ref]').onclick=()=>{this.chat.insertAtCursor(z.id); this.hideMenus();};
    el.querySelector('[data-rename-zone]').onclick=()=>{this.promptRenameZone(z); this.showZoneMenu(z, x, y);};
    el.querySelector('[data-hide-zone]').onclick=()=>{this.setZoneHidden(z, true); this.hideMenus();};
  }
  hideMenus(){ this.dom.botMenu.hidden=true; this.dom.structureMenu.hidden=true; this.closeDogPopup(); }

  syncBuildUi() { if (!this.dom.buildStatus) return; this.dom.buildStatus.textContent = this.placementType ? `Click map to place ${BUILDING_TYPES[this.placementType].label}.` : 'Choose a building, then click the map.'; for (const b of this.dom.buildPanel.querySelectorAll('[data-build]')) b.classList.toggle('is-active', b.dataset.build === this.placementType); }
  updateUI(dt) { this.dom.sawLogs.textContent = this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.logs,0); this.dom.sawPlanks.textContent = this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.planks,0); if (this.dom.sawPoles) this.dom.sawPoles.textContent = this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+(s.poles||0),0); this.dom.factoryPlanks.textContent = this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+s.planks,0); if (this.dom.factoryRecipe) this.dom.factoryRecipe.textContent = this.structures.filter(s=>s.type==='factory').map(s=>`L${s.logs||0} P${s.planks||0} Po${s.poles||0} S${s.tree_seeds||0}`).join(' · '); this.dom.looseLogs.textContent = this.countItems('log'); this.dom.loosePlanks.textContent = this.countItems('plank'); if (this.dom.looseBase) this.dom.looseBase.textContent = `sticks ${this.countItems('stick')} · stones ${this.countItems('stone')} · seeds ${this.countItems('tree_seed')} · poles ${this.countItems('pole')} · axes ${this.countItems('crude_axe')} · pickaxes ${this.countItems('crude_pickaxe')} · shovels ${this.countItems('crude_shovel')} · hammers ${this.countItems('crude_hammer')} · swords ${this.countItems('wooden_sword')} · shields ${this.countItems('wooden_shield')}`; if (this.dom.paletteItems) this.dom.paletteItems.textContent = this.structures.filter(s=>s.type==='item_palette').reduce((n,s)=>n+(s.stored||0),0); this.dom.statline.innerHTML = `<span>FPS <b>${this.fps} / ${this.targetFps}</b></span><span>Bots <b>${this.bots.length} / ${this.maxBots}</b></span><span>Buildings <b>${this.structures.length}</b></span><span>Zones <b>${this.zones.length}</b></span>`; this.dom.rendererStatus.textContent = `Renderer: ${this.renderer.text}`; this.syncDogPopupUi(); this.lastBotListUpdate += dt; if (this.lastBotListUpdate > .35) { this.lastBotListUpdate=0; this.syncBotDrawerUi(); } }

  getRenderState() { return createRenderState(this); }
  draw() { this.renderBackend?.draw?.(this.getRenderState()); }

  getHoverState(){ const item = this.mouse.hoverItem; const tree = this.mouse.hoverTree; const hole = this.mouse.hoverHole; return { item: item ? { id: item.id, ref: item.ref, type: item.type, name: itemLabel(item.type), x: Math.round(item.x), y: Math.round(item.y) } : null, tree: tree ? { id: tree.id, ref: tree.ref, name: this.treeDisplayName(tree), x: Math.round(tree.x), y: Math.round(tree.y), hp: tree.hp, maxHp: tree.maxHp, growthStage: tree.growthStage || 'grown_tree', stump: !!tree.stump } : null, hole: hole ? { id: hole.id, ref: hole.ref, name: hole.planted ? 'planted hole' : 'dug hole', x: Math.round(hole.x), y: Math.round(hole.y), planted: !!hole.planted, reservedBy: hole.reservedBy || null } : null, cursor: this.canvas.style.cursor }; }

  getObjectRegistry(){ return [
    ...this.zones.map(z=>({ id:z.id, name:z.name, kind:'zone', zoneKind:z.kind, rect:z.kind==='rect'?{x:Math.round(z.x),y:Math.round(z.y),w:Math.round(z.w),h:Math.round(z.h)}:undefined, builtIn:!!z.builtIn, hidden:!!z.hidden })),
    ...this.structures.map(s=>({ id:s.ref, numericId:s.id, kind:'structure', type:s.type, name:s.name, x:Math.round(s.x), y:Math.round(s.y), logs:s.logs||0, planks:s.planks||0, poles:s.poles||0, sticks:s.sticks||0, stones:s.stones||0, tree_seeds:s.tree_seeds||0, axes:s.axes||0, pickaxes:s.pickaxes||0, shovels:s.shovels||0, hammers:s.hammers||0, swords:s.swords||0, shields:s.shields||0, hemps:s.hemps||0, bows:s.bows||0, arrow_packs:s.arrow_packs||0, workbenchRecipe:s.workbenchRecipe||null, smitheryRecipe:s.smitheryRecipe||null, rangedAttack:s.rangedAttack?{...s.rangedAttack}:null, storageType:s.storageType||null, stored:s.stored||0, capacity:s.capacity||0, processing:s.processing?{...s.processing}:null })),
    ...this.items.map(i=>({ id:i.ref, numericId:i.id, kind:'item', type:i.type, name:itemLabel(i.type), x:Math.round(i.x), y:Math.round(i.y), reservedBy:i.reservedBy||null })),
    ...this.holes.map(h=>({ id:h.ref, numericId:h.id, kind:'hole', type:'dug_hole', name:h.planted ? 'planted hole' : 'dug hole', x:Math.round(h.x), y:Math.round(h.y), radius:h.radius||HOLE_VISUAL_RADIUS, blockRadius:h.blockRadius||HOLE_BLOCK_RADIUS, planted:!!h.planted, reservedBy:h.reservedBy||null, treeId:h.treeId||null })),
    ...this.hempPlants.map(h=>({ id:h.ref||`hemp:${h.id}`, numericId:h.id||null, kind:'resource', type:'hemp_plant', name:h.searched ? 'searched hemp' : 'hemp plant', x:Math.round(h.x), y:Math.round(h.y), radius:h.radius, searched:!!h.searched, harvested:!!h.harvested, searchReservedBy:h.searchReservedBy||null })),
    ...this.trees.map(t=>({ id:t.ref||`tree:${t.id}`, numericId:t.id||null, kind:'resource', type:'tree', name:t.stump ? 'tree stump' : (t.growthStage === 'sapling' ? 'small sapling' : t.growthStage === 'small_tree' ? 'small tree' : 'grown tree'), x:Math.round(t.x), y:Math.round(t.y), hp:t.hp, maxHp:t.maxHp, radius:t.radius, stump:!!t.stump, planted:!!t.planted, growthStage:t.growthStage||'grown_tree', growTimer:Math.max(0, Math.round((t.growTimer||0)*10)/10), searchReservedBy:t.searchReservedBy||null })),
    ...this.projectiles.map(p=>({ id:p.ref, numericId:p.id, kind:'projectile', type:p.type, sourceStructureId:p.sourceStructureId, targetRef:p.targetRef, x:Math.round(p.x), y:Math.round(p.y), damage:p.damage })),
    ...this.monsters.map(m=>({ id:m.ref||`monster:${m.id}`, numericId:m.id||null, kind:'monster', type:m.type||'passive_monster', name:m.name||'passive monster', x:Math.round(m.x), y:Math.round(m.y), hp:m.hp, maxHp:m.maxHp, radius:m.radius, passive:!!m.passive, spawnedAtNight:!!m.spawnedAtNight, avoidRadius:m.avoidRadius, roamRadius:m.roamRadius })),
    ...this.rocks.map(r=>({ id:r.ref, numericId:r.id, kind:'resource', type:'stone_deposit', name:'stone deposit', x:Math.round(r.x), y:Math.round(r.y), hp:r.hp, maxHp:r.maxHp, depleted:!!r.depleted })),
    ...this.bots.map(b=>({ id:b.ref, numericId:b.id, kind:b.kind || 'bot', name:this.botDisplayName(b), status:b.status||'worker', managerKnowledgePacks:b.managerKnowledgePacks||[], knowledgePacks:b.knowledgePacks||b.managerKnowledgePacks||[], dogFetchMemory:b.dogFetchMemory ? clone(b.dogFetchMemory) : null, dogFetchState:b.dogFetchState ? clone(b.dogFetchState) : null, x:Math.round(b.x), y:Math.round(b.y), hp:b.hp, maxHp:b.maxHp, hostile:!!b.hostile, equipment:this.equipmentSummary(b), program:b.program, teamId:b.teamId||null, teamName:this.botTeam(b)?.name||null }))
  ]; }
  getState(){ return { gameMode:this.gameMode||this.multiplayer?.mapMode||'test', map:{...this.map}, mapFeatures:clone(this.mapFeatures || []), campaignArrival:clone(this.campaignArrival || null), paused:!!this.paused, fps:Math.round(this.fps||0), targetFps:this.targetFps, dynamicShadowsEnabled:!!this.dynamicShadowsEnabled, lightingEffectsEnabled:this.lightingEffectsEnabled!==false, showFpsOverlay:this.showFpsOverlay!==false, dayNight:this.getDayNightState(), fogOfWar:getFogStats(this.fogOfWar), nightSpawns:clone(this.nightSpawns||{}), multiplayer:this.getMultiplayerSnapshot(), player:{x:Math.round(this.player.x),y:Math.round(this.player.y),hp:this.player.hp,maxHp:this.player.maxHp,dead:!!this.player.dead,inventory:this.player.inventory,equipment:this.equipmentSummary(this.player),ammunition:Number(this.player.ammunition||0),facingX:this.player.facingX||1,facingY:this.player.facingY||0,target:this.player.target?{...this.player.target,x:Math.round(this.player.target.x),y:Math.round(this.player.target.y)}:null,targetQueue:(this.player.targetQueue||[]).map(target=>({...target,x:Math.round(target.x),y:Math.round(target.y)}))}, assistant:{x:Math.round(this.assistant.x),y:Math.round(this.assistant.y),facingX:this.assistant.facingX||1,facingY:this.assistant.facingY||0}, recorder:this.getRecorderState(), customTemplates:clone(this.customTemplates || []), bots:this.bots.map(b=>({id:b.id,ref:b.ref,name:this.botDisplayName(b),kind:b.kind||'bot',status:b.status||'worker',managerKnowledgePacks:b.managerKnowledgePacks||[],knowledgePacks:b.knowledgePacks||b.managerKnowledgePacks||[],dogFetchMemory:b.dogFetchMemory?clone(b.dogFetchMemory):null,dogFetchState:b.dogFetchState?clone(b.dogFetchState):null,teamId:b.teamId||null,teamName:this.botTeam(b)?.name||null,teamColor:this.botTeam(b)?.color||null,x:Math.round(b.x),y:Math.round(b.y),program:b.program,customTemplateName:b.customTemplateName||'',paused:!!b.paused,message:b.message,inventory:b.inventory,equipment:this.equipmentSummary(b),ammunition:Number(b.ammunition||0),tool:b.tool,hp:b.hp,maxHp:b.maxHp,hostile:!!b.hostile,taughtLoop:b.taughtLoop?clone(b.taughtLoop):null,targetStructureId:b.targetStructureId,sourceStructureId:b.sourceStructureId,sourcePaletteId:b.sourcePaletteId,pickupItemType:b.pickupItemType,targetFactoryId:b.targetFactoryId,targetWorkbenchId:b.targetWorkbenchId,zoneId:b.zoneId,zone:this.getBotZone(b)?this.zoneLabel(this.getBotZone(b)):null})), structures:this.structures.map(s=>({id:s.id,ref:s.ref,name:s.name,label:s.label,type:s.type,logs:s.logs,planks:s.planks,poles:s.poles,sticks:s.sticks,stones:s.stones,tree_seeds:s.tree_seeds,axes:s.axes,pickaxes:s.pickaxes||0,shovels:s.shovels||0,hammers:s.hammers||0,swords:s.swords||0,shields:s.shields||0,hemps:s.hemps||0,bows:s.bows||0,arrow_packs:s.arrow_packs||0,workbenchRecipe:s.workbenchRecipe||null,smitheryRecipe:s.smitheryRecipe||null,rangedAttack:s.rangedAttack?{...s.rangedAttack}:null,storageType:s.storageType||null,stored:s.stored||0,capacity:s.capacity||0,processing:s.processing?{...s.processing}:null,x:Math.round(s.x),y:Math.round(s.y)})), projectiles:this.projectiles.map(p=>({...p,x:Math.round(p.x),y:Math.round(p.y)})), zones:this.zones.map(z=>({...z,x:Math.round(z.x),y:Math.round(z.y),w:z.kind==='rect'?Math.round(z.w):undefined,h:z.kind==='rect'?Math.round(z.h):undefined,radius:z.kind==='radius'?Math.round(z.radius||DEFAULT_RESOURCE_RADIUS):undefined})), hempPlants:this.hempPlants.map(h=>({...h,x:Math.round(h.x),y:Math.round(h.y)})), monsters:this.monsters.map(m=>({...m,x:Math.round(m.x),y:Math.round(m.y),wanderTarget:m.wanderTarget?{x:Math.round(m.wanderTarget.x),y:Math.round(m.wanderTarget.y)}:null})), holes:this.holes.map(h=>({...h,x:Math.round(h.x),y:Math.round(h.y)})), botTeams:clone(this.botTeams), objectRegistry:this.getObjectRegistry(), stores:{sawbenchLogs:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.logs,0),sawbenchPlanks:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.planks,0),sawbenchPoles:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+(s.poles||0),0),factoryLogs:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.logs||0),0),factoryPlanks:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+s.planks,0),factoryPoles:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.poles||0),0),factorySeeds:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.tree_seeds||0),0),looseLogs:this.countItems('log'),loosePlanks:this.countItems('plank'),loosePoles:this.countItems('pole'),looseSticks:this.countItems('stick'),looseStones:this.countItems('stone'),looseTreeSeeds:this.countItems('tree_seed'),looseAxes:this.countItems('crude_axe'),loosePickaxes:this.countItems('crude_pickaxe'),looseShovels:this.countItems('crude_shovel'),dugHoles:this.holes.length,stoneDeposits:this.rocks.filter(r=>!r.depleted).length,paletteItems:this.structures.filter(s=>s.type==='item_palette').reduce((n,s)=>n+(s.stored||0),0)}, hover:{bot:this.mouse.hoverBot?.id||null,structure:this.mouse.hoverStructure?.name||null,tree:this.mouse.hoverTree?.ref||null,hole:this.mouse.hoverHole?.ref||null,zone:this.mouse.hoverZone?.name||null}, placementType:this.placementType, zoneDrawing:!!this.zoneDraft?.active, renderer:this.renderer.text, rendererBackend:this.renderer.backend || this.renderBackend?.kind || null, webgpuAvailable:this.renderer.webgpu, maxBots:this.maxBots, dslTemplates:PROGRAM_TEMPLATES, asr:this.chat.asr ? {endpoint:this.chat.wsUrl(),recording:this.chat.asr.recording,segment:this.chat.asr.segment}:null }; }
}

installProductionSystem(Game, {
  ASSEMBLER_KIT_RECIPE,
  BOW_RECIPE,
  BUILDING_KIT_ITEM_TYPES,
  BUILDING_TYPES,
  DEFAULT_ASSEMBLER_RECIPE,
  FACTORY_BOT_RECIPE,
  itemLabel,
  rand
});

installTaughtLoopSystem(Game, {
  BUILDING_DISASSEMBLE_SECONDS,
  BUILDING_KIT_DEPLOY_SECONDS,
  DEFAULT_FOLLOW_DISTANCE,
  HEMP_CHOP_SECONDS,
  HEMP_SEARCH_SECONDS,
  RESOURCE_HIT_SECONDS,
  TREE_SEARCH_SECONDS,
  clamp,
  itemLabel,
  nearest
});

installInventorySystem(Game, {
  BOT_STORAGE_RETRY_SECONDS,
  EQUIPMENT_SHIELDS,
  EQUIPMENT_WEAPONS,
  MAX_WEAPON_SETS,
  STORAGE_STRUCTURE_TYPES,
  clone,
  createCarriedTool,
  ensureEquipment,
  itemLabel,
  productionInputCount,
  productionInputNeeds,
  syncActiveEquipmentSet
});

installCombatSystem(Game);

installCameraSystem(Game, {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_EDGE_VIEWPORT_PADDING_RATIO,
  CAMERA_WHEEL_SENSITIVITY
});

installPlayerSystem(Game, {
  itemLabel,
  STORAGE_STRUCTURE_TYPES,
  TREE_SEARCH_SECONDS,
  HEMP_SEARCH_SECONDS,
  HEMP_CHOP_SECONDS,
  RESOURCE_HIT_SECONDS,
  BUILDING_KIT_DEPLOY_SECONDS,
  BUILDING_DISASSEMBLE_SECONDS,
  isBuildingKitItemType,
  buildingTypeFromKitItem
});

installMonsterSystem(Game, {
  NIGHT_MONSTER_CONFIG,
  MONSTER_AVOID_STRUCTURE_RADIUS,
  MONSTER_ROAM_RADIUS
});

installStructureSystem(Game, {
  BUILDING_TYPES,
  DEFAULT_WORKBENCH_RECIPE,
  DEFAULT_SMITHERY_RECIPE,
  DEFAULT_ASSEMBLER_RECIPE,
  THRONE_HP,
  MIN_DRAWN_ZONE_SIZE,
  DEFAULT_RESOURCE_RADIUS,
  DEFAULT_NEARBY_RADIUS,
  MAX_NEARBY_RADIUS,
  DIG_ZONE_RADIUS,
  buildingKitItemTypeFor,
  buildingTypeFromKitItem,
  createRangedAttackComponent,
  clone,
  itemLabel
});

installBotSystem(Game, {
  DEFAULT_MANAGER_KNOWLEDGE_PACKS,
  createEquipment,
  clone,
  itemLabel
});

installTeachSystem(Game, {
  ALLOWED_OPS,
  DEFAULT_RESOURCE_RADIUS,
  DIG_ZONE_RADIUS,
  clone,
  itemLabel
});

installSpawnSystem(Game, {
  HOLE_VISUAL_RADIUS,
  HOLE_BLOCK_RADIUS,
  TREE_GROWTH,
  BUILDING_TYPES,
  MONSTER_AVOID_STRUCTURE_RADIUS,
  MONSTER_ROAM_RADIUS,
  MONSTER_MELEE_ATTACK,
  createAutoAttackComponent
});

installInteractionSystem(Game, {
  CAMERA_WHEEL_SENSITIVITY,
  STORAGE_STRUCTURE_TYPES,
  isBuildingKitItemType,
  itemLabel,
  BUILDING_TYPES
});

installHealthSystem(Game, {
  PLAYER_MAX_HP,
  PLAYER_REGEN_DELAY_MS,
  PLAYER_REGEN_INTERVAL_MS,
  PLAYER_REGEN_AMOUNT,
  CAMPAIGN_START,
  MONSTER_MELEE_ATTACK
});






