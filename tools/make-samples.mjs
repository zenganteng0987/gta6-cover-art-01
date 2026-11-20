// Makes the bundled sample photos for Vice Poster: two procedural scenes
// painted pixel by pixel into a buffer and written out as real PNG files
// with a small hand-rolled PNG encoder (Node's zlib for the deflate step).
// No photo of a real person, no game artwork: a sunset strip and a neon
// boulevard, both drawn from scratch with a seeded random generator so the
// result is the same every run.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'samples');
mkdirSync(outDir, { recursive: true });

/** A small deterministic random generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A CRC32 table for the PNG chunks. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

/** Encodes an RGB buffer (width * height * 3 bytes) as a PNG. */
function encodePNG(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A paintable RGB canvas backed by a plain buffer. */
class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 3);
  }

  set(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.pixels[i] = r;
    this.pixels[i + 1] = g;
    this.pixels[i + 2] = b;
  }

  /** Paints a colour over a pixel with alpha 0..1. */
  blend(x, y, r, g, b, a) {
    if (a <= 0) return this.set(x, y, r, g, b);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.pixels[i] = Math.round(this.pixels[i] * (1 - a) + r * a);
    this.pixels[i + 1] = Math.round(this.pixels[i + 1] * (1 - a) + g * a);
    this.pixels[i + 2] = Math.round(this.pixels[i + 2] * (1 - a) + b * a);
  }

  fillRect(x0, y0, x1, y1, [r, g, b]) {
    for (let y = Math.max(0, y0); y < Math.min(this.height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.width, x1); x++) this.set(x, y, r, g, b);
    }
  }

  /** A vertical gradient between colour stops [[pos, [r,g,b]], ...]. */
  vGradient(stops) {
    for (let y = 0; y < this.height; y++) {
      const t = y / (this.height - 1);
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const r = Math.round(a[1][0] + (b[1][0] - a[1][0]) * f);
      const g = Math.round(a[1][1] + (b[1][1] - a[1][1]) * f);
      const bl = Math.round(a[1][2] + (b[1][2] - a[1][2]) * f);
      for (let x = 0; x < this.width; x++) this.set(x, y, r, g, bl);
    }
  }

  disc(cx, cy, radius, [r, g, b], alpha = 1) {
    const r0 = Math.ceil(radius);
    for (let y = cy - r0; y <= cy + r0; y++) {
      for (let x = cx - r0; x <= cx + r0; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius) this.blend(x, y, r, g, b, alpha);
      }
    }
  }

  /** A thick line drawn as a row of discs. */
  thickLine(x0, y0, x1, y1, width, [r, g, b], alpha = 1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      this.disc(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), width / 2, [r, g, b], alpha);
    }
  }
}

/** A row of building silhouettes with lit windows along a horizon line. */
function drawBuildings(cv, horizon, palette, rand, windowColours) {
  let x = -20;
  while (x < cv.width + 20) {
    const bw = 60 + rand() * 110;
    const bh = 90 + rand() * 260;
    const top = horizon - bh;
    cv.fillRect(Math.round(x), Math.round(top), Math.round(x + bw), Math.round(horizon + 2), palette);
    // A few lit windows.
    const cols = Math.floor(bw / 16);
    const rows = Math.floor(bh / 22);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.22) {
          const wc = windowColours[Math.floor(rand() * windowColours.length)];
          cv.fillRect(
            Math.round(x + 6 + c * 16), Math.round(top + 10 + r * 22),
            Math.round(x + 14 + c * 16), Math.round(top + 18 + r * 22), wc,
          );
        }
      }
    }
    // A rooftop antenna on some buildings.
    if (rand() < 0.4) cv.thickLine(Math.round(x + bw / 2), Math.round(top), Math.round(x + bw / 2), Math.round(top - 26), 3, palette);
    x += bw + 6 + rand() * 26;
  }
}

/** A palm silhouette: a leaning trunk and seven drooping fronds. */
function drawPalm(cv, baseX, baseY, height, colour) {
  const topX = baseX + (height * 0.16);
  const topY = baseY - height;
  // Curved trunk, drawn as short segments.
  let px = baseX;
  let py = baseY;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const nx = baseX + (topX - baseX) * t * t;
    const ny = baseY - height * t;
    cv.thickLine(px, py, Math.round(nx), Math.round(ny), 9 - i * 0.6, colour);
    px = Math.round(nx);
    py = Math.round(ny);
  }
  for (let f = 0; f < 7; f++) {
    // Each frond leaves the crown upward and droops down: two segments, the
    // second one angled further down than the first.
    const a = ((200 + f * 23.3) * Math.PI) / 180; // 200..340 degrees, y down
    const len = height * (0.34 + (f % 3) * 0.05);
    const mx = topX + Math.cos(a) * len * 0.55;
    const my = topY + Math.sin(a) * len * 0.55;
    const a2 = a < (3 * Math.PI) / 2 ? a - 0.7 : a + 0.7; // bend toward down
    const ex = mx + Math.cos(a2) * len * 0.55;
    const ey = my + Math.sin(a2) * len * 0.55;
    cv.thickLine(topX, topY, Math.round(mx), Math.round(my), 5, colour);
    cv.thickLine(Math.round(mx), Math.round(my), Math.round(ex), Math.round(ey), 4, colour);
  }
}

