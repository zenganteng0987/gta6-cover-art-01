// Draws a Vice Poster cover onto a canvas: photo panels in one of three
// layouts, a colour grade wash over them, then the caption lettering, the
// ribbon subtitle and the star badge on top. Everything is drawn with the
// canvas 2D API, so the same code paints the live preview and the exported PNG.
//
// A cover state looks like:
//   { layout, grade, strength, caption, subtitle, star, photos, panels }
// where `photos` is an array of images and each entry of `panels` is
//   { photo, zoom, ox, oy }
// (`photo` is an index into `photos`, `zoom` a scale factor, `ox`/`oy` the
// drag offset as a fraction of the panel's own width and height).
import { gradeFor } from './grades.js';

/** Panel rectangles for each layout, in unit coordinates (0..1 of the cover). */
export const LAYOUTS = {
  grid: {
    label: 'Vice Grid',
    panels: 5,
    rects: [
      [0, 0, 0.56, 1],
      [0.56, 0, 0.44, 0.34],
      [0.56, 0.34, 0.44, 0.33],
      [0.56, 0.67, 0.22, 0.33],
      [0.78, 0.67, 0.22, 0.33],
    ],
  },
  hero: {
    label: 'Hero Strip',
    panels: 4,
    rects: [
      [0, 0, 1, 0.58],
      [0, 0.58, 1 / 3, 0.42],
      [1 / 3, 0.58, 1 / 3, 0.42],
      [2 / 3, 0.58, 1 / 3, 0.42],
    ],
  },
  nine: {
    label: 'Nine Patch',
    panels: 9,
    rects: [
      [0, 0, 1 / 3, 1 / 3],
      [1 / 3, 0, 1 / 3, 1 / 3],
      [2 / 3, 0, 1 / 3, 1 / 3],
      [0, 1 / 3, 1 / 3, 1 / 3],
      [1 / 3, 1 / 3, 1 / 3, 1 / 3],
      [2 / 3, 1 / 3, 1 / 3, 1 / 3],
      [0, 2 / 3, 1 / 3, 1 / 3],
      [1 / 3, 2 / 3, 1 / 3, 1 / 3],
      [2 / 3, 2 / 3, 1 / 3, 1 / 3],
    ],
  },
};

/** The layout names in the order the editor shows them. */
export const LAYOUT_NAMES = Object.keys(LAYOUTS);

/** Returns the layout object for `name`, falling back to Vice Grid. */
export function layoutFor(name) {
  return LAYOUTS[name] ?? LAYOUTS.grid;
}

/** A fresh panel entry: the first photo, no zoom, no drag offset. */
export function freshPanel() {
  return { photo: 0, zoom: 1, ox: 0, oy: 0 };
}

/** A fresh set of nine panel entries, one per panel slot. */
export function freshPanels() {
  return Array.from({ length: 9 }, () => freshPanel());
}

/** Paints one photo into a panel rectangle, cover-fitting it and applying
 *  the panel's zoom and drag offset. The photo is clipped to the panel. */
export function drawPanelPhoto(ctx, img, rect, panel) {
  const [ux, uy, uw, uh] = rect;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x = ux * w;
  const y = uy * h;
  const pw = uw * w;
  const ph = uh * h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, pw, ph);
  ctx.clip();
  if (img) {
    const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const scale = base * panel.zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = x + (pw - dw) / 2 + panel.ox * pw;
    const dy = y + (ph - dh) / 2 + panel.oy * ph;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(x, y, pw, ph);
  }
  ctx.restore();
}

