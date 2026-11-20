// Takes Vice Poster's screenshots with the headless Chrome shell over the
// DevTools protocol: it serves app/ locally, opens the editor and the cover
// scenes, waits for window.__shotReady, and captures each page as a PNG.
// It also calls the app's own export function and checks the exported PNG
// really is 1080 x 1080, and it re-captures at a smaller scale when a shot
// would break the 256 KiB screenshot cap. Node 24 only, standard library.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repo, 'screenshots');
mkdirSync(outDir, { recursive: true });
const CHROME = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const PORT = 8091; // 8080 is taken by another bounty app's server on this VM
const DEBUG_PORT = 9223;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`server never came up at ${url}`);
}

/** A minimal CDP client over Node's built-in WebSocket. */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(msg.params.exceptionDetails?.exception?.description ?? JSON.stringify(msg.params.exceptionDetails));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (res.exceptionDetails) throw new Error(`evaluate failed: ${res.exceptionDetails.text}`);
    return res.result.value;
  }

  async waitForShotReady(timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.evaluate('window.__shotReady === true')) return;
      await sleep(200);
    }
    throw new Error('window.__shotReady never became true');
  }
}

function pngDimensions(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const SHOTS = [
  {
    name: '1-cover.png',
    url: `/?shot=cover&layout=grid&size=1920x1080&photo=sunset-strip&caption=VICE%20CITY&subtitle=WELCOME%20TO%20VICE&grade=sunset`,
    width: 1280, height: 720,
  },
  {
    name: '2-editor.png',
    url: `/?shot=editor&layout=grid&photo=sunset-strip&caption=VICE%20CITY&grade=sunset`,
    width: 1280, height: 1380,
  },
  {
    name: '3-cover-1080x1350.png',
    url: `/?shot=cover&layout=hero&size=1080x1350&photo=neon-boulevard&caption=NEON%20NIGHTS&subtitle=DOWNTOWN%20AFTER%20DARK&grade=neon`,
    width: 1024, height: 1280,
  },
  {
    name: '4-export.png',
    url: `/?shot=cover&layout=nine&size=1920x1080&photo=neon-boulevard&caption=NINE%20LIVES&subtitle=ONE%20CITY%20NINE%20STORIES&grade=dusk`,
    width: 1280, height: 720,
  },
];

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'pipe' });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const chrome = spawn(CHROME, [
    '--remote-debugging-port=9223',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=/tmp/chrome-vice-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/index.html`);
    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`, 60);
    const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target in chrome');
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Check the export path first, on the editor scene: the app's own export
    // function must produce a real 1080 x 1080 PNG.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?shot=editor&layout=grid&photo=sunset-strip&caption=VICE%20CITY&grade=sunset` });
    await cdp.waitForShotReady();
    const dataUrl = await cdp.evaluate('window.__exportCover(1080, 1080)', true);
    const exported = Buffer.from(dataUrl.split(',')[1], 'base64');
    const dims = pngDimensions(exported);
    console.log(`export check: ${exported.length} bytes, ${dims.w}x${dims.h}`);
    if (dims.w !== 1080 || dims.h !== 1080) throw new Error(`export is ${dims.w}x${dims.h}, not 1080x1080`);

    for (const shot of SHOTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${shot.url}` });
      await cdp.waitForShotReady();
      // Capture, shrinking the scale until the PNG fits the 256 KiB cap.
      let saved = null;
      for (const scale of [1, 0.85, 0.7]) {
        const shotRes = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          clip: { x: 0, y: 0, width: shot.width, height: shot.height, scale },
        });
        const buf = Buffer.from(shotRes.data, 'base64');
        const d = pngDimensions(buf);
        if (buf.length <= 262144 && d.h >= 480 && d.w >= 480) {
          writeFileSync(join(outDir, shot.name), buf);
          saved = { bytes: buf.length, w: d.w, h: d.h, scale };
          break;
        }
        console.log(`${shot.name}: ${buf.length} bytes at scale ${scale}, too big, retrying smaller`);
      }
      if (!saved) throw new Error(`${shot.name}: could not fit under 256 KiB`);
      console.log(`${shot.name}: ${saved.bytes} bytes, ${saved.w}x${saved.h} (scale ${saved.scale})`);
    }

    if (cdp.exceptions.length) console.log('page exceptions:', cdp.exceptions);
    if (cdp.consoleErrors.length) console.log('console errors:', cdp.consoleErrors);
    if (cdp.exceptions.length || cdp.consoleErrors.length) throw new Error('page reported errors');
    console.log('all shots done, no page errors');
  } finally {
    chrome.kill();
    server.kill();
    await sleep(500);
  }
}

main().catch((err) => {
  console.error('make-shots failed:', err.message);
  process.exit(1);
});
