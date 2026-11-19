// Takes the entry's screenshots from shots.json: serves app/ on localhost,
// opens each scene in the local Playwright headless shell, waits for
// window.__shotReady, and saves the app's own exported PNG for cover shots
// (via window.__shotExport) or a viewport JPEG for the editor shot. Cover
// PNGs land as screenshots/<name>.png and are turned into JPEGs by
// scripts/jpgify.py afterwards. Run from the repo root:
//   node scripts/shoot.cjs
// Serves on port 8123; fails loudly on any console error or failed request.
const { spawn } = require('node:child_process');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/shots/node_modules/playwright');

const ROOT = join(__dirname, '..');
const SHOTS = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('local server did not come up');
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', join(ROOT, 'app')], {
    stdio: 'ignore',
  });
  try {
    await waitForServer();
    const browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
    try {
      for (const shot of SHOTS) {
        const query = new URLSearchParams(shot.query);
        const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
        const problems = [];
        page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
        page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
        page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()}`));
        await page.goto(BASE + shot.query, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
        const fontOk = await page.evaluate(() => document.fonts.check('700 100px "Cover Sans"'));
        if (!fontOk) problems.push('Cover Sans did not load');
        if (query.get('shot') === 'cover') {
          const size = query.get('size') || 'square';
          const dataUrl = await page.evaluate((s) => window.__shotExport(s), size);
          const png = Buffer.from(dataUrl.split(',')[1], 'base64');
          const pngPath = join(ROOT, 'screenshots', shot.name.replace(/\.jpg$/, '.png'));
          writeFileSync(pngPath, png);
          console.log(`cover ${shot.name}: exported ${size} PNG ${png.length} bytes`);
        } else {
          await page.screenshot({ type: 'jpeg', quality: 88, path: join(ROOT, 'screenshots', shot.name) });
          console.log(`editor ${shot.name}: viewport ${shot.w}x${shot.h}`);
        }
        if (problems.length > 0) {
          console.error(`PROBLEMS ${shot.name}:`, problems.join(' | '));
          process.exitCode = 1;
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
  console.log('done');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
