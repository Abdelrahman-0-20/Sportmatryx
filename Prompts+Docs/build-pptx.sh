#!/usr/bin/env bash
set -euo pipefail

DOC_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DOC_DIR"

if ! node -e "require.resolve('pptxgenjs')" 2>/dev/null; then
  echo "pptxgenjs not installed. Install it with: npm install --save-dev pptxgenjs" >&2
  exit 1
fi

node <<'NODE_SCRIPT'
const fs = require('fs');
const pptxgen = require('pptxgenjs');

const outline = JSON.parse(fs.readFileSync('pptx-outline.json', 'utf8'));
const pres = new pptxgen();
pres.author = outline.author;
pres.title = outline.title;

const TITLE_PALETTE = {
  canvas: '0A1220',
  panel: '101B2E',
  accent: '22D3EE',
  ink: 'E6EEF8',
  muted: '9FB4CF',
  prototype: '8B5CF6',
};

for (const slide of outline.slides) {
  const s = pres.addSlide();
  s.background = { color: TITLE_PALETTE.canvas };

  if (slide.level === 'title') {
    s.addText(slide.title, {
      x: 0.5, y: 2.2, w: 9, h: 1.4,
      fontSize: 44, fontFace: 'Barlow Condensed', bold: true,
      color: TITLE_PALETTE.ink,
      align: 'center',
    });
    s.addText(slide.body, {
      x: 0.8, y: 3.7, w: 8.4, h: 1.2,
      fontSize: 18, color: TITLE_PALETTE.accent,
      align: 'center',
    });
    continue;
  }

  if (slide.level === 'closing') {
    s.addText(slide.title, {
      x: 0.5, y: 1.6, w: 9, h: 1.2,
      fontSize: 36, fontFace: 'Barlow Condensed', bold: true,
      color: TITLE_PALETTE.accent,
      align: 'center',
    });
    s.addText(slide.body, {
      x: 0.8, y: 3.1, w: 8.4, h: 2,
      fontSize: 20, color: TITLE_PALETTE.ink,
      align: 'center',
    });
    continue;
  }

  s.addText(slide.title, {
    x: 0.5, y: 0.4, w: 9, h: 0.9,
    fontSize: 30, fontFace: 'Barlow Condensed', bold: true,
    color: TITLE_PALETTE.accent,
  });
  s.addShape(pres.shape.LINE, {
    x: 0.5, y: 1.25, w: 9, h: 0,
    line: { color: TITLE_PALETTE.accent, width: 2 },
  });

  if (Array.isArray(slide.body)) {
    const bulletItems = slide.body.map((item) => ({
      text: item,
      options: { breakLine: true, paraSpaceAfter: 8 },
    }));
    s.addText(bulletItems, {
      x: 0.7, y: 1.6, w: 8.6, h: 4.4,
      fontSize: 17, color: TITLE_PALETTE.ink,
      valign: 'top',
    });
  } else {
    s.addText(slide.body, {
      x: 0.7, y: 1.6, w: 8.6, h: 4.4,
      fontSize: 18, color: TITLE_PALETTE.ink,
      valign: 'top',
    });
  }
}

pres.writeFile({ fileName: 'sportmetryx-business-value.pptx' })
  .then(() => console.log('Written: sportmetryx-business-value.pptx'))
  .catch((err) => { console.error(err); process.exit(1); });
NODE_SCRIPT
