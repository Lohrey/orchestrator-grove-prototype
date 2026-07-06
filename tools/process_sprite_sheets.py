#!/usr/bin/env python3
"""
Sprite Sheet Processing Pipeline for Autonauts Orchestrator Grove Prototype.

Pipeline:
  1. Background removal (rembg, isnet-general-use)
  2. Connected-component detection (cv2.connectedComponentsWithStats)
  3. Top-8 components by area (filters noise false positives — Patrick: exactly 8 per sheet)
  4. Per-sprite bbox crop (Pillow getbbox)
  5. Center on 64×64 transparent canvas
  6. PNG export + debug overview + contact sheet previews

Input: AI-generated JPEGs with solid charcoal background (~RGB 28), NOT grid-aligned.
Output: 64×64 alpha PNGs for the WebGL2/Canvas2D sprite batcher.

Usage:
    python3 tools/process_sprite_sheets.py [image1.jpg image2.jpg ...]

If no args, processes the 3 default sheets from the Hermes cache.

The 3 default sheets map to character roles (best-guess, Patrick verifies):
    img_c7f66e1de70b.jpg → dog    (dog_00.png ... dog_07.png)
    img_6951c3c35615.jpg → player (player_00.png ... player_07.png)
    img_2f34824cb04d.jpg → bot    (bot_00.png ... bot_07.png)
"""

import sys
import os
import time
from pathlib import Path

import numpy as np
import cv2
from PIL import Image, ImageDraw

# ─── Config ──────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path("/root/autonauts-orchestrator-prototype")
OUTPUT_DIR = PROJECT_ROOT / "assets" / "sprites" / "processed"
PREVIEW_DIR = PROJECT_ROOT / "assets" / "sprites"  # contact sheets live one level up

SPRITE_CANVAS_SIZE = 64          # target canvas size (matches SPRITE_SIZE in sprite-cache.js)
TOP_N_SPRITES = 8                # take the N largest components per sheet (Patrick: exactly 8)
MIN_COMPONENT_AREA = 500         # ignore blobs smaller than this (noise)
MAX_COMPONENT_AREA_FRAC = 0.25   # ignore blobs larger than 25% of image (likely bg leak)
BG_THRESHOLD = 128               # alpha threshold for bg mask after rembg (0-255)

# Noise-strip rejection: reject thin horizontal strips (text/watermark artifacts).
# A real sprite has roughly square-ish proportions; title text is wide + short.
MAX_ASPECT_RATIO = 3.0           # reject components wider than 3:1
MIN_COMPONENT_HEIGHT = 35        # reject components shorter than this (text strips ~24px tall)

# Contact sheet config
CONTACT_CELL_SIZE = 256          # each sprite upscaled to this in the contact sheet
CONTACT_COLS = 4                 # 4×2 grid = 8 sprites per character
CONTACT_ROWS = 2

# Map input image hash → character role for descriptive filenames.
# Keys are the hex hashes (post img_ prefix, no extension).
CHARACTER_MAP = {
    "c7f66e1de70b": "dog",
    "6951c3c35615": "player",
    "2f34824cb04d": "bot",
}

# Per-character rembg model override.
# Default is isnet-general-use (fast, ~2.5s). The dog sheet has dark fur on a
# charcoal background where isnet-general-use loses ~60% of the dog body
# (only 2.26% foreground vs true ~5%), fragmenting each dog into 2-3 pieces
# and yielding 6 broken components instead of 8 intact dogs.
# birefnet-general handles fur/hair detail far better and yields exactly 8
# clean near-square components (~6800px each) at the cost of ~40s/sheet.
# Patrick confirmed player+bot are correct with isnet-general-use, so we keep
# the fast model for those and only override dog.
REMBG_MODEL_OVERRIDE = {
    "dog": "birefnet-general",
}

DEFAULT_IMAGES = [
    "/root/.hermes/cache/images/img_c7f66e1de70b.jpg",
    "/root/.hermes/cache/images/img_6951c3c35615.jpg",
    "/root/.hermes/cache/images/img_2f34824cb04d.jpg",
]


def sheet_name_from_path(path: str) -> str:
    """Derive a clean sheet name from filename, stripping common prefixes/suffixes."""
    base = Path(path).stem
    base = base.removeprefix("img_")
    return base


def character_label(sheet_name: str) -> str:
    """Map a sheet hash to a character label (dog/player/bot). Falls back to sheet hash."""
    return CHARACTER_MAP.get(sheet_name, sheet_name)


