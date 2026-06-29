#!/usr/bin/env python3
"""
pack_tiny_swords_atlas.py — Pack all Tiny Swords PNGs into a single sprite atlas.

Produces:
  - tiny_swords_atlas.png  (RGBA, power-of-2 dimensions for WebGPU)
  - tiny_swords_atlas.json (TexturePacker JSON Hash format)

Usage:
  python3 pack_tiny_swords_atlas.py <input_dir> <output_dir>
  python3 pack_tiny_swords_atlas.py  # defaults below

Uses rectpack (maximal-rectangles bin packing) for tight packing with 2px padding.
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image
from rectpack import newPacker, PackingMode, PackingBin

PADDING = 2          # px between sprites (prevents texture bleeding)
TARGET_SIZES = [4096, 8192]  # power-of-2 candidates, try smallest first


def collect_pngs(input_dir):
    """Collect all PNG files under input_dir, sorted by area descending for better packing."""
    pngs = []
    for root, _dirs, files in os.walk(input_dir):
        for f in files:
            if f.lower().endswith(".png"):
                pngs.append(os.path.join(root, f))
    # Get dimensions for sort
    sized = []
    for p in pngs:
        with Image.open(p) as im:
            w, h = im.size
        sized.append((w * h, w, h, p))
    sized.sort(reverse=True)  # largest first
    return [(p, w, h) for (_area, w, h, p) in sized]


def try_pack(sprites, atlas_size, padding):
    """
    Attempt to pack all sprites into a single atlas_size x atlas_size bin.
    Returns dict of {rect_index: (x, y, w, h)} or None if it doesn't fit.
    """
    packer = newPacker(
        mode=PackingMode.Offline,
        bin_algo=PackingBin.BFF,
        rotation=False,  # never rotate — keep frame coords intuitive
    )

    # Add all rects (with padding on each side)
    for i, (_path, w, h) in enumerate(sprites):
        packer.add_rect(w + padding, h + padding, i)

    # Single bin
    packer.add_bin(atlas_size, atlas_size)

    packer.pack()

    if len(packer.rect_list()) != len(sprites):
        return None  # didn't fit

    placements = {}
    for rect in packer.rect_list():
        _bin_idx, x, y, w, h, rid = rect
        placements[rid] = (x, y, w, h)
    return placements


def render_atlas(sprites, placements, atlas_size, padding):
    """Render the packed atlas image and collect frame metadata."""
    atlas = Image.new("RGBA", (atlas_size, atlas_size), (0, 0, 0, 0))

    frames = {}
    for i, (path, orig_w, orig_h) in enumerate(sprites):
        x, y, w, h = placements[i]
        # placements include padding; actual sprite starts at (x + padding//2, y + padding//2)
        px = x + (w - orig_w) // 2 if w > orig_w else x
        py = y + (h - orig_h) // 2 if h > orig_h else y
        # Actually rectpack gives us the padded rect; sprite goes at top-left of padded region
        # Re-derive: the padded rect is (x, y, w, h) where w = orig_w + padding
        # Place sprite at (x + padding//2, y + padding//2) for centered padding
        # But simpler: place at (x, y) since padding is "breathing room"
        # We'll place at (x, y) — the padding ensures neighbors don't bleed
        with Image.open(path) as im:
            atlas.paste(im, (x, y))

        # Compute relative frame name (strip .png, use forward slashes)
        rel = os.path.relpath(path, INPUT_DIR)
        frame_name = rel.replace(os.sep, "/").rsplit(".", 1)[0] + ".png"

        frames[frame_name] = {
            "frame": {"x": x, "y": y, "w": orig_w, "h": orig_h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": orig_w, "h": orig_h},
            "sourceSize": {"w": orig_w, "h": orig_h},
        }

    return atlas, frames


def pack_atlas(input_dir, output_dir):
    global INPUT_DIR
    INPUT_DIR = input_dir
    os.makedirs(output_dir, exist_ok=True)

    print(f"Collecting PNGs from {input_dir} ...")
    sprites = collect_pngs(input_dir)
    print(f"  Found {len(sprites)} PNGs")

    if not sprites:
        print("ERROR: No PNGs found!")
        sys.exit(1)

    # Try each target size
    for atlas_size in TARGET_SIZES:
        print(f"\nTrying {atlas_size}x{atlas_size} ...")
        placements = try_pack(sprites, atlas_size, PADDING)
        if placements is not None:
            print(f"  ✓ Packed into {atlas_size}x{atlas_size}")
            break
    else:
        print("ERROR: Sprites don't fit even in 8192x8192!")
        sys.exit(1)

    print("Rendering atlas ...")
    atlas_img, frames = render_atlas(sprites, placements, atlas_size, PADDING)

    # Build JSON metadata (TexturePacker Hash format)
    metadata = {
        "frames": frames,
        "meta": {
            "image": "tiny_swords_atlas.png",
            "format": "RGBA8888",
            "size": {"w": atlas_size, "h": atlas_size},
            "scale": 1,
        },
    }

    # Save
    png_path = os.path.join(output_dir, "tiny_swords_atlas.png")
    json_path = os.path.join(output_dir, "tiny_swords_atlas.json")

    atlas_img.save(png_path, "PNG")
    with open(json_path, "w") as f:
        json.dump(metadata, f, indent=2)

    # Report
    png_size = os.path.getsize(png_path)
    json_size = os.path.getsize(json_path)
    print(f"\n{'='*60}")
    print(f"ATLAS COMPLETE")
    print(f"{'='*60}")
    print(f"  Sprites packed: {len(frames)}")
    print(f"  Atlas dimensions: {atlas_size}x{atlas_size}")
    print(f"  PNG file: {png_path} ({png_size/1024/1024:.2f} MB)")
    print(f"  JSON file: {json_path} ({json_size/1024:.1f} KB)")
    print(f"  Frame entries: {len(frames)}")

    # Quick integrity check
    total_area = sum(s[1] * s[2] for s in sprites)
    fill_pct = total_area / (atlas_size * atlas_size) * 100
    print(f"  Fill ratio: {fill_pct:.1f}%")
    print(f"  Padding: {PADDING}px")

    return png_path, json_path


if __name__ == "__main__":
    input_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/tiny_swords_src"
    output_dir = (
        sys.argv[2]
        if len(sys.argv) > 2
        else "/tmp/tiny_swords_atlas_output"
    )
    pack_atlas(input_dir, output_dir)
