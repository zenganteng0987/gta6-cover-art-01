// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover shows the cover alone, at the export size the
// query asks for. `photo` picks the sample (samples/<photo>.png), `caption`,
// `subtitle`, `layout`, `grade` and `size` (like 1920x1080) set the scene.
// window.__shotReady is set once the cover is painted.
export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const size = (query.get('size') ?? '1080x1080').split('x').map(Number);
  api.setExportSize(size[0] || 1080, size[1] || 1080);
  api.setLayout(query.get('layout') ?? 'grid');
  api.setGrade(query.get('grade') ?? 'sunset');
  api.setCaption(query.get('caption') ?? 'Vice City');
  api.setSubtitle(query.get('subtitle') ?? 'Welcome to Vice');
  await api.loadSample(query.get('photo') ?? 'sunset-strip');
  api.redraw();
  await document.fonts.ready;
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
