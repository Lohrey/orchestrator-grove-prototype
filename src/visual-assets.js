const ITEM_PALETTE = {
  log: { label: 'log', color: '#9a6034' },
  plank: { label: 'plank', color: '#d8aa63' },
  pole: { label: 'pole', color: '#c9b77d' },
  stick: { label: 'stick', color: '#a86f3c' },
  stone: { label: 'stone', color: '#a9b0aa' },
  tree_seed: { label: 'tree seed', color: '#a7d095' },
  crude_axe: { label: 'crude axe', color: '#86b6d6' },
  crude_pickaxe: { label: 'crude pickaxe', color: '#d0bf86' },
  crude_shovel: { label: 'crude shovel', color: '#bd8b58' },
  wooden_sword: { label: 'wooden sword', color: '#c7b683' },
  wooden_shield: { label: 'wooden shield', color: '#a88755' },
  hemp: { label: 'hemp', color: '#8fbf76' },
  hemp_seed: { label: 'hemp seed', color: '#b8d58a' },
  bow: { label: 'bow', color: '#cda66d' }
};

const BUILDING_ASSETS = {
  sawbench: { base: '#8a6a3d', roof: '#5d341d', accent: '#d8aa63', trim: '#2f1c12' },
  workbench: { base: '#735f43', roof: '#4e3b28', accent: '#d0bf86', trim: '#26322d' },
  factory: { base: '#637772', roof: '#2c3835', accent: '#d3a95f', trim: '#111916' },
  smithery: { base: '#6f6760', roof: '#3f332e', accent: '#e1743f', trim: '#1f2723' },
  bowmaker: { base: '#5f7054', roof: '#3f4d35', accent: '#cda66d', trim: '#1f2723' },
  defensetower: { base: '#5b625d', roof: '#2c332f', accent: '#e6d6a8', trim: '#141b18' },
  throne: { base: '#8a6a42', roof: '#6f4428', accent: '#ffe3a7', trim: '#251a10' },
  item_palette: { base: '#6f7661', roof: '#4b523f', accent: '#d8aa63', trim: '#5d341d' }
};

export function itemLabel(type) {
  return ITEM_PALETTE[type]?.label || type;
}

export function getItemColor(type) {
  return ITEM_PALETTE[type]?.color || '#d3a95f';
}

export function drawBuildingAsset(c, structure, def, { hover = false, now = 0 } = {}) {
  const asset = BUILDING_ASSETS[structure.type] || { base: def?.color || '#6b766f', roof: '#303834', accent: '#d3a95f', trim: '#0e1512' };
  const x = structure.x - structure.w / 2;
  const y = structure.y - structure.h / 2;
  drawBuildingShell(c, x, y, structure.w, structure.h, asset, hover);
  c.save();
  c.translate(structure.x, structure.y);
  switch (structure.type) {
    case 'sawbench': drawSawbench(c, asset); break;
    case 'workbench': drawWorkbench(c, asset); break;
    case 'factory': drawFactory(c, asset, now); break;
    case 'smithery': drawSmithery(c, asset, now); break;
    case 'bowmaker': drawBowmaker(c, asset); break;
    case 'defensetower': drawDefenseTower(c, asset); break;
    case 'throne': drawThrone(c, asset); break;
    case 'item_palette': drawPalette(c, asset); break;
    default: drawGenericWorkshop(c, asset); break;
  }
  c.restore();
}

export function drawBuildingPreviewAsset(c, x, y, w, h, def) {
  const asset = BUILDING_ASSETS[def?.type] || { base: def?.color || '#6b766f', roof: '#303834', accent: '#d3a95f', trim: '#0e1512' };
  c.save();
  c.globalAlpha = .72;
  drawBuildingShell(c, x, y, w, h, asset, true);
  c.restore();
}

