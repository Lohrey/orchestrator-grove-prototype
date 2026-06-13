import { BUILDING_TYPES } from './data.js?v=t_fc028066';
import { clamp } from './utils.js?v=20260613-player-tools';

const ITEM_COLORS = {
  log: '#9a6034',
  plank: '#d8aa63',
  pole: '#c9b77d',
  stick: '#a86f3c',
  stone: '#a9b0aa',
  tree_seed: '#a7d095',
  crude_axe: '#86b6d6',
  crude_pickaxe: '#d0bf86',
  crude_shovel: '#bd8b58',
  wooden_sword: '#c7b683',
  wooden_shield: '#a88755',
  hemp: '#8fbf76',
  hemp_seed: '#b8d58a',
  bow: '#cda66d'
};

const ITEM_LABELS = {
  log: 'log',
  plank: 'plank',
  pole: 'pole',
  stick: 'stick',
  stone: 'stone',
  tree_seed: 'tree seed',
  crude_axe: 'crude axe',
  crude_pickaxe: 'crude pickaxe',
  crude_shovel: 'crude shovel',
  wooden_sword: 'wooden sword',
  wooden_shield: 'wooden shield',
  hemp: 'hemp',
  hemp_seed: 'hemp seed',
  bow: 'bow'
};
const itemLabel = type => ITEM_LABELS[type] || type;

export function drawWorld(renderState, ctx) {
  const game = renderState;
  const c = ctx;
  const now = performance.now();
  c.clearRect(0, 0, game.W, game.H);
  drawViewportBackdrop(game, c);

  c.save();
  c.scale(game.camera.zoom || 1, game.camera.zoom || 1);
  c.translate(-game.camera.x, -game.camera.y);
  drawMapBase(game, c);
  drawGrid(game, c);
  drawZones(game, c);
  for (const hole of game.holes || []) drawHole(c, hole);
  for (const rock of game.rocks || []) drawRock(c, rock);
  for (const hemp of game.hempPlants || []) drawHempPlant(game, c, hemp, now);
  for (const tree of game.trees || []) drawTree(c, tree, now);
  for (const structure of game.structures || []) drawStructure(game, c, structure, now);
  for (const projectile of game.projectiles || []) drawProjectile(c, projectile);
  for (const item of game.items || []) drawItem(game, c, item, now);
  for (const monster of game.monsters || []) { if ((monster.hp || 0) > 0) drawMonster(game, c, monster, now); }
  for (const bot of game.bots || []) drawBot(game, c, bot, now);
  drawPlayer(game, c, now);
  drawRemotePlayers(game, c, now);
  drawPlacement(game, c);
  drawZoneDraft(game, c);
  drawFloaters(game, c);
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
}

