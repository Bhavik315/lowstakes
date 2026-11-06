import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../js/core/evaluate.js';
import { basicStrategy, handValue } from '../js/core/blackjack-rules.js';
import { Holdem } from '../js/games/holdem.js';
import { Blackjack } from '../js/games/blackjack.js';
import { Roulette } from '../js/games/roulette.js';

const ev = (s) => evaluate(s.split(' '));

test('hand categories', () => {
  assert.equal(ev('As Ks Qs Js Ts 2d 3c').name, 'Royal flush');
  assert.equal(ev('5s 4s 3s 2s As Kd Kc').name, 'Straight flush, Five high');
  assert.equal(ev('9c 9d 9h 9s 2d 3c 4h').name, 'Four Nines');
  assert.equal(ev('Kc Kd Kh 7s 7d 7c 2h').name, 'Full house, Kings over Sevens');
  assert.equal(ev('Ah 9h 4h 3h 2h Kd Kc').name, 'Flush, Ace high');
  assert.equal(ev('Ad 2c 3h 4s 5d 9c Kh').name, 'Straight, Five high');
  assert.equal(ev('Td Jc Qh Ks Ad 2c 3h').name, 'Straight, Ace high');
  assert.equal(ev('7d 7c 7h Ks 2d 3c 9h').name, 'Three Sevens');
  assert.equal(ev('Ad Ac 4h 4s 3d 3c 9h').name, 'Two pair, Aces and Fours');
  assert.equal(ev('Jd Jc 4h 8s 3d Ac 9h').name, 'Pair of Jacks');
  assert.equal(ev('Ad Jc 4h 8s 3d Tc 9h').name, 'Ace high');
});

test('hand ordering and kickers', () => {
  assert.ok(ev('Ad Ac Kh 8s 3d 2c 4h').score > ev('Ad Ac Qh 8s 3d 2c 4h').score);
  assert.equal(ev('Ad Ac Kh Ks 3d 2c Qh').score, ev('Ad Ac Kh Ks 3d 2c Qs').score);
  assert.ok(ev('2d 3c 4h 5s 6d Kc Kh').score > ev('Ad 2c 3h 4s 5d Kc Kh').score);
  assert.ok(ev('2h 2d 2c 3s 3d').score < ev('2h 2d 2c 4s 4d').score);
  assert.equal(ev('Ad Ac Kh Ks 3d').best.length, 5);
});

test('blackjack rules', () => {
  assert.deepEqual(handValue(['As', '6d']), { total: 17, soft: true });
  assert.deepEqual(handValue(['As', '6d', 'Kc']), { total: 17, soft: false });
  assert.equal(basicStrategy(['8s', '8d'], 'Td', true, true), 'split');
  assert.equal(basicStrategy(['6s', '5d'], '6d', true, true), 'double');
  assert.equal(basicStrategy(['Ts', '6d'], '7d', true, true), 'hit');
  assert.equal(basicStrategy(['Ts', '6d'], '6c', true, true), 'stand');
  assert.equal(basicStrategy(['As', '7d'], '9c', true, true), 'hit');
});

function makeRoom(n, bots = true) {
  const room = { players: [], rebuy(id) { const p = room.players.find((x) => x.id === id); p.chips += 1000; } };
  for (let i = 0; i < n; i++) room.players.push({ id: 'p' + i, name: 'P' + i, chips: 1000, bot: bots, connected: true, style: Math.random() });
  return room;
}

function run(engine, ms, clock) {
  for (let t = 0; t < ms; t += 50) { clock.t += 50; engine.tick(); }
}

test('hold\'em plays many hands with bots and conserves chips', () => {
  for (const n of [2, 3, 6, 9]) {
    const room = makeRoom(n);
    const clock = { t: 0 };
    const g = new Holdem(room, { sb: 5, bb: 10, timer: 0 });
    g.now = () => clock.t;
    g.jobs.forEach((j) => (j.at = 0));
    let lastHand = 0;
    let rebuys = 0;
    const origRebuy = room.rebuy;
    room.rebuy = (id) => { rebuys++; origRebuy(id); };
    run(g, 1000 * 60 * 6, clock);
    assert.ok(g.handNo > 8, `played ${g.handNo} hands with ${n}`);
    // chips conserved between hands
    while (g.phase !== 'waiting' && g.phase !== 'handover') run(g, 50, clock);
    if (g.phase === 'handover') {
      const total = room.players.reduce((a, p) => a + p.chips, 0);
      assert.equal(total, (n + rebuys) * 1000);
    }
    lastHand = g.handNo;
  }
});

test('hold\'em human flow with fold timeout and views hide cards', () => {
  const room = makeRoom(3, false);
  const clock = { t: 0 };
  const g = new Holdem(room, { sb: 5, bb: 10, timer: 5 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  run(g, 3000, clock);
  assert.equal(g.phase, 'betting');
  const v = g.view('p0');
  const other = v.seats.find((s) => s.pid !== 'p0');
  assert.deepEqual(other.cards, ['??', '??']);
  assert.equal(v.seats.find((s) => s.pid === 'p0').cards.length, 2);
  const actor = v.toAct;
  run(g, 6000, clock);
  assert.notEqual(g.view('p0').toAct, actor);
});

test('hold\'em side pots', () => {
  const room = makeRoom(3, false);
  room.players[0].chips = 50; room.players[1].chips = 200; room.players[2].chips = 1000;
  const clock = { t: 0 };
  const g = new Holdem(room, { sb: 5, bb: 10, timer: 0 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  run(g, 3000, clock);
  // everyone shoves / calls
  for (let i = 0; i < 6 && g.phase === 'betting'; i++) {
    const pid = g.view('x').toAct;
    if (!pid) break;
    const L = g.legal(g.seats.find((s) => s.pid === pid));
    if (L.canRaise) g.handle(pid, { type: 'raise', to: L.maxTo });
    else g.handle(pid, { type: 'call' });
  }
  for (let k = 0; k < 400 && g.phase !== 'handover'; k++) run(g, 50, clock);
  const total = room.players.reduce((a, p) => a + p.chips, 0);
  assert.equal(total, 1250);
  assert.ok(g.results.pots.length >= 2, 'has a side pot');
});

test('blackjack rounds with bots and a human', () => {
  const room = makeRoom(4);
  room.players[0].bot = false;
  const clock = { t: 0 };
  const g = new Blackjack(room, { timer: 3 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  for (let r = 0; r < 25; r++) {
    run(g, 3000, clock);
    if (g.phase === 'betting') { g.handle('p0', { type: 'bet', amount: 50 }); g.handle('p0', { type: 'ready' }); }
    run(g, 30000, clock);
  }
  assert.ok(g.round >= 20, `rounds ${g.round}`);
  const v = g.view('p0');
  assert.equal(v.game, 'blackjack');
});

test('roulette pays correctly', () => {
  const room = makeRoom(2, false);
  const clock = { t: 0 };
  const g = new Roulette(room, {});
  g.now = () => clock.t;
  g.handle('p0', { type: 'bet', spot: 'n:17', amount: 10 });
  g.handle('p0', { type: 'bet', spot: 'red', amount: 10 });
  g.handle('p1', { type: 'bet', spot: 'black', amount: 10 });
  g.handle('p0', { type: 'ready' });
  g.handle('p1', { type: 'ready' });
  assert.equal(g.phase, 'spinning');
  g.result = 17;
  run(g, 8000, clock);
  assert.equal(g.phase, 'result');
  assert.equal(room.players[0].chips, 1000 - 20 + 360);
  assert.equal(room.players[1].chips, 1000 - 10 + 20);
});
