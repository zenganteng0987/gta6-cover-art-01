// Panel layouts and export sizes for the poster. A layout is a set of rectangles in fractions of the
// canvas (x, y, w, h from the top-left), one set per aspect class, plus the height of the title's
// centre line as a fraction of the canvas height, so the lettering sits on a panel seam like a
// printed poster. Rects leave the gutters and the outer frame to the renderer.

/** The three post sizes the app exports, as canvas pixel dimensions. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

/** Which shape a canvas is: 'wide', 'portrait' or 'square'. */
export function aspectClass(w, h) {
  if (w > h) return 'wide';
  if (h > w) return 'portrait';
  return 'square';
}

export const LAYOUTS = [
  {
    id: 'vice-grid',
    name: 'Vice Grid',
    titleY: { wide: 0.565, square: 0.565, portrait: 0.635 },
    panels: {
      // Three scenes across the top, two wide ones under the title seam.
      wide: [
        [0, 0, 0.34, 0.56], [0.34, 0, 0.33, 0.56], [0.67, 0, 0.33, 0.56],
        [0, 0.56, 0.5, 0.44], [0.5, 0.56, 0.5, 0.44],
      ],
      square: [
        [0, 0, 0.34, 0.56], [0.34, 0, 0.33, 0.56], [0.67, 0, 0.33, 0.56],
        [0, 0.56, 0.5, 0.44], [0.5, 0.56, 0.5, 0.44],
      ],
      // Two over a full-width hero, two under it.
      portrait: [
        [0, 0, 0.5, 0.27], [0.5, 0, 0.5, 0.27],
        [0, 0.27, 1, 0.35],
        [0, 0.62, 0.5, 0.38], [0.5, 0.62, 0.5, 0.38],
      ],
    },
  },
  {
    id: 'hero-strip',
    name: 'Hero Strip',
    titleY: { wide: 0.5, square: 0.5, portrait: 0.45 },
    panels: {
      // One tall hero panel, three stacked beside it.
      wide: [
        [0, 0, 0.46, 1], [0.46, 0, 0.54, 0.52],
        [0.46, 0.52, 0.27, 0.48], [0.73, 0.52, 0.27, 0.48],
      ],
      square: [
        [0, 0, 0.46, 1], [0.46, 0, 0.54, 0.52],
        [0.46, 0.52, 0.27, 0.48], [0.73, 0.52, 0.27, 0.48],
      ],
      // A wide hero on top, two under it, a banner at the foot.
      portrait: [
        [0, 0, 1, 0.44],
        [0, 0.44, 0.5, 0.3], [0.5, 0.44, 0.5, 0.3],
        [0, 0.74, 1, 0.26],
      ],
    },
  },
  {
    id: 'nine-patch',
    name: 'Nine Patch',
    titleY: { wide: 0.5, square: 0.5, portrait: 0.5 },
    panels: {
      wide: ninePatch(),
      square: ninePatch(),
      portrait: ninePatch(),
    },
  },
];

/** A plain 3 × 3 grid of panels. */
function ninePatch() {
  const cells = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      cells.push([col / 3, row / 3, 1 / 3, 1 / 3]);
    }
  }
  return cells;
}

/** The layout object for an id (the first layout when the id is unknown). */
export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

/** A layout's panel rectangles in pixels for a canvas of w × h, inside the frame margin. */
export function panelRects(layout, w, h, margin, gap) {
  const innerW = w - margin * 2;
  const innerH = h - margin * 2;
  return layout.panels[aspectClass(w, h)].map(([fx, fy, fw, fh]) => ({
    x: margin + fx * innerW + (fx > 0 ? gap / 2 : 0),
    y: margin + fy * innerH + (fy > 0 ? gap / 2 : 0),
    w: fw * innerW - (fw < 1 ? gap / 2 : 0) - (fx > 0 ? gap / 2 : 0),
    h: fh * innerH - (fh < 1 ? gap / 2 : 0) - (fy > 0 ? gap / 2 : 0),
  }));
}