export function drawItemAsset(c, type) {
  c.save();
  c.strokeStyle = 'rgba(6,10,8,.72)';
  c.lineWidth = 1.5;
  c.fillStyle = getItemColor(type);
  switch (type) {
    case 'stone': drawStone(c); break;
    case 'tree_seed':
    case 'hemp_seed': drawSeed(c, type); break;
    case 'hemp': drawHempBundle(c); break;
    case 'bow': drawBow(c); break;
    case 'crude_axe': drawAxe(c); break;
    case 'crude_pickaxe': drawPickaxe(c); break;
    case 'crude_shovel': drawShovel(c); break;
    case 'wooden_sword': drawSword(c); break;
    case 'wooden_shield': drawShield(c); break;
    case 'log': drawLog(c); break;
    case 'plank': drawPlank(c); break;
    case 'pole': drawPole(c); break;
    case 'stick': drawStick(c); break;
    default: roundedRect(c, -9, -5, 18, 10, 3); c.fill(); c.stroke();
  }
  c.restore();
}

export function drawMiniItemAsset(c, type) {
  c.save();
  c.scale(.72, .72);
  drawItemAsset(c, type);
  c.restore();
}

export function drawHeldToolAsset(c, x, y, type) {
  if (!type) return;
  c.save();
  c.translate(x, y);
  c.rotate(-0.75);
  c.scale(.86, .86);
  if (type === 'crude_pickaxe') drawPickaxe(c);
  else if (type === 'crude_shovel') drawShovel(c);
  else if (type === 'wooden_sword') drawSword(c);
  else if (type === 'wooden_shield') drawShield(c);
  else if (type === 'bow') drawBow(c);
  else drawAxe(c);
  c.restore();
}

function drawBuildingShell(c, x, y, w, h, asset, hover) {
  const grad = c.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, lighten(asset.base, .18));
  grad.addColorStop(.58, asset.base);
  grad.addColorStop(1, darken(asset.base, .22));
  c.fillStyle = grad;
  c.strokeStyle = hover ? '#fff4d0' : 'rgba(14,20,17,.92)';
  c.lineWidth = hover ? 3 : 1.5;
  roundedRect(c, x, y + h * .14, w, h * .82, 8); c.fill(); c.stroke();

  c.fillStyle = darken(asset.roof, .08);
  c.beginPath();
  c.moveTo(x + 8, y + h * .18);
  c.lineTo(x + w * .25, y - 3);
  c.lineTo(x + w * .76, y - 3);
  c.lineTo(x + w - 8, y + h * .18);
  c.closePath(); c.fill(); c.stroke();

  c.fillStyle = 'rgba(255,255,255,.10)';
  roundedRect(c, x + 7, y + h * .23, w - 14, Math.max(7, h * .17), 5); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
  for (let px = x + 16; px < x + w - 8; px += 18) { c.beginPath(); c.moveTo(px, y + h * .23); c.lineTo(px, y + h * .94); c.stroke(); }
}

function drawSawbench(c, asset) {
  c.fillStyle = asset.accent; roundedRect(c, -31, -5, 62, 12, 4); c.fill(); c.stroke();
  c.strokeStyle = asset.trim; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-28, -14); c.lineTo(28, -14); c.moveTo(-22, 17); c.lineTo(-12, -2); c.moveTo(22, 17); c.lineTo(12, -2); c.stroke();
  c.strokeStyle = '#e8dfc8'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-24, -2); c.lineTo(24, -2); c.stroke();
}

function drawWorkbench(c, asset) {
  c.fillStyle = asset.accent; roundedRect(c, -28, -12, 56, 13, 4); c.fill(); c.stroke();
  c.strokeStyle = asset.trim; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-22, 15); c.lineTo(-15, 1); c.moveTo(22, 15); c.lineTo(15, 1); c.stroke();
  drawAxe(c, -10, 2, .75, .72); drawShovel(c, 13, 4, .58, .55);
}

