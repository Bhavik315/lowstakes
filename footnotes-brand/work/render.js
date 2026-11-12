// Generic HTML -> PNG/JPEG renderer used for all brand-kit assets.
// Usage: node render.js <html_file> <out_file> <width> <height> [--jpg] [--transparent]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [htmlFile, outFile, widthStr, heightStr, ...flags] = process.argv.slice(2);
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);
  const jpg = flags.includes('--jpg');
  const transparent = flags.includes('--transparent');

  const browser = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto('file://' + path.resolve(htmlFile));
  await page.waitForTimeout(150);
  const options = { path: outFile };
  if (jpg) {
    options.type = 'jpeg';
    options.quality = 92;
  } else {
    options.type = 'png';
    if (transparent) options.omitBackground = true;
  }
  await page.screenshot(options);
  await browser.close();
  console.log('wrote', outFile);
})();
