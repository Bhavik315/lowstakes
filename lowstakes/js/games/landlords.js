// Landlords: the rules engine. It runs only on the game server and is the single source of truth for a match: dice,
// turn order, timers, movement, ownership, rent, taxes, auctions, trades, mortgages, bankruptcy and the winner.
// Clients only ever send small requests ("buy", "bid 120", "trade ...") which are checked here; nothing a client says about
// money, dice or ownership is believed.
//
// In-game cash is its own currency. It never touches a Low Stakes wallet: the entry fee and the prize pool are handled by the
// server's wallet layer, which is told only who won (or that the match was cancelled).
//
// All state is plain JSON (no functions, Sets or Dates) so the server can snapshot it and carry on after a restart.
// Time is always the server clock passed in as `now`; refreshing a page cannot reset a timer.
import { randInt, shuffle } from '../core/cards.js?v=62';
import {
  BOARD, OWNABLE, STATIONS, UTILITIES, GROUPS, START, JAIL, VACATION, LUCK, FUND, CARD, INCOME_TAX,
  cleanSettings, groupOf, mortgageValue, unmortgageCost, mortgageInterest, houseCost, isSquareList, MAX_SEATS, MIN_SEATS,
} from './landlords-data.js?v=62';

export const TURN_MS = 300_000; // exactly five minutes per turn, no reserve
export const RECONNECT_MS = 300_000; // a disconnected seat is kept this long
export const AUTO_GRACE_MS = 15_000; // a disconnected player's turn is played for them after this
export const AUTO_GAP_MS = 1_400; // pause between automatic steps so everyone can follow
export const AUCTION_MS = 30_000;
export const AUCTION_EXT_MS = 10_000;
export const BID_STEP = 10;
export const TRADE_TTL_MS = 600_000;
export const MAX_AFK_TURNS = 3; // timed-out turns in a row before a silent player is removed
export const HOUSES = 32;
export const HOTELS = 12;
const BIG = 9999;

const isInt = (n) => Number.isInteger(n);
const fail = (error) => ({ ok: false, error });
const OK = { ok: true };

export class Landlords {
  constructor({ players, settings, now = () => Date.now(), rng = randInt } = {}) {
    this.clock = now;
    this.rng = rng;
    if (!players) return; // restore() fills everything in
    if (players.length < MIN_SEATS || players.length > MAX_SEATS) throw new Error('bad_player_count');
    this.settings = cleanSettings(settings);
    const order = players.map((p) => ({ id: p.id, name: p.name }));
    if (this.settings.randomOrder) shuffle(order, this.rng);
    this.seats = order.map((p) => ({
      id: p.id, name: p.name, cash: this.settings.startCash, pos: 0, jail: 0, cards: [], doubles: 0,
      out: false, outReason: '', outAt: 0, dcAt: 0, afk: false, idle: 0,
    }));
    this.props = {};
    for (const sq of OWNABLE) this.props[sq] = { owner: null, houses: 0, mortgaged: false };
    const unlimited = this.settings.supply === 'unlimited';
    this.houses = unlimited ? BIG : HOUSES;
    this.hotels = unlimited ? BIG : HOTELS;
    this.pot = 0; // vacation cash
    this.decks = { luck: shuffle(LUCK.map((c) => c.id), this.rng), fund: shuffle(FUND.map((c) => c.id), this.rng) };
    this.phase = 'play';
    this.winner = null;
    this.endReason = '';
    this.outOrder = [];
    this.turn = 0;
    this.step = 'roll';
    this.dice = [0, 0];
    this.rollNo = 0;
    this.dbl = false;
    this.again = false;
    this.pendingMove = 0;
    this.rentMod = null;
    this.debt = null;
    this.auction = null;
    this.trades = [];
    this.tradeSeq = 0;
    this.card = null;
    this.events = [];
    this.evId = 0;
    this.log = [];
    this.startedAt = this.clock();
    this.endedAt = 0;
    this.deadline = 0;
    this.actAt = Infinity;
    this.say(`The game begins. ${this.seats[0].name} goes first.`);
    this.beginTurn();
  }

  // ---- snapshots (for restarts) ------------------------------------------------------------------------
  snapshot() { const o = {}; for (const k of Object.keys(this)) if (k !== 'clock' && k !== 'rng') o[k] = this[k]; return JSON.parse(JSON.stringify(o)); }
  static restore(snap, { now = () => Date.now(), rng = randInt } = {}) { const g = new Landlords({ now, rng }); Object.assign(g, JSON.parse(JSON.stringify(snap))); return g; }

  // ---- lookups -------------------------------------------------------------------------------------------
  seat(id) { return this.seats.find((s) => s.id === id); }
  cur() { return this.seats[this.turn]; }
  idx(s) { return this.seats.indexOf(s); }
  active() { return this.seats.filter((s) => !s.out); }
  ownedBy(id) { return OWNABLE.filter((sq) => this.props[sq].owner === id); }
  owns(id, sq) { return this.props[sq] && this.props[sq].owner === id; }
  ev(type, data = {}) { this.events.push({ id: ++this.evId, type, ...data }); if (this.events.length > 40) this.events.shift(); }
  say(text) { this.log.push({ id: this.evId, text, at: this.clock() }); if (this.log.length > 60) this.log.shift(); }
  nm(id) { const s = this.seat(id); return s ? s.name : 'Someone'; }
  limited() { return this.settings.supply !== 'unlimited'; }