function drawFactory(c, asset, now) {
  c.fillStyle = 'rgba(9,14,12,.64)'; roundedRect(c, -27, -11, 54, 30, 5); c.fill(); c.stroke();
  c.fillStyle = asset.accent; c.fillRect(-21, -25, 8, 15); c.fillRect(9, -29, 8, 19);
  c.fillStyle = `rgba(232,238,232,${.14 + .10 * Math.sin(now / 450)})`;
  c.beginPath(); c.arc(22, -32, 7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#b7c2ba'; c.lineWidth = 2; c.beginPath(); c.moveTo(-17, 5); c.lineTo(17, 5); c.moveTo(-9, -4); c.lineTo(9, 14); c.stroke();
}

function drawSmithery(c, asset, now) {
  c.fillStyle = '#2b211d'; roundedRect(c, -26, -8, 52, 26, 5); c.fill(); c.stroke();
  const fire = .78 + .22 * Math.sin(now / 180);
  c.fillStyle = `rgba(225,116,63,${fire})`; c.beginPath(); c.ellipse(-12, 4, 8, 14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f4c25f'; c.beginPath(); c.ellipse(-12, 6, 4, 9, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#7e8580'; roundedRect(c, 2, -2, 25, 13, 5); c.fill(); c.stroke();
  drawSword(c, 12, -12, .72, -.55);
}

function drawBowmaker(c, asset) {
  c.strokeStyle = asset.trim; c.lineWidth = 3;
  c.fillStyle = '#8fbf76'; roundedRect(c, -31, 10, 22, 10, 4); c.fill(); c.stroke();
  drawBow(c, 7, 0, 1.25);
  c.strokeStyle = '#e8dfc8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-2, -20); c.lineTo(25, 15); c.stroke();
}

function drawDefenseTower(c, asset) {
  c.fillStyle = '#2c332f'; roundedRect(c, -18, -31, 36, 52, 5); c.fill(); c.stroke();
  c.fillStyle = asset.base; c.fillRect(-23, 13, 46, 12); c.strokeRect(-23, 13, 46, 12);
  c.strokeStyle = asset.accent; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-25, -10); c.lineTo(25, -10); c.stroke();
  c.fillStyle = '#d3a95f'; c.beginPath(); c.moveTo(29, -10); c.lineTo(17, -15); c.lineTo(17, -5); c.closePath(); c.fill();
  for (let i = -1; i <= 1; i++) { c.fillStyle = '#111916'; c.fillRect(i * 10 - 2, -25, 4, 9); }
}

function drawThrone(c, asset) {
  c.fillStyle = asset.accent; roundedRect(c, -27, -14, 54, 37, 8); c.fill(); c.stroke();
  c.fillStyle = asset.roof; c.fillRect(-22, -29, 12, 20); c.fillRect(10, -29, 12, 20);
  c.fillStyle = '#fff0b9'; c.beginPath(); c.moveTo(-30, -30); c.lineTo(-21, -42); c.lineTo(-12, -30); c.lineTo(0, -45); c.lineTo(12, -30); c.lineTo(21, -42); c.lineTo(30, -30); c.closePath(); c.fill(); c.stroke();
}

function drawPalette(c, asset) {
  c.fillStyle = asset.accent; roundedRect(c, -27, -13, 54, 25, 4); c.fill(); c.stroke();
  c.strokeStyle = asset.trim; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, -4); c.lineTo(22, -4); c.moveTo(-22, 5); c.lineTo(22, 5); c.stroke();
  c.fillStyle = '#9a6034'; c.fillRect(-20, -12, 10, 7); c.fillStyle = '#a9b0aa'; c.beginPath(); c.arc(14, 5, 5, 0, Math.PI * 2); c.fill();
}

function drawGenericWorkshop(c, asset) {
  c.fillStyle = asset.accent; roundedRect(c, -18, -10, 36, 22, 5); c.fill(); c.stroke();
}

