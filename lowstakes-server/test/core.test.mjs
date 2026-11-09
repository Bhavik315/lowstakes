import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, fakeConn, FakeWallet } from './helpers.mjs';
import { held, GAME_LIMITS, TableCore } from '../src/core.js';
import { keepAlive } from '../src/keepalive.js';

const inv = (t) => t.assert; // (placeholder to keep imports tidy)

// Wallet == the number the table shows, for everybody, once results have been saved.
const synced = (s) => {
  for (const p of s.core.humans()) assert.equal(s.wallet.bal(p.id), p.chips, `${p.name}: wallet ${s.wallet.bal(p.id)} vs table ${p.chips}`);
};

test('seating: username and balance come from the database, not the player', async () => {
  const s = setup();
  const r = await s.join('u1');
  assert.equal(r.ok, true);
  const p = s.core.player('u1');
  assert.equal(p.name, 'Alice_1');
  assert.equal(p.chips, 20000);
  assert.equal(s.core.ownerId, 'u1');
  assert.deepEqual((await s.join('ghost')), { ok: false, why: 'not_registered' });
});

test('seating: one table at a time per account, released by leaving', async () => {
  const s = setup();
  await s.join('u1');
  const other = new TableCore({ code: 'OTHER', wallet: s.wallet, now: () => s.clock.t });
  const r = await other.connect(fakeConn(), { id: 'u1' });
  assert.deepEqual(r, { ok: false, why: 'already_at_table' });
  s.core.receive('u1', { t: 'bye' });
  await s.advance(200);
  assert.equal(s.core.player('u1'), undefined, 'seat released');
  assert.equal((await other.connect(fakeConn(), { id: 'u1' })).ok, true);
});

test('seating: tables are capped per game, with a clear refusal', async () => {
  const s = setup({ users: Array.from({ length: 14 }, (_, i) => [`u${i}`, `Player_${i}`, 5000]) });
  await s.join('u0');
  assert.equal(s.core.setGame('blackjack').ok, true);
  for (let i = 1; i < 7; i++) assert.equal((await s.join(`u${i}`)).ok, true);
  const full = await s.join('u7');
  assert.deepEqual(full, { ok: false, why: 'full', game: 'blackjack', limit: 7 });
  assert.equal(s.core.addBot().ok, false);
  assert.match(s.core.addBot().message, /Blackjack seats 7/);
  // a game with a smaller limit than the table is refused until people leave
  s.core.endGame();
  assert.equal(s.core.setGame('roulette').ok, true);
  for (let i = 0; i < 3; i++) assert.equal(s.core.addBot().ok, true); // 10 seated now
  assert.equal(s.core.setGame('holdem').ok, false);
  assert.match(s.core.setGame('holdem').message, /seats 9, but 10 are at the table/);
  assert.equal(GAME_LIMITS.crash, 12);
});

test('roulette: a win and a loss are saved to the wallet once each', async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000], ['u2', 'Bob_22', 20000]] });
  await s.join('u1'); await s.join('u2');
  s.core.setGame('roulette');
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'n:17', amount: 100 } });
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'black', amount: 100 } });
  s.core.receive('u2', { t: 'act', a: { type: 'bet', spot: 'n:5', amount: 250 } });
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  s.core.receive('u2', { t: 'act', a: { type: 'ready' } });
  await s.advance(100);
  assert.equal(s.core.engine.phase, 'spinning');
  assert.equal(s.wallet.bal('u1'), 20000, 'nothing written while the round is running');
  s.core.engine.result = 17; // pin the spin (black 17): u1 wins 35:1 on the number and 1:1 on black
  await s.advance(8000);
  assert.equal(s.core.engine.phase, 'result');
  await s.advance(300);
  assert.equal(s.wallet.bal('u1'), 20000 + 3500 + 100);
  assert.equal(s.wallet.bal('u2'), 20000 - 250);
  synced(s);
  assert.equal(s.wallet.ledger.length, 2);
  await s.advance(6000); // next betting phase: nothing more is written
  assert.equal(s.wallet.ledger.length, 2);
});

test('the browser cannot make the server pay: bad or oversized actions change nothing', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  const bad = [
    { type: 'bet', spot: 'red', amount: 1e9 }, { type: 'bet', spot: 'red', amount: -500 }, { type: 'bet', spot: 'red', amount: NaN },
    { type: 'bet', spot: 'red', amount: '100; drop table' }, { type: 'bet', spot: 'nope', amount: 10 }, { type: 'payout', amount: 1e9 },
    { type: 'bet', spot: 'red', amount: 20001 },
  ];
  for (const a of bad) s.core.receive('u1', { t: 'act', a });
  s.core.receive('u1', { t: 'act', a: 'not an object' });
  s.core.receive('u1', { t: 'cmd', c: 'setGame', gameId: 'crash' }); // owner is allowed, harmless
  s.core.receive('u1', { t: 'credit', amount: 1e9 });
  s.core.receive('u1', { t: 'rebuy' });
  await s.advance(500);
  assert.equal(s.wallet.bal('u1'), 20000);
  assert.equal(s.core.player('u1').chips, 20000);
  assert.equal(s.wallet.ledger.length, 0);
  assert.match(s.conns.u1.notices().join(' '), /Free rebuys are off/);
});

