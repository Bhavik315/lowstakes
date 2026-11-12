const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const fraunces64 = fs.readFileSync(path.join(FONT_DIR, 'fraunces.b64'), 'utf8').trim();

const COLORS = {
  cream: '#F6EEDC',
  ink: '#1E1A16',
  mustard: '#F2B33D',
  brick: '#C8452C',
};

function fontStyle() {
  return `
  <style>
    @font-face {
      font-family: 'Fraunces Brand';
      src: url(data:font/ttf;base64,${fraunces64}) format('truetype');
    }
    text { font-family: 'Fraunces Brand', serif; }
  </style>`;
}

// ---------- Concept A: Monogram F + superscript 1 ----------
function conceptA(mode) {
  const bg = mode === 'dark' ? COLORS.ink : COLORS.cream;
  const fg = mode === 'dark' ? COLORS.cream : COLORS.ink;
  const accent = COLORS.mustard;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
${fontStyle()}
  <rect width="800" height="800" fill="${bg}"/>
  <text x="330" y="560" text-anchor="middle" font-size="520" font-weight="900" font-variation-settings="'wght' 900, 'opsz' 144" fill="${fg}" font-style="normal">F</text>
  <text x="565" y="300" text-anchor="middle" font-size="230" font-weight="800" font-variation-settings="'wght' 800, 'opsz' 72" fill="${accent}">1</text>
</svg>`;
}

// ---------- Concept B: Seal with dagger mark ----------
function conceptB(mode) {
  const bg = mode === 'dark' ? COLORS.ink : COLORS.cream;
  const fg = mode === 'dark' ? COLORS.cream : COLORS.ink;
  const accent = COLORS.mustard;
  // Bold 6-point asterisk/footnote mark, built from 3 thick crossed bars, centered at (400,400)
  const bars = [0, 60, 120].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const dx = Math.cos(rad) * 150;
    const dy = Math.sin(rad) * 150;
    return `<line x1="${400 - dx}" y1="${400 - dy}" x2="${400 + dx}" y2="${400 + dy}" stroke-width="56"/>`;
  }).join('\n    ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="${bg}"/>
  <circle cx="400" cy="400" r="320" fill="none" stroke="${fg}" stroke-width="34"/>
  <circle cx="400" cy="400" r="252" fill="none" stroke="${fg}" stroke-width="10"/>
  <!-- asterisk footnote mark -->
  <g stroke="${fg}" stroke-linecap="round">
    ${bars}
  </g>
  <circle cx="400" cy="400" r="40" fill="${accent}"/>
</svg>`;
}

// ---------- Concept C: F1 in rounded square spine label ----------
function conceptC(mode) {
  const canvasBg = mode === 'dark' ? COLORS.ink : COLORS.cream;
  const chipBg = mode === 'dark' ? COLORS.cream : COLORS.ink;
  const chipFg = mode === 'dark' ? COLORS.ink : COLORS.cream;
  const accent = COLORS.mustard;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
${fontStyle()}
  <rect width="800" height="800" fill="${canvasBg}"/>
  <rect x="60" y="60" width="680" height="680" rx="128" fill="${chipBg}"/>
  <text x="330" y="545" text-anchor="middle" font-size="430" font-weight="900" font-variation-settings="'wght' 900, 'opsz' 144" fill="${chipFg}">F</text>
  <text x="555" y="330" text-anchor="middle" font-size="190" font-weight="800" font-variation-settings="'wght' 800, 'opsz' 72" fill="${accent}">1</text>
</svg>`;
}

const outDir = path.join(__dirname, '..', 'work', 'concepts');
fs.mkdirSync(outDir, { recursive: true });

const specs = [
  ['A_light', conceptA('light')],
  ['A_dark', conceptA('dark')],
  ['B_light', conceptB('light')],
  ['B_dark', conceptB('dark')],
  ['C_light', conceptC('light')],
  ['C_dark', conceptC('dark')],
];

for (const [name, svg] of specs) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), svg);
  console.log('wrote', name);
}