/** Lays the grade's diagonal wash over the whole cover. */
export function applyGradeWash(ctx, gradeName, strength) {
  const grade = gradeFor(gradeName);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const wash = ctx.createLinearGradient(0, 0, w, h);
  for (const [stop, colour] of grade.stops) wash.addColorStop(stop, colour);
  ctx.save();
  ctx.globalCompositeOperation = grade.blend;
  ctx.globalAlpha = Math.max(0, Math.min(1, strength));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Draws the big caption along the foot of the cover, shrinking it until it
 *  fits, in bold capitals with a dark outline so it reads over any photo. */
export function drawCaptionLettering(ctx, caption, accent) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const text = caption.trim().toUpperCase();
  if (!text) return 0;
  const bottom = h * 0.965;
  let size = h * 0.115;
  ctx.font = `bold ${size}px "Liberation Sans", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.04)}px`; } catch { /* older canvas */ }
  while (ctx.measureText(text).width > w * 0.92 && size > 14) {
    size -= 2;
    ctx.font = `bold ${size}px "Liberation Sans", sans-serif`;
  }
  const scrim = ctx.createLinearGradient(0, h * 0.62, 0, h);
  scrim.addColorStop(0, 'rgba(10, 4, 24, 0)');
  scrim.addColorStop(1, 'rgba(10, 4, 24, 0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeStyle = 'rgba(12, 4, 26, 0.85)';
  ctx.strokeText(text, w / 2, bottom);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, bottom);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  return size;
}

/** Draws the ribbon subtitle: a slightly tilted band above the caption. */
export function drawRibbonSubtitle(ctx, subtitle, captionSize, accent) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const text = subtitle.trim().toUpperCase();
  if (!text) return;
  const size = Math.max(12, h * 0.032);
  ctx.font = `bold ${size}px "Liberation Sans", sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const bandWidth = Math.min(w * 0.9, textWidth + size * 2.4);
  const bandHeight = size * 2.1;
  const cx = w / 2;
  // Sit just above the caption: the caption's baseline is at h * 0.965 and
  // its top is about one caption size above that.
  const captionBaseline = h * 0.965;
  const cy = captionBaseline - captionSize - bandHeight * 0.5 - h * 0.012;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.035);
  ctx.fillStyle = accent;
  ctx.beginPath();
  const hw = bandWidth / 2;
  const hh = bandHeight / 2;
  ctx.moveTo(-hw + hh, -hh);
  ctx.lineTo(hw - hh, -hh);
  ctx.lineTo(hw, 0);
  ctx.lineTo(hw - hh, hh);
  ctx.lineTo(-hw + hh, hh);
  ctx.lineTo(-hw, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#14081f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
}

/** Draws a five-pointed star with the badge text under it, top right. */
export function drawStarBadge(ctx, starText, accent) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w * 0.9;
  const cy = h * 0.075;
  const outer = Math.max(14, w * 0.042);
  const inner = outer * 0.45;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd23e';
  ctx.fill();
  ctx.lineWidth = Math.max(2, outer * 0.08);
  ctx.strokeStyle = 'rgba(12, 4, 26, 0.9)';
  ctx.stroke();
  const label = starText.trim().toUpperCase();
  if (label) {
    const size = Math.max(10, h * 0.02);
    ctx.font = `bold ${size}px "Liberation Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = Math.max(2, size * 0.18);
    ctx.strokeStyle = 'rgba(12, 4, 26, 0.85)';
    const ty = cy + outer + size * 0.6;
    ctx.strokeText(label, cx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, ty);
  }
  ctx.restore();
}

/** Renders a full cover from `state` onto the canvas's 2D context. */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = layoutFor(state.layout);
  const grade = gradeFor(state.grade);
  // White gutters: paint the sheet white, then inset each panel by half a gutter.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const gutter = Math.max(3, Math.round(Math.min(w, h) * 0.008));
  for (let i = 0; i < layout.panels; i++) {
    const [ux, uy, uw, uh] = layout.rects[i];
    // Inset every side by half the gutter, in pixels.
    const px = ux * w + gutter / 2;
    const py = uy * h + gutter / 2;
    const pw = uw * w - gutter;
    const ph = uh * h - gutter;
    const panel = state.panels[i] ?? freshPanel();
    const img = state.photos[panel.photo] ?? null;
    drawPanelPhoto(ctx, img, [px / w, py / h, pw / w, ph / h], panel);
  }
  applyGradeWash(ctx, state.grade, state.strength);
  const captionSize = drawCaptionLettering(ctx, state.caption, grade.accent);
  drawRibbonSubtitle(ctx, state.subtitle, captionSize, grade.accent);
  drawStarBadge(ctx, state.star, grade.accent);
}
