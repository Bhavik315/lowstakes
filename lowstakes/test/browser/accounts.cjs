// Browser test of the account screens against a stand-in for Supabase (test/browser/mock-supabase.cjs).
// Needs Playwright and the site served at http://localhost:8080/lowstakes/ (for example: python3 -m http.server 8080 from the repo root).
// It proves the screens and flows; it does not prove real emails, Google, or the real database (see supabase/test for that).
const { chromium } = require('playwright');
const makeMock = require('./mock-supabase.cjs');
const SP = process.env.SP || require('os').tmpdir();
const SB = 'https://pupyykzrfbuimvuwohya.supabase.co';
const BASE = 'http://localhost:8080/lowstakes/';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };

async function newCtx(b, mock, { w = 1280, h = 800, requireLogin = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('fresh')) { sessionStorage.setItem('fresh', '1'); } localStorage.setItem('ls.age', '18'); } catch {} });
  await ctx.route(SB + '/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const r = mock.handle(req.method(), req.url(), req.headers(), req.postData());
    return route.fulfill({ status: r.status, headers: { ...cors, 'content-type': 'application/json' }, body: r.body === null ? '' : JSON.stringify(r.body) });
  });
  if (requireLogin) await ctx.route('**/js/config.js*', async (route) => { const res = await route.fetch(); route.fulfill({ response: res, body: (await res.text()).replace('requireLogin: false', 'requireLogin: true') }); });
  return ctx;
}
const modal = (p) => p.locator('.ls-acct .acct-card');
const text = async (p) => (await p.locator('.ls-acct').innerText().catch(() => '')).replace(/\s+/g, ' ');

