# Sprite Sheet Authoring Guide — Orchestrator Grove

> How to create sprite sheets that the rendering pipeline can consume.
> Target: power-of-2 grid (Moonlighter-style), WebGL2/Canvas2D compatible.

## 1. Power-of-2 Grid Standard

All sprites use power-of-2 cell sizes. This ensures WebGL texture efficiency
(no padding waste), uniform UV mapping for atlas packing, and integer-scaling
compatibility.

| Category | Cell Size | Anchor (cx, cy) | Notes |
|---|---|---|---|
| **Items** (tools, seeds, logs, stones, story objects) | **32×32** | (16, 16) | Centered, transparent padding |
| **Bots** (default + walk cycle) | **64×64** | (32, 32) | 5 colors × idle + 4 walk frames |
| **Player character** | **64×64** | (32, 32) | 4 cardinal facings × normal/low-hp |
| **Dog bot** | **64×64** | (32, 32) | Facing left + facing right |
| **Monsters** | **64×64** | (32, 32) | 4 wobble frames per type |
| **Trees** (grown, small, sapling) | **64×64** | (32, 32) | 4 sway frames per stage |
| **Rocks / Stone deposits** | **64×64** | (32, 32) | Normal + depleted variant |
| **Structures** (buildings) | **128×128** | (64, 64) | One static frame per type |
| **Map tiles** (planned) | **32×32** | (0, 0) | Tiled, top-left anchored |

## 2. File Format

### Atlas Image (PNG)
- **Transparency**: RGBA PNG with alpha channel
- **Background**: Fully transparent (`#00000000`)
- **Filtering**: Nearest-neighbor (no anti-aliasing on sprite edges)
- **Color profile**: sRGB

### Atlas Metadata (JSON)
Sidecar `.json` file with the same base name as the PNG:

```json
{
  "meta": {
    "image": "items-atlas.png",
    "format": "RGBA8888",
    "scale": 1,
    "cellW": 32,
    "cellH": 32
  },
  "frames": [
    {
      "name": "stone",
      "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
      "anchor": { "x": 16, "y": 16 },
      "rotated": false,
      "trimmed": false
    },
    {
      "name": "log",
      "frame": { "x": 32, "y": 0, "w": 32, "h": 32 },
      "anchor": { "x": 16, "y": 16 }
    }
  ]
}
```

## 3. Naming Convention

Atlas files live in `assets/sprites/`:

```
assets/sprites/
├── items-atlas.png        + items-atlas.json         (32×32 grid)
├── bots-atlas.png         + bots-atlas.json          (64×64 grid)
├── player-atlas.png       + player-atlas.json        (64×64 grid)
├── dog-atlas.png          + dog-atlas.json           (64×64 grid)
├── monsters-atlas.png     + monsters-atlas.json      (64×64 grid)
├── trees-atlas.png        + trees-atlas.json         (64×64 grid)
├── rocks-atlas.png        + rocks-atlas.json         (64×64 grid)
├── structures-atlas.png   + structures-atlas.json    (128×128 grid)
└── tiles-atlas.png        + tiles-atlas.json         (32×32 grid, planned)
```

Frame `name` values must match the game's internal type strings exactly.

## 4. Per-Category Specs

### 4.1 Items (32×32)

**Required frames** (name → slot):

| Name | In-game type |
|---|---|
| `stone` | stone |
| `log` | log |
| `plank` | plank |
| `pole` | pole |
| `stick` | stick |
| `tree_seed` | tree_seed |
| `hemp_seed` | hemp_seed |
| `hemp` | hemp |
| `bow` | bow |
| `arrow_pack` | arrow_pack |
| `crude_axe` | crude_axe |
| `crude_pickaxe` | crude_pickaxe |
| `crude_shovel` | crude_shovel |
| `crude_hammer` | crude_hammer |
| `wooden_sword` | wooden_sword |
| `wooden_shield` | wooden_shield |
| `camper_van` | camper_van (story item) |
| `hammock` | hammock (story item) |
| `ultrabook` | ultrabook (story item) |
| `solar_panel` | solar_panel (story item) |
| `power_station` | power_station (story item) |
| `portable_3d_printer` | portable_3d_printer (story item) |
| `assembler` | assembler (story item) |
| `robotics_parts` | robotics_parts (story item) |
| `*_kit` | building kit items (one per building type, see 4.8) |

**Layout**: Single row, left-to-right in a 32px grid. The PNG width = `count × 32`.
No animation frames — items are static.

**Art notes**: Draw the item centered within the 32×32 cell. Items are small
(roughly 18×10 px of actual art), so leave ~7px transparent padding on each side.
The anchor is center (16, 16) — the game translates to `(x - 16, y - 16)` before blitting.

### 4.2 Bots (64×64)

