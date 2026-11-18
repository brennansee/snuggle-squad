"""Cut the SNUGGEROO characters out of their green screens (OpenCV).

Reads   ~/Downloads/snuggeroo characters/<name>.png   (art on a #00FF00 green screen)
Writes  images/characters/<name>.png                   (full size, transparent, trimmed)
        images/characters/web/<name>.webp              (560px wide, for the website)

How the key works:
  1. HSV mask: a pixel is "green screen" if it falls inside
         lower H=35 S=40 V=40   …   upper H=85 S=255 V=255   (OpenCV hue runs 0–180)
  2. Safeguard (Jumpin Jammies and Story Roary only): that range also covers yellow-greens
     and teals, which would cut holes in Jumpin Jammies (lime green) and Story Roary's
     blue-green hair. For those two, a pixel is only removed if it is ALSO close to the
     actual screen colour, measured from the picture's border; their own greens are far
     from pure #00FF00, so they stay solid. The other five have no greens of their own, so
     they use the HSV range as it is (which also clears green haze from glows and bubbles).
  3. 2px feather: the mask edge is blurred so cutouts are soft, not jagged.
  4. Clean edges: in the soft edge, the green is un-mixed from the colour, and any
     leftover pure-green tint is pulled out (only pure-green hues, so lime and teal keep
     their colour).

    pip install opencv-python-headless numpy
    python3 tools/snuggeroo-cutouts.py                 # all seven
    python3 tools/snuggeroo-cutouts.py peek boo        # just these
"""
import sys
from pathlib import Path

import cv2
import numpy as np

SRC = Path.home() / "Downloads" / "snuggeroo characters"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "images" / "characters"
WEB = OUT / "web"
NAMES = ["baby-blanky", "boo", "jumpin-jammies", "nighty-light", "peek", "snack-attack", "story-roary"]

HSV_LOWER = np.array([35, 40, 40], np.uint8)
HSV_UPPER = np.array([85, 255, 255], np.uint8)
SCREEN_DISTANCE = 70      # how close (RGB distance) to the screen colour a pixel must be to be removed
GUARDED = {"jumpin-jammies", "story-roary"}   # characters with real greens in their art
FEATHER_PX = 2            # softness of the cutout edge
WEB_WIDTH = 560


def cut_out(path, guarded):
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # the screen colour, from a strip round the edge of the picture
    e = 16
    border = np.concatenate([bgr[:e].reshape(-1, 3), bgr[-e:].reshape(-1, 3),
                             bgr[:, :e].reshape(-1, 3), bgr[:, -e:].reshape(-1, 3)])
    screen = np.median(border, axis=0)

    in_range = cv2.inRange(hsv, HSV_LOWER, HSV_UPPER) > 0
    if guarded:
        in_range &= np.linalg.norm(bgr.astype(np.float32) - screen, axis=2) < SCREEN_DISTANCE
    key = in_range.astype(np.uint8) * 255
    key = cv2.morphologyEx(key, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))   # drop stray specks

    # feather the edge
    k = FEATHER_PX * 2 + 1
    soft = cv2.GaussianBlur(key, (k, k), FEATHER_PX)
    alpha = 1 - soft.astype(np.float32) / 255
    alpha[alpha < 0.04] = 0

    # un-mix the screen green out of the soft edge, then pull out leftover pure-green tint there
    a = np.maximum(alpha, 1e-3)[..., None]
    col = (bgr.astype(np.float32) - (1 - alpha[..., None]) * screen) / a
    col = np.where(alpha[..., None] < 0.995, col, bgr.astype(np.float32))
    band = cv2.dilate((alpha < 0.995).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    pure_green = (hsv[..., 0] >= 50) & (hsv[..., 0] <= 70)
    fix = band & pure_green
    b, g, r = col[..., 0], col[..., 1], col[..., 2]
    col[..., 1] = np.where(fix, np.minimum(g, np.maximum(r, b)), g)
    col = np.clip(col, 0, 255).astype(np.uint8)

    bgra = np.dstack([col, (alpha * 255).astype(np.uint8)])
    ys, xs = np.nonzero(bgra[..., 3] > 12)
    pad = 10
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, bgra.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, bgra.shape[1])
    return bgra[y0:y1, x0:x1]


def web_copy(bgra):
    h, w = bgra.shape[:2]
    if w <= WEB_WIDTH:
        return bgra
    # shrink with premultiplied alpha so edges don't go dark
    f = bgra.astype(np.float32)
    f[..., :3] *= f[..., 3:] / 255
    size = (WEB_WIDTH, round(h * WEB_WIDTH / w))
    s = cv2.resize(f, size, interpolation=cv2.INTER_AREA)
    s[..., :3] = np.where(s[..., 3:] > 0, s[..., :3] * 255 / np.maximum(s[..., 3:], 1), 0)
    return np.clip(s, 0, 255).astype(np.uint8)


def main(only):
    WEB.mkdir(parents=True, exist_ok=True)
    for name in only or NAMES:
        bgra = cut_out(SRC / f"{name}.png", name in GUARDED)
        png = OUT / f"{name}.png"
        cv2.imwrite(str(png), bgra, [cv2.IMWRITE_PNG_COMPRESSION, 9])
        small = web_copy(bgra)
        webp = WEB / f"{name}.webp"
        cv2.imwrite(str(webp), small, [cv2.IMWRITE_WEBP_QUALITY, 90])
        print(f"{name:15s} {bgra.shape[1]}x{bgra.shape[0]} png {png.stat().st_size // 1024} KB · "
              f"web {small.shape[1]}x{small.shape[0]} {webp.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