test('only the owner can run the table; settings are limited to the allowed options', async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000], ['u2', 'Bob_22', 20000]] });
  await s.join('u1'); await s.join('u2');
  s.core.receive('u2', { t: 'cmd', c: 'setGame', gameId: 'crash' });
  assert.equal(s.core.gameId, null);
  assert.match(s.conns.u2.notices().join(' '), /Only the table owner/);
  s.core.receive('u1', { t: 'cmd', c: 'setGame', gameId: 'crash' });
  assert.equal(s.core.gameId, 'crash');
  s.core.receive('u1', { t: 'cmd', c: 'updateSettings', patch: { crash: { min: 25, betTime: 999 }, start: 999999, roulette: { min: -1 } } });
  assert.equal(s.core.room.settings.crash.min, 25);
  assert.equal(s.core.room.settings.crash.betTime, 15, 'not an allowed option, so ignored');
  assert.equal(s.core.room.settings.start, 1000);
  s.core.receive('u1', { t: 'cmd', c: 'removePlayer', pid: 'u1' });
  assert.ok(s.core.player('u1'), 'the owner cannot remove themselves');
  s.core.receive('u1', { t: 'cmd', c: 'removePlayer', pid: 'u2' });
  assert.equal(s.core.player('u2'), undefined);
  assert.ok(s.conns.u2.sent.some((m) => m.t === 'kicked'));
});

test('crash: a cash-out is saved at once, a bust when the rocket goes', async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000], ['u2', 'Bob_22', 20000]] });
  await s.join('u1'); await s.join('u2');
  s.core.setGame('crash');
  const act = (id, a) => s.core.receive(id, { t: 'act', a });
  act('u1', { type: 'add', amount: 1000 }); act('u2', { type: 'add', amount: 500 });
  act('u1', { type: 'ready' }); act('u2', { type: 'ready' });
  await s.advance(100);
  assert.equal(s.core.engine.phase, 'running');
  s.core.engine.crash = 3;
  await s.advance(9000); // ~2.1x
  act('u1', { type: 'cashout' });
  await s.advance(300);
  const won = s.wallet.bal('u1') - 20000;
  assert.ok(won > 900 && won < 1300, `cashed out for a gain of about 1.1x-ish (${won})`);
  assert.equal(s.wallet.bal('u2'), 20000, 'u2 is still riding: nothing saved yet');
  for (let i = 0; i < 400 && s.core.engine.phase !== 'crashed'; i++) await s.advance(100); // crash at 3x
  assert.equal(s.core.engine.phase, 'crashed');
  await s.advance(300);
  assert.equal(s.wallet.bal('u2'), 19500);
  synced(s);
  assert.equal(s.wallet.ledger.length, 2);
});

test('blackjack: rounds settle and the wallet always matches the table', async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000]] });
  await s.join('u1');
  s.core.setGame('blackjack');
  for (let r = 0; r < 6; r++) {
    s.core.receive('u1', { t: 'act', a: { type: 'add', amount: 100 } });
    s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
    for (let i = 0; i < 400 && s.core.engine.phase !== 'settle'; i++) {
      await s.advance(100);
      const e = s.core.engine;
      if (e.phase === 'insurance') s.core.receive('u1', { t: 'act', a: { type: 'decline' } });
      if (e.phase === 'playing' && e.turn && e.seats[e.turn.seat].pid === 'u1' && !e.locked) s.core.receive('u1', { t: 'act', a: { type: 'stand' } });
    }
    await s.advance(500);
    synced(s);
    await s.advance(6000);
  }
  assert.ok(s.wallet.bal('u1') >= 0);
  assert.ok(s.core.engine.round >= 6);
});

test("hold'em: two humans heads-up, the wallet changes are zero-sum", async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000], ['u2', 'Bob_22', 20000]] });
  await s.join('u1'); await s.join('u2');
  s.core.setGame('holdem');
  const act = (id) => {
    const e = s.core.engine;
    const v = e.view(id);
    if (!v.you || !v.you.myTurn) return false;
    const L = v.you.legal || {};
    return s.core.receive(id, { t: 'act', a: { type: L.canCheck ? 'check' : 'call' } }), true;
  };
  for (let i = 0; i < 6000; i++) {
    await s.advance(100); act('u1'); act('u2');
    if (s.core.engine.handNo >= 3 && ['handover', 'waiting'].includes(s.core.engine.phase)) break;
  }
  assert.ok(s.core.engine.handNo >= 3, 'hands were played');
  await s.advance(500); // the last hand is over: its result has been saved
  synced(s);
  assert.equal(s.wallet.bal('u1') + s.wallet.bal('u2'), 40000, 'no coin is created or destroyed between two humans');
  assert.ok(s.wallet.ledger.length >= 1);
});

