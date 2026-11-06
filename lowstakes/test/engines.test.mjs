import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../js/core/evaluate.js';
import { basicStrategy, handValue } from '../js/core/blackjack-rules.js';
import { Holdem } from '../js/games/holdem.js';
import { Blackjack } from '../js/games/blackjack.js';
import { Roulette } from '../js/games/roulette.js';
import { Baccarat } from '../js/games/baccarat.js';
import { Craps } from '../js/games/craps.js';

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
    run(g, 1000 * 60 * 12, clock);
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

// ---------------------------------------------------------------- baccarat
function rig(g, drawOrderCards) {
  g.shoe = drawOrderCards.slice().reverse(); // shoe.pop() yields drawOrderCards in order
}

test('baccarat: player natural beats a non-natural banker', () => {
  const room = makeRoom(2, false);
  const clock = { t: 0 };
  const g = new Baccarat(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  rig(g, ['4h', '2c', '5d', '3s']); // player 4h,5d = 9 natural; banker 2c,3s = 5
  g.handle('p0', { type: 'bet', spot: 'player', amount: 100 });
  g.handle('p1', { type: 'bet', spot: 'banker', amount: 50 });
  g.handle('p1', { type: 'bet', spot: 'tie', amount: 20 });
  g.handle('p0', { type: 'ready' });
  g.handle('p1', { type: 'ready' });
  run(g, 4000, clock);
  assert.equal(g.phase, 'result');
  assert.equal(g.result.winner, 'player');
  assert.equal(g.result.pt, 9);
  assert.equal(g.result.bt, 5);
  assert.equal(room.players[0].chips, 1000 - 100 + 200);
  assert.equal(room.players[1].chips, 1000 - 50 - 20);
});

test('baccarat: pair side bets and natural-8 short-circuits the draw', () => {
  const room = makeRoom(2, false);
  const clock = { t: 0 };
  const g = new Baccarat(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  rig(g, ['9h', 'Th', '9d', '2c']); // player 9h,9d = pair, natural 8; banker Th,2c = 2
  g.handle('p0', { type: 'bet', spot: 'ppair', amount: 10 });
  g.handle('p0', { type: 'bet', spot: 'bpair', amount: 10 });
  g.handle('p1', { type: 'bet', spot: 'player', amount: 50 });
  g.handle('p0', { type: 'ready' });
  g.handle('p1', { type: 'ready' });
  run(g, 4000, clock);
  assert.equal(g.result.playerPair, true);
  assert.equal(g.result.bankerPair, false);
  assert.equal(g.result.winner, 'player');
  assert.equal(room.players[0].chips, 1000 - 10 + 120 - 10); // ppair pays 11:1, bpair loses
  assert.equal(room.players[1].chips, 1000 - 50 + 100);
});

test('baccarat: a tie pushes player and banker bets, and pays the tie bet', () => {
  const room = makeRoom(1, false);
  const clock = { t: 0 };
  const g = new Baccarat(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  rig(g, ['8h', '8d', 'Th', 'Tc']); // player 8h,Th = 8; banker 8d,Tc = 8
  g.handle('p0', { type: 'bet', spot: 'player', amount: 40 });
  g.handle('p0', { type: 'bet', spot: 'banker', amount: 30 });
  g.handle('p0', { type: 'bet', spot: 'tie', amount: 15 });
  g.handle('p0', { type: 'ready' });
  run(g, 4000, clock);
  assert.equal(g.result.winner, 'tie');
  assert.equal(room.players[0].chips, 1000 - 40 - 30 - 15 + 40 + 30 + 135);
});

test('baccarat: banker stands on 3 only when the player drew an 8', () => {
  const room = makeRoom(1, false);
  const clock = { t: 0 };
  const g = new Baccarat(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  rig(g, ['2h', '3c', 'Ts', 'Tc', '8d']); // player 2h,Ts=2 draws; banker 3c,Tc=3; player's 3rd card is 8d
  g.handle('p0', { type: 'bet', spot: 'banker', amount: 60 });
  g.handle('p0', { type: 'ready' });
  run(g, 6000, clock);
  assert.equal(g.player.length, 3);
  assert.equal(g.banker.length, 2, 'banker stands on 3 against a drawn 8');
  assert.equal(g.result.pt, 0);
  assert.equal(g.result.bt, 3);
  assert.equal(g.result.winner, 'banker');
  assert.equal(room.players[0].chips, 1000 - 60 + 117);
});

test('baccarat plays many rounds with bots, chips never go negative', () => {
  const room = makeRoom(4);
  const clock = { t: 0 };
  const g = new Baccarat(room, { min: 5, betTime: 4 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  run(g, 1000 * 60 * 4, clock);
  assert.ok(g.round > 10, `rounds ${g.round}`);
  assert.ok(room.players.every((p) => p.chips >= 0), 'nobody owes the table');
  // Banker bets pay 0.95:1, floored to a whole chip, so the total can only
  // ever drift down by that rounding (never up) — unlike hold'em's pot,
  // this isn't a closed system, so exact conservation isn't the invariant.
});

// ---------------------------------------------------------------- craps
function rigRoll(g, dice) {
  g.rollDice = dice;
}

test('craps: come-out naturals and craps numbers resolve the pass line', () => {
  const room = makeRoom(2, false);
  const clock = { t: 0 };
  const g = new Craps(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  g.shooterId = 'p0';
  g.handle('p0', { type: 'bet', spot: 'pass', amount: 100 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [3, 4]); // 7
  run(g, 2000, clock);
  assert.equal(g.phase, 'result');
  assert.equal(g.lastRoll.sum, 7);
  assert.equal(room.players[0].chips, 1000 - 100 + 200);
  run(g, 5000, clock); // settle back to betting
  assert.equal(g.phase, 'betting');
  assert.equal(g.point, null);
});

test("craps: twelve pushes don't pass but still loses pass", () => {
  const room = makeRoom(2, false);
  const clock = { t: 0 };
  const g = new Craps(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  g.shooterId = 'p0';
  g.handle('p0', { type: 'bet', spot: 'pass', amount: 40 });
  g.handle('p1', { type: 'bet', spot: 'dpass', amount: 50 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [6, 6]); // 12
  run(g, 2000, clock);
  assert.equal(g.lastRoll.sum, 12);
  assert.equal(room.players[0].chips, 1000 - 40); // pass loses
  assert.equal(room.players[1].chips, 1000); // don't pass pushes
});

test('craps: point made pays pass, seven-out clears place bets and passes the dice', () => {
  const room = makeRoom(2, false);
  const clock = { t: 0 };
  const g = new Craps(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  g.shooterId = 'p0';
  g.handle('p0', { type: 'bet', spot: 'pass', amount: 100 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [2, 4]); // 6: point established
  run(g, 2000, clock);
  assert.equal(g.point, 6);
  assert.equal(room.players[0].chips, 1000 - 100);
  run(g, 5000, clock); // back to betting
  assert.equal(g.phase, 'betting');

  g.handle('p0', { type: 'bet', spot: 'place:6', amount: 60 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [3, 3]); // 6 the hard way: point made AND place:6 pays
  run(g, 2000, clock);
  assert.equal(g.point, null, 'point is made and clears');
  assert.equal(room.players[0].chips, 1000 - 100 - 60 + 200 + 130);
  assert.ok(g.bets.some((b) => b.spot === 'place:6'), 'place bet stays up after winning');
  run(g, 5000, clock);

  g.handle('p0', { type: 'bet', spot: 'pass', amount: 50 }); // fresh come-out, allowed again
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [2, 3]); // 5: new point
  run(g, 2000, clock);
  assert.equal(g.point, 5);
  run(g, 5000, clock);

  const before = room.players[0].chips;
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [4, 3]); // 7: seven-out
  run(g, 2000, clock);
  assert.equal(g.lastRoll.sum, 7);
  assert.equal(g.point, null);
  assert.equal(room.players[0].chips, before, 'losing bets already took their stake when placed; no further deduction on resolution');
  assert.ok(!g.bets.some((b) => b.spot === 'place:6'), 'place bet cleared on seven-out');
  assert.equal(g.shooterId, 'p1', 'the dice pass to the next player');
});

test('craps: field pays double on 2, triple on 12, even money on 3/4/9/10/11', () => {
  const room = makeRoom(1, false);
  const clock = { t: 0 };
  const mk = () => {
    const g = new Craps(room, { min: 5, betTime: 999 });
    g.now = () => clock.t;
    g.jobs.forEach((j) => (j.at = 0));
    g.shooterId = 'p0';
    return g;
  };
  room.players[0].chips = 1000;
  let g = mk();
  g.handle('p0', { type: 'bet', spot: 'field', amount: 10 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [1, 1]); // 2
  run(g, 2000, clock);
  assert.equal(room.players[0].chips, 1000 - 10 + 30);

  room.players[0].chips = 1000;
  g = mk();
  g.handle('p0', { type: 'bet', spot: 'field', amount: 10 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [6, 6]); // 12
  run(g, 2000, clock);
  assert.equal(room.players[0].chips, 1000 - 10 + 40);

  room.players[0].chips = 1000;
  g = mk();
  g.handle('p0', { type: 'bet', spot: 'field', amount: 10 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [2, 2]); // 4
  run(g, 2000, clock);
  assert.equal(room.players[0].chips, 1000 - 10 + 20);

  room.players[0].chips = 1000;
  g = mk();
  g.handle('p0', { type: 'bet', spot: 'field', amount: 10 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [1, 4]); // 5: not a field number
  run(g, 2000, clock);
  assert.equal(room.players[0].chips, 1000 - 10);
});

test('craps: a hardway wins on the pair and loses on the easy way or a seven', () => {
  const room = makeRoom(1, false);
  const clock = { t: 0 };
  const g = new Craps(room, { min: 5, betTime: 999 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  g.shooterId = 'p0';
  g.handle('p0', { type: 'bet', spot: 'hard:8', amount: 20 });
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [4, 4]); // hard 8
  run(g, 2000, clock);
  assert.equal(room.players[0].chips, 1000 - 20 + 200); // 9:1
  assert.ok(g.bets.some((b) => b.spot === 'hard:8'), 'stays up after a win');
  run(g, 5000, clock);

  const before = room.players[0].chips;
  g.handle('p0', { type: 'roll' });
  rigRoll(g, [5, 3]); // 8 the easy way
  run(g, 2000, clock);
  assert.equal(room.players[0].chips, before, 'no payout for the easy way');
  assert.ok(!g.bets.some((b) => b.spot === 'hard:8'), 'cleared after losing the easy way');
});

test('craps plays many rolls with bots, chips never go negative', () => {
  const room = makeRoom(5);
  const clock = { t: 0 };
  const g = new Craps(room, { min: 5, betTime: 4 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  run(g, 1000 * 60 * 3, clock);
  assert.ok(g.rollNo > 15, `rolls ${g.rollNo}`);
  assert.ok(room.players.every((p) => p.chips >= 0), 'nobody owes the table');
  assert.ok(room.players.some((p) => p.id === g.shooterId), 'the shooter is always someone at the table');
});
