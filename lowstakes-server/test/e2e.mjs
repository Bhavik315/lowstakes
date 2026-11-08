// End to end through the real Workers runtime (wrangler dev / workerd): real WebSockets, a Durable Object, and a
// stand-in Supabase over HTTP. Started by test/e2e.sh. Not part of `npm test`.
import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeWallet } from './helpers.mjs';

const SB_PORT = Number(process.env.SB_PORT || 54399);
const WORKER = process.env.WORKER_URL || 'ws://127.0.0.1:8788';
const ORIGIN = 'http://localhost:8080';
const wallet = new FakeWallet();
wallet.add('11111111-1111-1111-1111-111111111111', 'Alice_1', 20000);
wallet.add('22222222-2222-2222-2222-222222222222', 'Bob_22', 20000);
const TOKENS = { 'tok-alice': '11111111-1111-1111-1111-111111111111', 'tok-bob': '22222222-2222-2222-2222-222222222222' };
const seen = { secretHeaderOnRpc: 0, rpcCalls: 0, userCalls: 0 };

const sb = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/auth/v1/user') {
      seen.userCalls++;
      const id = TOKENS[(req.headers.authorization || '').replace('Bearer ', '')];
      return id ? send(200, { id, email: id + '@x.com' }) : send(401, { msg: 'bad jwt' });
    }
    const m = /^\/rest\/v1\/rpc\/(\w+)$/.exec(req.url);
    if (!m) return send(404, {});
    seen.rpcCalls++;
    if (req.headers.apikey === 'test-secret') seen.secretHeaderOnRpc++;
    if (req.headers.apikey !== 'test-secret') return send(401, { message: 'permission denied' });
    const a = JSON.parse(body || '{}');
    try {
      if (m[1] === 'join_table') return send(200, await wallet.join(a.p_user, a.p_code, a.p_game));
      if (m[1] === 'leave_table') { await wallet.leave(a.p_user, a.p_code); return send(200, null); }
      if (m[1] === 'touch_table') { await wallet.touch(a.p_user, a.p_code); return send(200, null); }
      if (m[1] === 'settle_round') return send(200, await wallet.settle(a.p_items));
      if (m[1] === 'account_json') return send(200, { balance: await wallet.balance(a.p_user) });
    } catch (e) { return send(400, { message: e.code || 'error' }); }
    send(404, {});
  });
});
test.before(() => new Promise((r) => sb.listen(SB_PORT, '127.0.0.1', r)));
test.after(() => sb.close());

const RUN = Math.random().toString(36).replace(/[^a-z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
const code5 = (n) => `${n}${RUN}`.slice(0, 5); // a fresh table code per run (5 characters)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client(code, token, { origin = ORIGIN, create = true } = {}) {
  const ws = new WebSocket(`${WORKER}/ws/${code}`, { headers: { Origin: origin } });
  const c = { ws, msgs: [], closed: false, closeCode: 0 };
  ws.addEventListener('message', (e) => c.msgs.push(JSON.parse(e.data)));
  ws.addEventListener('close', (e) => { c.closed = true; c.closeCode = e.code; });
  c.opened = new Promise((res) => { ws.addEventListener('open', res); ws.addEventListener('error', res); });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.last = (t) => [...c.msgs].reverse().find((m) => m.t === t);
  c.until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn(c)) return true; await wait(50); } return false; };
  if (token !== null) c.opened.then(() => c.send({ t: 'hello', token, create }));
  return c;
}

test('health check and origin rule', async () => {
  const h = await fetch(WORKER.replace('ws', 'http') + '/health');
  assert.equal((await h.json()).ok, true);
  const ws = new WebSocket(`${WORKER}/ws/${code5('O1')}`, { headers: { Origin: 'https://evil.example' } });
  const outcome = await new Promise((res) => { ws.addEventListener('open', () => res('open')); ws.addEventListener('error', () => res('refused')); ws.addEventListener('close', () => res('refused')); setTimeout(() => res('timeout'), 4000); });
  assert.equal(outcome, 'refused', 'a foreign website cannot open a table');
  assert.equal(wallet.presence.size, 0);
});

