export const LOOSE_ITEM_RENDER_MIN_ZOOM = 0.55;
export const DECORATIVE_DETAIL_RENDER_MIN_ZOOM = 0.55;
export const BOT_RENDER_MIN_ZOOM = 0.30;
export const BOT_HAND_TOOL_TYPES = new Set(['crude_axe', 'crude_pickaxe', 'crude_shovel', 'crude_hammer']);
export const LIGHT_OCCLUDER_PAD = 420;
export const MAX_HIGH_RES_DEVICE_PIXEL_RATIO = 2;

export function normalizeRendererSettings(settings = {}) {
  return {
    highResolution: settings?.highResolution !== false,
    antialias: settings?.antialias !== false
  };
}

export function getRendererResolution(settings) {
  if (!settings.highResolution) return 1;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_HIGH_RES_DEVICE_PIXEL_RATIO);
}

export function fillPath(graphics, color, alpha, draw) {
  draw(graphics);
  graphics.fill({ color, alpha });
}

export function strokePath(graphics, color, width, alpha, draw, options = {}) {
  graphics.setStrokeStyle({ color, width, alpha, ...options });
  draw(graphics);
  graphics.stroke();
}

export function fillAndStrokePath(graphics, { fill = null, fillAlpha = 1, stroke = null, strokeWidth = 1, strokeAlpha = 1, strokeOptions = {} } = {}, draw) {
  if (fill != null) fillPath(graphics, fill, fillAlpha, draw);
  if (stroke != null) strokePath(graphics, stroke, strokeWidth, strokeAlpha, draw, strokeOptions);
}

export function drawRoundedRect(graphics, x, y, width, height, radius, fill, alpha = 1, stroke = null, strokeWidth = 1, strokeAlpha = 1) {
  fillAndStrokePath(
    graphics,
    { fill, fillAlpha: alpha, stroke, strokeWidth, strokeAlpha },
    path => path.roundRect(x, y, width, height, radius)
  );
}

export function drawBarGraphic(graphics, x, y, width, height, ratio, color) {
  fillPath(graphics, 0x050807, 0.78, path => path.roundRect(x, y, width, height, height / 2));
  fillPath(graphics, color, 1, path => path.roundRect(x + 1, y + 1, Math.max(0, (width - 2) * Math.max(0, Math.min(1, ratio))), height - 2, height / 2));
}

export function createText(PIXI, text, style = {}) {
  const { resolution, ...textStyle } = style;
  return new PIXI.Text({
    text,
    resolution: resolution ?? undefined,
    style: {
      fill: '#e6eee8',
      fontFamily: 'system-ui',
      ...textStyle
    }
  });
}

export function getLookOffset(facingX = 1, facingY = 0, amount = 4) {
  const length = Math.hypot(facingX, facingY);
  if (length < 0.001) return { x: amount, y: 0 };
  return { x: (facingX / length) * amount, y: (facingY / length) * amount * 0.6 };
}

export function parseColor(value) {
  const clean = String(value || '#76b77f').replace('#', '').slice(0, 6);
  const parsed = Number.parseInt(clean || '76b77f', 16);
  return Number.isFinite(parsed) ? parsed : 0x76b77f;
}

export function isBotHandTool(type) {
  return BOT_HAND_TOOL_TYPES.has(type);
}

export function terrainNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function moveThroughPoints(graphics, points, dash = 0, gap = 0) {
  if (!points.length) return;
  const [firstX, firstY] = points[0] || [0, 0];
  graphics.moveTo(firstX, firstY);
  if (dash > 0 && gap > 0 && graphics.setLineDash) graphics.setLineDash([dash, gap]);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i] || [0, 0];
    graphics.lineTo(x, y);
  }
}

export function makeCanvas(width, height) {
  const el = document.createElement('canvas');
  el.width = Math.max(1, Math.ceil(width));
  el.height = Math.max(1, Math.ceil(height));
  return el;
}

export function getTreeDrawRadius(tree) {
  if (tree.stump) return Math.max(12, tree.radius || 20);
  if (tree.growthStage === 'sapling') return Math.max(10, tree.radius || 12);
  if (tree.growthStage === 'small_tree') return Math.max(18, tree.radius || 18);
  return Math.max(22, tree.radius || 22);
}

