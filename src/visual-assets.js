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
  crude_hammer: { label: 'crude hammer', color: '#c7b683' },
  wooden_sword: { label: 'wooden sword', color: '#c7b683' },
  wooden_shield: { label: 'wooden shield', color: '#a88755' },
  hemp: { label: 'hemp', color: '#8fbf76' },
  hemp_seed: { label: 'hemp seed', color: '#b8d58a' },
  bow: { label: 'bow', color: '#cda66d' },
  arrow_pack: { label: 'arrow pack', color: '#d3a95f' },
  camper_van: { label: 'white camper van', color: '#edf3ef' },
  hammock: { label: 'hammock', color: '#80a9c9' },
  ultrabook: { label: 'ultrabook laptop', color: '#b7c2ba' },
  solar_panel: { label: 'solar panel', color: '#4b6f78' },
  power_station: { label: 'power station', color: '#d3a95f' },
  portable_3d_printer: { label: 'portable 3d printer', color: '#d8ded9' },
  assembler: { label: 'portable assembler', color: '#9abf8f' },
  robotics_parts: { label: 'DIY robotics parts', color: '#c7b683' }
};

const BUILDING_ASSETS = {
  sawbench: { base: '#8a6a3d', roof: '#5d341d', accent: '#d8aa63', trim: '#2f1c12' },
  workbench: { base: '#735f43', roof: '#4e3b28', accent: '#d0bf86', trim: '#26322d' },
  factory: { base: '#637772', roof: '#2c3835', accent: '#d3a95f', trim: '#111916' },
  smithery: { base: '#6f6760', roof: '#3f332e', accent: '#e1743f', trim: '#1f2723' },
  bowmaker: { base: '#5f7054', roof: '#3f4d35', accent: '#cda66d', trim: '#1f2723' },
  arrowmaker: { base: '#6a7356', roof: '#404636', accent: '#d3a95f', trim: '#1f2723' },
  defensetower: { base: '#5b625d', roof: '#2c332f', accent: '#e6d6a8', trim: '#141b18' },
  throne: { base: '#8a6a42', roof: '#6f4428', accent: '#ffe3a7', trim: '#251a10' },
  item_palette: { base: '#6f7661', roof: '#4b523f', accent: '#d8aa63', trim: '#5d341d' },
  camper_van: { base: '#edf3ef', roof: '#cfd8d3', accent: '#80a9c9', trim: '#17201d' },
  hammock_camp: { base: '#4b6b52', roof: '#253a2b', accent: '#80a9c9', trim: '#2f2118' },
  ultrabook_desk: { base: '#766a58', roof: '#3a332a', accent: '#b7c2ba', trim: '#1a211f' },
  solar_array: { base: '#4b6f78', roof: '#20343a', accent: '#9fd4d9', trim: '#111916' },
  power_station: { base: '#5f625d', roof: '#30342f', accent: '#d3a95f', trim: '#151a17' },
  portable_3d_printer: { base: '#d8ded9', roof: '#94a09a', accent: '#80a9c9', trim: '#26322d' },
  assembler: { base: '#6d7c62', roof: '#3f4a37', accent: '#9abf8f', trim: '#20291f' },
  robotics_parts_bin: { base: '#766c54', roof: '#514532', accent: '#c7b683', trim: '#2a2118' }
};

export function itemLabel(type) {
  if (isBuildingKitType(type)) return `${buildingLabelFromKit(type)} kit`;
  return ITEM_PALETTE[type]?.label || type;
}

export function getItemColor(type) {
  if (isBuildingKitType(type)) return BUILDING_ASSETS[buildingTypeFromKit(type)]?.accent || '#d3a95f';
  return ITEM_PALETTE[type]?.color || '#d3a95f';
}

function buildingTypeFromKit(type) {
  const match = String(type || '').match(/^(.+)_kit$/);
  return match?.[1] && BUILDING_ASSETS[match[1]] ? match[1] : null;
}

function isBuildingKitType(type) { return !!buildingTypeFromKit(type); }

function buildingLabelFromKit(type) {
  return String(buildingTypeFromKit(type) || '').replace(/_/g, ' ');
}