/** Scene 1: a Vice City sunset strip — orange sky, low sun, dark skyline,
 *  palm trees and a road catching the sun's reflection. */
function makeSunsetStrip() {
  const W = 1200;
  const H = 800;
  const cv = new Canvas(W, H);
  const rand = rng(20261120);
  cv.vGradient([
    [0, [36, 16, 64]],
    [0.42, [184, 50, 128]],
    [0.68, [255, 126, 95]],
    [1, [254, 180, 123]],
  ]);
  // Far skyline, lighter and hazier; the sun sits in front of it, low over
  // the city, and the near skyline then passes in front of the sun.
  drawBuildings(cv, 560, [74, 38, 92], rng(7), [[255, 190, 110], [255, 220, 160]]);
  cv.disc(760, 400, 150, [255, 214, 130], 0.2);
  cv.disc(760, 400, 100, [255, 214, 130], 0.3);
  cv.disc(760, 400, 82, [255, 233, 168], 1);
  drawBuildings(cv, 640, [28, 15, 46], rand, [[255, 209, 102], [255, 158, 94], [255, 232, 168]]);
  // Ground and the road with the sun's reflection down its middle: a smooth
  // wedge that fades with distance from the centre line and from the horizon.
  cv.fillRect(0, 640, W, H, [22, 10, 38]);
  for (let y = 640; y < H; y++) {
    const t = (y - 640) / (H - 640);
    const half = 26 + t * 90;
    for (let x = Math.round(760 - half); x < Math.round(760 + half); x++) {
      const across = 1 - Math.abs(x - 760) / half;
      cv.blend(x, y, 255, 170, 90, 0.3 * across * (1 - t * 0.5));
    }
  }
  // Road dashes.
  for (let x = 40; x < W; x += 130) cv.fillRect(x, 726, x + 64, 734, [240, 220, 190]);
  drawPalm(cv, 110, 700, 210, [20, 8, 34]);
  drawPalm(cv, 1080, 720, 250, [20, 8, 34]);
  drawPalm(cv, 240, 730, 150, [26, 12, 40]);
  return cv;
}

/** Scene 2: a neon boulevard at night — deep blue sky, stars, towers with
 *  neon windows, glowing signs and a wet street. */
function makeNeonBoulevard() {
  const W = 1200;
  const H = 800;
  const cv = new Canvas(W, H);
  const rand = rng(4242);
  cv.vGradient([
    [0, [5, 8, 24]],
    [0.55, [13, 18, 51]],
    [1, [30, 16, 66]],
  ]);
  // Stars.
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * 320);
    const b = 150 + Math.floor(rand() * 105);
    cv.set(x, y, b, b, Math.min(255, b + 30));
  }
  // Moon.
  cv.disc(180, 110, 46, [232, 236, 255], 1);
  cv.disc(165, 100, 10, [200, 206, 235], 1);
  cv.disc(195, 125, 7, [200, 206, 235], 1);
  const neon = [[34, 211, 238], [240, 46, 170], [255, 46, 136], [250, 204, 21], [168, 85, 247]];
  drawBuildings(cv, 620, [10, 10, 24], rand, neon);
  // Two glowing signs on the towers.
  cv.fillRect(280, 400, 360, 440, [240, 46, 170]);
  cv.fillRect(288, 408, 352, 432, [20, 6, 28]);
  cv.fillRect(830, 340, 930, 380, [34, 211, 238]);
  cv.fillRect(838, 348, 922, 372, [8, 16, 30]);
  // Wet street with neon reflections: a few short vertical streaks.
  cv.fillRect(0, 620, W, H, [11, 11, 20]);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * W);
    const y = 660 + Math.floor(rand() * 120);
    const len = 6 + Math.floor(rand() * 14);
    const c = neon[Math.floor(rand() * neon.length)];
    cv.thickLine(x, y, x, Math.min(H - 1, y + len), 3, c, 0.3);
  }
  for (let x = 40; x < W; x += 130) cv.fillRect(x, 726, x + 64, 734, [240, 220, 190]);
  return cv;
}

const sunset = makeSunsetStrip();
writeFileSync(join(outDir, 'sunset-strip.png'), encodePNG(sunset.width, sunset.height, sunset.pixels));
const neon = makeNeonBoulevard();
writeFileSync(join(outDir, 'neon-boulevard.png'), encodePNG(neon.width, neon.height, neon.pixels));
console.log('wrote samples/sunset-strip.png and samples/neon-boulevard.png');