function drawLog(c) {
  const g = c.createLinearGradient(-13, -6, 13, 6); g.addColorStop(0, '#71411f'); g.addColorStop(1, '#b6773b'); c.fillStyle = g;
  roundedRect(c, -14, -6, 28, 12, 6); c.fill(); c.stroke();
  c.strokeStyle = '#ddb47b'; c.beginPath(); c.arc(-8, 0, 3, 0, Math.PI * 2); c.stroke();
}
function drawPlank(c) { c.fillStyle = '#d8aa63'; roundedRect(c, -14, -4, 28, 8, 2); c.fill(); c.stroke(); c.strokeStyle = '#8a5c2c'; c.beginPath(); c.moveTo(-9, 0); c.lineTo(10, 0); c.stroke(); }
function drawPole(c) { c.strokeStyle = '#c9b77d'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-12, 7); c.lineTo(12, -7); c.stroke(); c.strokeStyle = 'rgba(6,10,8,.72)'; c.lineWidth = 1; c.stroke(); }
function drawStick(c) { c.strokeStyle = '#a86f3c'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, 6); c.quadraticCurveTo(-2, -2, 10, -6); c.stroke(); }
function drawStone(c) { const g = c.createRadialGradient(-3, -4, 1, 0, 0, 8); g.addColorStop(0, '#d1d7d2'); g.addColorStop(1, '#6d7771'); c.fillStyle = g; c.beginPath(); c.moveTo(-8, 1); c.lineTo(-3, -7); c.lineTo(6, -6); c.lineTo(9, 3); c.lineTo(1, 8); c.closePath(); c.fill(); c.stroke(); }
function drawSeed(c, type) { c.fillStyle = type === 'hemp_seed' ? '#b8d58a' : '#a7d095'; c.beginPath(); c.ellipse(0, 0, 5, 7, -.5, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#f1f8dd'; c.beginPath(); c.arc(-1, -2, 1.3, 0, Math.PI * 2); c.fill(); }
function drawHempBundle(c) { c.fillStyle = '#8fbf76'; c.beginPath(); c.ellipse(0, 1, 10, 6, .15, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = '#d8f0c8'; c.beginPath(); c.moveTo(-6, -4); c.lineTo(4, 5); c.moveTo(0, -5); c.lineTo(8, 4); c.stroke(); }
function drawBow(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#5a341c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-5, -12); c.lineTo(5, -5); c.lineTo(5, 5); c.lineTo(-5, 12); c.stroke(); c.strokeStyle = '#e8d8b8'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-5, -12); c.lineTo(-5, 12); c.stroke(); c.restore(); }
function drawAxe(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#2f2118'; c.lineWidth = 6; c.beginPath(); c.moveTo(-10, 11); c.lineTo(8, -7); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#9aa3a3'; c.strokeStyle = '#3a4242'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(4, -14); c.lineTo(18, -11); c.lineTo(17, -3); c.lineTo(11, 2); c.lineTo(3, -2); c.lineTo(6, -7); c.lineTo(0, -8); c.lineTo(1, -12); c.closePath(); c.fill(); c.stroke(); c.restore(); }
function drawPickaxe(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#2f2118'; c.lineWidth = 6; c.beginPath(); c.moveTo(-8, 10); c.lineTo(7, -7); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#b0b7b6'; c.strokeStyle = '#414747'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-17, -12); c.lineTo(-2, -16); c.lineTo(17, -9); c.lineTo(16, -5); c.lineTo(1, -9); c.lineTo(-14, -7); c.closePath(); c.fill(); c.stroke(); c.restore(); }
function drawShovel(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#2f2118'; c.lineWidth = 5; c.beginPath(); c.moveTo(-7, -12); c.lineTo(4, 5); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#a4adad'; c.strokeStyle = '#3d4545'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(4, 4); c.lineTo(13, 8); c.lineTo(10, 17); c.lineTo(1, 13); c.lineTo(-1, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
function drawSword(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineJoin = 'miter'; c.fillStyle = '#b7c0c0'; c.strokeStyle = '#303838'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -16); c.lineTo(5, -11); c.lineTo(4, 5); c.lineTo(0, 9); c.lineTo(-4, 5); c.lineTo(-5, -11); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#6f4526'; c.fillRect(-3, 8, 6, 8); c.strokeRect(-3, 8, 6, 8); c.fillStyle = '#b38a3a'; c.fillRect(-9, 5, 18, 4); c.strokeRect(-9, 5, 18, 4); c.restore(); }
function drawShield(c) { c.fillStyle = '#9b6f3f'; c.beginPath(); c.moveTo(-9, -11); c.lineTo(9, -11); c.lineTo(11, 2); c.lineTo(5, 12); c.lineTo(0, 15); c.lineTo(-5, 12); c.lineTo(-11, 2); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#d3b16b'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 12); c.stroke(); }

function roundedRect(c, x, y, w, h, r) {
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); return; }
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath(); c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr); c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr); c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y);
}
function lighten(hex, amount) { return mix(hex, '#ffffff', amount); }
function darken(hex, amount) { return mix(hex, '#000000', amount); }
function mix(hex, target, amount) {
  const a = parseHex(hex), b = parseHex(target);
  const mixed = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}
function parseHex(hex) {
  const clean = String(hex).replace('#', '').slice(0, 6).padEnd(6, '0');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)].map(n => Number.isFinite(n) ? n : 0);
}
