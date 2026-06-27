import {
  circleInView,
  clamp,
  createCanvasLayer,
  getClippedMapView,
  isCampaignArrivalActive,
  polylineFeatureInView,
  rectInView,
  terrainNoise
} from '../shared/renderer-utils.js?v=t_renderer_split_0627';
import { clamp as clampUtil } from '../../utils.js?v=20260613-player-tools';
import { getCampaignArrivalScene } from '../../campaign-scenes.js?v=t_campaign_scenes_0627';

const staticMapBaseCache = new Map();

export function drawViewportBackdrop(game, c, { lightingEnabled, getNightAmount }) {
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

export function drawMapBase(game, c, view, { renderDecorativeDetails = true } = {}) {
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

export function drawMapFeatures(game, c, view) {
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
      if (isCampaignArrivalActive(game) && feature.id === getCampaignArrivalScene()?.parkedFeatureId) continue;
      const w = feature.w || 118;
      const h = feature.h || 58;
      if (rectInView(feature.x - w / 2 - 24, feature.y - h / 2 - 32, w + 48, h + 64, view)) drawCamperVanFeature(c, feature);
    }
  }
}

export function drawCampaignArrival(game, c, view, now) {
  const scene = getCampaignArrivalScene(game.campaignArrival?.sceneId);
  if (!scene) return;
  const parkedFeature = (game.mapFeatures || []).find(feature => feature.id === scene.parkedFeatureId) || null;
  const points = scene.path || [];
  if (points.length < 2) return;
  const progress = clamp(Number(game.campaignArrival?.progress ?? computePolylineProgress(now, game.campaignArrival?.startedAt, scene.durationMs)), 0, 1);
  const state = samplePolyline(points, progress);
  const parkedRotation = Number.isFinite(parkedFeature?.rotation) ? parkedFeature.rotation : state.angle;
  const rotation = state.angle + ((parkedRotation - state.angle) * Math.min(1, progress * 1.15));
  const van = {
    ...parkedFeature,
    x: state.x,
    y: state.y,
    rotation,
    hideLabel: true,
    arrival: true,
    driverVisible: true
  };
  drawCamperVanFeature(c, van);
}

function computePolylineProgress(now, startedAt, durationMs) {
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return clampUtil((now - startedAt) / durationMs, 0, 1);
}

function samplePolyline(points, progress) {
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
  const target = total * clampUtil(progress, 0, 1);
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
  if (feature.arrival) {
    c.fillStyle = 'rgba(21, 24, 24, .66)';
    c.beginPath();
    c.arc(w * .06, -h * .02, 6, 0, Math.PI * 2);
    c.fill();
    c.fillRect(w * .03, h * .03, 14, 9);
    c.fillStyle = 'rgba(244, 235, 202, .12)';
    c.fillRect(-w * .24, -h * .12, w * .18, h * .16);
  }
  c.restore();
  if (!feature.hideLabel) drawNameTag(c, feature.label || 'camper van', feature.x, feature.y - (feature.h || 58) - 18);
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

export function drawGrid(game, c, view) {
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

// Re-export drawing primitives needed internally
import { drawShadow, drawNameTag, roundedRect } from '../shared/renderer-utils.js?v=t_renderer_split_0627';
