import { BUILDING_TYPES, PROGRAMS, PROGRAM_TEMPLATES, ALLOWED_OPS, DEFAULT_WORLD_ZONES } from './data.js';
import { CAMPAIGN_MAP_FEATURES, CAMPAIGN_MAP_SIZE, CAMPAIGN_START, CAMPAIGN_DIALOGUES, getCampaignArrivalScene } from './campaign-scenes.js';
import { createCanvas2dRenderer } from './renderers/canvas2d-renderer.js';
import { createRenderState } from './renderers/shared/render-state.js';
import { installCombatSystem, IDLE_BOT_AUTO_ATTACK_RANGE, PLAYER_AUTO_ENGAGE_RANGE, DEFAULT_BOT_COMBAT_MODE } from './systems/combat/combat-system.js';
import { BOW_ATTACK, DEFENSE_TOWER_ATTACK, MELEE_AUTO_ATTACK, MONSTER_MELEE_ATTACK } from './systems/combat/combat-config.js';
import { installTaughtLoopSystem } from './systems/dsl/taught-loop-system.js';
import { installCodeLoopSystem } from './systems/code-loop/code-loop-system.js';
import { installInventorySystem } from './systems/inventory/inventory-system.js';
import { assemblerRecipe as getAssemblerRecipe, DEFAULT_SMITHERY_RECIPE, DEFAULT_WORKBENCH_RECIPE, installProductionSystem, productionInputCount, productionInputNeeds as getProductionInputNeeds, SMITHERY_RECIPES, smitheryInputFor, smitheryRecipe, WORKBENCH_TOOL_RECIPES, workbenchRecipe } from './systems/production/production-system.js';
import { FOG_CELL_SIZE, createFogOfWar, fogRevealSources as createFogRevealSources, getFogStats, isLightEmittingStructure as isFogLightEmittingStructure, normalizeFogOfWar, revealFogCircle, serializeFogOfWar, structureLightRadius as fogStructureLightRadius, updateFogOfWarState } from './renderers/shared/fog-of-war.js';
import { clamp, rand, distXY, nearest, pointInRect, rectDistance, canvasPoint, escapeHtml } from './utils.js';
import { installCameraSystem } from './systems/camera-system.js';
import { installPlayerSystem } from './systems/player-system.js';
import { installMonsterSystem } from './systems/monster-system.js';
import { installStructureSystem } from './systems/structure-system.js';
import { installBotSystem } from './systems/bot-system.js';
import { installTeachSystem } from './systems/teach-system.js';
import { installSpawnSystem } from './systems/spawn-system.js';
import { installInteractionSystem } from './systems/interaction-system.js';
import { installHealthSystem } from './systems/health-system.js';
import { installDialogueSystem } from './systems/dialogue-system.js';
import { installDogSystem } from './systems/dog-system.js';
import { installMenuSystem } from './systems/menu-system.js';
import { installMultiplayerSystem } from './systems/multiplayer-system.js';
import { installDslProgramSystem } from './systems/dsl-program-system.js';
import { installSaveSystem } from './systems/save-system.js';
import { installCampaignArrivalSystem } from './campaign/campaign-arrival.js';
import { installCampaignQuestSystem } from './campaign/campaign-quest.js';

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
const MINE_STONE_HAND_SECONDS = 30;
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
    this.maxBots = 24; this.targetFps = 60; this.dynamicShadowsEnabled = false; this.lightingEffectsEnabled = true; this.showFpsOverlay = true; this.fps = 0; this.frameCount = 0; this.fpsAcc = 0; this.lastFrame = 0; this.worldTime = 0; this._lastFogSignature = '';
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
    this.addStructure('sawbench', 320, 330); this.addStructure('workbench', 455, 330); this.addStructure('smithery', 525, 245); this.addStructure('bowmaker', 665, 245); this.addStructure('defensetower', 795, 330); this.addStructure('factory', 595, 330); this.addStructure('assembler', 705, 410);
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
    // Campaign quest 4: bot taught via template
    this.onBotProgramAssigned?.(bot);
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


  moveToward(entity, tx, ty, dt, speed = entity.speed || 100, close = 14) { const d = distXY(entity.x, entity.y, tx, ty); if (d <= close) return true; const dx = (tx - entity.x) / d, dy = (ty - entity.y) / d; entity.facingX = dx; entity.facingY = dy; entity.x += dx * speed * dt; entity.y += dy * speed * dt; return false; }
  releaseReservation(bot) { for (const i of this.items) if (i.reservedBy === bot.id) i.reservedBy = null; for (const h of this.holes) if (h.reservedBy === bot.id) h.reservedBy = null; for (const t of this.trees) if (t.searchReservedBy === bot.id) t.searchReservedBy = null; bot.targetItemId = null; bot.targetItemPurpose = null; bot.targetHoleId = null; }

  treeSearchAvailable(tree, actorId) { return !!tree && !tree.stump && (!tree.searchReservedBy || tree.searchReservedBy === actorId); }
  hempSearchAvailable(hemp, actorId) { return !!hemp && !hemp.harvested && (!hemp.searchReservedBy || hemp.searchReservedBy === actorId); }

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
    // Natural resources stay (trees, hemp, stone) — part of the landscape.
    // All buildings and loose items removed: Paul arrives with only the camper van.
    // The van is now an interactable "unpack" progression gate (see unpackVan / campaignQuest).
    // Bots come from the van at quest 3, not from the start. Keep the starter dog.
    this.spawnStarterDog(CAMPAIGN_START.x + 28, CAMPAIGN_START.y + 70);

    // === Quest state machine ===
    this.campaignQuest = {
      active: true,
      currentQuest: 1,
      vanUnpackCount: 0,
      treesChopped: 0,
      logsStored: 0,
      holesDug: 0,
      seedsPlanted: 0,
      completedQuests: [],
      // Chapter I tracking
      quest2AxePickedUp: false,
      quest2TreeChopped: false,
      quest2AxeDropped: false,
      quest4BotTaught: false,
      quest5StoragePlaced: false,
      quest8ShovelPickedUp: false,
      // Chapter II tracking (Q10-Q15)
      planksProduced: 0,
      polesProduced: 0,
      craftedPickaxe: false,
      stoneMined: 0,
      botSawbenchLoop: false,
      // Chapter III tracking (Q16-Q19)
      botHasWoodworking: false,
      managerDelegationActive: false,
      managerExists: false,
      botsAssembled: 0,
      // Chapter IV tracking (Q20-Q25)
      playerEquippedSwordShield: false,
      nightsSurvived: 0,
      combatBotAggressive: false,
      combatBots: 0,
      playerEquippedBow: false,
      // Chapter V tracking (Q26-Q29)
      botHasPatrolLoop: false,
      botOnGuardDuty: false,
    };

    this.clampCamera();
    this.syncBuildUi(); this.syncTeachUi?.(); this.syncZonesUi?.(); this.syncTemplateDrawerUi?.(); this.syncBotDrawerUi?.(); this.updateHover();
    return this.exportSave();
  }


  update(dt) {
    if (this.paused) { this.updateCampaignArrivalState(); this.updateFogOfWar(); this.updateUI(dt); this.updateDialogue(); return; }
    this.worldTime = (this.worldTime || 0) + dt;
    this.updateFogOfWar();
    this.updatePlayerHealth(dt);
    this.updatePlayer(dt); this.updateProductionStructures(dt); this.updateRangedAttackStructures(dt); this.updateProjectiles(dt); this.updateAssistant(dt); for (const bot of this.bots) this.updateBot(bot, dt);
    this.advanceCodeLoopSessions(dt);
    this.updateAiWaves(dt);
    this.updateNightMonsterSpawns(dt);
    for (const monster of this.monsters) this.updateMonster(monster, dt);
    this.updateMultiplayer(dt);
    for (const t of this.trees) this.updateTreeGrowth(t, dt);
    for (const r of this.rocks) if (r.depleted) { r.respawn -= dt; if (r.respawn <= 0) Object.assign(r, { depleted: false, hp: r.maxHp }); }
    for (const f of this.floaters) { f.y -= 18 * dt; f.life -= dt; } this.floaters = this.floaters.filter(f => f.life > 0);
    this.updateUI(dt);
    this.updateDialogue();
  }
  updatePlayer(dt) {
    if (this.player.dead) { this.updateCamera(dt); return; }
    this.updateCamera(dt);
    const eq = ensureEquipment(this.player);
    eq.rangedAttack.cooldownRemaining = Math.max(0, (eq.rangedAttack.cooldownRemaining || 0) - dt);
    this.player.attackCooldown = Math.max(0, (this.player.attackCooldown || 0) - dt);
    // ── Player combat overlay (Patrick: auto-attack nearby enemies ALWAYS) ──
    // Runs every tick BEFORE movement/target logic. The player auto-attacks any
    // hostile within PLAYER_AUTO_ENGAGE_RANGE, even while moving or working.
    // When actively attacking (enemy in melee range), the player's movement/work
    // is paused this tick; when the enemy dies or flees, normal activity resumes.
    const playerEngaged = this.updateActorAutoAttack(this.player, dt, { searchRange: PLAYER_AUTO_ENGAGE_RANGE });
    if (playerEngaged) {
      // Check if we're in melee range (actually hitting) vs just chasing.
      // If chasing (out of melee range but within search), allow movement toward
      // the enemy but skip the normal target/work processing.
      const playerTarget = this.findTargetByRef(this.player.autoAttack?.targetRef);
      const inMeleeRange = playerTarget && this.targetDistance(this.player, playerTarget) <= (this.player.autoAttack?.range || 52);
      if (inMeleeRange) return; // hitting — pause everything else
      // Otherwise the auto-attack moveToward handles chasing; skip normal target this tick.
      return;
    }
    const target = this.player.target;
    if (!target) {
      if (this.advancePlayerTargetQueue()) return;
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
      if (target.action === 'search_hemp' && (!hemp || this.player.inventory)) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
      if (target.action === 'chop_hemp' && (!hemp || this.player.inventory?.type !== 'crude_axe')) { this.releasePlayerTargetReservation(); this.advancePlayerTargetQueue(); return; }
      if (target.action === 'chop_tree' && !this.canFinishPlayerChopTree(target)) { this.advancePlayerTargetQueue(); return; }
      if (target.action === 'mine_stone' && !this.canFinishPlayerMineStone(target)) { this.advancePlayerTargetQueue(); return; }
      target.remaining = Math.max(0, (target.remaining ?? target.total ?? TREE_SEARCH_SECONDS) - dt);
      if (target.remaining <= 0) {
        this.releasePlayerTargetReservation();
        this.player.target = null;
        if (target.action === 'search_tree') this.finishTreeSearch(tree, { recordTeach: !target.repeat });
        if (target.action === 'search_hemp') this.finishHempSearch(hemp);
        if (target.action === 'chop_hemp') this.finishHempChop(hemp);
        if (target.action === 'chop_tree') this.finishPlayerChopTree(target, { recordTeach: !target.repeat });
        if (target.action === 'mine_stone') this.finishPlayerMineStone(target, { recordTeach: !target.repeat });
        if (target.action === 'deploy_loose_building_kit') this.finishPlayerDeployLooseKit(target);
        if (target.action === 'deploy_building_kit') this.finishPlayerDeployHeldKit(target);
        if (target.action === 'disassemble_building_to_kit') this.finishPlayerDisassembleStructure(target);
        // ── Auto-repeat resource gathering (#player-repeat) ──
        // When right-click started a repeat action (chop/mine/search), re-arm the
        // next cycle automatically as long as the resource is still valid.
        // Tree chop stops when felled (stump); stone mine repeats forever (depot never breaks);
        // tree/hemp search repeats until inventory fills or resource removed.
        if (target.repeat && !this.player.target) {
          const stillValid =
            (target.action === 'chop_tree' && this.canFinishPlayerChopTree(target)) ||
            (target.action === 'mine_stone' && this.canFinishPlayerMineStone(target)) ||
            (target.action === 'search_tree' && (() => {
              const t2 = this.trees.find(t => t.id === target.resourceId && !t.stump);
              return t2 && !this.player.inventory && this.treeSearchAvailable(t2, 'player');
            })());
          if (stillValid) {
            this.startPlayerResourceWork(target, this._resourceForRepeat(target), target.processLabel || (target.action === 'chop_tree' ? 'chopping tree' : target.action === 'mine_stone' ? 'mining stone' : 'searching'));
            this.player.target.repeat = true;
          } else {
            this.advancePlayerTargetQueue();
          }
        } else if (!this.player.target) {
          this.advancePlayerTargetQueue();
        }
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
          if (this.player.inventory || !this.hempSearchAvailable(hemp, 'player')) { this.advancePlayerTargetQueue(); this.addFloat(this.player.inventory ? 'Hands must be empty' : 'Hemp already being searched', hemp.x, hemp.y - 28, '#c86b5f'); return; }
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
    // ── Combat overlay (Patrick: aggressive auto-attack, even while working a loop) ──
    // Runs BEFORE the program dispatch. When combatEngaged is true the program/loop step
    // is skipped this tick — the bot fights instead. When the attack disengages (enemy
    // killed / fled / toggled passive), combatEngaged flips false and the loop resumes
    // from where it left off (runtime.pc is preserved across the pause).
    this.updateBotCombatOverlay(bot, dt);
    if (bot.combatEngaged) { bot.state = 'combat'; bot.message = `Engaged: ${bot.autoAttack?.targetRef || 'target'}.`; return; }
    if (bot.program === 'idle' && bot.combatMode !== 'passive') {
      if (this.updateActorAutoAttack(bot, dt, { searchRange: IDLE_BOT_AUTO_ATTACK_RANGE })) return;
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
      bot.timer=0; tree.hp--; bot.inventory.durability--;
      this.emitSound('chop', { cooldownKey: `bot:chop:${bot.id}`, minGapMs: 220 });
      if (bot.inventory.durability <= 0) { this.addFloat(`${itemLabel(toolType)} broke`, bot.x, bot.y - 24, '#c86b5f'); bot.inventory = null; }
      if (tree.hp <= 0) { tree.stump = true; tree.regrow = 0; bot.target = null; this.spawnItem('log', tree.x, tree.y, 1); this.spawnItem('stick', tree.x, tree.y, 2); this.spawnItem('tree_seed', tree.x, tree.y, 1); }
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
    if (this.player.inventory && this.player.inventory?.type !== 'crude_pickaxe') {
      const held = this.player.inventory ? ` (holding ${itemLabel(this.player.inventory.type)})` : '';
      this.addFloat(`Need empty hands or crude pickaxe${held}`, this.player.x, this.player.y - 30, '#c86b5f');
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
    // Quest 8: track holes dug
    if (this.campaignQuest?.active && this.campaignQuest.currentQuest === 8) {
      this.campaignQuest.holesDug++;
      this.addFloat(`Holes: ${this.campaignQuest.holesDug}/5`, this.player.x, this.player.y - 48, '#9abf8f');
      this.checkCampaignQuest();
    }
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
    // Quest 9: track seeds planted
    if (this.campaignQuest?.active && this.campaignQuest.currentQuest === 9) {
      this.campaignQuest.seedsPlanted++;
      this.addFloat(`Seeds planted: ${this.campaignQuest.seedsPlanted}/5`, this.player.x, this.player.y - 48, '#9abf8f');
      this.checkCampaignQuest();
    }
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
    ...this.hempPlants.map(h=>({ id:h.ref||`hemp:${h.id}`, numericId:h.id||null, kind:'resource', type:'hemp_plant', name:'hemp plant', x:Math.round(h.x), y:Math.round(h.y), radius:h.radius, harvested:!!h.harvested, searchReservedBy:h.searchReservedBy||null })),
    ...this.trees.map(t=>({ id:t.ref||`tree:${t.id}`, numericId:t.id||null, kind:'resource', type:'tree', name:t.stump ? 'tree stump' : (t.growthStage === 'sapling' ? 'small sapling' : t.growthStage === 'small_tree' ? 'small tree' : 'grown tree'), x:Math.round(t.x), y:Math.round(t.y), hp:t.hp, maxHp:t.maxHp, radius:t.radius, stump:!!t.stump, planted:!!t.planted, growthStage:t.growthStage||'grown_tree', growTimer:Math.max(0, Math.round((t.growTimer||0)*10)/10), searchReservedBy:t.searchReservedBy||null })),
    ...this.projectiles.map(p=>({ id:p.ref, numericId:p.id, kind:'projectile', type:p.type, sourceStructureId:p.sourceStructureId, targetRef:p.targetRef, x:Math.round(p.x), y:Math.round(p.y), damage:p.damage })),
    ...this.monsters.map(m=>({ id:m.ref||`monster:${m.id}`, numericId:m.id||null, kind:'monster', type:m.type||'passive_monster', name:m.name||'passive monster', x:Math.round(m.x), y:Math.round(m.y), hp:m.hp, maxHp:m.maxHp, radius:m.radius, passive:!!m.passive, spawnedAtNight:!!m.spawnedAtNight, avoidRadius:m.avoidRadius, roamRadius:m.roamRadius })),
    ...this.rocks.map(r=>({ id:r.ref, numericId:r.id, kind:'resource', type:'stone_deposit', name:'stone deposit', x:Math.round(r.x), y:Math.round(r.y), hp:r.hp, maxHp:r.maxHp, depleted:!!r.depleted })),
    ...this.bots.map(b=>({ id:b.ref, numericId:b.id, kind:b.kind || 'bot', name:this.botDisplayName(b), status:b.status||'worker', managerKnowledgePacks:b.managerKnowledgePacks||[], knowledgePacks:b.knowledgePacks||b.managerKnowledgePacks||[], dogFetchMemory:b.dogFetchMemory ? clone(b.dogFetchMemory) : null, dogFetchState:b.dogFetchState ? clone(b.dogFetchState) : null, x:Math.round(b.x), y:Math.round(b.y), hp:b.hp, maxHp:b.maxHp, hostile:!!b.hostile, equipment:this.equipmentSummary(b), program:b.program, teamId:b.teamId||null, teamName:this.botTeam(b)?.name||null }))
  ]; }
  getState(){ return { gameMode:this.gameMode||this.multiplayer?.mapMode||'test', map:{...this.map}, mapFeatures:clone(this.mapFeatures || []), campaignArrival:clone(this.campaignArrival || null), campaignQuest:this.campaignQuest?clone(this.campaignQuest):null, paused:!!this.paused, fps:Math.round(this.fps||0), targetFps:this.targetFps, dynamicShadowsEnabled:!!this.dynamicShadowsEnabled, lightingEffectsEnabled:this.lightingEffectsEnabled!==false, showFpsOverlay:this.showFpsOverlay!==false, dayNight:this.getDayNightState(), fogOfWar:getFogStats(this.fogOfWar), nightSpawns:clone(this.nightSpawns||{}), multiplayer:this.getMultiplayerSnapshot(), dialogue:this.getDialogueState(), player:{x:Math.round(this.player.x),y:Math.round(this.player.y),hp:this.player.hp,maxHp:this.player.maxHp,dead:!!this.player.dead,inventory:this.player.inventory,equipment:this.equipmentSummary(this.player),ammunition:Number(this.player.ammunition||0),facingX:this.player.facingX||1,facingY:this.player.facingY||0,target:this.player.target?{...this.player.target,x:Math.round(this.player.target.x),y:Math.round(this.player.target.y)}:null,targetQueue:(this.player.targetQueue||[]).map(target=>({...target,x:Math.round(target.x),y:Math.round(target.y)}))}, assistant:{x:Math.round(this.assistant.x),y:Math.round(this.assistant.y),facingX:this.assistant.facingX||1,facingY:this.assistant.facingY||0}, recorder:this.getRecorderState(), customTemplates:clone(this.customTemplates || []), bots:this.bots.map(b=>({id:b.id,ref:b.ref,name:this.botDisplayName(b),kind:b.kind||'bot',status:b.status||'worker',managerKnowledgePacks:b.managerKnowledgePacks||[],knowledgePacks:b.knowledgePacks||b.managerKnowledgePacks||[],dogFetchMemory:b.dogFetchMemory?clone(b.dogFetchMemory):null,dogFetchState:b.dogFetchState?clone(b.dogFetchState):null,teamId:b.teamId||null,teamName:this.botTeam(b)?.name||null,teamColor:this.botTeam(b)?.color||null,x:Math.round(b.x),y:Math.round(b.y),program:b.program,customTemplateName:b.customTemplateName||'',paused:!!b.paused,message:b.message,inventory:b.inventory,equipment:this.equipmentSummary(b),ammunition:Number(b.ammunition||0),tool:b.tool,hp:b.hp,maxHp:b.maxHp,hostile:!!b.hostile,taughtLoop:b.taughtLoop?clone(b.taughtLoop):null,targetStructureId:b.targetStructureId,sourceStructureId:b.sourceStructureId,sourcePaletteId:b.sourcePaletteId,pickupItemType:b.pickupItemType,targetFactoryId:b.targetFactoryId,targetWorkbenchId:b.targetWorkbenchId,zoneId:b.zoneId,zone:this.getBotZone(b)?this.zoneLabel(this.getBotZone(b)):null,combatMode:b.combatMode||'aggressive',combatEngaged:!!b.combatEngaged,runtime:b.runtime?{pc:b.runtime.pc,wait:b.runtime.wait}:null})), structures:this.structures.map(s=>({id:s.id,ref:s.ref,name:s.name,label:s.label,type:s.type,logs:s.logs,planks:s.planks,poles:s.poles,sticks:s.sticks,stones:s.stones,tree_seeds:s.tree_seeds,axes:s.axes,pickaxes:s.pickaxes||0,shovels:s.shovels||0,hammers:s.hammers||0,swords:s.swords||0,shields:s.shields||0,hemps:s.hemps||0,bows:s.bows||0,arrow_packs:s.arrow_packs||0,workbenchRecipe:s.workbenchRecipe||null,smitheryRecipe:s.smitheryRecipe||null,rangedAttack:s.rangedAttack?{...s.rangedAttack}:null,storageType:s.storageType||null,stored:s.stored||0,capacity:s.capacity||0,processing:s.processing?{...s.processing}:null,x:Math.round(s.x),y:Math.round(s.y)})), projectiles:this.projectiles.map(p=>({...p,x:Math.round(p.x),y:Math.round(p.y)})), zones:this.zones.map(z=>({...z,x:Math.round(z.x),y:Math.round(z.y),w:z.kind==='rect'?Math.round(z.w):undefined,h:z.kind==='rect'?Math.round(z.h):undefined,radius:z.kind==='radius'?Math.round(z.radius||DEFAULT_RESOURCE_RADIUS):undefined})), hempPlants:this.hempPlants.map(h=>({...h,x:Math.round(h.x),y:Math.round(h.y)})), monsters:this.monsters.map(m=>({...m,x:Math.round(m.x),y:Math.round(m.y),wanderTarget:m.wanderTarget?{x:Math.round(m.wanderTarget.x),y:Math.round(m.wanderTarget.y)}:null})), holes:this.holes.map(h=>({...h,x:Math.round(h.x),y:Math.round(h.y)})), botTeams:clone(this.botTeams), objectRegistry:this.getObjectRegistry(), stores:{sawbenchLogs:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.logs,0),sawbenchPlanks:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+s.planks,0),sawbenchPoles:this.structures.filter(s=>s.type==='sawbench').reduce((n,s)=>n+(s.poles||0),0),factoryLogs:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.logs||0),0),factoryPlanks:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+s.planks,0),factoryPoles:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.poles||0),0),factorySeeds:this.structures.filter(s=>s.type==='factory').reduce((n,s)=>n+(s.tree_seeds||0),0),looseLogs:this.countItems('log'),loosePlanks:this.countItems('plank'),loosePoles:this.countItems('pole'),looseSticks:this.countItems('stick'),looseStones:this.countItems('stone'),looseTreeSeeds:this.countItems('tree_seed'),looseAxes:this.countItems('crude_axe'),loosePickaxes:this.countItems('crude_pickaxe'),looseShovels:this.countItems('crude_shovel'),dugHoles:this.holes.length,stoneDeposits:this.rocks.filter(r=>!r.depleted).length,paletteItems:this.structures.filter(s=>s.type==='item_palette').reduce((n,s)=>n+(s.stored||0),0)}, hover:{bot:this.mouse.hoverBot?.id||null,structure:this.mouse.hoverStructure?.name||null,tree:this.mouse.hoverTree?.ref||null,hole:this.mouse.hoverHole?.ref||null,zone:this.mouse.hoverZone?.name||null}, placementType:this.placementType, zoneDrawing:!!this.zoneDraft?.active, renderer:this.renderer.text, rendererBackend:this.renderer.backend || this.renderBackend?.kind || null, webgpuAvailable:this.renderer.webgpu, maxBots:this.maxBots, dslTemplates:PROGRAM_TEMPLATES, asr:this.chat.asr ? {endpoint:this.chat.wsUrl(),recording:this.chat.asr.recording,segment:this.chat.asr.segment}:null }; }
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