# ─── Step 1: Background removal ─────────────────────────────────────────────

def remove_background(image_path: str, label: str = None) -> Image.Image:
    """Run rembg. Returns RGBA Pillow image.

    Model is selected per character: birefnet-general for fur-heavy subjects
    (dog), isnet-general-use otherwise. See REMBG_MODEL_OVERRIDE.
    """
    from rembg import remove, new_session

    model = (REMBG_MODEL_OVERRIDE.get(label, "isnet-general-use")
             if label else "isnet-general-use")
    print(f"  [rembg] Loading model '{model}' for '{label}'...")
    session = new_session(model)

    with open(image_path, "rb") as f:
        input_bytes = f.read()

    print(f"  [rembg] Removing background...")
    output_bytes = remove(input_bytes, session=session)
    import io
    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")
    return img


# ─── Step 2: Connected-component detection ──────────────────────────────────

def detect_sprites(rgba_image: Image.Image) -> list[dict]:
    """
    Find individual sprites via connected-component analysis on the alpha channel.
    Returns components filtered by area, sorted by area DESCENDING (largest first).
    Caller then takes the top TOP_N_SPRITES and re-sorts into reading order.
    """
    alpha = np.array(rgba_image)[:, :, 3]

    # Threshold alpha to get a binary mask of foreground
    _, binary = cv2.threshold(alpha, BG_THRESHOLD, 255, cv2.THRESH_BINARY)

    # Dilate slightly to merge nearby pixels of the same sprite
    # (AA edges may create gaps between core regions of one sprite)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # Connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)

    total_pixels = alpha.shape[0] * alpha.shape[1]
    components = []

    # Skip label 0 (background)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < MIN_COMPONENT_AREA:
            continue
        if area > total_pixels * MAX_COMPONENT_AREA_FRAC:
            continue

        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]
        w = stats[i, cv2.CC_STAT_WIDTH]
        h = stats[i, cv2.CC_STAT_HEIGHT]

        # Reject noise: thin horizontal strips (text/watermark artifacts) that are
        # wide but very short. Real sprites are roughly square-ish.
        if h < MIN_COMPONENT_HEIGHT:
            continue
        if w > 0 and (w / h) > MAX_ASPECT_RATIO:
            continue

        components.append({
            "label": i,
            "bbox": (x, y, w, h),
            "area": area,
            "centroid": (centroids[i][0], centroids[i][1]),
        })

    # Sort by area DESCENDING so the caller can take the top N largest (robust to noise).
    components.sort(key=lambda c: c["area"], reverse=True)
    return components


def take_top_n_in_reading_order(components: list[dict], n: int) -> list[dict]:
    """Take the N largest components, then re-sort into reading order (row-major)."""
    top = components[:n]
    top.sort(key=lambda c: (c["centroid"][1], c["centroid"][0]))
    return top


# ─── Step 3+4: Crop + center on canvas ───────────────────────────────────────