// ── View/fog helpers shared between pixi modules ───────────────────
export function getWorldViewBounds(renderState) {
  const zoom = Math.max(0.001, renderState.camera?.zoom || 1);
  const left = renderState.camera?.x || 0;
  const top = renderState.camera?.y || 0;
  const width = renderState.W / zoom;
  const height = renderState.H / zoom;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

export function getClippedMapView(renderState, view) {
  const mapWidth = renderState.map?.width || 0;
  const mapHeight = renderState.map?.height || 0;
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

export function rectInView(x, y, width, height, view) {
  return x + width >= view.left && x <= view.right && y + height >= view.top && y <= view.bottom;
}

export function lightingEnabled(renderState) {
  return renderState.lightingEffectsEnabled !== false;
}

export function fogEnabled(renderState) {
  return !!renderState.fogOfWar?.enabled;
}

export function getNightAmount(renderState) {
  return Math.max(0, Math.min(1, renderState.dayNight?.nightAmount ?? 0));
}

export function structureFogPoint(structure) {
  return {
    x: (structure.x || 0) + (structure.w || 48) / 2,
    y: (structure.y || 0) + (structure.h || 48) / 2
  };
}

export function fogStaticVisible(renderState, x, y, { isPointCurrentlyVisible, isPointExplored }) {
  return !fogEnabled(renderState) || isPointCurrentlyVisible(renderState.fogOfWar, x, y) || isPointExplored(renderState.fogOfWar, x, y);
}

export function fogRevealSources(renderState, buildFogRevealSources) {
  return buildFogRevealSources({
    player: renderState.player,
    assistant: renderState.assistant,
    bots: renderState.bots,
    structures: renderState.structures,
    multiplayer: renderState.multiplayer
  });
}

export function fogLightOccluders(renderState, view, { isPointCurrentlyVisible, isPointExplored }) {
  const occluders = [];
  for (const structure of renderState.structures || []) {
    const point = structureFogPoint(structure);
    if (!fogStaticVisible(renderState, point.x, point.y, { isPointCurrentlyVisible, isPointExplored })) continue;
    if (!rectInView((structure.x || 0) - LIGHT_OCCLUDER_PAD, (structure.y || 0) - LIGHT_OCCLUDER_PAD, (structure.w || 48) + LIGHT_OCCLUDER_PAD * 2, (structure.h || 48) + LIGHT_OCCLUDER_PAD * 2, view)) continue;
    occluders.push({ kind: 'structure', x: structure.x || 0, y: structure.y || 0, w: structure.w || 48, h: structure.h || 48, shadowStrength: 0.08 });
  }
  for (const tree of renderState.trees || []) {
    const radius = getTreeDrawRadius(tree) * 0.34;
    if (!fogStaticVisible(renderState, tree.x, tree.y, { isPointCurrentlyVisible, isPointExplored })) continue;
    if (!circleInView(tree.x, tree.y, radius + LIGHT_OCCLUDER_PAD, view)) continue;
    occluders.push({ kind: 'tree', x: tree.x, y: tree.y, radius: Math.max(14, Math.min(34, radius)), shadowStrength: 0.04 });
  }
  for (const rock of renderState.rocks || []) {
    const radius = rock.radius || 18;
    if (!fogStaticVisible(renderState, rock.x, rock.y, { isPointCurrentlyVisible, isPointExplored })) continue;
    if (!circleInView(rock.x, rock.y, radius + LIGHT_OCCLUDER_PAD, view)) continue;
    occluders.push({ kind: 'rock', x: rock.x, y: rock.y, radius: Math.max(14, Math.min(42, radius * 0.95)), shadowStrength: 0.02 });
  }
  return occluders;
}

export function isCampaignArrivalActive(renderState) {
  return !!renderState.campaignArrival?.active && renderState.gameMode === 'campaign';
}

export function computePolylineProgress(now, startedAt, durationMs) {
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, (now - startedAt) / durationMs));
}

export function samplePolyline(points, progress) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
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
  const target = total * Math.max(0, Math.min(1, progress));
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
