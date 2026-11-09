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
// A browser table with three bots at it, playing `game` (poker unless told otherwise). The bots are added by the test; the site has no "play against bots" button for now.
const practice = async (p, game) => { await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(400); await p.evaluate((g) => { const c = window.lowstakes.client; c.addBot(); c.addBot(); c.addBot(); c.setGame(g); }, game || 'holdem'); await wait(1400); };
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

  // small landscape phone: the action buttons share one slim row and your cards stay in view
  {
    const { ctx, p } = await open(b, { width: 667, height: 375 }, true);
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await practice(p);
    let mine = false;
    for (let i = 0; i < 80 && !mine; i++) { mine = await p.evaluate(() => { const g = window.lowstakes.state && window.lowstakes.state.game; return !!(g && g.you && g.you.myTurn); }); if (!mine) await wait(500); }
    await wait(500);
    const dock = await rect(p, '#dock');
    t('poker on a small landscape phone: your turn dock is one slim row', mine && dock && dock.h <= 80, JSON.stringify(dock));
    const cards = await rect(p, '.seat.me .seat-cards');
    t('poker on a small landscape phone: your hole cards are above the dock, not hidden behind it', cards && dock && cards.t < dock.t - 20, JSON.stringify({ cards, dock }));
    await p.evaluate(() => window.lowstakes.client.setGame('blackjack')); await wait(800);
    await p.evaluate(() => { window.lowstakes.client.act({ type: 'add', amount: 25 }); window.lowstakes.client.act({ type: 'ready' }); });
    mine = false;
    for (let i = 0; i < 80 && !mine; i++) { mine = await p.evaluate(() => { const g = window.lowstakes.state && window.lowstakes.state.game; return !!(g && g.phase === 'playing' && g.you && g.you.myTurn); }); if (!mine) await wait(400); }
    await wait(600);
    const hdr = await rect(p, '#r-top'); const dock2 = await rect(p, '#dock');
    const hand = await p.evaluate(() => { const e = document.querySelector('.tbl.blackjack [data-seat]:has(.hands) .hands, .spot.me .hands, .spot .hands'); const mineSeat = [...document.querySelectorAll('[data-seat]')].find((x) => x.querySelector('.hands .hand')); if (!mineSeat) return null; const r = mineSeat.querySelector('.hands').getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
    if (!mine) console.log('(blackjack deal had no player turn this time, e.g. a natural: layout checks skipped)');
    else {
    t('blackjack on a small landscape phone: the action buttons are one slim row', mine && dock2 && dock2.h <= 80, JSON.stringify(dock2));
    t('blackjack on a small landscape phone: your hand is not cut off under the header', hand && hdr && hand.t >= hdr.b - 2, JSON.stringify({ hand, hdr }));
    }
    await ctx.close();
  }

  // phone upright: home page, sign-in sheet and lobby are laid out for a thumb; a live game asks for landscape
  {
    const { ctx, p } = await open(b, { width: 390, height: 844 }, true);
    const top = await rect(p, '.l-top'); const btn = await rect(p, '.l-top .acct-slot .btn');
    t('phone upright: Sign in sits on the same slim row as the logo (not a full-width bar)', top && btn && top.h < 70 && btn.w < 260, JSON.stringify({ top, btn }));
    t('phone upright: the home page does not scroll sideways', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    const start = await rect(p, '[data-mode=host]');
    t('phone upright: "Start a table" is a big full-width button visible without scrolling', start && start.w > 300 && start.h >= 48 && start.b < 844, JSON.stringify(start));
    const cards = await p.evaluate(() => [...document.querySelectorAll('.placard')].map((e) => Math.round(e.getBoundingClientRect().top)));
    t('phone upright: the four games sit two across', cards.length === 4 && cards[0] === cards[1] && cards[2] === cards[3] && cards[2] > cards[0], JSON.stringify(cards));
    await p.locator('[data-acct=signin]').first().click(); await wait(500);
    const sheet = await rect(p, '.acct-card');
    t('phone upright: sign-in is a sheet that slides up from the bottom, full width', sheet && sheet.l <= 1 && sheet.r >= 389 && sheet.b >= 843, JSON.stringify(sheet));
    await p.keyboard.press('Escape'); await p.locator('[data-x]').first().click().catch(() => {}); await wait(300);
    await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(600);
    t('phone upright: the game-setup screen works upright (no "turn your phone" cover)', !(await p.locator('.rotate-gate').isVisible()));
    t('phone upright: the lobby does not scroll sideways', await p.evaluate(() => { const s = document.getElementById('stage'); return s.scrollWidth <= s.clientWidth + 1; }));
    await p.evaluate(() => window.lowstakes.client.addBot()); await wait(300);
    await p.evaluate(() => window.lowstakes.client.setGame('holdem')); await wait(900);
    t('phone upright: once a game starts, the "turn your phone sideways" cover appears', await p.locator('.rotate-gate').isVisible());
    await ctx.close();
  }

  // a chat bubble follows its sender while the page scrolls
  {
    const { ctx, p } = await open(b, { width: 700, height: 420 });
    await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(500);
    await p.evaluate(() => { const c = window.lowstakes.client; for (let i = 0; i < 6; i++) c.addBot(); });
    await wait(400);
    await p.evaluate(() => document.getElementById('stage').scrollTo(0, 0));
    await p.evaluate(() => window.lowstakes.client.say('hello there')); await wait(500);
    const dist = async () => p.evaluate(() => { const bu = document.querySelector('#fx .bubble'); const me = document.querySelector('#stage .lp.me, #stage [data-seat]'); if (!bu || !me) return null; const a = bu.getBoundingClientRect(), r = me.getBoundingClientRect(); return { dy: Math.round(r.top - a.bottom), hidden: bu.style.visibility === 'hidden' }; });
    const d0 = await dist();
    await p.evaluate(() => document.getElementById('stage').scrollBy(0, 30)); await wait(150);
    const d1 = await dist();
    t('chat bubble stays on top of its sender while the page scrolls', d0 && d1 && Math.abs(d0.dy - d1.dy) <= 4, JSON.stringify({ d0, d1 }));
    await ctx.close();
  }

  // full tables on a phone on its side: everyone is on screen, readable, and the main thing is big
  {
    const { ctx, p } = await open(b, { width: 844, height: 390 }, true);
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(400);
    const fill = (g, cap) => p.evaluate(([g, cap]) => { const c = window.lowstakes.client; c.endGame(); const pl = window.lowstakes.state.room.players; const extra = pl.filter((x) => x.bot).slice(Math.max(0, cap - 1)); for (const x of extra) c.removePlayer(x.id); const have = pl.length - extra.length; for (let i = have; i < cap; i++) c.addBot(); c.setGame(g); }, [g, cap]);
    const inside = (r, w, h) => r && r.l >= -1 && r.t >= 40 - 1 && r.r <= w + 1 && r.b <= h + 1;
    await fill('holdem', 9); await wait(2500);
    const seats = await p.evaluate(() => [...document.querySelectorAll('.tbl.holdem .seat .plate')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, name: e.querySelector('.pname').textContent }; }));
    const clash = seats.some((a, i) => seats.some((b2, j) => j > i && a.l < b2.r - 2 && b2.l < a.r - 2 && a.t < b2.b - 2 && b2.t < a.b - 2));
    t('poker, 9 players on a phone on its side: all nine names are on screen', seats.length === 9 && seats.every((r) => inside(r, 844, 345)), JSON.stringify(seats.filter((r) => !inside(r, 844, 345))));
    t('poker, 9 players: no two players overlap', !clash);
    await fill('roulette', 12); await wait(2500);
    const wheel = await rect(p, '.wheel-box'); const board = await rect(p, '.rl-layout');
    t('roulette on a phone on its side: the wheel is big (about 40% of the screen height or more)', wheel && wheel.h >= 150, JSON.stringify(wheel));
    t('roulette: the wheel and the whole betting board are on screen together', wheel && board && inside(board, 844, 336) && wheel.b <= 336 && wheel.r < board.l + 2, JSON.stringify({ wheel, board }));
    await fill('blackjack', 7); await wait(3000);
    const spots = await p.evaluate(() => [...document.querySelectorAll('.tbl.blackjack .spot .plate')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }));
    t('blackjack, 7 players on a phone on its side: all seven seats are on screen', spots.length === 7 && spots.every((r) => inside(r, 844, 345)), JSON.stringify(spots.filter((r) => !inside(r, 844, 345))));
    await fill('crash', 12); await wait(3000);
    const g = await rect(p, '.cr-graph');
    t('crash on a phone on its side: the chart is tall enough to watch the rocket climb', g && g.h >= 150, JSON.stringify(g));
    t('crash: all twelve players are reachable in one swipeable row', await p.evaluate(() => { const r = document.querySelector('.cr-roster'); return r && r.children.length === 12 && r.scrollWidth > r.clientWidth && getComputedStyle(r).overflowX !== 'visible'; }));
    await ctx.close();
  }

  // roulette: pressing Spin takes you to the full-screen wheel straight away, and it carries on into the spin
  {
    const { ctx, p } = await open(b, { width: 800, height: 300 }, true);
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await practice(p, 'roulette'); await wait(1200);
    await p.evaluate(() => { const c = window.lowstakes.client; c.act({ type: 'bet', spot: 'red', amount: 25 }); }); await wait(300);
    await p.locator('[data-act=rl-ready]').dispatchEvent('click'); await wait(900);
    const ov = await rect(p, '.spin-ov');
    t('roulette: pressing Spin brings up the full-screen wheel at once', ov && ov.w >= 790 && ov.h >= 290 && /everyone is ready|No more bets/.test(await p.locator('.spin-title').innerText()), JSON.stringify(ov));
    await p.waitForFunction(() => window.lowstakes.state.game.phase === 'spinning', null, { timeout: 15000 }); await wait(600);
    t('roulette: the same full-screen wheel carries into the spin ("No more bets")', await p.locator('.spin-ov').count() === 1 && /No more bets/.test(await p.locator('.spin-title').innerText()));
    await ctx.close();
  }

  // phone with the browser bars showing (about 800x290 of page): poker and blackjack tables fill the space
  {
    const { ctx, p } = await open(b, { width: 800, height: 290 }, true);
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await practice(p, 'holdem'); await wait(1200);
    const tb = await rect(p, '.tbl.holdem'); const stg = await rect(p, '#stage');
    t('poker on a short phone screen: the table uses at least 60% of the height there is', tb && stg && tb.h / stg.h >= 0.6, JSON.stringify({ tb, stg }));
    const me = await rect(p, '.seat.me .plate'); const dk = await rect(p, '#dock');
    t('poker on a short phone screen: your own plate is fully above the dock', me && dk && me.b <= dk.t + 1, JSON.stringify({ me, dk }));
    await p.evaluate(() => window.lowstakes.client.setGame('blackjack')); await wait(1500);
    const bj = await rect(p, '.tbl.blackjack');
    t('blackjack on a short phone screen: the table uses at least 60% of the height there is', bj && stg && bj.h / stg.h >= 0.6, JSON.stringify(bj));
    await ctx.close();
  }

  // signed-in header on a phone: the coin balance is never cut off, however long the name
  {
    const { ctx, p } = await open(b, { width: 360, height: 740 }, true);
    await p.evaluate(() => { document.querySelector('.acct-slot').innerHTML = '<button class="btn btn-primary btn-sm coins-btn">Free coins</button><button class="acct-chip"><span class="an">a_really_long_username_here</span><span class="ab">24,000</span></button>'; });
    await wait(200);
    const chip = await rect(p, '.acct-chip'); const ab = await rect(p, '.acct-chip .ab');
    t('phone: the coin balance in the home-page header is fully visible', chip && ab && ab.r <= 360 && ab.r <= chip.r + 1 && ab.w > 20, JSON.stringify({ chip, ab }));
    t('phone: the home page header does not scroll sideways', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await ctx.close();
  }

  // full screen: the Menu offers it, and Start asks for it on touch screens
  {
    const { ctx, p } = await open(b, { width: 800, height: 300 }, true);
    await p.addInitScript(() => { window.__fs = 0; Element.prototype.requestFullscreen = function () { window.__fs++; return Promise.resolve(); }; });
    await p.goto(BASE); await wait(600);
    await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(500);
    t('Start a table asks the browser for full screen on a touch screen', (await p.evaluate(() => window.__fs)) >= 1);
    await p.locator('[data-act=more]').dispatchEvent('click'); await wait(300);
    t('the Menu has a Full screen button', /Full screen/.test(await p.locator('.more-list').innerText()));
    await ctx.close();
  }

  // phone poker: opponents' cards are visible, and the dealing animation still runs when the phone asks for reduced motion
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 840, height: 285 }, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(() => { try { localStorage.setItem('ls.age', '18'); } catch {} });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE); await wait(600);
    await p.addStyleTag({ content: '#banner{display:none!important}' });
    await p.locator('button[data-mode=host]').dispatchEvent('click'); await p.waitForSelector('.lobby'); await wait(300);
    await p.evaluate(() => { const c = window.lowstakes.client; for (let i = 0; i < 8; i++) c.addBot(); c.setGame('holdem'); });
    await wait(1700);
    const anim = await p.evaluate(() => { const c = document.querySelector('.seat:not(.me) .card'); const a = c && getComputedStyle(c); return a ? parseFloat(a.animationDuration) : -1; });
    t(`phone poker${reduced ? ' (reduced motion)' : ''}: the cards are dealt with the flying animation`, anim > 0.3, String(anim));
    await wait(5500);
    const vis = await p.evaluate(() => [...document.querySelectorAll('.seat:not(.me):not(.folded):not(.out) .card')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.left >= 0 && r.right <= innerWidth && getComputedStyle(e).opacity !== '0'; }).length);
    t(`phone poker${reduced ? ' (reduced motion)' : ''}: opponents' face-down cards are visible beside their names`, vis >= 12, String(vis));
    await ctx.close();
  }

  // Coming back from Google lands you on the invite you were opening, not the home page
  {
    const { ctx, p } = await open(b, { width: 1280, height: 800 });
    await p.evaluate(() => { sessionStorage.setItem('ls.back', '#/s/ABCDE'); });
    await p.goto(BASE + '#access_token=tok&refresh_token=rt&expires_in=3600&token_type=bearer'); await wait(1500);
    t('after signing in with Google you are returned to the table invite you were opening', (await p.evaluate(() => location.hash)) === '#/s/ABCDE', await p.evaluate(() => location.hash));
    await p.evaluate(() => { sessionStorage.setItem('ls.back', '#/s/<script>'); });
    await p.goto(BASE + '#access_token=tok2&refresh_token=rt&expires_in=3600&token_type=bearer'); await wait(1500);
    t('a remembered address that is not a table invite is ignored', (await p.evaluate(() => location.hash)) === '#/', await p.evaluate(() => location.hash));
    await ctx.close();
  }

  console.log(`\npage errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