def crop_and_center(rgba_image: Image.Image, bbox: tuple):
    """
    Crop to component bbox, then use getbbox() for tighter content crop,
    then center on a 64×64 transparent canvas.
    Returns (canvas_image, content_bbox, final_w, final_h).
    """
    x, y, w, h = bbox
    cropped = rgba_image.crop((x, y, x + w, y + h))

    # Tighten using alpha bbox
    content_bbox = cropped.getbbox()
    if content_bbox:
        cropped = cropped.crop(content_bbox)

    cw, ch = cropped.size

    # Scale down if sprite is larger than canvas (preserve aspect ratio)
    max_dim = max(cw, ch)
    if max_dim > SPRITE_CANVAS_SIZE:
        scale = SPRITE_CANVAS_SIZE / max_dim
        new_w = max(1, int(round(cw * scale)))
        new_h = max(1, int(round(ch * scale)))
        try:
            cropped = cropped.resize((new_w, new_h), Image.Resampling.NEAREST)
        except AttributeError:
            cropped = cropped.resize((new_w, new_h), Image.NEAREST)

    cw, ch = cropped.size

    # Create transparent canvas and center
    canvas = Image.new("RGBA", (SPRITE_CANVAS_SIZE, SPRITE_CANVAS_SIZE), (0, 0, 0, 0))
    offset = ((SPRITE_CANVAS_SIZE - cw) // 2, (SPRITE_CANVAS_SIZE - ch) // 2)
    canvas.paste(cropped, offset, cropped)

    return canvas, content_bbox, cw, ch


# ─── Debug overview ──────────────────────────────────────────────────────────

def save_debug_overview(rgba_image: Image.Image, components: list[dict],
                        all_filtered_count: int, label: str):
    """Save a debug PNG with bounding boxes overlaid on the original.
    Uses the character label (dog/player/bot) in the filename."""
    debug = rgba_image.convert("RGB").copy()
    draw = ImageDraw.Draw(debug)

    for idx, comp in enumerate(components):
        x, y, w, h = comp["bbox"]
        color = (0, 255, 0)
        draw.rectangle([x, y, x + w, y + h], outline=color, width=3)
        draw.text((x + 2, y + 2), f"{idx:03d}", fill=color)

    debug_path = OUTPUT_DIR / f"debug_{label}.png"
    debug.save(str(debug_path))
    print(f"  [debug] Saved overview (kept top {len(components)} of {all_filtered_count} filtered) → {debug_path.name}")
    return debug_path


# ─── Contact sheet ───────────────────────────────────────────────────────────

def make_contact_sheet(sprites: list, label: str, title: str = None) -> Image.Image:
    """Build a CONTACT_COLS×CONTACT_ROWS grid of the 8 sprites, each upscaled to
    CONTACT_CELL_SIZE. `sprites` is a list of 64×64 RGBA PIL Images (in order).
    Returns the grid image (checkerboard background for transparency visibility)."""
    grid_w = CONTACT_COLS * CONTACT_CELL_SIZE
    grid_h = CONTACT_ROWS * CONTACT_CELL_SIZE
    grid = Image.new("RGB", (grid_w, grid_h), (40, 40, 40))  # dark bg

    for idx, spr in enumerate(sprites):
        if idx >= CONTACT_COLS * CONTACT_ROWS:
            break
        col = idx % CONTACT_COLS
        row = idx // CONTACT_COLS
        # Upscale with nearest-neighbor for crisp pixel art
        try:
            resample_mode = Image.Resampling.NEAREST
        except AttributeError:
            resample_mode = Image.NEAREST
        big = spr.resize((CONTACT_CELL_SIZE, CONTACT_CELL_SIZE), resample_mode)
        # Composite onto dark bg so transparency shows
        composed = Image.new("RGBA", (CONTACT_CELL_SIZE, CONTACT_CELL_SIZE), (40, 40, 40, 255))
        composed.alpha_composite(big)
        grid.paste(composed.convert("RGB"), (col * CONTACT_CELL_SIZE, row * CONTACT_CELL_SIZE))

    # Draw a title bar at the top
    if title:
        titled = Image.new("RGB", (grid_w, grid_h + 32), (20, 20, 20))
        titled.paste(grid, (0, 32))
        d = ImageDraw.Draw(titled)
        d.text((8, 6), title, fill=(255, 255, 255))
        grid = titled

    return grid


def make_combined_contact_sheet(per_char: list) -> Image.Image:
    """Stack 3 single-character contact sheets vertically with dividers.
    `per_char` is a list of (label, contact_image) tuples."""
    single_sheets = [img for _, img in per_char]
    max_w = max(img.width for img in single_sheets)
    total_h = sum(img.height for img in single_sheets) + 4 * (len(single_sheets) - 1)
    combined = Image.new("RGB", (max_w, total_h), (0, 0, 0))
    y = 0
    for img in single_sheets:
        combined.paste(img, (0, y))
        y += img.height + 4
    return combined


# ─── Main pipeline ───────────────────────────────────────────────────────────

def process_sheet(image_path: str) -> dict:
    """Process a single sprite sheet. Returns summary dict."""
    sheet_name = sheet_name_from_path(image_path)
    label = character_label(sheet_name)
    print(f"\n{'='*60}")
    print(f"Processing: {image_path}")
    print(f"  Sheet name: {sheet_name}  →  label: {label}")

    # Step 1: Background removal
    rgba = remove_background(image_path, label)
    print(f"  [rembg] Output: {rgba.size} {rgba.mode}")

    # Step 2: Detect all components (sorted by area desc)
    all_components = detect_sprites(rgba)
    print(f"  [cc] Found {len(all_components)} components (after area filter)")

    # Step 3: Take top-N by area, then re-sort into reading order
    components = take_top_n_in_reading_order(all_components, TOP_N_SPRITES)
    print(f"  [top-{TOP_N_SPRITES}] Kept {len(components)} largest by area")
    for i, c in enumerate(components):
        print(f"      #{i:02d}  area={c['area']:6d}  bbox={c['bbox']}  centroid=({c['centroid'][0]:.0f},{c['centroid'][1]:.0f})")

    # Step 4+5: Crop + center + export with descriptive names
    results = []
    sprite_canvases = []  # keep references for contact sheet
    for idx, comp in enumerate(components):
        canvas, content_bbox, final_w, final_h = crop_and_center(rgba, comp["bbox"])
        sprite_canvases.append(canvas)

        out_path = OUTPUT_DIR / f"{label}_{idx:02d}.png"
        canvas.save(str(out_path), "PNG")

        results.append({
            "index": idx,
            "path": str(out_path),
            "name": out_path.name,
            "original_bbox": comp["bbox"],
            "content_bbox": content_bbox,
            "area": comp["area"],
            "final_size": (final_w, final_h),
        })

    # Debug overview
    debug_path = save_debug_overview(rgba, components, len(all_components), label)

    # Contact sheet for this character
    contact = make_contact_sheet(sprite_canvases, label, title=f"{label} - 8 sprites")
    contact_path = PREVIEW_DIR / f"preview_{label}.png"
    contact.save(str(contact_path), "PNG")
    print(f"  [preview] Contact sheet → {contact_path}")

    return {
        "sheet_name": sheet_name,
        "label": label,
        "input_path": image_path,
        "sprite_count": len(results),
        "sprites": results,
        "debug_path": str(debug_path),
        "contact_path": str(contact_path),
        "contact_image": contact,
        "total_filtered_components": len(all_components),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    images = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_IMAGES

    print(f"Sprite Sheet Processing Pipeline")
    print(f"  Output dir: {OUTPUT_DIR}")
    print(f"  Preview dir: {PREVIEW_DIR}")
    print(f"  Canvas size: {SPRITE_CANVAS_SIZE}×{SPRITE_CANVAS_SIZE}")
    print(f"  Top-N per sheet: {TOP_N_SPRITES}")
    print(f"  Min component area: {MIN_COMPONENT_AREA}px")
    print(f"  Processing {len(images)} image(s)")

    all_summaries = []
    for img_path in images:
        if not os.path.exists(img_path):
            print(f"  WARNING: {img_path} not found, skipping")
            continue
        t0 = time.time()
        summary = process_sheet(img_path)
        elapsed = time.time() - t0
        summary["elapsed_sec"] = elapsed
        all_summaries.append(summary)

    # ─── Combined contact sheet (all 3 characters) ───────────────────────────
    combined_path = None
    if len(all_summaries) >= 2:
        per_char = [(s["label"], s["contact_image"]) for s in all_summaries]
        combined = make_combined_contact_sheet(per_char)
        combined_path = PREVIEW_DIR / "preview_all.png"
        combined.save(str(combined_path), "PNG")
        print(f"\n  [preview] Combined contact sheet → {combined_path}")

    # ─── Final summary ───────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("PIPELINE SUMMARY")
    print(f"{'='*60}")
    total_sprites = 0
    all_correct = True
    for s in all_summaries:
        print(f"\n  Sheet: {s['sheet_name']}  (label: {s['label']})")
        print(f"    Sprites extracted: {s['sprite_count']}  (target: {TOP_N_SPRITES})  "
              f"{'OK' if s['sprite_count'] == TOP_N_SPRITES else 'MISMATCH'}")
        print(f"    Filtered components total: {s['total_filtered_components']}")
        print(f"    Processing time:   {s['elapsed_sec']:.1f}s")
        print(f"    Debug overview:    {s['debug_path']}")
        print(f"    Contact sheet:     {s['contact_path']}")
        print(f"    Per-sprite details:")
        for sp in s["sprites"]:
            ox, oy, ow, oh = sp["original_bbox"]
            cb = sp["content_bbox"]
            fw, fh = sp["final_size"]
            print(f"      [{sp['index']:02d}] {sp['name']:16s} orig_bbox=({ow}×{oh}) "
                  f"content={cb} final=({fw}×{fh}) area={sp['area']}")
        total_sprites += s["sprite_count"]
        if s["sprite_count"] != TOP_N_SPRITES:
            all_correct = False

    print(f"\n  TOTAL sprites extracted: {total_sprites}")
    print(f"  Output directory: {OUTPUT_DIR}")
    print(f"  All sheets yielded exactly {TOP_N_SPRITES}: {'YES' if all_correct else 'NO'}")
    if combined_path:
        print(f"  Combined preview: {combined_path}")


if __name__ == "__main__":
    main()