test('a transient database failure is retried and never pays twice', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'red', amount: 400 } });
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  await s.advance(100);
  s.core.engine.result = 32; // red: u1 wins 400
  s.wallet.fail = { times: 3, code: 'network' };
  await s.advance(8000);
  await s.advance(2000);
  assert.equal(s.wallet.bal('u1'), 20400, 'saved after the retries');
  assert.equal(s.wallet.ledger.length, 1, 'exactly one ledger row');
  const settles = s.wallet.calls.filter((c) => c[0] === 'settle');
  assert.ok(settles.length >= 2, 'it retried');
  synced(s);
});

test('if the database refuses a result, the table is corrected from the wallet', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'n:5', amount: 100 } });
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  await s.advance(100);
  s.core.engine.result = 5; // a 3,500 win...
  s.wallet.users.get('u1').balance = 0; // ...but the wallet has meanwhile been emptied elsewhere: the gain cap refuses it
  await s.advance(8500);
  await s.advance(500);
  assert.equal(s.wallet.bal('u1'), 0);
  assert.equal(s.core.player('u1').chips, 0, 'table chips restored from the wallet');
  assert.match(s.conns.u1.notices().join(' '), /could not be saved/);
});

test('leaving mid-round: the seat is kept until the result is saved, then released', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'n:9', amount: 100 } });
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  await s.advance(100);
  s.core.engine.result = 1;
  s.core.receive('u1', { t: 'bye' });
  await s.advance(1000);
  assert.ok(s.core.player('u1'), 'still seated while the ball is rolling');
  await s.advance(8000);
  await s.advance(500);
  assert.equal(s.wallet.bal('u1'), 19900);
  assert.equal(s.core.player('u1'), undefined, 'released after saving');
  assert.equal(s.wallet.presence.has('u1'), false);
});

test('a disconnected player is released after a minute, once nothing is staked', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  s.core.disconnect('u1', s.conns.u1);
  await s.advance(30_000);
  assert.ok(s.core.player('u1'));
  await s.advance(40_000);
  assert.equal(s.core.player('u1'), undefined);
  assert.equal(s.wallet.presence.has('u1'), false);
});

test('reconnecting keeps the same seat, balance and ownership', async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000], ['u2', 'Bob_22', 20000]] });
  await s.join('u1'); await s.join('u2');
  const before = s.core.player('u1').chips;
  s.core.disconnect('u1', s.conns.u1);
  assert.equal(s.core.ownerId, 'u2', 'ownership moves to someone who is here');
  assert.equal((await s.join('u1')).ok, true);
  assert.equal(s.core.humans().length, 2);
  assert.equal(s.core.player('u1').chips, before);
});

test('views never leak other players hidden information or the crash point', async () => {
  const s = setup({ users: [['u1', 'Alice_1', 20000], ['u2', 'Bob_22', 20000]] });
  await s.join('u1'); await s.join('u2');
  s.core.setGame('crash');
  s.core.receive('u1', { t: 'act', a: { type: 'add', amount: 100 } });
  s.core.receive('u1', { t: 'act', a: { type: 'auto', x: 2.5 } });
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  s.core.receive('u2', { t: 'act', a: { type: 'add', amount: 100 } });
  s.core.receive('u2', { t: 'act', a: { type: 'ready' } });
  await s.advance(500);
  const v2 = s.conns.u2.last('state').game;
  assert.equal(v2.crashAt, null);
  assert.equal(v2.bets.find((b) => b.pid === 'u1').auto, null, "another player's auto target is hidden");
  assert.ok(!('crash' in v2) && !/crashPoint/.test(JSON.stringify(s.conns.u2.last('state'))), 'the crash point is not in anything sent to a player');
  assert.ok(v2.mult <= s.core.engine.crash, 'the multiplier shown never passes the hidden crash point');
});