test('a bad token is rejected and nothing is seated', async () => {
  const c = client(code5('A1'), 'tok-nobody');
  await c.until((x) => x.last('reject'));
  assert.equal(c.last('reject').why, 'auth');
  assert.equal(wallet.presence.size, 0);
});

test('opening a table code that does not exist is refused unless you are creating it', async () => {
  const c = client(code5('N1'), 'tok-alice', { create: false });
  await c.until((x) => x.last('reject'));
  assert.equal(c.last('reject').why, 'notfound');
  assert.equal(wallet.presence.size, 0, 'nothing was seated');
});

test('a signed-in player sits down with their real username and balance', async () => {
  const c = client(code5('R1'), 'tok-alice');
  assert.ok(await c.until((x) => x.last('state')));
  const st = c.last('state');
  assert.equal(st.you, '11111111-1111-1111-1111-111111111111');
  const me = st.room.players.find((p) => p.id === st.you);
  assert.equal(me.name, 'Alice_1');
  assert.equal(me.chips, 20000);
  assert.equal(st.room.hostId, st.you, 'the first player owns the table');
  assert.equal(st.room.server, true);
  c.send({ t: 'bye' });
  await c.until((x) => x.closed || wallet.presence.size === 0, 3000);
  await wait(300);
});

test('a full roulette round over a real websocket settles into the wallet', async () => {
  const c = client(code5('R2'), 'tok-alice');
  await c.until((x) => x.last('state'));
  c.send({ t: 'cmd', c: 'setGame', gameId: 'roulette' });
  await c.until((x) => x.last('state') && x.last('state').room.gameId === 'roulette');
  c.send({ t: 'act', a: { type: 'bet', spot: 'red', amount: 100 } });
  c.send({ t: 'act', a: { type: 'bet', spot: 'black', amount: 100 } }); // one of them always wins, one always loses (unless 0)
  c.send({ t: 'act', a: { type: 'ready' } });
  assert.ok(await c.until((x) => x.last('state').game.phase === 'spinning'), 'spinning');
  assert.equal(wallet.bal('11111111-1111-1111-1111-111111111111'), 20000, 'nothing written while the ball rolls');
  assert.ok(await c.until((x) => x.last('state').game.phase === 'result', 20000), 'result');
  await wait(1500);
  const n = c.last('state').game.result;
  const after = wallet.bal('11111111-1111-1111-1111-111111111111');
  assert.equal(after, n === 0 ? 19800 : 20000, `balance after number ${n}`);
  const me = c.last('state').room.players[0];
  assert.equal(me.chips, after, 'the table shows what the wallet says');
  c.send({ t: 'bye' });
  await wait(500);
});

test('a second account cannot sit at two tables, and bad input never reaches the wallet', async () => {
  const a = client(code5('S1'), 'tok-bob'); await a.until((x) => x.last('state'));
  const b = client(code5('S2'), 'tok-bob'); await b.until((x) => x.last('reject'));
  assert.equal(b.last('reject').why, 'already_at_table');
  a.send({ t: 'cmd', c: 'setGame', gameId: 'roulette' });
  await a.until((x) => x.last('state').room.gameId === 'roulette');
  for (const bad of [{ type: 'bet', spot: 'red', amount: 1e12 }, { type: 'bet', spot: 'red', amount: -5 }, { type: 'bet', spot: 'red', amount: 'x' }, 'str', null, { type: 'payout', amount: 1e9 }]) a.send({ t: 'act', a: bad });
  a.ws.send('not json'); a.ws.send('x'.repeat(10000));
  await wait(500);
  assert.equal(wallet.bal('22222222-2222-2222-2222-222222222222'), 20000);
  assert.equal(a.closed, false, 'junk does not crash the table');
  a.send({ t: 'bye' });
  await wait(500);
});

test('the secret key reaches the database only from the server, never to a browser', async () => {
  assert.ok(seen.rpcCalls > 0 && seen.secretHeaderOnRpc === seen.rpcCalls);
  assert.ok(seen.userCalls > 0);
});
