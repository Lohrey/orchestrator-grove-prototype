const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const FOG_CELL_SIZE = 64;
export const FOG_VISIBLE_RADIUS = 360;
export const FOG_ASSISTANT_RADIUS = 165;
export const FOG_BOT_RADIUS = 185;
export const FOG_STRUCTURE_RADIUS = 195;

const OCCLUDER_SHADOW_MAX = 12;

const LIGHT_EMITTING_STRUCTURE_TYPES = new Set([
  'sawbench',
  'workbench',
  'factory',
  'smithery',
  'bowmaker',
  'defensetower',
  'portable_3d_printer',
  'assembler',
  'power_station',
  'solar_array',
  'camper_van'
]);

function makeCellKey(cx, cy) { return `${cx},${cy}`; }
function parseCellKey(key) {
  const [x, y] = String(key).split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
function fogCellForPoint(fog, x, y) {
  const cellSize = fog?.cellSize || FOG_CELL_SIZE;
  return { x: Math.floor(x / cellSize), y: Math.floor(y / cellSize) };
}

export function createFogOfWar({ enabled = true, cellSize = FOG_CELL_SIZE } = {}) {
  return {
    enabled,
    cellSize,
    explored: {},
    visible: {},
    lastSeen: {},
    revision: 0,
    updatedAt: 0
  };
}

function ensureFogOfWarState(fog = {}, { enabled = true, cellSize = FOG_CELL_SIZE } = {}) {
  const state = fog && typeof fog === 'object' ? fog : {};
  if (state.enabled === undefined) state.enabled = enabled;
  if (!state.cellSize) state.cellSize = cellSize;
  if (!state.explored || typeof state.explored !== 'object') state.explored = {};
  if (!state.visible || typeof state.visible !== 'object') state.visible = {};
  if (!state.lastSeen || typeof state.lastSeen !== 'object') state.lastSeen = {};
  if (!Number.isFinite(state.revision)) state.revision = 0;
  if (!Number.isFinite(state.updatedAt)) state.updatedAt = 0;
  return state;
}

export function normalizeFogOfWar(fog = {}, { enabled = true, cellSize = FOG_CELL_SIZE } = {}) {
  const state = ensureFogOfWarState({ ...(fog || {}) }, { enabled, cellSize: fog?.cellSize || cellSize });
  return {
    ...state,
    explored: { ...state.explored },
    visible: { ...state.visible },
    lastSeen: { ...state.lastSeen }
  };
}

export function serializeFogOfWar(fog = {}) {
  const normalized = ensureFogOfWarState(fog);
  return {
    enabled: !!normalized.enabled,
    cellSize: normalized.cellSize || FOG_CELL_SIZE,
    explored: { ...normalized.explored },
    lastSeen: { ...normalized.lastSeen }
  };
}

export function isLightEmittingStructure(structure) {
  return !!structure && LIGHT_EMITTING_STRUCTURE_TYPES.has(structure.type);
}

export function structureLightRadius(structure) {
  if (!isLightEmittingStructure(structure)) return 0;
  if (structure.type === 'defensetower') return 270;
  if (['factory', 'portable_3d_printer', 'assembler'].includes(structure.type)) return 245;
  if (['power_station', 'solar_array', 'camper_van'].includes(structure.type)) return 225;
  return FOG_STRUCTURE_RADIUS;
}

function sourceStrength(source) {
  if (source.kind === 'player') return 1;
  if (source.kind === 'assistant') return 0.86;
  if (source.kind === 'bot') return 0.78;
  if (source.kind === 'structure') return 0.9;
  return 0.82;
}

function playerOwnedOrNeutral(structure, multiplayer = {}) {
  if (!structure?.ownerId || structure.ownerId === 'neutral') return true;
  return !multiplayer?.enabled || structure.ownerId === (multiplayer.playerId || 'p1');
}

export function fogRevealSources({ player, assistant, bots = [], structures = [], multiplayer = {} } = {}) {
  const sources = [];
  if (player) sources.push({ kind: 'player', x: player.x, y: player.y, radius: FOG_VISIBLE_RADIUS, strength: 1 });
  if (assistant) sources.push({ kind: 'assistant', x: assistant.x, y: assistant.y, radius: FOG_ASSISTANT_RADIUS, strength: 0.86 });
  for (const bot of bots || []) sources.push({ kind: 'bot', x: bot.x, y: bot.y, radius: FOG_BOT_RADIUS, strength: 0.78 });
  for (const structure of structures || []) {
    if (!playerOwnedOrNeutral(structure, multiplayer) || !isLightEmittingStructure(structure)) continue;
    sources.push({ kind: 'structure', x: structure.x, y: structure.y, radius: structureLightRadius(structure), strength: 0.9, structureType: structure.type });
  }
  return sources.filter(source => Number.isFinite(source.x) && Number.isFinite(source.y) && source.radius > 0);
}

export function revealFogCircle(fog, { x, y, radius, strength = 1 } = {}, { map = {}, time = 0, visible = true } = {}) {
  const normalized = ensureFogOfWarState(fog);
  if (!normalized.enabled || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return normalized;
  const cell = normalized.cellSize || FOG_CELL_SIZE;
  const maxCellX = Math.ceil((map.width || x + radius) / cell) - 1;
  const maxCellY = Math.ceil((map.height || y + radius) / cell) - 1;
  const minX = Math.max(0, Math.floor((x - radius) / cell));
  const maxX = Math.max(0, Math.min(maxCellX, Math.floor((x + radius) / cell)));
  const minY = Math.max(0, Math.floor((y - radius) / cell));
  const maxY = Math.max(0, Math.min(maxCellY, Math.floor((y + radius) / cell)));
  const revealPadding = cell * clamp(0.55 + strength * 0.24, 0.55, 0.82);
  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const centerX = cx * cell + cell / 2;
      const centerY = cy * cell + cell / 2;
      if (map.width && (centerX < 0 || centerX > map.width)) continue;
      if (map.height && (centerY < 0 || centerY > map.height)) continue;
      if (Math.hypot(x - centerX, y - centerY) > radius + revealPadding) continue;
      const key = makeCellKey(cx, cy);
      normalized.explored[key] = 1;
      normalized.lastSeen[key] = Math.round((time || 0) * 10) / 10;
      if (visible) normalized.visible[key] = 1;
    }
  }
  return normalized;
}

