const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const fraunces64 = fs.readFileSync(path.join(FONT_DIR, 'fraunces.b64'), 'utf8').trim();

const COLORS = {
  cream: '#F6EEDC',
  ink: '#1E1A16',
  mustard: '#F2B33D',
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

// Primary logo: cream bg, ink F, mustard superscript 1. Composition kept
// well inside the circle YouTube crops to (r=400 at this 800 viewBox).
const F_SIZE = 480;
const F_X = 320;
const F_Y = 545;
const ONE_SIZE = 205;
const ONE_X = 548;
const ONE_Y = 300;

function mainMark({ bg, fg, accent, includeBg }) {
  return `${includeBg ? `<rect width="800" height="800" fill="${bg}"/>` : ''}
  <text x="${F_X}" y="${F_Y}" text-anchor="middle" font-size="${F_SIZE}" font-weight="900" font-variation-settings="'wght' 900, 'opsz' 144" fill="${fg}">F</text>
  <text x="${ONE_X}" y="${ONE_Y}" text-anchor="middle" font-size="${ONE_SIZE}" font-weight="800" font-variation-settings="'wght' 800, 'opsz' 72" fill="${accent}">1</text>`;
}

// logo.svg — primary lockup, opaque cream background (works as the channel icon)
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
${fontStyle()}
  ${mainMark({ bg: COLORS.cream, fg: COLORS.ink, accent: COLORS.mustard, includeBg: true })}
</svg>`;

// watermark.svg — transparent background, thin cream outline on the ink shapes
// so the mark stays legible over both light and dark video footage.
const watermarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
${fontStyle()}
  <g stroke="${COLORS.cream}" stroke-width="10" stroke-linejoin="round" paint-order="stroke">
    ${mainMark({ fg: COLORS.ink, accent: COLORS.mustard, includeBg: false })}
  </g>
</svg>`;

const outDir = path.join(__dirname, 'final');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'logo.svg'), logoSvg);
fs.writeFileSync(path.join(outDir, 'watermark.svg'), watermarkSvg);
console.log('wrote logo.svg, watermark.svg');