  worth(seat) {
    let w = seat.cash;
    for (const sq of this.ownedBy(seat.id)) {
      const pr = this.props[sq];
      w += pr.mortgaged ? mortgageValue(sq) : BOARD[sq].price;
      w += pr.houses * houseCost(sq);
    }
    return w;
  }
  // What a player could raise if they sold every building and mortgaged everything.
  liquidation(seat) {
    let w = seat.cash;
    for (const sq of this.ownedBy(seat.id)) {
      const pr = this.props[sq];
      w += (pr.houses * houseCost(sq)) / 2;
      if (this.settings.mortgage && !pr.mortgaged) w += mortgageValue(sq);
    }
    return w;
  }

  // ---- turns -----------------------------------------------------------------------------------------------
  beginTurn() {
    const seat = this.cur();
    seat.doubles = 0; seat.afk = false;
    this.again = false; this.dbl = false; this.card = null; this.rentMod = null;
    this.step = 'roll';
    this.deadline = this.clock() + TURN_MS;
    this.ev('turn', { pid: seat.id });
    this.schedule();
  }

  // When the server will next act for the player whose turn it is (their time running out, or being gone).
  schedule() {
    const seat = this.cur();
    const t = this.clock();
    if (this.phase !== 'play' || !seat || this.step === 'auction') { this.actAt = Infinity; return; }
    if (seat.dcAt) this.actAt = Math.max(t + AUTO_GAP_MS, seat.dcAt + AUTO_GRACE_MS);
    else if (seat.afk) this.actAt = t + AUTO_GAP_MS;
    else this.actAt = this.deadline;
  }

