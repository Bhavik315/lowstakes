// The (empty until configured) ad slots, and that table chat is still there.
// Needs Playwright and the site served at http://localhost:8080/lowstakes/ (python3 -m http.server 8080 from the repo root).
const { chromium } = require('playwright');
const BASE = 'http://localhost:8080/lowstakes/';
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPractice(p) {
  await p.addInitScript(() => { try { localStorage.setItem('ls.age', '18'); } catch {} });
  await p.goto(BASE); await wait(700);
  const age = p.locator('[data-a="18"]'); if (await age.count()) await age.click();
  await wait(200);
}
async function toTable(p) {
  await p.click('button[data-mode=bots]'); await wait(1400);
}

(async () => {
  const b = await chromium.launch();
  const errs = [];

  // ---- no ad code configured: nothing ad-related is visible or requested
  let ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const reqs = []; p.on('request', (r) => reqs.push(r.url()));
  await openPractice(p);
  t('home page: no ad slot showing, no consent bar when no ad code is set', await p.locator('.ad-slot:visible').count() === 0 && await p.locator('#ad-consent').count() === 0 && await p.locator('iframe').count() === 0);
  await toTable(p);
  t('table chat is there: a typing box and a Send button', await p.locator('#chat-input').count() === 1 && await p.locator('.chat-form button').count() === 1);
  t('quick reactions are plain words, no emoji', (await p.locator('.chat .reacts button').allInnerTexts()).every((x) => /^[A-Za-z!' ]+$/.test(x)) && await p.locator('.chat .reacts button').count() >= 5);
  t('the chat panel is visible on a wide screen', await p.locator('.chat').isVisible());
  t('the ad slot in the chat panel stays hidden without ad code', await p.locator('.chat .ad-slot:visible').count() === 0);
  await p.fill('#chat-input', 'hello table'); await p.press('#chat-input', 'Enter'); await wait(400);
  t('a typed message shows up in the chat', /hello table/.test(await p.locator('#chat-list').innerText()));
  await ctx.close();

  // ---- phone: the chat panel slides in from the Chat button
  ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p); await toTable(p);
  t('phone: chat starts closed', !(await p.evaluate(() => document.getElementById('room').classList.contains('chat-open'))));
  await p.locator('[data-act=chat].tool').dispatchEvent('click'); await wait(400);
  t('phone: the Chat button opens it', await p.evaluate(() => document.getElementById('room').classList.contains('chat-open')) && await p.locator('#chat-input').isVisible());
  await ctx.close();

  // ---- with ad code set (config swapped in by the test)
  const withAds = (route) => route.fetch().then(async (res) => {
    let body = await res.text();
    body = body.replace(/html: ''/g, "html: '<div id=\"adtest\">TEST-AD</div>'");
    await route.fulfill({ response: res, body });
  });
  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.route('**/js/config.js*', withAds);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  t('ads configured: the one-time question appears and no ad is loaded yet', await p.locator('#ad-consent').count() === 1 && await p.locator('.ad-slot iframe').count() === 0);
  await p.click('#ad-consent [data-ad=no]'); await wait(300);
  t('"No thanks": the question goes away and still no ad', await p.locator('#ad-consent').count() === 0 && await p.locator('.ad-slot iframe').count() === 0);
  await p.reload(); await wait(700);
  t('...and it is remembered', await p.locator('#ad-consent').count() === 0 && await p.locator('.ad-slot iframe').count() === 0);
  await ctx.close();

  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.route('**/js/config.js*', withAds);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  await p.click('#ad-consent [data-ad=yes]'); await wait(600);
  const frame = p.locator('.ad-slot[data-slot=landing] iframe');
  t('"Allow ads": the home page slot fills with a sandboxed frame', await frame.count() === 1 && /allow-scripts/.test(await frame.getAttribute('sandbox')) && !/allow-same-origin/.test(await frame.getAttribute('sandbox')));
  t('the ad code runs inside the frame, not in the page', await p.frameLocator('.ad-slot[data-slot=landing] iframe').locator('#adtest').count() === 1 && await p.locator('#adtest').count() === 0);
  await toTable(p);
  t('wide table: the ad slot in the chat panel is filled and visible', await p.locator('.chat .ad-slot iframe').count() === 1 && await p.locator('.chat .ad-slot').isVisible());
  const box = await p.locator('.chat .ad-slot iframe').boundingBox();
  const stage = await p.locator('#stage').boundingBox();
  t('the ad sits beside the stage, not over it', box && stage && box.x >= stage.x + stage.width - 2);
  await p.setViewportSize({ width: 390, height: 844 }); await wait(500);
  t('phone-width table: the ad is not shown', await p.locator('.chat .ad-slot').isHidden());
  await ctx.close();

  console.log(`\npage errors: ${errs.length}`, errs.slice(0, 3).join(' | '));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