export function drawBuildingAsset(c, structure, def, { hover = false, now = 0 } = {}) {
  const asset = BUILDING_ASSETS[structure.type] || { base: def?.color || '#6b766f', roof: '#303834', accent: '#d3a95f', trim: '#0e1512' };
  c.save();
  c.translate(structure.x, structure.y);
  const w = structure.w || def?.w || 90;
  const h = structure.h || def?.h || 60;
  switch (structure.type) {
    case 'sawbench': drawSawbench(c, asset, w, h, hover); break;
    case 'workbench': drawWorkbench(c, asset, w, h, hover); break;
    case 'factory': drawFactory(c, asset, w, h, hover, now); break;
    case 'smithery': drawSmithery(c, asset, w, h, hover, now); break;
    case 'bowmaker': drawBowmaker(c, asset, w, h, hover); break;
    case 'arrowmaker': drawArrowmaker(c, asset, w, h, hover); break;
    case 'defensetower': drawDefenseTower(c, asset, w, h, hover); break;
    case 'throne': drawThrone(c, asset, w, h, hover); break;
    case 'item_palette': drawPalette(c, asset, w, h, hover); break;
    case 'camper_van': drawCamperVanBuilding(c, asset, w, h, hover); break;
    case 'hammock_camp': drawHammockCamp(c, asset, w, h, hover); break;
    case 'ultrabook_desk': drawUltrabookDesk(c, asset, w, h, hover); break;
    case 'solar_array': drawSolarArray(c, asset, w, h, hover); break;
    case 'power_station': drawPowerStation(c, asset, w, h, hover); break;
    case 'portable_3d_printer': drawPortablePrinter(c, asset, w, h, hover); break;
    case 'assembler': drawAssemblerStation(c, asset, w, h, hover, now); break;
    case 'robotics_parts_bin': drawRoboticsPartsBin(c, asset, w, h, hover); break;
    default: drawGenericWorkshop(c, asset, w, h, hover); break;
  }
  c.restore();
}

export function drawBuildingPreviewAsset(c, x, y, w, h, def) {
  drawBuildingAsset(c, { type: def?.type, x: x + w / 2, y: y + h / 2, w, h }, def, { hover: true, now: 0 });
}

export function drawItemAsset(c, type) {
  if (isBuildingKitType(type)) return drawBuildingKitItem(c, type);
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
    case 'arrow_pack': drawArrowPack(c); break;
    case 'crude_axe': drawAxe(c); break;
    case 'crude_pickaxe': drawPickaxe(c); break;
    case 'crude_shovel': drawShovel(c); break;
    case 'crude_hammer': drawHammer(c); break;
    case 'wooden_sword': drawSword(c); break;
    case 'wooden_shield': drawShield(c); break;
    case 'log': drawLog(c); break;
    case 'plank': drawPlank(c); break;
    case 'pole': drawPole(c); break;
    case 'stick': drawStick(c); break;
    case 'camper_van': drawMiniCamper(c); break;
    case 'hammock': drawMiniHammock(c); break;
    case 'ultrabook': drawMiniLaptop(c); break;
    case 'solar_panel': drawMiniSolarPanel(c); break;
    case 'power_station': drawMiniBattery(c); break;
    case 'portable_3d_printer': drawMiniPrinter(c); break;
    case 'assembler': drawMiniAssembler(c); break;
    case 'robotics_parts': drawMiniParts(c); break;
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

function drawBuildingKitItem(c, type) {
  const buildingType = buildingTypeFromKit(type);
  const asset = BUILDING_ASSETS[buildingType] || { base: getItemColor(type), roof: '#303834', accent: '#d3a95f', trim: '#0e1512' };
  c.save();
  c.scale(.24, .24);
  drawBuildingAsset(c, { type: buildingType, x: 0, y: 0, w: 76, h: 54 }, { type: buildingType, w: 76, h: 54, color: asset.base }, { hover: false, now: 0 });
  c.restore();
  c.save();
  c.strokeStyle = 'rgba(6,10,8,.72)';
  c.lineWidth = 1.2;
  c.fillStyle = 'rgba(255,244,208,.78)';
  roundedRect(c, -11, 5, 22, 7, 2);
  c.fill();
  c.stroke();
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
  else if (type === 'crude_hammer') drawHammer(c);
  else if (type === 'wooden_sword') drawSword(c);
  else if (type === 'wooden_shield') drawShield(c);
  else if (type === 'bow') drawBow(c);
  else drawAxe(c);
  c.restore();
}

function styleBuilding(c, asset, hover, lineWidth = 1.6) {
  c.strokeStyle = hover ? '#fff4d0' : 'rgba(14,20,17,.92)';
  c.lineWidth = hover ? lineWidth + 1.4 : lineWidth;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  return c.strokeStyle;
}

function drawSawbench(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = darken(asset.base, .16);
  roundedRect(c, -w * .42, h * .08, w * .84, h * .20, 5); c.fill(); c.stroke();
  c.strokeStyle = asset.trim; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-w * .34, h * .28); c.lineTo(-w * .22, h * .46); c.moveTo(w * .34, h * .28); c.lineTo(w * .22, h * .46); c.moveTo(-w * .28, -h * .20); c.lineTo(w * .28, -h * .20); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .36, -h * .12, w * .72, h * .20, 4); c.fill(); styleBuilding(c, asset, hover); c.stroke();
  c.strokeStyle = '#e8dfc8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-w * .28, -h * .03); c.lineTo(w * .28, -h * .03); c.stroke();
}

