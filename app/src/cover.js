// Paints the cover: graded photos (or a drawn sunset scene where a panel is
// still empty) inside white gutters and a cream frame, in the manner of a
// printed poster, with the caption set in heavy condensed lettering, a ribbon
// for the subtitle and a star badge in the corner. Everything is drawn on a
// 2D canvas at the export size, so the editor preview is the exported PNG,
// pixel for pixel.
import { aspectClass, panelRects } from './layouts.js';

/** The colour grades. `filter` restyles the photo; `wash` is laid over it. */
export const GRADES = [
  {
    id: 'sunset', name: 'Sunset',
    filter: 'saturate(1.32) contrast(1.07) brightness(1.03)',
    wash: ['rgba(255, 122, 60, 0.85)', 'rgba(255, 46, 136, 0.85)'],
    sky: ['#3b1163', '#ff5e62', '#ff9a3c'],
  },
  {
    id: 'neon', name: 'Neon',
    filter: 'saturate(1.5) contrast(1.14) brightness(1.0)',
    wash: ['rgba(0, 229, 255, 0.8)', 'rgba(255, 46, 166, 0.8)'],
    sky: ['#050a30', '#0e2a6e', '#123a7a'],
  },
  {
    id: 'dusk', name: 'Dusk',
    filter: 'saturate(1.18) contrast(1.1) brightness(0.97)',
    wash: ['rgba(123, 47, 247, 0.8)', 'rgba(33, 150, 243, 0.8)'],
    sky: ['#180b36', '#5e2a84', '#e8546c'],
  },
  {
    id: 'gold', name: 'Gold Hour',
    filter: 'sepia(0.32) saturate(1.25) contrast(1.06) brightness(1.04)',
    wash: ['rgba(255, 190, 60, 0.8)', 'rgba(255, 110, 40, 0.8)'],
    sky: ['#4a2408', '#c96a1e', '#ffc93c'],
  },
];

/** The grade object for an id (the first grade when the id is unknown). */
export function gradeById(id) {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}

const FRAME = '#f7f1e6';
const INK = '#17040f';

/** A small deterministic random source, so a cover paints the same every time. */
function seededRandom(seed) {
  let state = (seed * 2654435761) % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

let grainTile = null;

/** A tileable noise pattern for the print grain, built once from a fixed seed. */
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 240;
  tile.height = 240;
  const tctx = tile.getContext('2d');
  const image = tctx.createImageData(240, 240);
  const random = seededRandom(2026);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 96 + Math.floor(random() * 96);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tctx.putImageData(image, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

/**
 * Paints the whole cover onto ctx. `view` carries the canvas size, the layout
 * and grade objects, the grade strength (0..1), one slot per panel
 * ({ img, dx, dy, zoom } — img null for an empty panel), the title and
 * subtitle, and the selected panel index (-1 for none, shown only in the
 * editor). Returns the panel rectangles in pixels.
 */
export function drawCover(ctx, view) {
  const { w, h } = view;
  const margin = Math.round(Math.min(w, h) * 0.018);
  const gap = Math.round(Math.min(w, h) * 0.016);
  const rects = panelRects(view.layout, w, h, margin, gap);

  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, w, h);

  rects.forEach((rect, index) => {
    const slot = view.panels[index] ?? { img: null, dx: 0, dy: 0, zoom: 1 };
    paintPanel(ctx, rect, slot, view.grade, view.intensity, index);
    if (index === view.selected) {
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.006);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  });

  paintTitle(ctx, view);
  paintBadge(ctx, w - margin * 2.1, margin * 2.1, Math.min(w, h) * 0.042);
  finishCover(ctx, w, h);

  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.003);
  ctx.strokeRect(0, 0, w, h);
  return rects;
}

