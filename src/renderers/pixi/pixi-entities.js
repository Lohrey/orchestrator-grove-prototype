import {
  fillPath,
  strokePath,
  fillAndStrokePath,
  drawRoundedRect,
  drawBarGraphic,
  createText,
  getLookOffset,
  parseColor,
  isBotHandTool,
  getTreeDrawRadius
} from './pixi-layers.js?v=t_renderer_split_0627';
import { getDepthAnchorY } from '../../depth-sort.js?v=t_da28d8dd';
import { BUILDING_TYPES } from '../../data.js?v=t_building_kits_0618';
import { itemLabel } from '../../visual-assets.js?v=t_building_kits_0618';
import {
  getCharacterAnimationFrame,
  getCharacterFrameTexture
} from './pixi-character-assets.js?v=t_renderer_split_0627';
import {
  isDogSpriteReady,
  getDogSpriteAssets,
  getDogFrameTexture
} from './pixi-dog-spritesheet.js?v=t_dog_spritesheet_0627';

// ── Tree views ─────────────────────────────────────────────────────
export function createTreeView(PIXI, tree, getNameTagTexture) {
  const container = new PIXI.Container();
  container.sortableChildren = true;
  container.trunk = new PIXI.Graphics();
  container.foliage = new PIXI.Graphics();
  container.hoverRing = new PIXI.Graphics();
  container.label = new PIXI.Sprite(getNameTagTexture(''));
  container.label.anchor.set(0.5);
  container.label.visible = false;
  container.addChild(container.hoverRing, container.trunk, container.foliage, container.label);
  updateTreeView(container, tree, false, getNameTagTexture);
  return container;
}

export function updateTreeView(container, tree, hover, getNameTagTexture) {
  const radius = tree.radius || (tree.stump ? 14 : (tree.growthStage === 'sapling' ? 14 : 22));
  container.position.set(tree.x || 0, tree.y || 0);
  container.zIndex = getDepthAnchorY('tree', tree);
  container.hoverRing.clear();
  if (hover) {
    fillAndStrokePath(container.hoverRing, { fill: 0xfff4d0, fillAlpha: 0.15, stroke: 0xfff4d0, strokeWidth: 2 }, path => path.circle(0, 0, radius + 12));
  }
  container.trunk.clear();
  container.foliage.clear();
  if (tree.stump) {
    fillPath(container.trunk, 0x71411f, 1, path => path.ellipse(0, 6, radius, Math.max(6, radius * 0.45)));
    container.label.visible = hover;
    container.label.texture = getNameTagTexture('tree stump');
    container.label.position.set(0, -radius - 8);
    return;
  }
  fillPath(
    container.trunk,
    0x71411f,
    1,
    path => path.roundRect(-Math.max(4, radius * 0.18), -radius * 0.2, Math.max(8, radius * 0.36), radius * 1.3, 4)
  );

  const leafColor = tree.growthStage === 'sapling' ? 0x80b46d : tree.growthStage === 'small_tree' ? 0x5b8d49 : 0x46753d;
  fillPath(container.foliage, leafColor, 1, path => {
    path.circle(-radius * 0.34, -radius * 0.55, radius * 0.72);
    path.circle(radius * 0.34, -radius * 0.60, radius * 0.76);
    path.circle(0, -radius * 0.92, radius * 0.84);
  });
  container.label.visible = hover;
  if (hover) {
    container.label.texture = getNameTagTexture(tree.growthStage === 'sapling' ? 'small sapling' : tree.growthStage === 'small_tree' ? 'small tree' : 'grown tree');
    container.label.position.set(0, -radius - 18);
  }
}

// ── Hemp views ─────────────────────────────────────────────────────
export function createHempView(PIXI, hemp) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.label = createText(PIXI, 'hemp plant', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.graphics, container.label);
  updateHempView(container, hemp, false);
  return container;
}

