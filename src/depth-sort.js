const KIND_LAYER_BIAS = {
  ground_prop: 0,
  resource: 0,
  structure: 0,
  item: 0.05,
  actor: 0.1,
  projectile: 0.15,
  tree: 0.2
};

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function getDepthAnchorY(kind, entity = {}, options = {}) {
  if (Number.isFinite(options.sortY)) return options.sortY;
  const y = finiteNumber(entity.y);
  switch (kind) {
    case 'structure':
      return y + finiteNumber(entity.h, 48) * 0.42;
    case 'tree': {
      const radius = finiteNumber(entity.radius, entity.stump ? 14 : 22);
      if (entity.stump) return y + radius * 0.58;
      if (entity.growthStage === 'sapling') return y + radius * 0.78;
      return y + Math.max(16, radius * 0.82);
    }
    case 'rock':
      return y + finiteNumber(entity.radius, 18) * 0.64;
    case 'hemp':
      return y + finiteNumber(entity.radius, 14) * 0.72;
    case 'item':
      return y + finiteNumber(options.bob, entity._bob ?? 0) + finiteNumber(options.sortOffsetY, 10);
    case 'monster':
      return y + finiteNumber(entity.radius, 18) * 0.72;
    case 'bot':
      return y + finiteNumber(entity.r, 11) + 4;
    case 'player':
      return y + finiteNumber(entity.r, 13) + 4;
    case 'remote_player':
      return y + 18;
    case 'assistant':
      return y + 10;
    case 'projectile':
      return y + finiteNumber(options.sortOffsetY, 0);
    default:
      return y + finiteNumber(options.sortOffsetY, 0);
  }
}

export function getDepthAnchorX(entity = {}, options = {}) {
  if (Number.isFinite(options.sortX)) return options.sortX;
  return finiteNumber(entity.x);
}

export function createDepthDrawable(kind, entity, draw, options = {}) {
  const layer = finiteNumber(options.layer, KIND_LAYER_BIAS[kind] ?? 0);
  return {
    kind,
    entity,
    layer,
    sortY: getDepthAnchorY(kind, entity, options),
    sortX: getDepthAnchorX(entity, options),
    order: finiteNumber(options.order, 0),
    draw
  };
}

export function sortDepthDrawables(drawables) {
  return [...drawables].sort((a, b) =>
    a.sortY - b.sortY ||
    a.layer - b.layer ||
    a.sortX - b.sortX ||
    a.order - b.order
  );
}
