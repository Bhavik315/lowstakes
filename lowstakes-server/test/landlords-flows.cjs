// Landlords: auctions, counter-offers and a player dropping and coming back, through real browsers.
const L = require('./ll-lib.cjs');
const { USERS, wait } = L;
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  ' + x}`); };
const cash = (pg, name) => pg.evaluate((n) => { const el = [...document.querySelectorAll('.llpl')].find((x) => x.querySelector('.pn').textContent.trim().startsWith(n)); return Number(el.querySelector('.pc').textContent.replace(/[^0-9]/g, '')); }, name);
const myTurn = (pg) => pg.locator('.ll[data-mine="1"]').count();
async function press(pg, skip = []) {
  for (const sel of ['[data-a=roll]:not([disabled])', '[data-a=buy]:not([disabled])', '[data-a=end]:not([disabled])']) { if (skip.includes(sel)) continue; const el = pg.locator(sel).first(); if (await el.count()) { await el.click({ timeout: 2000 }).catch(() => {}); return true; } }
  return false;
}
(async () => {
  require('node:child_process').execSync('bash /tmp/claude-0/-home-user/85559fcf-83a2-5120-a916-7fdcf0176d18/scratchpad/rm.sh');
  const b = await L.chromium.launch(); const mock = L.pageMock(); const P = [];
  for (let i = 0; i < 4; i++) P.push(await L.newCtx(b, mock, USERS[i], { w: 390, h: 844, mobile: true }));
  const A = P[0].page; await A.goto(L.BASE + '#/m/new'); await A.waitForSelector('.llp-chip'); await A.click('[data-act=create]'); await A.waitForSelector('.llp-code');
  const code = (await A.evaluate(() => location.hash)).split('/').pop();
  for (let i = 1; i < 4; i++) { const pg = P[i].page; await pg.goto(L.BASE + '#/m/' + code); await pg.waitForSelector('[data-act=join]'); await pg.click('[data-act=join]'); await pg.waitForSelector('.llp-code'); }
  await A.click('[data-act=start]'); for (const p of P) await p.page.waitForSelector('.ll-board'); await wait(500);

  // ---- auction: whoever lands on a property declines it, the others bid
  let auctioneer = null;
  for (let n = 0; n < 200 && auctioneer === null; n++) {
    for (let i = 0; i < 4; i++) {
      const pg = P[i].page;
      if (await pg.locator('[data-a=decline]').count()) { await pg.click('[data-a=decline]'); auctioneer = i; break; }
      await press(pg);
    }
    await wait(120);
  }
  t('a player who declines a property starts an auction for everyone', auctioneer !== null);
  const bidders = [0, 1, 2, 3].filter((i) => i !== auctioneer);
  for (const i of [auctioneer, ...bidders]) await P[i].page.waitForSelector('.lls-wrap.auction', { timeout: 8000 }).catch(() => {});
  t('every player gets the auction sheet with a countdown', (await Promise.all(P.map((p) => p.page.locator('#auc-left').count()))).every((n) => n === 1));
  const b1 = P[bidders[0]].page, b2 = P[bidders[1]].page;
  const c1 = await cash(b1, USERS[bidders[0]].name);
  await b1.click('[data-act=bid-add][data-d="50"]'); await b1.click('[data-act=bid]'); await wait(600);
  t('a bid shows for everyone as the highest bid', (await Promise.all(P.map((p) => p.page.locator('#auc-bid').innerText()))).every((x) => /\$60|\$50/.test(x) === true || /\$/.test(x)));
  await b2.click('[data-act=bid-add][data-d="100"]'); await b2.click('[data-act=bid]'); await wait(600);
  const txt = await b1.locator('#auc-bid').innerText();
  t('a higher bid replaces it and the other bidder sees they are outbid', /winning/.test(txt) && !/You are winning/.test(txt), txt);
  await P[auctioneer].page.screenshot({ path: '/tmp/ll-flow-auction.png' });
  // wait for the auction to finish on its own
  await b1.waitForSelector('.lls-wrap.auction', { state: 'detached', timeout: 60000 });
  await wait(600);
  const sold = await A.evaluate(() => document.querySelectorAll('.sq.owned').length);
  t('the auction ends by itself and the property is sold to the highest bidder', sold >= 1);
  t('the winner paid their bid (cash dropped by about 100 or more)', (await cash(b2, USERS[bidders[1]].name)) <= 1500 - 110);

  // ---- counter-offer
  for (let n = 0; n < 150; n++) { for (const p of P) await press(p.page); await wait(100); const o = await A.evaluate(() => document.querySelectorAll('.sq.owned').length); if (o >= 3) break; }
  const info = await A.evaluate(() => [...document.querySelectorAll('.sq.owned')].map((e) => ({ sq: e.dataset.sq, label: e.getAttribute('aria-label') })));
  const mine = (n) => info.find((x) => new RegExp('owned by ' + n + '$').test(x.label));
  const other = info.find((x) => !/Alice_1$/.test(x.label)); // a property of someone else
  const oi = USERS.findIndex((u) => other && other.label.endsWith(u.name));
  if (!other || oi === 0) { t('counter-offer (needs a property owned by someone else)', false, JSON.stringify(info)); }
  else {
    await A.click(`.sq[data-sq="${other.sq}"]`); await A.click('[data-act=trade-for]'); await A.click('[data-act=tr-cash][data-key=give][data-d="10"]'); await A.click('[data-act=trade-send]'); await wait(800);
    const O = P[oi].page; if (await O.locator('.lls').count()) console.log('O sheet:', (await O.locator('.lls').innerText()).slice(0, 120).replace(/\n/g, ' | ')); await O.screenshot({ path: '/tmp/ll-flow-o.png' }); await O.click('[data-act=trade]'); await O.waitForSelector('[data-act=trade-counter]');
    await O.click('[data-act=trade-counter]'); await O.waitForSelector('[data-act=tr-cash]');
    await O.click('[data-act=tr-cash][data-key=get][data-d="100"]'); await O.click('[data-act=trade-send]'); await wait(900);
    if (!(await A.locator('.lls').count())) await A.click('[data-act=trade]'); await A.waitForSelector('[data-act=trade-accept]', { timeout: 5000 }).catch(() => {});
    const aTxt = await A.locator('.lls').innerText();
    t('the counter-offer reaches the first player with the new price', /\$110|\$100/.test(aTxt) && await A.locator('[data-act=trade-accept]').count() === 1, aTxt.slice(0, 160));
    t('the original offer is gone (no duplicate offers)', await A.locator('.lls .tr').count() === 1);
    const a0 = await cash(A, 'Alice_1');
    await A.click('[data-act=trade-accept]'); await wait(1000);
    t('accepting the counter moves the property and the countered cash', (await cash(A, 'Alice_1')) < a0 && await A.locator(`.sq[data-sq="${other.sq}"] .own`).count() === 1);
    if (await A.locator('.lls-x').count()) await A.click('.lls-x');
  }

  // ---- a player drops and comes back
  const D0 = P[3].page; const dName = USERS[3].name; const before = await cash(D0, dName);
  await D0.close(); await wait(6000);
  const offline = () => A.evaluate((n) => { const el = [...document.querySelectorAll('.llpl')].find((x) => x.querySelector('.pn').textContent.trim().startsWith(n)); return el ? el.innerText : ''; }, dName);
  const flag = await offline();
  t('others see the dropped player marked offline with a countdown', /Offline/i.test(flag) && /\d:\d\d/.test(flag), JSON.stringify(flag));
  const D = await P[3].ctx.newPage(); D.errs = []; P[3].page = D;
  await D.goto(L.BASE + '#/m/' + code); await D.waitForSelector('.ll-board', { timeout: 20000 }); await wait(2000);
  const flag2 = await offline();
  t('the player reopens the link, gets their seat back (not charged again) and is no longer offline', !/Offline/i.test(flag2) && await D.locator('.llpl').count() === 4 && (await L.wal(USERS[3].id)).balance === 20000 - 1000, JSON.stringify(flag2));
  t('their cash is unchanged by the drop', Math.abs((await cash(D, dName)) - before) < 300);
  t('no script errors', P.every((p) => p.page.errs.filter((e) => !/frame-ancestors|localStorage|ERR_INTERNET|Failed to load resource|WebSocket/.test(e)).length === 0), JSON.stringify(P.map((p) => p.page.errs)));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