export function updateHempView(container, hemp, hover) {
  const radius = hemp.radius || 14;
  container.position.set(hemp.x || 0, hemp.y || 0);
  container.zIndex = getDepthAnchorY('hemp', hemp);
  container.graphics.clear();
  fillAndStrokePath(container.graphics, { fill: 0x8fbf76, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0xd8f0c8, strokeWidth: 2 }, path => {
    path.ellipse(0, 2, radius * 0.8, radius * 0.44);
  });
  strokePath(container.graphics, hover ? 0xfff4d0 : 0xd8f0c8, 2, 1, path => {
    path.moveTo(-radius * 0.4, -radius * 0.3);
    path.lineTo(radius * 0.2, radius * 0.35);
    path.moveTo(0, -radius * 0.4);
    path.lineTo(radius * 0.5, radius * 0.28);
  });
  container.label.visible = hover;
  container.label.position.set(0, -radius - 10);
}

// ── Rock views ─────────────────────────────────────────────────────
export function createRockView(PIXI, rock, getNameTagTexture) {
  const container = new PIXI.Container();
  container.hoverRing = new PIXI.Graphics();
  container.graphics = new PIXI.Graphics();
  container.label = new PIXI.Sprite(getNameTagTexture(''));
  container.label.anchor.set(0.5);
  container.label.visible = false;
  container.addChild(container.hoverRing, container.graphics, container.label);
  updateRockView(container, rock, false, getNameTagTexture);
  return container;
}

export function updateRockView(container, rock, hover, getNameTagTexture) {
  const radius = rock.radius || 18;
  container.position.set(rock.x || 0, rock.y || 0);
  container.zIndex = getDepthAnchorY('rock', rock);
  container.hoverRing.clear();
  if (hover) {
    fillAndStrokePath(container.hoverRing, { fill: 0xfff4d0, fillAlpha: 0.08, stroke: 0xfff4d0, strokeWidth: 2 }, path => {
      path.ellipse(0, 0, radius + 13, radius + 9);
    });
  }
  container.graphics.clear();
  const depleted = rock.depleted;
  fillAndStrokePath(container.graphics, {
    fill: depleted ? 0x313733 : 0x6d7771, fillAlpha: 1,
    stroke: hover ? 0xfff4d0 : 0x3a4242, strokeWidth: hover ? 3 : 2
  }, path => {
    path.moveTo(-radius * 0.9, radius * 0.1);
    path.lineTo(-radius * 0.3, -radius * 0.75);
    path.lineTo(radius * 0.7, -radius * 0.65);
    path.lineTo(radius, radius * 0.2);
    path.lineTo(radius * 0.1, radius * 0.9);
    path.lineTo(-radius * 0.7, radius * 0.45);
    path.lineTo(-radius * 0.9, radius * 0.1);
  });
  container.label.visible = hover;
  if (hover) {
    container.label.texture = getNameTagTexture(depleted ? 'depleted stone deposit' : 'stone deposit');
    container.label.position.set(0, -radius - 16);
  }
}

// ── Structure views ────────────────────────────────────────────────
export function createStructureView(PIXI, structure, getBuildingTexture) {
  const container = new PIXI.Container();
  const hoverRing = new PIXI.Graphics();
  const shadow = new PIXI.Graphics();
  const sprite = new PIXI.Sprite();
  const label = createText(PIXI, '', { fontSize: 11, fontWeight: '700' });
  const subtitle = createText(PIXI, '', { fontSize: 10, fontWeight: '600', fill: '#ffe3a7' });
  const bars = new PIXI.Graphics();
  label.anchor.set(0.5, 0);
  subtitle.anchor.set(0.5, 0);
  container.hoverRing = hoverRing;
  container.shadow = shadow;
  container.sprite = sprite;
  container.label = label;
  container.subtitle = subtitle;
  container.bars = bars;
  container.addChild(shadow, hoverRing, sprite, label, subtitle, bars);
  updateStructureView(container, structure, false, getBuildingTexture);
  return container;
}