**Grid**: 64×64 cells. Each bot color gets:
- 1 idle frame: `bot_<colorIndex>_idle`
- 4 walk-cycle frames: `bot_<colorIndex>_walk_0` through `_3`

**Colors** (5 total, index 0–4):

| Index | Hex | Description |
|---|---|---|
| 0 | `#80a9c9` | Blue-grey |
| 1 | `#9abf8f` | Green |
| 2 | `#d3a95f` | Gold |
| 3 | `#c7b683` | Tan |
| 4 | `#8fb9b5` | Teal |

**Layout**: 5 frames per row (idle + 4 walk), 5 rows (one per color) = 25 cells.
Atlas: 320×320 px.

**Walk cycle**: 4 frames, evenly-spaced sine phases (0, π/2, π, 3π/2).
- Vertical bob: ±1.5 px
- Leg spread: ±2 px (cosine, alternating)
- Playback: ~140ms per step (~7fps), desynced per-bot via `bot.id * 0.7`

### 4.3 Player Character (64×64)

**Grid**: 64×64 cells.

**Required frames** (4 facings × 2 states = 8 frames):

| Name | Facing | State |
|---|---|---|
| `player_normal_e` | East | Normal HP |
| `player_normal_w` | West | Normal HP |
| `player_normal_n` | North | Normal HP |
| `player_normal_s` | South | Normal HP |
| `player_lowhp_e` | East | Low HP (< 30%) |
| `player_lowhp_w` | West | Low HP |
| `player_lowhp_n` | North | Low HP |
| `player_lowhp_s` | South | Low HP |

**Layout**: 4 columns (facing E/W/N/S), 2 rows (normal, low-hp).
Atlas: 256×128 px.

