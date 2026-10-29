"""Remove the green-screen background from the Peek-a-Boo art and save game-ready WebPs.

Reads  images/pillow-game/originals/<name>.png   (art on a flat bright-green background)
Writes images/pillow-game/<name>.webp            (transparent, trimmed and resized)

Poses listed together share one trim box, so swapping poses in the game doesn't
shift the character around. Needs Pillow and NumPy:

    pip install pillow numpy
    python3 tools/remove-green.py                     # every image
    python3 tools/remove-green.py boo-pop boo-peek   # just these (and the rest of their group)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "images/pillow-game/originals"
OUT = ROOT / "images/pillow-game"

# (images that share a trim box, output width in px: about 2x their largest size in the game)
GROUPS = [
    (["peek-searching", "peek-hmm", "peek-startled", "peek-fallen", "peek-cheer"], 760),
    (["boo-pop", "boo-giggle"], 520),
    (["boo-peek"], 360),
    (["pillow"], 560),
]


def key_out(path):
    """Return an RGBA uint8 array with the green background removed."""
    px = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)

    # The background colour, measured from a strip all round the edge
    edge = 24
    border = np.concatenate([px[:edge], px[-edge:], px[:, :edge].swapaxes(0, 1), px[:, -edge:].swapaxes(0, 1)], axis=None)
    bg = np.median(border.reshape(-1, 3), axis=0)

    # How much greener than its other channels each pixel is, compared with the background.
    # A pixel halfway between the character and the background is half as "green".
    spill = px[..., 1] - np.maximum(px[..., 0], px[..., 2])
    bg_spill = bg[1] - max(bg[0], bg[2])
    mix = np.clip(1 - spill / bg_spill, 0, 1)        # true share of character in the pixel
    # Soft greens in the character (like a mint streak of hair) are a little "green" too, but
    # nowhere near the background colour, so anything far from it stays solid
    far = np.clip((np.linalg.norm(px - bg, axis=-1) - 60) / 140, 0, 1)
    mix = np.maximum(mix, far)
    alpha = np.clip((mix - 0.1) / 0.75, 0, 1)         # firmed up: specks of noise vanish, solid stays solid

    # Un-mix the background out of edge pixels so they keep their own colour (no green halo),
    # then pull down any green still left over (edges only, so real greens keep their colour)
    m = mix[..., None]
    rgb = (px - (1 - m) * bg) / np.maximum(m, 1e-3)
    edge = alpha < 1
    rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2])), rgb[..., 1])
    rgb = np.clip(rgb, 0, 255)

    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def main(only):
    for names, width in GROUPS:
        if only and not set(only) & set(names):
            continue
        keyed = {name: key_out(SRC / f"{name}.png") for name in names}

        # One trim box around everything in the group, with a little breathing room
        boxes = [Image.fromarray(a[..., 3]).point(lambda v: 255 if v > 10 else 0).getbbox() for a in keyed.values()]
        pad = 12
        left = max(min(b[0] for b in boxes) - pad, 0)
        top = max(min(b[1] for b in boxes) - pad, 0)
        right = max(b[2] for b in boxes) + pad
        bottom = max(b[3] for b in boxes) + pad

        for name, rgba in keyed.items():
            img = Image.fromarray(rgba).crop((left, top, right, bottom))
            height = round(img.height * width / img.width)
            # resize with premultiplied alpha so edges don't pick up dark fringes
            img = img.convert("RGBa").resize((width, height), Image.LANCZOS).convert("RGBA")
            out = OUT / f"{name}.webp"
            img.save(out, "WEBP", quality=88, method=6)
            print(f"{out.relative_to(ROOT)}  {width}x{height}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