export function updateStructureView(container, structure, hover, getBuildingTexture) {
  const def = BUILDING_TYPES[structure.type] || { w: structure.w || 90, h: structure.h || 60 };
  const width = structure.w || def.w || 90;
  const height = structure.h || def.h || 60;
  container.position.set(structure.x || 0, structure.y || 0);
  container.zIndex = getDepthAnchorY('structure', { ...structure, h: height });
  container.shadow.clear();
  container.hoverRing.clear();
  container.bars.clear();
  fillPath(container.shadow, 0x000000, 0.22, path => path.ellipse(0, height * 0.24, width * 0.42, height * 0.18));
  if (structure.rangedAttack && hover) {
    strokePath(container.hoverRing, 0xd3a95f, 2, 0.32, path => path.circle(0, 0, structure.rangedAttack.range || 260));
  }
  container.sprite.texture = getBuildingTexture(structure.type, width, height, hover);
  container.sprite.anchor.set(0.5);
  container.label.visible = hover;
  container.subtitle.visible = hover;
  if (hover) {
    container.label.text = structure.name || BUILDING_TYPES[structure.type]?.label || structure.type;
    container.label.position.set(0, height * 0.48);
    container.subtitle.text = structureHoverLine(structure);
    container.subtitle.position.set(0, height * 0.48 + 16);
    if (structure.type === 'throne') {
      drawBarGraphic(
        container.bars,
        -42,
        height / 2 + 8,
        84,
        7,
        Math.max(0, structure.hp || 0) / Math.max(1, structure.maxHp || 120),
        structure.ownerId === 'p1' ? 0x80a9c9 : 0xc86b5f
      );
    }
    if (structure.processing) {
      drawBarGraphic(
        container.bars,
        -28,
        height / 2 + 8,
        56,
        6,
        1 - Math.max(0, structure.processing.remaining || 0) / Math.max(0.1, structure.processing.total || 1),
        0xd3a95f
      );
    }
  }
}

function structureHoverLine(structure) {
  if (structure.type === 'throne') return `${structure.ownerLabel || 'player'} · ${Math.max(0, Math.ceil(structure.hp ?? 0))}/${structure.maxHp || 120} HP`;
  if (['item_palette', 'power_station', 'robotics_parts_bin'].includes(structure.type)) return `${structure.storageType || 'empty'} ${structure.stored || 0}/${structure.capacity || 0}`;
  if (['camper_van', 'hammock_camp', 'ultrabook_desk', 'solar_array', 'portable_3d_printer', 'assembler'].includes(structure.type)) return structure.label || 'story object';
  if (structure.type === 'workbench') return `S${structure.sticks || 0} R${structure.stones || 0} ${(structure.workbenchRecipe || 'crude_axe').replace('crude_', '')}`;
  if (structure.type === 'factory') return `L${structure.logs || 0} P${structure.planks || 0} Po${structure.poles || 0} Se${structure.tree_seeds || 0}`;
  if (structure.type === 'smithery') return `S${structure.sticks || 0} P${structure.planks || 0} ${(structure.smitheryRecipe || 'wooden_sword').replace('wooden_', '')}`;
  if (structure.type === 'bowmaker') return `S${structure.sticks || 0}/2 H${structure.hemps || 0}/3 B${structure.bows || 0}`;
  if (structure.type === 'defensetower') return `R${structure.rangedAttack?.range || 260} · ${structure.rangedAttack?.damage || 1}/s`;
  return `L${structure.logs || 0} P${structure.planks || 0} Po${structure.poles || 0}`;
}

// ── Item views ─────────────────────────────────────────────────────
export function createItemView(PIXI, item, getItemTexture) {
  const container = new PIXI.Container();
  const hoverRing = new PIXI.Graphics();
  const shadow = new PIXI.Graphics();
  const sprite = new PIXI.Sprite(getItemTexture(item.type));
  const label = createText(PIXI, itemLabel(item.type), { fontSize: 11, fontWeight: '700' });
  sprite.anchor.set(0.5);
  label.anchor.set(0.5, 1);
  container.hoverRing = hoverRing;
  container.shadow = shadow;
  container.sprite = sprite;
  container.label = label;
  container.addChild(hoverRing, shadow, sprite, label);
  updateItemView(container, item, false, getItemTexture);
  return container;
}

