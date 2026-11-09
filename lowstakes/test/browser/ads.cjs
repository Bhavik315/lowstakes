// The (empty until configured) ad slots, and that table chat is still there.
// Needs Playwright and the site served at http://localhost:8080/lowstakes/ (python3 -m http.server 8080 from the repo root).
const { chromium } = require('playwright');
const BASE = 'http://localhost:8080/lowstakes/';
let pass = 0, fail = 0;
const t = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The site's real config now holds the Adsterra codes. Unless a test says otherwise, run with empty slots and the preview boxes on.
const HTML_RE = /key: '[0-9a-f]{32}'/g;
const emptyCfg = (route) => route.fetch().then(async (res) => { const body = (await res.text()).replace(HTML_RE, "key: ''").replace('adPreview: false', 'adPreview: true').replace('requireLogin: true', 'requireLogin: false'); await route.fulfill({ response: res, body }); });

async function openPractice(p) {
  await p.addInitScript(() => { try { localStorage.setItem('ls.age', '18'); } catch {} });
  await p.goto(BASE); await wait(700);
  const age = p.locator('[data-a="18"]'); if (await age.count()) await age.click();
  await wait(200);
}
async function toTable(p) {
  await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(500);
  await p.evaluate(() => { const c = window.lowstakes.client; c.addBot(); c.addBot(); c.addBot(); c.setGame('holdem'); }); await wait(1400);
}

