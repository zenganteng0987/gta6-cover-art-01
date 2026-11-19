// Vice Poster: the editor. A person's photos (read on their own machine, never
// uploaded) fill the panels of a poster layout; each photo can be dragged and
// zoomed inside its panel; the caption, the layout, the colour grade and the
// post size are picked beside a live canvas preview, and one button exports the
// PNG. The canvas is always painted at the export size, so the preview is the
// export. A `?shot=` query instead sets up a fixed scene for the maker's
// screenshots (./shots.js).
import { drawCover, GRADES, gradeById } from './cover.js';
import { LAYOUTS, SIZES, aspectClass, layoutById } from './layouts.js';
import { runShot } from './shots.js';

/** Sample photos shipped with the app, so a first cover takes one click. */
export const SAMPLES = [
  { key: 'harbor', label: 'Sunset Harbor' },
  { key: 'cruiser', label: 'Neon Cruiser' },
  { key: 'rooftop', label: 'Rooftop Dusk' },
  { key: 'pier', label: 'The Pier' },
  { key: 'boulevard', label: 'The Boulevard' },
];

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const tray = document.getElementById('tray');
const selectedLabel = document.getElementById('selected-label');
const zoomInput = document.getElementById('zoom');

const state = {
  photos: [], // [{ img, label }]
  slotsByKey: new Map(), // "layoutId:aspect" -> [{ photo, dx, dy, zoom }]
  layoutId: 'vice-grid',
  gradeId: 'sunset',
  intensity: 0.85,
  sizeKey: 'square',
  title: 'NEON HARBOR',
  subtitle: 'ONE LAST SCORE',
  selected: 0,
  lastRects: [],
};

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** The slots for the current layout and canvas shape, created empty on first use. */
function currentSlots() {
  const size = SIZES[state.sizeKey];
  const key = `${state.layoutId}:${aspectClass(size.w, size.h)}`;
  if (!state.slotsByKey.has(key)) {
    const count = layoutById(state.layoutId).panels[aspectClass(size.w, size.h)].length;
    state.slotsByKey.set(key, Array.from({ length: count }, () => ({ photo: -1, dx: 0, dy: 0, zoom: 1 })));
  }
  return state.slotsByKey.get(key);
}

/** Paints the cover at the export size and remembers the panel rects for pointer work. */
export function redraw() {
  const size = SIZES[state.sizeKey];
  canvas.width = size.w;
  canvas.height = size.h;
  const slots = currentSlots();
  state.lastRects = drawCover(ctx, {
    w: size.w,
    h: size.h,
    layout: layoutById(state.layoutId),
    grade: gradeById(state.gradeId),
    intensity: state.intensity,
    panels: slots.map((slot) => ({
      img: slot.photo >= 0 ? state.photos[slot.photo]?.img ?? null : null,
      dx: slot.dx,
      dy: slot.dy,
      zoom: slot.zoom,
    })),
    title: state.title,
    subtitle: state.subtitle,
    selected: document.body.classList.contains('shot-cover') ? -1 : state.selected,
  });
  selectedLabel.textContent = `Panel ${state.selected + 1} of ${slots.length}`;
  zoomInput.value = String(slots[state.selected]?.zoom ?? 1);
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Adds a loaded image to the photo tray and, when asked, fills the panels with the photos in order. */
export function addPhoto(img, label, fill = false) {
  state.photos.push({ img, label });
  renderTray();
  if (fill) spreadPhotos();
  redraw();
  return state.photos.length - 1;
}

/** Gives each panel the next photo in turn, wrapping around: one photo fills every panel alike. */
export function spreadPhotos() {
  if (state.photos.length === 0) return;
  currentSlots().forEach((slot, index) => {
    slot.photo = index % state.photos.length;
    slot.dx = 0;
    slot.dy = 0;
    slot.zoom = 1;
  });
  state.selected = 0;
}

/** Rebuilds the tray of photo thumbnails; a click assigns the photo to the selected panel. */
function renderTray() {
  tray.replaceChildren();
  state.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = `${photo.label} — click to put it in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.label;
    button.append(thumb);
    button.addEventListener('click', () => {
      currentSlots()[state.selected].photo = index;
      redraw();
    });
    tray.append(button);
  });
}

/** Reads the person's picked files on their own machine and adds them to the tray. */
async function onFilesPicked(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    addPhoto(img, file.name.replace(/\.[^.]+$/, ''), true);
  }
  if (files.length > 0) status.textContent = `${files.length} photo(s) added — drag inside a panel to position it.`;
}

/** Exports the current cover as a PNG at the chosen post size. */
export function exportPng() {
  const size = SIZES[state.sizeKey];
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-poster-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-poster-${size.w}x${size.h}.png`;
  }, 'image/png');
}

/** Paints a size off-screen of the editor's flow and returns its PNG data URL (used by shots). */
export function exportDataURL(sizeKey) {
  const keep = state.sizeKey;
  state.sizeKey = sizeKey;
  redraw();
  const url = canvas.toDataURL('image/png');
  state.sizeKey = keep;
  redraw();
  return url;
}

