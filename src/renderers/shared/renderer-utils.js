import { clamp as _clamp } from '../../utils.js?v=grove_pixi_fixes_0628';
export const clamp = _clamp;
import {
  fogRevealSources as buildFogRevealSources,
  isLightEmittingStructure,
  isPointCurrentlyVisible,
  isPointExplored as isFogPointExplored,
  structureLightRadius as getFogStructureLightRadius
} from '../../fog-of-war.js?v=t_building_kits_0618';

// ── Zoom-cull thresholds ──────────────────────────────────────────
export const LOOSE_ITEM_RENDER_MIN_ZOOM = 0.55;
export const DECORATIVE_DETAIL_RENDER_MIN_ZOOM = 0.55;
export const BOT_RENDER_MIN_ZOOM = 0.30;

export const BOT_HAND_TOOL_TYPES = new Set(['crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer']);

// ── Zoom helpers ───────────────────────────────────────────────────
export function normalizedCameraZoom(cameraZoom) {
  return Number.isFinite(cameraZoom) ? cameraZoom : 1;
}

export function shouldRenderLooseGroundItems(cameraZoom) {
  return normalizedCameraZoom(cameraZoom) >= LOOSE_ITEM_RENDER_MIN_ZOOM;
}

export function shouldRenderDecorativeDetails(cameraZoom) {
  return normalizedCameraZoom(cameraZoom) >= DECORATIVE_DETAIL_RENDER_MIN_ZOOM;
}

export function shouldRenderBots(cameraZoom) {
  return normalizedCameraZoom(cameraZoom) >= BOT_RENDER_MIN_ZOOM;
}

export function isBotHandTool(type) {
  return BOT_HAND_TOOL_TYPES.has(type);
}

// ── Viewport helpers ───────────────────────────────────────────────
export function getWorldViewBounds(game, padding = 120) {
  const zoom = game.camera.zoom || 1;
  const pad = padding / zoom;
  return {
    left: game.camera.x - pad,
    top: game.camera.y - pad,
    right: game.camera.x + (game.W / zoom) + pad,
    bottom: game.camera.y + (game.H / zoom) + pad
  };
}

