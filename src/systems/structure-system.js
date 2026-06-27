// src/systems/structure-system.js
// Structure placement, demolition, building kits, zone management and zone queries.
// Part of the Game class composition root — installed via installStructureSystem(Game, deps).

import { clamp, distXY, pointInRect } from '../utils.js?v=20260613-player-tools';

export function installStructureSystem(Game, deps) {
  const {
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
  } = deps;

  Object.assign(Game.prototype, {
    addStructure(type, x, y, options = {}) {
      const def = BUILDING_TYPES[type]; const id = this.nextStructureId++;
      const countSame = this.structures.filter(s => s.type === type).length + 1;
      const baseName = type === 'factory' ? 'factory' : type === 'item_palette' ? 'item palette' : type === 'workbench' ? 'tool bench' : type === 'smithery' ? 'smithery' : type === 'bowmaker' ? 'bowmaker' : type === 'arrowmaker' ? 'arrowmaker' : type === 'defensetower' ? 'defense tower' : type === 'throne' ? 'throne' : type === 'camper_van' ? 'white camper' : type === 'hammock_camp' ? 'hammock camp' : type === 'ultrabook_desk' ? 'ultrabook desk' : type === 'solar_array' ? 'solar array' : type === 'power_station' ? 'power station' : type === 'portable_3d_printer' ? '3d printer' : type === 'assembler' ? 'assembler' : type === 'robotics_parts_bin' ? 'parts bin' : 'sawbench';
      const s = { id, ref: `structure:${id}`, type, name: `${baseName} ${countSame}`, label: def.label, x, y, w: def.w, h: def.h, placed: !!options.placed, logs: 0, planks: 0, poles: 0, sticks: 0, stones: 0, tree_seeds: 0, axes: 0, pickaxes: 0, shovels: 0, hammers: 0, swords: 0, shields: 0, hemps: 0, bows: 0, arrow_packs: 0, timer: 0, processing: null };
      if (type === 'throne') Object.assign(s, { hp: def.maxHp || THRONE_HP, maxHp: def.maxHp || THRONE_HP, ownerId: null, ownerLabel: 'unclaimed' });
      if (type === 'workbench') s.workbenchRecipe = DEFAULT_WORKBENCH_RECIPE;
      if (type === 'assembler') s.assemblerRecipe = DEFAULT_ASSEMBLER_RECIPE;
      if (type === 'player_storage') Object.assign(s, { storageType: this.player.inventory?.type || null, stored: this.player.inventory ? 1 : 0, capacity: 1 });
      if (type === 'smithery') s.smitheryRecipe = DEFAULT_SMITHERY_RECIPE;
      if (type === 'defensetower') Object.assign(s, { hp: 20, maxHp: 20, ownerId: null, ownerLabel: 'neutral', rangedAttack: createRangedAttackComponent({ range: def.attackRange, damage: def.attackDamage, cooldown: def.attackCooldown }) });
      if (['item_palette', 'power_station', 'robotics_parts_bin'].includes(type)) Object.assign(s, { storageType: null, stored: 0, capacity: def.capacity || 40 });
      this.structures.push(s); this.addFloat(`Built ${s.name}`, x, y - 35, '#d3a95f'); this.emitSound('build', { cooldownKey: `build:${type}`, minGapMs: 120 }); return s;
    },
    placeStructure(type, x, y) { this.addStructure(type, clamp(x, 70, this.map.width - 70), clamp(y, 80, this.map.height - 70), { placed: true }); this.placementType = null; this.syncBuildUi(); },
    setPlacement(type) { this.cancelZoneDrawing(false); this.placementType = type; this.syncBuildUi(); },
    cancelPlacement() { this.placementType = null; this.syncBuildUi(); },
    beginZoneDrawing() {
      this.cancelPlacement(); this.hideMenus();
      this.zoneDraft = { active: true, started: false, kind: 'rect', x1: 0, y1: 0, x2: 0, y2: 0 };
      this.addFloat('Drag a rectangle; coordinates will be inserted into chat', this.player.x, this.player.y - 34, '#9abf8f');
    },
    cancelZoneDrawing(showFloat = true) { if (this.zoneDraft?.active && showFloat) this.addFloat('Zone draw cancelled', this.player.x, this.player.y - 34, '#c86b5f'); this.zoneDraft = null; },
    finishZoneDrawing() {
      const d = this.zoneDraft; this.zoneDraft = null;
      if (!d) return null;
      const numericId = this.nextZoneId++;
      if (d.kind === 'radius') {
        const radius = clamp(Number(d.radius || distXY(d.x1, d.y1, d.x2, d.y2) || DEFAULT_RESOURCE_RADIUS), 40, 420);
        const z = { id: `zone:${numericId}`, numericId, name: `radius ${numericId}`, kind: 'radius', x: clamp(d.x1, 0, this.map.width), y: clamp(d.y1, 0, this.map.height), radius, color: '#d3a95f', builtIn: false, hidden: false };
        this.zones.push(z); this.syncZonesUi(); this.addFloat(`Created ${z.name}`, z.x, z.y - radius - 8, '#d3a95f'); this.emitSound('zone_create', { cooldownKey: 'zone_create', minGapMs: 100 }); return z;
      }
      const x = clamp(Math.min(d.x1, d.x2), 0, this.map.width), y = clamp(Math.min(d.y1, d.y2), 0, this.map.height);
      const w = clamp(Math.abs(d.x2 - d.x1), 0, this.map.width - x), h = clamp(Math.abs(d.y2 - d.y1), 0, this.map.height - y);
      if (w < MIN_DRAWN_ZONE_SIZE || h < MIN_DRAWN_ZONE_SIZE) { this.addFloat('Zone too small', this.player.x, this.player.y - 34, '#c86b5f'); return null; }
      const z = { id: `zone:${numericId}`, numericId, name: `zone ${numericId}`, kind: 'rect', x, y, w, h, color: '#d3a95f', builtIn: false, hidden: false };
      this.zones.push(z); this.syncZonesUi(); this.addFloat(`Created ${z.name}`, x + w / 2, y - 8, '#d3a95f'); this.emitSound('zone_create', { cooldownKey: 'zone_create', minGapMs: 100 }); return z;
    },
    canDemolishStructure(s) { return !!s && s.placed === true && s.type !== 'throne'; },
    demolishStructure(s) {
      if (!this.canDemolishStructure(s)) return false;
      this.structures = this.structures.filter(st => st.id !== s.id);
      for (const bot of this.bots || []) {
        for (const key of ['targetStructureId', 'sourceStructureId', 'sourcePaletteId', 'targetFactoryId', 'targetWorkbenchId']) if (bot[key] === s.id) bot[key] = null;
        if (bot.target?.id === s.id || bot.target?.structureId === s.id) bot.target = null;
        if (bot.productionJob?.structureId === s.id) bot.productionJob = null;
      }
      if (this.player.target?.structureId === s.id) this.player.target = null;
      this.projectiles = (this.projectiles || []).filter(p => p.sourceStructureId !== s.id && p.targetRef !== s.ref);
      this.addFloat(`Demolished ${s.name}`, s.x, s.y - 35, '#d3a95f');
      this.emitSound('demolish', { cooldownKey: `demolish:${s.id}`, minGapMs: 120 });
      this.syncBuildUi();
      return true;
    },
    canDisassembleStructure(s) { return !!s && !!buildingKitItemTypeFor(s.type) && !this.isStructureProcessing(s); },
    disassembleStructureToKit(s, actor = null) {
      if (!this.canDisassembleStructure(s)) return null;
      const kitType = buildingKitItemTypeFor(s.type);
      this.structures = this.structures.filter(st => st.id !== s.id);
      for (const bot of this.bots || []) {
        for (const key of ['targetStructureId', 'sourceStructureId', 'sourcePaletteId', 'targetFactoryId', 'targetWorkbenchId']) if (bot[key] === s.id) bot[key] = null;
        if (bot.target?.id === s.id || bot.target?.structureId === s.id) bot.target = null;
        if (bot.productionJob?.structureId === s.id) bot.productionJob = null;
      }
      if (this.player.target?.structureId === s.id) this.player.target = null;
      this.projectiles = (this.projectiles || []).filter(p => p.sourceStructureId !== s.id && p.targetRef !== s.ref);
      if (actor && !actor.inventory) actor.inventory = { type: kitType, count: 1 };
      else this.spawnItem(kitType, s.x, s.y, 1);
      this.addFloat(`Disassembled ${s.name} into ${itemLabel(kitType)}`, s.x, s.y - 35, '#d3a95f');
      this.emitSound('disassemble', { cooldownKey: `disassemble:${s.id}`, minGapMs: 120 });
      this.syncBuildUi();
      return kitType;
    },
    deployBuildingKitAt(type, x, y, options = {}) {
      const kitType = this.normalizeBuildingKitItemType(type);
      const buildingType = buildingTypeFromKitItem(kitType);
      if (!buildingType || !BUILDING_TYPES[buildingType]) return null;
      const s = this.addStructure(buildingType, clamp(x, 70, this.map.width - 70), clamp(y, 80, this.map.height - 70), { placed: true, ...options });
      this.addFloat(`Deployed ${itemLabel(kitType)}`, s.x, s.y - 52, '#9abf8f');
      return s;
    },
    zoneAt(x, y) {
      for (let i = this.zones.length - 1; i >= 0; i -= 1) {
        const zone = this.zones[i];
        if (!zone.hidden && this.pointInZone(x, y, zone)) return zone;
      }
      return null;
    },
    pointInZone(x, y, zone, anchor = null) {
      if (!zone) return true;
      if (zone.kind === 'nearby') { const c = anchor || this.player; return !!c && distXY(x, y, c.x, c.y) <= (zone.radius || DEFAULT_NEARBY_RADIUS); }
      if (zone.kind === 'radius') { const s = zone.centerStructureId ? this.structures.find(st => st.id === zone.centerStructureId) : null; const cx = s?.x ?? zone.x, cy = s?.y ?? zone.y; return Number.isFinite(cx) && Number.isFinite(cy) && distXY(x, y, cx, cy) <= (zone.radius || DEFAULT_RESOURCE_RADIUS); }
      return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
    },
    objectInZone(obj, zone, anchor = null) { return this.pointInZone(obj.x, obj.y, zone, anchor); },
    zoneBounds(zone) {
      if (!zone) return { x: 0, y: 0, w: 0, h: 0 };
      if (zone.kind === 'nearby') {
        const r = clamp(Number(zone.radius || DEFAULT_NEARBY_RADIUS), 40, MAX_NEARBY_RADIUS);
        const c = this.player || { x: r, y: r };
        return { x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 };
      }
      if (zone.kind === 'radius') {
        const r = clamp(Number(zone.radius || DEFAULT_RESOURCE_RADIUS), 40, 420);
        return { x: zone.x - r, y: zone.y - r, w: r * 2, h: r * 2 };
      }
      return { x: zone.x, y: zone.y, w: zone.w || 0, h: zone.h || 0 };
    },
    zoneCenter(zone, fallback = null) {
      if (!zone) return fallback;
      if (zone.kind === 'nearby') return fallback;
      if (zone.kind === 'radius') {
        const s = zone.centerStructureId ? this.structures.find(st => st.id === zone.centerStructureId) : null;
        const x = s?.x ?? zone.x, y = s?.y ?? zone.y;
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
      }
      return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
    },
  });
}
