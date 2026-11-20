# gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/zenganteng0987/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/zenganteng0987/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Poster is an offline web app that turns a photo and a caption into a multi-panel poster in the style of GTA 6 cover art. Load your own photo (or one of the two bundled samples), pick one of three layouts — Vice Grid with five panels, Hero Strip with four, or Nine Patch with nine — drag and zoom each panel's photo, choose one of four colour grades (Sunset, Neon, Dusk, Gold Hour) with a strength slider, write the caption, ribbon subtitle and star badge, and export the cover as a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080. Everything runs in the browser from the files in `app/` — no build step, no network request, and your photos never leave your machine. The caption lettering uses Liberation Sans, bundled under `app/fonts/` under the SIL Open Font License. The design is original: no Rockstar Games logo, artwork or font.

## Run it

Serve the app and open it in a browser:

```
node serve.ts
```

Then open http://localhost:8080.

Hand the entry in (writes `dossier.json` beside the app and the screenshots):

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

<sub>Entered on [make.fun](https://make.fun/?ref=7z4nfrpv&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