installCodeLoopSystem(Game);

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
  MINE_STONE_HAND_SECONDS,
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

installDialogueSystem(Game, {
  dialogues: CAMPAIGN_DIALOGUES
});

installDogSystem(Game, {
  DOG_FETCH_SEARCH_RADIUS,
  DOG_FETCH_PRAISE_TARGET,
  itemLabel
});

installMenuSystem(Game, {
  BUILDING_TYPES,
  BUILDING_KIT_ITEM_TYPES,
  DEFAULT_MANAGER_KNOWLEDGE_PACKS,
  DEFAULT_RESOURCE_RADIUS,
  DEFENSE_TOWER_ATTACK,
  DOG_FETCH_PRAISE_TARGET,
  STORAGE_STRUCTURE_TYPES,
  STRUCTURE_INFO,
  THRONE_HP,
  WORKBENCH_TOOL_RECIPES,
  assemblerRecipe,
  buildingTypeFromKitItem,
  clone,
  itemLabel,
  smitheryRecipe,
  structureRecipeText,
  workbenchRecipe
});

installMultiplayerSystem(Game, {
  MONSTER_MELEE_ATTACK,
  MONSTER_WAVE_CONFIG,
  MULTIPLAYER_LANE_TOWERS,
  MULTIPLAYER_STARTS,
  ONLINE_MULTIPLAYER_FEATURES,
  THRONE_ATTACK_DAMAGE,
  THRONE_HP,
  WORLD_MAP_SIZE,
  clone,
  createEquipment
});

