// Wires the Vice Poster editor: photos in, layout and grade picked, caption
// typed, panels dragged and zoomed on the preview, and the cover exported as
// a PNG in one of the three post sizes. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js).
import { renderCover, layoutFor, freshPanels, LAYOUT_NAMES } from './render.js';
import { GRADES, GRADE_NAMES } from './grades.js';
import { runShot } from './shots.js';

const preview = document.getElementById('preview');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const starInput = document.getElementById('star');
const strengthInput = document.getElementById('strength');
const strengthValue = document.getElementById('strength-value');
const zoomInput = document.getElementById('panel-zoom');
const zoomValue = document.getElementById('zoom-value');
const offsetXInput = document.getElementById('panel-x');
const offsetYInput = document.getElementById('panel-y');
const panelLabel = document.getElementById('panel-label');
const status = document.getElementById('status');
const layoutButtons = document.getElementById('layout-buttons');
const gradeButtons = document.getElementById('grade-buttons');
const sizeButtons = document.getElementById('size-buttons');
const photoButtons = document.getElementById('photo-buttons');

/** The whole cover state; `photos` holds loaded images, `panels` one entry
 *  per panel slot (the layout decides how many are used). */
const state = {
  layout: 'grid',
  grade: 'sunset',
  strength: 0.7,
  caption: 'Vice City',
  subtitle: 'Welcome to Vice',
  star: 'Five Star',
  size: { w: 1080, h: 1080 },
  photos: [],
  panels: freshPanels(),
};

/** Which panel slot the drag, zoom and photo buttons act on. */
let selectedPanel = 0;

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function redraw() {
  preview.width = state.size.w;
  preview.height = state.size.h;
  renderCover(preview, state);
}

/** Puts `img` into the selected panel and repaints. */
function placePhoto(img) {
  state.photos.push(img);
  const index = state.photos.length - 1;
  state.panels[selectedPanel].photo = index;
  state.panels[selectedPanel].zoom = 1;
  state.panels[selectedPanel].ox = 0;
  state.panels[selectedPanel].oy = 0;
  redraw();
}

/** When one photo fills every panel, each panel shows a different crop of
 *  it: a slight zoom plus a small offset per slot, so the poster reads as
 *  nine different shots instead of the same frame nine times. */
const PANEL_SPREAD = [
  [0, 0], [0.12, -0.08], [-0.12, 0.08], [0.1, 0.1], [-0.1, -0.1],
  [0.08, -0.12], [-0.08, 0.12], [0.14, 0.05], [-0.14, -0.05],
];

/** Points every panel at photo `index`, with the spread above. */
function spreadPanelsAcrossPhoto(index) {
  for (let i = 0; i < state.panels.length; i++) {
    state.panels[i].photo = index;
    state.panels[i].zoom = 1.15;
    state.panels[i].ox = PANEL_SPREAD[i][0];
    state.panels[i].oy = PANEL_SPREAD[i][1];
  }
}

/** Loads a bundled sample photo and puts it in the selected panel. */
async function loadSample(name) {
  const img = await loadImage(`samples/${name}.png`);
  placePhoto(img);
  return img;
}

/** Loads a sample into every panel slot, each showing its own crop. */
async function fillAllPanels(name) {
  const img = await loadImage(`samples/${name}.png`);
  state.photos.push(img);
  spreadPanelsAcrossPhoto(state.photos.length - 1);
  redraw();
}

/** Renders the cover at `w` x `h` on a fresh canvas and resolves to a PNG
 *  data URL of it. The screenshot tool calls this to check the export. */
export function exportCoverDataURL(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off, { ...state, size: { w, h } });
  return off.toDataURL('image/png');
}

/** Renders the cover at `w` x `h` and downloads it as a PNG file. */
export function downloadCover(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off, { ...state, size: { w, h } });
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-poster-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved vice-poster-${w}x${h}.png`;
  }, 'image/png');
}

/** Builds the segmented buttons for layouts, grades and export sizes. */
function buildButtons() {
  for (const name of LAYOUT_NAMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layoutFor(name).label;
    b.dataset.layout = name;
    b.addEventListener('click', () => {
      state.layout = name;
      selectedPanel = 0;
      syncButtons();
      redraw();
    });
    layoutButtons.appendChild(b);
  }
  for (const name of GRADE_NAMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = GRADES[name].label;
    b.dataset.grade = name;
    b.addEventListener('click', () => {
      state.grade = name;
      syncButtons();
      redraw();
    });
    gradeButtons.appendChild(b);
  }
  for (const [w, h] of [[1080, 1080], [1080, 1350], [1920, 1080]]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${w} x ${h}`;
    b.dataset.size = `${w}x${h}`;
    b.addEventListener('click', () => downloadCover(w, h));
    sizeButtons.appendChild(b);
  }
  for (const [name, label] of [['sunset-strip', 'Sunset Strip'], ['neon-boulevard', 'Neon Boulevard']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', async () => {
      try {
        await fillAllPanels(name);
        status.textContent = `${label} loaded into every panel.`;
      } catch {
        status.textContent = `Could not load ${label}.`;
      }
    });
    photoButtons.appendChild(b);
  }
}