function drawWorkbench(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.roof;
  c.beginPath(); c.moveTo(-w * .44, -h * .12); c.lineTo(-w * .18, -h * .36); c.lineTo(w * .43, -h * .34); c.lineTo(w * .32, -h * .03); c.lineTo(-w * .28, h * .02); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = asset.base; roundedRect(c, -w * .36, -h * .02, w * .72, h * .38, 7); c.fill(); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .30, -h * .11, w * .60, h * .18, 4); c.fill(); c.stroke();
  drawAxe(c, -w * .14, h * .03, .58, -.65); drawShovel(c, w * .15, h * .06, .48, .55);
}

function drawFactory(c, asset, w, h, hover, now) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.rect(-w * .45, -h * .10, w * .70, h * .52); c.rect(w * .10, -h * .28, w * .32, h * .70); c.fill(); c.stroke();
  c.fillStyle = asset.roof; c.fillRect(-w * .41, -h * .20, w * .52, h * .14); c.fillRect(w * .15, -h * .38, w * .18, h * .18); styleBuilding(c, asset, hover); c.strokeRect(-w * .41, -h * .20, w * .52, h * .14);
  c.fillStyle = `rgba(232,238,232,${.16 + .10 * Math.sin(now / 450)})`; c.beginPath(); c.arc(w * .30, -h * .45, h * .10, 0, Math.PI * 2); c.fill();
  c.strokeStyle = asset.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * .29, h * .10); c.lineTo(w * .26, h * .10); c.moveTo(-w * .16, -h * .02); c.lineTo(w * .09, h * .28); c.stroke();
}

function drawSmithery(c, asset, w, h, hover, now) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.moveTo(-w * .45, h * .32); c.lineTo(-w * .36, -h * .17); c.lineTo(-w * .08, -h * .34); c.lineTo(w * .38, -h * .22); c.lineTo(w * .43, h * .32); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#2b211d'; roundedRect(c, -w * .34, -h * .06, w * .48, h * .36, 5); c.fill(); c.stroke();
  const fire = .78 + .22 * Math.sin(now / 180);
  c.fillStyle = `rgba(225,116,63,${fire})`; c.beginPath(); c.ellipse(-w * .18, h * .11, w * .09, h * .18, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f4c25f'; c.beginPath(); c.ellipse(-w * .18, h * .13, w * .04, h * .11, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#7e8580'; roundedRect(c, w * .04, h * .01, w * .24, h * .18, 5); c.fill(); c.stroke();
}

function drawBowmaker(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.ellipse(0, h * .03, w * .43, h * .40, 0, Math.PI, 0); c.lineTo(w * .43, h * .34); c.lineTo(-w * .43, h * .34); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = asset.roof; roundedRect(c, -w * .40, h * .21, w * .80, h * .12, 5); c.fill(); c.stroke();
  c.fillStyle = '#8fbf76'; roundedRect(c, -w * .33, h * .11, w * .23, h * .14, 4); c.fill(); c.stroke();
  drawBow(c, w * .10, h * .04, 1.25);
  c.strokeStyle = '#e8dfc8'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-w * .04, -h * .23); c.lineTo(w * .28, h * .18); c.stroke();
}