**Eye offset** (for pixel art — bake into the sprite, don't compute at runtime):

| Facing | Eye X | Eye Y |
|---|---|---|
| East | +4 | -3 |
| West | -4 | -3 |
| North | 0 | -5.4 |
| South | 0 | -0.6 |

### 4.4 Dog Bot (64×64)

**Required frames**: 2 (facing left, facing right).

| Name | Facing |
|---|---|
| `dog_right` | Right |
| `dog_left` | Left |

**Layout**: 2 cells side-by-side. Atlas: 128×64 px.

### 4.5 Monsters (64×64)

**Types**: `default`, `night_monster`

**Required frames**: 4 wobble frames per type (8 total).

| Name | Frame |
|---|---|
| `monster_default_0` ... `_3` | 4 wobble phases |
| `monster_night_monster_0` ... `_3` | 4 wobble phases |

**Layout**: 4 columns (frames 0–3), 2 rows (types).
Atlas: 256×128 px.

**Wobble cycle**: Sine wave, ±2 px vertical offset, 4 evenly-spaced phases.

### 4.6 Trees (64×64)

**Growth stages**: `grown_tree`, `small_tree`, `sapling`

**Required frames**: 4 sway frames per stage (12 total).

| Name | Frame |
|---|---|
| `tree_grown_tree_0` ... `_3` | 4 sway phases |
| `tree_small_tree_0` ... `_3` | 4 sway phases |
| `tree_sapling_0` ... `_3` | 4 sway phases |

**Layout**: 4 columns (frames 0–3), 3 rows (stages).
Atlas: 256×192 px.

**Sway cycle**: Sine wave, ±2.5 px horizontal sway (±1.5 px for saplings).
Per-tree desync via `tree.id * 0.7`.

### 4.7 Rocks / Stone Deposits (64×64)

**Variants**: `normal`, `depleted`

| Name | Variant |
|---|---|
| `rock_normal` | Full deposit |
| `rock_depleted` | Mined-out |

**Layout**: 2 cells side-by-side. Atlas: 128×64 px.

### 4.8 Structures (128×128)

**Building types** (each gets one static frame):

| Type | Label | W×H (game units) |
|---|---|---|
| `sawbench` | Sawbench | 92×54 |
| `workbench` | Crude Tool Bench | 98×54 |
| `factory` | Bot Factory | 108×66 |
| `portable_3d_printer` | Portable 3D Printer | 96×76 |
| `assembler` | Portable Assembler | 112×70 |
| `smithery` | Smithery | 100×58 |
| `bowmaker` | Bowmaker | 104×58 |
| `arrowmaker` | Arrowmaker | 104×58 |
| `defensetower` | Defense Tower | 82×96 |
| `throne` | Throne | 118×86 |
| `item_palette` | Item Palette | 86×48 |
| `camper_van` | Camper Van (building) | varies |
| `hammock_camp` | Hammock Camp | varies |
| `ultrabook_desk` | Ultrabook Desk | varies |
| `solar_array` | Solar Array | varies |
| `power_station` | Power Station | varies |
| `robotics_parts_bin` | Robotics Parts Bin | varies |

**Naming**: `structure_<type>` (e.g. `structure_sawbench`).

**Layout**: One cell per structure type, single row.
Atlas: `count × 128` wide, 128 px tall.

**Art notes**: Draw the building centered within the 128×128 cell, anchored at
(64, 64). Most buildings are 82–118 px wide, so they fit with small padding.

### 4.9 Map Tiles (32×32) — Planned

**Not yet implemented.** When LPC Terrains tileset is integrated:

| Layer | Cell | Notes |
|---|---|---|
| Ground (grass, dirt, water) | 32×32 | Tiled, top-left anchored |
| Foliage overlays (bushes, flowers) | 32×32 | Centered |
| Walls (dungeon/city) | 32×32 | Tiled |

**Format**: Standard LPC tileset layout (16×16 tile grid per sheet, or 32×32
for higher-detail variants). JSON manifest maps tile indices to biome rules.

## 5. Building-Kit Items

Each structure type has a corresponding "kit" item (the item form before it's
deployed as a building). These go in the **Items atlas** (32×32), not the
Structures atlas.

| Kit item name | Building type |
|---|---|
| `sawbench_kit` | sawbench |
| `workbench_kit` | workbench |
| `factory_kit` | factory |
| `smithery_kit` | smithery |
| `bowmaker_kit` | bowmaker |
| `arrowmaker_kit` | arrowmaker |
| `defensetower_kit` | defensetower |
| `camper_van_kit` | camper_van |
| `hammock_kit` | hammock_camp |
| `ultrabook_kit` | ultrabook_desk |
| `solar_array_kit` | solar_array |
| `power_station_kit` | power_station |
| `printer_kit` | portable_3d_printer |
| `assembler_kit` | assembler |
| `robotics_kit` | robotics_parts_bin |

## 6. Authoring Workflow

### Option A: Draw sprites manually (Aseprite / LibreSprite)

1. Set canvas size to the cell size (32×32 or 64×64).
2. Draw with 1px pencil tool, no anti-aliasing.
3. Export as PNG with transparency.
4. Use TexturePacker or a script to pack into an atlas grid.
5. Generate the JSON manifest.

### Option B: Export from current vector renderer (transitional)

The current Canvas2D vector draws can be captured to PNG as a starting point:

```javascript
// In browser console on the running game:
import { initSpriteCache } from './src/renderers/shared/sprite-cache.js';
await initSpriteCache();
// Then iterate cache entries and export each to PNG via canvas.toDataURL()
```

### Option C: AI-generated pixel art (GPT Image 2, etc.)

Prompt template:
```
Pixel art sprite of [DESCRIPTION], [32x32 / 64x64] pixels,
centered, transparent background, no anti-aliasing,
retro game asset style, [COLOR PALETTE REFERENCE]
```

Post-process: remove background, trim to cell, center on grid.

### Option D: LPC (Liberated Pixel Cup) assets

Download LPC Terrains + Trees + Foliage packs. These already use 32×32 and 64×64
grids. Map LPC tile names to the game's type strings via the JSON manifest.

## 7. Integration Plan (Future Module)

The planned `sprite-atlas-loader.js` module will:

1. Load atlas PNG + JSON at startup (replaces/augments the current vector cache).
2. For each frame in the JSON, extract the sub-rectangle from the atlas PNG.
3. Create an `ImageBitmap` via `createImageBitmap(atlasImage, x, y, w, h)`.
4. Store in the same cache structure the vector renderer uses (`cache[key] = bitmap`).
5. The render loop (`drawItem`, `drawTree`, etc.) is already blit-based — no changes needed.

**Fallback**: If an atlas is missing for a category, the vector cache path runs
as before. This allows incremental migration: replace items first, then bots, etc.

## 8. Integer Scaling Pipeline

Following the Moonlighter model:

| Phase | What | Status |
|---|---|---|
| **Phase 1** | Sprite cache normalized to power-of-2 grid | ✅ Done |
| **Phase 1** | CSS `image-rendering: pixelated` set | ✅ Done |
| **Phase 2** | Canvas backing store → 640×360 native resolution | 🔲 Planned |
| **Phase 2** | Integer scale (×3/×4/×5) to fill viewport via CSS | 🔲 Planned |
| **Phase 2** | Camera zoom recalibrated to native-res world units | 🔲 Planned |

**Phase 2 detail**: The canvas backing store will be set to a fixed 640×360
(16:9) or 640×400 (16:10) resolution. CSS scales the canvas element to fill the
viewport using `width: 100%; height: 100%; image-rendering: pixelated`. The
integer scale factor is `Math.min(Math.floor(screenW / 640), Math.floor(screenH / 360))`.
Letterboxing handles aspect-ratio mismatches.

This gives pixel-perfect rendering at any display size without blurry upscaling.