(async () => {
  const b = await chromium.launch();
  const _nc = b.newContext.bind(b);
  b.newContext = async (o) => { const c = await _nc(o); await c.route('**/js/config.js*', emptyCfg); return c; };
  const errs = [];

  // ---- no ad code configured: nothing ad-related is visible or requested
  let ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  let p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const reqs = []; p.on('request', (r) => reqs.push(r.url()));
  await openPractice(p);
  t('home page: there is no "Practise against bots" button, just Start a table and Join', await p.locator('[data-mode=bots]').count() === 0 && !/practi[sc]e/i.test(await p.locator('body').innerText()) && await p.locator('[data-mode=host]').count() === 1 && await p.locator('[data-mode=join]').count() === 1);
  t('home page, preview on, no ad code: one highlighted placeholder, no real ad, no consent bar', await p.locator('.ad-ph:visible').count() === 1 && await p.locator('#ad-consent').count() === 0 && await p.locator('iframe').count() === 0);
  await toTable(p);
  t('table chat is there: a typing box and a Send button', await p.locator('#chat-input').count() === 1 && await p.locator('.chat-form button').count() === 1);
  t('quick reactions are plain words, no emoji', (await p.locator('.chat .reacts button').allInnerTexts()).every((x) => /^[A-Za-z!' ]+$/.test(x)) && await p.locator('.chat .reacts button').count() >= 5);
  t('the chat panel is visible on a wide screen', await p.locator('.chat').isVisible());
  t('the chat panel shows a highlighted placeholder (and no real ad) without ad code', await p.locator('.chat .ad-ph:visible').count() === 1 && await p.locator('.chat .ad-slot iframe').count() === 0);
  await p.fill('#chat-input', 'hello table'); await p.press('#chat-input', 'Enter'); await wait(400);
  t('a typed message shows up in the chat', /hello table/.test(await p.locator('#chat-list').innerText()));
  t('your own message sits inside the chat panel (not floating over the table)', await p.evaluate(() => { const li = document.querySelector('#chat-list li.own'); const c = document.querySelector('.chat'); if (!li || !c) return false; const a = li.getBoundingClientRect(), b = c.getBoundingClientRect(); return a.width > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && getComputedStyle(li).position !== 'absolute'; }));
    t('and a short bubble pops up over your seat at the poker table', await p.locator('#fx .bubble', { hasText: 'hello table' }).count() === 1);
  await ctx.close();

  // ---- the very first message at a brand-new table also gets a bubble
  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  await p.locator('button[data-mode=host]').click(); await p.waitForSelector('.lobby'); await wait(600);
  await p.fill('#chat-input', 'first!'); await p.press('#chat-input', 'Enter'); await wait(600);
  t('first message at a new table: it is in the chat box and shows a bubble', /first!/.test(await p.locator('#chat-list').innerText()) && await p.locator('#fx .bubble', { hasText: 'first!' }).count() === 1);
  await ctx.close();

  // ---- phones: portrait is blocked at the table, landscape works
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  t('phone portrait: the home page nudges you to turn the phone', await p.locator('.rotate-tip').isVisible());
  t('phone portrait: home page ad slot uses the small 320x50 size', /320×50/.test(await p.locator('.ad-slot[data-slot=landing]').innerText()));
  await toTable(p);
  t('phone portrait: the table is covered by "Turn your phone sideways"', await p.locator('.rotate-gate').isVisible() && /sideways/i.test(await p.locator('.rotate-gate').innerText()));
  const hit = await p.evaluate(() => { const e = document.elementFromPoint(195, 780); return !!(e && e.closest('.rotate-gate')); });
  t('phone portrait: nothing under it can be tapped', hit);
  await p.evaluate(() => { if (document.fullscreenElement) return document.exitFullscreen(); }); await wait(300);
  await p.setViewportSize({ width: 844, height: 390 }); await wait(500);
  t('phone landscape: the cover goes away and the table is playable', await p.locator('.rotate-gate').isHidden() && await p.locator('#dock').isVisible());
  t('phone landscape: the chat panel opens from the Chat button', await (async () => { await p.locator('[data-act=chat].tool').dispatchEvent('click'); await wait(400); return p.locator('#chat-input').isVisible(); })());
  t('phone landscape: the chat panel gets the small 320x50 ad slot', /320×50/.test(await p.locator('.chat .ad-slot').innerText()));
  await ctx.close();

  // ---- ad sizes follow the screen
  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  const lt = async (slot) => (await p.locator(`.ad-slot[data-slot=${slot}]`).innerText()).replace(/\s+/g, ' ');
  t('laptop: home page gets the 728x90 banner', /728×90/.test(await lt('landing')));
  await p.setViewportSize({ width: 900, height: 700 }); await wait(700);
  t('smaller window: it swaps to 728x90', /728×90/.test(await lt('landing')));
  await p.setViewportSize({ width: 360, height: 640 }); await wait(700);
  t('phone-sized window: it swaps to 320x50', /320×50/.test(await lt('landing')));
  await p.setViewportSize({ width: 1366, height: 800 }); await wait(700);
  await toTable(p);
  t('laptop table: side ad is 300x250', /300×250/.test(await p.locator('.chat .ad-slot').innerText()));
  await p.setViewportSize({ width: 1366, height: 640 }); await wait(700);
  t('short laptop window: the side ad drops to the slim 320x50 so the chat keeps its room', /320×50/.test(await p.locator('.chat .ad-slot').innerText()));
  await ctx.close();

  // ---- with ad code set (config swapped in by the test)
  const withAds = (route) => route.fetch().then(async (res) => {
    const body = (await res.text()).replace('requireLogin: true', 'requireLogin: false');
    await route.fulfill({ response: res, body });
  });
  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.route('**/js/config.js*', withAds);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  t('ads configured: there is no "allow ads" question, and the ad frame loads straight away', await p.locator('#ad-consent').count() === 0 && await p.locator('.ad-slot iframe').count() >= 1);
  await ctx.close();

  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.route('**/js/config.js*', withAds);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await openPractice(p);
  await wait(600);
  const frame = p.locator('.ad-slot[data-slot=landing] iframe');
  t('the real banner is the laptop size (728 wide)', (await p.locator('.ad-slot[data-slot=landing] iframe').getAttribute('width')) === '728');
  const src = await frame.getAttribute('src');
  t('the home page ad is a frame loaded from the game server (a different address from the site), not code running on the site', await frame.count() === 1 && /^https:\/\/lowstakes-server\.[^/]+\/ad\?k=13f9a0a286e616b330d213ba508671bc$/.test(src) && new URL(src).origin !== new URL(BASE).origin && await p.locator('.ad-slot script').count() === 0);
  t('the frame cannot navigate the page away without a tap', /allow-top-navigation-by-user-activation/.test(await frame.getAttribute('sandbox')) && !/allow-top-navigation(?!-by)/.test(await frame.getAttribute('sandbox')));
  await toTable(p);
  t('wide table: the ad slot in the chat panel is filled and visible', await p.locator('.chat .ad-slot iframe').count() === 1 && await p.locator('.chat .ad-slot').isVisible());
  const box = await p.locator('.chat .ad-slot iframe').boundingBox();
  const stage = await p.locator('#stage').boundingBox();
  t('the ad sits beside the stage, not over it', box && stage && box.x >= stage.x + stage.width - 2);
  await ctx.close();

  console.log(`\npage errors: ${errs.length}`, errs.slice(0, 3).join(' | '));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