function drawArrowmaker(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.moveTo(-w * .44, h * .28); c.lineTo(-w * .28, -h * .28); c.lineTo(w * .30, -h * .22); c.lineTo(w * .44, h * .28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = asset.roof; roundedRect(c, -w * .35, -h * .12, w * .70, h * .18, 5); c.fill(); c.stroke();
  c.strokeStyle = asset.accent; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-w * .20, h * .02); c.lineTo(w * .20, h * .02); c.stroke();
  c.fillStyle = '#8fbf76'; roundedRect(c, -w * .25, h * .06, w * .18, h * .13, 4); c.fill(); c.stroke();
  drawMiniArrowPack(c, w * .12, h * .08, .95);
}

function drawDefenseTower(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.moveTo(-w * .25, h * .38); c.lineTo(-w * .18, -h * .34); c.lineTo(w * .18, -h * .34); c.lineTo(w * .25, h * .38); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = asset.roof; c.fillRect(-w * .33, -h * .45, w * .66, h * .18); c.strokeRect(-w * .33, -h * .45, w * .66, h * .18);
  c.strokeStyle = asset.accent; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-w * .34, -h * .10); c.lineTo(w * .36, -h * .10); c.stroke();
  c.fillStyle = '#d3a95f'; c.beginPath(); c.moveTo(w * .43, -h * .10); c.lineTo(w * .28, -h * .17); c.lineTo(w * .28, -h * .03); c.closePath(); c.fill();
  for (let i = -1; i <= 1; i++) { c.fillStyle = '#111916'; c.fillRect(i * w * .12 - 2, -h * .39, 4, h * .10); }
}

function drawThrone(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.accent; roundedRect(c, -w * .30, -h * .12, w * .60, h * .54, 8); c.fill(); c.stroke();
  c.fillStyle = asset.roof; c.fillRect(-w * .26, -h * .36, w * .12, h * .30); c.fillRect(w * .14, -h * .36, w * .12, h * .30);
  c.fillStyle = '#fff0b9'; c.beginPath(); c.moveTo(-w * .34, -h * .35); c.lineTo(-w * .24, -h * .49); c.lineTo(-w * .14, -h * .35); c.lineTo(0, -h * .52); c.lineTo(w * .14, -h * .35); c.lineTo(w * .24, -h * .49); c.lineTo(w * .34, -h * .35); c.closePath(); c.fill(); c.stroke();
}

function drawPalette(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.moveTo(-w * .44, -h * .10); c.lineTo(w * .38, -h * .28); c.lineTo(w * .43, h * .29); c.lineTo(-w * .36, h * .36); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .31, -h * .13, w * .62, h * .22, 4); c.fill(); c.stroke();
  c.strokeStyle = asset.trim; c.lineWidth = 2; c.beginPath(); c.moveTo(-w * .28, 0); c.lineTo(w * .29, 0); c.moveTo(-w * .22, h * .14); c.lineTo(w * .22, h * .14); c.stroke();
  c.fillStyle = '#9a6034'; c.fillRect(-w * .24, -h * .10, w * .12, h * .11); c.fillStyle = '#a9b0aa'; c.beginPath(); c.arc(w * .16, h * .12, h * .08, 0, Math.PI * 2); c.fill();
}

function drawCamperVanBuilding(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  const body = c.createLinearGradient(0, -h * .25, 0, h * .28); body.addColorStop(0, '#ffffff'); body.addColorStop(1, asset.base);
  c.fillStyle = body; roundedRect(c, -w * .45, -h * .20, w * .90, h * .44, 12); c.fill(); c.stroke();
  c.fillStyle = asset.roof; roundedRect(c, -w * .28, -h * .35, w * .45, h * .19, 7); c.fill(); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .28, -h * .14, w * .20, h * .16, 3); c.fill(); roundedRect(c, w * .02, -h * .14, w * .18, h * .16, 3); c.fill();
  c.fillStyle = '#1f2723'; c.beginPath(); c.arc(-w * .27, h * .28, h * .13, 0, Math.PI * 2); c.arc(w * .29, h * .28, h * .13, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#cfd8d3'; c.beginPath(); c.arc(-w * .27, h * .28, h * .06, 0, Math.PI * 2); c.arc(w * .29, h * .28, h * .06, 0, Math.PI * 2); c.fill();
}

