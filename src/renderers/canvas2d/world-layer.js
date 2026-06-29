import {
  circleInView,
  circleIntersectsRect,
  circlesOverlap,
  clamp,
  drawBar,
  drawNameTag,
  drawPill,
  drawShadow,
  getTreeDrawRadius,
  getTreeOpacity,
  isBotHandTool,
  rectInView,
  roundedRect
} from '../shared/renderer-utils.js?v=grove_stone_transparency_0628';
import { clamp as clampUtil } from '../../utils.js?v=grove_pixi_fixes_0628';
import { BUILDING_TYPES } from '../../data.js?v=t_building_kits_0618';
import {
  drawBuildingAsset,
  drawItemAsset,
  itemLabel
} from '../../visual-assets.js?v=t_building_kits_0618';
import { getTinySwordsAtlas } from '../shared/tiny-swords-atlas.js?v=ts_fix2_0628';
import { getWorldObjectSprite, treeSpriteKey, rockSpriteKey } from '../shared/sprite-cache.js?v=t_sprite_cache_0628';

export function drawZones(game, c, view) {
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

export function drawHole(game, c, h) {
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

export function drawRock(game, c, r, opacity = 1) {
  c.save();
  const hover = game.mouse.hoverRock === r;

  // ── Sprite cache path: blit pre-rendered rock when not hovered and fully opaque ──
  if (!hover && opacity >= 0.99) {
    const key = rockSpriteKey(r);
    if (key) {
      const cached = getWorldObjectSprite(key);
      if (cached) {
        c.drawImage(cached.sprite, r.x - cached.meta.cx, r.y - cached.meta.cy);
        c.restore();
        return;
      }
    }
  }

  c.globalAlpha = (r.depleted ? .38 : 1) * opacity;
  drawShadow(c, r.x, r.y + r.radius * .72, r.radius * 1.15, r.radius * .34, .26);
  if (hover) {
    c.fillStyle = 'rgba(255,244,208,.08)';
    c.beginPath();
    c.ellipse(r.x, r.y, r.radius + 10, r.radius + 7, 0, 0, Math.PI * 2);
    c.fill();
  }
  const grad = c.createLinearGradient(r.x - r.radius, r.y - r.radius, r.x + r.radius, r.y + r.radius);
  grad.addColorStop(0, r.depleted ? '#555c58' : '#a9b0aa');
  grad.addColorStop(1, r.depleted ? '#313733' : '#5d6761');
  c.fillStyle = grad;
  c.strokeStyle = hover ? '#fff4d0' : (r.depleted ? '#6c746f' : '#d2d8d3');
  c.lineWidth = hover ? 3 : 2;
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
  if (hover) {
    c.strokeStyle = '#fff4d0';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(r.x, r.y, r.radius + 13, r.radius + 9, 0, 0, Math.PI * 2);
    c.stroke();
    drawNameTag(c, r.depleted ? 'depleted stone deposit' : 'stone deposit', r.x, r.y - r.radius - 24);
  }
  c.restore();
}

export function drawHempPlant(game, c, h, now) {
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
  c.fillStyle = '#9ac887';
  c.beginPath(); c.ellipse(h.x + sway, h.y - 5, h.radius || 13, 9, -.35, 0, Math.PI * 2); c.fill();
  if (hover) drawNameTag(c, 'hemp plant', h.x, h.y - 28);
  c.restore();
}

export function drawStructure(game, c, s, now) {
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

  // ── Tiny Swords atlas path for towers / defensive structures ──
  // When the atlas is loaded, defensive towers and similar structures render
  // as Tiny Swords Tower sprites. Falls back to drawBuildingAsset otherwise.
  const atlas = getTinySwordsAtlas();
  let usedAtlasSprite = false;
  if (atlas && (s.type === 'defensetower' || s.rangedAttack)) {
    const towerFrame = atlas.getFrame('Tower_Blue') || atlas.getFrame('Castle_Blue');
    if (towerFrame) {
      // Tower is 128×256 in atlas; scale to match structure footprint
      const targetH = Math.max(s.h || 48, 64);
      const targetW = targetH * (towerFrame.w / towerFrame.h);
      c.drawImage(
        atlas.bitmap,
        towerFrame.x, towerFrame.y, towerFrame.w, towerFrame.h,
        s.x - targetW / 2, s.y - targetH / 2,
        targetW, targetH
      );
      usedAtlasSprite = true;
    }
  }
  if (!usedAtlasSprite) {
    drawBuildingAsset(c, s, def, { hover, now });
  }

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

export function drawProjectile(c, p) {
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

export function drawItem(game, c, i, now) {
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

export function drawTree(game, c, t, now, opacity = 1) {
  const hover = game.mouse.hoverTree === t;

  // ── Sprite cache path: blit pre-rendered tree when not hovered/stump ──
  // The sprite cache has base foliage without sway animation. Sway is
  // a subtle effect; skipping it for the blit path is a major perf win.
  if (!hover && !t.stump && opacity >= 0.99) {
    const key = treeSpriteKey(t);
    if (key) {
      const cached = getWorldObjectSprite(key);
      if (cached) {
        c.drawImage(cached.sprite, t.x - cached.meta.cx, t.y - cached.meta.cy);
        // Still draw health bar on top if tree has been damaged
        if (t.hp < t.maxHp) {
          c.save();
          drawBar(c, t.x - 18, t.y - (t.radius || 22) - 16, 36, 5, t.hp / t.maxHp, '#9abf8f');
          c.restore();
        }
        return;
      }
    }
  }

  c.save();
  c.globalAlpha = opacity;
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

import { lighten, darken } from '../shared/renderer-utils.js?v=grove_stone_transparency_0628';
