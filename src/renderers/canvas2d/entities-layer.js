import {
  circleInView,
  drawBar,
  drawNameTag,
  drawShadow,
  getLookOffset,
  isBotHandTool,
  roundedRect
} from '../shared/renderer-utils.js?v=t_renderer_split_0627';
import { createDepthDrawable } from '../../depth-sort.js?v=t_da28d8dd';
import {
  drawHeldToolAsset,
  drawMiniItemAsset
} from '../../visual-assets.js?v=t_building_kits_0618';

function drawMiniItem(c, x, y, type) {
  c.save();
  c.translate(x, y);
  drawMiniItemAsset(c, type);
  c.restore();
}

export function drawMonster(game, c, m, now) {
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

export function drawDogBot(game, c, b, now) {
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

export function drawBot(game, c, b, now) {
  if (b.kind === 'dog') return drawDogBot(game, c, b, now);
  const hover = game.mouse.hoverBot === b;
  const inventoryIsHandTool = isBotHandTool(b.inventory?.type);
  const facingRight = (b.facingX ?? 1) >= 0;
  const handToolTypes = inventoryIsHandTool ? [b.inventory.type] : [];
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

export function pushRemotePlayersToDepth(game, c, view, depthDrawables, now) {
  const players = game.multiplayer?.players || {};
  const localId = game.multiplayer?.playerId;
  for (const player of Object.values(players)) {
    if (!player || player.id === localId || player.disconnected) continue;
    if (view && !circleInView(player.x, player.y, 52, view)) continue;
    depthDrawables.push(createDepthDrawable('remote_player', player, () => drawRemotePlayer(game, c, player), { order: depthDrawables.length }));
  }
}

export function drawRemotePlayer(game, c, player) {
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

export function drawPlayerActor(game, c, now) {
  c.save();
  const breathe = Math.sin(now / 520) * .8;
  drawShadow(c, game.player.x, game.player.y + game.player.r + 5, game.player.r + 8, 5, .28);
  const look = getLookOffset(game.player.facingX, game.player.facingY, 4);
  // Tint player red-ish when low HP
  const hpRatio = Math.max(0, Math.min(1, (game.player.hp ?? 0) / Math.max(1, game.player.maxHp || 10)));
  const lowHp = hpRatio <= 0.3;
  c.fillStyle = lowHp ? '#f5d8d4' : '#eef5ef';
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
  // ── Health bar above player (green→yellow→red gradient) ──
  const barColor = hpRatio > 0.6 ? '#5ecf6e' : hpRatio > 0.3 ? '#d3a95f' : '#c86b5f';
  drawBar(c, game.player.x - 22, game.player.y - game.player.r - 18, 44, 5, hpRatio, barColor);
}

export function drawPlayerTarget(game, c) {
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

export function drawAssistant(c, x, y, now, facingX = 1, facingY = 0) {
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
