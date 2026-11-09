const { chromium } = require('playwright');
const makeMock = require('../../lowstakes/test/browser/mock-supabase.cjs');
const SBURL = 'https://pupyykzrfbuimvuwohya.supabase.co';
const BASE = 'http://localhost:8080/lowstakes/';
const MOCKSB = `http://127.0.0.1:${process.env.SB_PORT || 54399}`;
const WORKER = `ws://127.0.0.1:${process.env.WPORT || 8788}`;
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };
const wal = async (id) => (await fetch(`${MOCKSB}/__/wallet/${id}`)).json();

// the page-side Supabase (auth and account screens), pre-loaded with a signed-in player
function pageMock() {
  const m = makeMock();
  for (const [id, email, name, tok] of [[A, 'alice@x.com', 'Alice_1', 'tok-alice'], [B, 'bob@x.com', 'Bob_22', 'tok-bob']]) {
    const u = { id, email, confirmed: true }; m.users.set(email, u); m.byId.set(id, u);
    m.profiles.set(id, { username: name, email, balance: 20000, changes: 0 });
    m.access.set(tok, id); m.refresh.set('rt-' + tok, id);
  }
  // Carol has a Google account but has not picked a username yet (a brand-new friend following an invite link).
  const cu = { id: C, email: 'carol@x.com', confirmed: true }; m.users.set('carol@x.com', cu); m.byId.set(C, cu);
  m.access.set('tok-carol', C); m.refresh.set('rt-tok-carol', C);
  return m;
}
async function newCtx(b, mock, tok, { w = 1280, h = 800 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(({ tok }) => {
    localStorage.setItem('ls.age', '18'); localStorage.setItem('ls.adconsent', 'no');
    if (tok) localStorage.setItem('ls.auth', JSON.stringify({ access_token: tok, refresh_token: 'rt-' + tok, expires_at: Date.now() + 3600e3, user: { id: ({ 'tok-alice': '11111111-1111-1111-1111-111111111111', 'tok-bob': '22222222-2222-2222-2222-222222222222', 'tok-carol': '33333333-3333-3333-3333-333333333333' })[tok] } }));
  }, { tok });
  await ctx.route(SBURL + '/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const r = mock.handle(req.method(), req.url(), req.headers(), req.postData());
    return route.fulfill({ status: r.status, headers: { ...cors, ...(r.headers || {}), 'content-type': 'application/json' }, body: r.body === null ? '' : JSON.stringify(r.body) });
  });
  await ctx.route('**/js/config.js*', async (route) => { const res = await route.fetch(); route.fulfill({ response: res, body: (await res.text()).replace(/serverUrl: '[^']*'/, `serverUrl: '${WORKER}'`) }); });
  return ctx;
}
const mine = (p) => p.evaluate(() => { const s = window.lowstakes.state; return s && s.room.players.find((x) => x.id === s.you); });

(async () => {
  const b = await chromium.launch();
  const mock = pageMock();
  const errs = [];
  const ctxA = await newCtx(b, mock, 'tok-alice');
  const pA = await ctxA.newPage(); pA.on('pageerror', (e) => errs.push(e.message));
  await pA.goto(BASE); await wait(1200);
  t('signed in: the landing chip shows the wallet', /Alice_1/.test(await pA.locator('.acct-chip').innerText()) && /20,000/.test(await pA.locator('.acct-chip').innerText()));

  // ---- start a wallet table
  await pA.click('button[data-mode=host]'); await pA.waitForFunction(() => location.hash.startsWith('#/s/'), null, { timeout: 8000 });
  await pA.waitForSelector('.lobby', { timeout: 15000 });
  const code = (await pA.evaluate(() => location.hash)).split('/').pop();
  t('"Start a table" opens a wallet table on the server (#/s/CODE)', /^[A-Z0-9]{5}$/.test(code));
  let me = await mine(pA);
  t('you sit down with your real username and wallet coins', me.name === 'Alice_1' && me.chips === 20000, JSON.stringify(me));
  t('the owner sees the table controls', await pA.locator('[data-act=menu]').count() === 1);
  t('the lobby says everyone plays with wallet coins (no free-chips setting)', /own wallet coins/.test(await pA.locator('.lobby').innerText()) && await pA.locator('[data-set=start]').count() === 0);
  t('the invite link points at the wallet table', /#\/s\//.test(await pA.locator('#invite-link').inputValue()));

  // ---- Bob joins from another browser
  const ctxB = await newCtx(b, mock, 'tok-bob');
  const pB = await ctxB.newPage(); pB.on('pageerror', (e) => errs.push(e.message));
  await pB.goto(BASE + '#/s/' + code); await pB.waitForSelector('.lobby', { timeout: 15000 });
  t('a friend joins by the link and both see each other', (await mine(pB)).name === 'Bob_22' && (await pA.evaluate(() => window.lowstakes.state.room.players.length)) === 2);
  t('the friend is not the owner (no table controls)', await pB.locator('[data-act=menu]').count() === 0);
  await pB.evaluate(() => window.lowstakes.client.send({ t: 'cmd', c: 'setGame', gameId: 'crash' })); await wait(500);
  t('a forged owner command from a non-owner is refused with a notice', (await pA.evaluate(() => window.lowstakes.state.room.gameId)) === null && /Only the table owner/.test(await pB.locator('#toast').innerText()));

  // ---- chat: stays in the chat box for everyone, and a short bubble pops over the sender
  await pA.fill('#chat-input', 'hello Bob, ready for a game?'); await pA.press('#chat-input', 'Enter'); await wait(700);
  t('chat: your message stays in your chat box', /Alice_1\s+hello Bob, ready for a game\?/.test(await pA.locator('#chat-list').innerText()));
  t('chat: and in your friend\'s chat box', /Alice_1\s+hello Bob, ready for a game\?/.test(await pB.locator('#chat-list').innerText()));
  t('chat: the typing box is cleared, ready for the next message', (await pA.inputValue('#chat-input')) === '');
  t('chat: a bubble with the message shows over the sender, for the sender', await pA.locator('#fx .bubble', { hasText: 'hello Bob' }).count() === 1);
  t('chat: and over the sender, for the friend', await pB.locator('#fx .bubble', { hasText: 'hello Bob' }).count() === 1);
  await pB.fill('#chat-input', 'x'.repeat(120)); await pB.press('#chat-input', 'Enter'); await wait(600);
  t('chat: a long message shows only a short bubble', (await pB.locator('#fx .bubble').last().innerText()).length <= 44 && /…$/.test(await pB.locator('#fx .bubble').last().innerText()));
  await wait(3800);
  t('chat: bubbles fade away but the messages stay in the chat box', await pA.locator('#fx .bubble').count() === 0 && /hello Bob/.test(await pA.locator('#chat-list').innerText()));

  // ---- a brand-new friend (Google account, no username yet) opens the invite link: sign-up must end at the table
  const ctxC2 = await newCtx(b, mock, 'tok-carol');
  const pK = await ctxC2.newPage(); pK.on('pageerror', (e) => errs.push(e.message));
  await pK.goto(BASE + '#/s/' + code); await wait(2500);
  t('invite link, new friend: they are asked for a username (not sent to the home page)', await pK.locator('#a-user').count() === 1, (await pK.locator('body').innerText()).slice(0, 160));
  await pK.fill('#a-user', 'Carol_3'); await wait(900); await pK.click('.acct-card button[type=submit]');
  await pK.waitForSelector('.lobby', { timeout: 15000 });
  t('invite link, new friend: after picking a username they land at the table they were invited to', (await pK.evaluate(() => location.hash)) === '#/s/' + code && (await pA.evaluate(() => window.lowstakes.state.room.players.length)) === 3, await pK.evaluate(() => location.hash));
  await pK.close();

  // ---- Alice can't be at two tables
  const pA2 = await ctxA.newPage(); pA2.on('pageerror', (e) => errs.push(e.message));
  await pA2.goto(BASE); await wait(1200);
  await pA2.click('button[data-mode=host]'); await wait(3000);
  t('the same account cannot open a second table', /already at another table/i.test(await pA2.locator('body').innerText()), (await pA2.locator('body').innerText()).slice(0, 200));
  await pA2.close();

  // ---- play roulette for wallet coins
  await pA.click('[data-act=pick][data-game=roulette]'); await pA.click('[data-act=start-game]');
  await pA.waitForSelector('.rl', { timeout: 10000 });
  await pA.click('#dock [data-v="25"]'); await pA.click('[data-spot="red"]'); await wait(300);
  me = await mine(pA);
  t('placing a bet changes the table chips but not the wallet yet', me.chips === 19975 && (await wal(A)).balance === 20000, JSON.stringify(me));
  await pB.waitForSelector('.rl', { timeout: 10000 });
  await pB.click('#dock [data-v="25"]'); await pB.click('[data-spot="black"]', { timeout: 5000 });
  await pB.fill('#chat-input', 'good luck'); await pB.press('#chat-input', 'Enter'); await wait(600);
  t('chat at the roulette table: a bubble shows over the sender in the player strip', await pA.locator('#fx .bubble', { hasText: 'good luck' }).count() === 1);
  await pA.click('[data-act=rl-ready]', { timeout: 5000 });
  await pB.click('[data-act=rl-ready]', { timeout: 5000 });
  await pA.waitForFunction(() => window.lowstakes.state.game.phase === 'result', null, { timeout: 30000 });
  await wait(1500);
  const n = await pA.evaluate(() => window.lowstakes.state.game.result);
  t('one round, with both players bets in it', (await pA.evaluate(() => window.lowstakes.state.game.spinNo)) === 1 && (await pA.evaluate(() => window.lowstakes.state.game.bets.length)) === 2);
  const w = await wal(A);
  me = await mine(pA);
  t(`roulette (${n}) was saved to the wallet and matches the table`, me.chips === w.balance && w.balance === (n === 0 ? 19975 : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n) ? 20025 : 19975), JSON.stringify({ chips: me.chips, wallet: w.balance }));
  t('exactly one ledger entry for the round', w.ledger.length === 1 && w.ledger[0].game === 'roulette');
  t('the header shows the same coins', new RegExp(me.chips.toLocaleString('en-US')).test(await pA.locator('.my-stack').innerText()));

  // ---- leave: balance carries to the landing page and the seat is freed
  mock.profiles.get(A).balance = w.balance; // the real database is shared between the server and the website
  await pA.click('.tool-leave'); await pA.waitForSelector('.landing', { timeout: 8000 }); await wait(2500);
  t('after leaving, the landing chip shows the new balance', new RegExp(w.balance.toLocaleString('en-US')).test(await pA.locator('.acct-chip').innerText()));
  t('leaving frees the one-table seat', (await wal(A)).presence === false);

  // ---- signed out: the old browser-run tables still work
  const ctxC = await newCtx(b, mock, null);
  const pC = await ctxC.newPage(); pC.on('pageerror', (e) => errs.push(e.message));
  await pC.goto(BASE); await wait(800);
  await pC.click('button[data-mode=host]'); await pC.waitForFunction(() => location.hash.startsWith('#/t/'), null, { timeout: 8000 });
  await pC.waitForSelector('.lobby', { timeout: 15000 });
  t('signed out, "Start a table" still opens a browser table with free chips', (await mine(pC)).chips === 1000);
  console.log(`\npage errors: ${errs.length} ${errs.slice(0, 3)}`);
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(1); });
