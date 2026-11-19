// Smoke test for the plain editor (no ?shot=): serves app/ on localhost,
// loads the page, and reports every request URL plus any console/page error,
// so an offline violation or a runtime error shows up here. Run from the
// repo root: node scripts/smoke.cjs
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/shots/node_modules/playwright');

const ROOT = join(__dirname, '..');
const PORT = 8124;
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', join(ROOT, 'app')], {
    stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 50; i += 1) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch { /* not up */ }
      await sleep(200);
    }
    const browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const urls = [];
      const problems = [];
      page.on('request', (req) => urls.push(req.url()));
      page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()}`));
      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
      await sleep(3000);
      const state = await page.evaluate(() => ({
        photos: window.__coverApp.state.photos.length,
        canvas: [window.__coverApp.state.lastRects.length],
        font: document.fonts.check('700 100px "Cover Sans"'),
      }));
      console.log('requests:', JSON.stringify(urls, null, 1));
      console.log('state:', JSON.stringify(state));
      console.log('problems:', problems.length ? problems.join(' | ') : 'none');
      if (problems.length) process.exitCode = 1;
      const external = urls.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}`) && !u.startsWith('blob:'));
      if (external.length) { console.error('EXTERNAL REQUESTS:', external); process.exitCode = 1; }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
  console.log('smoke done');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
