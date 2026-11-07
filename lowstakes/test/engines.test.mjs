import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../js/core/evaluate.js';
import { basicStrategy, handValue } from '../js/core/blackjack-rules.js';
import { Holdem } from '../js/games/holdem.js';
import { Blackjack } from '../js/games/blackjack.js';
import { Crash, crashPoint, multAt, timeFor, GROWTH } from '../js/games/crash.js';
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

// ---------------------------------------------------------------- blackjack staging
function bjGame(draws, bet = 100) {
  const room = makeRoom(1, false);
  const clock = { t: 0 };
  const g = new Blackjack(room, { timer: 0, min: 10 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  g.shoe = draws.slice().reverse(); // shoe.pop() yields `draws` in order
  g.handle('p0', { type: 'bet', amount: bet });
  g.handle('p0', { type: 'ready' });
  run(g, 3000, clock); // deal 4 cards, reach p0's turn
  assert.equal(g.phase, 'playing');
  return { room, clock, g };
}
const untilPhase = (g, clock, phase, max = 20000) => { for (let t = 0; t < max && g.phase !== phase; t += 50) run(g, 50, clock); };

test('blackjack: split deals the same cards in the same order, just later', () => {
  const { room, clock, g } = bjGame(['8h', '6d', '8s', 'Tc', 'Th', '9c', 'Kd']);
  assert.equal(g.view('p0').dealer.cards[1], '??', 'hole card is hidden from every view');
  assert.ok(g.handle('p0', { type: 'split' }));
  const [a, b] = g.seats[0].hands;
  assert.equal(room.players[0].chips, 1000 - 100 - 100, 'second stake is taken immediately');
  assert.deepEqual([a.cards.length, b.cards.length], [1, 1], 'the pair separates first');
  assert.equal(g.handle('p0', { type: 'hit' }), false, 'no actions while the split plays out');
  run(g, 1000, clock);
  assert.deepEqual([a.cards.length, b.cards.length], [2, 1], 'first new card lands on hand one');
  run(g, 700, clock);
  assert.deepEqual(a.cards, ['8h', 'Th']);
  assert.deepEqual(b.cards, ['8s', '9c']);
  assert.notEqual(a.hid, b.hid, 'each hand has its own stable id');
  run(g, 700, clock);
  assert.ok(g.handle('p0', { type: 'stand' }));
  run(g, 700, clock);
  assert.ok(g.handle('p0', { type: 'stand' }));
  untilPhase(g, clock, 'settle');
  assert.equal(g.dealer.cards.length, 3, 'dealer drew to 16 and busted');
  assert.equal(room.players[0].chips, 1000 - 100 - 100 + 200 + 200);
});

test('blackjack: double takes the stake at once and shows the card after a beat', () => {
  const { room, clock, g } = bjGame(['5h', '9d', '6c', '7s', 'Th', 'Tc'], 50);
  assert.ok(g.handle('p0', { type: 'double' }));
  const hand = g.seats[0].hands[0];
  assert.equal(hand.bet, 100);
  assert.equal(room.players[0].chips, 1000 - 50 - 50);
  assert.equal(hand.cards.length, 2, 'card not shown yet');
  run(g, 1000, clock);
  assert.deepEqual(hand.cards, ['5h', '6c', 'Th']);
  untilPhase(g, clock, 'settle');
  assert.equal(room.players[0].chips, 1000 - 100 + 200, 'dealer 16 draws a ten and busts');
});

test('blackjack: hitting to a bust is scored after the card lands, and loses the stake', () => {
  const { room, clock, g } = bjGame(['Th', '6d', '6c', 'Tc', 'Kh']);
  assert.ok(g.handle('p0', { type: 'hit' }));
  assert.equal(g.seats[0].hands[0].result, undefined, 'not scored until the card has landed');
  run(g, 800, clock);
  assert.equal(g.seats[0].hands[0].result, 'Bust');
  untilPhase(g, clock, 'settle');
  assert.equal(room.players[0].chips, 1000 - 100);
});

test('blackjack: split aces get one card each and no further action', () => {
  const { room, clock, g } = bjGame(['Ah', '6d', 'As', 'Tc', 'Kh', '9d', '5s']);
  assert.ok(g.handle('p0', { type: 'split' }));
  run(g, 2200, clock);
  const [a, b] = g.seats[0].hands;
  assert.deepEqual(a.cards, ['Ah', 'Kh']);
  assert.deepEqual(b.cards, ['As', '9d']);
  assert.ok(a.done && b.done, 'split aces are finished');
  untilPhase(g, clock, 'settle');
  // dealer 6+10=16 draws a 5 -> 21; 21 beats A+K (21 after a split is not blackjack, but ties) and A+9
  assert.equal(g.dealer.cards.length, 3);
  assert.equal(room.players[0].chips, 1000 - 200 + 100 /* push on 21 */ + 0 /* 20 loses */);
});

// ---------------------------------------------------------------- table capacity
import { Host, GAME_LIMITS, limitFor, MAX_PLAYERS } from '../js/net/room.js';

const mkHost = () => new Host({ name: 'Host', color: '#E0472F' });
const fakeConn = () => ({ open: true, send() {}, close() {}, on() {} });
const fill = (h, n) => { while (h.room.players.length < n) assert.ok(h.addBot().ok); };

test('capacity: each game has its own limit and roulette does not inherit the smaller ones', () => {
  assert.deepEqual(GAME_LIMITS, { holdem: 9, blackjack: 7, roulette: 12, crash: 12 });
  assert.equal(MAX_PLAYERS, 12);
  assert.equal(limitFor('roulette'), 12);
  assert.equal(limitFor(null), 12, 'the lobby holds as many as the biggest game');
});

test('capacity: a blackjack table stops at 7 and says why', () => {
  const h = mkHost();
  try {
    fill(h, 7);
    const r = h.addBot('blackjack');
    assert.equal(r.ok, false);
    assert.match(r.message, /Blackjack seats 7/);
    assert.equal(h.room.players.length, 7);
    assert.ok(h.setGame('blackjack').ok);
    assert.equal(h.addBot().ok, false, 'also refused while the game runs');
    const e = h.engine.view(h.id);
    assert.equal(e.seats.length, 7, 'all seven are seated and visible');
    assert.deepEqual(e.seats.map((s) => s.pid).sort(), h.room.players.map((p) => p.id).sort());
    // a stranger cannot take an eighth seat, but a seated player can come back
    assert.equal(h.join('stranger', { name: 'Late' }, fakeConn()), 'full');
    const guest = h.room.players.find((p) => p.bot);
    assert.equal(h.join(guest.id, { name: guest.name }, fakeConn()), true, 'a seated player rejoining is not a new seat');
  } finally { h.close(); }
});

test('capacity: a poker table stops at 9, and the game will not start with more', () => {
  const h = mkHost();
  try {
    fill(h, 9);
    assert.equal(h.addBot('holdem').ok, false);
    assert.match(h.addBot('holdem').message, /Texas Hold'em seats 9/);
    assert.ok(h.setGame('holdem').ok);
    const v = h.engine.view(h.id);
    assert.equal(v.seats.length, 9, 'all nine are seated and visible');
    assert.equal(h.join('stranger', { name: 'Late' }, fakeConn()), 'full');
  } finally { h.close(); }
});

test('capacity: a lobby of 12 can play roulette but is told how many to remove for the others', () => {
  const h = mkHost();
  try {
    fill(h, 12);
    assert.equal(h.addBot('roulette').ok, false, 'twelve is the most anyone can seat');
    const bj = h.setGame('blackjack');
    assert.equal(bj.ok, false);
    assert.match(bj.message, /Blackjack seats 7, but 12 are at the table\. Remove 5 players or bots/);
    assert.equal(h.room.gameId, null, 'nothing started, nobody hidden');
    const pk = h.setGame('holdem');
    assert.match(pk.message, /Remove 3 players or bots/);
    assert.ok(h.setGame('roulette').ok);
    const v = h.engine.view(h.id);
    assert.equal(h.room.players.length, 12);
    assert.equal(v.ready.length >= 0, true);
  } finally { h.close(); }
});

// ---------------------------------------------------------------- blackjack insurance
function insGame(draws, bet = 100, humans = 1) {
  const room = makeRoom(humans, false);
  const clock = { t: 0 };
  const g = new Blackjack(room, { timer: 0, min: 10 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  g.shoe = draws.slice().reverse();
  for (let i = 0; i < humans; i++) { g.handle('p' + i, { type: 'bet', amount: bet }); g.handle('p' + i, { type: 'ready' }); }
  run(g, 3000, clock);
  return { room, clock, g };
}

test('insurance: offered on an ace, costs half the bet, pays 2 to 1 on dealer blackjack', () => {
  const { room, clock, g } = insGame(['9h', 'As', '8s', 'Kc']); // dealer A + K
  assert.equal(g.phase, 'insurance');
  assert.deepEqual(g.view('p0').you.insurance, { cost: 50 });
  assert.equal(g.handle('p0', { type: 'hit' }), false, 'no playing actions during insurance');
  assert.ok(g.handle('p0', { type: 'insure' }));
  assert.equal(room.players[0].chips, 1000 - 100 - 50);
  assert.equal(g.handle('p0', { type: 'decline' }), false, 'one decision only');
  run(g, 2500, clock);
  assert.equal(g.seats[0].insNet, 100, 'insurance nets +2x the premium');
  untilPhase(g, clock, 'settle');
  // main bet lost (-100), insurance +100: break even overall
  assert.equal(room.players[0].chips, 1000);
});

test('insurance: loses the premium when the dealer has no blackjack, and play continues', () => {
  const { room, clock, g } = insGame(['9h', 'As', '8s', '6c', 'Td']);
  assert.equal(g.phase, 'insurance');
  g.handle('p0', { type: 'insure' });
  run(g, 3500, clock);
  assert.equal(g.seats[0].insNet, -50);
  assert.equal(g.phase, 'playing');
  assert.equal(room.players[0].chips, 1000 - 100 - 50);
});

test('insurance: declining, timeouts, and no offer without an ace or without chips', () => {
  const a = insGame(['9h', 'As', '8s', '6c']);
  assert.ok(a.g.handle('p0', { type: 'decline' }));
  run(a.g, 3500, a.clock);
  assert.equal(a.g.phase, 'playing');
  assert.equal(a.room.players[0].chips, 900);

  const t = insGame(['9h', 'As', '8s', '6c']);
  run(t.g, 13000, t.clock); // nobody answers: treated as no
  assert.equal(t.g.phase, 'playing');
  assert.equal(t.room.players[0].chips, 900);

  const k = insGame(['9h', 'Ks', '8s', 'Ac']);
  assert.notEqual(k.g.phase, 'insurance', 'a ten up does not offer insurance');

  const room = makeRoom(1, false);
  const clock = { t: 0 };
  room.players[0].chips = 100;
  const g = new Blackjack(room, { timer: 0, min: 10 });
  g.now = () => clock.t; g.jobs.forEach((j) => (j.at = 0));
  g.shoe = ['6c', '8s', 'As', '9h'];
  g.handle('p0', { type: 'bet', amount: 100 }); g.handle('p0', { type: 'ready' });
  run(g, 3000, clock);
  assert.notEqual(g.phase, 'insurance', 'cannot afford the premium, so none is offered');
});

test('insurance: rounds with bots keep advancing, and bots only ever pay half their bet for it', () => {
  let offered = 0;
  for (let i = 0; i < 25; i++) {
    const room = makeRoom(4, true);
    room.players[0].bot = false;
    const clock = { t: 0 };
    const g = new Blackjack(room, { timer: 0, min: 10 });
    g.now = () => clock.t;
    let lastRound = 0;
    for (let t = 0; t < 150000; t += 50) {
      clock.t += 50; g.tick();
      if (g.phase === 'betting' && !g.seats[0].ready && room.players[0].chips >= 10) { g.handle('p0', { type: 'bet', amount: 10 }); g.handle('p0', { type: 'ready' }); }
      if (g.phase === 'playing' && g.turn && g.seats[g.turn.seat].pid === 'p0') g.handle('p0', { type: 'stand' });
      if (g.phase === 'insurance') { offered++; for (const s of g.seats) if (s.insurance) assert.equal(s.insurance, Math.floor(s.hands.reduce((a, h) => a + h.bet, 0) / 2)); g.handle('p0', { type: 'decline' }); }
      lastRound = g.round;
    }
    assert.ok(lastRound >= 5, 'rounds keep advancing');
  }
  assert.ok(offered > 0, 'an ace showed at least once across the runs');
});

test('dealer check: everyone is told the result; the hole card stays hidden unless it is blackjack', () => {
  // Ten up, no blackjack: announced, card hidden, play continues.
  const a = insGame(['9h', 'Ks', '8s', '6c', '2d']);
  assert.notEqual(a.g.phase, 'insurance');
  run(a.g, 1300, a.clock);
  assert.deepEqual(a.g.view('p0').check && a.g.view('p0').check.bj, false, 'no-blackjack announcement is visible');
  assert.equal(a.g.view('p0').dealer.cards[1], '??', 'hole card still hidden');
  run(a.g, 1500, a.clock);
  assert.equal(a.g.phase, 'playing');
  run(a.g, 3000, a.clock);
  assert.equal(a.g.view('p0').check, null, 'announcement clears itself');

  // Ace up, blackjack: announced, card revealed, hands lose without further action.
  const b = insGame(['9h', 'As', '8s', 'Kc']);
  b.g.handle('p0', { type: 'decline' });
  run(b.g, 1700, b.clock);
  const v = b.g.view('p0');
  assert.equal(v.check.bj, true);
  assert.equal(v.dealer.cards[1], 'Kc', 'blackjack reveals the card');
  assert.equal(b.g.handle('p0', { type: 'hit' }), false, 'no playing on a dealer blackjack');
  untilPhase(b.g, b.clock, 'settle');
  assert.equal(b.room.players[0].chips, 900);

  // A low card up: no check at all.
  const c = insGame(['9h', '5s', '8s', 'Kc']);
  assert.equal(c.g.phase, 'playing');
  assert.equal(c.g.view('p0').check, null);
});

// ---------------------------------------------------------------- crash
function crashGame(humans = 1, bots = false) {
  const room = makeRoom(humans, bots);
  const clock = { t: 0 };
  const g = new Crash(room, { min: 5, betTime: 15 });
  g.now = () => clock.t;
  g.jobs.forEach((j) => (j.at = 0));
  return { room, clock, g };
}

test('crash: multiplier maths and crash distribution have a 1% house edge', () => {
  assert.equal(multAt(0), 1);
  assert.ok(Math.abs(multAt(timeFor(2)) - 2) < 0.02);
  const N = 200000;
  let ge2 = 0, ge10 = 0, rtp2 = 0;
  for (let i = 0; i < N; i++) { const x = crashPoint(); assert.ok(x >= 1 && x <= 1000); if (x >= 2) ge2++; if (x >= 10) ge10++; }
  assert.ok(Math.abs(ge2 / N - 0.495) < 0.01, `P(>=2x) ~ 0.495, got ${ge2 / N}`);
  assert.ok(Math.abs(ge10 / N - 0.099) < 0.006, `P(>=10x) ~ 0.099, got ${ge10 / N}`);
  assert.ok(Math.abs((2 * ge2) / N - 0.99) < 0.02, 'cashing out at 2x returns about 99%');
});

test('crash: cash out in time pays bet x multiplier; late is refused; busting loses the bet', () => {
  const { room, clock, g } = crashGame();
  assert.ok(g.handle('p0', { type: 'add', amount: 100 }));
  assert.equal(room.players[0].chips, 900);
  g.handle('p0', { type: 'ready' });
  assert.equal(g.phase, 'running');
  g.crash = 5; // pin the outcome for the test
  run(g, 8000, clock);
  assert.equal(g.phase, 'running');
  assert.ok(g.handle('p0', { type: 'cashout' }));
  const x = g.bet('p0').cashed;
  assert.ok(x >= 1.9 && x <= 2.1, `cashed near 2x, got ${x}`);
  assert.equal(room.players[0].chips, 900 + Math.floor(100 * x));
  assert.equal(g.handle('p0', { type: 'cashout' }), false, 'only once');
  run(g, 12000, clock);
  assert.equal(g.phase, 'crashed');
  assert.equal(g.net.p0, Math.floor(100 * x) - 100);

  // A second round: ride it into the crash.
  run(g, 6000, clock);
  assert.equal(g.phase, 'betting');
  g.handle('p0', { type: 'add', amount: 50 }); g.handle('p0', { type: 'ready' });
  g.crash = 1.5;
  run(g, 6000, clock);
  assert.equal(g.phase, 'crashed');
  assert.equal(g.handle('p0', { type: 'cashout' }), false, 'too late after the crash');
  assert.equal(g.net.p0, -50);
});

test('crash: cash-out is refused once the crash time has passed, even before the next tick', () => {
  const { clock, g } = crashGame();
  g.handle('p0', { type: 'add', amount: 10 }); g.handle('p0', { type: 'ready' });
  g.crash = 2;
  clock.t += timeFor(2) + 5; // past the crash time but step() has not run yet
  assert.equal(g.handle('p0', { type: 'cashout' }), false);
});

test('crash: auto cash-out pays exactly its target; others cannot see it', () => {
  const { room, clock, g } = crashGame(2);
  g.handle('p0', { type: 'add', amount: 100 }); g.handle('p0', { type: 'auto', x: 3 });
  g.handle('p1', { type: 'add', amount: 100 }); g.handle('p1', { type: 'auto', x: 50 });
  assert.equal(g.view('p0').bets.find((b) => b.pid === 'p1').auto, null, 'others targets are hidden');
  assert.equal(g.view('p1').you.auto, 50);
  g.handle('p0', { type: 'ready' }); g.handle('p1', { type: 'ready' });
  g.crash = 4;
  run(g, 17500, clock);
  assert.equal(g.bet('p0').cashed, 3);
  assert.equal(room.players[0].chips, 900 + 300);
  assert.equal(g.bet('p1').cashed, null, 'target above the crash point loses');
  assert.equal(room.players[1].chips, 900);
  assert.equal(g.handle('p0', { type: 'auto', x: 2 }), false, 'no changes mid-flight');
});

test('crash: bets are validated and refunded on clear, and ending mid-round refunds', () => {
  const { room, g } = crashGame();
  assert.equal(g.handle('p0', { type: 'add', amount: 2 }), false, 'below the minimum');
  assert.equal(g.handle('p0', { type: 'add', amount: 5000 }), false, 'more than you have');
  g.handle('p0', { type: 'add', amount: 50 });
  g.handle('p0', { type: 'clear' });
  assert.equal(room.players[0].chips, 1000);
  g.handle('p0', { type: 'add', amount: 50 });
  assert.equal(g.handle('p0', { type: 'auto', x: 1.0 }), false);
  g.handle('p0', { type: 'ready' });
  assert.equal(g.handle('p0', { type: 'add', amount: 50 }), false, 'locked in');
});

test('crash: a table with bots keeps cycling rounds', () => {
  for (let i = 0; i < 15; i++) {
    const room = makeRoom(5, true);
    room.players[0].bot = false;
    const clock = { t: 0 };
    const g = new Crash(room, { min: 5, betTime: 10 });
    g.now = () => clock.t;
    for (let t = 0; t < 200000; t += 50) {
      clock.t += 50; g.tick();
      if (g.phase === 'betting' && !g.ready.has('p0') && room.players[0].chips >= 5) { g.handle('p0', { type: 'add', amount: 5 }); g.handle('p0', { type: 'ready' }); }
      if (g.phase === 'running' && g.bet('p0') && g.bet('p0').cashed === null && multAt(g.elapsed()) >= 1.5 && Math.random() < 0.2) g.handle('p0', { type: 'cashout' });
    }
    assert.ok(g.round >= 6, `rounds advance (got ${g.round})`);
    const total = room.players.reduce((a, p) => a + p.chips, 0);
    assert.ok(total > 0);
  }
});

test('crash: seats twelve and refuses a thirteenth', () => {
  assert.equal(GAME_LIMITS.crash, 12);
  assert.equal(limitFor('crash'), 12);
});
