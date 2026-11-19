// The gta6-cover-art-01 entry (Node 22, standard library only): the app is this directory's app/ folder, plain
// static files a desktop browser loads offline (app/index.html and its ES modules, no library and no network
// request), and the program hands it in. It copies app/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library. The app is Vice Poster:
// a person's own photos fill the panels of a GTA-style multi-panel poster (Vice Grid, Hero Strip or Nine Patch),
// each photo cropped and positioned inside its panel, graded Sunset / Neon / Dusk / Gold Hour, captioned in bold
// condensed lettering set from a bundled SIL OFL font, and exported as a PNG at 1080 x 1080, 1080 x 1350 or
// 1920 x 1080. The design is original — no Rockstar logo, artwork or font — and the sample photos under
// app/samples/ are free to use: three drawn scenes made for this entry and the kit's two image-model photos.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// Say what was handed in, so a local run shows the entry's shape at a glance:
// the screenshots and the dossier's own counts.
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
const shotNames = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).sort() : [];
console.log(
  `Vice Poster handed in: ${dossier.images.length} screenshots (${shotNames.join(', ')}), ` +
  `${dossier.text.length} dossier text bytes, written to ${out}.`,
);