/** Applies a whole scene at once (samples by key, caption, size, layout, grade) for screenshots. */
export async function applyScene(scene) {
  if (scene.size) state.sizeKey = scene.size;
  if (scene.layout) state.layoutId = scene.layout;
  if (scene.grade) state.gradeId = scene.grade;
  if (scene.intensity !== undefined) state.intensity = scene.intensity;
  if (scene.title !== undefined) state.title = scene.title;
  if (scene.subtitle !== undefined) state.subtitle = scene.subtitle;
  if (scene.photos) {
    state.photos = [];
    for (const key of scene.photos) {
      const sample = SAMPLES.find((s) => s.key === key) ?? SAMPLES[0];
      const img = await loadImage(`samples/${sample.key}.jpg`);
      state.photos.push({ img, label: sample.label });
    }
    renderTray();
    spreadPhotos();
  }
  syncControls();
  redraw();
}

/** Pushes the state into the form controls (after a scene or a sample load changes it). */
function syncControls() {
  document.getElementById('title-input').value = state.title;
  document.getElementById('subtitle-input').value = state.subtitle;
  for (const input of document.querySelectorAll('input[name="layout"]')) input.checked = input.value === state.layoutId;
  for (const input of document.querySelectorAll('input[name="grade"]')) input.checked = input.value === state.gradeId;
  for (const input of document.querySelectorAll('input[name="size"]')) input.checked = input.value === state.sizeKey;
  document.getElementById('intensity').value = String(state.intensity);
}

function wireControls() {
  document.getElementById('photo-file').addEventListener('change', (e) => onFilesPicked([...e.target.files]));
  document.getElementById('export-btn').addEventListener('click', exportPng);
  document.getElementById('fill-all').addEventListener('click', () => {
    const slots = currentSlots();
    const photo = slots[state.selected]?.photo ?? 0;
    if (state.photos.length > 0) slots.forEach((slot) => { slot.photo = Math.max(0, photo); });
    redraw();
  });
  document.getElementById('auto-fill').addEventListener('click', () => { spreadPhotos(); redraw(); });
  document.getElementById('clear-panel').addEventListener('click', () => {
    const slot = currentSlots()[state.selected];
    if (slot) { slot.photo = -1; slot.dx = 0; slot.dy = 0; slot.zoom = 1; }
    redraw();
  });
  document.getElementById('title-input').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  document.getElementById('subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  document.getElementById('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); redraw(); });
  zoomInput.addEventListener('input', (e) => {
    const slot = currentSlots()[state.selected];
    if (slot) slot.zoom = Number(e.target.value);
    redraw();
  });
  for (const input of document.querySelectorAll('input[name="layout"]')) {
    input.addEventListener('change', () => { state.layoutId = input.value; state.selected = 0; redraw(); });
  }
  for (const input of document.querySelectorAll('input[name="grade"]')) {
    input.addEventListener('change', () => { state.gradeId = input.value; redraw(); });
  }
  for (const input of document.querySelectorAll('input[name="size"]')) {
    input.addEventListener('change', () => { state.sizeKey = input.value; state.selected = 0; redraw(); });
  }
  const sampleRow = document.getElementById('sample-row');
  for (const sample of SAMPLES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = sample.label;
    button.addEventListener('click', async () => {
      const img = await loadImage(`samples/${sample.key}.jpg`);
      addPhoto(img, sample.label, true);
    });
    sampleRow.append(button);
  }
}

/** Pointer work on the canvas: click selects a panel, drag positions its photo, wheel zooms it. */
function wireCanvas() {
  const toCanvas = (event) => {
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left) * (canvas.width / box.width),
      y: (event.clientY - box.top) * (canvas.height / box.height),
    };
  };
  const panelAt = (point) => state.lastRects.findIndex(
    (rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h,
  );
  let drag = null;
  canvas.addEventListener('pointerdown', (event) => {
    const point = toCanvas(event);
    const index = panelAt(point);
    if (index < 0) return;
    state.selected = index;
    drag = { x: point.x, y: point.y };
    canvas.setPointerCapture(event.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = toCanvas(event);
    const rect = state.lastRects[state.selected];
    const slot = currentSlots()[state.selected];
    if (rect && slot && slot.photo >= 0) {
      const img = state.photos[slot.photo].img;
      const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * slot.zoom;
      const overflowX = img.naturalWidth * base - rect.w;
      const overflowY = img.naturalHeight * base - rect.h;
      if (overflowX > 0) slot.dx = clamp(slot.dx + (point.x - drag.x) * 2 / overflowX, -1, 1);
      if (overflowY > 0) slot.dy = clamp(slot.dy + (point.y - drag.y) * 2 / overflowY, -1, 1);
    }
    drag = point;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const slot = currentSlots()[state.selected];
    if (!slot) return;
    slot.zoom = clamp(slot.zoom * (event.deltaY < 0 ? 1.09 : 0.92), 1, 4);
    redraw();
  }, { passive: false });
}

async function start() {
  wireControls();
  wireCanvas();
  // The bundled display font first, so the lettering is right from the first paint it can manage.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 100px "Cover Sans"'), document.fonts.ready]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch { /* the fallback font still draws a cover */ }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), applyScene, exportDataURL);
    return;
  }
  // Open with a finished cover from the shipped samples: one click from here to an export.
  for (const key of ['harbor', 'cruiser', 'rooftop']) {
    const sample = SAMPLES.find((s) => s.key === key);
    const img = await loadImage(`samples/${key}.jpg`);
    state.photos.push({ img, label: sample.label });
  }
  renderTray();
  spreadPhotos();
  syncControls();
  redraw();
}

window.__coverApp = { applyScene, exportDataURL, redraw, state };
start();
