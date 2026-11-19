// Fixed scenes for the maker's screenshots, driven by the query string:
//   ?shot=editor  the editor with photos loaded, its panels and controls showing
//   ?shot=cover   the cover alone, filling the window (the exported PNG itself is
//                 read from window.__coverApp.exportDataURL by the screenshot script)
// Scene parameters: photos (comma-separated sample keys, filled across the panels
// in order), title, sub, size (square|portrait|wide), layout, grade, intensity.
// window.__shotReady is set once the scene is painted, and
// window.__shotExport(size) returns an exported cover's data URL.
export async function runShot(shot, query, applyScene, exportDataURL) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photos = (query.get('photos') ?? 'harbor,cruiser,rooftop').split(',').map((key) => key.trim()).filter(Boolean);
  await applyScene({
    photos,
    title: query.get('title') ?? 'NEON HARBOR',
    subtitle: query.get('sub') ?? 'ONE LAST SCORE',
    size: query.get('size') ?? 'square',
    layout: query.get('layout') ?? 'vice-grid',
    grade: query.get('grade') ?? 'sunset',
    intensity: query.has('intensity') ? Number(query.get('intensity')) : 0.85,
  });
  window.__shotExport = (size) => exportDataURL(size);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