export function updateItemView(container, item, hover, getItemTexture) {
  const bob = Math.sin(performance.now() / 400 + (item.bob || 0)) * 2;
  container.position.set(item.x || 0, (item.y || 0) + bob);
  container.zIndex = getDepthAnchorY('item', item, { bob });
  container.hoverRing.clear();
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.24, path => path.ellipse(0, 9, 11, 4));
  if (hover) {
    fillAndStrokePath(container.hoverRing, { fill: 0xfff4d0, fillAlpha: 0.20, stroke: 0xfff4d0, strokeWidth: 2 }, path => path.circle(0, 0, 17));
  }
  container.sprite.texture = getItemTexture(item.type);
  container.label.visible = hover;
  container.label.position.set(0, -24);
}

// ── Monster views ──────────────────────────────────────────────────
export function createMonsterView(PIXI, monster) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.health = new PIXI.Graphics();
  container.label = createText(PIXI, monster.name || 'passive monster', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.graphics, container.health, container.label);
  updateMonsterView(container, monster, false);
  return container;
}

export function updateMonsterView(container, monster, hover) {
  const radius = monster.radius || 18;
  container.position.set(monster.x || 0, monster.y || 0);
  container.zIndex = getDepthAnchorY('monster', monster);
  container.graphics.clear();
  if (hover) {
    fillPath(container.graphics, 0xfff4d0, 0.18, path => path.circle(0, 0, radius + 8));
  }
  const body = monster.type === 'night_monster' ? 0x6b3f2f : 0x344d47;
  fillAndStrokePath(container.graphics, { fill: body, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0x0d1714, strokeWidth: hover ? 3 : 2 }, path => {
    path.ellipse(0, 0, radius, radius * 0.82);
  });
  fillPath(container.graphics, monster.type === 'night_monster' ? 0xffd982 : 0xe5ece8, 1, path => {
    path.circle(-radius * 0.33, -radius * 0.1, 3.2);
    path.circle(radius * 0.33, -radius * 0.1, 3.2);
  });
  container.health.clear();
  drawBarGraphic(container.health, -20, -radius - 16, 40, 5, (monster.hp || 0) / Math.max(1, monster.maxHp || 10), 0x8fb9b5);
  container.label.visible = hover;
  if (hover) container.label.position.set(0, -radius - 26);
}

// ── Bot views ──────────────────────────────────────────────────────
export function createBotView(PIXI, bot, getItemTexture, getToolTexture) {
  const isDog = bot.kind === 'dog';
  return isDog ? createDogView(PIXI, bot, getItemTexture) : createWorkerBotView(PIXI, bot, getItemTexture, getToolTexture);
}