test('a free pack claimed while seated is added to the stack, between rounds or mid-round, and is not counted as a table win', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  // mid-round: a bet is in play, then coins arrive in the wallet from outside the table
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'n:9', amount: 100 } });
  s.wallet.users.get('u1').balance += 5000; // the claim (done by the website, in the database)
  s.core.receive('u1', { t: 'refresh' });
  await s.advance(300);
  assert.equal(s.core.player('u1').chips, 20000 - 100 + 5000, 'the new coins are on the table and the bet is untouched');
  assert.equal(s.core.roomView().players[0].net, 0, 'a top-up is not a winning');
  assert.match(s.conns.u1.notices().join(' '), /5,000 coins added/);
  // the round then settles normally and the wallet matches
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  await s.advance(100);
  s.core.engine.result = 1;
  await s.advance(8300);
  assert.equal(s.wallet.bal('u1'), 25000 - 100);
  synced(s);
  // a refresh with nothing new changes nothing; a refresh can never lower a stack
  s.core.receive('u1', { t: 'refresh' });
  s.wallet.users.get('u1').balance -= 3000;
  s.core.receive('u1', { t: 'refresh' });
  await s.advance(300);
  assert.equal(s.core.player('u1').chips, 24900);
});

test('a refresh that arrives while a result is being saved waits, then applies', async () => {
  const s = setup();
  await s.join('u1');
  s.core.setGame('roulette');
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'n:9', amount: 100 } });
  s.core.receive('u1', { t: 'act', a: { type: 'ready' } });
  await s.advance(100);
  s.core.engine.result = 9; // +3500 at the end
  s.wallet.fail = { times: 2, code: 'network' }; // saving is slow: it needs retries
  await s.advance(8000);
  s.wallet.users.get('u1').balance += 1000;
  s.core.receive('u1', { t: 'refresh' });
  await s.advance(3000);
  assert.equal(s.wallet.bal('u1'), 20000 + 3500 + 1000);
  assert.equal(s.core.player('u1').chips, 24500, 'saved first, then the top-up: nothing lost, nothing counted twice');
  synced(s);
});

test('keep-alive: one harmless database call with the secret key, and it never throws', async () => {
  const calls = [];
  const ok = await keepAlive({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' }, {
    fetchFn: async (url, opts) => { calls.push({ url, key: opts.headers.apikey, body: opts.body }); return { ok: true, json: async () => 35 }; },
  });
  assert.deepEqual(ok, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/rpc/round_gain_cap');
  assert.equal(calls[0].key, 'sb_secret_test');
  assert.ok(!/user|balance|username/i.test(calls[0].body), 'it asks about no player');
  const down = await keepAlive({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'k' }, { fetchFn: async () => { throw new Error('offline'); } });
  assert.deepEqual(down, { ok: false, why: 'network' });
  const unset = await keepAlive({});
  assert.deepEqual(unset, { ok: false, why: 'not configured' });
});

test('roulette: a forged spot like "col:0" (13 numbers, better than fair odds) is refused and costs nothing', async () => {
  const s = setup();
  await s.join('u1');
  assert.equal(s.core.setGame('roulette').ok, true);
  const before = s.core.player('u1').chips;
  for (const spot of ['col:0', 'col:-3', 'dozen:0', 'n:99', 'red:1', 'RED', null, 5]) {
    s.core.receive('u1', { t: 'act', a: { type: 'bet', spot, amount: 100 } });
  }
  assert.equal(s.core.player('u1').chips, before, 'no chips were staked');
  assert.equal(s.core.engine.total('u1'), 0);
  s.core.receive('u1', { t: 'act', a: { type: 'bet', spot: 'col:3', amount: 100 } });
  assert.equal(s.core.engine.total('u1'), 100, 'a real spot still works');
});

test('ad page: only the known ad units are served, from this origin, framed only by the real site', async () => {
  const { adResponse, AD_UNITS } = await import('../src/ads.js');
  const origins = ['https://lowstakes.pages.dev'];
  for (const [key, [w, h]] of Object.entries(AD_UNITS)) {
    const r = adResponse(new URL(`https://x.dev/ad?k=${key}`), origins);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-security-policy'), 'frame-ancestors https://lowstakes.pages.dev');
    const html = await r.text();
    assert.ok(html.includes(`'key' : '${key}'`) && html.includes(`'height' : ${h},'width' : ${w}`) && html.includes(`https://bauval.org/22/${key}`));
    assert.equal((html.match(/<script/g) || []).length, 2, 'exactly the two Adsterra scripts');
  }
  for (const bad of ['', 'x', '__proto__', 'constructor', "13f9a0a286e616b330d213ba508671bc'+alert(1)+'", '13f9a0a286e616b330d213ba508671bc ', '../../etc']) {
    assert.equal(adResponse(new URL(`https://x.dev/ad?k=${encodeURIComponent(bad)}`), origins), null, JSON.stringify(bad));
  }
  assert.equal(adResponse(new URL('https://x.dev/ad'), origins), null);
  assert.equal(adResponse(new URL(`https://x.dev/ad?k=82f13974043f0644568ea90a3ed5d459`), []).headers.get('content-security-policy'), "frame-ancestors 'none'");
});