/** One panel: the photo (or a drawn scene) clipped to the rect, graded, shaded. */
function paintPanel(ctx, rect, slot, grade, intensity, index) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (slot.img) paintPhoto(ctx, rect, slot, grade);
  else paintEmptyScene(ctx, rect, grade, index);
  washGrade(ctx, rect, grade, intensity, index);
  // A soft shade along the foot of each panel, so the lettering reads over any photo.
  const shade = ctx.createLinearGradient(0, rect.y + rect.h * 0.62, 0, rect.y + rect.h);
  shade.addColorStop(0, 'rgba(12, 0, 14, 0)');
  shade.addColorStop(1, 'rgba(12, 0, 14, 0.30)');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(23, 4, 15, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
}

/** The photo cover-fitted into the panel, placed by the slot's pan and zoom. */
function paintPhoto(ctx, rect, slot, grade) {
  const img = slot.img;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (slot.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const x = rect.x + (rect.w - dw) * (0.5 + 0.5 * (slot.dx || 0));
  const y = rect.y + (rect.h - dh) * (0.5 + 0.5 * (slot.dy || 0));
  ctx.save();
  ctx.filter = grade.filter;
  ctx.drawImage(img, x, y, dw, dh);
  ctx.restore();
}

/** The grade's two colours washed over the panel; odd panels lean on the second. */
function washGrade(ctx, rect, grade, intensity, index) {
  if (intensity <= 0) return;
  const [first, second] = index % 2 === 0 ? grade.wash : [grade.wash[1], grade.wash[0]];
  const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  wash.addColorStop(0, first);
  wash.addColorStop(1, second);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.9 * intensity;
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.38 * intensity;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/**
 * A drawn scene for a panel with no photo yet: the grade's sky, a low sun, a
 * skyline and palm silhouettes over a sea band — varied by panel index, so an
 * empty cover still reads as a poster.
 */
function paintEmptyScene(ctx, rect, grade, index) {
  const random = seededRandom(index * 7 + 3);
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.62, grade.sky[1]);
  sky.addColorStop(0.78, grade.sky[2]);
  sky.addColorStop(0.781, '#14324e');
  sky.addColorStop(1, '#0a1c30');
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const horizon = rect.y + rect.h * 0.78;
  const sunX = rect.x + rect.w * (0.3 + random() * 0.4);
  const sunR = rect.h * 0.16;
  ctx.fillStyle = '#ffd76e';
  ctx.beginPath();
  ctx.arc(sunX, horizon - sunR * 0.35, sunR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(16, 8, 30, 0.9)';
  let bx = rect.x - rect.w * 0.05;
  while (bx < rect.x + rect.w) {
    const bw = rect.w * (0.06 + random() * 0.09);
    const bh = rect.h * (0.10 + random() * 0.20);
    ctx.fillRect(bx, horizon - bh, bw, bh);
    bx += bw + rect.w * 0.015;
  }
  paintPalm(ctx, rect.x + rect.w * 0.10, rect.y + rect.h, rect.h * 0.52);
  paintPalm(ctx, rect.x + rect.w * 0.94, rect.y + rect.h, rect.h * 0.42);
}

/** A palm silhouette: a curved trunk with drooping fronds, in a panel's corner. */
function paintPalm(ctx, baseX, baseY, size) {
  ctx.save();
  ctx.strokeStyle = 'rgba(10, 4, 18, 0.95)';
  ctx.lineCap = 'round';
  const topX = baseX + size * 0.22;
  const topY = baseY - size;
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + size * 0.05, baseY - size * 0.6, topX, topY);
  ctx.stroke();
  for (const spread of [-1, -0.6, -0.2, 0.25, 0.65, 1]) {
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + spread * size * 0.30, topY - size * 0.16,
      topX + spread * size * 0.46, topY + size * 0.10,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** The caption: the title in heavy condensed capitals with an ink outline. */
function paintTitle(ctx, view) {
  const { w, h } = view;
  const title = (view.title || '').trim().toUpperCase();
  const subtitle = (view.subtitle || '').trim().toUpperCase();
  const centreY = view.layout.titleY[aspectClass(w, h)] * h;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (title) {
    let size = Math.min(h * 0.175, w * 0.2);
    try { ctx.letterSpacing = '0px'; } catch { /* not supported everywhere */ }
    const fitWidth = () => {
      ctx.font = `700 ${size}px "Cover Sans", sans-serif`;
      return ctx.measureText(title).width * 0.84;
    };
    while (fitWidth() > w * 0.88 && size > 14) size *= 0.94;
    // A soft dark bloom behind the words, so they hold over bright panels.
    const bloom = ctx.createRadialGradient(w / 2, centreY, size * 0.2, w / 2, centreY, w * 0.52);
    bloom.addColorStop(0, 'rgba(14, 0, 12, 0.42)');
    bloom.addColorStop(1, 'rgba(14, 0, 12, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, centreY - size * 1.4, w, size * 2.8);

    ctx.save();
    ctx.translate(w / 2, centreY);
    ctx.scale(0.84, 1);
    ctx.font = `700 ${size}px "Cover Sans", sans-serif`;
    ctx.shadowColor = 'rgba(10, 0, 8, 0.6)';
    ctx.shadowBlur = size * 0.10;
    ctx.shadowOffsetY = size * 0.045;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = size * 0.15;
    ctx.strokeText(title, 0, 0);
    ctx.shadowColor = 'transparent';
    const fill = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.62, '#ffe9f4');
    fill.addColorStop(1, '#ffc98a');
    ctx.fillStyle = fill;
    ctx.fillText(title, 0, 0);
    ctx.restore();

    if (subtitle) paintRibbon(ctx, subtitle, w / 2, centreY + size * 0.78, size * 0.30);
  } else if (subtitle) {
    paintRibbon(ctx, subtitle, w / 2, centreY, Math.min(h * 0.05, w * 0.06));
  }
  ctx.restore();
}

/** The subtitle in white capitals on a slanted sunset-gradient ribbon. */
function paintRibbon(ctx, text, cx, cy, size) {
  ctx.save();
  ctx.font = `700 ${size}px "Cover Sans", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.22)}px`; } catch { /* older engines: no spacing */ }
  const textW = ctx.measureText(text).width * 0.88;
  const ribbonW = textW + size * 1.7;
  const ribbonH = size * 1.62;
  const slant = ribbonH * 0.28;
  ctx.translate(cx, cy);
  ctx.rotate(-0.018);
  const ribbon = ctx.createLinearGradient(-ribbonW / 2, 0, ribbonW / 2, 0);
  ribbon.addColorStop(0, '#ff2e88');
  ribbon.addColorStop(1, '#ff7a3c');
  ctx.shadowColor = 'rgba(10, 0, 8, 0.45)';
  ctx.shadowBlur = size * 0.35;
  ctx.shadowOffsetY = size * 0.12;
  ctx.fillStyle = ribbon;
  ctx.beginPath();
  ctx.moveTo(-ribbonW / 2 + slant, -ribbonH / 2);
  ctx.lineTo(ribbonW / 2 + slant, -ribbonH / 2);
  ctx.lineTo(ribbonW / 2 - slant, ribbonH / 2);
  ctx.lineTo(-ribbonW / 2 - slant, ribbonH / 2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.scale(0.88, 1);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.05);
  ctx.restore();
}

/** A gold star in a dark-ringed disc, the poster's corner badge. */
function paintBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb52e';
  ctx.fill();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 === 0 ? r * 0.62 : r * 0.27;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff6e8';
  ctx.fill();
  ctx.restore();
}

/** A gentle vignette and the print grain over the finished cover. */
function finishCover(ctx, w, h) {
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vignette.addColorStop(0, 'rgba(16, 0, 14, 0)');
  vignette.addColorStop(1, 'rgba(16, 0, 14, 0.30)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