function createWorkerBotView(PIXI, bot, getItemTexture, getToolTexture) {
  const container = new PIXI.Container();
  container.shadow = new PIXI.Graphics();
  container.body = new PIXI.Graphics();
  container.inventory = new PIXI.Sprite();
  container.inventory.anchor.set(0.5);
  container.toolRight = new PIXI.Sprite();
  container.toolRight.anchor.set(0.5);
  container.toolLeft = new PIXI.Sprite();
  container.toolLeft.anchor.set(0.5);
  container.label = createText(PIXI, bot.name || `Bot ${bot.id}`, { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.shadow, container.body, container.inventory, container.toolRight, container.toolLeft, container.label);
  updateBotView(container, bot, false, getItemTexture, getToolTexture);
  return container;
}

function createDogView(PIXI, bot, getItemTexture) {
  const container = new PIXI.Container();
  container.shadow = new PIXI.Graphics();
  container.body = new PIXI.Graphics();
  // Spritesheet sprite (hidden until assets are ready)
  container.sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  container.sprite.anchor.set(0.5, 0.85);
  container.sprite.visible = false;
  container.inventory = new PIXI.Sprite();
  container.inventory.anchor.set(0.5);
  container.label = createText(PIXI, bot.name || 'Dog', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 0);
  container.addChild(container.shadow, container.body, container.sprite, container.inventory, container.label);
  updateBotView(container, bot, false, getItemTexture, () => null);
  return container;
}

export function updateBotView(container, bot, hover, getItemTexture, getToolTexture) {
  if (bot.kind === 'dog') {
    updateDogView(container, bot, hover, getItemTexture);
    return;
  }
  const radius = bot.r || 11;
  const bodyColor = parseColor(bot.color || '#76b77f');
  const facingRight = (bot.facingX ?? 1) >= 0;
  const inventoryIsHandTool = isBotHandTool(bot.inventory?.type);
  const handToolTypes = inventoryIsHandTool ? [bot.inventory?.type] : [];
  container.position.set(bot.x || 0, bot.y || 0);
  container.zIndex = getDepthAnchorY('bot', bot);
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.26, path => path.ellipse(0, radius + 5, radius + 8, 5));
  container.body.clear();
  fillAndStrokePath(container.body, { fill: bodyColor, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0x0e1512, strokeWidth: hover ? 4 : 2 }, path => {
    path.roundRect(-radius - 2, -radius - 2, (radius + 2) * 2, (radius + 2) * 2, 8);
  });
  fillPath(container.body, 0xffffff, 0.22, path => {
    path.roundRect(-radius + 2, -radius + 2, radius * 1.4, radius * 0.58, 5);
  });
  container.inventory.visible = !!(bot.inventory?.type) && !inventoryIsHandTool;
  if (bot.inventory?.type && !inventoryIsHandTool) {
    container.inventory.texture = getItemTexture(bot.inventory.type);
    container.inventory.position.set(-1, -24);
    container.inventory.scale.set(0.72);
  }
  container.toolRight.visible = handToolTypes.length > 0 || !!bot.equipment?.weapon;
  container.toolLeft.visible = !!bot.equipment?.shield;
  if (handToolTypes.length > 0 || bot.equipment?.weapon) {
    container.toolRight.texture = getToolTexture(handToolTypes[0] || bot.equipment.weapon);
    container.toolRight.position.set((facingRight ? 1 : -1) * (radius + 8), 5);
    container.toolRight.scale.set(0.86);
  }
  if (handToolTypes[1] || bot.equipment?.shield) {
    container.toolLeft.texture = getToolTexture(handToolTypes[1] || bot.equipment.shield);
    container.toolLeft.position.set(-17, -7);
    container.toolLeft.scale.set(0.86);
    container.toolLeft.visible = true;
  }
  container.label.visible = hover;
  if (hover) {
    container.label.text = bot.name || `Bot ${bot.id}`;
    container.label.position.set(0, -radius - 24);
  }
}

