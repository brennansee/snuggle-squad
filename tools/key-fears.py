"""Remove the green-screen background from the fear art and save trimmed WebPs.

Reads  images/fears-game/<name>.png    (art on a bright-green #00FF00-style background)
Writes images/fears-game/<name>.webp   (transparent, trimmed, quality 90)

Keying is HSV-based with soft edges: the closer a pixel's hue is to the background
green (measured from the image's own border), and the more saturated and bright it
is, the more transparent it becomes. Edge pixels then have the green un-mixed from
their colour so there's no green halo. Needs Pillow and NumPy:

    pip install pillow numpy
    python3 tools/key-fears.py                          # all the fall/search images
    python3 tools/key-fears.py storm-fall clown-search   # just these
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "images/fears-game"
FEARS = ["storm", "bed-monster", "shadow", "spider", "clown", "alarm"]
NAMES = [f"{f}-{kind}" for f in FEARS for kind in ("fall", "search")]


def ramp(x, lo, hi):
    """0 below lo, 1 above hi, smooth in between."""
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def key_out(path):
    rgb8 = Image.open(path).convert("RGB")
    px = np.asarray(rgb8, dtype=np.float32)
    hsv = np.asarray(rgb8.convert("HSV"), dtype=np.float32)
    h = hsv[..., 0] * 360 / 255
    s = hsv[..., 1] / 255
    v = hsv[..., 2] / 255

    # the background green, measured round the edge of the picture
    edge = 16
    border = np.concatenate([px[:edge].reshape(-1, 3), px[-edge:].reshape(-1, 3),
                             px[:, :edge].reshape(-1, 3), px[:, -edge:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    bg_h = np.asarray(Image.fromarray(bg.reshape(1, 1, 3).astype(np.uint8)).convert("HSV"), dtype=np.float32)[0, 0, 0] * 360 / 255

    # how "background-green" each pixel is: hue near the background's, saturated, and bright
    dh = np.abs((h - bg_h + 180) % 360 - 180)
    green = (1 - ramp(dh, 28, 50)) * ramp(s, 0.22, 0.5) * ramp(v, 0.18, 0.45)
    alpha = 1 - green
    alpha = np.where(alpha < 0.06, 0, alpha)          # clean out faint noise in the background

    # un-mix the green from semi-transparent edge pixels, then pull down leftover green
    a = np.maximum(alpha, 1e-3)[..., None]
    col = (px - (1 - alpha[..., None]) * bg) / a
    soft = alpha < 0.98
    col[..., 1] = np.where(soft, np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2])), col[..., 1])
    col = np.clip(col, 0, 255)
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def main(only):
    for name in (only or NAMES):
        src = DIR / f"{name}.png"
        rgba = Image.fromarray(key_out(src))
        # trim to the artwork, with a little breathing room
        box = rgba.getchannel("A").point(lambda x: 255 if x > 12 else 0).getbbox()
        pad = 8
        box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, rgba.width), min(box[3] + pad, rgba.height))
        out = DIR / f"{name}.webp"
        rgba.crop(box).save(out, "WEBP", quality=90, method=6)
        w, h = box[2] - box[0], box[3] - box[1]
        print(f"{out.relative_to(ROOT)}  {w}x{h}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
