import {
  drawNameTag,
  roundedRect
} from '../shared/renderer-utils.js?v=t_renderer_split_0627';
import { BUILDING_TYPES } from '../../data.js?v=t_building_kits_0618';
import { drawBuildingPreviewAsset } from '../../visual-assets.js?v=t_building_kits_0618';

export function drawPlacement(game, c) {
  if (!game.placementType) return;
  const def = BUILDING_TYPES[game.placementType];
  c.save();
  c.globalAlpha = .72;
  drawBuildingPreviewAsset(c, game.mouse.x - def.w / 2, game.mouse.y - def.h / 2, def.w, def.h, { ...def, type: game.placementType });
  c.restore();
}

export function drawZoneDraft(game, c) {
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
