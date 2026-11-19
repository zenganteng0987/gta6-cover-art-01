# Draws the three bundled sample scenes for Vice Poster with Pillow: a sunset
# harbor, a neon night cruiser and a dusk rooftop. Every scene is original art
# built from gradients, silhouettes and light dots -- no real person's photo and
# no artwork from any game. Run from the repo root: python3 scripts/make-samples.py
import math
import random
from PIL import Image, ImageDraw, ImageFilter

W, H = 2000, 1500


def vgrad(size, stops):
    """Vertical gradient image from a list of (position 0..1, (r, g, b))."""
    w, h = size
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                f = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                px[0, y] = tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                break
        else:
            px[0, y] = stops[-1][1]
    return img.resize((w, h))


def skyline(d, base_y, x0, x1, hmin, hmax, color, rng):
    """A row of dark building blocks with a few lit windows."""
    x = x0
    while x < x1:
        bw = rng.randint(60, 170)
        bh = rng.randint(hmin, hmax)
        d.rectangle([x, base_y - bh, x + bw, base_y], fill=color)
        if rng.random() < 0.5:  # a rooftop antenna
            d.line([x + bw // 2, base_y - bh, x + bw // 2, base_y - bh - rng.randint(30, 90)],
                   fill=color, width=6)
        for _ in range(rng.randint(2, 9)):  # lit windows
            wx = x + rng.randint(8, max(9, bw - 18))
            wy = base_y - rng.randint(15, max(16, bh - 15))
            d.rectangle([wx, wy, wx + 10, wy + 14],
                        fill=rng.choice([(255, 214, 110), (255, 240, 190), (140, 220, 255)]))
        x += bw + rng.randint(4, 26)


def qbez(p0, p1, p2, n=24):
    """Points along a quadratic bezier curve."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def palm(d, bx, by, size, color):
    """A palm silhouette: a nearly straight trunk leaning slightly, and short
    fronds that arc out from the crown and droop at the tips."""
    top = (bx + size * 0.16, by - size)
    d.line(qbez((bx, by), (bx + size * 0.10, by - size * 0.5), top),
           fill=color, width=max(6, int(size * 0.045)), joint="curve")
    for ang in (-165, -130, -95, -60, -25, 10):
        rad = math.radians(ang)
        reach = size * 0.34
        tip = (top[0] + reach * math.cos(rad), top[1] + reach * 0.35 + size * 0.10)
        mid = (top[0] + reach * 0.6 * math.cos(rad), top[1] - size * 0.16)
        d.line(qbez(top, mid, tip), fill=color, width=max(4, int(size * 0.02)), joint="curve")


def harbor():
    rng = random.Random(11)
    img = vgrad((W, H), [(0.0, (46, 16, 92)), (0.45, (214, 64, 96)),
                         (0.62, (255, 140, 66)), (0.72, (255, 190, 90)),
                         (0.73, (16, 44, 78)), (1.0, (8, 24, 48))])
    d = ImageDraw.Draw(img, "RGBA")
    horizon = int(H * 0.72)
    # Low sun, high enough to clear the skyline, and its shimmer on the water.
    sun_cx, sun_cy, sun_r = W * 0.5, horizon - 330, 150
    d.ellipse([sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r], fill=(255, 214, 110))
    for i in range(26):
        y = horizon + 30 + i * 26
        half = 60 + rng.randint(0, 150) - i * 2
        d.line([W / 2 - half, y, W / 2 + half, y], fill=(255, 190, 90, 170 - i * 5), width=7)
    skyline(d, horizon, -40, W + 40, 130, 330, (18, 8, 34), rng)
    palm(d, 110, H, 380, (12, 5, 24))
    palm(d, W - 80, H, 330, (12, 5, 24))
    # A few birds.
    for _ in range(7):
        x, y = rng.randint(150, W - 150), rng.randint(120, 420)
        d.arc([x, y, x + 46, y + 22], 200, 340, fill=(20, 8, 30), width=5)
        d.arc([x + 44, y, x + 90, y + 22], 200, 340, fill=(20, 8, 30), width=5)
    return img


def cruiser():
    rng = random.Random(23)
    img = vgrad((W, H), [(0.0, (4, 8, 44)), (0.5, (12, 30, 84)),
                         (0.62, (38, 16, 88)), (0.63, (10, 10, 26)), (1.0, (6, 6, 18))])
    d = ImageDraw.Draw(img, "RGBA")
    horizon = int(H * 0.62)
    # Neon sun with horizontal slats, low over the street.
    sun_cx, sun_cy, sun_r = W // 2, horizon - 170, 210
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([sun_cx - sun_r - 60, sun_cy - sun_r - 60, sun_cx + sun_r + 60, sun_cy + sun_r + 60],
               fill=(255, 46, 166, 60))
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(40))).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r],
              fill=(255, 214, 110))
    for i in range(7):  # slats cutting the lower half of the sun
        y = sun_cy + 10 + i * 26
        d.rectangle([sun_cx - sun_r - 4, y, sun_cx + sun_r + 4, y + 9], fill=(12, 30, 84))
    # Street: a perspective grid glowing cyan and pink.
    for i in range(-8, 9):
        d.line([W / 2 + i * 90, horizon, W / 2 + i * 420, H], fill=(0, 229, 255, 200), width=5)
    for i in range(7):
        y = horizon + int((H - horizon) * (i / 6) ** 1.7)
        d.line([0, y, W, y], fill=(255, 46, 166, 190), width=4)
    # A low sports-car silhouette, side profile, with neon underglow.
    # Body: long hood, low cabin, short tail. Wheels sit on the road line.
    body = [(560, 1120), (600, 1060), (760, 1030), (880, 990), (1080, 975),
            (1230, 1000), (1360, 1040), (1440, 1075), (1440, 1120), (1360, 1135),
            (1290, 1135), (1260, 1095), (760, 1095), (720, 1135), (600, 1135)]
    d.polygon(body, fill=(10, 8, 24))
    # Cabin glass, slightly lighter than the body.
    d.polygon([(900, 1005), (1075, 992), (1210, 1012), (1180, 1045), (920, 1045)],
              fill=(40, 60, 110))
    d.ellipse([W / 2 - 320, 1150, W / 2 + 320, 1185], fill=(0, 229, 255, 110))
    for wx, rim in ((800, (0, 229, 255)), (1240, (255, 46, 166))):
        d.ellipse([wx - 42, 1093, wx + 42, 1177], fill=(14, 14, 22), outline=rim, width=6)
        d.ellipse([wx - 16, 1119, wx + 16, 1151], fill=(60, 60, 80))
    d.rectangle([1422, 1062, 1452, 1082], fill=(255, 240, 160))
    d.rectangle([548, 1062, 566, 1080], fill=(255, 80, 90))
    skyline(d, horizon, -40, W + 40, 90, 260, (8, 8, 30), rng)
    return img


def rooftop():
    rng = random.Random(37)
    img = vgrad((W, H), [(0.0, (24, 10, 54)), (0.45, (94, 42, 132)),
                         (0.62, (232, 84, 108)), (0.72, (255, 170, 80)),
                         (0.73, (30, 22, 52)), (1.0, (14, 10, 30))])
    d = ImageDraw.Draw(img, "RGBA")
    horizon = int(H * 0.72)
    d.ellipse([W * 0.30 - 170, horizon - 330 - 170, W * 0.30 + 170, horizon - 330 + 170],
              fill=(255, 214, 110))
    skyline(d, horizon, -40, W + 40, 150, 380, (16, 8, 32), rng)
    # Foreground rooftop edge, a water tower and a blinking antenna.
    d.rectangle([0, H - 260, W, H], fill=(12, 7, 24))
    d.rectangle([150, H - 560, 260, H - 260], fill=(20, 12, 34))
    d.polygon([(140, H - 560), (205, H - 660), (270, H - 560)], fill=(20, 12, 34))
    d.line([205, H - 660, 205, H - 780], fill=(20, 12, 34), width=8)
    d.ellipse([195, H - 800, 215, H - 780], fill=(255, 80, 90))
    # Warm string lights across the roofline.
    for i in range(24):
        x = 320 + i * 68
        y = H - 260 + int(46 * abs((i % 8) - 4) / 4)
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(255, 200, 100))
        if i:
            d.line([320 + (i - 1) * 68, H - 260 + int(46 * abs(((i - 1) % 8) - 4) / 4), x, y],
                   fill=(255, 200, 100, 140), width=3)
    # City lights far below the roofline, sparse so they read as a distant city.
    for _ in range(130):
        x, y = rng.randint(0, W), rng.randint(horizon + 20, H - 280)
        d.ellipse([x, y, x + 5, y + 5], fill=rng.choice([(255, 214, 110), (255, 240, 190), (140, 220, 255)]))
    return img


for name, make in (("harbor", harbor), ("cruiser", cruiser), ("rooftop", rooftop)):
    path = f"app/samples/{name}.jpg"
    make().save(path, quality=88)
    print("wrote", path)
