// Browser test of the Google-only account flow against a stand-in for Supabase (mock-supabase.cjs).
// Needs Playwright and the site served at http://localhost:8080/lowstakes/ (for example: python3 -m http.server 8080 from the repo root).
// It proves the screens and flows; it does not prove real Google sign-in or the real database (see supabase/test for the SQL).
const { chromium } = require('playwright');
const makeMock = require('./mock-supabase.cjs');
const SP = process.env.SP || require('os').tmpdir();
const SB = 'https://pupyykzrfbuimvuwohya.supabase.co';
const KEY = 'sb_publishable_COgy0nfCPaaPLH1CRWpuWg_pNf-_PO-';
const BASE = 'http://localhost:8080/lowstakes/';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };

async function newCtx(b, mock, { w = 1280, h = 800, requireLogin = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ls.age', '18'); } catch {} });
  await ctx.route(SB + '/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const r = mock.handle(req.method(), req.url(), req.headers(), req.postData());
    return route.fulfill({ status: r.status, headers: { ...cors, ...(r.headers || {}), 'content-type': 'application/json' }, body: r.body === null ? '' : JSON.stringify(r.body) });
  });
  if (requireLogin) await ctx.route('**/js/config.js*', async (route) => { const res = await route.fetch(); route.fulfill({ response: res, body: (await res.text()).replace('requireLogin: false', 'requireLogin: true') }); });
  return ctx;
}
const text = async (p) => (await p.locator('.ls-acct').innerText().catch(() => '')).replace(/\s+/g, ' ');
const hint = (p) => p.locator('.acct-card #a-hint').innerText();
async function viaGoogle(p, mock, email) { mock.google = { email }; await p.click('.acct-card [data-go=google]'); await p.waitForURL(/localhost:8080\/lowstakes/, { timeout: 8000 }); await wait(1300); }
const rpcRaw = (p, name, body) => p.evaluate(async ({ SB, KEY, name, body }) => {
  const s = JSON.parse(localStorage.getItem('ls.auth'));
  const r = await fetch(`${SB}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}, { SB, KEY, name, body });

(async () => {
  const b = await chromium.launch();
  const mock = makeMock();
  // someone already owns Bob_99
  mock.users.set('bob@gmail.com', { id: 'u-bob', email: 'bob@gmail.com', confirmed: true }); mock.byId.set('u-bob', mock.users.get('bob@gmail.com'));
  mock.profiles.set('u-bob', { username: 'Bob_99', email: 'bob@gmail.com', balance: 20000, changes: 0 });
  let ctx = await newCtx(b, mock);
  let p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await wait(600);

  // ---- signed out
  t('signed-out landing has one button: Sign in with Google', await p.locator('.acct-slot [data-acct=signin]').innerText() === 'Sign in with Google' && await p.locator('.acct-slot button').count() === 1);
  t('no email sign-up anywhere on the page', await p.locator('input[type=email], input[type=password], [data-acct=signup]').count() === 0 && !/create account/i.test(await p.locator('.acct-slot').innerText()));
  t('site is still usable signed out (login gate is off)', await p.locator('#start-form').count() === 1);
  t('no name box and no chip colour picker (name comes from the account)', await p.locator('#name, .swatch, .swatches').count() === 0 && !/Texas/.test(await p.locator('.placard h3').allInnerTexts().then(a => a.join(' '))) && /Poker/.test(await p.locator('.placard h3').first().innerText()));
  await p.click('[data-acct=signin]'); await wait(300);
  t('sign-in dialog offers only Continue with Google', /Continue with Google/.test(await text(p)) && await p.locator('.acct-card input').count() === 0);
  t('dialog explains the free username and one-time bonus', /free/.test(await text(p)) && /20,000/.test(await text(p)));
  await p.keyboard.press('Escape'); await wait(200);
  t('Escape closes the dialog', await p.locator('.ls-acct').count() === 0);
  await p.click('[data-acct=signin]'); await wait(200);

  // ---- new player via Google
  await viaGoogle(p, mock, 'lucky@gmail.com');
  t('back from Google a new player must choose a username', /Choose your username/.test(await text(p)) && /lucky@gmail\.com/.test(await text(p)), await text(p));
  t('no wallet or coins until the username is claimed', mock.profiles.size === 1 && mock.tx.length === 0);
  t('address bar is tidied (no tokens left in the URL)', !/access_token|provider_token/.test(p.url()));
  await p.fill('#a-user', 'a!'); await wait(150);
  t('invalid username is explained at once', /letters, numbers and underscores|3 to 16/i.test(await hint(p)));
  await p.fill('#a-user', 'ab'); await wait(150);
  t('too-short username is explained', /3 to 16/.test(await hint(p)));
  await p.fill('#a-user', 'BOB_99'); await wait(700);
  t('a taken username (any capitals) is flagged', /taken/i.test(await hint(p)));
  await p.click('.acct-card button[type=submit]'); await wait(300);
  t('cannot claim a taken username', mock.profiles.size === 1 && /available|taken/i.test(await text(p)));
  await p.fill('#a-user', 'Admin'); await wait(700);
  t('a reserved username is refused', /reserved/i.test(await hint(p)));
  await p.fill('#a-user', 'Lucky_Player'); await wait(700);
  t('a free username shows available', /available/.test(await hint(p)));
  await p.click('.acct-card button[type=submit]'); await wait(900);
  t('claiming it shows the welcome with 20,000 coins', /Welcome, Lucky_Player/.test(await text(p)) && /20,000/.test(await text(p)));
  t('exactly one welcome bonus of 20,000', mock.txOf('Lucky_Player').filter(x => x.type === 'welcome_bonus').length === 1 && mock.profileOf('Lucky_Player').balance === 20000);
  await p.click('.acct-card [data-x]'); await wait(200);
  t('nav chip shows username and balance', /Lucky_Player/.test(await p.locator('.acct-chip').innerText()) && /20,000/.test(await p.locator('.acct-chip').innerText()));

  // ---- persistence
  await p.reload(); await wait(1200);
  t('reload keeps you signed in with the same balance', /20,000/.test(await p.locator('.acct-chip').innerText()));
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await wait(1200);
  t('closing and reopening the tab keeps the session', /Lucky_Player/.test(await p.locator('.acct-chip').innerText()));
  await p.click('.acct-chip'); await wait(500);
  t('profile shows username, balance and the welcome transaction', /Lucky_Player/.test(await text(p)) && /Welcome bonus/.test(await text(p)) && /\+20,000/.test(await text(p)));
  await p.click('[data-go=out]'); await wait(500);
  t('sign out clears the session and the chip', await p.locator('.acct-slot [data-acct=signin]').count() === 1 && await p.evaluate(() => !localStorage.getItem('ls.auth')));

  // ---- signing in again is the same account, with no new bonus
  await p.click('[data-acct=signin]'); await wait(300);
  await viaGoogle(p, mock, 'lucky@gmail.com');
  t('signing in again goes straight in: no username prompt', await p.locator('.ls-acct').count() === 0 && /Signed in as Lucky_Player/.test(await p.locator('#toast').innerText()));
  t('same balance, still exactly one welcome bonus', /20,000/.test(await p.locator('.acct-chip').innerText()) && mock.txOf('Lucky_Player').filter(x => x.type === 'welcome_bonus').length === 1);
  // another device = another browser context, same Google account
  const ctxB = await newCtx(b, mock); const pB = await ctxB.newPage(); pB.on('pageerror', e => errs.push(e.message));
  await pB.goto(BASE); await wait(500); await pB.click('[data-acct=signin]'); await wait(200);
  await viaGoogle(pB, mock, 'lucky@gmail.com');
  t('a second device gets the same account and balance, no bonus', /Lucky_Player/.test(await pB.locator('.acct-chip').innerText()) && /20,000/.test(await pB.locator('.acct-chip').innerText()) && mock.tx.filter(x => x.type === 'welcome_bonus').length === 1);
  await ctxB.close();

  // ---- a different Google account is a different player
  const ctxC = await newCtx(b, mock); const pC = await ctxC.newPage(); pC.on('pageerror', e => errs.push(e.message));
  await pC.goto(BASE); await wait(500); await pC.click('[data-acct=signin]'); await wait(200);
  await viaGoogle(pC, mock, 'second@gmail.com');
  await pC.fill('#a-user', 'Second_One'); await wait(700); await pC.click('.acct-card button[type=submit]'); await wait(900);
  t('a different Google account gets its own username and its own 20,000', mock.profileOf('Second_One').balance === 20000 && mock.profileOf('Lucky_Player').balance === 20000);
  await ctxC.close();
  // a second login method for the same email must not create a second account or bonus
  const ctxD = await newCtx(b, mock); const pD = await ctxD.newPage(); pD.on('pageerror', e => errs.push(e.message));
  mock.forceNewUser = true;
  await pD.goto(BASE); await wait(500); await pD.click('[data-acct=signin]'); await wait(200);
  await viaGoogle(pD, mock, 'lucky@gmail.com');
  await pD.fill('#a-user', 'Sneaky_Twin'); await wait(700); await pD.click('.acct-card button[type=submit]'); await wait(900);
  mock.forceNewUser = false;
  t('a duplicate auth user for the same email cannot create a second account or bonus', /already has a Low Stakes account/.test(await text(pD)) && !mock.profileOf('Sneaky_Twin'));
  await ctxD.close();

  // ---- username change
  await p.click('.acct-chip'); await wait(500);
  await p.fill('#a-new', 'lucky_PLAYER'); await p.click('#rn button[type=submit]'); await wait(200);
  t('changing to your own name (any case) is refused', /already your username/i.test(await text(p)));
  await p.fill('#a-new', 'bob_99'); await wait(700);
  t('taken name is flagged as you type', /taken/i.test(await hint(p)));
  await p.click('#rn button[type=submit]'); await wait(200);
  t('cannot proceed to confirm with a taken name', await p.locator('[data-go=do-rn]').count() === 0);
  await p.fill('#a-new', 'Lucky7'); await wait(700); await p.click('#rn button[type=submit]'); await wait(300);
  const conf = await text(p);
  t('the 5,000 fee and the balance change are shown before confirming', /5,000 coins/.test(conf) && /Lucky_Player/.test(conf) && /Lucky7/.test(conf) && /20,000 to 15,000/.test(conf), conf);
  t('nothing is charged until confirmed', mock.profileOf('Lucky_Player').balance === 20000);
  await p.click('[data-go=cancel-rn]'); await wait(200);
  t('cancel leaves everything unchanged', mock.profileOf('Lucky_Player').balance === 20000 && await p.locator('#a-new').count() === 1);
  await p.fill('#a-new', 'Lucky7'); await wait(700); await p.click('#rn button[type=submit]'); await wait(300);
  await p.dblclick('[data-go=do-rn]'); await wait(800);
  t('rename charges exactly 5,000 once, even on a double click', !!mock.profileOf('Lucky7') && mock.profileOf('Lucky7').balance === 15000 && mock.txOf('Lucky7').filter(x => x.type === 'username_change_fee').length === 1);
  t('profile, nav chip and name box update at once', /Lucky7/.test(await p.locator('.aname').innerText()) && /15,000/.test(await p.locator('.abig').innerText()) && /Lucky7/.test(await p.locator('.acct-chip').innerText()));
  const lastCall = [...mock.log].reverse().find(l => l.path === '/rest/v1/rpc/change_username');
  const again = await rpcRaw(p, 'change_username', lastCall.body);
  t('replaying the same rename request charges nothing', again.already === true && mock.profileOf('Lucky7').balance === 15000);
  t('transaction history lists the fee', /Username change/.test(await text(p)) && /−5,000/.test(await text(p)));
  await p.fill('#a-new', 'Lucky8'); await wait(700); await p.click('#rn button[type=submit]'); await wait(300); await p.click('[data-go=do-rn]'); await wait(800);
  t('a second change costs 5,000 too', mock.profileOf('Lucky8').balance === 10000);
  mock.setBalance('Lucky8', 4999);
  await p.click('.acct-card [data-x]'); await p.reload(); await wait(1200); await p.click('.acct-chip'); await wait(600);
  t('under 5,000 the change is disabled with a clear message', await p.locator('#a-new').isDisabled() && /You need 5,000 coins/.test(await text(p)));
  const poor = await rpcRaw(p, 'change_username', { p_new: 'Sneaky_1', p_request_id: 'force-request-1' });
  t('forcing it below 5,000 is refused by the backend and charges nothing', poor.message === 'insufficient_balance' && mock.profileOf('Lucky8').balance === 4999);
  mock.setBalance('Lucky8', 10000);
  await p.click('.acct-card [data-x]');

  // ---- sessions
  mock.expireAccess();
  await p.click('.acct-chip'); await wait(1000);
  t('an expired access token is refreshed silently', /Lucky8/.test(await text(p)) && /Recent transactions/.test(await text(p)));
  await p.click('.acct-card [data-x]');
  mock.expireAccess(); mock.killRefresh();
  await p.reload(); await wait(1500);
  t('a dead session signs you out with a notice instead of breaking', await p.locator('.acct-slot [data-acct=signin]').count() === 1 && /session expired/i.test(await p.locator('#toast').innerText()));

  // ---- Google cancelled or failed
  await p.click('[data-acct=signin]'); await wait(200);
  mock.googleError = 'access_denied';
  await p.click('.acct-card [data-go=google]'); await p.waitForURL(/localhost:8080\/lowstakes/, { timeout: 8000 }); await wait(1000);
  t('cancelling Google shows a friendly message and nothing breaks', /cancelled/i.test(await text(p)) && await p.locator('.acct-card [data-go=google]').count() === 1 && !/error/.test(p.url()));
  mock.googleError = null;
  await p.keyboard.press('Escape');
  await p.goto(BASE + '?error=access_denied&error_code=access_denied&error_description=Denied'); await wait(900);
  t('an error returned in the query string is handled and cleaned from the URL', /cancelled/i.test(await text(p)) && !/error/.test(p.url()));
  await p.keyboard.press('Escape');

  // ---- username taken between Google and claiming
  const ctxE = await newCtx(b, mock); const pE = await ctxE.newPage(); pE.on('pageerror', e => errs.push(e.message));
  await pE.goto(BASE); await wait(500); await pE.click('[data-acct=signin]'); await wait(200);
  await viaGoogle(pE, mock, 'late@gmail.com');
  await pE.fill('#a-user', 'Late_One'); await wait(700);
  mock.users.set('thief@gmail.com', { id: 'u-thief', email: 'thief@gmail.com', confirmed: true }); mock.byId.set('u-thief', mock.users.get('thief@gmail.com'));
  mock.profiles.set('u-thief', { username: 'Late_One', email: 'thief@gmail.com', balance: 20000, changes: 0 });
  await pE.click('.acct-card button[type=submit]'); await wait(800);
  t('if the name is taken at the last moment you get a clear error and no coins', /taken/i.test(await text(pE)) && !mock.profiles.has(mock.users.get('late@gmail.com').id));
  await pE.fill('#a-user', 'Late_Two'); await wait(700); await pE.click('.acct-card button[type=submit]'); await wait(800);
  t('then a free name gives exactly one 20,000 bonus', /Welcome, Late_Two/.test(await text(pE)) && mock.txOf('Late_Two').filter(x => x.type === 'welcome_bonus').length === 1);
  await ctxE.close();

  // ---- security
  const sent = mock.log.filter(l => l.body && ('balance' in l.body || 'amount' in l.body || 'payout' in l.body));
  t('the browser never sends a balance, amount or payout to the backend', sent.length === 0, JSON.stringify(sent.slice(0, 2)));
  t('no email or password endpoint is ever called', !mock.log.some(l => /\/auth\/v1\/(signup|recover|resend)|grant_type=password/.test(l.path)));
  t('no secret key is present in the shipped config', !/sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}/.test(require('fs').readFileSync(require('path').join(__dirname, '../../js/config.js'), 'utf8')));
  await ctx.close();

  // ---- free coins
  const mockF = makeMock();
  const ctxF = await newCtx(b, mockF);
  const pF = await ctxF.newPage(); pF.on('pageerror', e => errs.push(e.message));
  await pF.goto(BASE); await wait(600); await pF.click('[data-acct=signin]'); await wait(200);
  await viaGoogle(pF, mockF, 'coins@gmail.com');
  await pF.fill('#a-user', 'Coin_Fan'); await wait(700); await pF.click('.acct-card button[type=submit]'); await wait(900);
  await pF.click('.acct-card [data-x]'); await wait(1200);
  t('free coins: the header offers it', await pF.locator('.coins-btn').count() === 1);
  await pF.click('.coins-btn'); await wait(700);
  const cardsTxt = await text(pF);
  t('free coins: four packs with their amounts and refill times', ['1,000', '5,000', '15,000', '40,000'].every((n) => cardsTxt.includes(n)) && /Every 4 hours/.test(cardsTxt) && /Every 6 hours/.test(cardsTxt) && /Every 24 hours/.test(cardsTxt) && /Every 72 hours/.test(cardsTxt), cardsTxt.slice(0, 300));
  t('free coins: no pack names or sign-up explanation cluttering the cards', !/Pocket change|High roller vault|timers started/.test(cardsTxt) && await pF.locator('.cp h3').count() === 0);
  t('free coins: no Popular or Best value labels, and the balance is shown', !/Popular|Best value/.test(cardsTxt) && await pF.locator('.cp-tag').count() === 0 && /Balance 20,000/.test(cardsTxt));
  t('free coins: each pack has real coin artwork', await pF.locator('.cp .coin use[href="#coin-g"]').count() === 2 + 3 + 4 + 5);
  t('free coins: the four packs use four different card colours', (await pF.locator('.cp-art').evaluateAll((els) => new Set(els.map((e) => getComputedStyle(e).backgroundImage.match(/rgb\([^)]*\)/g).join('|'))).size)) === 4);
  const btns = await pF.locator('.cp-btn').evaluateAll((els) => els.map((e) => ({ id: e.dataset.claim, text: e.textContent.replace('◷', '').trim(), disabled: e.disabled })));
  t('free coins: a brand-new account cannot claim anything yet (every pack is on its countdown)', btns.length === 4 && btns.every((x) => x.disabled && /^\d\d:\d\d:\d\d$/.test(x.text)) && await pF.locator('.cp-btn.ready').count() === 0, JSON.stringify(btns));
  const want = { pocket: ['04:00:00', '03:59'], stack: ['06:00:00', '05:59'], tower: ['24:00:00', '23:59'], vault: ['72:00:00', '71:59'] };
  t('...each counting down from its full length (4h / 6h / 24h / 72h)', btns.every((x) => x.text === want[x.id][0] || x.text.startsWith(want[x.id][1])), JSON.stringify(btns));
  t('...so there is no dot on the header button yet', await pF.locator('.coins-btn .dot').count() === 0);
  await pF.click('[data-claim=pocket]', { force: true, timeout: 2000 }).catch(() => {}); await wait(500);
  t('clicking a waiting pack does nothing', mockF.profileOf('Coin_Fan').balance === 20000 && mockF.tx.filter((x) => x.type === 'free_pack').length === 0);
  const tooSoon = await rpcRaw(pF, 'claim_free_pack', { p_pack: 'pocket' });
  t('forcing an early claim is refused by the backend and pays nothing', tooSoon.message === 'not_ready' && mockF.profileOf('Coin_Fan').balance === 20000);
  t('an invented pack is refused', (await rpcRaw(pF, 'claim_free_pack', { p_pack: 'gold_mine' })).message === 'bad_pack');
  await wait(2300);
  const tick = (await pF.locator('[data-claim=pocket]').innerText()).replace('◷', '').trim();
  t('the countdown ticks down', tick !== btns.find((x) => x.id === 'pocket').text, tick);
  const reopen = async (hoursSinceSignup) => { mockF.shift = hoursSinceSignup * 3600e3; await pF.click('.acct-card [data-x]'); await wait(300); await pF.click('.coins-btn'); await wait(900); };

  await reopen(5); // five hours after signing up: only the 4-hour pack is ready
  t('after four hours only the first pack is ready, with the others still counting', await pF.locator('.cp-btn.ready').count() === 1 && await pF.locator('[data-claim=pocket].ready').count() === 1);
  t('the 6-hour pack shows about an hour left', /^(01:00:00|00:59:\d\d)$/.test((await pF.locator('[data-claim=stack]').innerText()).replace('◷', '').trim()), await pF.locator('[data-claim=stack]').innerText());
  await pF.click('[data-claim=pocket]'); await wait(900);
  t('claiming adds the exact amount to the balance shown', /Balance 21,000/.test(await text(pF)) && mockF.profileOf('Coin_Fan').balance === 21000);
  t('...and the claimed pack counts down again from 4 hours', /^(04:00:00|03:59:\d\d)$/.test((await pF.locator('[data-claim=pocket]').innerText()).replace('◷', '').trim()));
  t('...and the header chip shows the new balance', /21,000/.test(await pF.locator('.acct-chip').innerText()));

  await reopen(6.1);
  await pF.click('[data-claim=stack]'); await wait(900);
  t('the 6-hour pack pays 5,000 once six hours have passed', mockF.profileOf('Coin_Fan').balance === 26000);

  await reopen(25);
  t('after a day the 24-hour pack is ready and the 72-hour one is not', await pF.locator('[data-claim=tower].ready').count() === 1 && await pF.locator('[data-claim=vault].ready').count() === 0);
  await pF.dblclick('[data-claim=tower]'); await wait(900);
  t('a double click on a pack still pays once', mockF.profileOf('Coin_Fan').balance === 41000 && mockF.tx.filter((x) => x.type === 'free_pack' && x.ref === 'tower').length === 1, String(mockF.profileOf('Coin_Fan').balance));
  const vEarly = await rpcRaw(pF, 'claim_free_pack', { p_pack: 'vault' });
  t('the 72-hour pack cannot be forced early', vEarly.message === 'not_ready' && mockF.profileOf('Coin_Fan').balance === 41000);
  t('the 72-hour pack shows hours beyond a day', /^(4[67]:\d\d:\d\d)$/.test((await pF.locator('[data-claim=vault]').innerText()).replace('◷', '').trim()), await pF.locator('[data-claim=vault]').innerText());

  await reopen(73);
  t('after three days every pack is ready again', await pF.locator('.cp-btn.ready').count() === 4);
  for (const id of ['vault', 'pocket', 'stack', 'tower']) { await pF.click(`[data-claim=${id}]`); await wait(900); }
  t('claiming all four after the wait pays 40,000 + 1,000 + 5,000 + 15,000', mockF.profileOf('Coin_Fan').balance === 41000 + 61000, String(mockF.profileOf('Coin_Fan').balance));
  t('every claim is one ledger row (7 in all)', mockF.txOf('Coin_Fan').filter((x) => x.type === 'free_pack').length === 7);
  await pF.click('.acct-card [data-x]'); await wait(300);
  t('the dot is gone once nothing is ready', await pF.locator('.coins-btn .dot').count() === 0);
  await pF.click('.coins-btn'); await wait(300); await pF.click('.acct-card [data-x]'); await wait(300);
  mockF.shift = 99 * 3600e3; await pF.click('.coins-btn'); await wait(900); await pF.click('.acct-card [data-x]'); await wait(300);
  t('the dot comes back when a timer runs out', await pF.locator('.coins-btn .dot').count() === 1);
  const dock = await pF.evaluate(async () => { const m = await import('/lowstakes/js/ui/parts.js?v=44'); return { wallet: m.outOfChips({ room: { walletMode: true, settings: { start: 1000 } } }), free: m.outOfChips({ room: { walletMode: false, settings: { start: 1000 } } }) }; }).catch((e) => ({ error: String(e) }));
  t('at a wallet table, the out-of-coins message offers free coins (and no free rebuy)', /data-act="free-coins"/.test(dock.wallet || '') && !/data-act="rebuy"/.test(dock.wallet || ''), JSON.stringify(dock).slice(0, 200));
  t('at a browser table the free rebuy is unchanged', /data-act="rebuy"/.test(dock.free || ''));
  await ctxF.close();

  // ---- login required mode
  const mock2 = makeMock();
  ctx = await newCtx(b, mock2, { requireLogin: true });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await wait(1000);
  t('login required: signed-out visitors cannot reach the games', await p.locator('.ls-acct').count() === 1 && await p.locator('#start-form').count() === 0 && await p.locator('.acct-x').count() === 0);
  await p.keyboard.press('Escape'); await wait(200);
  t('login required: Escape cannot dismiss it', await p.locator('.ls-acct').count() === 1);
  await p.locator('.ls-acct').click({ position: { x: 5, y: 5 } }); await wait(200);
  t('login required: clicking outside cannot dismiss it', await p.locator('.ls-acct').count() === 1);
  await viaGoogle(p, mock2, 'req@gmail.com');
  await p.fill('#a-user', 'Req_User'); await wait(700); await p.click('.acct-card button[type=submit]'); await wait(900);
  await p.click('.acct-card [data-x]'); await wait(800);
  t('login required: after claiming a username the site unlocks', await p.locator('#start-form').count() === 1 && /Req_User/.test(await p.locator('.acct-chip').innerText()));
  await ctx.close();

  // ---- phones
  for (const [w, h] of [[360, 800], [390, 844]]) {
    const mock3 = makeMock();
    ctx = await newCtx(b, mock3, { w, h });
    p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await wait(800);
    const rows = [];
    const check = async (label) => {
      rows.push([label, await p.evaluate(() => { const c = document.querySelector('.acct-card'); const rect = c.getBoundingClientRect(); const small = [...c.querySelectorAll('button, input, select')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5); }).map(e => (e.textContent || e.id || e.tagName).trim().slice(0, 20)); return { over: document.documentElement.scrollWidth > innerWidth + 1, inside: rect.left >= 0 && rect.right <= innerWidth, small }; })]);
    };
    await p.click('[data-acct=signin]'); await wait(300); await check('signin');
    await p.screenshot({ path: `${SP}/acct-signin-${w}.png` });
    await viaGoogle(p, mock3, 'm@gmail.com'); await check('choose');
    await p.fill('#a-user', 'Mobile_Man'); await wait(700); await p.click('.acct-card button[type=submit]'); await wait(900); await check('welcome');
    await p.screenshot({ path: `${SP}/acct-welcome-${w}.png` });
    await p.click('.acct-card [data-x]'); await wait(200);
    await p.click('.coins-btn'); await wait(800); await check('free coins');
    await p.screenshot({ path: `${SP}/acct-coins-${w}.png` });
    await p.keyboard.press('Escape'); await wait(200);
    await p.click('.acct-chip'); await wait(700); await check('profile');
    await p.screenshot({ path: `${SP}/acct-profile-${w}.png` });
    const bad = rows.filter(([, r]) => r.over || !r.inside || r.small.length);
    t(`phone ${w}px: every account screen fits, with 44px touch targets`, bad.length === 0, JSON.stringify(bad));
    await ctx.close();
  }
  console.log(`\npage errors: ${errs.length} ${errs.slice(0, 3)}`);
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