  nextTurn() {
    if (this.phase !== 'play') return;
    if (this.cur()) this.cur().afk = false;
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.turn + k) % n;
      if (!this.seats[i].out) { this.turn = i; break; }
    }
    this.beginTurn();
  }

  // ---- actions from players ---------------------------------------------------------------------------------
  act(pid, a) {
    if (this.phase !== 'play') return fail('game_over');
    const seat = this.seat(pid);
    if (!seat || seat.out) return fail('not_playing');
    if (!a || typeof a.type !== 'string') return fail('bad_action');
    let r;
    try { r = this.handle(seat, a); } catch (e) { return fail('error'); }
    if (r === true) r = OK;
    if (typeof r === 'string') r = fail(r);
    if (r && r.ok) {
      seat.idle = 0; seat.afk = false;
      if (this.phase === 'play') this.schedule();
    }
    return r || fail('refused');
  }

  handle(seat, a) {
    const mine = this.cur() === seat;
    switch (a.type) {
      case 'roll': return mine && this.step === 'roll' ? this.roll() : 'not_now';
      case 'buy': return mine && this.step === 'buy' ? this.buy(seat) : 'not_now';
      case 'decline': return mine && this.step === 'buy' ? this.decline(seat) : 'not_now';
      case 'end': if (!mine || this.step !== 'manage') return 'not_now'; if (this.again) { this.again = false; this.step = 'roll'; } else this.nextTurn(); return true;
      case 'jailpay': return this.jailPay(seat, mine);
      case 'jailcard': return this.jailCard(seat, mine);
      case 'build': return this.build(seat, a.sq);
      case 'sell': return this.sell(seat, a.sq);
      case 'mortgage': return this.mortgage(seat, a.sq);
      case 'unmortgage': return this.unmortgage(seat, a.sq);
      case 'bankrupt': if (!this.debt || this.debt.pid !== seat.id) return 'not_now'; return this.eliminate(seat, 'bankrupt');
      case 'resign': return this.eliminate(seat, 'resigned');
      case 'bid': return this.bid(seat, a.amount);
      case 'trade': return this.tradeNew(seat, a);
      case 'tradeAccept': return this.tradeAccept(seat, a);
      case 'tradeReject': return this.tradeReject(seat, a);
      case 'tradeCounter': return this.tradeCounter(seat, a);
      case 'tradeCancel': return this.tradeReject(seat, a);
      default: return 'bad_action';
    }
  }

  // ---- movement and squares ------------------------------------------------------------------------------------
  roll() {
    const seat = this.cur();
    const d1 = this.rng(6) + 1; const d2 = this.rng(6) + 1;
    this.dice = [d1, d2]; this.rollNo++;
    const total = d1 + d2; const dbl = d1 === d2;
    this.ev('roll', { pid: seat.id, dice: [d1, d2] });
    if (seat.jail > 0) {
      if (dbl) {
        seat.jail = 0; seat.doubles = 0; this.dbl = false;
        this.say(`${seat.name} rolls doubles and is out of Lockup.`);
        this.moveBy(seat, total);
        return this.landOn(seat);
      }
      if (seat.jail >= this.settings.jailTurns) {
        this.say(`${seat.name} has used every turn in Lockup and must pay the $${this.settings.jailFine} fine.`);
        this.dbl = false; this.pendingMove = total;
        return this.pay(seat, this.settings.jailFine, 'bank', 'jailfine', 'jailMove');
      }
      seat.jail++;
      this.dbl = false;
      this.say(`${seat.name} stays in Lockup.`);
      return this.afterLand();
    }
    if (dbl) {
      seat.doubles++;
      if (seat.doubles >= 3) {
        this.say(`${seat.name} rolled doubles three times in a row and goes to Lockup.`);
        this.goJail(seat);
        return this.afterLand();
      }
    } else seat.doubles = 0;
    this.dbl = dbl;
    this.moveBy(seat, total);
    return this.landOn(seat);
  }

  moveBy(seat, n) {
    const from = seat.pos;
    const to = (from + n + 40) % 40;
    if (n > 0 && to < from) this.passStart(seat);
    seat.pos = to;
    this.ev('move', { pid: seat.id, from, to });
  }
  moveTo(seat, to) {
    const from = seat.pos;
    if (to < from) this.passStart(seat);
    seat.pos = to;
    this.ev('move', { pid: seat.id, from, to });
  }
  passStart(seat) {
    const b = this.settings.passGo;
    if (b > 0) { seat.cash += b; this.say(`${seat.name} passes Start and collects $${b}.`); this.ev('money', { pid: seat.id, n: b }); }
  }
  goJail(seat) {
    const from = seat.pos;
    seat.pos = JAIL; seat.jail = 1; seat.doubles = 0; this.dbl = false;
    this.ev('move', { pid: seat.id, from, to: JAIL, jail: true });
  }

  landOn(seat) {
    const sq = BOARD[seat.pos];
    switch (sq.type) {
      case 'tax': {
        let amount = sq.amount;
        if (sq.tax === 'income') amount = this.settings.incomeTax === 'percent' ? Math.round(this.worth(seat) / 10) : INCOME_TAX;
        this.say(`${seat.name} pays $${amount} ${sq.name.toLowerCase()}.`);
        return this.pay(seat, amount, 'bank', 'tax', 'afterLand');
      }
      case 'gojail': this.say(`${seat.name} is sent to Lockup.`); this.goJail(seat); return this.afterLand();
      case 'luck': return this.draw(seat, 'luck');
      case 'fund': return this.draw(seat, 'fund');
      case 'vacation':
        if (this.settings.vacationCash && this.pot > 0) {
          seat.cash += this.pot; this.say(`${seat.name} lands on Vacation and collects $${this.pot}.`); this.ev('money', { pid: seat.id, n: this.pot }); this.pot = 0;
        }
        return this.afterLand();
      case 'street': case 'station': case 'utility': break;
      default: return this.afterLand();
    }
    const pr = this.props[sq.i];
    if (!pr.owner) {
      if (seat.cash >= sq.price) { this.step = 'buy'; this.schedule(); return true; }
      this.say(`${seat.name} cannot afford ${sq.name}.`);
      return this.startAuction(seat, sq.i);
    }
    if (pr.owner === seat.id) return this.afterLand();
    const owner = this.seat(pr.owner);
    if (pr.mortgaged) { this.say(`${sq.name} is mortgaged, so no rent is due.`); return this.afterLand(); }
    if (this.settings.noJailRent && owner.jail > 0) { this.say(`${owner.name} is in Lockup and collects no rent.`); return this.afterLand(); }
    let dice = this.dice[0] + this.dice[1];
    if (sq.type === 'utility' && this.rentMod && this.rentMod.utility) {
      this.dice = [this.rng(6) + 1, this.rng(6) + 1]; this.rollNo++; dice = this.dice[0] + this.dice[1];
      this.ev('roll', { pid: seat.id, dice: this.dice });
    }
    const rent = this.rentFor(sq.i, dice);
    this.rentMod = null;
    this.say(`${seat.name} owes ${owner.name} $${rent} rent for ${sq.name}.`);
    this.ev('rent', { from: seat.id, to: owner.id, n: rent, sq: sq.i });
    return this.pay(seat, rent, owner.id, 'rent', 'afterLand');
  }

  rentFor(sq, dice) {
    const s = BOARD[sq]; const pr = this.props[sq];
    if (!pr.owner || pr.mortgaged) return 0;
    if (s.type === 'station') {
      const n = STATIONS.filter((x) => this.props[x].owner === pr.owner).length;
      return 25 * 2 ** (n - 1) * (this.rentMod && this.rentMod.station ? 2 : 1);
    }
    if (s.type === 'utility') {
      const n = UTILITIES.filter((x) => this.props[x].owner === pr.owner).length;
      return (this.rentMod && this.rentMod.utility ? 10 : n >= 2 ? 10 : 4) * dice;
    }
    if (pr.houses > 0) return s.rents[pr.houses];
    const full = groupOf(s.group).every((x) => this.props[x].owner === pr.owner);
    return s.rents[0] * (this.settings.doubleRent && full ? 2 : 1);
  }

  draw(seat, which) {
    const deck = this.decks[which];
    const id = deck.shift();
    const c = CARD[id];
    if (c.t !== 'free') deck.push(id);
    this.card = { id, deck: which, text: c.text, pid: seat.id };
    this.ev('draw', { pid: seat.id, deck: which, text: c.text });
    this.say(`${seat.name} draws: ${c.text}`);
    switch (c.t) {
      case 'move': this.moveTo(seat, c.to); return this.landOn(seat);
      case 'near': {
        const list = c.kind === 'station' ? STATIONS : UTILITIES;
        const to = list.find((x) => x > seat.pos) ?? list[0];
        this.rentMod = c.kind === 'station' ? { station: 2 } : { utility: 10 };
        this.moveTo(seat, to);
        return this.landOn(seat);
      }
      case 'cash':
        if (c.n >= 0) { seat.cash += c.n; this.ev('money', { pid: seat.id, n: c.n }); return this.afterLand(); }
        return this.pay(seat, -c.n, 'bank', 'card', 'afterLand');
      case 'free': seat.cards.push(id); return this.afterLand();
      case 'back': this.moveBy(seat, -c.n); return this.landOn(seat);
      case 'jail': this.goJail(seat); return this.afterLand();
      case 'repair': {
        let total = 0;
        for (const sq of this.ownedBy(seat.id)) { const h = this.props[sq].houses; total += h === 5 ? c.hotel : h * c.house; }
        return this.pay(seat, total, 'bank', 'card', 'afterLand');
      }
      case 'each': return this.pay(seat, c.n, 'each', 'card', 'afterLand');
      case 'collect':
        for (const o of this.active()) { if (o === seat) continue; const take = Math.min(o.cash, c.n); o.cash -= take; seat.cash += take; }
        return this.afterLand();
      default: return this.afterLand();
    }
  }

  // Pay `amount` to a player id, 'bank', or 'each' (amount to every other player). A player who is short gets the chance to
  // raise the money (sell buildings, mortgage, trade); one who cannot possibly cover it is bankrupt at once.
  pay(seat, amount, to, why, cont) {
    const others = this.active().filter((s) => s !== seat);
    const total = to === 'each' ? amount * others.length : amount;
    if (total <= 0) return this.resume(cont);
    if (seat.cash >= total) { this.transfer(seat, amount, to, others, total, why); return this.resume(cont); }
    if (this.liquidation(seat) < total) {
      this.say(`${seat.name} cannot cover $${total} and is bankrupt.`);
      return this.eliminate(seat, 'bankrupt', to === 'bank' || to === 'each' ? 'bank' : to);
    }
    this.debt = { pid: seat.id, to, amount, total, why, cont };
    this.step = 'debt';
    this.say(`${seat.name} owes $${total} and must raise the money or give up.`);
    return true;
  }

  transfer(seat, amount, to, others, total, why) {
    seat.cash -= total;
    if (to === 'each') for (const o of others) o.cash += amount;
    else if (to === 'bank') { if (this.settings.vacationCash && why !== 'buy') this.pot += total; }
    else { const r = this.seat(to); if (r) r.cash += amount; }
    this.ev('money', { pid: seat.id, n: -total });
  }

  resume(cont) {
    const seat = this.cur();
    if (cont === 'jailMove') { seat.jail = 0; this.moveBy(seat, this.pendingMove); return this.landOn(seat); }
    return this.afterLand();
  }

  afterLand() {
    if (this.phase !== 'play') return true;
    const seat = this.cur();
    if (!seat || seat.out) return true;
    this.again = this.dbl && seat.jail === 0;
    this.rentMod = null;
    this.step = 'manage';
    return true;
  }

  tryPayDebt() {
    const d = this.debt;
    if (!d) return;
    const seat = this.seat(d.pid);
    if (!seat || seat.out || seat.cash < d.total) return;
    const others = this.active().filter((s) => s !== seat);
    this.debt = null;
    this.transfer(seat, d.amount, d.to, others, d.total, d.why);
    this.say(`${seat.name} pays the $${d.total}.`);
    this.resume(d.cont);
  }

  // ---- buying and auctions ----------------------------------------------------------------------------------------
  buy(seat) {
    const sq = BOARD[seat.pos];
    if (!sq.price || this.props[sq.i].owner || seat.cash < sq.price) return 'cannot_buy';
    seat.cash -= sq.price; this.props[sq.i].owner = seat.id;
    this.say(`${seat.name} buys ${sq.name} for $${sq.price}.`);
    this.ev('buy', { pid: seat.id, sq: sq.i });
    return this.afterLand();
  }
  decline(seat) {
    const sq = BOARD[seat.pos];
    this.say(`${seat.name} passes on ${sq.name}.`);
    return this.startAuction(seat, sq.i);
  }
  startAuction(seat, sq) {
    if (!this.settings.auction) { this.say(`${BOARD[sq].name} stays with the bank.`); return this.afterLand(); }
    const t = this.clock();
    this.auction = { sq, bid: 0, bidder: null, startedAt: t, endsAt: t + AUCTION_MS };
    this.step = 'auction';
    this.ev('auction', { sq });
    this.say(`${BOARD[sq].name} goes to auction.`);
    return true;
  }
  bid(seat, amount) {
    const a = this.auction;
    if (!a || this.step !== 'auction') return 'not_now';
    if (!isInt(amount)) return 'bad_amount';
    const min = a.bid === 0 ? BID_STEP : a.bid + BID_STEP;
    if (amount < min) return 'bid_too_low';
    if (amount > seat.cash) return 'not_enough_cash';
    if (a.bidder === seat.id) return 'already_highest';
    a.bid = amount; a.bidder = seat.id;
    a.endsAt = Math.max(a.endsAt, this.clock() + AUCTION_EXT_MS);
    this.ev('bid', { pid: seat.id, n: amount, sq: a.sq });
    return true;
  }
  endAuction() {
    const a = this.auction;
    if (!a) return;
    const t = this.clock();
    const buyer = a.bidder && this.seat(a.bidder);
    this.auction = null;
    if (buyer && !buyer.out && buyer.cash >= a.bid) {
      buyer.cash -= a.bid; this.props[a.sq].owner = buyer.id;
      this.say(`${buyer.name} wins ${BOARD[a.sq].name} at auction for $${a.bid}.`);
      this.ev('buy', { pid: buyer.id, sq: a.sq, auction: true });
    } else this.say(`${BOARD[a.sq].name} is not sold.`);
    this.deadline += t - a.startedAt; // the time spent in the auction is not taken out of the turn
    this.afterLand();
    this.schedule();
  }

  // ---- jail ---------------------------------------------------------------------------------------------------------
  jailPay(seat, mine) {
    if (!mine || this.step !== 'roll' || seat.jail <= 0) return 'not_now';
    const fine = this.settings.jailFine;
    if (seat.cash < fine) return 'not_enough_cash';
    seat.cash -= fine; seat.jail = 0;
    if (this.settings.vacationCash) this.pot += fine;
    this.say(`${seat.name} pays $${fine} and leaves Lockup.`);
    this.ev('money', { pid: seat.id, n: -fine });
    return true;
  }
  jailCard(seat, mine) {
    if (!mine || this.step !== 'roll' || seat.jail <= 0 || !seat.cards.length) return 'not_now';
    const id = seat.cards.shift();
    this.decks[id[0] === 'L' ? 'luck' : 'fund'].push(id);
    seat.jail = 0;
    this.say(`${seat.name} uses a Get out of Lockup free card.`);
    return true;
  }

  // ---- buildings and mortgages ---------------------------------------------------------------------------------------
  groupHouses(sq) { return groupOf(BOARD[sq].group).map((x) => this.props[x].houses); }
  fullSet(id, group) { return groupOf(group).every((x) => this.props[x].owner === id); }
  anyBuilt(group) { return groupOf(group).some((x) => this.props[x].houses > 0); }
  sqOf(v) { return isInt(v) && OWNABLE.includes(v) ? v : -1; }

  canBuild(seat, sq) {
    sq = this.sqOf(sq);
    const s = BOARD[sq];
    if (sq < 0 || s.type !== 'street' || !this.owns(seat.id, sq)) return false;
    const pr = this.props[sq];
    if (this.step === 'auction' || this.step === 'debt' || pr.houses >= 5) return false;
    if (!this.fullSet(seat.id, s.group) || groupOf(s.group).some((x) => this.props[x].mortgaged)) return false;
    if (this.settings.evenBuild && pr.houses > Math.min(...this.groupHouses(sq))) return false;
    if (seat.cash < houseCost(sq)) return false;
    if (this.limited() && (pr.houses === 4 ? this.hotels < 1 : this.houses < 1)) return false;
    return true;
  }
  canSell(seat, sq) {
    sq = this.sqOf(sq);
    if (sq < 0 || BOARD[sq].type !== 'street' || !this.owns(seat.id, sq)) return false;
    const pr = this.props[sq];
    if (pr.houses <= 0) return false;
    if (this.settings.evenBuild && pr.houses < Math.max(...this.groupHouses(sq))) return false;
    if (this.limited() && pr.houses === 5 && this.houses < 4) return false;
    return true;
  }
  canMortgage(seat, sq) {
    sq = this.sqOf(sq);
    if (!this.settings.mortgage || sq < 0 || !this.owns(seat.id, sq)) return false;
    return !this.props[sq].mortgaged && !this.anyBuilt(BOARD[sq].group);
  }
  canUnmortgage(seat, sq) {
    sq = this.sqOf(sq);
    if (!this.settings.mortgage || sq < 0 || !this.owns(seat.id, sq) || this.step === 'auction' || this.step === 'debt') return false;
    return this.props[sq].mortgaged && seat.cash >= unmortgageCost(sq);
  }

  build(seat, sq) {
    if (!this.canBuild(seat, sq)) return 'cannot_build';
    const pr = this.props[sq];
    seat.cash -= houseCost(sq);
    if (pr.houses === 4) { pr.houses = 5; this.hotels -= 1; this.houses += 4; } else { pr.houses += 1; this.houses -= 1; }
    this.say(`${seat.name} builds ${pr.houses === 5 ? 'a hotel' : 'a house'} on ${BOARD[sq].name}.`);
    this.ev('build', { pid: seat.id, sq });
    return true;
  }
  sell(seat, sq) {
    if (!this.canSell(seat, sq)) return 'cannot_sell';
    const pr = this.props[sq];
    if (pr.houses === 5) { pr.houses = 4; this.hotels += 1; this.houses -= 4; } else { pr.houses -= 1; this.houses += 1; }
    seat.cash += houseCost(sq) / 2;
    this.say(`${seat.name} sells a building on ${BOARD[sq].name}.`);
    this.tryPayDebt();
    return true;
  }
  mortgage(seat, sq) {
    if (!this.canMortgage(seat, sq)) return 'cannot_mortgage';
    this.props[sq].mortgaged = true;
    seat.cash += mortgageValue(sq);
    this.say(`${seat.name} mortgages ${BOARD[sq].name} for $${mortgageValue(sq)}.`);
    this.tryPayDebt();
    return true;
  }
  unmortgage(seat, sq) {
    if (!this.canUnmortgage(seat, sq)) return 'cannot_unmortgage';
    this.props[sq].mortgaged = false;
    seat.cash -= unmortgageCost(sq);
    this.say(`${seat.name} pays $${unmortgageCost(sq)} to lift the mortgage on ${BOARD[sq].name}.`);
    return true;
  }

  // ---- trades ------------------------------------------------------------------------------------------------------
  // A trade: `from` offers `give` (squares + cash) and asks for `get`. The other player accepts, rejects or counters; the proposer
  // can cancel. Whenever the terms change (a counter-offer) acceptance starts over, and `ver` stops a stale click from accepting.
  cleanSide(side) {
    if (!side || typeof side !== 'object') return null;
    const props = side.props ?? [];
    const cash = side.cash ?? 0;
    if (!isSquareList(props) || !isInt(cash) || cash < 0 || cash > 1_000_000) return null;
    return { props: [...props].sort((a, b) => a - b), cash };
  }
  sideProblem(seat, side) {
    for (const sq of side.props) {
      if (!this.owns(seat.id, sq)) return 'not_owner';
      if (this.anyBuilt(BOARD[sq].group)) return 'has_buildings';
    }
    if (side.cash > seat.cash) return 'not_enough_cash';
    return '';
  }
  tradeProblem(t) {
    const a = this.seat(t.from); const b = this.seat(t.to);
    if (!a || !b || a.out || b.out || a === b) return 'not_playing';
    if (!t.give.props.length && !t.give.cash && !t.get.props.length && !t.get.cash) return 'empty_trade';
    const p = this.sideProblem(a, t.give) || this.sideProblem(b, t.get);
    if (p) return p;
    // A mortgaged property keeps its mortgage; the new owner pays 10% interest to the bank straight away.
    const interest = (props) => props.reduce((n, sq) => n + (this.props[sq].mortgaged ? mortgageInterest(sq) : 0), 0);
    if (b.cash - t.get.cash + t.give.cash < interest(t.give.props)) return 'cannot_pay_interest';
    if (a.cash - t.give.cash + t.get.cash < interest(t.get.props)) return 'cannot_pay_interest';
    return '';
  }
  findTrade(a) { return isInt(a.id) ? this.trades.find((t) => t.id === a.id) : null; }
  dropTrade(t) { this.trades = this.trades.filter((x) => x !== t); }

  tradeNew(seat, a) {
    if (this.step === 'auction') return 'not_now';
    const to = this.seat(a.to);
    if (!to || to.out || to === seat) return 'bad_player';
    const give = this.cleanSide(a.give); const get = this.cleanSide(a.get);
    if (!give || !get) return 'bad_trade';
    if (this.trades.some((t) => (t.from === seat.id && t.to === to.id) || (t.from === to.id && t.to === seat.id))) return 'trade_exists';
    if (this.trades.filter((t) => t.from === seat.id).length >= 3) return 'too_many_trades';
    const t = { id: ++this.tradeSeq, from: seat.id, to: to.id, give, get, acc: { from: true, to: false }, ver: 1, at: this.clock() };
    const p = this.tradeProblem(t);
    if (p) return p;
    this.trades.push(t);
    this.ev('trade-offer', { from: seat.id, to: to.id });
    this.say(`${seat.name} offers ${to.name} a trade.`);
    return true;
  }
  tradeAccept(seat, a) {
    const t = this.findTrade(a);
    if (!t || t.to !== seat.id || !t.acc.from || a.ver !== t.ver) return 'trade_changed';
    if (this.step === 'auction') return 'not_now';
    const p = this.tradeProblem(t);
    if (p) { this.dropTrade(t); this.say('A trade fell through.'); return p; }
    t.acc.to = true;
    this.executeTrade(t);
    return true;
  }
  tradeReject(seat, a) {
    const t = this.findTrade(a);
    if (!t || (t.from !== seat.id && t.to !== seat.id)) return 'trade_changed';
    this.dropTrade(t);
    this.say(t.from === seat.id ? `${seat.name} withdraws the offer.` : `${seat.name} turns the offer down.`);
    return true;
  }
  tradeCounter(seat, a) {
    const t = this.findTrade(a);
    if (!t || t.to !== seat.id || a.ver !== t.ver) return 'trade_changed';
    if (this.step === 'auction') return 'not_now';
    const give = this.cleanSide(a.give); const get = this.cleanSide(a.get);
    if (!give || !get) return 'bad_trade';
    const n = { ...t, from: t.to, to: t.from, give, get, acc: { from: true, to: false }, ver: t.ver + 1, at: this.clock() };
    const p = this.tradeProblem(n);
    if (p) return p;
    Object.assign(t, n);
    this.ev('trade-offer', { from: n.from, to: n.to });
    this.say(`${seat.name} makes a counter-offer.`);
    return true;
  }
  // All of it or none of it: everything was checked an instant ago and nothing else can run in between.
  executeTrade(t) {
    const a = this.seat(t.from); const b = this.seat(t.to);
    for (const sq of t.give.props) { this.props[sq].owner = b.id; }
    for (const sq of t.get.props) { this.props[sq].owner = a.id; }
    a.cash += t.get.cash - t.give.cash; b.cash += t.give.cash - t.get.cash;
    const interest = (props) => props.reduce((n, sq) => n + (this.props[sq].mortgaged ? mortgageInterest(sq) : 0), 0);
    b.cash -= interest(t.give.props); a.cash -= interest(t.get.props);
    if (this.settings.vacationCash) this.pot += interest(t.give.props) + interest(t.get.props);
    this.dropTrade(t);
    this.ev('trade', { from: a.id, to: b.id });
    this.say(`${a.name} and ${b.name} agree a trade.`);
    this.tryPayDebt();
  }

  // ---- ending players and the game ----------------------------------------------------------------------------------
  // Take a player out. Their assets go to the player they owe (if a debt is pending), otherwise back to the bank, so leaving
  // can never be used to dodge a debt.
  eliminate(seat, reason, creditorId) {
    if (seat.out) return true;
    const wasTurn = this.cur() === seat;
    let creditor = creditorId;
    if (creditor === undefined) creditor = this.debt && this.debt.pid === seat.id && this.debt.to !== 'bank' && this.debt.to !== 'each' ? this.debt.to : 'bank';
    const cr = creditor !== 'bank' ? this.seat(creditor) : null;
    const target = cr && !cr.out ? cr : null;
    this.say(`${seat.name} is out${reason === 'resigned' ? ' (gave up)' : reason === 'abandoned' ? ' (left the game)' : reason === 'afk' ? ' (away too long)' : ''}${target ? `. Their assets go to ${target.name}` : ''}.`);
    let cash = seat.cash;
    for (const sq of this.ownedBy(seat.id)) {
      const pr = this.props[sq];
      if (pr.houses) { // buildings go back to the bank at half price
        if (pr.houses === 5) { this.hotels += 1; cash += (5 * houseCost(sq)) / 2; } else { this.houses += pr.houses; cash += (pr.houses * houseCost(sq)) / 2; }
        pr.houses = 0;
      }
      if (target) {
        pr.owner = target.id;
        if (pr.mortgaged) { const fee = Math.min(target.cash, mortgageInterest(sq)); target.cash -= fee; }
      } else { pr.owner = null; pr.mortgaged = false; }
    }
    if (target) { target.cash += cash; target.cards.push(...seat.cards); }
    else for (const id of seat.cards) this.decks[id[0] === 'L' ? 'luck' : 'fund'].push(id);
    seat.cards = []; seat.cash = 0; seat.out = true; seat.outReason = reason; seat.outAt = this.clock(); seat.dcAt = 0;
    this.outOrder.push(seat.id);
    if (this.debt && this.debt.pid === seat.id) this.debt = null;
    this.trades = this.trades.filter((t) => t.from !== seat.id && t.to !== seat.id);
    this.ev('out', { pid: seat.id, reason });
    const left = this.active();
    if (left.length <= 1) { this.finish(left[0] || null); return true; }
    if (wasTurn) { if (this.auction) { this.auction = null; } this.nextTurn(); }
    return true;
  }

  finish(winner) {
    this.phase = 'over';
    this.winner = winner ? winner.id : null;
    this.endedAt = this.clock();
    this.step = 'over'; this.auction = null; this.debt = null; this.trades = [];
    this.actAt = Infinity;
    this.ev('over', { pid: this.winner });
    this.say(winner ? `${winner.name} wins the game!` : 'The game is over.');
  }

  cancel(reason) {
    if (this.phase !== 'play') return;
    this.phase = 'cancelled'; this.endReason = reason; this.endedAt = this.clock(); this.step = 'over';
    this.auction = null; this.debt = null; this.trades = []; this.actAt = Infinity;
    this.say('The game was cancelled and everyone is refunded.');
  }

  // ---- connection state ------------------------------------------------------------------------------------------------
  setConnected(pid, connected) {
    const s = this.seat(pid);
    if (!s || s.out) return;
    s.dcAt = connected ? 0 : (s.dcAt || this.clock());
    this.ev(connected ? 'back' : 'gone', { pid });
    if (this.cur() === s) this.schedule();
  }

  // ---- the clock ---------------------------------------------------------------------------------------------------------
  // Everything time-based happens here: auctions ending, trade offers expiring, turns running out, players who never came back.
  tick() {
    if (this.phase !== 'play') return false;
    const t = this.clock();
    let changed = false;
    // players who were gone for the whole reconnect window
    const gone = this.active().filter((s) => s.dcAt && t - s.dcAt >= RECONNECT_MS);
    if (gone.length) {
      if (gone.length === this.active().length) { this.cancel('everyone_left'); return true; }
      for (const s of gone) { if (!s.out && this.phase === 'play') this.eliminate(s, 'abandoned'); }
      changed = true;
      if (this.phase !== 'play') return true;
    }
    const tr = this.trades.length;
    this.trades = this.trades.filter((x) => t - x.at < TRADE_TTL_MS);
    if (this.trades.length !== tr) changed = true;
    if (this.auction && t >= this.auction.endsAt) { this.endAuction(); changed = true; }
    const seat = this.cur();
    if (this.phase === 'play' && seat && !seat.out && t >= this.actAt) {
      if (!seat.dcAt && !seat.afk) { // their five minutes ran out
        seat.idle++;
        if (seat.idle >= MAX_AFK_TURNS) { this.say(`${seat.name} has not played for ${MAX_AFK_TURNS} turns in a row.`); this.eliminate(seat, 'afk'); return true; }
        seat.afk = true;
        this.say(`${seat.name} ran out of time.`);
      }
      this.autoStep(seat);
      if (this.phase === 'play') this.schedule();
      changed = true;
    }
    return changed;
  }

  // The move the server makes for a player who is out of time or gone: roll, never buy, raise money for debts, end the turn.
  autoStep(seat) {
    switch (this.step) {
      case 'roll': this.roll(); break;
      case 'buy': this.decline(seat); break;
      case 'debt': this.autoRaise(seat); break;
      case 'manage': if (this.again) { this.again = false; this.step = 'roll'; } else this.nextTurn(); break;
      default: break;
    }
  }
  autoRaise(seat) {
    const d = this.debt;
    if (!d) return;
    for (let guard = 0; guard < 80 && this.debt && seat.cash < d.total; guard++) {
      const sell = this.ownedBy(seat.id).filter((sq) => this.canSell(seat, sq)).sort((x, y) => this.props[y].houses - this.props[x].houses)[0];
      if (sell !== undefined) { this.sell(seat, sell); continue; }
      const mort = this.ownedBy(seat.id).filter((sq) => this.canMortgage(seat, sq)).sort((x, y) => BOARD[x].price - BOARD[y].price)[0];
      if (mort !== undefined) { this.mortgage(seat, mort); continue; }
      break;
    }
    if (this.debt && seat.cash < d.total) { this.say(`${seat.name} cannot pay and is bankrupt.`); this.eliminate(seat, 'bankrupt'); }
  }

  // ---- what each player is shown ---------------------------------------------------------------------------------------------
  standings() {
    const alive = this.active().map((s) => ({ id: s.id, name: s.name, worth: this.worth(s), out: false }));
    alive.sort((a, b) => b.worth - a.worth);
    const dead = [...this.outOrder].reverse().map((id) => ({ id, name: this.nm(id), worth: 0, out: true, reason: this.seat(id).outReason }));
    return [...alive, ...dead];
  }

  view(pid) {
    const me = this.seat(pid);
    const t = this.clock();
    const play = this.phase === 'play';
    const mine = !!(play && me && !me.out && this.cur() === me);
    const can = { roll: false, buy: false, decline: false, end: false, jailPay: false, jailCard: false, bid: null, build: [], sell: [], mortgage: [], unmortgage: [], bankrupt: false, trade: false };
    if (play && me && !me.out) {
      const sq = BOARD[me.pos];
      can.roll = mine && this.step === 'roll';
      can.buy = mine && this.step === 'buy' && me.cash >= (sq.price || Infinity);
      can.decline = mine && this.step === 'buy';
      can.end = mine && this.step === 'manage';
      can.jailPay = mine && this.step === 'roll' && me.jail > 0 && me.cash >= this.settings.jailFine;
      can.jailCard = mine && this.step === 'roll' && me.jail > 0 && me.cards.length > 0;
      can.bankrupt = !!(this.debt && this.debt.pid === me.id);
      can.trade = this.step !== 'auction';
      if (this.auction && this.auction.bidder !== me.id) {
        const min = this.auction.bid === 0 ? BID_STEP : this.auction.bid + BID_STEP;
        if (me.cash >= min) can.bid = { min, max: me.cash };
      }
      for (const s of this.ownedBy(me.id)) {
        if (this.canBuild(me, s)) can.build.push(s);
        if (this.canSell(me, s)) can.sell.push(s);
        if (this.canMortgage(me, s)) can.mortgage.push(s);
        if (this.canUnmortgage(me, s)) can.unmortgage.push(s);
      }
    }
    const idOf = (id) => this.seats.findIndex((s) => s.id === id);
    const cleanTrade = (x) => ({ id: x.id, from: x.from, to: x.to, give: x.give, get: x.get, acc: x.acc, ver: x.ver, left: Math.max(0, TRADE_TTL_MS - (t - x.at)) });
    return {
      game: 'landlords',
      phase: this.phase,
      serverNow: t,
      settings: this.settings,
      seats: this.seats.map((s, i) => ({
        i, id: s.id, name: s.name, cash: s.cash, pos: s.pos, jail: s.jail, cards: s.cards.length, out: s.out, reason: s.outReason,
        connected: !s.dcAt, dcLeft: s.dcAt ? Math.max(0, RECONNECT_MS - (t - s.dcAt)) : 0, afk: s.afk, worth: s.out ? 0 : this.worth(s),
      })),
      props: OWNABLE.map((sq) => { const pr = this.props[sq]; return { sq, owner: pr.owner ? idOf(pr.owner) : -1, houses: pr.houses, mortgaged: pr.mortgaged }; }),
      supply: { houses: this.limited() ? this.houses : null, hotels: this.limited() ? this.hotels : null },
      vacationPot: this.settings.vacationCash ? this.pot : null,
      turn: this.turn, step: this.step, dice: this.dice, rollNo: this.rollNo, again: this.again,
      deadline: play ? this.deadline : 0,
      turnLeft: play ? Math.max(0, this.deadline - t) : 0,
      debt: this.debt ? { seat: idOf(this.debt.pid), to: this.debt.to === 'bank' || this.debt.to === 'each' ? -1 : idOf(this.debt.to), total: this.debt.total, why: this.debt.why } : null,
      auction: this.auction ? { sq: this.auction.sq, bid: this.auction.bid, bidder: this.auction.bidder ? idOf(this.auction.bidder) : -1, left: Math.max(0, this.auction.endsAt - t), total: AUCTION_MS } : null,
      trades: this.trades.filter((x) => me && (x.from === me.id || x.to === me.id)).map(cleanTrade),
      tradeCount: this.trades.length,
      card: this.card ? { text: this.card.text, deck: this.card.deck, seat: idOf(this.card.pid), n: this.rollNo } : null,
      winner: this.winner ? idOf(this.winner) : -1,
      endReason: this.endReason,
      standings: play ? [] : this.standings(),
      events: this.events,
      log: this.log.slice(-30),
      you: { id: pid, seat: me ? this.seats.indexOf(me) : -1, myTurn: mine, out: !!(me && me.out), can },
    };
  }
}
