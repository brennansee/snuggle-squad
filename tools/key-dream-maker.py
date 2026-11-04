"""Make the Dream Maker images web-ready.

Art on a green screen  images/dream-maker/<name>.png  ->  <name>.webp  (transparent, trimmed, quality 90)
Dream backgrounds      images/dream-maker/<name>.png  ->  <name>.webp  (straight conversion, quality 85)
The six Boos           images/characters/<name>.png -> images/dream-maker/boos/<name>.webp
                       (already transparent: just trimmed and shrunk to game size, quality 90)

The keying follows tools/remove-green.py and tools/key-fears.py: a soft HSV key on the
background green, with a safeguard so colours far from that green (the dinosaur's leafy
body, the rainbow's green stripe) stay solid. Edge pixels have the green un-mixed out of
them so there's no halo. Needs Pillow and NumPy:

    pip install pillow numpy
    python3 tools/key-dream-maker.py              # everything
    python3 tools/key-dream-maker.py dinosaur     # just these
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "images/dream-maker"

# green-screen art: name -> largest width to keep (about 2x the biggest it shows in the game)
ART = {"bed": 1600, "beach-ball": 800, "water-slide": 900, "dinosaur": 800,
       "rainbow": 900, "pizza": 800, "rocket": 700}
SCENES = ["beach", "space", "jungle", "candy-land"]
BOOS = ["blanky-boo", "boo-boo", "dreamy-boo", "jammy-boo", "nighty-boo", "snacky-boo"]
BOO_WIDTH = 640


def ramp(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def key_out(path):
    rgb8 = Image.open(path).convert("RGB")
    px = np.asarray(rgb8, dtype=np.float32)
    hsv = np.asarray(rgb8.convert("HSV"), dtype=np.float32)
    h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255

    # the background green, measured round the edge of the picture
    e = 16
    border = np.concatenate([px[:e].reshape(-1, 3), px[-e:].reshape(-1, 3),
                             px[:, :e].reshape(-1, 3), px[:, -e:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    bg_h = np.asarray(Image.fromarray(bg.reshape(1, 1, 3).astype(np.uint8)).convert("HSV"), dtype=np.float32)[0, 0, 0] * 360 / 255

    # how background-green each pixel is: hue close to the screen's, saturated, bright…
    dh = np.abs((h - bg_h + 180) % 360 - 180)
    green = (1 - ramp(dh, 22, 42)) * ramp(s, 0.35, 0.6) * ramp(v, 0.3, 0.55)
    # …and close to the screen colour itself. The screen is very even (within ~6 of its median),
    # while the bright greens in the art (beach-ball cap, palm leaves, rainbow stripe) sit ~100+ away
    near = 1 - ramp(np.linalg.norm(px - bg, axis=-1), 25, 80)
    alpha = 1 - green * near
    alpha = np.where(alpha < 0.06, 0, alpha)

    # un-mix the green from soft edge pixels, then pull down leftover green on the edges only
    a = np.maximum(alpha, 1e-3)[..., None]
    col = (px - (1 - alpha[..., None]) * bg) / a
    soft = alpha < 0.98
    col[..., 1] = np.where(soft, np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2])), col[..., 1])
    return np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)


def resize(img, width):
    """Shrink with premultiplied alpha so edges don't pick up dark fringes."""
    if img.width <= width:
        return img
    height = round(img.height * width / img.width)
    pre = np.asarray(img, dtype=np.float32)
    pre[..., :3] *= pre[..., 3:] / 255
    small = Image.fromarray(pre.astype(np.uint8)).resize((width, height), Image.LANCZOS)
    out = np.asarray(small, dtype=np.float32)
    out[..., :3] = np.where(out[..., 3:] > 0, out[..., :3] * 255 / np.maximum(out[..., 3:], 1), 0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def main(only):
    for name, width in ART.items():
        if only and name not in only:
            continue
        rgba = Image.fromarray(key_out(DIR / f"{name}.png"))
        box = rgba.getchannel("A").point(lambda x: 255 if x > 12 else 0).getbbox()
        pad = 8
        box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, rgba.width), min(box[3] + pad, rgba.height))
        out = DIR / f"{name}.webp"
        img = resize(rgba.crop(box), width)
        img.save(out, "WEBP", quality=90, method=6)
        print(f"{out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB")
    for name in SCENES:
        if only and name not in only:
            continue
        out = DIR / f"{name}.webp"
        img = Image.open(DIR / f"{name}.png").convert("RGB")
        img.save(out, "WEBP", quality=85, method=6)
        print(f"{out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB")
    (DIR / "boos").mkdir(exist_ok=True)
    for name in BOOS:
        if only and name not in only:
            continue
        rgba = Image.open(ROOT / f"images/characters/{name}.png").convert("RGBA")
        box = rgba.getchannel("A").point(lambda x: 255 if x > 12 else 0).getbbox()
        pad = 8
        box = (max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, rgba.width), min(box[3] + pad, rgba.height))
        img = resize(rgba.crop(box), BOO_WIDTH)
        out = DIR / "boos" / f"{name}.webp"
        img.save(out, "WEBP", quality=90, method=6)
        print(f"{out.relative_to(ROOT)}  {img.width}x{img.height}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