function updateDogView(container, bot, hover, getItemTexture) {
  const radius = bot.r || 12;
  const now = performance.now();
  container.position.set(bot.x || 0, bot.y || 0);
  container.zIndex = getDepthAnchorY('bot', bot);
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.25, path => path.ellipse(0, radius + 6, radius + 9, 5));

  // Determine if dog is moving (has a target/destination)
  const isMoving = !!(bot.target || bot.dogFetchState || (bot.vx && bot.vy && (Math.abs(bot.vx) > 0.1 || Math.abs(bot.vy) > 0.1)));

  // Try spritesheet rendering first
  const dogAssets = getDogSpriteAssets();
  if (dogAssets && dogAssets.ready && dogAssets.textures.length > 0) {
    // Show sprite, hide vector body
    container.sprite.visible = true;
    container.body.visible = false;

    // Animate walk cycle
    const frameTexture = getDogFrameTexture(container.sprite, dogAssets, isMoving, now);
    if (frameTexture) {
      container.sprite.texture = frameTexture;
    }

    // Scale relative to bot radius
    const spriteScale = (radius / 12) * 0.38;
    container.sprite.scale.set(spriteScale);

    // Flip sprite if facing left
    const facingRight = (bot.facingX ?? 1) >= 0;
    container.sprite.scale.x = facingRight ? spriteScale : -spriteScale;

    // Position sprite centered on the dog
    container.sprite.position.set(0, 0);
  } else {
    // Vector fallback rendering
    container.sprite.visible = false;
    container.body.visible = true;
    container.body.clear();
    if (hover) {
      fillPath(container.body, 0xfff4d0, 0.15, path => path.circle(0, 0, radius + 10));
    }
    fillAndStrokePath(container.body, { fill: 0x8a6246, fillAlpha: 1, stroke: hover ? 0xfff4d0 : 0x3c281f, strokeWidth: hover ? 3 : 2 }, path => {
      path.roundRect(-radius - 3, -radius + 2, (radius + 3) * 2, radius * 1.45, 8);
    });
    fillPath(container.body, 0x9d7457, 1, path => path.ellipse(0, -radius * 0.2, radius * 0.95, radius * 0.78));
  }

  container.inventory.visible = !!bot.inventory?.type;
  if (bot.inventory?.type) {
    container.inventory.texture = getItemTexture(bot.inventory.type);
    container.inventory.position.set(0, -radius * 1.75);
    container.inventory.scale.set(0.72);
  }
  container.label.text = bot.name || 'Dog';
  container.label.position.set(0, radius + 10);
  container.label.visible = true;
}

// ── Actor views (player) ───────────────────────────────────────────
export function createActorView(PIXI, options) {
  const container = new PIXI.Container();
  container.shadow = new PIXI.Graphics();
  container.body = new PIXI.Graphics();
  container.character = null;
  container.inventory = new PIXI.Sprite();
  container.inventory.anchor.set(0.5);
  container.weapon = new PIXI.Sprite();
  container.weapon.anchor.set(0.5);
  container.shield = new PIXI.Sprite();
  container.shield.anchor.set(0.5);
  container.label = createText(PIXI, options.label || '', { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.shadow, container.body, container.inventory, container.weapon, container.shield, container.label);
  return { container, options };
}

export function updateActorView(PIXI, view, actorState, getItemTexture, getToolTexture) {
  const { container } = view;
  const radius = actorState.radius || 13;
  container.position.set(actorState.x || 0, actorState.y || 0);
  container.zIndex = actorState.zIndex || 0;
  container.shadow.clear();
  fillPath(container.shadow, 0x000000, 0.28, path => path.ellipse(0, radius + 5, radius + 8, 5));
  const animation = getCharacterAnimationFrame(view.options.characterAssets, actorState);
  if (animation) {
    if (!container.character) {
      container.character = new PIXI.Sprite(animation.textures[0]);
      container.character.anchor.set(0.5, 1);
      container.character.visible = false;
      container.addChildAt(container.character, 1);
    }
    container.character.visible = true;
    container.body.visible = false;
    const frameTexture = getCharacterFrameTexture(container.character, animation, actorState);
    if (frameTexture) container.character.texture = frameTexture;
    container.character.scale.set(animation.scale);
    container.character.position.set(0, animation.yOffset);
    container.character.anchor.set(0.5, 1);
  } else {
    if (container.character) container.character.visible = false;
    container.body.visible = true;
    container.body.clear();
    fillAndStrokePath(container.body, { fill: actorState.bodyColor, fillAlpha: 1, stroke: 0x26322d, strokeWidth: 2 }, path => path.circle(0, 0, radius + 1));
    const look = getLookOffset(actorState.facingX, actorState.facingY, 4);
    fillPath(container.body, actorState.accentColor, 1, path => path.circle(look.x, -3 + look.y, 3));
  }
  container.inventory.visible = !!actorState.inventoryType;
  if (actorState.inventoryType) {
    container.inventory.texture = getItemTexture(actorState.inventoryType);
    container.inventory.position.set(0, -25);
    container.inventory.scale.set(0.72);
  }
  container.weapon.visible = !!actorState.weaponType;
  if (actorState.weaponType) {
    container.weapon.texture = getToolTexture(actorState.weaponType);
    container.weapon.position.set(19, -5);
    container.weapon.scale.set(0.86);
  }
  container.shield.visible = !!actorState.shieldType;
  if (actorState.shieldType) {
    container.shield.texture = getToolTexture(actorState.shieldType);
    container.shield.position.set(-18, -5);
    container.shield.scale.set(0.86);
  }
}

// ── Assistant view ─────────────────────────────────────────────────
export function createAssistantView(PIXI) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.addChild(container.graphics);
  return { container };
}

