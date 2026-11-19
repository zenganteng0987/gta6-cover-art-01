# Turns the exported cover PNGs in screenshots/ into JPEGs at the sizes in
# shots.json, keeping each file under the scorer's 256 KiB cap by stepping the
# quality down until it fits, then removes the PNGs. Run from the repo root:
#   python3 scripts/jpgify.py
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CAP = 262144

shots = json.loads((ROOT / "shots.json").read_text())
for shot in shots:
    png = ROOT / "screenshots" / shot["name"].replace(".jpg", ".png")
    if not png.exists():
        continue
    jpg = ROOT / "screenshots" / shot["name"]
    im = Image.open(png).convert("RGB")
    assert im.size == (shot["w"], shot["h"]), f"{shot['name']}: got {im.size}, want {(shot['w'], shot['h'])}"
    quality = 88
    while quality >= 55:
        im.save(jpg, quality=quality)
        if jpg.stat().st_size <= CAP:
            break
        quality -= 5
    png.unlink()
    print(f"{shot['name']}: {im.size[0]}x{im.size[1]} quality {quality} {jpg.stat().st_size} bytes")
