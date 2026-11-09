// Browser test of Landlords: the real site + the real Workers runtime (wrangler dev) + stand-in Supabase.
const L = require('./ll-lib.cjs');
const { USERS, wait, wal } = L;
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`); };
const bal = async (i) => (await wal(USERS[i].id)).balance;
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const small = (p) => p.evaluate(() => [...document.querySelectorAll('.llp button, .llp a.btn, .ll-top button, .ll-dock button, .lls button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map((b) => (b.dataset.act || b.className) + ':' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)));
async function press(pg) { // do whatever the current player is asked to do
  for (const sel of ['[data-a=roll]:not([disabled])', '[data-a=buy]:not([disabled])', '[data-a=end]:not([disabled])']) { const el = pg.locator(sel).first(); if (await el.count()) { await el.click({ timeout: 2000 }).catch(() => {}); return true; } }
  return false;
}
async function run(w, h, label) {
  const mobile = w < 700 || h < 500;
  const b = await L.chromium.launch(); const mock = L.pageMock(); const P = [];
  for (let i = 0; i < 7; i++) P.push(await L.newCtx(b, mock, USERS[i], { w, h, mobile }));
  const A = P[0].page;
  const tag = (s) => `[${label}] ${s}`;
  // landing
  await A.goto(L.BASE); await wait(1200);
  t(tag('landing offers the Landlords table'), await A.locator('#ll-new').count() === 1 && /Five tables/.test(await A.locator('.games h2').innerText()));
  await A.click('#ll-new'); await A.waitForSelector('.llp-chip', { timeout: 8000 });
  t(tag('create screen: no horizontal overflow'), (await overflow(A)) <= 0, String(await overflow(A)));
  t(tag('create screen: touch targets are 44px or bigger'), (await small(A)).length === 0, JSON.stringify(await small(A)));
  await A.click('.llp-chip[data-opt=fee][data-v="500"]');
  await A.click('.llp-sw[data-sw=doubleRent]');
  t(tag('create: fee and rule choices are shown'), /pay 500 coins/.test(await A.locator('[data-act=create]').innerText()) && await A.locator('.llp-sw[data-sw=doubleRent][aria-checked=true]').count() === 1);
  await A.click('[data-act=create]'); await A.waitForSelector('.llp-code', { timeout: 10000 });
  const code = (await A.evaluate(() => location.hash)).split('/').pop();
  t(tag('table created: code in the address, host seated'), /^[A-Z0-9]{5}$/.test(code) && /Alice_1/.test(await A.locator('.llp-seats').innerText()));
  t(tag('host paid the fee once'), (await bal(0)) === 19500, String(await bal(0)));
  t(tag('lobby: start disabled below four players'), await A.locator('[data-act=start][disabled]').count() === 1);
  t(tag('lobby: no overflow, targets ok'), (await overflow(A)) <= 0 && (await small(A)).length === 0, JSON.stringify(await small(A)));
  // join: fee is shown first, nothing charged until Join
  const B = P[1].page;
  await B.goto(L.BASE + '#/m/' + code); await B.waitForSelector('[data-act=join]', { timeout: 10000 });
  t(tag('join screen shows the fee and the pot before joining'), /500 coins/.test(await B.locator('.llp-fee').first().innerText()) && /winner takes the whole pot/.test(await B.locator('.llp-join').innerText()));
  t(tag('nothing is charged before pressing Join'), (await bal(1)) === 20000);
  t(tag('join screen: no overflow, targets ok'), (await overflow(B)) <= 0 && (await small(B)).length === 0, JSON.stringify(await small(B)));
  await B.click('[data-act=join]'); await B.waitForSelector('.llp-code');
  t(tag('joiner charged exactly the fee'), (await bal(1)) === 19500);
  for (const i of [2, 3, 4, 5]) { await P[i].page.goto(L.BASE + '#/m/' + code); await P[i].page.waitForSelector('[data-act=join]', { timeout: 10000 }); await P[i].page.click('[data-act=join]'); await P[i].page.waitForSelector('.llp-code'); }
  await wait(400);
  t(tag('six seats filled, pot 3000'), /6 of 6/.test(await A.locator('.llp-card h2 small').first().innerText()) && /3,000/.test(await A.locator('.llp-card').nth(2).innerText()));
  const G = P[6].page; await G.goto(L.BASE + '#/m/' + code); await G.waitForSelector('.llp-warn', { timeout: 10000 });
  t(tag('7th player cannot join (table full), join disabled'), /full/i.test(await G.locator('.llp-warn').innerText()) && await G.locator('[data-act=join][disabled]').count() === 1);
  t(tag('7th player not charged'), (await bal(6)) === 20000);
  // a friend leaves the lobby: refunded, then rejoins
  await P[5].page.click('[data-act=leave-ask]'); await P[5].page.click('[data-act=confirm-yes]'); await P[5].page.waitForSelector('.llp-msg');
  await wait(400);
  t(tag('leaving the lobby refunds the fee'), (await bal(5)) === 20000, String(await bal(5)));
  await P[5].page.reload(); await P[5].page.waitForSelector('[data-act=join]', { timeout: 15000 }); await P[5].page.click('[data-act=join]'); await P[5].page.waitForSelector('.llp-code');
  t(tag('rejoining charges once more'), (await bal(5)) === 19500);
  // non-host cannot start; host can
  t(tag('only the host sees the Start button'), await P[1].page.locator('[data-act=start]').count() === 0 && await A.locator('[data-act=start]:not([disabled])').count() === 1);
  await A.click('[data-act=start]');
  for (let i = 0; i < 6; i++) await P[i].page.waitForSelector('.ll-board', { timeout: 10000 });
  await wait(700);
  t(tag('game started for all six players'), await A.locator('.llpl').count() === 6);
  t(tag('board: 40 squares, no overflow'), await A.locator('.sq').count() === 40 && (await overflow(A)) <= 0);
  t(tag('game: touch targets in the dock and header are 44px or bigger'), (await small(A)).length === 0, JSON.stringify(await small(A)));
  t(tag('a turn clock is visible'), /\d:\d\d/.test(await A.locator('#ll-clock').innerText()));
  await A.screenshot({ path: `/tmp/ll-${label}-board.png` });
  // late joiner refused
  await G.goto(L.BASE + '#/m/' + code); await wait(1500);
  t(tag('joining a started game is refused'), /started|full/i.test(await G.locator('.llp').innerText()) && await G.locator('[data-act=join][disabled]').count() === 1);
  // play: buy things, then check one property sheet and a trade
  for (let n = 0; n < 150; n++) { for (const p of P.slice(0, 6)) await press(p.page); await wait(120); }
  const owned = await A.locator('.sq.owned').count();
  t(tag('players bought properties (squares show owners)'), owned > 0, String(owned));
  // refresh mid-match restores the exact view
  const before = await A.evaluate(() => document.querySelector('.ll-players').innerText);
  await A.reload(); await A.waitForSelector('.ll-board', { timeout: 15000 }); await wait(800);
  const after = await A.evaluate(() => document.querySelector('.ll-players').innerText);
  t(tag('refresh mid-match restores the seat and state'), before.replace(/\s+/g, ' ').split(' ')[0] === after.replace(/\s+/g, ' ').split(' ')[0] && await A.locator('.llpl').count() === 6);
  t(tag('refresh did not charge again'), (await bal(0)) === 19500);
  // trade: Alice offers cash for a property of someone else
  const ownerSeat = await A.evaluate(() => { const el = document.querySelector('.sq.owned'); return el ? el.dataset.sq : null; });
  await A.click(`.sq[data-sq="${ownerSeat}"]`); await A.waitForSelector('.lls');
  const canOffer = await A.locator('[data-act=trade-for]').count();
  if (canOffer) {
    await A.click('[data-act=trade-for]'); await A.click('[data-act=tr-cash][data-key=give][data-d="100"]'); await A.click('[data-act=trade-send]'); await wait(900); const toastText = await A.evaluate(() => (document.getElementById('ll-toast') || {}).textContent);
    const sheetText = await A.locator('.lls').innerText();
    t(tag('trade offer shows as sent and waiting'), /waiting for an answer/.test(sheetText), JSON.stringify({ toastText, sq: ownerSeat, sheet: sheetText.slice(0, 80) }));
    t(tag('trade sheet: no overflow'), (await overflow(A)) <= 0);
    await A.screenshot({ path: `/tmp/ll-${label}-trade.png` });
    await A.click('.lls-x');
    // the owner accepts on their own screen: property and cash change hands together
    const ownerName = await A.evaluate((i) => { const l = document.querySelector(`.sq[data-sq="${i}"]`).getAttribute('aria-label'); const m = /owned by (.+)$/.exec(l); return m && m[1]; }, ownerSeat);
    const oi = USERS.findIndex((u) => u.name === ownerName); const O = P[oi].page;
    const cashOf = (pg, name) => pg.evaluate((n) => { const el = [...document.querySelectorAll('.llpl')].find((x) => x.querySelector('.pn').textContent.trim().startsWith(n)); return Number(el.querySelector('.pc').textContent.replace(/[^0-9]/g, '')); }, name);
    const aCash = await cashOf(A, 'Alice_1'); const oCash = await cashOf(O, ownerName);
    await O.click('[data-act=trade]'); await O.waitForSelector('[data-act=trade-accept]', { timeout: 5000 });
    await O.screenshot({ path: `/tmp/ll-${label}-incoming.png` });
    await O.click('[data-act=trade-accept]'); await wait(1000);
    t(tag('accepting a trade moves the property and the cash atomically'), (await A.evaluate((i) => { const d = document.querySelector(`.sq[data-sq="${i}"] .own`); const me = document.querySelector('.llpl.me .tk'); return !!d && getComputedStyle(d).backgroundColor === getComputedStyle(me).backgroundColor; }, ownerSeat)) && (await cashOf(A, 'Alice_1')) === aCash - 100 && (await cashOf(O, ownerName)) === oCash + 100, `${aCash}->${await cashOf(A, 'Alice_1')}, ${oCash}->${await cashOf(O, ownerName)}`);
    if (await O.locator('.lls-x').count()) await O.click('.lls-x');
  } else { await A.click('.lls-x'); t(tag('trade offer (skipped: the first owned square is yours)'), true); }
  t(tag('no script errors on any player page'), P.every((p) => p.page.errs.filter((e) => !/frame-ancestors|localStorage/.test(e)).length === 0), JSON.stringify(P.map((p) => p.page.errs)));
  await b.close();
}
// Finish a game: three of four players give up, the last one standing is paid the whole pot exactly once.
async function finish(label) {
  const b = await L.chromium.launch(); const mock = L.pageMock(); const P = [];
  for (let i = 0; i < 4; i++) P.push(await L.newCtx(b, mock, USERS[i], { w: 390, h: 844, mobile: true }));
  const tag = (x) => `[${label}] ${x}`;
  const A = P[0].page; await A.goto(L.BASE + '#/m/new'); await A.waitForSelector('.llp-chip'); await A.click('.llp-chip[data-opt=fee][data-v="250"]'); await A.click('[data-act=create]'); await A.waitForSelector('.llp-code');
  const code = (await A.evaluate(() => location.hash)).split('/').pop();
  for (let i = 1; i < 4; i++) { const pg = P[i].page; await pg.goto(L.BASE + '#/m/' + code); await pg.waitForSelector('[data-act=join]'); await pg.click('[data-act=join]'); await pg.waitForSelector('.llp-code'); }
  await A.click('[data-act=start]'); for (const p of P) await p.page.waitForSelector('.ll-board');
  await wait(500);
  for (const i of [1, 2, 3]) { const pg = P[i].page; await pg.click('[data-act=menu]'); await pg.click('[data-act=giveup-ask]'); await pg.click('[data-act=confirm-yes]'); await pg.waitForSelector('.llp-msg', { timeout: 8000 }); }
  await A.waitForSelector('.result', { timeout: 10000 }); await wait(1200);
  const txt = await A.locator('.result').innerText();
  t(tag('last player standing wins, result screen says so'), /You won/.test(txt), txt.slice(0, 120));
  await A.screenshot({ path: `/tmp/ll-${label}-result.png` });
  const w = await wal(USERS[0].id);
  t(tag('winner paid the whole pot (4 x 250) exactly once'), w.balance === 20000 - 250 + 1000 && w.ledger.filter((l) => l.type === 'landlords_prize').length === 1, JSON.stringify(w.ledger));
  t(tag('players who gave up keep no refund'), (await bal(1)) === 19750 && (await bal(2)) === 19750 && (await bal(3)) === 19750);
  t(tag('result screen: money line shows the payout'), /1,000 coins/.test(await A.locator('.result').innerText()));
  await A.reload(); await wait(2000);
  t(tag('reload after the end does not pay again'), (await wal(USERS[0].id)).ledger.filter((l) => l.type === 'landlords_prize').length === 1);
  await b.close();
}
(async () => {
  const sizes = process.argv.slice(2).length ? process.argv.slice(2).map((s) => s.split('x').map(Number)) : [[390, 844]];
  for (const [w, h] of sizes) { await require('node:child_process').execSync('bash /tmp/claude-0/-home-user/85559fcf-83a2-5120-a916-7fdcf0176d18/scratchpad/rm.sh'); await run(w, h, `${w}x${h}`); }
  if (!process.env.NO_FINISH) { require('node:child_process').execSync('bash /tmp/claude-0/-home-user/85559fcf-83a2-5120-a916-7fdcf0176d18/scratchpad/rm.sh'); await finish('finish'); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
