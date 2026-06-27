const CHARACTER_FRAME_SIZE = { width: 96, height: 80 };
const CHARACTER_ANIMATION_NAMES = ['idle', 'run', 'attack1', 'attack2'];
export const CHARACTER_PATHS = {
  idle: 'IDLE',
  run: 'RUN',
  attack1: 'ATTACK 1',
  attack2: 'ATTACK 2'
};
const CHARACTER_SCALE = 1.38;
const CHARACTER_GROUND_OFFSET = 11;

export async function loadCharacterAssets(PIXI) {
  const basePath = '/public/assets/character/Sprites';
  const entries = await Promise.all(CHARACTER_ANIMATION_NAMES.flatMap(name => ['up', 'down', 'left', 'right'].map(async direction => {
    const folder = CHARACTER_PATHS[name];
    const file = `${basePath}/${folder}/${name}_${direction}.png`;
    try {
      const image = await loadImage(file);
      const animation = sliceCharacterSheet(PIXI, image, CHARACTER_FRAME_SIZE);
      return [`${name}:${direction}`, animation];
    } catch {
      return [`${name}:${direction}`, null];
    }
  })));
  const byAction = {};
  for (const [key, frameTextures] of entries) {
    const [name, direction] = key.split(':');
    (byAction[name] ||= {})[direction] = frameTextures;
  }
  return {
    ready: true,
    ...byAction
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load character asset: ${src}`));
    image.src = src;
  });
}

function sliceCharacterSheet(PIXI, image, frameSize) {
  const bounds = findOpaqueBounds(image, frameSize);
  if (!bounds) return null;
  const frames = [];
  const columns = Math.max(1, Math.floor((image.width || 0) / frameSize.width));
  const rows = Math.max(1, Math.floor((image.height || 0) / frameSize.height));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const canvas = document.createElement('canvas');
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        col * frameSize.width + bounds.x,
        row * frameSize.height + bounds.y,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
      );
      const texture = PIXI.Texture.from(canvas);
      frames.push(texture);
    }
  }
  return { textures: frames, scale: CHARACTER_SCALE, yOffset: CHARACTER_GROUND_OFFSET };
}

export function getCharacterAnimationFrame(characterAssets, actorState) {
  if (!characterAssets?.ready) return null;
  const facing = getFacingDirection(actorState.facingX, actorState.facingY);
  const action = getCharacterAction(actorState.action);
  const animationKey = action === 'attack' ? (Math.floor(performance.now() / 250) % 2 === 0 ? 'attack1' : 'attack2') : action;
  const animation = characterAssets[animationKey] || characterAssets.idle;
  const textures = animation?.[facing]?.textures || animation?.down?.textures;
  if (!Array.isArray(textures) || textures.length === 0) return null;
  const speed = action === 'run' ? 70 : action === 'attack' ? 55 : 110;
  return {
    textures,
    speed,
    scale: animation?.[facing]?.scale || animation?.down?.scale || CHARACTER_SCALE,
    yOffset: animation?.[facing]?.yOffset || animation?.down?.yOffset || CHARACTER_GROUND_OFFSET
  };
}

export function getCharacterFrameTexture(characterSprite, animation, actorState) {
  const textures = animation.textures || [];
  if (textures.length === 0) return null;
  const now = performance.now();
  const action = getCharacterAction(actorState.action);
  const stateKey = `${action}:${getFacingDirection(actorState.facingX, actorState.facingY)}:${textures.length}`;
  characterSprite._animState ||= { key: null, startedAt: 0, frameIndex: 0, lastFrameIndex: -1 };
  const animState = characterSprite._animState;
  if (animState.key !== stateKey) {
    animState.key = stateKey;
    animState.startedAt = now;
    animState.frameIndex = 0;
    animState.lastFrameIndex = -1;
  }
  if (action === 'attack') {
    const attackDuration = 280;
    const elapsed = now - animState.startedAt;
    const lastIndex = textures.length - 1;
    const nextIndex = elapsed >= attackDuration ? lastIndex : Math.min(lastIndex, Math.floor((elapsed / attackDuration) * textures.length));
    animState.frameIndex = nextIndex;
  } else {
    const frameDuration = Math.max(50, animation.speed || 100);
    animState.frameIndex = Math.floor((now - animState.startedAt) / frameDuration) % textures.length;
  }
  return textures[animState.frameIndex] || textures[0];
}

function findOpaqueBounds(image, frameSize) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const frameX = minX % frameSize.width;
  const frameY = minY % frameSize.height;
  const widthPx = Math.min(frameSize.width, maxX - minX + 1);
  const heightPx = Math.min(frameSize.height, maxY - minY + 1);
  return {
    x: frameX,
    y: frameY,
    width: widthPx,
    height: heightPx
  };
}

export function getCharacterAction(action) {
  const value = String(action || '').toLowerCase();
  if (value.includes('attack')) return 'attack';
  if (value.includes('run') || value.includes('move') || value.includes('walk') || value.includes('dash') || value.includes('target')) return 'run';
  if (value.includes('hurt') || value.includes('death') || value.includes('heal')) return 'idle';
  return 'idle';
}

export function getFacingDirection(facingX = 1, facingY = 0) {
  if (Math.abs(facingX) > Math.abs(facingY)) return facingX < 0 ? 'left' : 'right';
  return facingY < 0 ? 'up' : 'down';
}

export function inferPlayerAction(renderState) {
  if (renderState.player?.attackCooldown > 0) return 'attack';
  if (renderState.player?.target || (Array.isArray(renderState.player?.targetQueue) && renderState.player.targetQueue.length > 0)) return 'run';
  return 'idle';
}