installDslProgramSystem(Game, {
  ALLOWED_OPS,
  DEFAULT_FOLLOW_DISTANCE,
  DEFAULT_MANAGER_KNOWLEDGE_PACKS,
  DEFAULT_NEARBY_RADIUS,
  DEFAULT_RESOURCE_RADIUS,
  ITEM_TYPES,
  MAX_NEARBY_RADIUS,
  PROGRAMS,
  PROGRAM_TEMPLATES,
  buildingKitItemTypeFor,
  clamp,
  clone,
  itemLabel
});

installSaveSystem(Game, {
  WORLD_MAP_SIZE,
  CAMERA_MIN_ZOOM,
  CAMERA_MAX_ZOOM,
  FOG_CELL_SIZE,
  DEFAULT_WORLD_ZONES,
  DEFAULT_MANAGER_KNOWLEDGE_PACKS,
  DEFAULT_BOT_COMBAT_MODE,
  createFogOfWar,
  normalizeFogOfWar,
  serializeFogOfWar,
  createEquipment,
  ensureEquipment,
  clone
});

installCampaignArrivalSystem(Game, {
  CAMPAIGN_START,
  getCampaignArrivalScene,
  CAMERA_EDGE_VIEWPORT_PADDING_RATIO
});

installCampaignQuestSystem(Game, {
  itemLabel
});