export function getClippedMapView(game, view) {
  const mapWidth = game.map?.width || 0;
  const mapHeight = game.map?.height || 0;
  if (mapWidth <= 0 || mapHeight <= 0) return null;
  const left = Math.max(0, Math.floor(view?.left ?? 0));
  const top = Math.max(0, Math.floor(view?.top ?? 0));
  const right = Math.min(mapWidth, Math.ceil(view?.right ?? mapWidth));
  const bottom = Math.min(mapHeight, Math.ceil(view?.bottom ?? mapHeight));
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function circleInView(x, y, radius, view) {
  return x + radius >= view.left && x - radius <= view.right && y + radius >= view.top && y - radius <= view.bottom;
}

export function rectInView(x, y, w, h, view) {
  return x + w >= view.left && x <= view.right && y + h >= view.top && y <= view.bottom;
}

// ── Lighting / fog helpers ─────────────────────────────────────────
export function getNightAmount(game) { return clamp(game.dayNight?.nightAmount ?? 0, 0, 1); }
export function lightingEnabled(game) { return game.lightingEffectsEnabled !== false; }
export function isLightStructure(s) { return isLightEmittingStructure(s); }
export function structureLightRadius(s) { return getFogStructureLightRadius(s); }

export function fogRevealSources(game) {
  return buildFogRevealSources({ player: game.player, assistant: game.assistant, bots: game.bots, structures: game.structures, multiplayer: game.multiplayer });
}

export function fogEnabled(game) { return !!game.fogOfWar?.enabled; }

export function fogStaticVisible(game, x, y) {
  return !fogEnabled(game) || isPointCurrentlyVisible(game.fogOfWar, x, y) || isFogPointExplored(game.fogOfWar, x, y);
}

export function fogDynamicVisible(game, x, y) {
  return !fogEnabled(game) || isPointCurrentlyVisible(game.fogOfWar, x, y);
}

export function structureFogPoint(structure) {
  return { x: (structure.x || 0) + (structure.w || 48) / 2, y: (structure.y || 0) + (structure.h || 48) / 2 };
}

export function fogLightOccluders(game, view) {
  const occluders = [];
  const pad = 420;
  for (const structure of game.structures || []) {
    const point = structureFogPoint(structure);
    if (!fogStaticVisible(game, point.x, point.y)) continue;
    if (view && !rectInView((structure.x || 0) - pad, (structure.y || 0) - pad, (structure.w || 48) + pad * 2, (structure.h || 48) + pad * 2, view)) continue;
    occluders.push({ kind: 'structure', x: structure.x || 0, y: structure.y || 0, w: structure.w || 48, h: structure.h || 48, shadowStrength: 0.08 });
  }
  for (const tree of game.trees || []) {
    const radius = getTreeDrawRadius(tree) * 0.34;
    if (!fogStaticVisible(game, tree.x, tree.y)) continue;
    if (view && !circleInView(tree.x, tree.y, radius + pad, view)) continue;
    occluders.push({ kind: 'tree', x: tree.x, y: tree.y, radius: clamp(radius, 14, 34), shadowStrength: 0.04 });
  }
  for (const rock of game.rocks || []) {
    const radius = rock.radius || 18;
    if (!fogStaticVisible(game, rock.x, rock.y)) continue;
    if (view && !circleInView(rock.x, rock.y, radius + pad, view)) continue;
    occluders.push({ kind: 'rock', x: rock.x, y: rock.y, radius: clamp(radius * 0.95, 14, 42), shadowStrength: 0.02 });
  }
  return occluders;
}

// ── Tree helpers ───────────────────────────────────────────────────
export function getTreeDrawRadius(tree) {
  if (tree.stump) return Math.max(12, tree.radius || 20);
  if (tree.growthStage === 'sapling') return Math.max(10, tree.radius || 12);
  if (tree.growthStage === 'small_tree') return Math.max(18, tree.radius || 18);
  return Math.max(22, tree.radius || 22);
}

export function treeOcclusionChecks(tree) {
  const treeRadius = getTreeDrawRadius(tree);
  const treeHeightFactor = tree.stump ? .58 : (tree.growthStage === 'sapling' ? .8 : .95);
  const treeCenterY = tree.y - treeRadius * .12;
  return {
    checkCircle: (x, y, radius) => circlesOverlap(tree.x, treeCenterY, treeRadius, x, y, radius),
    checkRect: (x, y, w, h) => circleIntersectsRect(tree.x, treeCenterY, treeRadius, x - w / 2, y - h / 2, w, h),
    treeHeightFactor
  };
}

export function getTreeOpacity(game, tree, now, occluders = null) {
  return treeWouldOccludeItems(game, tree, now, occluders) ? .68 : (treeWouldOccludeDrawnObject(game, tree, now, occluders) ? .82 : 1);
}

// ── Rock (stone deposit) occlusion helpers ─────────────────────────
// Mirrors the tree transparency system: when a player, bot, monster, item,
// structure, or projectile is behind a rock, the rock becomes semi-transparent
// so the occluded object stays visible.
export function rockOcclusionChecks(rock) {
  const rockRadius = rock.radius || 18;
  const rockCenterY = rock.y - rockRadius * .08;
  return {
    checkCircle: (x, y, radius) => circlesOverlap(rock.x, rockCenterY, rockRadius, x, y, radius),
    checkRect: (x, y, w, h) => circleIntersectsRect(rock.x, rockCenterY, rockRadius, x - w / 2, y - h / 2, w, h)
  };
}

export function getRockOpacity(game, rock, now, occluders = null) {
  return rockWouldOccludeItems(game, rock, now, occluders) ? .68 : (rockWouldOccludeDrawnObject(game, rock, now, occluders) ? .82 : 1);
}

function rockWouldOccludeItems(game, rock, now, occluders = null) {
  const { checkCircle } = rockOcclusionChecks(rock);
  for (const item of occluders?.items || game.items || []) {
    const bob = item._bob ?? Math.sin(now / 400 + item.bob) * 2;
    if (checkCircle(item.x, item.y + bob, 11)) return true;
  }
  return false;
}

function rockWouldOccludeDrawnObject(game, rock, now, occluders = null) {
  const { checkCircle, checkRect } = rockOcclusionChecks(rock);
  for (const bot of occluders?.bots || game.bots || []) {
    if (checkCircle(bot.x, bot.y, (bot.r || 13) + 6)) return true;
  }
  for (const monster of occluders?.monsters || game.monsters || []) {
    if ((monster.hp || 0) > 0 && checkCircle(monster.x, monster.y, (monster.r || 14) + 6)) return true;
  }
  if (game.player && checkCircle(game.player.x, game.player.y, (game.player.r || 16) + 6)) return true;
  for (const player of Object.values(game.multiplayer?.players || {})) {
    if (!player || player.id === game.multiplayer?.playerId || player.disconnected) continue;
    if (checkCircle(player.x, player.y, 21)) return true;
  }
  for (const structure of occluders?.structures || game.structures || []) {
    if (checkRect(structure.x, structure.y, structure.w || 48, structure.h || 48)) return true;
  }
  for (const projectile of occluders?.projectiles || game.projectiles || []) {
    if (checkCircle(projectile.x, projectile.y, 8)) return true;
  }
  return false;
}

function treeWouldOccludeItems(game, tree, now, occluders = null) {
  const { checkCircle } = treeOcclusionChecks(tree);
  for (const item of occluders?.items || game.items || []) {
    const bob = item._bob ?? Math.sin(now / 400 + item.bob) * 2;
    if (checkCircle(item.x, item.y + bob, 11)) return true;
  }
  return false;
}

function treeWouldOccludeDrawnObject(game, tree, now, occluders = null) {
  const { checkCircle, checkRect, treeHeightFactor } = treeOcclusionChecks(tree);
  for (const bot of occluders?.bots || game.bots || []) {
    if (checkCircle(bot.x, bot.y, (bot.r || 13) + 6)) return true;
  }
  for (const monster of occluders?.monsters || game.monsters || []) {
    if ((monster.hp || 0) > 0 && checkCircle(monster.x, monster.y, (monster.r || 14) + 6)) return true;
  }
  if (game.player && checkCircle(game.player.x, game.player.y, (game.player.r || 16) + 6)) return true;
  for (const player of Object.values(game.multiplayer?.players || {})) {
    if (!player || player.id === game.multiplayer?.playerId || player.disconnected) continue;
    if (checkCircle(player.x, player.y, 21)) return true;
  }
  for (const structure of occluders?.structures || game.structures || []) {
    if (checkRect(structure.x, structure.y, structure.w || 48, (structure.h || 48) * treeHeightFactor)) return true;
  }
  for (const projectile of occluders?.projectiles || game.projectiles || []) {
    if (checkCircle(projectile.x, projectile.y, 8)) return true;
  }
  return false;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const limit = ar + br;
  return dx * dx + dy * dy <= limit * limit;
}

export function circleIntersectsRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearestX = clamp(cx, rx, rx + rw);
  const nearestY = clamp(cy, ry, ry + rh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= cr * cr;
}

// ── Campaign helpers ───────────────────────────────────────────────
export function isCampaignArrivalActive(game) {
  return !!game.campaignArrival?.active && game.gameMode === 'campaign';
}

export function computePolylineProgress(now, startedAt, durationMs) {
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return clamp((now - startedAt) / durationMs, 0, 1);
}

export function samplePolyline(points, progress) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const dx = (b.x ?? b[0]) - (a.x ?? a[0]);
    const dy = (b.y ?? b[1]) - (a.y ?? a[1]);
    const length = Math.hypot(dx, dy);
    if (length <= 0) continue;
    segments.push({ a, b, length, angle: Math.atan2(dy, dx) });
    total += length;
  }
  if (!segments.length || total <= 0) {
    const first = points[0];
    return { x: first.x ?? first[0] ?? 0, y: first.y ?? first[1] ?? 0, angle: 0 };
  }
  const target = total * clamp(progress, 0, 1);
  let traveled = 0;
  for (const segment of segments) {
    const next = traveled + segment.length;
    if (target <= next) {
      const local = segment.length ? (target - traveled) / segment.length : 0;
      const ax = segment.a.x ?? segment.a[0] ?? 0;
      const ay = segment.a.y ?? segment.a[1] ?? 0;
      const bx = segment.b.x ?? segment.b[0] ?? 0;
      const by = segment.b.y ?? segment.b[1] ?? 0;
      return { x: ax + ((bx - ax) * local), y: ay + ((by - ay) * local), angle: segment.angle };
    }
    traveled = next;
  }
  const last = segments[segments.length - 1];
  const bx = last.b.x ?? last.b[0] ?? 0;
  const by = last.b.y ?? last.b[1] ?? 0;
  return { x: bx, y: by, angle: last.angle };
}