(async () => {
  const b = await chromium.launch();
  const mock = makeMock();
  let ctx = await newCtx(b, mock);
  let p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await wait(600);

  // ---- signed out
  t('signed-out landing offers Sign in and Create account', await p.locator('.acct-slot [data-acct=signin]').count() === 1 && await p.locator('.acct-slot [data-acct=signup]').count() === 1);
  t('site is still usable signed out (login gate is off)', await p.locator('#name').count() === 1 && !(await p.locator('#name').getAttribute('readonly')));

  // ---- create account: validation
  await p.click('[data-acct=signup]'); await wait(300);
  t('create-account screen opens', /Create your account/.test(await text(p)));
  await p.fill('#a-user', 'a!'); await wait(100);
  t('invalid username shows a message at once', /letters, numbers and underscores|3 to 16/i.test(await modal(p).locator('#a-hint').innerText()));
  await p.fill('#a-user', 'Lucky_Player'); await wait(700);
  t('free username shows "available"', /available/.test(await modal(p).locator('#a-hint').innerText()));
  await p.fill('#a-email', 'lucky@example.com'); await p.fill('#a-pass', 'abc');
  await p.click('.acct-card button[type=submit]'); await wait(200);
  t('short password is rejected before sending', /at least 8/i.test(await text(p)) && !mock.log.some(l => l.path === '/auth/v1/signup'));
  const type0 = await p.locator('#a-pass').getAttribute('type');
  await p.click('[data-pw=a-pass]');
  t('show/hide password toggle works', type0 === 'password' && await p.locator('#a-pass').getAttribute('type') === 'text' && /Hide/.test(await p.locator('[data-pw=a-pass]').innerText()));
  await p.click('[data-pw=a-pass]');
  await p.fill('#a-pass', 'correct horse 9');
  await p.click('.acct-card button[type=submit]'); await wait(500);
  t('sign-up asks you to check your email', /Check your email/.test(await text(p)) && /lucky@example\.com/.test(await text(p)));
  t('no wallet or bonus before verification', mock.profiles.size === 0 && mock.tx.length === 0);
  t('chosen username travels with the sign-up', mock.users.get('lucky@example.com').meta === 'Lucky_Player');

  // ---- sign in before verifying
  await p.click('[data-go=signin]'); await wait(200);
  await p.fill('#a-email', 'lucky@example.com'); await p.fill('#a-pass', 'correct horse 9');
  await p.click('.acct-card button[type=submit]'); await wait(500);
  t('signing in before verifying sends you to verify', /Check your email|verify your email/i.test(await text(p)) && mock.profiles.size === 0);
  await p.keyboard.press('Escape'); await wait(200);
  t('Escape closes the dialog when login is not required', await p.locator('.ls-acct').count() === 0);

  // ---- verify via the email link
  const link = mock.confirm('lucky@example.com');
  await p.goto(BASE + link); await wait(1200);
  t('verification link finishes registration and welcomes you', /Welcome, Lucky_Player/.test(await text(p)) && /20,000/.test(await text(p)), await text(p));
  t('address bar is tidied (no tokens left in the URL)', !/access_token/.test(p.url()));
  t('exactly one welcome bonus of 20,000 recorded', mock.txOf('Lucky_Player').filter(x => x.type === 'welcome_bonus').length === 1 && mock.profileOf('Lucky_Player').balance === 20000);
  await p.click('.acct-card [data-x]'); await wait(200);
  t('nav chip shows username and balance', /Lucky_Player/.test(await p.locator('.acct-chip').innerText()) && /20,000/.test(await p.locator('.acct-chip').innerText()));
  t('name box is locked to the username', await p.locator('#name').inputValue() === 'Lucky_Player' && (await p.locator('#name').getAttribute('readonly')) !== null);

  // ---- persistence, reload, sign out and in
  await p.reload(); await wait(1200);
  t('reload keeps you signed in with the same balance', /20,000/.test(await p.locator('.acct-chip').innerText()));
  t('reload grants no extra bonus', mock.txOf('Lucky_Player').filter(x => x.type === 'welcome_bonus').length === 1);
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await wait(1200);
  t('closing and reopening the tab keeps the session', /Lucky_Player/.test(await p.locator('.acct-chip').innerText()));
  await p.click('.acct-chip'); await wait(500);
  t('profile shows username, balance and one welcome transaction', /Lucky_Player/.test(await text(p)) && /Welcome bonus/.test(await text(p)) && /\+20,000/.test(await text(p)));
  await p.click('[data-go=out]'); await wait(500);
  t('sign out clears the session and the chip', await p.locator('.acct-slot [data-acct=signin]').count() === 1 && await p.evaluate(() => !localStorage.getItem('ls.auth')));
  t('signed out, name box is editable again', (await p.locator('#name').getAttribute('readonly')) === null);
  await p.click('[data-acct=signin]'); await wait(300);
  await p.fill('#a-email', 'lucky@example.com'); await p.fill('#a-pass', 'wrong password');
  await p.click('.acct-card button[type=submit]'); await wait(500);
  t('wrong password gives a clear message', /do not match/.test(await text(p)));
  await p.fill('#a-pass', 'correct horse 9'); await p.click('.acct-card button[type=submit]'); await wait(800);
  t('signing in again: same balance, still one bonus', /20,000/.test(await p.locator('.acct-chip').innerText()) && mock.txOf('Lucky_Player').filter(x => x.type === 'welcome_bonus').length === 1);

  // ---- username change
  await p.click('.acct-chip'); await wait(500);
  await p.fill('#a-new', 'Lucky_Player'); await wait(100);
  await p.click('#rn button[type=submit]'); await wait(200);
  t('changing to your own name is refused', /already your username/i.test(await text(p)));
  await p.fill('#a-new', 'lucky_PLAYER'); await p.click('#rn button[type=submit]'); await wait(200);
  t('case-only change of your own name is refused', /already your username/i.test(await text(p)));
  // make a second user to own a name
  mock.users.set('bob@example.com', { id: 'u-bob', email: 'bob@example.com', password: 'bobpassword1', confirmed: true, meta: 'Bob_99' }); mock.byId.set('u-bob', mock.users.get('bob@example.com'));
  mock.profiles.set('u-bob', { username: 'Bob_99', email: 'bob@example.com', balance: 20000, changes: 0 });
  await p.fill('#a-new', 'bob_99'); await wait(700);
  t('taken name (any case) is flagged as you type', /taken/i.test(await modal(p).locator('#a-hint').innerText()));
  await p.click('#rn button[type=submit]'); await wait(200);
  t('cannot proceed to confirm with a taken name', await p.locator('[data-go=do-rn]').count() === 0);
  await p.fill('#a-new', 'Lucky7'); await wait(700);
  await p.click('#rn button[type=submit]'); await wait(300);
  const conf = await text(p);
  t('the 5,000 fee is shown before confirming', /5,000 coins/.test(conf) && /Lucky_Player/.test(conf) && /Lucky7/.test(conf) && /20,000 to 15,000/.test(conf), conf);
  t('nothing is charged until confirmed', mock.profileOf('Lucky_Player').balance === 20000);
  await p.click('[data-go=cancel-rn]'); await wait(200);
  t('cancel leaves everything unchanged', mock.profileOf('Lucky_Player').balance === 20000 && await p.locator('#a-new').count() === 1);
  await p.fill('#a-new', 'Lucky7'); await wait(700); await p.click('#rn button[type=submit]'); await wait(300);
  await p.dblclick('[data-go=do-rn]'); await wait(800);
  const lp = mock.profileOf('Lucky7');
  t('rename succeeds and charges exactly 5,000 once (even on a double click)', !!lp && lp.balance === 15000 && mock.txOf('Lucky7').filter(x => x.type === 'username_change_fee').length === 1);
  t('profile and nav show the new name and balance at once', /Lucky7/.test(await p.locator('.aname').innerText()) && /15,000/.test(await p.locator('.abig').innerText()) && /Lucky7/.test(await p.locator('.acct-chip').innerText()) && /changed to Lucky7/.test(await text(p)));
  t('name box follows the new username', await p.locator('#name').inputValue() === 'Lucky7');
  // replaying the same request id cannot charge again
  const replay = await p.evaluate(async ({ SB, key }) => {
    const s = JSON.parse(localStorage.getItem('ls.auth'));
    const reqId = window.__lastReq;
    return null;
  }, { SB, key: '' });
  const lastCall = [...mock.log].reverse().find(l => l.path === '/rest/v1/rpc/change_username');
  const again = await p.evaluate(async ({ SB, body, key }) => {
    const s = JSON.parse(localStorage.getItem('ls.auth'));
    const r = await fetch(SB + '/rest/v1/rpc/change_username', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }, { SB, body: lastCall.body, key: 'sb_publishable_COgy0nfCPaaPLH1CRWpuWg_pNf-_PO-' });
  t('replaying the same rename request is a no-op', again.already === true && mock.profileOf('Lucky7').balance === 15000);
  t('transaction history lists the fee', /Username change/.test(await text(p)) && /−5,000/.test(await text(p)));
  // second change also costs
  await p.fill('#a-new', 'Lucky8'); await wait(700); await p.click('#rn button[type=submit]'); await wait(300); await p.click('[data-go=do-rn]'); await wait(800);
  t('a second change costs 5,000 too', mock.profileOf('Lucky8').balance === 10000);
  // not enough coins
  mock.setBalance('Lucky8', 4999);
  await p.click('.acct-card [data-x]'); await wait(200);
  await p.reload(); await wait(1200); await p.click('.acct-chip'); await wait(600);
  t('under 5,000: change is disabled with a clear message', await p.locator('#a-new').isDisabled() && /You need 5,000 coins/.test(await text(p)));
  const poorTry = await p.evaluate(async ({ SB, key }) => {
    const s = JSON.parse(localStorage.getItem('ls.auth'));
    const r = await fetch(SB + '/rest/v1/rpc/change_username', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_new: 'Sneaky_1', p_request_id: 'force-request-1' }) });
    return r.json();
  }, { SB, key: 'sb_publishable_COgy0nfCPaaPLH1CRWpuWg_pNf-_PO-' });
  t('forcing a change below 5,000 is refused by the backend and charges nothing', poorTry.message === 'insufficient_balance' && mock.profileOf('Lucky8').balance === 4999);
  mock.setBalance('Lucky8', 10000);
  await p.click('.acct-card [data-x]');

  // ---- forgot password
  await p.click('[data-go=out]').catch(() => {});
  await p.evaluate(() => localStorage.removeItem('ls.auth')); await p.reload(); await wait(800);
  await p.click('[data-acct=signin]'); await wait(300);
  await p.click('[data-go=forgot]'); await wait(200);
  await p.fill('#a-email', 'nobody@example.com'); await p.click('.acct-card button[type=submit]'); await wait(400);
  t('forgot password never reveals whether the email exists', /If that address has an account/.test(await text(p)));
  await p.goto(BASE + mock.recovery('lucky@example.com')); await wait(1200);
  t('recovery link opens the new-password screen', /Choose a new password/.test(await text(p)) && !/access_token/.test(p.url()));
  await p.fill('#a-pass', 'correct horse 9'); await p.click('.acct-card button[type=submit]'); await wait(500);
  t('reusing the old password is rejected', /different password/i.test(await text(p)));
  await p.fill('#a-pass', 'brand new pass 77'); await p.click('.acct-card button[type=submit]'); await wait(1000);
  t('new password saves and signs you in', /Signed in as Lucky8/.test(await p.locator('#toast').innerText()) && mock.users.get('lucky@example.com').password === 'brand new pass 77');
  t('no second welcome bonus after password reset', mock.txOf('Lucky8').filter(x => x.type === 'welcome_bonus').length === 1);

  // ---- expired sessions
  mock.expireAccess();
  await p.click('.acct-chip'); await wait(1000);
  t('an expired access token is refreshed silently', /Lucky8/.test(await text(p)) && /Recent transactions/.test(await text(p)));
  await p.click('.acct-card [data-x]');
  mock.expireAccess(); mock.killRefresh();
  await p.reload(); await wait(1500);
  t('a dead session signs you out with a notice instead of breaking', await p.locator('.acct-slot [data-acct=signin]').count() === 1 && /session expired/i.test(await p.locator('#toast').innerText()));

  // ---- expired email link
  await p.goto(BASE + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'); await wait(800);
  t('an expired email link explains itself and offers sign-in', /expired/i.test(await text(p)) && /Sign in/.test(await text(p)) && !/error_code/.test(p.url()));
  await p.keyboard.press('Escape');

  // ---- username taken between sign-up and verification
  mock.profiles.set('u-bob', mock.profiles.get('u-bob'));
  await p.click('[data-acct=signup]'); await wait(300);
  await p.fill('#a-email', 'late@example.com'); await p.fill('#a-user', 'Late_One'); await wait(700);
  await p.fill('#a-pass', 'late password 1'); await p.click('.acct-card button[type=submit]'); await wait(500);
  mock.users.set('thief@example.com', { id: 'u-thief', email: 'thief@example.com', password: 'x'.repeat(10), confirmed: true, meta: 'x' }); mock.byId.set('u-thief', mock.users.get('thief@example.com'));
  mock.profiles.set('u-thief', { username: 'Late_One', email: 'thief@example.com', balance: 20000, changes: 0 });
  await p.goto(BASE + mock.confirm('late@example.com')); await wait(1200);
  t('if the name was taken meanwhile you are asked to pick another, with no coins yet', /Choose your username/.test(await text(p)) && /taken/i.test(await text(p)) && !mock.profiles.has(mock.users.get('late@example.com').id));
  await p.fill('#a-user', 'Late_Two'); await wait(700); await p.click('.acct-card button[type=submit]'); await wait(800);
  t('choosing a free name then gives exactly one 20,000 bonus', /Welcome, Late_Two/.test(await text(p)) && mock.txOf('Late_Two').filter(x => x.type === 'welcome_bonus').length === 1);
  await p.keyboard.press('Escape');

  // ---- security: what the browser sends
  const sent = mock.log.filter(l => l.body && ('balance' in l.body || 'amount' in l.body || 'payout' in l.body));
  t('the browser never sends a balance, amount or payout to the backend', sent.length === 0, JSON.stringify(sent.slice(0, 2)));
  t('no service-role style key is present in the shipped config', !/sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}/.test(require('fs').readFileSync(require('path').join(__dirname, '../../js/config.js'), 'utf8')));
  await ctx.close();

  // ---- login required mode
  const mock2 = makeMock();
  ctx = await newCtx(b, mock2, { requireLogin: true });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await wait(1000);
  t('login required: signed-out visitors cannot reach the games', await p.locator('.ls-acct').count() === 1 && await p.locator('#name').count() === 0 && await p.locator('.acct-x').count() === 0);
  await p.keyboard.press('Escape'); await wait(200);
  t('login required: Escape cannot dismiss the sign-in', await p.locator('.ls-acct').count() === 1);
  await p.locator('.ls-acct').click({ position: { x: 5, y: 5 } }); await wait(200);
  t('login required: clicking outside cannot dismiss it', await p.locator('.ls-acct').count() === 1);
  mock2.users.set('req@example.com', { id: 'u-req', email: 'req@example.com', password: 'required pass 1', confirmed: true, meta: 'Req_User' }); mock2.byId.set('u-req', mock2.users.get('req@example.com'));
  await p.fill('#a-email', 'req@example.com'); await p.fill('#a-pass', 'required pass 1'); await p.click('.acct-card button[type=submit]'); await wait(1500);
  t('login required: signing in unlocks the site and finishes registration', /Welcome, Req_User/.test(await text(p)) || await p.locator('#name').count() === 1);
  await ctx.close();

  // ---- phones
  for (const [w, h] of [[360, 800], [390, 844]]) {
    const mock3 = makeMock();
    ctx = await newCtx(b, mock3, { w, h });
    p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE); await wait(800);
    const sizes = [];
    const check = async (label) => {
      const r = await p.evaluate(() => { const c = document.querySelector('.acct-card'); const rect = c.getBoundingClientRect(); const small = [...c.querySelectorAll('button, input, select')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5) && !e.closest('[hidden]'); }).map(e => (e.textContent || e.id || e.tagName).trim().slice(0, 20)); return { over: document.documentElement.scrollWidth > innerWidth + 1, left: rect.left >= 0, right: rect.right <= innerWidth, small }; });
      sizes.push([label, r]);
    };
    await p.click('[data-acct=signup]'); await wait(300); await check('signup');
    await p.screenshot({ path: `${SP}/shots/acct-signup-${w}.png` });
    await p.click('[data-go=signin]'); await wait(200); await check('signin');
    await p.click('[data-go=forgot]'); await wait(200); await check('forgot');
    await p.keyboard.press('Escape');
    mock3.users.set('m@example.com', { id: 'u-m', email: 'm@example.com', password: 'mobile pass 12', confirmed: true, meta: 'Mobile_Man' }); mock3.byId.set('u-m', mock3.users.get('m@example.com'));
    await p.goto(BASE + mock3.recovery('m@example.com')); await wait(900); await check('reset');
    await p.fill('#a-pass', 'mobile pass 13'); await p.click('.acct-card button[type=submit]'); await wait(1200); await check('choose/welcome');
    await p.screenshot({ path: `${SP}/shots/acct-welcome-${w}.png` });
    const claim = await p.locator('#a-user').count();
    if (claim) { await p.fill('#a-user', 'Mobile_Man'); await wait(700); await p.click('.acct-card button[type=submit]'); await wait(800); }
    await p.click('.acct-card [data-x]'); await wait(200);
    await p.click('.acct-chip'); await wait(700); await check('profile');
    await p.screenshot({ path: `${SP}/shots/acct-profile-${w}.png` });
    const bad = sizes.filter(([, r]) => r.over || !r.left || !r.right || r.small.length);
    t(`phone ${w}px: every account screen fits, with 44px touch targets`, bad.length === 0, JSON.stringify(bad));
    await ctx.close();
  }
  console.log(`\npage errors: ${errs.length} ${errs.slice(0, 3)}`);
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
