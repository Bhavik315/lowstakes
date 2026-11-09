// Layout regressions found in the site audit. Needs Playwright and the site served at http://localhost:8080/lowstakes/.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8080/lowstakes/';
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
async function open(b, size, touch = false) {
  const ctx = await b.newContext({ viewport: size, hasTouch: touch, isMobile: touch && size.width < 700 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ls.age', '18'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE); await wait(700);
  return { ctx, p };
}
const practice = async (p, game) => { await p.locator('button[data-mode=bots]').dispatchEvent('click'); await wait(1200); if (game) { await p.evaluate((g) => window.lowstakes.client.setGame(g), game); await wait(1200); } };
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const overlap = (a, b) => a && b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;

(async () => {
  const b = await chromium.launch();

  // header stays on one line at tablet / small-laptop widths
  for (const w of [1024, 768]) {
    const { ctx, p } = await open(b, { width: w, height: 800 }, w < 800);
    await practice(p);
    const pill = await rect(p, '.code-pill');
    t(`${w}px: the table code pill is one line high, not a wrapped two-line blob`, pill && pill.h <= 48, JSON.stringify(pill));
    t(`${w}px: nothing in the header overflows it`, await p.evaluate(() => { const h = document.getElementById('r-top'); return h.scrollWidth <= h.clientWidth + 1; }));
    await ctx.close();
  }

  // the Table menu lists players with round avatars
  {
    const { ctx, p } = await open(b, { width: 1366, height: 800 });
    await practice(p);
    await p.locator('[data-act=menu]').dispatchEvent('click'); await wait(300);
    const av = await rect(p, '.menu-players .avatar');
    t('Table menu: player avatars are round (not stretched into bars)', av && Math.abs(av.w - av.h) < 2 && av.w <= 36, JSON.stringify(av));
    await ctx.close();
  }

  // crash on a tablet: the bet label is not covered by the chips
  {
    const { ctx, p } = await open(b, { width: 768, height: 1024 }, true);
    await practice(p, 'crash');
    const hand = await rect(p, '.dock-hand'); const tray = await rect(p, '.tray');
    t('crash dock on a tablet: the "Your bet" label and the chips do not overlap', hand && tray && !overlap(hand, tray), JSON.stringify({ hand, tray }));
    t('crash dock on a tablet: no squeezed side note', await p.locator('.dock-tip').count() === 0 || !(await p.locator('.dock-tip').first().isVisible()));
    await ctx.close();
  }

  // crash on a landscape phone: the chart does not spill over the player list
  {
    const { ctx, p } = await open(b, { width: 844, height: 390 }, true);
    await practice(p, 'crash');
    const g = await rect(p, '.cr-graph'); const r = await rect(p, '.cr-roster');
    t('crash on a landscape phone: the chart ends above the player list', g && r && g.b <= r.t + 1, JSON.stringify({ g, r }));
    t('crash on a landscape phone: the "Place your bets" line is inside the chart', await p.evaluate(() => { const s = document.getElementById('cr-sub'); const g = document.getElementById('cr-graph'); if (!s || !g) return false; const a = s.getBoundingClientRect(), b = g.getBoundingClientRect(); return a.bottom <= b.bottom + 1; }));
    // the menu fits on a short screen (Leave table reachable without scrolling)
    await p.locator('[data-act=more]').dispatchEvent('click'); await wait(300);
    t('landscape phone: the whole menu fits above the bottom edge', await p.evaluate(() => { const pop = document.querySelector('#pop .pop'); return pop && pop.scrollHeight <= pop.clientHeight + 1; }));
    await ctx.close();
  }

  // sign-in card has no blank gap
  {
    const { ctx, p } = await open(b, { width: 390, height: 844 });
    await p.locator('[data-acct=signin]').first().click(); await wait(400);
    const a = await rect(p, '.acct-card .asub'); const g = await rect(p, '.acct-card .btn-google');
    t('sign-in card: no big empty gap between the text and the Google button', a && g && g.t - a.b < 36, JSON.stringify({ a, g }));
    await ctx.close();
  }

  // Back then Forward to a table you closed does not show you an invite to your own dead table
  {
    const { ctx, p } = await open(b, { width: 1280, height: 800 });
    await practice(p);
    await p.goBack(); await wait(700);
    await p.goForward(); await wait(1500);
    t('Back then Forward to a table you closed: home page with "That table has closed."', (await p.evaluate(() => location.hash)) === '#/' && /That table has closed/.test(await p.locator('body').innerText()));
    await ctx.close();
  }

  console.log(`\npage errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