function drawHammockCamp(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.strokeStyle = asset.trim; c.lineWidth = hover ? 4 : 3;
  c.beginPath(); c.moveTo(-w * .38, h * .34); c.lineTo(-w * .27, -h * .28); c.moveTo(w * .38, h * .34); c.lineTo(w * .27, -h * .28); c.stroke();
  c.fillStyle = asset.accent; c.beginPath(); c.moveTo(-w * .28, -h * .08); c.quadraticCurveTo(0, h * .28, w * .28, -h * .08); c.quadraticCurveTo(0, h * .12, -w * .28, -h * .08); c.fill(); styleBuilding(c, asset, hover); c.stroke();
  c.fillStyle = asset.base; roundedRect(c, -w * .17, -h * .38, w * .34, h * .13, 5); c.fill(); c.stroke();
}

function drawUltrabookDesk(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base; roundedRect(c, -w * .40, h * .05, w * .80, h * .23, 5); c.fill(); c.stroke();
  c.strokeStyle = asset.trim; c.lineWidth = 3; c.beginPath(); c.moveTo(-w * .32, h * .27); c.lineTo(-w * .38, h * .42); c.moveTo(w * .32, h * .27); c.lineTo(w * .38, h * .42); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .21, -h * .26, w * .42, h * .26, 4); c.fill(); c.stroke();
  c.fillStyle = '#20343a'; roundedRect(c, -w * .17, -h * .22, w * .34, h * .19, 2); c.fill();
  c.fillStyle = '#9fd4d9'; c.fillRect(-w * .05, -h * .19, w * .10, h * .02);
}

function drawSolarArray(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.save(); c.rotate(-0.18);
  c.fillStyle = asset.roof; roundedRect(c, -w * .42, -h * .28, w * .84, h * .48, 4); c.fill(); c.stroke();
  c.strokeStyle = asset.accent; c.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * w * .14, -h * .27); c.lineTo(i * w * .14, h * .19); c.stroke(); }
  for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(-w * .40, j * h * .12); c.lineTo(w * .40, j * h * .12); c.stroke(); }
  c.restore();
  c.strokeStyle = asset.trim; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h * .18); c.lineTo(0, h * .43); c.moveTo(-w * .18, h * .43); c.lineTo(w * .18, h * .43); c.stroke();
}

function drawPowerStation(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base; roundedRect(c, -w * .33, -h * .30, w * .66, h * .66, 8); c.fill(); c.stroke();
  c.fillStyle = asset.roof; roundedRect(c, -w * .18, -h * .41, w * .36, h * .15, 5); c.fill(); c.stroke();
  c.fillStyle = '#151a17'; roundedRect(c, -w * .20, -h * .14, w * .40, h * .18, 4); c.fill();
  c.fillStyle = asset.accent; c.fillRect(-w * .14, -h * .09, w * .21, h * .08); c.fillRect(w * .11, -h * .09, w * .05, h * .08);
  c.strokeStyle = '#9abf8f'; c.lineWidth = 2; c.beginPath(); c.arc(-w * .16, h * .19, h * .06, 0, Math.PI * 2); c.moveTo(w * .13, h * .14); c.lineTo(w * .13, h * .25); c.stroke();
}

function drawPortablePrinter(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.strokeStyle = hover ? '#fff4d0' : asset.trim; c.lineWidth = hover ? 4 : 3;
  roundedRect(c, -w * .32, -h * .31, w * .64, h * .60, 5); c.stroke();
  c.fillStyle = asset.base; roundedRect(c, -w * .25, h * .16, w * .50, h * .17, 4); c.fill(); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .17, -h * .20, w * .34, h * .11, 3); c.fill(); c.stroke();
  c.strokeStyle = '#9abf8f'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -h * .09); c.lineTo(0, h * .13); c.moveTo(-w * .10, h * .05); c.lineTo(w * .10, h * .05); c.stroke();
  c.fillStyle = '#d3a95f'; c.beginPath(); c.arc(0, h * .05, h * .05, 0, Math.PI * 2); c.fill();
}

function drawAssemblerStation(c, asset, w, h, hover, now) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base; roundedRect(c, -w * .43, h * .12, w * .86, h * .20, 5); c.fill(); c.stroke();
  const angle = Math.sin(now / 520) * .18;
  c.strokeStyle = asset.trim; c.lineWidth = 5; c.beginPath(); c.moveTo(-w * .08, h * .09); c.lineTo(-w * .01 + Math.sin(angle) * 4, -h * .15); c.lineTo(w * .23, -h * .28); c.stroke();
  c.fillStyle = asset.accent; c.beginPath(); c.arc(-w * .08, h * .09, h * .09, 0, Math.PI * 2); c.arc(w * .23, -h * .28, h * .07, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#c7b683'; roundedRect(c, w * .02, h * .00, w * .22, h * .12, 3); c.fill(); c.stroke();
}

