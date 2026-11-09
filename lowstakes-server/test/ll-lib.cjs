// Shared helpers for the Landlords browser tests: seven signed-in players, a page-side Supabase stand-in, one context per player.
const { chromium } = require('playwright');
const makeMock = require('../../lowstakes/test/browser/mock-supabase.cjs');
const SBURL = 'https://pupyykzrfbuimvuwohya.supabase.co';
const BASE = process.env.BASE || 'http://localhost:8080/lowstakes/';
const MOCKSB = `http://127.0.0.1:${process.env.SB_PORT || 54399}`;
const WORKER = `ws://127.0.0.1:${process.env.WPORT || 8788}`;
const USERS = [['1', 'alice', 'Alice_1'], ['2', 'bob', 'Bob_22'], ['3', 'carol', 'Carol_3'], ['4', 'dave', 'Dave_4'], ['5', 'erin', 'Erin_5'], ['6', 'finn', 'Finn_6'], ['7', 'gail', 'Gail_7']]
  .map(([d, k, name]) => ({ id: d.repeat(8) + '-' + d.repeat(4) + '-' + d.repeat(4) + '-' + d.repeat(4) + '-' + d.repeat(12), key: k, email: k + '@x.com', name, tok: 'tok-' + k }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const wal = async (id) => (await fetch(`${MOCKSB}/__/wallet/${id}`)).json();
function pageMock() {
  const m = makeMock();
  for (const u of USERS) {
    const o = { id: u.id, email: u.email, confirmed: true }; m.users.set(u.email, o); m.byId.set(u.id, o);
    m.profiles.set(u.id, { username: u.name, email: u.email, balance: 20000, changes: 0 });
    m.access.set(u.tok, u.id); m.refresh.set('rt-' + u.tok, u.id);
  }
  return m;
}
async function newCtx(browser, mock, user, opts = {}) {
  const { w = 390, h = 844, mobile = true } = opts;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  await ctx.addInitScript(({ tok, id }) => {
    localStorage.setItem('ls.age', '18'); localStorage.setItem('ls.adconsent', 'no');
    localStorage.setItem('ls.auth', JSON.stringify({ access_token: tok, refresh_token: 'rt-' + tok, expires_at: Date.now() + 3600e3, user: { id } }));
  }, { tok: user.tok, id: user.id });
  await ctx.route(SBURL + '/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const r = mock.handle(req.method(), req.url(), req.headers(), req.postData());
    return route.fulfill({ status: r.status, headers: { ...cors, ...(r.headers || {}), 'content-type': 'application/json' }, body: r.body === null ? '' : JSON.stringify(r.body) });
  });
  await ctx.route('**/js/config.js*', async (route) => { const res = await route.fetch(); route.fulfill({ response: res, body: (await res.text()).replace(/serverUrl: '[^']*'/, `serverUrl: '${WORKER}'`) }); });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') page.errs.push('console: ' + m.text()); });
  return { ctx, page, user };
}
module.exports = { chromium, USERS, wait, wal, pageMock, newCtx, BASE, MOCKSB };