export function updateAssistantView(view, assistant, zIndex) {
  const g = view.container.graphics;
  const look = getLookOffset(assistant.facingX || 1, assistant.facingY || 0, 2.8);
  const radius = 9 + Math.sin(performance.now() / 500) * 1;
  view.container.position.set(assistant.x || 0, assistant.y || 0);
  view.container.zIndex = zIndex;
  g.clear();
  fillPath(g, 0x76b77f, 0.16, path => path.circle(0, 0, radius + 7));
  fillPath(g, 0x76b77f, 1, path => path.circle(0, 0, radius));
  fillPath(g, 0xe6f4e5, 1, path => path.circle(look.x, -3 + look.y, 2));
}

// ── Remote player views ────────────────────────────────────────────
export function createRemotePlayerView(PIXI, player) {
  const container = new PIXI.Container();
  container.graphics = new PIXI.Graphics();
  container.label = createText(PIXI, player.label || player.id, { fontSize: 11, fontWeight: '700' });
  container.label.anchor.set(0.5, 1);
  container.addChild(container.graphics, container.label);
  updateRemotePlayerView(container, player);
  return container;
}

export function updateRemotePlayerView(container, player) {
  const color = player.id === 'p1' ? 0x80a9c9 : 0xc86b5f;
  container.position.set(player.x || 0, player.y || 0);
  container.zIndex = getDepthAnchorY('remote_player', player);
  container.graphics.clear();
  fillPath(container.graphics, 0x000000, 0.24, path => path.ellipse(0, 18, 22, 7));
  fillAndStrokePath(container.graphics, { fill: color, fillAlpha: 1, stroke: 0xfff4d0, strokeWidth: 2.5 }, path => path.circle(0, 0, 15));
  container.label.text = player.label || (player.id === 'p1' ? 'Player 1' : 'Player 2');
  container.label.position.set(0, -27);
}

// ── Floater views ──────────────────────────────────────────────────
export function createFloaterView(PIXI, floater) {
  const container = createText(PIXI, floater.text || '', { fontSize: 12, fontWeight: '800' });
  container.anchor.set(0.5);
  updateFloaterView(container, floater);
  return container;
}

export function updateFloaterView(container, floater) {
  container.text = floater.text || '';
  container.position.set(floater.x || 0, floater.y || 0);
  container.alpha = Math.max(0, Math.min(1, (floater.life || 0) / Math.max(1, floater.max || 1)));
  container.zIndex = 1000000 + (floater.y || 0);
  container.style.fill = floater.color || '#d3a95f';
}

// ── Projectile draw ────────────────────────────────────────────────
export function drawProjectile(graphics, projectile) {
  graphics.clear();
  graphics.position.set(projectile.x || 0, projectile.y || 0);
  graphics.zIndex = getDepthAnchorY('projectile', projectile);
  const angle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
  graphics.rotation = angle;
  strokePath(graphics, 0xf1dfb8, 2, 1, path => {
    path.moveTo(-8, 0);
    path.lineTo(8, 0);
  });
  fillAndStrokePath(
    graphics,
    { fill: 0xd3a95f, fillAlpha: 1, stroke: 0xd3a95f, strokeWidth: 1 },
    path => {
      path.moveTo(10, 0);
      path.lineTo(3, -3);
      path.lineTo(3, 3);
      path.lineTo(10, 0);
    }
  );
}