function drawRoboticsPartsBin(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base;
  c.beginPath(); c.moveTo(-w * .40, -h * .13); c.lineTo(w * .36, -h * .24); c.lineTo(w * .44, h * .27); c.lineTo(-w * .34, h * .35); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = asset.roof; roundedRect(c, -w * .34, -h * .28, w * .68, h * .12, 4); c.fill(); c.stroke();
  drawMiniParts(c, -w * .10, -h * .04, .78);
  drawMiniBattery(c, w * .15, h * .02, .58);
  c.strokeStyle = asset.accent; c.lineWidth = 2; c.beginPath(); c.arc(w * .04, -h * .01, h * .08, 0, Math.PI * 2); c.stroke();
}

function drawGenericWorkshop(c, asset, w, h, hover) {
  styleBuilding(c, asset, hover);
  c.fillStyle = asset.base; roundedRect(c, -w * .36, -h * .22, w * .72, h * .56, 8); c.fill(); c.stroke();
  c.fillStyle = asset.accent; roundedRect(c, -w * .18, -h * .08, w * .36, h * .22, 5); c.fill(); c.stroke();
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
function drawArrowPack(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.strokeStyle = '#2f2118'; c.lineWidth = 1.4; c.fillStyle = '#d3a95f'; roundedRect(c, -11, -8, 22, 16, 3); c.fill(); c.stroke(); c.strokeStyle = '#8a5c2c'; c.lineWidth = 2.3; c.beginPath(); c.moveTo(-5, 5); c.lineTo(6, -5); c.moveTo(-6, -1); c.lineTo(5, -9); c.moveTo(-1, 8); c.lineTo(10, -2); c.stroke(); c.restore(); }
function drawAxe(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#2f2118'; c.lineWidth = 6; c.beginPath(); c.moveTo(-10, 11); c.lineTo(8, -7); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#9aa3a3'; c.strokeStyle = '#3a4242'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(4, -14); c.lineTo(18, -11); c.lineTo(17, -3); c.lineTo(11, 2); c.lineTo(3, -2); c.lineTo(6, -7); c.lineTo(0, -8); c.lineTo(1, -12); c.closePath(); c.fill(); c.stroke(); c.restore(); }
function drawPickaxe(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#2f2118'; c.lineWidth = 6; c.beginPath(); c.moveTo(-8, 10); c.lineTo(7, -7); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#b0b7b6'; c.strokeStyle = '#414747'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-17, -12); c.lineTo(-2, -16); c.lineTo(17, -9); c.lineTo(16, -5); c.lineTo(1, -9); c.lineTo(-14, -7); c.closePath(); c.fill(); c.stroke(); c.restore(); }
function drawShovel(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'miter'; c.strokeStyle = '#2f2118'; c.lineWidth = 5; c.beginPath(); c.moveTo(-7, -12); c.lineTo(4, 5); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#a4adad'; c.strokeStyle = '#3d4545'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(4, 4); c.lineTo(13, 8); c.lineTo(10, 17); c.lineTo(1, 13); c.lineTo(-1, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
function drawHammer(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineCap = 'square'; c.lineJoin = 'round'; c.strokeStyle = '#2f2118'; c.lineWidth = 6; c.beginPath(); c.moveTo(-8, 12); c.lineTo(6, -4); c.stroke(); c.strokeStyle = '#7b4a25'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#aeb5b0'; c.strokeStyle = '#3d4545'; c.lineWidth = 1.5; roundedRect(c, -9, -15, 23, 10, 3); c.fill(); c.stroke(); c.restore(); }
function drawSword(c, x = 0, y = 0, scale = 1, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(scale, scale); c.lineJoin = 'miter'; c.fillStyle = '#b7c0c0'; c.strokeStyle = '#303838'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -16); c.lineTo(5, -11); c.lineTo(4, 5); c.lineTo(0, 9); c.lineTo(-4, 5); c.lineTo(-5, -11); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#6f4526'; c.fillRect(-3, 8, 6, 8); c.strokeRect(-3, 8, 6, 8); c.fillStyle = '#b38a3a'; c.fillRect(-9, 5, 18, 4); c.strokeRect(-9, 5, 18, 4); c.restore(); }
function drawShield(c) { c.fillStyle = '#9b6f3f'; c.beginPath(); c.moveTo(-9, -11); c.lineTo(9, -11); c.lineTo(11, 2); c.lineTo(5, 12); c.lineTo(0, 15); c.lineTo(-5, 12); c.lineTo(-11, 2); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#d3b16b'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 12); c.stroke(); }

function drawMiniCamper(c) { c.fillStyle = '#edf3ef'; roundedRect(c, -15, -6, 30, 12, 5); c.fill(); c.stroke(); c.fillStyle = '#80a9c9'; c.fillRect(-8, -4, 7, 5); c.fillRect(4, -4, 7, 5); c.fillStyle = '#111916'; c.beginPath(); c.arc(-9, 7, 3, 0, Math.PI * 2); c.arc(10, 7, 3, 0, Math.PI * 2); c.fill(); }
function drawMiniHammock(c) { c.strokeStyle = '#2f2118'; c.lineWidth = 2; c.beginPath(); c.moveTo(-13, 9); c.lineTo(-9, -9); c.moveTo(13, 9); c.lineTo(9, -9); c.stroke(); c.fillStyle = '#80a9c9'; c.beginPath(); c.moveTo(-10, -2); c.quadraticCurveTo(0, 9, 10, -2); c.quadraticCurveTo(0, 3, -10, -2); c.fill(); c.stroke(); }
function drawMiniLaptop(c) { c.fillStyle = '#b7c2ba'; roundedRect(c, -10, -8, 20, 13, 2); c.fill(); c.stroke(); c.fillStyle = '#20343a'; c.fillRect(-7, -6, 14, 8); c.fillStyle = '#d8ded9'; roundedRect(c, -13, 4, 26, 5, 2); c.fill(); c.stroke(); }
function drawMiniSolarPanel(c) { c.fillStyle = '#20343a'; roundedRect(c, -13, -9, 26, 17, 2); c.fill(); c.stroke(); c.strokeStyle = '#9fd4d9'; c.lineWidth = 1; c.beginPath(); c.moveTo(-4, -8); c.lineTo(-4, 8); c.moveTo(5, -8); c.lineTo(5, 8); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke(); }
function drawMiniBattery(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.fillStyle = '#5f625d'; roundedRect(c, -9, -11, 18, 21, 3); c.fill(); c.stroke(); c.fillStyle = '#d3a95f'; c.fillRect(-4, -4, 8, 8); c.restore(); }
function drawMiniPrinter(c) { c.strokeStyle = '#26322d'; c.lineWidth = 2; roundedRect(c, -11, -12, 22, 22, 3); c.stroke(); c.fillStyle = '#d8ded9'; roundedRect(c, -8, 4, 16, 7, 2); c.fill(); c.stroke(); c.fillStyle = '#80a9c9'; c.fillRect(-5, -8, 10, 4); }
function drawMiniAssembler(c) { c.strokeStyle = '#20291f'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 8); c.lineTo(-3, -5); c.lineTo(10, -12); c.stroke(); c.fillStyle = '#9abf8f'; c.beginPath(); c.arc(-8, 8, 4, 0, Math.PI * 2); c.arc(10, -12, 3, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#c7b683'; roundedRect(c, -5, 4, 14, 7, 2); c.fill(); c.stroke(); }
function drawMiniArrowPack(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.fillStyle = '#d3a95f'; roundedRect(c, -8, -7, 16, 14, 2); c.fill(); c.stroke(); c.strokeStyle = '#8a5c2c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4, 4); c.lineTo(4, -4); c.moveTo(-5, 0); c.lineTo(3, -8); c.stroke(); c.restore(); }
function drawMiniParts(c, x = 0, y = 0, scale = 1) { c.save(); c.translate(x, y); c.scale(scale, scale); c.strokeStyle = '#2a2118'; c.lineWidth = 1.5; c.fillStyle = '#c7b683'; c.beginPath(); c.arc(-7, 0, 5, 0, Math.PI * 2); c.arc(7, -2, 4, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = '#9aa3a3'; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, 8); c.lineTo(12, 7); c.moveTo(0, -8); c.lineTo(10, -12); c.stroke(); c.restore(); }

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