/** Marks the active layout, grade and panel buttons. */
function syncButtons() {
  for (const b of layoutButtons.children) b.classList.toggle('active', b.dataset.layout === state.layout);
  for (const b of gradeButtons.children) b.classList.toggle('active', b.dataset.grade === state.grade);
  const count = layoutFor(state.layout).panels;
  panelLabel.textContent = `Panel ${selectedPanel + 1} of ${count} — drag to move, scroll to zoom.`;
}

/** Finds which panel slot a point on the preview (in canvas pixels) falls in. */
function panelAt(px, py) {
  const layout = layoutFor(state.layout);
  for (let i = 0; i < layout.panels; i++) {
    const [ux, uy, uw, uh] = layout.rects[i];
    if (px >= ux * preview.width && px < (ux + uw) * preview.width
      && py >= uy * preview.height && py < (uy + uh) * preview.height) {
      return i;
    }
  }
  return 0;
}

/** Dragging on the preview moves the selected panel's photo; the wheel zooms it. */
function wirePanelPointer() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  preview.addEventListener('pointerdown', (e) => {
    const rect = preview.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * preview.width;
    const py = ((e.clientY - rect.top) / rect.height) * preview.height;
    selectedPanel = panelAt(px, py);
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    preview.setPointerCapture(e.pointerId);
    syncButtons();
    syncPanelSliders();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = preview.getBoundingClientRect();
    const panel = state.panels[selectedPanel];
    panel.ox += ((e.clientX - lastX) / rect.width) * (preview.width / (layoutFor(state.layout).rects[selectedPanel][2] * preview.width));
    panel.oy += ((e.clientY - lastY) / rect.height) * (preview.height / (layoutFor(state.layout).rects[selectedPanel][3] * preview.height));
    panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
    panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
    lastX = e.clientX;
    lastY = e.clientY;
    redraw();
    syncPanelSliders();
  });
  preview.addEventListener('pointerup', () => { dragging = false; });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[selectedPanel];
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
    redraw();
    syncPanelSliders();
  }, { passive: false });
}

/** Keeps the zoom and offset sliders in step with the selected panel. */
function syncPanelSliders() {
  const panel = state.panels[selectedPanel];
  zoomInput.value = String(panel.zoom);
  zoomValue.textContent = `${panel.zoom.toFixed(2)}x`;
  offsetXInput.value = String(Math.round(panel.ox * 100));
  offsetYInput.value = String(Math.round(panel.oy * 100));
}

function wireInputs() {
  captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
  subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
  starInput.addEventListener('input', () => { state.star = starInput.value; redraw(); });
  strengthInput.addEventListener('input', () => {
    state.strength = Number(strengthInput.value) / 100;
    strengthValue.textContent = `${strengthInput.value}%`;
    redraw();
  });
  zoomInput.addEventListener('input', () => {
    state.panels[selectedPanel].zoom = Number(zoomInput.value) / 100;
    zoomValue.textContent = `${(Number(zoomInput.value) / 100).toFixed(2)}x`;
    redraw();
  });
  offsetXInput.addEventListener('input', () => {
    state.panels[selectedPanel].ox = Number(offsetXInput.value) / 100;
    redraw();
  });
  offsetYInput.addEventListener('input', () => {
    state.panels[selectedPanel].oy = Number(offsetYInput.value) / 100;
    redraw();
  });
  document.getElementById('photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      placePhoto(img);
      status.textContent = `Loaded ${file.name} into panel ${selectedPanel + 1}.`;
    } catch {
      status.textContent = 'That file could not be read as a photo.';
    }
  });
  document.getElementById('fill-all').addEventListener('click', () => {
    spreadPanelsAcrossPhoto(state.panels[selectedPanel].photo);
    redraw();
    status.textContent = 'One photo now fills every panel.';
  });
}

/** The shot scenes drive the editor through this small API. */
const shotApi = {
  setExportSize(w, h) { state.size = { w, h }; },
  setLayout(name) { state.layout = name; selectedPanel = 0; },
  setGrade(name) { state.grade = name; },
  setCaption(text) { state.caption = text; captionInput.value = text; },
  setSubtitle(text) { state.subtitle = text; subtitleInput.value = text; },
  async loadSample(name) { await fillAllPanels(name); },
  redraw() { redraw(); },
};

buildButtons();
wireInputs();
wirePanelPointer();
syncButtons();
syncPanelSliders();
document.fonts.ready.then(redraw);

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), shotApi).catch((err) => {
    status.textContent = `Shot failed: ${err.message}`;
  });
} else {
  // The editor opens with a sample photo already loaded, so the first thing
  // a person sees is a finished-looking poster, not an empty frame.
  loadSample('sunset-strip').catch(() => redraw());
  redraw();
}

// For the screenshot tool: export any size as a PNG data URL, and report
// whether the page hit an error while loading.
window.__exportCover = (w, h) => exportCoverDataURL(w, h);
window.__vicePosterReady = true;
