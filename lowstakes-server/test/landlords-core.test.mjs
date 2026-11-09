import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeWallet, fakeConn } from './helpers.mjs';
import { LandlordsCore, sanitize } from '../src/landlords-core.js';
import { RECONNECT_MS, TURN_MS } from '../src/engine/games/landlords.js';

function setup({ users = 8, balance = 20000, code = 'LLTST' } = {}) {
  const clock = { t: 1_000_000 };
  const wallet = new FakeWallet();
  wallet.clock = () => clock.t;
  for (let i = 1; i <= users; i++) wallet.add(`u${i}`, `Player_${i}`, balance);
  const saves = [];
  const mkCore = () => new LandlordsCore({ code, wallet, now: () => clock.t, onSave: () => saves.push(clock.t) });
  const core = mkCore();
  const conns = {};
  const tick = async (ms = 0, step = 500) => { for (let t = 0; t < ms; t += step) { clock.t += step; core.tick(); await Promise.resolve(); } for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
  const create = async (id = 'u1', fee = 1000, settings = {}) => { conns[id] = fakeConn(); return core.create(conns[id], { id }, { fee, settings }); };
  const join = async (id) => { conns[id] = fakeConn(); return core.connect(conns[id], { id }, { join: true }); };
  const fill = async (n) => { await create(); for (let i = 2; i <= n; i++) assert.equal((await join(`u${i}`)).ok, true); };
  const start = async () => { core.receive('u1', { t: 'lcmd', c: 'start' }); await tick(); };
  return { clock, wallet, core, conns, tick, create, join, fill, start, mkCore, saves };
}
const last = (c) => c.last('ll');

test('creating a table charges the host once, makes a lobby, cleans the settings and refuses bad fees', async () => {
  const s = setup();
  assert.deepEqual(await s.create('u1', 1000, { startCash: 99999, doubleRent: true, bogus: 1 }), { ok: true });
  assert.equal(s.wallet.bal('u1'), 19000); assert.equal(s.core.phase, 'lobby'); assert.equal(s.core.settings.startCash, 1500); assert.equal(s.core.settings.doubleRent, true); assert.ok(!('bogus' in s.core.settings));
  s.core.tick(); const v = last(s.conns.u1); assert.equal(v.phase, 'lobby'); assert.equal(v.fee, 1000); assert.equal(v.pot, 1000); assert.equal(v.you.host, true); assert.equal(v.min, 4); assert.equal(v.max, 6);
  const t = setup(); for (const fee of [-5, 1.5, 7, 'x', null, 999999, NaN]) assert.equal((await t.create('u1', fee)).ok, false, String(fee)); assert.equal(t.wallet.bal('u1'), 20000);
  const p = setup(); p.wallet.users.get('u1').balance = 500; assert.deepEqual(await p.create('u1', 1000), { ok: false, why: 'insufficient_balance' }); assert.equal(p.core.phase, 'new');
  const u = setup(); assert.equal((await u.create()).ok, true); assert.equal((await u.core.create(fakeConn(), { id: 'u2' }, { fee: 100 })).ok, false, 'a table is created once');
});

test('previewing a table charges and seats nobody and shows the fee first', async () => {
  const s = setup(); await s.create('u1', 2500);
  const info = await s.core.peek({ id: 'u2' });
  assert.equal(info.fee, 2500); assert.equal(info.count, 1); assert.equal(info.seated, false); assert.equal(info.balance, 20000); assert.equal(info.full, false); assert.equal(info.started, false); assert.deepEqual(info.names, ['Player_1']);
  assert.equal(s.wallet.bal('u2'), 20000); assert.equal(s.core.members.length, 1);
});

test('joining: needs an explicit join, charges once, refuses full/started tables, and a failed join never charges', async () => {
  const s = setup(); await s.create('u1', 1000);
  assert.deepEqual(await s.core.connect(fakeConn(), { id: 'u2' }, {}), { ok: false, why: 'confirm' }); assert.equal(s.wallet.bal('u2'), 20000);
  assert.equal((await s.join('u2')).ok, true); assert.equal(s.wallet.bal('u2'), 19000);
  const again = await s.core.connect(fakeConn(), { id: 'u2' }, { join: true }); assert.equal(again.ok, true); assert.equal(s.wallet.bal('u2'), 19000, 'reconnecting is free'); assert.equal(s.core.members.length, 2);
  s.wallet.users.get('u3').balance = 999; assert.equal((await s.join('u3')).why, 'insufficient_balance'); assert.equal(s.wallet.bal('u3'), 999); assert.equal(s.core.members.length, 2);
  s.wallet.users.get('u3').balance = 20000;
  s.wallet.failLl = { times: 1, code: 'network' }; assert.equal((await s.join('u3')).ok, false); assert.equal(s.wallet.bal('u3'), 20000, 'a failed call charges nothing'); assert.equal(s.core.members.length, 2);
  for (const id of ['u3', 'u4', 'u5', 'u6']) assert.equal((await s.join(id)).ok, true);
  assert.deepEqual(await s.join('u7'), { ok: false, why: 'full', limit: 6 }); assert.equal(s.wallet.bal('u7'), 20000, 'the seventh player is turned away and not charged');
  await s.start();
  assert.equal((await s.join('u7')).why, 'already_started'); assert.equal(s.wallet.bal('u7'), 20000);
  const back = await s.core.connect(fakeConn(), { id: 'u4' }, {}); assert.equal(back.ok, true, 'a seated player can rejoin a started match');
  assert.equal((await s.core.connect(fakeConn(), { id: 'nobody' }, {})).ok, false);
});

test('ten players race for six seats: exactly six are seated and charged', async () => {
  const s = setup({ users: 10 }); await s.create('u1', 500);
  const results = await Promise.all(Array.from({ length: 9 }, (_, i) => s.join(`u${i + 2}`)));
  assert.equal(results.filter((r) => r.ok).length, 5); assert.equal(s.core.members.length, 6);
  const charged = s.wallet.ledger.filter((l) => l.type === 'landlords_entry').length; assert.equal(charged, 6);
  for (let i = 1; i <= 10; i++) { const seated = s.core.member(`u${i}`); assert.equal(s.wallet.bal(`u${i}`), seated ? 19500 : 20000); }
});

test('starting: only the host, never below four players, and the pot is locked', async () => {
  const s = setup(); await s.fill(3);
  s.core.receive('u1', { t: 'lcmd', c: 'start' }); await s.tick(); assert.equal(s.core.phase, 'lobby'); assert.ok(s.conns.u1.notices().some((n) => /at least 4/.test(n)));
  await s.join('u4'); s.core.receive('u2', { t: 'lcmd', c: 'start' }); await s.tick(); assert.equal(s.core.phase, 'lobby', 'not the host');
  await s.start(); assert.equal(s.core.phase, 'play'); assert.equal(s.core.game.seats.length, 4); s.core.tick();
  const v = last(s.conns.u1); assert.equal(v.phase, 'play'); assert.equal(v.pot, 4000); assert.equal(v.entries, 4);
  assert.equal(s.wallet.matches.get('LLTST').pot, 4000);
  for (const id of ['u1', 'u2', 'u3', 'u4']) assert.equal(s.wallet.bal(id), 19000);
});

test('in-game cash and wallet coins are separate: nothing in the game moves a wallet', async () => {
  const s = setup(); await s.fill(4); await s.start();
  const g = s.core.game; const before = [1, 2, 3, 4].map((i) => s.wallet.bal(`u${i}`));
  g.seat(g.cur().id).cash = 12345; g.props[3].owner = g.seats[1].id; g.seats[1].cash += 777;
  for (let i = 0; i < 30; i++) { const me = g.cur().id; s.core.receive(me, { t: 'lact', a: { type: 'roll' } }); s.core.receive(me, { t: 'lact', a: { type: 'decline' } }); s.core.receive(me, { t: 'lact', a: { type: 'end' } }); await s.tick(2000); }
  assert.deepEqual([1, 2, 3, 4].map((i) => s.wallet.bal(`u${i}`)), before, 'no wallet changed during play');
  assert.ok(!s.wallet.ledger.some((l) => l.type === 'landlords_prize'));
  s.core.tick(); for (const id of ['u1', 'u2', 'u3', 'u4']) assert.ok(last(s.conns[id]).seats.every((x) => typeof x.cash === 'number'));
});

test('game requests go through the sanitiser: nesting, giant arrays, odd keys and bad numbers are refused', async () => {
  assert.throws(() => sanitize({ a: { b: { c: { d: { e: 1 } } } } })); assert.throws(() => sanitize({ x: Array(31).fill(1) })); assert.throws(() => sanitize({ constructor: 1 }));
  assert.throws(() => sanitize(JSON.parse('{"__proto__":{"x":1}}'))); assert.throws(() => sanitize({ n: NaN })); assert.throws(() => sanitize({ n: Infinity })); assert.throws(() => sanitize('x'.repeat(65))); assert.equal(sanitize('11111111-1111-1111-1111-111111111111'), '11111111-1111-1111-1111-111111111111'); assert.throws(() => sanitize(() => 1));
  assert.deepEqual(sanitize({ type: 'trade', give: { props: [1, 3], cash: 10 }, get: { props: [], cash: 0 } }), { type: 'trade', give: { props: [1, 3], cash: 10 }, get: { props: [], cash: 0 } });
  const s = setup(); await s.fill(4); await s.start(); const me = s.core.game.cur().id; const snap = JSON.stringify(s.core.game.snapshot());
  s.core.receive(me, { t: 'lact', a: JSON.parse('{"type":"roll","__proto__":{"x":1}}') }); s.core.receive(me, { t: 'lact', a: { type: 'build', sq: Array(100).fill(1) } }); s.core.receive(me, { t: 'lact' }); s.core.receive(me, 'junk'); s.core.receive(me, null);
  assert.equal(JSON.stringify(s.core.game.snapshot()), snap, 'nothing changed');
  s.core.receive('stranger', { t: 'lact', a: { type: 'roll' } }); assert.equal(JSON.stringify(s.core.game.snapshot()), snap);
});

test('playing a whole match: the last player standing is paid the whole pot exactly once', async () => {
  const s = setup(); await s.fill(5); await s.start();
  const ids = s.core.game.seats.map((x) => x.id);
  for (const id of ids.slice(0, 4)) { s.core.receive(id, { t: 'lcmd', c: 'leave' }); await s.tick(1000); }
  assert.equal(s.core.phase, 'done'); await s.tick(1000);
  const winner = ids[4]; assert.equal(s.core.settle.status, 'paid'); assert.equal(s.core.settle.winner, winner);
  assert.equal(s.wallet.bal(winner), 19000 + 5000); for (const id of ids.slice(0, 4)) assert.equal(s.wallet.bal(id), 19000, 'those who left forfeited their entry');
  await Promise.all([s.core.runSettle(), s.core.runSettle(), s.core.runSettle()]); await s.tick(10_000);
  assert.equal(s.wallet.ledger.filter((l) => l.type === 'landlords_prize').length, 1, 'one prize, however often it is retried'); assert.equal(s.wallet.bal(winner), 24000);
  const v = last(s.conns[winner]); assert.equal(v.phase, 'done'); assert.equal(v.settle.status, 'paid'); assert.equal(v.winner, v.you.seat);
});

test('the payout survives a database outage: it keeps retrying and pays once when the database is back', async () => {
  const s = setup(); await s.fill(4); await s.start(); const ids = s.core.game.seats.map((x) => x.id);
  s.wallet.failLl = { times: 5, code: 'network' };
  for (const id of ids.slice(0, 3)) s.core.receive(id, { t: 'lcmd', c: 'leave' }); await s.tick(1000); // leaving also touches the wallet; those calls may fail too
  await s.tick(60_000, 1000);
  assert.equal(s.core.phase, 'done'); assert.equal(s.core.settle.status, 'paid');
  assert.equal(s.wallet.ledger.filter((l) => l.type === 'landlords_prize').length, 1); assert.equal(s.wallet.bal(ids[3]), 19000 + 4000);
});

test('leaving the lobby refunds you; the host leaving closes the lobby and refunds everyone', async () => {
  const s = setup(); await s.fill(4);
  s.core.receive('u3', { t: 'lcmd', c: 'leave' }); await s.tick(); assert.equal(s.wallet.bal('u3'), 20000); assert.equal(s.core.members.length, 3); assert.ok(s.conns.u3.last('left'));
  s.core.receive('u1', { t: 'lcmd', c: 'leave' }); await s.tick(2000);
  assert.equal(s.core.phase, 'cancelled'); for (const id of ['u1', 'u2', 'u4']) assert.equal(s.wallet.bal(id), 20000, `${id} refunded`);
  assert.equal(s.wallet.ledger.filter((l) => l.type === 'landlords_refund').length, 4, 'one for the player who left, three when the lobby closed');
});

test('the host can remove a player from the lobby (refunded); nobody else can, and not once the game started', async () => {
  const s = setup(); await s.fill(5);
  s.core.receive('u2', { t: 'lcmd', c: 'kick', pid: 'u3' }); await s.tick(); assert.equal(s.core.members.length, 5);
  s.core.receive('u1', { t: 'lcmd', c: 'kick', pid: 'u3' }); await s.tick(); assert.equal(s.core.members.length, 4); assert.equal(s.wallet.bal('u3'), 20000); assert.ok(s.conns.u3.last('kicked'));
  s.core.receive('u1', { t: 'lcmd', c: 'kick', pid: 'u1' }); await s.tick(); assert.equal(s.core.members.length, 4, 'host cannot kick themself');
  await s.start(); s.core.receive('u1', { t: 'lcmd', c: 'kick', pid: 'u2' }); await s.tick(); assert.equal(s.core.members.length, 4);
});

test('disconnect and reconnect: the seat, cash, properties and turn are exactly as they were', async () => {
  const s = setup(); await s.fill(4); await s.start(); const g = s.core.game;
  const target = g.seats[2].id; g.props[6].owner = target; g.seat(target).cash = 4321;
  const c = s.conns[target]; c.open = false; s.core.disconnect(target, c);
  await s.tick(4000); s.core.tick(); const seenBy = last(s.conns[g.seats[0].id]); assert.equal(seenBy.seats[2].connected, false); assert.ok(seenBy.seats[2].dcLeft > 0);
  await s.tick(120_000, 2000);
  const back = fakeConn(); assert.equal((await s.core.connect(back, { id: target }, {})).ok, true);
  s.core.tick(); const v = last(back);
  assert.equal(v.seats[2].connected, true); assert.equal(v.seats[2].cash, g.seat(target).cash); assert.equal(v.props.find((p) => p.sq === 6).owner, 2); assert.equal(v.seats[2].out, false);
  assert.equal(s.wallet.bal(target), 19000, 'reconnecting never charges again');
});

test('gone for more than five minutes: the seat is given up (and the match goes on); the fee is not refunded', async () => {
  const s = setup(); await s.fill(5); await s.start(); const g = s.core.game; const target = g.seats[1].id;
  const c = s.conns[target]; c.open = false; s.core.disconnect(target, c);
  await s.tick(RECONNECT_MS + 3000, 1000);
  assert.equal(g.seat(target).out, true); assert.equal(g.seat(target).outReason, 'abandoned'); assert.equal(s.core.phase, 'play'); assert.equal(s.wallet.bal(target), 19000, 'no automatic refund for dropping out');
  assert.equal(s.wallet.ledger.filter((l) => l.type === 'landlords_refund').length, 0);
});

test('if every player is gone for five minutes the match is cancelled and everyone is refunded, once', async () => {
  const s = setup(); await s.fill(4); await s.start();
  for (const id of ['u1', 'u2', 'u3', 'u4']) { const c = s.conns[id]; c.open = false; s.core.disconnect(id, c); }
  await s.tick(RECONNECT_MS + 5000, 1000); await s.tick(10_000, 1000);
  assert.equal(s.core.phase, 'cancelled'); assert.equal(s.core.settle.status, 'refunded');
  for (const id of ['u1', 'u2', 'u3', 'u4']) assert.equal(s.wallet.bal(id), 20000);
  await Promise.all([s.core.runSettle(), s.core.runSettle()]); for (const id of ['u1', 'u2', 'u3', 'u4']) assert.equal(s.wallet.bal(id), 20000, 'refunded once');
});

test('a lobby member who vanishes for five minutes is removed and refunded; a vanished host closes the lobby', async () => {
  const s = setup(); await s.fill(4);
  let c = s.conns.u3; c.open = false; s.core.disconnect('u3', c); await s.tick(RECONNECT_MS + 2000, 2000); await s.tick(2000);
  assert.equal(s.core.members.length, 3); assert.equal(s.wallet.bal('u3'), 20000);
  c = s.conns.u1; c.open = false; s.core.disconnect('u1', c); await s.tick(RECONNECT_MS + 2000, 2000); await s.tick(3000);
  assert.equal(s.core.phase, 'cancelled'); for (const id of ['u1', 'u2', 'u4']) assert.equal(s.wallet.bal(id), 20000);
});

test('turn timer: five minutes by the server clock, then the server plays; a page refresh does not give more time', async () => {
  const s = setup(); await s.fill(4); await s.start(); const g = s.core.game; const who = g.cur().id;
  await s.tick(200_000, 5000); assert.equal(g.cur().id, who); assert.ok(Math.abs(g.view(who).turnLeft - (TURN_MS - 200_000)) < 6000);
  const c = s.conns[who]; c.open = false; s.core.disconnect(who, c); const again = fakeConn(); await s.core.connect(again, { id: who }, {}); // refresh
  assert.ok(Math.abs(g.view(who).turnLeft - (TURN_MS - 200_000)) < 6000, 'reconnecting does not reset it');
  await s.tick(110_000, 5000); assert.ok(g.rollNo >= 1 || g.cur().id !== who, 'the server played the turn when time ran out');
});

test('a restarted server picks the match up from its snapshot with the same clocks, cash, owners and seats', async () => {
  const s = setup(); await s.fill(4); await s.start(); const g = s.core.game; const who = g.cur().id;
  g.props[6].owner = g.seats[1].id; g.seat(g.seats[1].id).cash = 777; await s.tick(100_000, 5000);
  const snap = JSON.parse(JSON.stringify(s.core.snapshot()));
  const copy = LandlordsCore.restore(snap, { code: 'LLTST', wallet: s.wallet, now: () => s.clock.t });
  assert.equal(copy.phase, 'play'); assert.equal(copy.game.props[6].owner, g.seats[1].id); assert.equal(copy.game.seat(g.seats[1].id).cash, 777);
  assert.ok(Math.abs(copy.game.view(who).turnLeft - g.view(who).turnLeft) < 10, 'the deadline is a server timestamp, not restarted');
  assert.ok(copy.members.every((m) => m.dcAt), 'after a restart nobody is connected: the five minutes to come back start');
  const back = fakeConn(); assert.equal((await copy.connect(back, { id: who }, {})).ok, true); copy.tick(); assert.equal(last(back).phase, 'play'); assert.equal(copy.game.seat(who).dcAt, 0);
  const finished = setup(); await finished.fill(4); await finished.start();
  for (const id of finished.core.game.seats.map((x) => x.id).slice(0, 3)) finished.core.receive(id, { t: 'lcmd', c: 'leave' });
  await finished.tick(5000);
  const done = LandlordsCore.restore(JSON.parse(JSON.stringify(finished.core.snapshot())), { code: 'LLTST', wallet: finished.wallet, now: () => finished.clock.t });
  assert.equal(done.phase, 'done'); assert.equal(done.settle.status, 'paid');
});

test('a snapshot taken between "game over" and "paid" pays the winner once after the restart', async () => {
  const s = setup(); await s.fill(4); await s.start(); const ids = s.core.game.seats.map((x) => x.id);
  s.wallet.failLl = { times: 1000, code: 'network' };
  for (const id of ids.slice(0, 3)) s.core.game.act(id, { type: 'resign' });
  s.core.tick(); await s.tick(2000);
  assert.equal(s.core.phase, 'done'); assert.equal(s.core.settle.status, 'pending');
  const snap = JSON.parse(JSON.stringify(s.core.snapshot())); s.wallet.failLl = null;
  const copy = LandlordsCore.restore(snap, { code: 'LLTST', wallet: s.wallet, now: () => s.clock.t });
  for (let i = 0; i < 10; i++) { s.clock.t += 4000; copy.tick(); await new Promise((r) => setImmediate(r)); }
  assert.equal(copy.settle.status, 'paid'); assert.equal(s.wallet.ledger.filter((l) => l.type === 'landlords_prize').length, 1); assert.equal(s.wallet.bal(ids[3]), 19000 + 4000);
});

test('one table at a time: a player already in a match cannot create or join another', async () => {
  const s = setup(); await s.fill(4);
  const other = new LandlordsCore({ code: 'OTHER', wallet: s.wallet, now: () => s.clock.t });
  assert.deepEqual(await other.create(fakeConn(), { id: 'u2' }, { fee: 100 }), { ok: false, why: 'already_at_table' }); assert.equal(s.wallet.bal('u2'), 19000);
});

test('a free table (fee 0) works and moves no coins at all', async () => {
  const s = setup(); await s.create('u1', 0); for (const id of ['u2', 'u3', 'u4']) await s.join(id); await s.start();
  const ids = s.core.game.seats.map((x) => x.id); for (const id of ids.slice(0, 3)) s.core.game.act(id, { type: 'resign' }); await s.tick(3000);
  assert.equal(s.core.settle.status, 'paid'); assert.ok(s.wallet.ledger.length === 0); for (const id of ['u1', 'u2', 'u3', 'u4']) assert.equal(s.wallet.bal(id), 20000);
});
