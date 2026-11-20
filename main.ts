// Vice Poster, the gta6-cover-art-01 entry program (Node 22+, standard
// library only). It hands the entry in: it copies this repository's app/
// (the offline cover maker) and screenshots/ (its four screenshots) into the
// output directory, then writes output/dossier.json with buildDossier from
// the vendored make.fun library, which is the summary the judge reads.
//
// The grader runs this program twice in a fresh container with a read-only
// copy of the repository and a writable /output; outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Both halves of the entry must be present before anything is copied.
for (const needed of ['app', 'screenshots']) {
  if (!existsSync(join(repoRoot, needed))) {
    throw new Error(`cannot hand in the entry: ${needed}/ is missing from the repository`);
  }
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the other limits refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in app/
// or 48 MiB of app files in all, or a path under app/ over 1000 bytes: app/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(`wrote ${dossierPath} (${statSync(dossierPath).size} bytes)`);

// A handed-in entry is only useful if the dossier really landed: refuse to
// report success when it is missing or empty, so a silent write failure can
// never pass as a finished build.
const dossierSize = statSync(dossierPath).size;
if (dossierSize === 0) {
  throw new Error(`dossier written but empty: ${dossierPath}`);
}
console.log(`entry handed in: app/ + screenshots/ + dossier.json (${dossierSize} bytes)`);