function drawMapBase(game, c) {
  const g = c.createLinearGradient(0, 0, game.map.width, game.map.height);
  g.addColorStop(0, '#1b2a1f');
  g.addColorStop(0.48, '#19251c');
  g.addColorStop(1, '#101912');
  c.fillStyle = g;
  c.fillRect(0, 0, game.map.width, game.map.height);

  c.save();
  c.globalAlpha = .22;
  c.fillStyle = '#233321';
  for (let y = 28; y < game.map.height; y += 136) {
    for (let x = 22 + ((y / 136) % 2) * 42; x < game.map.width; x += 168) {
      c.beginPath();
      c.ellipse(x, y, 54, 15, -0.32, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = .15;
  c.strokeStyle = '#8a6a42';
  c.lineWidth = 28;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(90, game.map.height - 120);
  c.bezierCurveTo(330, 510, 610, 720, game.map.width - 120, 250);
  c.stroke();
  c.restore();
}

function drawGrid(game, c) {
  c.save();
  c.strokeStyle = 'rgba(232, 239, 232, .035)';
  c.lineWidth = 1;
  for (let x = 0; x <= game.map.width; x += 48) {
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, game.map.height); c.stroke();
  }
  for (let y = 0; y <= game.map.height; y += 48) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(game.map.width, y); c.stroke();
  }
  c.strokeStyle = 'rgba(211,169,95,.12)';
  c.lineWidth = 2;
  c.strokeRect(0, 0, game.map.width, game.map.height);
  c.restore();
}

function drawZones(game, c) {
  c.save();
  c.font = '700 12px system-ui';
  c.textAlign = 'left';
  for (const z of game.zones || []) {
    if (z.hidden) continue;
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

function drawHole(c, h) {
  c.save();
  const r = h.radius || 13;
  drawShadow(c, h.x, h.y + 2, r + 8, r * .62, .26);
  const grad = c.createRadialGradient(h.x, h.y, 2, h.x, h.y, r + 7);
  grad.addColorStop(0, h.planted ? '#27442b' : '#050806');
  grad.addColorStop(1, h.planted ? '#5b7445' : '#5d422b');
  c.fillStyle = grad;
  c.strokeStyle = h.planted ? '#8bbd76' : '#8a6842';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(h.x, h.y, r + 6, r + 1, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  c.restore();
}

function drawTree(c, t, now) {
  c.save();
  drawShadow(c, t.x, t.y + (t.radius || 20) * .8, (t.radius || 20) * 1.15, (t.radius || 20) * .34, .24);
  if (t.stump) {
    c.globalAlpha = .7;
    drawTrunk(c, t.x, t.y + 3, 14, 22, '#7b512c');
    c.strokeStyle = '#a67948';
    c.beginPath(); c.ellipse(t.x, t.y, t.radius, t.radius * .55, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
    return;
  }
  const stage = t.growthStage || 'grown_tree';
  const sway = Math.sin(now / 1100 + t.x * .017) * (stage === 'sapling' ? 1.5 : 2.5);
  if (stage === 'sapling') {
    c.strokeStyle = '#9abf8f';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(t.x, t.y + 10); c.quadraticCurveTo(t.x + sway, t.y, t.x + sway, t.y - 10); c.stroke();
    leafBlob(c, t.x - 6 + sway, t.y - 6, 6, '#78aa68');
    leafBlob(c, t.x + 6 + sway, t.y - 8, 6, '#9ac887');
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
  drawBar(c, t.x - 18, t.y - radius - 16, 36, 5, t.hp / t.maxHp, '#9abf8f');
  c.restore();
}

function drawHempPlant(game, c, h, now) {
  if (h.harvested) return;
  const hover = game.mouse.hoverHemp === h;
  const sway = Math.sin(now / 550 + h.x * .05) * 2;
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
  const x = s.x - s.w / 2, y = s.y - s.h / 2;
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
  const grad = c.createLinearGradient(x, y, x, y + s.h);
  grad.addColorStop(0, lighten(def.color || '#6b766f', .14));
  grad.addColorStop(1, darken(def.color || '#6b766f', .18));
  c.fillStyle = grad;
  c.strokeStyle = hover ? '#fff4d0' : 'rgba(14, 20, 17, .9)';
  c.lineWidth = hover ? 3 : 1.5;
  roundedRect(c, x, y, s.w, s.h, 9);
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.10)';
  roundedRect(c, x + 5, y + 5, s.w - 10, Math.max(8, s.h * .28), 6);
  c.fill();

  if (s.type === 'sawbench') drawSawbenchIcon(c, s.x, s.y);
  else if (s.type === 'workbench') drawWorkbenchIcon(c, s.x, s.y);
  else if (s.type === 'factory') drawFactoryIcon(c, s.x, s.y, now);
  else if (s.type === 'smithery') drawSmitheryIcon(c, s.x, s.y);
  else if (s.type === 'bowmaker') drawBowmakerIcon(c, s.x, s.y);
  else if (s.type === 'defensetower') drawDefenseTowerIcon(c, s.x, s.y);
  else if (s.type === 'throne') drawThroneIcon(c, s.x, s.y);
  else if (s.type === 'item_palette') drawPaletteIcon(c, s.x, s.y);

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
    : s.type === 'item_palette'
      ? `${s.storageType || 'empty'} ${s.stored || 0}/${s.capacity || 0}`
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

function drawDefenseTowerIcon(c, x, y) {
  c.save();
  c.fillStyle = '#2c332f';
  c.strokeStyle = '#e6d6a8';
  c.lineWidth = 2;
  roundedRect(c, x - 16, y - 28, 32, 44, 5); c.fill(); c.stroke();
  c.fillStyle = '#6f7661';
  c.fillRect(x - 20, y + 12, 40, 11);
  c.strokeRect(x - 20, y + 12, 40, 11);
  c.strokeStyle = '#f1dfb8';
  c.beginPath(); c.moveTo(x - 22, y - 8); c.lineTo(x + 22, y - 8); c.stroke();
  c.fillStyle = '#d3a95f';
  c.beginPath(); c.moveTo(x + 26, y - 8); c.lineTo(x + 15, y - 13); c.lineTo(x + 15, y - 3); c.closePath(); c.fill();
  c.restore();
}

function drawItem(game, c, i, now) {
  const hover = game.mouse.hoverItem === i;
  const bob = Math.sin(now / 400 + i.bob) * 2;
  c.save();
  c.translate(i.x, i.y + bob);
  drawShadow(c, 0, 9, 11, 4, .24);
  if (hover) {
    c.fillStyle = 'rgba(255,244,208,.20)';
    c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff4d0'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.stroke();
  }
  c.fillStyle = ITEM_COLORS[i.type] || '#d3a95f';
  c.strokeStyle = 'rgba(6,10,8,.72)';
  c.lineWidth = 1.5;
  if (i.type === 'stone') { c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else if (i.type === 'tree_seed' || i.type === 'hemp_seed') { c.beginPath(); c.ellipse(0, 0, 5, 7, -.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else if (i.type === 'hemp') { c.beginPath(); c.ellipse(0, 1, 9, 6, .15, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = '#d8f0c8'; c.beginPath(); c.moveTo(-6,-4); c.lineTo(4,5); c.moveTo(0,-5); c.lineTo(7,4); c.stroke(); }
  else if (i.type === 'bow') { c.strokeStyle = '#3b2617'; c.lineWidth = 2; c.beginPath(); c.arc(-2, 0, 10, -1.2, 1.2); c.stroke(); c.strokeStyle = '#f1dfb8'; c.beginPath(); c.moveTo(2, -9); c.lineTo(2, 9); c.stroke(); }
  else if (i.type === 'crude_axe') { c.fillRect(-9, -2, 18, 4); c.strokeRect(-9, -2, 18, 4); c.fillRect(3, -9, 7, 11); c.strokeRect(3, -9, 7, 11); }
  else if (i.type === 'crude_pickaxe') { c.fillRect(-10, -2, 20, 4); c.strokeRect(-10, -2, 20, 4); c.fillRect(-8, -9, 6, 11); c.strokeRect(-8, -9, 6, 11); }
  else if (i.type === 'crude_shovel') { c.fillRect(-2, -10, 4, 19); c.strokeRect(-2, -10, 4, 19); c.beginPath(); c.ellipse(0, 11, 8, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else { roundedRect(c, -9, -5, 18, 10, 3); c.fill(); c.stroke(); }
  if (hover) drawNameTag(c, itemLabel(i.type), 0, -24);
  c.restore();
}

function drawMonster(game, c, m, now) {
  const hover = game.mouse.hoverMonster === m;
  const r = m.radius || 18;
  const wobble = Math.sin(now / 520 + (m.phase || 0)) * 2;
  c.save();
  drawShadow(c, m.x, m.y + r * .7, r * 1.1, r * .34, .27);
  c.translate(m.x, m.y + wobble);
  c.fillStyle = hover ? 'rgba(255,244,208,.18)' : 'rgba(0,0,0,0)';
  if (hover) { c.beginPath(); c.arc(0, 0, r + 8, 0, Math.PI * 2); c.fill(); }
  const body = c.createRadialGradient(-r * .25, -r * .35, 2, 0, 0, r * 1.15);
  body.addColorStop(0, '#8fb9b5');
  body.addColorStop(1, '#344d47');
  c.fillStyle = body;
  c.strokeStyle = hover ? '#fff4d0' : '#0d1714';
  c.lineWidth = hover ? 3 : 2;
  c.beginPath();
  c.ellipse(0, 0, r, r * .82, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  c.fillStyle = '#e5ece8';
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

function drawBot(game, c, b, now) {
  const hover = game.mouse.hoverBot === b;
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
  if (b.inventory) drawMiniItem(c, b.x - 1, b.y - 24, b.inventory.type);
  if (b.tool) { c.strokeStyle = b.tool.type === 'crude_axe' ? '#86b6d6' : '#d0bf86'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(b.x + 10, b.y - 12); c.lineTo(b.x + 19, b.y - 22); c.stroke(); }
  c.restore();
}

function drawRemotePlayers(game, c, now) {
  const players = game.multiplayer?.players || {};
  const localId = game.multiplayer?.playerId;
  for (const player of Object.values(players)) {
    if (!player || player.id === localId || player.disconnected) continue;
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
}

function drawPlayer(game, c, now) {
  if (game.player.target) drawPlayerTarget(game, c);
  c.save();
  drawShadow(c, game.player.x, game.player.y + game.player.r + 5, game.player.r + 8, 5, .28);
  const breathe = Math.sin(now / 520) * .8;
  c.fillStyle = '#eef5ef';
  c.strokeStyle = '#26322d';
  c.lineWidth = 2;
  c.beginPath(); c.arc(game.player.x, game.player.y + breathe, game.player.r + 1, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#76b77f';
  c.beginPath(); c.arc(game.player.x + 4, game.player.y - 3 + breathe, 3, 0, Math.PI * 2); c.fill();
  if (game.player.inventory) {
    drawMiniItem(c, game.player.x, game.player.y - 25, game.player.inventory.type);
    drawNameTag(c, game.player.inventory.type, game.player.x, game.player.y - 34);
  }
  drawAssistant(c, game.assistant.x, game.assistant.y, now);
  c.restore();
}

function drawPlayerTarget(game, c) {
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
  c.restore();
}

function drawAssistant(c, x, y, now) {
  c.save();
  const r = 9 + Math.sin(now / 500) * 1;
  c.fillStyle = 'rgba(118,183,127,.16)';
  c.beginPath(); c.arc(x, y, r + 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#76b77f';
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e6f4e5';
  c.beginPath(); c.arc(x - 3, y - 3, 2, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawPlacement(game, c) {
  if (!game.placementType) return;
  const def = BUILDING_TYPES[game.placementType];
  c.save();
  c.globalAlpha = .72;
  c.fillStyle = def.color;
  c.strokeStyle = '#fff4d0';
  c.lineWidth = 2;
  c.setLineDash([7, 5]);
  roundedRect(c, game.mouse.x - def.w / 2, game.mouse.y - def.h / 2, def.w, def.h, 10);
  c.fill(); c.stroke();
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

function drawFloaters(game, c) {
  c.save();
  c.font = '800 12px system-ui';
  c.textAlign = 'center';
  for (const f of game.floaters || []) {
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
  const text = `WASD / arrows pan · Mouse wheel zoom ${zoom}% · Right-click moves/attacks/deposits · E acts · B build${mp}`;
  c.font = '700 13px system-ui';
  const w = Math.min(game.W - 32, c.measureText(text).width + 28);
  const h = 32;
  c.fillStyle = 'rgba(9, 14, 12, .72)';
  c.strokeStyle = 'rgba(211, 169, 95, .25)';
  c.lineWidth = 1;
  roundedRect(c, 16, 14, w, h, 999); c.fill(); c.stroke();
  c.fillStyle = '#e6eee8';
  c.fillText(text, 30, 35);
  c.restore();
}

function drawSawbenchIcon(c, x, y) {
  c.strokeStyle = '#5d341d'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(x - 18, y - 12); c.lineTo(x + 18, y - 12); c.moveTo(x - 16, y + 14); c.lineTo(x + 16, y + 14); c.stroke();
  c.fillStyle = '#c58a4e'; roundedRect(c, x - 21, y - 4, 42, 9, 4); c.fill();
}
function drawWorkbenchIcon(c, x, y) {
  c.fillStyle = '#d0bf86'; roundedRect(c, x - 18, y - 12, 36, 9, 3); c.fill();
  c.strokeStyle = '#26322d'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 9, y + 12); c.lineTo(x + 9, y - 10); c.stroke();
}
function drawThroneIcon(c, x, y) {
  c.save();
  c.fillStyle = '#d3a95f';
  c.strokeStyle = '#251a10';
  c.lineWidth = 3;
  roundedRect(c, x - 26, y - 14, 52, 36, 8); c.fill(); c.stroke();
  c.fillStyle = '#6f4428';
  c.fillRect(x - 21, y - 29, 12, 19); c.fillRect(x + 9, y - 29, 12, 19);
  c.fillStyle = '#ffe3a7';
  c.beginPath(); c.moveTo(x - 28, y - 30); c.lineTo(x - 20, y - 41); c.lineTo(x - 12, y - 30); c.lineTo(x, y - 43); c.lineTo(x + 12, y - 30); c.lineTo(x + 20, y - 41); c.lineTo(x + 28, y - 30); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

function drawFactoryIcon(c, x, y, now) {
  c.fillStyle = 'rgba(9,14,12,.55)'; roundedRect(c, x - 20, y - 13, 40, 28, 5); c.fill();
  c.fillStyle = '#d3a95f'; c.fillRect(x - 15, y - 20, 7, 12); c.fillRect(x + 8, y - 23, 7, 15);
  c.fillStyle = `rgba(232,238,232,${.12 + .08 * Math.sin(now / 450)})`; c.beginPath(); c.arc(x + 18, y - 28, 6, 0, Math.PI * 2); c.fill();
}

function drawSmitheryIcon(c, x, y) {
  c.save();
  c.strokeStyle = '#1f2723';
  c.lineWidth = 3;
  c.fillStyle = '#d3a95f';
  c.beginPath(); c.moveTo(x - 22, y + 11); c.lineTo(x + 8, y - 19); c.lineTo(x + 15, y - 12); c.lineTo(x - 15, y + 18); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#8a6842';
  roundedRect(c, x - 7, y - 15, 26, 18, 5); c.fill(); c.stroke();
  c.strokeStyle = '#f5faf6';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(x + 3, y - 10); c.lineTo(x + 15, y + 2); c.moveTo(x + 14, y - 10); c.lineTo(x + 3, y + 1); c.stroke();
  c.restore();
}

function drawBowmakerIcon(c, x, y) {
  c.save();
  c.strokeStyle = '#1f2723'; c.lineWidth = 3;
  c.fillStyle = '#cda66d';
  c.beginPath(); c.arc(x - 2, y, 21, -1.25, 1.25); c.stroke();
  c.strokeStyle = '#f1dfb8'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 5, y - 19); c.lineTo(x + 5, y + 19); c.stroke();
  c.fillStyle = '#8fbf76'; roundedRect(c, x - 28, y + 7, 18, 9, 4); c.fill(); c.stroke();
  c.restore();
}

function drawPaletteIcon(c, x, y) {
  c.fillStyle = '#d8aa63'; roundedRect(c, x - 19, y - 10, 38, 20, 4); c.fill();
  c.strokeStyle = '#5d341d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 16, y - 2); c.lineTo(x + 16, y - 2); c.stroke();
}

function drawMiniItem(c, x, y, type) {
  c.save();
  c.translate(x, y);
  c.fillStyle = ITEM_COLORS[type] || '#d3a95f';
  c.strokeStyle = 'rgba(5,8,7,.75)';
  c.lineWidth = 1;
  roundedRect(c, -7, -5, 14, 10, 3); c.fill(); c.stroke();
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