export function polylineFeatureInView(feature, view, padding = 140) {
  const points = feature.points || [];
  if (!view || points.length < 2) return true;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    const [x, y] = point || [];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return false;
  const pad = Math.max(padding, ((feature.width || 0) / 2) + 40);
  return rectInView(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2, view);
}

export function terrainNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// ── Color helpers ──────────────────────────────────────────────────
export function lighten(hex, amount) { return mix(hex, '#ffffff', amount); }
export function darken(hex, amount) { return mix(hex, '#000000', amount); }

function mix(hex, target, amount) {
  const a = parseHex(hex), b = parseHex(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function parseHex(hex) {
  const clean = String(hex).replace('#', '').slice(0, 6).padEnd(6, '0');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)].map(n => Number.isFinite(n) ? n : 0);
}

// ── Canvas drawing primitives ──────────────────────────────────────
export function roundedRect(c, x, y, w, h, r) {
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); return; }
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath(); c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr); c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr); c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y);
}

export function drawShadow(c, x, y, rx, ry, alpha = .2) {
  c.save(); c.fillStyle = `rgba(0,0,0,${alpha})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore();
}

export function drawBar(c, x, y, w, h, ratio, color) {
  c.save();
  roundedRect(c, x, y, w, h, h / 2); c.fillStyle = 'rgba(5,8,7,.78)'; c.fill();
  roundedRect(c, x + 1, y + 1, Math.max(0, (w - 2) * clamp(ratio, 0, 1)), h - 2, h / 2); c.fillStyle = color; c.fill();
  c.restore();
}

export function drawNameTag(c, text, x, y) {
  c.save();
  c.font = '700 11px system-ui'; c.textAlign = 'center';
  const w = c.measureText(text).width + 14;
  c.fillStyle = 'rgba(6,10,8,.82)'; c.strokeStyle = 'rgba(255,244,208,.38)';
  roundedRect(c, x - w / 2, y - 15, w, 20, 999); c.fill(); c.stroke();
  c.fillStyle = '#fff4d0'; c.fillText(text, x, y - 1);
  c.restore();
}

export function drawPill(c, text, x, y, color) {
  c.save();
  c.font = '700 12px system-ui';
  const w = c.measureText(text).width + 14;
  c.fillStyle = 'rgba(6,10,8,.72)'; c.strokeStyle = color;
  roundedRect(c, x, y, w, 22, 999); c.fill(); c.stroke();
  c.fillStyle = '#f2f7f3'; c.fillText(text, x + 7, y + 15);
  c.restore();
}

export function getLookOffset(facingX = 1, facingY = 0, amount = 4) {
  const len = Math.hypot(facingX, facingY);
  if (len < 0.001) return { x: amount, y: 0 };
  return { x: (facingX / len) * amount, y: (facingY / len) * amount * 0.6 };
}

export function createCanvasLayer(width, height, c) {
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (c?.canvas?.ownerDocument?.createElement) {
    const canvas = c.canvas.ownerDocument.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('Unable to create offscreen canvas layer');
}
