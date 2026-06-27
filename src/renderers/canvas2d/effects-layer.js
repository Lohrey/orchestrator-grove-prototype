import {
  clamp,
  circleInView,
  fogEnabled,
  fogLightOccluders,
  fogRevealSources,
  fogStaticVisible,
  getClippedMapView,
  getNightAmount,
  isLightStructure,
  lightingEnabled,
  structureFogPoint,
  structureLightRadius
} from '../shared/renderer-utils.js?v=t_renderer_split_0627';
import { drawFogOfWarOverlay } from '../../fog-of-war.js?v=t_building_kits_0618';

export function drawFloaters(game, c, view) {
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

export function drawStructureLightGlows(game, c, view) {
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

export function drawNightTint(game, c, view) {
  const night = getNightAmount(game);
  if (night <= 0.01) return;
  const clipped = getClippedMapView(game, view);
  if (!clipped) return;
  c.save();
  c.fillStyle = `rgba(2, 9, 19, ${0.07 + night * 0.24})`;
  c.fillRect(clipped.left, clipped.top, clipped.width, clipped.height);
  c.restore();
}

export function drawRevealSourceGlows(game, c, view, revealSources) {
  const sources = fogRevealSources(game).filter(source => source.kind !== 'structure');
  if (!sources.length) return;
  const night = getNightAmount(game);
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

export function drawFogOfWar(game, c, view, revealSources) {
  const clipped = getClippedMapView(game, view);
  if (!clipped) return;
  if (!fogEnabled(game)) return;
  const occluders = game.dynamicShadowsEnabled ? fogLightOccluders(game, clipped) : [];
  drawFogOfWarOverlay(c, {
    fog: game.fogOfWar,
    map: game.map,
    view: clipped,
    sources: revealSources,
    occluders,
    nightAmount: lightingEnabled(game) ? getNightAmount(game) : 0
  });
}
