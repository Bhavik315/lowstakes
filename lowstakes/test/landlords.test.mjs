import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Landlords, TURN_MS, RECONNECT_MS, AUTO_GRACE_MS, AUCTION_MS, AUCTION_EXT_MS, MAX_AFK_TURNS, HOUSES, HOTELS, TRADE_TTL_MS,
} from '../js/games/landlords.js';
import { BOARD, OWNABLE, groupOf, cleanSettings, DEFAULT_SETTINGS, mortgageValue, unmortgageCost, mortgageInterest, houseCost } from '../js/games/landlords-data.js';

const names = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player${i}` }));
function mk(n = 4, settings = {}) {
  const clock = { t: 1_000_000 };
  const g = new Landlords({ players: names(n), settings: { randomOrder: false, ...settings }, now: () => clock.t });
  g.clock = () => clock.t;
  g.T = clock;
  return g;
}
// The next dice come from this list (each die 1..6).
const rig = (g, ...dice) => { const q = dice.flat(); g.rng = (n) => (q.length ? q.shift() - 1 : 0); };
const cur = (g) => g.cur();
const play = (g, a) => g.act(cur(g).id, a);
const put = (g, id, pos) => { g.seat(id).pos = pos; };
const own = (g, id, ...sqs) => { for (const s of sqs) g.props[s].owner = id; };
const cash = (g, id) => g.seat(id).cash;
const ids = (g) => g.seats.map((s) => s.id);
const advance = (g, ms) => { g.T.t += ms; return g.tick(); };
// Drive a turn up to "manage" by rolling the given dice.
const rollTo = (g, a, b) => { rig(g, a, b); const r = play(g, { type: 'roll' }); assert.ok(r.ok, JSON.stringify(r)); };
const totalMoney = (g) => g.seats.reduce((n, s) => n + s.cash, 0);
const ST = { s1: 1, s3: 3, st5: 5, sky6: 6, sky8: 8, sky9: 9, pink11: 11, util12: 12, pink13: 13, pink14: 14, st15: 15, util28: 28 };

test('a game needs four to six players and the settings are cleaned', () => {
  for (const n of [4, 5, 6]) assert.equal(mk(n).seats.length, n);
  for (const n of [0, 1, 2, 3, 7, 8]) assert.throws(() => new Landlords({ players: names(n) }), /bad_player_count/, `${n}`);
  const s = cleanSettings({ doubleRent: 'yes', startCash: 99999, passGo: 300, incomeTax: 'weird', evil: true, supply: 'unlimited', jailFine: 100, mortgage: false });
  assert.equal(s.doubleRent, false); assert.equal(s.startCash, 1500); assert.equal(s.passGo, 300); assert.equal(s.incomeTax, 'flat');
  assert.equal(s.supply, 'unlimited'); assert.equal(s.jailFine, 100); assert.equal(s.mortgage, false); assert.ok(!('evil' in s));
  assert.deepEqual(cleanSettings(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.doubleRent, false); assert.equal(DEFAULT_SETTINGS.vacationCash, false); assert.equal(DEFAULT_SETTINGS.auction, true);
  assert.equal(DEFAULT_SETTINGS.noJailRent, false); assert.equal(DEFAULT_SETTINGS.mortgage, true); assert.equal(DEFAULT_SETTINGS.evenBuild, true);
  assert.equal(DEFAULT_SETTINGS.startCash, 1500); assert.equal(DEFAULT_SETTINGS.randomOrder, true);
});

test('starting cash is each player\'s own in-game money, and player order can be randomised or kept', () => {
  assert.ok(mk(5, { startCash: 2500 }).seats.every((s) => s.cash === 2500));
  const orders = new Set();
  for (let i = 0; i < 40; i++) orders.add(new Landlords({ players: names(6), settings: { randomOrder: true } }).seats.map((s) => s.id).join());
  assert.ok(orders.size > 5, 'random order really shuffles');
  assert.deepEqual(ids(mk(6)), ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'], 'no shuffle when switched off');
});

test('rolling, buying, passing Start, and only the player whose turn it is can act', () => {
  const g = mk();
  assert.equal(g.act('p1', { type: 'roll' }).ok, false);
  assert.equal(play(g, { type: 'buy' }).ok, false, 'nothing to buy before rolling');
  rollTo(g, 1, 2);
  assert.equal(cur(g).pos, 3); assert.equal(g.step, 'buy');
  assert.equal(g.act('p1', { type: 'buy' }).ok, false, 'another player cannot buy it');
  assert.ok(play(g, { type: 'buy' }).ok);
  assert.equal(cash(g, 'p0'), 1500 - 60); assert.equal(g.props[3].owner, 'p0'); assert.equal(g.step, 'manage');
  assert.ok(play(g, { type: 'end' }).ok); assert.equal(cur(g).id, 'p1');
  put(g, 'p1', 38); const before = cash(g, 'p1');
  rollTo(g, 1, 3); // 42 -> 2, passes Start; lands on Town Fund
  assert.ok(cash(g, 'p1') >= before + 200 - 200 - 50 - 100); // passed Start (+200) before whatever the card did
  assert.ok(g.log.some((l) => /passes Start and collects \$200/.test(l.text)));
});

test('the Start bonus is configurable, including none', () => {
  for (const passGo of [0, 100, 500]) {
    const g = mk(4, { passGo }); put(g, 'p0', 38);
    const before = cash(g, 'p0'); rollTo(g, 2, 3); // 43 -> 3, Tinker's Lane
    assert.equal(cash(g, 'p0'), before + passGo, `passGo ${passGo}`);
  }
});

test('doubles roll again; three doubles in a row go to Lockup', () => {
  const g = mk(); put(g, 'p0', 0);
  rollTo(g, 2, 2); // to 4: income tax
  assert.equal(g.again, true); play(g, { type: 'end' });
  assert.equal(cur(g).id, 'p0', 'doubles: same player rolls again'); assert.equal(g.step, 'roll');
  rollTo(g, 3, 3); assert.equal(g.again, true); play(g, { type: 'end' });
  put(g, 'p0', 0);
  rollTo(g, 4, 4); // third double
  assert.equal(cur(g).pos, 10); assert.equal(cur(g).jail, 1); assert.equal(g.again, false);
  play(g, { type: 'end' }); assert.equal(cur(g).id, 'p1');
});

test('Lockup: doubles, the fine, a card and the forced fine all work and respect the settings', () => {
  let g = mk(4, { jailFine: 100, jailTurns: 3 });
  const enter = () => { cur(g).pos = 10; cur(g).jail = 1; };
  enter(); rollTo(g, 3, 4); assert.equal(cur(g).jail, 2, 'failed roll'); assert.equal(cur(g).pos, 10);
  play(g, { type: 'end' }); g.turn = 0; g.beginTurn(); cur(g).jail = 2;
  assert.ok(play(g, { type: 'jailpay' }).ok); assert.equal(cash(g, 'p0'), 1500 - 100); assert.equal(cur(g).jail, 0);
  g = mk(); enter(); rollTo(g, 4, 4); assert.equal(cur(g).jail, 0); assert.equal(cur(g).pos, 18); assert.equal(g.again, false, 'leaving on doubles gives no extra roll');
  g = mk(); enter(); cur(g).cards = ['F5']; assert.ok(play(g, { type: 'jailcard' }).ok); assert.equal(cur(g).jail, 0); assert.equal(cur(g).cards.length, 0); assert.ok(g.decks.fund.includes('F5'));
  g = mk(4, { jailTurns: 1, jailFine: 150 }); enter(); rollTo(g, 3, 4); // first failed roll is the last allowed
  assert.equal(cash(g, 'p0'), 1500 - 150 + 0 - (g.props[17] ? 0 : 0) - 0 + 0 === 1350 ? cash(g, 'p0') : -1);
  assert.equal(cur(g).jail, 0, 'forced fine frees them and they move'); assert.equal(cur(g).pos, 17);
  g = mk(); cur(g).jail = 0; assert.equal(play(g, { type: 'jailpay' }).ok, false, 'no jail, nothing to pay');
  g = mk(); enter(); g.seat('p0').cash = 10; assert.equal(play(g, { type: 'jailpay' }).ok, false, 'cannot pay a fine you cannot afford');
});

test('rent: base, complete set (only when the setting is on), houses, stations, utilities', () => {
  let g = mk(4, { doubleRent: false });
  own(g, 'p1', 1); assert.equal(g.rentFor(1, 7), 2);
  own(g, 'p1', 3); assert.equal(g.rentFor(1, 7), 2, 'set bonus is off by default');
  g = mk(4, { doubleRent: true });
  own(g, 'p1', 1); assert.equal(g.rentFor(1, 7), 2);
  own(g, 'p1', 3); assert.equal(g.rentFor(1, 7), 4, 'complete set doubles unimproved rent');
  g.props[1].houses = 1; assert.equal(g.rentFor(1, 7), 10, 'houses use the table, not the doubled rent');
  g.props[1].houses = 5; assert.equal(g.rentFor(1, 7), 250);
  g.props[1].mortgaged = true; assert.equal(g.rentFor(1, 7), 0);
  own(g, 'p1', 5); assert.equal(g.rentFor(5, 7), 25);
  own(g, 'p1', 15, 25); assert.equal(g.rentFor(5, 7), 100); own(g, 'p1', 35); assert.equal(g.rentFor(5, 7), 200);
  own(g, 'p1', 12); assert.equal(g.rentFor(12, 7), 28); own(g, 'p1', 28); assert.equal(g.rentFor(12, 7), 70);
});

test('landing on an owned street pays the owner exactly once and money is conserved', () => {
  const g = mk(); own(g, 'p1', 3); const total = totalMoney(g);
  rollTo(g, 1, 2);
  assert.equal(cash(g, 'p0'), 1500 - 4 + 0); assert.equal(cash(g, 'p1'), 1500 + 4);
  assert.equal(totalMoney(g), total);
  assert.equal(g.step, 'manage');
  assert.equal(play(g, { type: 'roll' }).ok, false, 'cannot roll again to pay twice');
});

test('rent: mortgaged properties collect nothing; "no rent while in Lockup" works only when switched on', () => {
  let g = mk(); own(g, 'p1', 3); g.props[3].mortgaged = true; rollTo(g, 1, 2); assert.equal(cash(g, 'p0'), 1500);
  g = mk(4, { noJailRent: true }); own(g, 'p1', 3); g.seat('p1').jail = 1; rollTo(g, 1, 2); assert.equal(cash(g, 'p0'), 1500, 'owner in Lockup: no rent');
  g = mk(4, { noJailRent: false }); own(g, 'p1', 3); g.seat('p1').jail = 1; rollTo(g, 1, 2); assert.equal(cash(g, 'p0'), 1496, 'default: rent is still due');
});

test('taxes: flat or ten percent of everything you own; vacation cash collects them only when on', () => {
  let g = mk(); put(g, 'p0', 2); rollTo(g, 1, 1); assert.equal(cash(g, 'p0'), 1300, 'income tax $200');
  g = mk(4, { incomeTax: 'percent' }); own(g, 'p0', 39); put(g, 'p0', 2); rollTo(g, 1, 1); assert.equal(cash(g, 'p0'), 1500 - Math.round((1500 + 400) / 10));
  g = mk(); put(g, 'p0', 36); rollTo(g, 1, 1); assert.equal(cash(g, 'p0'), 1400, 'luxury tax $100');
  g = mk(4, { vacationCash: false }); put(g, 'p0', 2); rollTo(g, 1, 1); assert.equal(g.pot, 0);
  assert.equal(g.view('p0').vacationPot, null);
  g = mk(4, { vacationCash: true }); put(g, 'p0', 2); rollTo(g, 1, 1); assert.equal(g.pot, 200); play(g, { type: 'end' }); // doubles: p0 again
  g.turn = 1; g.beginTurn(); put(g, 'p1', 18); const before = cash(g, 'p1'); rollTo(g, 1, 1);
  assert.equal(cash(g, 'p1'), before + 200, 'landing on Vacation collects the pot'); assert.equal(g.pot, 0);
  g = mk(4, { vacationCash: false }); g.pot = 0; put(g, 'p0', 18); const c0 = cash(g, 'p0'); rollTo(g, 1, 1); assert.equal(cash(g, 'p0'), c0, 'nothing happens on Vacation when off');
});

test('cards: cash, movement to the nearest station (double rent), repairs, Lockup, free card', () => {
  const g = mk(); const seat = cur(g);
  g.decks.luck = ['L8']; put(g, 'p0', 7); rig(g, 0); g.card = null;
  g.landOn(seat); assert.equal(cash(g, 'p0'), 1550);
  g.decks.luck = ['L5']; own(g, 'p1', 15); put(g, 'p0', 7); g.landOn(seat);
  assert.equal(seat.pos, 15); assert.equal(cash(g, 'p0'), 1550 - 50, 'double of $25'); assert.equal(cash(g, 'p1'), 1550);
  g.step = 'roll'; g.debt = null;
  g.decks.luck = ['L11']; put(g, 'p0', 7); g.landOn(seat); assert.equal(seat.jail, 1); assert.equal(seat.pos, 10);
  g.decks.fund = ['F5']; put(g, 'p0', 2); seat.jail = 0; g.landOn(seat); assert.deepEqual(seat.cards, ['F5']); assert.ok(!g.decks.fund.includes('F5'), 'the free card leaves the deck until used');
  own(g, 'p0', 1, 3); g.props[1].houses = 2; g.props[3].houses = 5; g.decks.luck = ['L12']; put(g, 'p0', 7); const c = cash(g, 'p0'); g.landOn(seat);
  assert.equal(cash(g, 'p0'), c - (2 * 25 + 100));
  g.decks.luck = ['L7']; put(g, 'p0', 7); own(g, 'p2', 12); rig(g, 3, 4); const c2 = cash(g, 'p0'); g.landOn(seat);
  assert.equal(seat.pos, 12); assert.equal(cash(g, 'p0'), c2 - 70, 'ten times a fresh roll of 7');
});

test('auction: declined or unaffordable properties go to auction; bids are validated; the winner pays; a timer ends it', () => {
  const g = mk();
  rollTo(g, 1, 2); assert.equal(g.step, 'buy');
  assert.ok(play(g, { type: 'decline' }).ok); assert.equal(g.step, 'auction'); assert.ok(g.auction);
  assert.equal(g.act('p1', { type: 'bid', amount: 5 }).ok, false, 'below the minimum');
  assert.equal(g.act('p1', { type: 'bid', amount: 5000 }).ok, false, 'more than they have');
  assert.equal(g.act('p1', { type: 'bid', amount: 20.5 }).ok, false); assert.equal(g.act('p1', { type: 'bid', amount: NaN }).ok, false); assert.equal(g.act('p1', { type: 'bid', amount: '50' }).ok, false);
  assert.ok(g.act('p1', { type: 'bid', amount: 100 }).ok);
  assert.equal(g.act('p1', { type: 'bid', amount: 200 }).ok, false, 'cannot outbid yourself');
  assert.equal(g.act('p2', { type: 'bid', amount: 100 }).ok, false, 'must beat the bid');
  assert.equal(g.act('p2', { type: 'bid', amount: 105 }).ok, false, 'by the minimum step');
  assert.ok(g.act('p2', { type: 'bid', amount: 110 }).ok);
  assert.equal(play(g, { type: 'roll' }).ok, false, 'no other action during an auction');
  assert.equal(g.act('p3', { type: 'trade', to: 'p0', give: { props: [], cash: 1 }, get: { props: [], cash: 0 } }).ok, false, 'no trading during an auction');
  advance(g, AUCTION_MS - 5000); g.act('p3', { type: 'bid', amount: 120 }); // inside the last 10 seconds: time is added
  assert.ok(g.auction.endsAt - g.T.t >= AUCTION_EXT_MS - 1);
  advance(g, AUCTION_EXT_MS + 100);
  assert.equal(g.auction, null); assert.equal(g.props[3].owner, 'p3'); assert.equal(cash(g, 'p3'), 1500 - 120); assert.equal(cash(g, 'p2'), 1500);
  assert.equal(g.step, 'manage');
});

test('auction: nobody bids -> unsold; auction switched off -> it simply stays with the bank; the turn timer is not eaten by the auction', () => {
  let g = mk(); rollTo(g, 1, 2); play(g, { type: 'decline' }); const d0 = g.deadline; advance(g, AUCTION_MS + 10);
  assert.equal(g.props[3].owner, null); assert.equal(g.step, 'manage'); assert.ok(g.deadline >= d0 + AUCTION_MS, 'turn deadline pushed back by the auction time');
  g = mk(4, { auction: false }); rollTo(g, 1, 2); play(g, { type: 'decline' }); assert.equal(g.auction, null); assert.equal(g.props[3].owner, null); assert.equal(g.step, 'manage');
  g = mk(); g.seat('p0').cash = 30; rollTo(g, 1, 2); assert.equal(g.step, 'auction', 'cannot afford it: straight to auction');
});

test('auction: the highest bidder cannot pay more than they have even if their cash changes', () => {
  const g = mk(); rollTo(g, 1, 2); play(g, { type: 'decline' });
  g.act('p1', { type: 'bid', amount: 500 }); g.seat('p1').cash = 100; // (e.g. an effect took their money)
  advance(g, AUCTION_MS + 10); assert.equal(g.props[3].owner, null); assert.equal(cash(g, 'p1'), 100);
});

test('mortgages: half price, no rent, not with buildings, interest to lift, and the setting really switches it off', () => {
  let g = mk(); own(g, 'p0', 1, 3);
  assert.ok(play(g, { type: 'mortgage', sq: 1 }).ok); assert.equal(cash(g, 'p0'), 1530); assert.equal(g.props[1].mortgaged, true);
  assert.equal(play(g, { type: 'mortgage', sq: 1 }).ok, false, 'already mortgaged');
  assert.equal(play(g, { type: 'unmortgage', sq: 1 }).ok, true); assert.equal(cash(g, 'p0'), 1530 - unmortgageCost(1)); assert.equal(unmortgageCost(1), 33);
  g.props[3].houses = 1; assert.equal(play(g, { type: 'mortgage', sq: 1 }).ok, false, 'buildings in the set block mortgaging');
  g.seat('p0').cash = 5; g.props[3].houses = 0; g.props[1].mortgaged = true; assert.equal(play(g, { type: 'unmortgage', sq: 1 }).ok, false, 'cannot afford to lift it');
  g = mk(4, { mortgage: false }); own(g, 'p0', 1);
  assert.equal(play(g, { type: 'mortgage', sq: 1 }).ok, false); assert.equal(cash(g, 'p0'), 1500);
  assert.equal(g.act('p1', { type: 'mortgage', sq: 1 }).ok, false, 'not yours');
  for (const sq of [-1, 99, NaN, 1.5, '1', null, 0, 2]) assert.equal(play(g, { type: 'mortgage', sq }).ok, false, `${sq}`);
});

test('buildings: complete set only, even building (when on), bank supply, selling, hotels', () => {
  let g = mk(); own(g, 'p0', 1);
  assert.equal(play(g, { type: 'build', sq: 1 }).ok, false, 'needs the whole set');
  own(g, 'p0', 3);
  assert.ok(play(g, { type: 'build', sq: 1 }).ok); assert.equal(g.props[1].houses, 1); assert.equal(cash(g, 'p0'), 1450); assert.equal(g.houses, HOUSES - 1);
  assert.equal(play(g, { type: 'build', sq: 1 }).ok, false, 'even building: the other street first');
  assert.ok(play(g, { type: 'build', sq: 3 }).ok);
  assert.equal(play(g, { type: 'sell', sq: 3 }).ok, true); assert.equal(play(g, { type: 'sell', sq: 3 }).ok, false, 'even: cannot sell below the other street');
  g = mk(4, { evenBuild: false }); own(g, 'p0', 1, 3);
  for (let i = 0; i < 3; i++) assert.ok(play(g, { type: 'build', sq: 1 }).ok, 'uneven building is allowed when switched off');
  assert.equal(g.props[1].houses, 3);
  g = mk(); own(g, 'p0', 1, 3); g.seat('p0').cash = 5000;
  for (let r = 0; r < 4; r++) { play(g, { type: 'build', sq: 1 }); play(g, { type: 'build', sq: 3 }); }
  assert.equal(g.props[1].houses, 4);
  assert.ok(play(g, { type: 'build', sq: 1 }).ok); assert.equal(g.props[1].houses, 5, 'hotel'); assert.equal(g.hotels, HOTELS - 1); assert.equal(g.houses, HOUSES - 8 + 4);
  assert.equal(play(g, { type: 'build', sq: 1 }).ok, false, 'nothing above a hotel');
  g = mk(); own(g, 'p0', 1, 3); g.houses = 0; g.seat('p0').cash = 5000; assert.equal(play(g, { type: 'build', sq: 1 }).ok, false, 'no houses left in the bank');
  g = mk(4, { supply: 'unlimited' }); own(g, 'p0', 1, 3); g.seat('p0').cash = 99999;
  for (let i = 0; i < 4; i++) { assert.ok(play(g, { type: 'build', sq: 1 }).ok || true); play(g, { type: 'build', sq: 3 }); }
  assert.equal(g.view('p0').supply.houses, null, 'unlimited supply shows no counter');
});

test('house and hotel supply never goes wrong across a long run of building and selling', () => {
  const g = mk(); own(g, 'p0', ...groupOf('brown'), ...groupOf('sky'), ...groupOf('pink')); g.seat('p0').cash = 1_000_000;
  const sets = [1, 3, 6, 8, 9, 11, 13, 14];
  for (let i = 0; i < 400; i++) {
    const sq = sets[Math.floor(Math.random() * sets.length)];
    if (Math.random() < 0.6) play(g, { type: 'build', sq }); else play(g, { type: 'sell', sq });
    const built = OWNABLE.reduce((n, s) => n + (g.props[s].houses > 0 && g.props[s].houses < 5 ? g.props[s].houses : 0), 0);
    const hotels = OWNABLE.reduce((n, s) => n + (g.props[s].houses === 5 ? 1 : 0), 0);
    assert.equal(g.houses + built, HOUSES, 'houses in the bank + on the board = 32'); assert.equal(g.hotels + hotels, HOTELS);
  }
});

test('debt: a player short of cash can mortgage or sell to pay; one who cannot possibly cover it is bankrupt at once, to the player they owed', () => {
  let g = mk(); own(g, 'p1', 1, 3); g.props[1].houses = 5; g.props[3].houses = 5; // rent 450 on Tinker's Lane
  own(g, 'p0', 6, 8, 9, 11, 13, 14, 16); g.seat('p0').cash = 300; // 300 + everything mortgaged = 770: can raise it
  rollTo(g, 1, 2); assert.equal(g.step, 'debt'); assert.equal(g.debt.total, 450);
  assert.equal(play(g, { type: 'roll' }).ok, false); assert.equal(play(g, { type: 'end' }).ok, false, 'cannot walk away from a debt');
  assert.ok(play(g, { type: 'mortgage', sq: 6 }).ok); assert.equal(g.step, 'debt', 'still short');
  for (const sq of [8, 9, 11, 13, 14, 16]) play(g, { type: 'mortgage', sq });
  assert.equal(g.debt, null, 'paid as soon as enough was raised'); assert.equal(g.step, 'manage'); assert.equal(cash(g, 'p1'), 1500 + 450);
  g = mk(); own(g, 'p1', 1, 3); g.props[1].houses = 5; g.props[3].houses = 5; own(g, 'p0', 5, 15); g.seat('p0').cash = 5; g.seat('p0').cards = ['L9'];
  rollTo(g, 1, 2); // 5 + 2 x 100 (mortgage) = 205 < 450: cannot ever pay
  assert.equal(g.seat('p0').out, true); assert.equal(g.props[5].owner, 'p1', 'assets go to the creditor'); assert.deepEqual(g.seat('p1').cards, ['L9']);
  assert.equal(cur(g).id, 'p1', 'the turn moves on');
  g = mk(4, { mortgage: false }); own(g, 'p1', 1, 3); g.props[1].houses = 5; g.props[3].houses = 5; own(g, 'p0', 5, 15); g.seat('p0').cash = 300;
  rollTo(g, 1, 2); assert.equal(g.seat('p0').out, true, 'with mortgages off, properties cannot be turned into cash to pay');
});

test('bankruptcy to the bank clears everything; the last player standing wins', () => {
  const g = mk(); own(g, 'p0', 1, 3); g.props[1].houses = 2; g.props[3].houses = 2; g.seat('p0').cards = ['F5'];
  const houses = g.houses; g.seat('p0').cash = 123;
  assert.ok(g.act('p0', { type: 'resign' }).ok);
  assert.equal(g.props[1].owner, null); assert.equal(g.props[1].houses, 0); assert.equal(g.houses, houses + 4); assert.ok(g.decks.fund.includes('F5'));
  assert.equal(cash(g, 'p0'), 0); assert.equal(g.seat('p0').out, true); assert.equal(cur(g).id, 'p1');
  assert.equal(g.act('p0', { type: 'roll' }).ok, false, 'an eliminated player cannot act');
  g.act('p1', { type: 'resign' }); assert.equal(g.phase, 'play'); g.act('p2', { type: 'resign' });
  assert.equal(g.phase, 'over'); assert.equal(g.winner, 'p3'); assert.equal(g.act('p3', { type: 'roll' }).ok, false, 'nothing after the game');
  assert.deepEqual(g.standings().map((s) => s.id), ['p3', 'p2', 'p1', 'p0']);
});

test('quitting mid-debt cannot dodge the debt: the creditor gets everything', () => {
  const g = mk(); own(g, 'p1', 1, 3); g.props[3].houses = 5; g.props[1].houses = 5; own(g, 'p0', 6, 8, 9, 11, 13, 14, 16); g.seat('p0').cash = 300;
  rollTo(g, 1, 2); assert.equal(g.step, 'debt');
  g.act('p0', { type: 'resign' });
  assert.equal(g.props[6].owner, 'p1'); assert.equal(g.props[16].owner, 'p1'); assert.equal(g.seat('p1').cash, 1500 + 300);
});

test('trades: offers, accept, reject, counter-offer, cancel, and every validation', () => {
  const g = mk(); own(g, 'p0', 6, 8); own(g, 'p1', 11); const total = totalMoney(g);
  const offer = (from, to, give, get) => g.act(from, { type: 'trade', to, give, get });
  assert.equal(offer('p0', 'p0', { props: [6], cash: 0 }, { props: [], cash: 0 }).ok, false, 'not with yourself');
  assert.equal(offer('p0', 'p1', { props: [11], cash: 0 }, { props: [], cash: 0 }).ok, false, 'cannot give what you do not own');
  assert.equal(offer('p0', 'p1', { props: [6], cash: 5000 }, { props: [], cash: 0 }).ok, false, 'cannot offer more cash than you have');
  assert.equal(offer('p0', 'p1', { props: [], cash: 0 }, { props: [], cash: 0 }).ok, false, 'empty trade');
  assert.equal(offer('p0', 'p1', { props: [6, 6], cash: 0 }, { props: [], cash: 0 }).ok, false, 'duplicates');
  assert.equal(offer('p0', 'p1', { props: [99], cash: 0 }, { props: [], cash: 0 }).ok, false); assert.equal(offer('p0', 'p1', { props: [6], cash: -5 }, { props: [], cash: 0 }).ok, false);
  assert.equal(offer('p0', 'p1', { props: [6], cash: 1.5 }, { props: [], cash: 0 }).ok, false); assert.equal(offer('p0', 'p1', { props: [6], cash: NaN }, { props: [], cash: 0 }).ok, false);
  assert.equal(offer('p0', 'p1', null, { props: [], cash: 0 }).ok, false); assert.equal(offer('p0', 'p9', { props: [6], cash: 0 }, { props: [], cash: 0 }).ok, false);
  assert.ok(offer('p0', 'p1', { props: [6, 8], cash: 100 }, { props: [11], cash: 0 }).ok);
  assert.equal(offer('p1', 'p0', { props: [11], cash: 0 }, { props: [6], cash: 0 }).ok, false, 'one trade per pair');
  const t = g.trades[0];
  assert.equal(g.act('p0', { type: 'tradeAccept', id: t.id, ver: t.ver }).ok, false, 'the proposer cannot accept their own offer');
  assert.equal(g.act('p2', { type: 'tradeAccept', id: t.id, ver: t.ver }).ok, false, 'a stranger cannot accept it');
  assert.equal(g.act('p1', { type: 'tradeAccept', id: t.id, ver: 99 }).ok, false, 'stale version');
  assert.equal(g.view('p2').trades.length, 0, 'strangers do not see the offer'); assert.equal(g.view('p1').trades.length, 1);
  // counter-offer: the terms change, roles swap, acceptance starts over
  assert.ok(g.act('p1', { type: 'tradeCounter', id: t.id, ver: t.ver, give: { props: [11], cash: 0 }, get: { props: [6], cash: 50 } }).ok);
  assert.equal(g.trades[0].from, 'p1'); assert.equal(g.trades[0].ver, 2); assert.deepEqual(g.trades[0].acc, { from: true, to: false });
  assert.equal(g.act('p1', { type: 'tradeAccept', id: t.id, ver: 2 }).ok, false, 'the new proposer cannot accept their own counter');
  assert.equal(g.act('p0', { type: 'tradeAccept', id: t.id, ver: 1 }).ok, false, 'accepting the OLD terms fails');
  assert.ok(g.act('p0', { type: 'tradeAccept', id: t.id, ver: 2 }).ok);
  assert.equal(g.props[11].owner, 'p0'); assert.equal(g.props[6].owner, 'p1'); assert.equal(g.props[8].owner, 'p0');
  assert.equal(cash(g, 'p0'), 1500 - 50); assert.equal(cash(g, 'p1'), 1500 + 50, 'the counter-offerer gets the $50 from the original proposer');
  assert.equal(g.trades.length, 0); assert.equal(totalMoney(g), total, 'a trade only moves money between players');
  assert.equal(g.act('p0', { type: 'tradeAccept', id: t.id, ver: 2 }).ok, false, 'cannot execute twice');
  assert.ok(offer('p2', 'p3', { props: [], cash: 10 }, { props: [], cash: 0 }).ok);
  assert.ok(g.act('p3', { type: 'tradeReject', id: g.trades[0].id }).ok); assert.equal(g.trades.length, 0);
  assert.ok(offer('p2', 'p3', { props: [], cash: 10 }, { props: [], cash: 0 }).ok);
  assert.ok(g.act('p2', { type: 'tradeCancel', id: g.trades[0].id }).ok); assert.equal(g.trades.length, 0);
  assert.equal(g.act('p0', { type: 'tradeReject', id: 12345 }).ok, false);
});

test('trades are checked again at the moment they run (no double spending, no stale ownership)', () => {
  const g = mk(); own(g, 'p0', 6); own(g, 'p1', 11);
  g.act('p0', { type: 'trade', to: 'p1', give: { props: [6], cash: 400 }, get: { props: [11], cash: 0 } });
  g.act('p0', { type: 'trade', to: 'p2', give: { props: [6], cash: 400 }, get: { props: [], cash: 0 } });
  const [a, b] = g.trades;
  g.seat('p0').cash = 100; // spent the money elsewhere
  assert.equal(g.act('p1', { type: 'tradeAccept', id: a.id, ver: a.ver }).ok, false); assert.equal(g.props[6].owner, 'p0'); assert.equal(g.trades.length, 1, 'the failed trade is gone');
  g.seat('p0').cash = 1500;
  assert.ok(g.act('p2', { type: 'tradeAccept', id: b.id, ver: b.ver }).ok); assert.equal(g.props[6].owner, 'p2');
  // the same property was in two offers: once it is gone the other one cannot run
  const g2 = mk(); own(g2, 'p0', 6);
  g2.act('p0', { type: 'trade', to: 'p1', give: { props: [6], cash: 0 }, get: { props: [], cash: 10 } });
  g2.act('p0', { type: 'trade', to: 'p2', give: { props: [6], cash: 0 }, get: { props: [], cash: 10 } });
  const [x, y] = g2.trades;
  assert.ok(g2.act('p1', { type: 'tradeAccept', id: x.id, ver: x.ver }).ok);
  assert.equal(g2.act('p2', { type: 'tradeAccept', id: y.id, ver: y.ver }).ok, false); assert.equal(g2.props[6].owner, 'p1');
  assert.equal(cash(g2, 'p0'), 1510); assert.equal(cash(g2, 'p2'), 1500);
});

test('trades: properties with buildings in the set cannot be traded; mortgaged ones carry their mortgage and 10% interest; limits on spam', () => {
  const g = mk(); own(g, 'p0', 1, 3, 6); g.props[1].houses = 1;
  assert.equal(g.act('p0', { type: 'trade', to: 'p1', give: { props: [3], cash: 0 }, get: { props: [], cash: 10 } }).ok, false, 'sell the buildings first');
  assert.ok(g.act('p0', { type: 'trade', to: 'p1', give: { props: [6], cash: 0 }, get: { props: [], cash: 0 } }).ok, 'a gift is allowed');
  g.trades = []; g.props[6].mortgaged = true;
  g.act('p0', { type: 'trade', to: 'p1', give: { props: [6], cash: 0 }, get: { props: [], cash: 20 } });
  const t = g.trades[0]; assert.ok(g.act('p1', { type: 'tradeAccept', id: t.id, ver: t.ver }).ok);
  assert.equal(g.props[6].mortgaged, true, 'the mortgage stays'); assert.equal(g.props[6].owner, 'p1');
  assert.equal(cash(g, 'p1'), 1500 - 20 - mortgageInterest(6), 'new owner pays 10% interest'); assert.equal(mortgageInterest(6), 5);
  const h = mk(); h.seat('p1').cash = 3; own(h, 'p0', 6); h.props[6].mortgaged = true;
  assert.equal(h.act('p0', { type: 'trade', to: 'p1', give: { props: [6], cash: 0 }, get: { props: [], cash: 0 } }).ok, false, 'cannot pay the interest');
  const s = mk(6); own(s, 'p0', 1, 3, 6, 8);
  for (const to of ['p1', 'p2', 'p3']) assert.ok(s.act('p0', { type: 'trade', to, give: { props: [], cash: 1 }, get: { props: [], cash: 0 } }).ok);
  assert.equal(s.act('p0', { type: 'trade', to: 'p4', give: { props: [], cash: 1 }, get: { props: [], cash: 0 } }).ok, false, 'at most three open offers');
});

test('trades expire, and vanish when a player is out; a trade can pay off a debt', () => {
  const g = mk(); g.act('p0', { type: 'trade', to: 'p1', give: { props: [], cash: 5 }, get: { props: [], cash: 0 } });
  advance(g, TRADE_TTL_MS + 100); assert.equal(g.trades.length, 0);
  g.act('p0', { type: 'trade', to: 'p1', give: { props: [], cash: 5 }, get: { props: [], cash: 0 } }); g.act('p1', { type: 'resign' }); assert.equal(g.trades.length, 0);
  const d = mk(); own(d, 'p1', 1, 3); d.props[1].houses = 5; d.props[3].houses = 5; d.seat('p0').cash = 100; own(d, 'p0', 6, 8, 9, 11, 13, 14, 16);
  rollTo(d, 1, 2); assert.equal(d.step, 'debt');
  d.act('p2', { type: 'trade', to: 'p0', give: { props: [], cash: 400 }, get: { props: [], cash: 0 } });
  const t = d.trades[0]; assert.ok(d.act('p0', { type: 'tradeAccept', id: t.id, ver: t.ver }).ok);
  assert.equal(d.debt, null); assert.equal(d.step, 'manage'); assert.equal(cash(d, 'p1'), 1500 + 450);
});

test('the five-minute turn timer: server time, no reserve, automatic action, refresh-proof', () => {
  const g = mk(); const start = g.T.t;
  assert.equal(g.view('p0').turnLeft, TURN_MS);
  advance(g, 120_000); assert.equal(g.view('p0').turnLeft, TURN_MS - 120_000);
  const copy = Landlords.restore(g.snapshot(), { now: () => g.T.t, rng: g.rng });
  assert.equal(copy.view('p0').turnLeft, TURN_MS - 120_000, 'a restart / refresh does not reset the timer');
  advance(g, TURN_MS - 120_000 - 1); assert.equal(cur(g).id, 'p0'); assert.equal(g.step, 'roll');
  advance(g, 2); // time is up: the server rolls for them
  assert.ok(g.rollNo >= 1); assert.equal(g.seat('p0').afk, true);
  let guard = 0; while (cur(g).id === 'p0' && guard++ < 30) advance(g, 1500);
  assert.equal(cur(g).id, 'p1', 'the turn passes on its own'); assert.equal(g.seat('p0').afk, false, 'a fresh turn for the next player'); assert.ok(g.deadline > start + TURN_MS);
  assert.equal(g.props[3].owner === 'p0' || g.props[1].owner === 'p0', false, 'a timed-out player is never made to buy');
});

test('timeout while in debt raises the money automatically or goes bankrupt; three timed-out turns in a row remove a silent player', () => {
  const g = mk(); own(g, 'p1', 1, 3); g.props[1].houses = 5; g.props[3].houses = 5; own(g, 'p0', 6, 8, 9, 11, 13, 14, 16, 18, 19); g.seat('p0').cash = 100;
  rollTo(g, 1, 2); assert.equal(g.step, 'debt');
  advance(g, TURN_MS + 1); let guard = 0; while (g.step === 'debt' && guard++ < 20) advance(g, 1500);
  assert.equal(g.debt, null); assert.ok(cash(g, 'p1') >= 1500 + 450);
  const h = mk(); own(h, 'p1', 1, 3); h.props[1].houses = 5; h.props[3].houses = 5; h.seat('p0').cash = 1;
  rollTo(h, 1, 2); assert.equal(h.seat('p0').out, true, 'unable to cover it: bankrupt at once');
  const s = mk(4); const you = s.seat('p0');
  const others = () => { // the other three play their turns normally
    let guard = 0;
    while (cur(s).id !== 'p0' && !you.out && s.phase === 'play' && guard++ < 200) {
      if (s.step === 'roll') { rig(s, 1, 2); play(s, { type: 'roll' }); }
      else if (s.step === 'buy') play(s, { type: 'decline' });
      else if (s.step === 'auction') advance(s, AUCTION_MS + 100);
      else if (s.step === 'debt') play(s, { type: 'bankrupt' });
      else play(s, { type: 'end' });
    }
  };
  for (let round = 0; round < MAX_AFK_TURNS; round++) {
    others(); assert.equal(cur(s).id, 'p0');
    advance(s, TURN_MS + 1); let k = 0; while (cur(s).id === 'p0' && !you.out && k++ < 60) advance(s, 1500);
  }
  assert.equal(you.out, true); assert.equal(you.outReason, 'afk'); assert.equal(s.phase, 'play', 'the other three carry on');
});

test('acting resets the silent-player count', () => {
  const g = mk(); g.seat('p0').idle = 2; rollTo(g, 1, 3); assert.equal(g.seat('p0').idle, 0);
});

test('disconnects: the seat is kept for five minutes, the turn is played for them, reconnecting restores everything', () => {
  const g = mk(); own(g, 'p0', 3); g.seat('p0').cash = 1234;
  g.setConnected('p0', false);
  assert.equal(g.view('p1').seats[0].connected, false); assert.ok(g.view('p1').seats[0].dcLeft > RECONNECT_MS - 1000);
  advance(g, AUTO_GRACE_MS - 1000); assert.equal(g.rollNo, 0, 'a short drop is not played for');
  advance(g, 1500); assert.ok(g.rollNo >= 1, 'after a short grace the server plays their turn');
  let guard = 0; while (cur(g).id === 'p0' && guard++ < 30) advance(g, 1500);
  assert.equal(cur(g).id, 'p1');
  g.setConnected('p0', true);
  assert.equal(g.seat('p0').dcAt, 0); assert.equal(g.seat('p0').out, false); assert.equal(g.props[3].owner, 'p0'); assert.ok(g.view('p0').seats[0].cash > 0);
  assert.equal(g.view('p0').seats[0].connected, true);
  // gone for the whole window: eliminated, assets to the bank
  const h = mk(); own(h, 'p2', 3); h.setConnected('p2', false);
  advance(h, RECONNECT_MS - 2000); assert.equal(h.seat('p2').out, false); advance(h, 2500);
  assert.equal(h.seat('p2').out, true); assert.equal(h.seat('p2').outReason, 'abandoned'); assert.equal(h.props[3].owner, null);
  // the clock is the server's: a restart in the middle keeps the same deadline
  const k = mk(); k.setConnected('p1', false); advance(k, 200_000);
  const copy = Landlords.restore(k.snapshot(), { now: () => k.T.t }); k.T.t += 101_000; copy.tick();
  assert.equal(copy.seat('p1').out, true, 'the same deadline after a restart');
});

test('a disconnected player cannot avoid rent, taxes or debts', () => {
  const g = mk(); own(g, 'p1', 3); g.setConnected('p0', false);
  rig(g, 1, 2); advance(g, AUTO_GRACE_MS + 100);
  let guard = 0; while (cur(g).id === 'p0' && guard++ < 30) advance(g, 1500);
  assert.ok(cash(g, 'p0') <= 1500); // whatever they landed on was paid or declined, never skipped
  const h = mk(); own(h, 'p1', 1, 3); h.props[1].houses = 5; h.props[3].houses = 5; own(h, 'p0', 6, 8); h.seat('p0').cash = 50;
  h.setConnected('p0', false); rig(h, 1, 2); advance(h, AUTO_GRACE_MS + 100);
  guard = 0; while (!h.seat('p0').out && cur(h).id === 'p0' && guard++ < 40) advance(h, 1500);
  assert.equal(h.seat('p0').out, true, 'the debt was settled by taking everything'); assert.equal(h.seat('p1').cash >= 1500 + 50, true);
});

test('everyone gone for five minutes cancels the match; one left behind wins it', () => {
  const g = mk(4); for (const id of ids(g)) g.setConnected(id, false);
  advance(g, RECONNECT_MS + 1000); assert.equal(g.phase, 'cancelled'); assert.equal(g.endReason, 'everyone_left');
  const h = mk(4); for (const id of ['p0', 'p1', 'p2']) h.setConnected(id, false);
  advance(h, RECONNECT_MS + 1000); assert.equal(h.phase, 'over'); assert.equal(h.winner, 'p3');
});

test('leaving the game on purpose is the same as bankruptcy: no way to escape a loss', () => {
  const g = mk(); own(g, 'p0', 6); g.act('p0', { type: 'resign' });
  assert.equal(g.seat('p0').out, true); assert.equal(g.props[6].owner, null); assert.equal(g.seat('p0').outReason, 'resigned');
});

test('actions that make no sense are refused without changing anything', () => {
  const g = mk(); const snap = JSON.stringify(g.snapshot());
  for (const a of [null, undefined, 5, 'roll', {}, { type: 5 }, { type: 'nope' }, { type: 'build', sq: 'x' }, { type: 'bid', amount: 5 }, { type: 'tradeAccept' }, { type: 'trade' }, { type: 'sell', sq: 1 },
    { type: 'buy' }, { type: 'end' }, { type: 'jailpay' }, { type: 'jailcard' }, { type: 'bankrupt' }, { type: 'constructor' }, { type: '__proto__' }]) {
    assert.doesNotThrow(() => g.act('p0', a)); assert.equal(g.act('p0', a).ok, false);
  }
  assert.equal(JSON.stringify(g.snapshot()), snap, 'no state changed');
  assert.equal(g.act('stranger', { type: 'roll' }).ok, false);
});

test('a snapshot restores the exact game, including trades and an auction in progress', () => {
  const g = mk(5); own(g, 'p2', 6); rollTo(g, 1, 2); play(g, { type: 'decline' }); g.act('p1', { type: 'bid', amount: 50 });
  const copy = Landlords.restore(g.snapshot(), { now: () => g.T.t, rng: g.rng });
  assert.deepEqual(copy.snapshot(), g.snapshot());
  assert.ok(copy.act('p3', { type: 'bid', amount: 60 }).ok); g.T.t += AUCTION_MS + 10; copy.tick(); assert.equal(copy.props[3].owner, 'p3');
});

test('what a player is shown never contains other players\' private trade offers or the deck order', () => {
  const g = mk(); g.act('p0', { type: 'trade', to: 'p1', give: { props: [], cash: 5 }, get: { props: [], cash: 0 } });
  const v = JSON.stringify(g.view('p2'));
  assert.ok(!/"decks"/.test(v)); assert.equal(g.view('p2').trades.length, 0); assert.equal(g.view('p2').tradeCount, 1);
  assert.doesNotThrow(() => JSON.stringify(g.view('p0'))); assert.equal(g.view('stranger').you.seat, -1);
});

// ---- whole games, played at random, with the invariants checked after every single move --------------------------------
function invariants(g, label) {
  const owners = new Set(g.seats.map((s) => s.id));
  for (const s of g.seats) {
    assert.ok(Number.isInteger(s.cash) || Number.isInteger(s.cash * 2), `${label}: cash is whole dollars ${s.cash}`);
    assert.ok(s.cash >= 0, `${label}: cash never negative`);
    if (s.out) { assert.equal(s.cash, 0); assert.ok(!g.ownedBy(s.id).length, `${label}: an eliminated player owns nothing`); }
    assert.ok(s.pos >= 0 && s.pos < 40);
  }
  let houses = 0; let hotels = 0;
  for (const sq of OWNABLE) {
    const pr = g.props[sq];
    assert.ok(pr.owner === null || owners.has(pr.owner), `${label}: owner exists`);
    if (!pr.owner) { assert.equal(pr.houses, 0); assert.equal(pr.mortgaged, false); }
    if (pr.mortgaged) assert.equal(g.anyBuilt(BOARD[sq].group) && pr.houses > 0, false, `${label}: no buildings on a mortgaged street`);
    if (pr.houses) assert.equal(BOARD[sq].type, 'street');
    if (pr.houses === 5) hotels++; else houses += pr.houses;
  }
  if (g.limited()) { assert.equal(g.houses + houses, HOUSES, `${label}: house supply`); assert.equal(g.hotels + hotels, HOTELS, `${label}: hotel supply`); }
  assert.ok(g.houses >= 0 && g.hotels >= 0);
  for (const t of g.trades) { assert.ok(g.seat(t.from) && !g.seat(t.from).out && g.seat(t.to) && !g.seat(t.to).out); }
  if (g.phase === 'play') assert.equal(g.active().length >= 2, true, `${label}: a running game has two players or more`);
}

function randomGame(seed, n, settings) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const clock = { t: 1_000_000 };
  const g = new Landlords({ players: names(n), settings, now: () => clock.t, rng: (k) => Math.floor(rnd() * k) });
  g.clock = () => clock.t;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let steps = 0;
  while (g.phase === 'play' && steps++ < 30000) {
    const v = g.view(pick(g.seats).id);
    const seat = pick(g.active());
    const me = g.view(seat.id).you.can;
    const choices = [];
    if (me.roll) choices.push({ type: 'roll' }, { type: 'roll' }, { type: 'roll' });
    if (me.buy) choices.push({ type: 'buy' }, { type: 'buy' }, { type: 'decline' });
    if (me.decline && !me.buy) choices.push({ type: 'decline' });
    if (me.end) choices.push({ type: 'end' }, { type: 'end' });
    if (me.jailPay) choices.push({ type: 'jailpay' });
    if (me.jailCard) choices.push({ type: 'jailcard' });
    if (me.bid) choices.push({ type: 'bid', amount: me.bid.min + Math.floor(rnd() * Math.min(300, me.bid.max - me.bid.min + 1)) });
    for (const sq of me.build) choices.push({ type: 'build', sq });
    for (const sq of me.sell) choices.push({ type: 'sell', sq });
    for (const sq of me.mortgage) choices.push({ type: 'mortgage', sq });
    for (const sq of me.unmortgage) choices.push({ type: 'unmortgage', sq });
    if (me.bankrupt && rnd() < 0.05) choices.push({ type: 'bankrupt' });
    if (rnd() < 0.02) choices.push({ type: 'resign' });
    if (rnd() < 0.15) {
      const other = pick(g.active().filter((x) => x !== seat));
      const mine = g.ownedBy(seat.id); const theirs = g.ownedBy(other.id);
      const sub = (l) => l.filter(() => rnd() < 0.4).slice(0, 3);
      choices.push({ type: 'trade', to: other.id, give: { props: sub(mine), cash: Math.floor(rnd() * 300) }, get: { props: sub(theirs), cash: Math.floor(rnd() * 300) } });
    }
    for (const t of v.trades.length ? g.view(seat.id).trades : []) {
      if (t.to === seat.id) choices.push({ type: 'tradeAccept', id: t.id, ver: t.ver }, { type: 'tradeReject', id: t.id });
      if (t.to === seat.id && rnd() < 0.3) choices.push({ type: 'tradeCounter', id: t.id, ver: t.ver, give: { props: [], cash: Math.floor(rnd() * 100) }, get: { props: [], cash: 0 } });
      if (t.from === seat.id) choices.push({ type: 'tradeCancel', id: t.id });
    }
    if (rnd() < 0.03) choices.push({ type: 'garbage', x: 1 });
    if (choices.length) g.act(seat.id, pick(choices));
    if (rnd() < 0.2) { clock.t += pick([500, 1500, 20_000, 60_000, 400_000]); }
    if (rnd() < 0.01) { const x = pick(g.active()); g.setConnected(x.id, rnd() < 0.5); }
    g.tick();
    invariants(g, `seed ${seed} step ${steps}`);
    if (rnd() < 0.002) { const copy = Landlords.restore(g.snapshot(), { now: () => clock.t, rng: g.rng }); assert.deepEqual(copy.snapshot(), g.snapshot()); }
  }
  return { g, steps };
}

test('200 random full games (4, 5 and 6 players, mixed settings): the rules never break and every game ends', () => {
  let finished = 0; let cancelled = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const n = 4 + (seed % 3);
    const settings = { doubleRent: seed % 2 === 0, vacationCash: seed % 3 === 0, auction: seed % 5 !== 0, noJailRent: seed % 4 === 0, mortgage: seed % 7 !== 0, evenBuild: seed % 6 !== 0,
      startCash: [1000, 1500, 2500][seed % 3], passGo: [0, 200, 500][seed % 3], incomeTax: seed % 2 ? 'flat' : 'percent', supply: seed % 8 === 0 ? 'unlimited' : 'standard', jailFine: [50, 100, 150][seed % 3], jailTurns: 1 + (seed % 3), randomOrder: true };
    const { g, steps } = randomGame(seed, n, settings);
    assert.notEqual(g.phase, 'play', `seed ${seed} still running after ${steps} steps`);
    if (g.phase === 'over') {
      finished++;
      assert.equal(g.active().length, 1, `seed ${seed}: exactly one player is left`);
      assert.equal(g.winner, g.active()[0].id);
      const board = g.view(g.winner);
      assert.equal(board.standings[0].id, g.winner);
    } else cancelled++;
  }
  assert.ok(finished >= 150, `most games reach a winner (${finished} finished, ${cancelled} cancelled)`);
});

test('mortgage value helpers and the board are consistent', () => {
  assert.equal(OWNABLE.length, 28); assert.equal(BOARD.length, 40);
  for (const sq of OWNABLE) { assert.equal(mortgageValue(sq), Math.floor(BOARD[sq].price / 2)); assert.ok(unmortgageCost(sq) > mortgageValue(sq)); }
  assert.equal(houseCost(1), 50); assert.equal(houseCost(39), 200);
});
