#!/usr/bin/env python3
"""Slice assets/src/aaliyah_sheet.jpg (black background, labelled sections) into a
transparent, uniformly-sized sprite atlas: assets/aaliyah_sprites.png + assets/aaliyah_sprites.json.
Each animation's frames are bottom-aligned (feet on the same line) and horizontally centred
on the body (not the flames), so they play without jitter."""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "src", "aaliyah_sheet.jpg")
SECTIONS = {  # name: (x0, x1, y0, y1)   (labels and divider lines excluded)
    "idle":   (4, 477, 28, 172),
    "walk":   (483, 957, 28, 172),
    "run":    (962, 1514, 28, 172),
    "jump":   (4, 331, 201, 345),
    "crouch": (337, 690, 201, 345),
    "block":  (696, 1046, 201, 345),
    "hit":    (1052, 1514, 201, 345),
}

def frames_in(a, mask, x0, x1, y0, y1):
    sub = mask[y0:y1, x0:x1]
    cols = sub.sum(0) > 0
    runs, start = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and start is None: start = x
        if not c and start is not None:
            runs.append([start, x]); start = None
    # merge runs separated by tiny gaps (flames / loose pixels), drop specks
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] <= 4: merged[-1][1] = r[1]
        else: merged.append(r)
    merged = [r for r in merged if r[1] - r[0] >= 12 and sub[:, r[0]:r[1]].sum() > 400]
    # split boxes that are much wider than a normal frame (overlapping flames) at the emptiest column
    widths = sorted(r[1] - r[0] for r in merged); med = widths[len(widths) // 2]
    split = []
    for rx0, rx1 in merged:
        w = rx1 - rx0
        n = int(round(w / med)) if w > med * 1.6 else 1
        if n > 1:
            occ = sub[:, rx0:rx1].sum(0)
            cuts = []
            for k in range(1, n):
                c = int(w * k / n); lo, hi = max(1, c - med // 3), min(w - 1, c + med // 3)
                cuts.append(rx0 + lo + int(np.argmin(occ[lo:hi])))
            edges = [rx0] + cuts + [rx1]
            split += [[edges[i], edges[i + 1]] for i in range(n)]
        else:
            split.append([rx0, rx1])
    out = []
    for rx0, rx1 in split:
        rowocc = sub[:, rx0:rx1].sum(1) > 0
        # vertically stacked frames: split at empty row bands
        bands, st = [], None
        for y, v in enumerate(list(rowocc) + [False]):
            if v and st is None: st = y
            if not v and st is not None: bands.append([st, y]); st = None
        bands = [b for b in bands if b[1] - b[0] > 8]
        # two poses overlapping vertically (jump peak + landing): cut at the emptiest row
        res = []
        for by0, by1 in bands:
            if by1 - by0 > 125 and (rx1 - rx0) < med * 1.6:
                occ = sub[by0:by1, rx0:rx1].sum(1); h = by1 - by0
                c = by0 + int(h * 0.35) + int(np.argmin(occ[int(h * 0.35):int(h * 0.65)]))
                res += [[by0, c], [c, by1]]
            else:
                res.append([by0, by1])
        bands = res
        for by0, by1 in bands:
            cols2 = np.where(sub[by0:by1, rx0:rx1].sum(0) > 0)[0]
            out.append((x0 + rx0 + cols2[0], y0 + by0, x0 + rx0 + cols2[-1] + 1, y0 + by1))
    out.sort(key=lambda b: (b[0], b[1]))
    return out

def main():
    img = Image.open(SRC).convert("RGB")
    a = np.asarray(img).astype(np.int32)
    lum = a.max(2)
    mask = lum > 30
    # soft alpha from brightness so JPEG-black fringes fade instead of leaving a dark halo
    alpha = np.clip((lum - 14) * 255 // 40, 0, 255).astype(np.uint8)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    anims, cells = {}, []
    for name, (x0, x1, y0, y1) in SECTIONS.items():
        boxes = frames_in(a, mask, x0, x1, y0, y1)
        anims[name] = []
        if name == "block":   # the narrow blue arc is the shield effect, not a pose
            fx = [b for b in boxes if b[2] - b[0] < 40]
            boxes = [b for b in boxes if b[2] - b[0] >= 40]
            for (bx0, by0, bx1, by1) in fx:
                Image.fromarray(rgba[by0:by1, bx0:bx1].copy(), "RGBA").save(os.path.join(ROOT, "assets", "shield_fx.png"))
        for (bx0, by0, bx1, by1) in boxes:
            crop = rgba[by0:by1, bx0:bx1].copy()
            # body centre = column-weighted centre of the lower 60% (legs/torso, ignores flames)
            h = crop.shape[0]
            lower = (crop[int(h * 0.35):, :, 3] > 128).sum(0)
            cx = (lower * np.arange(len(lower))).sum() / max(1, lower.sum())
            cells.append((name, crop, cx))
            anims[name].append(len(cells) - 1)
    # uniform cell size
    CW = int(max(c[1].shape[1] for c in cells) * 1.0) + 24
    CH = max(c[1].shape[0] for c in cells) + 4
    cols = 8
    rows = (len(cells) + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * CW, rows * CH), (0, 0, 0, 0))
    for i, (name, crop, cx) in enumerate(cells):
        ox = (i % cols) * CW + int(round(CW / 2 - cx))
        oy = (i // cols) * CH + CH - 2 - crop.shape[0]
        atlas.alpha_composite(Image.fromarray(crop, "RGBA"), (max(0, ox), oy))
    atlas.save(os.path.join(ROOT, "assets", "aaliyah_sprites.png"), optimize=True)
    meta = {"cellW": CW, "cellH": CH, "cols": cols, "feetPad": 2,
            "anims": {k: v for k, v in anims.items()}}
    with open(os.path.join(ROOT, "assets", "aaliyah_sprites.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print("cell", CW, CH, {k: len(v) for k, v in anims.items()})

if __name__ == "__main__":
    main()
