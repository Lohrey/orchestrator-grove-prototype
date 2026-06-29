// ── LPC Terrain tile loader (shared across render paths) ────────────
//
// Loads the LPC (Liberated Pixel Cup) terrain tiles extracted from the
// LPC Terrains pack (CC-BY-SA 4.0, https://opengameart.org/content/lpc-terrains).
// Provides an ImageBitmap + frame lookup usable by BOTH Canvas2D and Pixi paths.
//
// Tiles are 32×32 px. The grass_sheet.png has 4×4 = 16 grass variations.
// terrain_atlas.png has grass on the top half, dirt on the bottom half.

const TILE_SIZE = 32;
const GRASS_FRAMES = 16; // 4×4 grid in grass_sheet.png

const _ATLAS_BASE = new URL('../../../assets/lpc-terrain/', import.meta.url).href;
const GRASS_SHEET_URL = _ATLAS_BASE + 'grass_sheet.png';
const TERRAIN_ATLAS_URL = _ATLAS_BASE + 'terrain_atlas.png';

let _bitmapPromise = null;
let _bitmap = null;

/**
 * Load (or return cached) the LPC terrain grass sheet as an ImageBitmap.
 * @returns {Promise<ImageBitmap|null>}
 */
export async function loadLpcTerrain() {
  if (_bitmap) return _bitmap;
  if (_bitmapPromise) return _bitmapPromise;
  _bitmapPromise = (async () => {
    try {
      const response = await fetch(GRASS_SHEET_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      _bitmap = await createImageBitmap(blob);
      console.info(`[lpc-terrain] Loaded grass sheet ${_bitmap.width}×${_bitmap.height}`);
      return _bitmap;
    } catch (err) {
      console.warn('[lpc-terrain] Failed to load LPC terrain tiles; falling back to procedural ground.', err);
      return null;
    } finally {
      _bitmapPromise = null;
    }
  })();
  return _bitmapPromise;
}

/**
 * Get the loaded LPC terrain bitmap (or null if not loaded).
 * @returns {ImageBitmap|null}
 */
export function getLpcTerrain() {
  return _bitmap;
}

/**
 * Get the source rectangle for a specific grass variation.
 * @param {number} variant - 0 to GRASS_FRAMES-1
 * @returns {{sx:number, sy:number, sw:number, sh:number}}
 */
export function getGrassFrame(variant) {
  const v = ((variant % GRASS_FRASSES) + GRASS_FRAMES) % GRASS_FRAMES;
  return {
    sx: (v % 4) * TILE_SIZE,
    sy: Math.floor(v / 4) * TILE_SIZE,
    sw: TILE_SIZE,
    sh: TILE_SIZE
  };
}

export { TILE_SIZE as LPC_TILE_SIZE };