export function updateFogOfWarState(fog, { map = {}, sources = [], time = 0 } = {}) {
  let normalized = ensureFogOfWarState(fog);
  if (!normalized.enabled) return normalized;
  normalized.visible = {};
  for (const source of sources || []) {
    normalized = revealFogCircle(normalized, { ...source, strength: source.strength ?? sourceStrength(source) }, { map, time, visible: true });
  }
  normalized.revision = (normalized.revision || 0) + 1;
  normalized.updatedAt = time || 0;
  return normalized;
}

export function isPointExplored(fog, x, y) {
  const normalized = ensureFogOfWarState(fog);
  const cell = fogCellForPoint(normalized, x, y);
  return !!normalized.explored[makeCellKey(cell.x, cell.y)];
}

export function isPointCurrentlyVisible(fog, x, y) {
  const normalized = ensureFogOfWarState(fog);
  const cell = fogCellForPoint(normalized, x, y);
  return !!normalized.visible[makeCellKey(cell.x, cell.y)];
}

export function getFogStats(fog = {}) {
  const normalized = ensureFogOfWarState(fog);
  return {
    enabled: !!normalized.enabled,
    cellSize: normalized.cellSize || FOG_CELL_SIZE,
    exploredCount: Object.keys(normalized.explored || {}).length,
    visibleCount: Object.keys(normalized.visible || {}).length,
    lastSeenCount: Object.keys(normalized.lastSeen || {}).length,
    revision: normalized.revision || 0
  };
}

function drawCellLayer(c, cells, cellSize, alpha, view, map) {
  if (!cells || alpha <= 0) return;
  const minCellX = Math.max(0, Math.floor((view.left - cellSize) / cellSize));
  const maxCellX = Math.min(Math.ceil((map.width || view.right) / cellSize) - 1, Math.floor((view.right + cellSize) / cellSize));
  const minCellY = Math.max(0, Math.floor((view.top - cellSize) / cellSize));
  const maxCellY = Math.min(Math.ceil((map.height || view.bottom) / cellSize) - 1, Math.floor((view.bottom + cellSize) / cellSize));
  c.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let cy = minCellY; cy <= maxCellY; cy += 1) {
    for (let cx = minCellX; cx <= maxCellX; cx += 1) {
      if (!cells[makeCellKey(cx, cy)]) continue;
      c.fillRect(cx * cellSize - 2, cy * cellSize - 2, cellSize + 4, cellSize + 4);
    }
  }
}

