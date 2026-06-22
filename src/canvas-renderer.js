import { BUILDING_TYPES } from './data.js?v=t_building_kits_0618';
import { clamp } from './utils.js?v=20260613-player-tools';
import { drawFogOfWarOverlay, fogRevealSources as buildFogRevealSources, isLightEmittingStructure, isPointCurrentlyVisible, isPointExplored as isFogPointExplored, structureLightRadius as getFogStructureLightRadius } from './fog-of-war.js?v=t_building_kits_0618';
import { createDepthDrawable, sortDepthDrawables } from './depth-sort.js?v=t_da28d8dd';
import {
  drawBuildingAsset,
  drawBuildingPreviewAsset,
  drawHeldToolAsset,
  drawItemAsset,
  drawMiniItemAsset,
  itemLabel
} from './visual-assets.js?v=t_building_kits_0618';

const staticMapBaseCache = new Map();
const BOT_HAND_TOOL_TYPES = new Set(['crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer']);
export const LOOSE_ITEM_RENDER_MIN_ZOOM = 0.55;
export const DECORATIVE_DETAIL_RENDER_MIN_ZOOM = 0.55;
export const BOT_RENDER_MIN_ZOOM = 0.30;

function normalizedCameraZoom(cameraZoom) {
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

function isBotHandTool(type) {
  return BOT_HAND_TOOL_TYPES.has(type);
}

export function drawWorld(renderState, ctx) {
  const game = renderState;
  const c = ctx;
  const now = performance.now();
  const view = getWorldViewBounds(game);
  const lighting = lightingEnabled(game);
  const revealSources = fogEnabled(game) || lighting ? fogRevealSources(game) : [];
  const renderLooseGroundItems = shouldRenderLooseGroundItems(game.camera?.zoom);
  const renderDecorativeDetails = shouldRenderDecorativeDetails(game.camera?.zoom);
  const renderBots = shouldRenderBots(game.camera?.zoom);
  prepareAnimationState(game, now, view, { renderLooseGroundItems });
  c.clearRect(0, 0, game.W, game.H);
  drawViewportBackdrop(game, c);

  c.save();
  c.scale(game.camera.zoom || 1, game.camera.zoom || 1);
  c.translate(-game.camera.x, -game.camera.y);
  drawMapBase(game, c, view, { renderDecorativeDetails });
  drawMapFeatures(game, c, view);
  drawGrid(game, c, view);
  drawZones(game, c, view);
  if (lighting) drawNightTint(game, c, view);
  if (lighting) drawStructureLightGlows(game, c, view);
  const visibleStructures = [];
  const visibleProjectiles = [];
  const visibleItems = [];
  const visibleMonsters = [];
  const visibleBots = [];
  const depthDrawables = [];
  const pushDepth = (kind, entity, draw, options = {}) => {
    depthDrawables.push(createDepthDrawable(kind, entity, draw, { ...options, order: depthDrawables.length }));
  };
  for (const hole of game.holes || []) if (circleInView(hole.x, hole.y, 24, view) && fogStaticVisible(game, hole.x, hole.y)) drawHole(game, c, hole);
  for (const rock of game.rocks || []) {
    if (!circleInView(rock.x, rock.y, (rock.radius || 18) + 16, view) || !fogStaticVisible(game, rock.x, rock.y)) continue;
    pushDepth('rock', rock, () => drawRock(c, rock));
  }
  for (const hemp of game.hempPlants || []) {
    if (!circleInView(hemp.x, hemp.y, (hemp.radius || 14) + 18, view) || !fogStaticVisible(game, hemp.x, hemp.y)) continue;
    pushDepth('hemp', hemp, () => drawHempPlant(game, c, hemp, now));
  }
  for (const structure of game.structures || []) {
    const fogPoint = structureFogPoint(structure);
    if (!rectInView(structure.x, structure.y, structure.w || 48, structure.h || 48, view) || !fogStaticVisible(game, fogPoint.x, fogPoint.y)) continue;
    visibleStructures.push(structure);
    pushDepth('structure', structure, () => drawStructure(game, c, structure, now));
  }
  for (const projectile of game.projectiles || []) {
    if (!circleInView(projectile.x, projectile.y, 18, view)) continue;
    if (!fogDynamicVisible(game, projectile.x, projectile.y)) continue;
    visibleProjectiles.push(projectile);
    pushDepth('projectile', projectile, () => drawProjectile(c, projectile));
  }
  if (renderLooseGroundItems) {
    for (const item of game.items || []) {
      if (!circleInView(item.x, item.y, 20, view) || !fogDynamicVisible(game, item.x, item.y)) continue;
      visibleItems.push(item);
      const bob = item._bob ?? Math.sin(now / 400 + item.bob) * 2;
      pushDepth('item', item, () => drawItem(game, c, item, now), { bob });
    }
  }
  for (const monster of game.monsters || []) {
    if ((monster.hp || 0) <= 0 || !circleInView(monster.x, monster.y, (monster.radius || 18) + 16, view)) continue;
    if (!fogDynamicVisible(game, monster.x, monster.y)) continue;
    visibleMonsters.push(monster);
    pushDepth('monster', monster, () => drawMonster(game, c, monster, now));
  }
  if (renderBots) {
    for (const bot of game.bots || []) {
      if (!circleInView(bot.x, bot.y, (bot.r || 11) + 18, view) || !fogDynamicVisible(game, bot.x, bot.y)) continue;
      visibleBots.push(bot);
      pushDepth('bot', bot, () => drawBot(game, c, bot, now));
    }
  }
  if (game.player.target && (!view || circleInView(game.player.target.x, game.player.target.y, 64, view))) drawPlayerTarget(game, c);
  if (!view || circleInView(game.player.x, game.player.y, (game.player.r || 13) + 42, view)) {
    pushDepth('player', game.player, () => drawPlayerActor(game, c, now));
  }
  if (!view || circleInView(game.assistant.x, game.assistant.y, 42, view)) {
    pushDepth('assistant', game.assistant, () => drawAssistant(c, game.assistant.x, game.assistant.y, now, game.assistant.facingX, game.assistant.facingY));
  }
  pushRemotePlayersToDepth(game, c, view, depthDrawables, now);
  const treeOccluders = { items: visibleItems, bots: visibleBots, monsters: visibleMonsters, structures: visibleStructures, projectiles: visibleProjectiles };
  for (const tree of game.trees || []) {
    if (!circleInView(tree.x, tree.y, getTreeDrawRadius(tree) + 18, view) || !fogStaticVisible(game, tree.x, tree.y)) continue;
    pushDepth('tree', tree, () => drawTree(game, c, tree, now, getTreeOpacity(game, tree, now, treeOccluders)));
  }
  for (const drawable of sortDepthDrawables(depthDrawables)) drawable.draw();
  drawPlacement(game, c);
  drawZoneDraft(game, c);
  drawFloaters(game, c, view);
  if (lighting) drawRevealSourceGlows(game, c, view, revealSources);
  drawFogOfWar(game, c, view, revealSources);
  c.restore();

  drawHud(game, c);
}

function drawViewportBackdrop(game, c) {
  const sky = c.createLinearGradient(0, 0, 0, game.H);
  sky.addColorStop(0, '#0a100d');
  sky.addColorStop(0.62, '#101712');
  sky.addColorStop(1, '#0b0f0d');
  c.fillStyle = sky;
  c.fillRect(0, 0, game.W, game.H);

  const glow = c.createRadialGradient(game.W * 0.26, game.H * 0.18, 0, game.W * 0.26, game.H * 0.18, Math.max(game.W, game.H) * 0.58);
  glow.addColorStop(0, 'rgba(116, 173, 112, .18)');
  glow.addColorStop(0.48, 'rgba(116, 173, 112, .05)');
  glow.addColorStop(1, 'rgba(116, 173, 112, 0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, game.W, game.H);
  const night = lightingEnabled(game) ? getNightAmount(game) : 0;
  if (night > 0.01) {
    c.fillStyle = `rgba(2, 8, 20, ${0.16 + night * 0.34})`;
    c.fillRect(0, 0, game.W, game.H);
    const moon = c.createRadialGradient(game.W * 0.78, game.H * 0.16, 0, game.W * 0.78, game.H * 0.16, Math.max(game.W, game.H) * 0.42);
    moon.addColorStop(0, `rgba(150, 190, 210, ${0.12 + night * 0.16})`);
    moon.addColorStop(1, 'rgba(150,190,210,0)');
    c.fillStyle = moon;
    c.fillRect(0, 0, game.W, game.H);
  }
}

function getNightAmount(game) { return clamp(game.dayNight?.nightAmount ?? 0, 0, 1); }
function lightingEnabled(game) { return game.lightingEffectsEnabled !== false; }
function isLightStructure(s) { return isLightEmittingStructure(s); }
function structureLightRadius(s) { return getFogStructureLightRadius(s); }
function fogRevealSources(game) {
  return buildFogRevealSources({ player: game.player, assistant: game.assistant, bots: game.bots, structures: game.structures, multiplayer: game.multiplayer });
}
function fogEnabled(game) { return !!game.fogOfWar?.enabled; }
function fogStaticVisible(game, x, y) {
  return !fogEnabled(game) || isPointCurrentlyVisible(game.fogOfWar, x, y) || isFogPointExplored(game.fogOfWar, x, y);
}
function fogDynamicVisible(game, x, y) {
  return !fogEnabled(game) || isPointCurrentlyVisible(game.fogOfWar, x, y);
}
function structureFogPoint(structure) {
  return { x: (structure.x || 0) + (structure.w || 48) / 2, y: (structure.y || 0) + (structure.h || 48) / 2 };
}
function fogLightOccluders(game, view) {
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
function drawStructureLightGlows(game, c, view) {
  const night = getNightAmount(game);
  for (const s of game.structures || []) {
    if (!isLightStructure(s)) continue;
    const center = structureFogPoint(s);
    if (!fogStaticVisible(game, center.x, center.y)) continue;
    const radius = structureLightRadius(s);
    if (view && !circleInView(s.x, s.y, radius + 24, view)) continue;
    const alpha = 0.08 + night * 0.34;
    c.save();
    c.globalCompositeOperation = 'screen';
    const glow = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
    glow.addColorStop(0, `rgba(255, 209, 113, ${alpha})`);
    glow.addColorStop(0.45, `rgba(211, 169, 95, ${alpha * 0.46})`);
    glow.addColorStop(1, 'rgba(211, 169, 95, 0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(s.x, s.y, radius, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}
function drawNightTint(game, c, view) {
  const night = getNightAmount(game);
  if (night <= 0.01) return;
  const clipped = getClippedMapView(game, view);
  if (!clipped) return;
  c.save();
  c.fillStyle = `rgba(2, 9, 19, ${0.07 + night * 0.24})`;
  c.fillRect(clipped.left, clipped.top, clipped.width, clipped.height);
  c.restore();
}
function drawRevealSourceGlows(game, c, view, revealSources = fogRevealSources(game)) {
  const night = getNightAmount(game);
  const sources = revealSources.filter(source => source.kind !== 'structure');
  if (!sources.length) return;
  c.save();
  c.globalCompositeOperation = 'screen';
  for (const source of sources) {
    const radius = clamp((source.radius || 160) * 0.42, 70, 150);
    if (view && !circleInView(source.x, source.y, radius + 16, view)) continue;
    const tint = source.kind === 'player' ? [255, 226, 150] : source.kind === 'assistant' ? [126, 194, 255] : [156, 220, 166];
    const alpha = 0.08 + night * (source.kind === 'player' ? 0.24 : 0.16);
    const glow = c.createRadialGradient(source.x, source.y, 0, source.x, source.y, radius);
    glow.addColorStop(0, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha})`);
    glow.addColorStop(0.55, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${alpha * 0.35})`);
    glow.addColorStop(1, `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, 0)`);
    c.fillStyle = glow;
    c.beginPath();
    c.arc(source.x, source.y, radius, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
function drawFogOfWar(game, c, view, revealSources = fogRevealSources(game)) {
  const clipped = getClippedMapView(game, view);
  if (!clipped) return;
  if (!fogEnabled(game)) return;
  const occluders = game.dynamicShadowsEnabled ? fogLightOccluders(game, clipped) : [];
  drawFogOfWarOverlay(c, { fog: game.fogOfWar, map: game.map, view: clipped, sources: revealSources, occluders, nightAmount: lightingEnabled(game) ? getNightAmount(game) : 0 });
}

function drawMapBase(game, c, view, { renderDecorativeDetails = true } = {}) {
  const clipped = getClippedMapView(game, view);
  if (!clipped) return;
  const base = getStaticMapBase(game, c, { renderDecorativeDetails });
  c.drawImage(base, clipped.left, clipped.top, clipped.width, clipped.height, clipped.left, clipped.top, clipped.width, clipped.height);
}

function getStaticMapBase(game, c, { renderDecorativeDetails = true } = {}) {
  const width = game.map.width;
  const height = game.map.height;
  const detailKey = renderDecorativeDetails ? 'details' : 'no-details';
  const key = `${width}x${height}:${detailKey}`;
  const cached = staticMapBaseCache.get(key);
  if (cached && cached.width === width && cached.height === height) return cached.canvas;

  const canvas = createCanvasLayer(width, height, c);
  const layer = canvas.getContext('2d');
  renderStaticMapBase(game, layer, { renderDecorativeDetails });
  staticMapBaseCache.set(key, { canvas, width, height });
  return canvas;
}

function createCanvasLayer(width, height, c) {
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

function renderStaticMapBase(game, c, { renderDecorativeDetails = true } = {}) {
  const width = game.map.width;
  const height = game.map.height;
  const base = c.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#325936');
  base.addColorStop(0.28, '#25482d');
  base.addColorStop(0.62, '#1e3826');
  base.addColorStop(1, '#14251b');
  c.fillStyle = base;
  c.fillRect(0, 0, width, height);

  const sunlight = c.createRadialGradient(width * .18, height * .15, 0, width * .18, height * .15, width * .64);
  sunlight.addColorStop(0, 'rgba(177, 211, 104, .28)');
  sunlight.addColorStop(.48, 'rgba(106, 156, 74, .09)');
  sunlight.addColorStop(1, 'rgba(106, 156, 74, 0)');
  c.fillStyle = sunlight;
  c.fillRect(0, 0, width, height);

  c.save();
  drawPainterlyGroundPatches(c, width, height);
  drawLushStream(c, width, height);
  drawGoldenTrail(c, width, height);
  if (renderDecorativeDetails) drawTerrainSprites(c, width, height);
  c.restore();

  const vignette = c.createRadialGradient(width * .48, height * .42, width * .08, width * .48, height * .42, width * .72);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(.58, 'rgba(13, 28, 18, 0)');
  vignette.addColorStop(1, 'rgba(8, 15, 11, .38)');
  c.fillStyle = vignette;
  c.fillRect(0, 0, width, height);
}


function drawMapFeatures(game, c, view) {
  for (const feature of game.mapFeatures || []) {
    if (feature.type === 'road') {
      if (polylineFeatureInView(feature, view)) drawRoadFeature(c, feature);
    }
    if (feature.type === 'parking_lot') {
      const w = feature.w || 340;
      const h = feature.h || 180;
      if (rectInView(feature.x - w / 2 - 40, feature.y - h / 2 - 40, w + 80, h + 80, view)) drawParkingLotFeature(c, feature);
    }
    if (feature.type === 'lake') {
      const rx = feature.rx || 210;
      const ry = feature.ry || 120;
      if (circleInView(feature.x, feature.y, Math.max(rx, ry) + 32, view)) drawLakeFeature(c, feature);
    }
    if (feature.type === 'camper_van') {
      const w = feature.w || 118;
      const h = feature.h || 58;
      if (rectInView(feature.x - w / 2 - 24, feature.y - h / 2 - 32, w + 48, h + 64, view)) drawCamperVanFeature(c, feature);
    }
  }
}

function polylineFeatureInView(feature, view, padding = 140) {
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

function drawRoadFeature(c, feature) {
  const points = feature.points || [];
  if (points.length < 2) return;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(14, 17, 15, .86)';
  c.lineWidth = (feature.width || 86) + 22;
  drawPolyline(c, points);
  c.strokeStyle = 'rgba(47, 51, 46, .96)';
  c.lineWidth = feature.width || 86;
  drawPolyline(c, points);
  c.strokeStyle = 'rgba(112, 119, 108, .28)';
  c.lineWidth = 3;
  c.setLineDash([34, 28]);
  drawPolyline(c, points);
  c.restore();
}

function drawPolyline(c, points) {
  c.beginPath();
  points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y));
  c.stroke();
}

function drawParkingLotFeature(c, feature) {
  c.save();
  const w = feature.w || 340;
  const h = feature.h || 180;
  c.translate(feature.x, feature.y);
  c.rotate(feature.rotation || 0);
  drawShadow(c, 0, h * .1, w * .54, h * .24, .22);
  c.fillStyle = 'rgba(38, 43, 40, .95)';
  c.strokeStyle = 'rgba(197, 211, 192, .34)';
  c.lineWidth = 4;
  roundedRect(c, -w / 2, -h / 2, w, h, 18);
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(220, 231, 210, .48)';
  c.lineWidth = 2;
  for (let x = -w * .34; x <= w * .34; x += w * .17) {
    c.beginPath(); c.moveTo(x, -h * .36); c.lineTo(x - 22, h * .36); c.stroke();
  }
  c.strokeStyle = 'rgba(211, 169, 95, .35)';
  c.beginPath(); c.moveTo(-w * .44, 0); c.lineTo(w * .44, 0); c.stroke();
  c.restore();
}

function drawLakeFeature(c, feature) {
  c.save();
  const rx = feature.rx || 210;
  const ry = feature.ry || 120;
  const rotation = feature.rotation ?? (feature.ownerId === 'p2' ? -0.18 : 0.18);
  drawShadow(c, feature.x, feature.y + ry * .22, rx * .84, ry * .24, .2);
  c.beginPath();
  c.ellipse(feature.x, feature.y, rx, ry, rotation, 0, Math.PI * 2);
  c.clip();
  const water = c.createRadialGradient(feature.x - rx * .2, feature.y - ry * .28, 16, feature.x, feature.y, rx * 1.02);
  water.addColorStop(0, '#8bcfc8');
  water.addColorStop(.32, '#4fa0a3');
  water.addColorStop(.7, '#2f7888');
  water.addColorStop(1, '#174756');
  c.fillStyle = water;
  c.fillRect(feature.x - rx, feature.y - ry, rx * 2, ry * 2);
  if (feature.glow === 'green') {
    const glow = c.createRadialGradient(feature.x, feature.y + ry * .08, 0, feature.x, feature.y + ry * .08, feature.glowRadius || rx * .78);
    glow.addColorStop(0, `rgba(117, 255, 142, ${feature.glowAlpha || .62})`);
    glow.addColorStop(.34, 'rgba(56, 214, 106, .34)');
    glow.addColorStop(.72, 'rgba(21, 132, 77, .15)');
    glow.addColorStop(1, 'rgba(21, 132, 77, 0)');
    c.fillStyle = glow;
    c.fillRect(feature.x - rx, feature.y - ry, rx * 2, ry * 2);
  }
  c.strokeStyle = 'rgba(210, 244, 235, .46)';
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(feature.x, feature.y, rx, ry, rotation, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(227, 248, 240, .24)';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(feature.x, feature.y, rx * .92, ry * .86, rotation, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = 'rgba(235, 252, 248, .18)';
  for (let i = -1; i <= 1; i++) {
    c.beginPath();
    c.ellipse(feature.x + i * rx * .17, feature.y + i * 7, rx * (.5 - Math.abs(i) * .08), ry * .2, rotation, 0.15, Math.PI - 0.15);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,.06)';
  c.beginPath();
  c.ellipse(feature.x - rx * .18, feature.y - ry * .2, rx * .38, ry * .13, rotation, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function prepareAnimationState(game, now, view, { renderLooseGroundItems = true } = {}) {
  if (renderLooseGroundItems) {
    for (const item of game.items || []) {
      if (view && !circleInView(item.x, item.y, 20, view)) continue;
      item._bob = Math.sin(now / 400 + item.bob) * 2;
    }
  }
  for (const hemp of game.hempPlants || []) {
    if (view && !circleInView(hemp.x, hemp.y, (hemp.radius || 14) + 18, view)) continue;
    hemp._sway = Math.sin(now / 550 + hemp.x * .05) * 2;
  }
  for (const monster of game.monsters || []) {
    if (view && !circleInView(monster.x, monster.y, (monster.radius || 18) + 16, view)) continue;
    monster._wobble = Math.sin(now / 520 + (monster.phase || 0)) * 2;
  }
  for (const tree of game.trees || []) {
    if (view && !circleInView(tree.x, tree.y, getTreeDrawRadius(tree) + 18, view)) continue;
    const stage = tree.growthStage || 'grown_tree';
    tree._sway = Math.sin(now / 1100 + tree.x * .017) * (stage === 'sapling' ? 1.5 : 2.5);
  }
}

function getWorldViewBounds(game, padding = 120) {
  const zoom = game.camera.zoom || 1;
  const pad = padding / zoom;
  return {
    left: game.camera.x - pad,
    top: game.camera.y - pad,
    right: game.camera.x + (game.W / zoom) + pad,
    bottom: game.camera.y + (game.H / zoom) + pad
  };
}

function getClippedMapView(game, view) {
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

function circleInView(x, y, radius, view) {
  return x + radius >= view.left && x - radius <= view.right && y + radius >= view.top && y - radius <= view.bottom;
}

function rectInView(x, y, w, h, view) {
  return x + w >= view.left && x <= view.right && y + h >= view.top && y <= view.bottom;
}

function drawCamperVanFeature(c, feature) {
  c.save();
  c.translate(feature.x, feature.y);
  c.rotate(feature.rotation || 0);
  if (feature.flipX) c.scale(-1, 1);
  drawShadow(c, 0, 26, (feature.w || 118) * .55, 14, .28);
  const w = feature.w || 118;
  const h = feature.h || 58;
  c.fillStyle = '#d7d0b4';
  c.strokeStyle = '#17221c';
  c.lineWidth = 3;
  roundedRect(c, -w / 2, -h / 2, w, h, 16);
  c.fill(); c.stroke();
  c.fillStyle = '#345862';
  roundedRect(c, -w * .28, -h * .22, w * .28, h * .34, 7); c.fill();
  roundedRect(c, w * .05, -h * .22, w * .26, h * .34, 7); c.fill();
  c.fillStyle = '#7d512f';
  roundedRect(c, -w * .47, -h * .04, w * .16, h * .34, 5); c.fill();
  c.fillStyle = '#101612';
  c.beginPath(); c.arc(-w * .28, h * .42, 10, 0, Math.PI * 2); c.arc(w * .32, h * .42, 10, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#f0e7c6'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-w * .45, -h * .36); c.lineTo(w * .42, -h * .36); c.stroke();
  c.restore();
  drawNameTag(c, feature.label || 'camper van', feature.x, feature.y - (feature.h || 58) - 18);
}

function drawPainterlyGroundPatches(c, width, height) {
  const patches = [
    ['#4f7d3d', .22, 92, 32, -0.25, 28, 128, 176],
    ['#78a24b', .16, 64, 18, 0.38, 82, 154, 218],
    ['#1b3322', .20, 118, 38, -0.12, 140, 214, 284],
    ['#9aa64f', .11, 46, 13, 0.18, 24, 92, 168]
  ];
  for (const [color, alpha, rx, ry, rotation, offsetX, stepY, stepX] of patches) {
    c.fillStyle = color;
    c.globalAlpha = alpha;
    for (let y = offsetX; y < height + 60; y += stepY) {
      for (let x = (offsetX * 3 + ((y / stepY) % 2) * 67) % stepX; x < width + 80; x += stepX) {
        const jitter = terrainNoise(x, y) - .5;
        c.beginPath();
        c.ellipse(x + jitter * 28, y + jitter * 22, rx * (.72 + terrainNoise(y, x) * .55), ry * (.7 + terrainNoise(x + 99, y) * .5), rotation + jitter * .25, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  c.globalAlpha = 1;
}

function drawLushStream(c, width, height) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const stream = c.createLinearGradient(0, 0, width, height);
  stream.addColorStop(0, 'rgba(86, 151, 130, .34)');
  stream.addColorStop(.55, 'rgba(58, 116, 104, .24)');
  stream.addColorStop(1, 'rgba(34, 75, 77, .18)');
  c.strokeStyle = stream;
  c.lineWidth = 58;
  c.beginPath();
  c.moveTo(width * .03, height * .78);
  c.bezierCurveTo(width * .18, height * .60, width * .28, height * .70, width * .42, height * .50);
  c.bezierCurveTo(width * .56, height * .30, width * .70, height * .42, width * .96, height * .16);
  c.stroke();
  c.strokeStyle = 'rgba(181, 224, 178, .16)';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(width * .08, height * .74);
  c.bezierCurveTo(width * .28, height * .62, width * .33, height * .62, width * .48, height * .46);
  c.bezierCurveTo(width * .61, height * .33, width * .76, height * .39, width * .91, height * .22);
  c.stroke();
  c.restore();
}

function drawGoldenTrail(c, width, height) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(151, 112, 55, .22)';
  c.lineWidth = 34;
  c.beginPath();
  c.moveTo(80, height - 130);
  c.bezierCurveTo(350, 520, 640, 760, width - 120, 250);
  c.stroke();
  c.strokeStyle = 'rgba(231, 188, 91, .12)';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(120, height - 155);
  c.bezierCurveTo(420, 585, 670, 700, width - 170, 285);
  c.stroke();
  c.restore();
}

function drawTerrainSprites(c, width, height) {
  c.save();
  c.lineCap = 'round';
  for (let y = 34; y < height; y += 66) {
    for (let x = 24 + ((y / 66) % 2) * 31; x < width; x += 78) {
      const n = terrainNoise(x, y);
      if (n < .28) continue;
      const bladeCount = n > .82 ? 5 : 3;
      c.strokeStyle = n > .66 ? 'rgba(152, 196, 92, .34)' : 'rgba(83, 143, 72, .28)';
      c.lineWidth = n > .72 ? 2 : 1.2;
      for (let i = 0; i < bladeCount; i++) {
        const bx = x + (i - 2) * 4 + (terrainNoise(y + i * 17, x) - .5) * 9;
        const by = y + (terrainNoise(x + i * 23, y) - .5) * 12;
        const lean = (terrainNoise(bx, by) - .5) * 10;
        c.beginPath();
        c.moveTo(bx, by + 8);
        c.quadraticCurveTo(bx + lean * .35, by, bx + lean, by - 10 - n * 6);
        c.stroke();
      }
      if (n > .91) {
        c.fillStyle = 'rgba(232, 199, 91, .64)';
        c.beginPath();
        c.arc(x + 10, y - 8, 2.3, 0, Math.PI * 2);
        c.fill();
      }
      if (n > .96) {
        c.fillStyle = 'rgba(220, 234, 160, .44)';
        c.beginPath();
        c.ellipse(x - 14, y + 12, 9, 4, -.4, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  c.restore();
}

function terrainNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawGrid(game, c, view) {
  if (view) return;
  c.save();
  c.strokeStyle = 'rgba(232, 239, 232, .022)';
  c.lineWidth = 1;
  for (let x = 0; x <= game.map.width; x += 48) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, game.map.height); c.stroke();
  }
  for (let y = 0; y <= game.map.height; y += 48) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(game.map.width, y); c.stroke();
  }
  c.strokeStyle = 'rgba(211,169,95,.18)';
  c.lineWidth = 2;
  c.strokeRect(0, 0, game.map.width, game.map.height);
  c.restore();
}

function drawZones(game, c, view) {
  c.save();
  c.font = '700 12px system-ui';
  c.textAlign = 'left';
  for (const z of game.zones || []) {
    if (z.hidden) continue;
    if (view && !zoneInView(z, view)) continue;
    const hover = game.mouse.hoverZone === z;
    const fill = z.builtIn ? 'rgba(134, 184, 117, .075)' : 'rgba(211, 169, 95, .105)';
    const stroke = hover ? 'rgba(255, 244, 208, .9)' : (z.builtIn ? 'rgba(134, 184, 117, .42)' : 'rgba(211, 169, 95, .55)');
    c.fillStyle = fill;
    c.strokeStyle = stroke;
    c.lineWidth = hover ? 2.5 : 1.3;
    c.setLineDash([8, 7]);
    if (z.kind === 'radius') { c.beginPath(); c.arc(z.x, z.y, z.radius || 150, 0, Math.PI * 2); c.fill(); c.stroke(); drawPill(c, z.name, z.x + 8, z.y - (z.radius || 150) - 18, z.color || '#9abf8f'); }
    else { roundedRect(c, z.x, z.y, z.w, z.h, 14); c.fill(); c.stroke(); drawPill(c, z.name, z.x + 8, z.y + 8, z.color || '#9abf8f'); }
    c.setLineDash([]);
    if (!z.builtIn && hover) drawZoneResizeHandles(c, z);
  }
  c.restore();
}

function drawRock(c, r) {
  c.save();
  c.globalAlpha = r.depleted ? .38 : 1;
  drawShadow(c, r.x, r.y + r.radius * .72, r.radius * 1.15, r.radius * .34, .26);
  const grad = c.createLinearGradient(r.x - r.radius, r.y - r.radius, r.x + r.radius, r.y + r.radius);
  grad.addColorStop(0, r.depleted ? '#555c58' : '#a9b0aa');
  grad.addColorStop(1, r.depleted ? '#313733' : '#5d6761');
  c.fillStyle = grad;
  c.strokeStyle = r.depleted ? '#6c746f' : '#d2d8d3';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(r.x - r.radius, r.y + 6);
  c.lineTo(r.x - 9, r.y - r.radius);
  c.lineTo(r.x + 12, r.y - r.radius + 2);
  c.lineTo(r.x + r.radius, r.y + 7);
  c.lineTo(r.x + 4, r.y + r.radius);
  c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.22)';
  c.beginPath(); c.moveTo(r.x - 6, r.y - r.radius + 5); c.lineTo(r.x + 8, r.y + 4); c.stroke();
  if (!r.depleted) drawBar(c, r.x - 18, r.y - r.radius - 13, 36, 5, r.hp / r.maxHp, '#d0bf86');
  c.restore();
}

function drawHole(game, c, h) {
  c.save();
  const hover = game.mouse.hoverHole === h;
  const r = h.radius || 13;
  drawShadow(c, h.x, h.y + 2, r + 8, r * .62, .26);
  const grad = c.createRadialGradient(h.x, h.y, 2, h.x, h.y, r + 7);
  grad.addColorStop(0, h.planted ? '#27442b' : '#050806');
  grad.addColorStop(1, h.planted ? '#5b7445' : '#5d422b');
  c.fillStyle = grad;
  c.strokeStyle = hover ? '#fff4d0' : (h.planted ? '#8bbd76' : '#8a6842');
  c.lineWidth = hover ? 3 : 2;
  c.beginPath();
  c.ellipse(h.x, h.y, r + 6, r + 1, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  if (hover) {
    c.strokeStyle = 'rgba(255, 244, 208, .72)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(h.x, h.y, r + 11, r + 6, 0, 0, Math.PI * 2);
    c.stroke();
    drawNameTag(c, h.planted ? 'planted hole' : 'dug hole', h.x, h.y - 24);
  }
  c.restore();
}

function drawZoneResizeHandles(c, z) {
  const handles = z.kind === 'radius'
    ? [{ x: z.x + (z.radius || 150), y: z.y }]
    : [{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y }, { x: z.x, y: z.y + z.h }, { x: z.x + z.w, y: z.y + z.h }];
  c.save();
  c.fillStyle = '#fff4d0';
  c.strokeStyle = '#1a211e';
  c.lineWidth = 1.5;
  for (const h of handles) { roundedRect(c, h.x - 5, h.y - 5, 10, 10, 3); c.fill(); c.stroke(); }
  c.restore();
}

function zoneInView(zone, view) {
  if (zone.kind === 'radius') return circleInView(zone.x, zone.y, (zone.radius || 150) + 28, view);
  return rectInView(zone.x, zone.y, zone.w || 0, zone.h || 0, view);
}

function drawTree(game, c, t, now, opacity = 1) {
  c.save();
  c.globalAlpha = opacity;
  const hover = game.mouse.hoverTree === t;
  drawShadow(c, t.x, t.y + (t.radius || 20) * .8, (t.radius || 20) * 1.15, (t.radius || 20) * .34, .24);
  if (t.stump) {
    c.globalAlpha = opacity * .7;
    drawTrunk(c, t.x, t.y + 3, 14, 22, '#7b512c');
    c.strokeStyle = hover ? '#fff4d0' : '#a67948';
    c.lineWidth = hover ? 3 : 1;
    c.beginPath(); c.ellipse(t.x, t.y, t.radius, t.radius * .55, 0, 0, Math.PI * 2); c.stroke();
    if (hover) drawNameTag(c, 'tree stump', t.x, t.y - 26);
    c.restore();
    return;
  }
  const stage = t.growthStage || 'grown_tree';
  const sway = t._sway ?? Math.sin(now / 1100 + t.x * .017) * (stage === 'sapling' ? 1.5 : 2.5);
  if (stage === 'sapling') {
    c.strokeStyle = '#9abf8f';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(t.x, t.y + 10); c.quadraticCurveTo(t.x + sway, t.y, t.x + sway, t.y - 10); c.stroke();
    leafBlob(c, t.x - 6 + sway, t.y - 6, 6, '#78aa68');
    leafBlob(c, t.x + 6 + sway, t.y - 8, 6, '#9ac887');
    if (hover) {
      c.strokeStyle = '#fff4d0';
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(t.x, t.y - 1, 15, 19, 0, 0, Math.PI * 2);
      c.stroke();
      drawNameTag(c, 'small sapling', t.x, t.y - 24);
    }
    c.restore();
    return;
  }
  drawTrunk(c, t.x, t.y + 13, stage === 'small_tree' ? 10 : 13, stage === 'small_tree' ? 25 : 34, '#7d522d');
  const radius = stage === 'small_tree' ? Math.max(18, t.radius) : t.radius;
  leafBlob(c, t.x - 10 + sway, t.y - 2, radius * .82, '#2f5737');
  leafBlob(c, t.x + 13 + sway, t.y - 4, radius * .74, '#426d42');
  leafBlob(c, t.x + sway, t.y - 17, radius * .9, stage === 'small_tree' ? '#4f824e' : '#37643b');
  leafBlob(c, t.x + 1 + sway, t.y + 7, radius * .7, '#274b31');
  c.strokeStyle = 'rgba(227, 238, 225, .35)';
  c.lineWidth = 1;
  c.beginPath(); c.arc(t.x + sway, t.y - 7, radius * .95, -2.2, -.4); c.stroke();
  if (hover) {
    c.strokeStyle = '#fff4d0';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(t.x, t.y - 2, radius + 8, radius + 10, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255, 244, 208, .08)';
    c.fill();
  }
  drawBar(c, t.x - 18, t.y - radius - 16, 36, 5, t.hp / t.maxHp, '#9abf8f');
  if (hover) drawNameTag(c, stage === 'small_tree' ? 'small tree' : 'grown tree', t.x, t.y - radius - 28);
  c.restore();
}

function getTreeOpacity(game, tree, now, occluders = null) {
  return treeWouldOccludeDrawnObject(game, tree, now, occluders) ? .82 : 1;
}

function treeWouldOccludeDrawnObject(game, tree, now, occluders = null) {
  const treeRadius = getTreeDrawRadius(tree);
  const treeHeightFactor = tree.stump ? .58 : (tree.growthStage === 'sapling' ? .8 : .95);
  const treeCenterY = tree.y - treeRadius * .12;
  const checkCircle = (x, y, radius) => circlesOverlap(tree.x, treeCenterY, treeRadius, x, y, radius);
  const checkRect = (x, y, w, h) => circleIntersectsRect(tree.x, treeCenterY, treeRadius, x - w / 2, y - h / 2, w, h);

  for (const item of occluders?.items || game.items || []) {
    const bob = item._bob ?? Math.sin(now / 400 + item.bob) * 2;
    if (checkCircle(item.x, item.y + bob, 11)) return true;
  }
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

function getTreeDrawRadius(tree) {
  if (tree.stump) return Math.max(12, tree.radius || 20);
  if (tree.growthStage === 'sapling') return Math.max(10, tree.radius || 12);
  if (tree.growthStage === 'small_tree') return Math.max(18, tree.radius || 18);
  return Math.max(22, tree.radius || 22);
}

function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const limit = ar + br;
  return dx * dx + dy * dy <= limit * limit;
}

function circleIntersectsRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearestX = clamp(cx, rx, rx + rw);
  const nearestY = clamp(cy, ry, ry + rh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= cr * cr;
}

function drawHempPlant(game, c, h, now) {
  if (h.harvested) return;
  const hover = game.mouse.hoverHemp === h;
  const sway = h._sway ?? Math.sin(now / 550 + h.x * .05) * 2;
  c.save();
  drawShadow(c, h.x, h.y + 9, 16, 5, .2);
  c.strokeStyle = hover ? '#fff4d0' : '#89b879';
  c.lineWidth = hover ? 3 : 2;
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(h.x + i * 4, h.y + 11);
    c.quadraticCurveTo(h.x + i * 5 + sway, h.y - 3, h.x + i * 7 + sway, h.y - 16 - Math.abs(i) * 2);
    c.stroke();
  }
  c.fillStyle = h.searched ? '#6f9b5f' : '#9ac887';
  c.beginPath(); c.ellipse(h.x + sway, h.y - 5, h.radius || 13, 9, -.35, 0, Math.PI * 2); c.fill();
  if (hover) drawNameTag(c, h.searched ? 'searched hemp' : 'hemp plant', h.x, h.y - 28);
  c.restore();
}

function drawStructure(game, c, s, now) {
  const hover = game.mouse.hoverStructure === s;
  const def = BUILDING_TYPES[s.type] || { color: '#6b766f' };
  c.save();
  if (s.rangedAttack && hover) {
    c.save();
    c.strokeStyle = 'rgba(211,169,95,.32)';
    c.lineWidth = 2;
    c.setLineDash([8, 9]);
    c.beginPath(); c.arc(s.x, s.y, s.rangedAttack.range || 260, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  drawShadow(c, s.x, s.y + s.h * .42, s.w * .56, s.h * .18, .28);
  drawBuildingAsset(c, s, def, { hover, now });

  if (hover) {
    c.font = '700 12px system-ui';
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(3, 6, 5, .72)';
    c.fillStyle = '#f5faf6';
    c.strokeText(s.name, s.x, s.y + 5);
    c.fillText(s.name, s.x, s.y + 5);
    c.font = '11px system-ui';
    c.fillStyle = '#ffe3a7';
    const line = s.type === 'throne'
      ? `${s.ownerLabel || 'player'} · ${Math.max(0, Math.ceil(s.hp ?? 0))}/${s.maxHp || 120} HP`
      : ['item_palette', 'power_station', 'robotics_parts_bin'].includes(s.type)
        ? `${s.storageType || 'empty'} ${s.stored || 0}/${s.capacity || 0}`
      : ['camper_van', 'hammock_camp', 'ultrabook_desk', 'solar_array', 'portable_3d_printer', 'assembler'].includes(s.type)
        ? (s.label || 'story object')
      : s.type === 'workbench'
        ? `S${s.sticks || 0} R${s.stones || 0} ${(s.workbenchRecipe || 'crude_axe').replace('crude_', '')}`
        : s.type === 'factory'
          ? `L${s.logs || 0} P${s.planks || 0} Po${s.poles || 0} Se${s.tree_seeds || 0}`
          : s.type === 'smithery'
            ? `S${s.sticks || 0} P${s.planks || 0} ${(s.smitheryRecipe || 'wooden_sword').replace('wooden_', '')}`
            : s.type === 'bowmaker'
              ? `S${s.sticks || 0}/2 H${s.hemps || 0}/3 B${s.bows || 0}`
              : s.type === 'defensetower'
                ? `R${s.rangedAttack?.range || 260} · ${s.rangedAttack?.damage || 1}/s`
                : `L${s.logs || 0} P${s.planks || 0} Po${s.poles || 0}`;
    c.strokeText(line, s.x, s.y + 22);
    c.fillText(line, s.x, s.y + 22);
    if (s.type === 'throne') drawBar(c, s.x - 42, s.y + s.h / 2 + 8, 84, 7, Math.max(0, s.hp || 0) / Math.max(1, s.maxHp || 120), s.ownerId === 'p1' ? '#80a9c9' : '#c86b5f');
    if (s.processing) drawBar(c, s.x - 28, s.y + s.h / 2 + 8, 56, 6, 1 - Math.max(0, s.processing.remaining || 0) / Math.max(0.1, s.processing.total || 1), '#d3a95f');
  }
  c.restore();
}

function drawProjectile(c, p) {
  if (!p) return;
  const angle = Math.atan2(p.vy || 0, p.vx || 1);
  c.save();
  c.translate(p.x, p.y);
  c.rotate(angle);
  c.strokeStyle = '#f1dfb8';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke();
  c.fillStyle = '#d3a95f';
  c.beginPath(); c.moveTo(10, 0); c.lineTo(3, -3); c.lineTo(3, 3); c.closePath(); c.fill();
  c.restore();
}

function drawItem(game, c, i, now) {
  const hover = game.mouse.hoverItem === i;
  const bob = i._bob ?? Math.sin(now / 400 + i.bob) * 2;
  c.save();
  c.translate(i.x, i.y + bob);
  drawShadow(c, 0, 9, 11, 4, .24);
  if (hover) {
    c.fillStyle = 'rgba(255,244,208,.20)';
    c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff4d0'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.stroke();
  }
  drawItemAsset(c, i.type);
  if (hover) drawNameTag(c, itemLabel(i.type), 0, -24);
  c.restore();
}

function drawMonster(game, c, m, now) {
  const hover = game.mouse.hoverMonster === m;
  const r = m.radius || 18;
  const wobble = m._wobble ?? Math.sin(now / 520 + (m.phase || 0)) * 2;
  c.save();
  drawShadow(c, m.x, m.y + r * .7, r * 1.1, r * .34, .27);
  c.translate(m.x, m.y + wobble);
  c.fillStyle = hover ? 'rgba(255,244,208,.18)' : 'rgba(0,0,0,0)';
  if (hover) { c.beginPath(); c.arc(0, 0, r + 8, 0, Math.PI * 2); c.fill(); }
  const body = c.createRadialGradient(-r * .25, -r * .35, 2, 0, 0, r * 1.15);
  if (m.type === 'night_monster') {
    body.addColorStop(0, '#d3a95f');
    body.addColorStop(0.42, '#6b3f2f');
    body.addColorStop(1, '#17201d');
  } else {
    body.addColorStop(0, '#8fb9b5');
    body.addColorStop(1, '#344d47');
  }
  c.fillStyle = body;
  c.strokeStyle = hover ? '#fff4d0' : (m.type === 'night_monster' ? '#070908' : '#0d1714');
  c.lineWidth = hover ? 3 : 2;
  c.beginPath();
  c.ellipse(0, 0, r, r * .82, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  c.fillStyle = m.type === 'night_monster' ? '#ffd982' : '#e5ece8';
  c.beginPath(); c.arc(-r * .33, -r * .1, 3.2, 0, Math.PI * 2); c.arc(r * .33, -r * .1, 3.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#16211d';
  c.beginPath(); c.arc(-r * .33, -r * .1, 1.4, 0, Math.PI * 2); c.arc(r * .33, -r * .1, 1.4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(229,236,232,.45)';
  c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, r * .14, r * .25, .15, Math.PI - .15); c.stroke();
  c.restore();
  drawBar(c, m.x - 20, m.y - r - 16, 40, 5, (m.hp || 0) / Math.max(1, m.maxHp || 10), '#8fb9b5');
  if (hover) drawNameTag(c, `${m.name || 'passive monster'} · ${m.hp || 0}/${m.maxHp || 10} hp`, m.x, m.y - r - 28);
}

function drawDogBot(game, c, b, now) {
  const hover = game.mouse.hoverBot === b;
  const r = b.r || 12;
  const bob = Math.sin(now / 180 + (b.id || 0)) * 1.8;
  const facingRight = (b.facingX ?? 1) >= 0;
  c.save();
  drawShadow(c, b.x, b.y + r + 6, r + 9, 5, .25);
  c.translate(b.x, b.y + bob);
  if (hover) {
    c.beginPath();
    c.fillStyle = 'rgba(255,244,208,.15)';
    c.arc(0, 0, r + 10, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#8a6246';
  c.strokeStyle = hover ? '#fff4d0' : '#3c281f';
  c.lineWidth = hover ? 3 : 2;
  roundedRect(c, -r - 3, -r + 2, (r + 3) * 2, r * 1.45, 8);
  c.fill();
  c.stroke();
  c.fillStyle = '#9d7457';
  c.beginPath();
  c.ellipse(0, -r * .2, r * .95, r * .78, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  const earSide = facingRight ? 1 : -1;
  c.fillStyle = '#6f4b35';
  c.beginPath();
  c.moveTo(-r * .45 * earSide, -r * .75);
  c.lineTo(-r * .8 * earSide, -r * 1.35);
  c.lineTo(-r * .15 * earSide, -r * 1.05);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(r * .18 * earSide, -r * .7);
  c.lineTo(r * .55 * earSide, -r * 1.25);
  c.lineTo(r * .02 * earSide, -r * .96);
  c.closePath();
  c.fill();
  c.fillStyle = '#1b120f';
  c.beginPath();
  c.arc(-r * .22 * earSide, -r * .15, 1.8, 0, Math.PI * 2);
  c.arc(r * .16 * earSide, -r * .15, 1.8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e5ece8';
  c.beginPath();
  c.arc(r * .42 * earSide, -r * .02, 2.7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#bfe6c5';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-r * .45, r * .45);
  c.lineTo(-r * .95, r * .85);
  c.lineTo(-r * .68, r * .2);
  c.stroke();
  c.fillStyle = '#d7e8cf';
  c.font = '800 9px system-ui';
  c.textAlign = 'center';
  c.fillText(b.name || 'Dog', 0, r + 14);
  if (b.inventory) drawMiniItem(c, 0, -r * 1.75, b.inventory.type);
  if (hover) drawNameTag(c, `${b.name || 'Dog'} · fetch helper`, b.x, b.y - r - 28);
  c.restore();
}

function drawBot(game, c, b, now) {
  if (b.kind === 'dog') return drawDogBot(game, c, b, now);
  const hover = game.mouse.hoverBot === b;
  const inventoryIsHandTool = isBotHandTool(b.inventory?.type);
  const facingRight = (b.facingX ?? 1) >= 0;
  const handToolTypes = [b.tool?.type, inventoryIsHandTool ? b.inventory.type : null].filter(Boolean);
  c.save();
  drawShadow(c, b.x, b.y + b.r + 5, b.r + 8, 5, .26);
  const pulse = hover ? Math.sin(now / 160) * 1.5 : 0;
  c.fillStyle = b.color;
  c.strokeStyle = hover ? '#fff4d0' : '#0e1512';
  c.lineWidth = hover ? 4 : 2;
  roundedRect(c, b.x - b.r - 2 - pulse, b.y - b.r - 2 - pulse, (b.r + 2 + pulse) * 2, (b.r + 2 + pulse) * 2, 8);
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.22)';
  roundedRect(c, b.x - b.r + 2, b.y - b.r + 2, b.r * 1.4, b.r * .58, 5); c.fill();
  c.fillStyle = '#06100d';
  c.font = '800 10px system-ui';
  c.textAlign = 'center';
  c.fillText(b.id, b.x, b.y + 3);
  if (b.inventory && !inventoryIsHandTool) drawMiniItem(c, b.x - 1, b.y - 24, b.inventory.type);
  handToolTypes.slice(0, 2).forEach((type, index) => {
    const side = (index === 0 ? 1 : -1) * (facingRight ? 1 : -1);
    drawHeldToolAsset(c, b.x + side * (b.r + 8), b.y + 5 + index * 2, type);
  });
  if (b.equipment?.weapon) drawHeldToolAsset(c, b.x + 17, b.y - 5, b.equipment.weapon);
  if (b.equipment?.shield) drawHeldToolAsset(c, b.x - 17, b.y - 7, b.equipment.shield);
  drawAmmoBadge(c, b, b.x, b.y + b.r + 16);
  if (hover) drawNameTag(c, b.name || `Bot ${b.id}`, b.x, b.y - b.r - 24);
  c.restore();
}

function pushRemotePlayersToDepth(game, c, view, depthDrawables, now) {
  const players = game.multiplayer?.players || {};
  const localId = game.multiplayer?.playerId;
  for (const player of Object.values(players)) {
    if (!player || player.id === localId || player.disconnected) continue;
    if (view && !circleInView(player.x, player.y, 52, view)) continue;
    depthDrawables.push(createDepthDrawable('remote_player', player, () => drawRemotePlayer(game, c, player), { order: depthDrawables.length }));
  }
}

function drawRemotePlayers(game, c, now, view) {
  const depthDrawables = [];
  pushRemotePlayersToDepth(game, c, view, depthDrawables, now);
  for (const drawable of sortDepthDrawables(depthDrawables)) drawable.draw();
}

function drawRemotePlayer(game, c, player) {
  c.save();
  drawShadow(c, player.x, player.y + 18, 22, 7, .24);
  c.fillStyle = player.id === 'p1' ? '#80a9c9' : '#c86b5f';
  c.strokeStyle = '#fff4d0';
  c.lineWidth = 2.5;
  c.beginPath(); c.arc(player.x, player.y, 15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#07100d';
  c.font = '800 10px system-ui';
  c.textAlign = 'center';
  c.fillText(player.id === 'p1' ? 'P1' : 'P2', player.x, player.y + 3);
  drawNameTag(c, player.label || (player.id === 'p1' ? 'Player 1' : 'Player 2'), player.x, player.y - 27);
  c.restore();
}

function drawAmmoBadge(c, actor, x, y) {
  if (!actor?.equipment?.weapon || actor.equipment.weapon !== 'bow') return;
  const ammo = Number(actor.ammunition || 0);
  c.save();
  c.font = '800 10px system-ui';
  c.textAlign = 'center';
  c.fillStyle = ammo > 0 ? '#d3a95f' : '#c86b5f';
  c.strokeStyle = 'rgba(6,10,8,.85)';
  c.lineWidth = 3;
  const text = `AR ${ammo}`;
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
  c.restore();
}

function drawPlayer(game, c, now, view) {
  if (game.player.target && (!view || circleInView(game.player.target.x, game.player.target.y, 64, view))) drawPlayerTarget(game, c);
  const playerVisible = !view || circleInView(game.player.x, game.player.y, (game.player.r || 13) + 42, view);
  const assistantVisible = !view || circleInView(game.assistant.x, game.assistant.y, 42, view);
  if (playerVisible) drawPlayerActor(game, c, now);
  if (assistantVisible) drawAssistant(c, game.assistant.x, game.assistant.y, now, game.assistant.facingX, game.assistant.facingY);
}

function drawPlayerActor(game, c, now) {
  c.save();
  const breathe = Math.sin(now / 520) * .8;
  drawShadow(c, game.player.x, game.player.y + game.player.r + 5, game.player.r + 8, 5, .28);
  const look = getLookOffset(game.player.facingX, game.player.facingY, 4);
  c.fillStyle = '#eef5ef';
  c.strokeStyle = '#26322d';
  c.lineWidth = 2;
  c.beginPath(); c.arc(game.player.x, game.player.y + breathe, game.player.r + 1, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#76b77f';
  c.beginPath(); c.arc(game.player.x + look.x, game.player.y - 3 + breathe + look.y, 3, 0, Math.PI * 2); c.fill();
  if (game.player.inventory) {
    drawMiniItem(c, game.player.x, game.player.y - 25, game.player.inventory.type);
    drawNameTag(c, game.player.inventory.type, game.player.x, game.player.y - 34);
  }
  if (game.player.equipment?.weapon) drawHeldToolAsset(c, game.player.x + 19, game.player.y - 5, game.player.equipment.weapon);
  if (game.player.equipment?.shield) drawHeldToolAsset(c, game.player.x - 18, game.player.y - 5, game.player.equipment.shield);
  drawAmmoBadge(c, game.player, game.player.x, game.player.y + 28);
  c.restore();
}

function drawPlayerTarget(game, c) {
  const queuedTargets = game.player.targetQueue || [];
  c.save();
  c.strokeStyle = '#86b6d6';
  c.lineWidth = 2;
  c.setLineDash([4, 4]);
  c.beginPath(); c.arc(game.player.target.x, game.player.target.y, 14, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  c.moveTo(game.player.target.x - 19, game.player.target.y); c.lineTo(game.player.target.x + 19, game.player.target.y);
  c.moveTo(game.player.target.x, game.player.target.y - 19); c.lineTo(game.player.target.x, game.player.target.y + 19);
  c.stroke();
  if (game.player.target.started && game.player.target.total) {
    const total = game.player.target.total || 1;
    const done = 1 - Math.max(0, game.player.target.remaining || 0) / total;
    drawBar(c, game.player.target.x - 24, game.player.target.y - 34, 48, 7, done, '#d3a95f');
    drawNameTag(c, game.player.target.processLabel || 'working', game.player.target.x, game.player.target.y - 42);
  }
  if (queuedTargets.length) {
    c.strokeStyle = '#9abf8f';
    c.fillStyle = '#9abf8f';
    let prev = game.player.target;
    for (const target of queuedTargets) {
      c.beginPath();
      c.moveTo(prev.x, prev.y);
      c.lineTo(target.x, target.y);
      c.stroke();
      c.beginPath();
      c.arc(target.x, target.y, 10, 0, Math.PI * 2);
      c.stroke();
      prev = target;
    }
  }
  c.restore();
}

function drawAssistant(c, x, y, now, facingX = 1, facingY = 0) {
  c.save();
  const r = 9 + Math.sin(now / 500) * 1;
  const look = getLookOffset(facingX, facingY, 2.8);
  c.fillStyle = 'rgba(118,183,127,.16)';
  c.beginPath(); c.arc(x, y, r + 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#76b77f';
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e6f4e5';
  c.beginPath(); c.arc(x + look.x, y - 3 + look.y, 2, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawPlacement(game, c) {
  if (!game.placementType) return;
  const def = BUILDING_TYPES[game.placementType];
  c.save();
  c.globalAlpha = .72;
  drawBuildingPreviewAsset(c, game.mouse.x - def.w / 2, game.mouse.y - def.h / 2, def.w, def.h, { ...def, type: game.placementType });
  c.restore();
}

function drawZoneDraft(game, c) {
  const d = game.zoneDraft;
  if (!d?.active) return;
  c.save();
  c.strokeStyle = '#fff4d0';
  c.fillStyle = 'rgba(211,169,95,.13)';
  c.lineWidth = 2;
  c.setLineDash([6, 6]);
  if (d.started) {
    if (d.kind === 'radius') { c.beginPath(); c.arc(d.x1, d.y1, d.radius || Math.hypot(d.x2 - d.x1, d.y2 - d.y1), 0, Math.PI * 2); c.fill(); c.stroke(); }
    else { const x = Math.min(d.x1, d.x2), y = Math.min(d.y1, d.y2), w = Math.abs(d.x2 - d.x1), h = Math.abs(d.y2 - d.y1); roundedRect(c, x, y, w, h, 14); c.fill(); c.stroke(); }
  }
  drawNameTag(c, d.kind === 'radius' ? 'Drag radius for step' : 'Drag to create command zone', game.mouse.x + 86, game.mouse.y - 14);
  c.restore();
}

function drawFloaters(game, c, view) {
  c.save();
  c.font = '800 12px system-ui';
  c.textAlign = 'center';
  for (const f of game.floaters || []) {
    if (view && !circleInView(f.x, f.y, 80, view)) continue;
    c.globalAlpha = clamp(f.life / f.max, 0, 1);
    c.strokeStyle = 'rgba(3, 6, 5, .8)';
    c.lineWidth = 4;
    c.strokeText(f.text, f.x, f.y);
    c.fillStyle = f.color;
    c.fillText(f.text, f.x, f.y);
  }
  c.restore();
}

function drawHud(game, c) {
  c.save();
  const zoom = Math.round((game.camera.zoom || 1) * 100);
  const mp = game.multiplayer?.enabled ? ` · Multiplayer ${game.multiplayer.sessionId || 'session'} · destroy enemy throne` : '';
  const clock = game.dayNight ? ` · ${game.dayNight.label} ${Math.round((game.dayNight.phase || 0) * 100)}%` : '';
  const mobile = !!game.mobile;
  const text = mobile
    ? `Tap move/select · Long-press action · Drag pan · Pinch/＋/－ zoom ${zoom}% · Menu/Build/Chat buttons${clock}${mp}`
    : `WASD / arrows pan · Hold Shift = fast pan · Mouse wheel zoom ${zoom}% · Right-click moves/attacks/deposits · E acts · B build${clock}${mp}`;
  c.font = mobile ? '800 12px system-ui' : '700 13px system-ui';
  const w = Math.min(game.W - 32, c.measureText(text).width + 28);
  const h = mobile ? 28 : 32;
  c.fillStyle = 'rgba(9, 14, 12, .72)';
  c.strokeStyle = 'rgba(211, 169, 95, .25)';
  c.lineWidth = 1;
  roundedRect(c, 16, 14, w, h, 999); c.fill(); c.stroke();
  c.fillStyle = '#e6eee8';
  c.fillText(text, 30, 35);
  if (game.showFpsOverlay !== false) {
    const fps = Math.round(Number(game.fps || 0));
    const target = Math.max(1, Number(game.targetFps || 60));
    const fpsText = `${fps || '…'} FPS`;
    c.font = '800 13px system-ui';
    const fw = c.measureText(fpsText).width + 24;
    const fx = Math.max(16, game.W - fw - 16);
    const color = fps >= target * 0.85 ? 'rgba(116, 205, 137, .65)' : fps >= target * 0.6 ? 'rgba(211, 169, 95, .72)' : 'rgba(207, 94, 82, .72)';
    c.fillStyle = 'rgba(8, 12, 10, .78)';
    c.strokeStyle = color;
    roundedRect(c, fx, 14, fw, 28, 999); c.fill(); c.stroke();
    c.fillStyle = '#f4fbf5';
    c.textAlign = 'right';
    c.fillText(fpsText, game.W - 28, 33);
  }
  c.restore();
}

function drawMiniItem(c, x, y, type) {
  c.save();
  c.translate(x, y);
  drawMiniItemAsset(c, type);
  c.restore();
}
function drawTrunk(c, x, y, w, h, color) {
  const g = c.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
  g.addColorStop(0, lighten(color, .12)); g.addColorStop(1, darken(color, .18));
  c.fillStyle = g; roundedRect(c, x - w / 2, y - h / 2, w, h, 4); c.fill();
}
function leafBlob(c, x, y, r, color) {
  const g = c.createRadialGradient(x - r * .3, y - r * .35, 2, x, y, r);
  g.addColorStop(0, lighten(color, .18)); g.addColorStop(1, darken(color, .12));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function drawShadow(c, x, y, rx, ry, alpha = .2) {
  c.save(); c.fillStyle = `rgba(0,0,0,${alpha})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore();
}
function drawBar(c, x, y, w, h, ratio, color) {
  c.save();
  roundedRect(c, x, y, w, h, h / 2); c.fillStyle = 'rgba(5,8,7,.78)'; c.fill();
  roundedRect(c, x + 1, y + 1, Math.max(0, (w - 2) * clamp(ratio, 0, 1)), h - 2, h / 2); c.fillStyle = color; c.fill();
  c.restore();
}
function drawNameTag(c, text, x, y) {
  c.save();
  c.font = '700 11px system-ui'; c.textAlign = 'center';
  const w = c.measureText(text).width + 14;
  c.fillStyle = 'rgba(6,10,8,.82)'; c.strokeStyle = 'rgba(255,244,208,.38)';
  roundedRect(c, x - w / 2, y - 15, w, 20, 999); c.fill(); c.stroke();
  c.fillStyle = '#fff4d0'; c.fillText(text, x, y - 1);
  c.restore();
}
function getLookOffset(facingX = 1, facingY = 0, amount = 4) {
  const len = Math.hypot(facingX, facingY);
  if (len < 0.001) return { x: amount, y: 0 };
  return { x: (facingX / len) * amount, y: (facingY / len) * amount * 0.6 };
}
function drawPill(c, text, x, y, color) {
  c.save();
  c.font = '700 12px system-ui';
  const w = c.measureText(text).width + 14;
  c.fillStyle = 'rgba(6,10,8,.72)'; c.strokeStyle = color;
  roundedRect(c, x, y, w, 22, 999); c.fill(); c.stroke();
  c.fillStyle = '#f2f7f3'; c.fillText(text, x + 7, y + 15);
  c.restore();
}
function roundedRect(c, x, y, w, h, r) {
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); return; }
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath(); c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr); c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr); c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y);
}
function lighten(hex, amount) { return mix(hex, '#ffffff', amount); }
function darken(hex, amount) { return mix(hex, '#000000', amount); }
function mix(hex, target, amount) {
  const a = parseHex(hex), b = parseHex(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function parseHex(hex) {
  const clean = String(hex).replace('#', '').slice(0, 6).padEnd(6, '0');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)].map(n => Number.isFinite(n) ? n : 0);
}