function drawRadialReveal(c, source) {
  const strength = source.strength ?? sourceStrength(source);
  const g = c.createRadialGradient(source.x, source.y, 0, source.x, source.y, source.radius);
  g.addColorStop(0, `rgba(255,255,255,${clamp(strength, 0.45, 1)})`);
  g.addColorStop(0.58, `rgba(255,255,255,${clamp(strength * 0.68, 0.28, 0.82)})`);
  g.addColorStop(0.86, `rgba(255,255,255,${clamp(strength * 0.28, 0.12, 0.38)})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(source.x, source.y, source.radius, 0, Math.PI * 2);
  c.fill();
}

function occluderCenter(occluder) {
  if (!occluder) return null;
  if (Number.isFinite(occluder.x) && Number.isFinite(occluder.y) && Number.isFinite(occluder.radius)) {
    return { x: occluder.x, y: occluder.y, radius: occluder.radius };
  }
  const w = Math.max(8, occluder.w || 36);
  const h = Math.max(8, occluder.h || 36);
  return { x: (occluder.x || 0) + w / 2, y: (occluder.y || 0) + h / 2, radius: Math.hypot(w, h) * 0.48 };
}

function drawOccluderShadows(c, { sources = [], occluders = [], view } = {}) {
  if (!sources?.length || !occluders?.length) return;
  let drawn = 0;
  for (const source of sources) {
    if (drawn >= OCCLUDER_SHADOW_MAX) break;
    if (!Number.isFinite(source.x) || !Number.isFinite(source.y) || !Number.isFinite(source.radius)) continue;
    if (view && (source.x + source.radius < view.left || source.x - source.radius > view.right || source.y + source.radius < view.top || source.y - source.radius > view.bottom)) continue;
    for (const occluder of occluders) {
      if (drawn >= OCCLUDER_SHADOW_MAX) break;
      const occ = occluderCenter(occluder);
      if (!occ) continue;
      const dx = occ.x - source.x;
      const dy = occ.y - source.y;
      const distance = Math.hypot(dx, dy);
      const radius = clamp(occ.radius || 16, 10, 72);
      if (distance < radius + 8 || distance > source.radius + radius) continue;
      const vx = dx / distance;
      const vy = dy / distance;
      const px = -vy;
      const py = vx;
      const spread = clamp(radius * 0.82, 10, 58);
      const length = clamp(source.radius - distance + radius * 2.1, 48, source.radius * 0.72);
      const left = { x: occ.x + px * spread, y: occ.y + py * spread };
      const right = { x: occ.x - px * spread, y: occ.y - py * spread };
      const farLeft = { x: left.x + vx * length + px * spread * 0.35, y: left.y + vy * length + py * spread * 0.35 };
      const farRight = { x: right.x + vx * length - px * spread * 0.35, y: right.y + vy * length - py * spread * 0.35 };
      const alpha = clamp(0.07 + (1 - distance / Math.max(1, source.radius)) * 0.11 + (occluder.shadowStrength || 0) * 0.45, 0.07, 0.22);
      c.fillStyle = `rgba(1, 5, 8, ${alpha})`;
      c.beginPath();
      c.moveTo(left.x, left.y);
      c.lineTo(farLeft.x, farLeft.y);
      c.lineTo(farRight.x, farRight.y);
      c.lineTo(right.x, right.y);
      c.closePath();
      c.fill();
      drawn += 1;
    }
  }
}

const fogLayerCache = new WeakMap();

function createFogLayer(width, height, targetContext) {
  const layerWidth = Math.max(1, Math.ceil(width));
  const layerHeight = Math.max(1, Math.ceil(height));
  const cacheKey = targetContext?.canvas || targetContext;
  const cached = cacheKey ? fogLayerCache.get(cacheKey) : null;
  if (cached?.canvas) {
    if (cached.width !== layerWidth) { cached.canvas.width = layerWidth; cached.width = layerWidth; }
    if (cached.height !== layerHeight) { cached.canvas.height = layerHeight; cached.height = layerHeight; }
    return cached.canvas;
  }
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(layerWidth, layerHeight);
    if (cacheKey) fogLayerCache.set(cacheKey, { canvas, width: layerWidth, height: layerHeight });
    return canvas;
  }
  const doc = targetContext?.canvas?.ownerDocument || globalThis.document;
  if (!doc?.createElement) return null;
  const layer = doc.createElement('canvas');
  layer.width = layerWidth;
  layer.height = layerHeight;
  if (cacheKey) fogLayerCache.set(cacheKey, { canvas: layer, width: layerWidth, height: layerHeight });
  return layer;
}

export function drawFogOfWarOverlay(c, { fog, map = {}, view, sources = [], occluders = [], nightAmount = 0 } = {}) {
  const normalized = ensureFogOfWarState(fog);
  if (!normalized.enabled || !view || view.width <= 0 || view.height <= 0) return;
  const cell = normalized.cellSize || FOG_CELL_SIZE;
  const layer = createFogLayer(view.width, view.height, c);
  const layerContext = layer?.getContext?.('2d');
  if (!layerContext) return;

  layerContext.save();
  layerContext.translate(-view.left, -view.top);
  layerContext.fillStyle = `rgba(1, 5, 9, ${0.82 + clamp(nightAmount, 0, 1) * 0.12})`;
  layerContext.fillRect(view.left, view.top, view.width, view.height);
  layerContext.globalCompositeOperation = 'destination-out';
  drawCellLayer(layerContext, normalized.explored, cell, 0.18, view, map);
  drawCellLayer(layerContext, normalized.visible, cell, 1, view, map);
  for (const source of sources || []) {
    if (source.x + source.radius < view.left || source.x - source.radius > view.right || source.y + source.radius < view.top || source.y - source.radius > view.bottom) continue;
    drawRadialReveal(layerContext, source);
  }
  layerContext.globalCompositeOperation = 'source-over';
  drawOccluderShadows(layerContext, { sources, occluders, view });
  layerContext.restore();

  c.save();
  c.globalCompositeOperation = 'source-over';
  c.drawImage(layer, view.left, view.top);
  c.restore();
}
