// No-limit Texas Hold'em, host-authoritative.
import { Engine } from '../core/engine.js?v=35';
import { newDeck, shuffle } from '../core/cards.js?v=35';
import { evaluate } from '../core/evaluate.js?v=35';
import { holdemBot } from '../bots/holdem-bot.js?v=35';

export const MAX_SEATS = 9;
const NEXT_STREET = { preflop: 'flop', flop: 'turn', turn: 'river' };

export class Holdem extends Engine {
  constructor(room, settings = {}) {
    super(room);
    this.s = { sb: 10, bb: 20, timer: 30, ...settings };
    this.seats = [];
    this.board = [];
    this.deck = [];
    this.phase = 'waiting';
    this.street = null;
    this.button = -1;
    this.sbIdx = -1;
    this.bbIdx = -1;
    this.handNo = 0;
    this.toAct = -1;
    this.deadline = 0;
    this.currentBet = 0;
    this.minRaise = 0;
    this.raiseId = 0;
    this.results = null;
    this.paused = false;
    this.botAt = 0;
    this.syncSeats();
    this.after(1400, () => this.maybeStart());
  }

  // ---- seating -------------------------------------------------------
  syncSeats() {
    const ids = new Set(this.room.players.map((p) => p.id));
    this.seats = this.seats.filter((s) => ids.has(s.pid));
    for (const p of this.room.players) {
      if (this.seats.length >= MAX_SEATS) break;
      if (!this.seats.some((s) => s.pid === p.id)) this.seats.push(this.blankSeat(p.id));
    }
    if (this.button >= this.seats.length) this.button = -1;
  }

  blankSeat(pid) {
    return {
      pid, cards: [], bet: 0, totalIn: 0, folded: false, allIn: false, inHand: false,
      needs: false, actedRaise: -1, last: null, shown: false, sitOut: false, won: 0, best: null, handName: null,
    };
  }

  onPlayersChanged() {
    if (this.phase === 'waiting') { this.syncSeats(); this.maybeStart(); }
  }

  eligible(s) {
    const p = this.player(s.pid);
    return !!p && !s.sitOut && !p.leaving && p.chips > 0 && (p.bot || p.connected);
  }

  chips(seat) { const p = this.player(seat.pid); return p ? p.chips : 0; }
  isLive(s) { return s.inHand && !s.folded; }
  canMove(s) { return s.inHand && !s.folded && !s.allIn; }

  nextIdx(from, pred) {
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k + n) % n;
      if (pred(this.seats[i], i)) return i;
    }
    return -1;
  }

  // ---- hand lifecycle --------------------------------------------------
  maybeStart() {
    if (this.phase !== 'waiting') return;
    this.syncSeats();
    if (this.paused) return;
    const ready = this.seats.filter((s) => this.eligible(s));
    if (ready.length < 2) return;
    this.startHand();
  }

  startHand() {
    this.handNo++;
    this.results = null;
    this.board = [];
    this.deck = shuffle(newDeck());
    for (const s of this.seats) {
      const eligible = this.eligible(s);
      Object.assign(s, {
        cards: [], bet: 0, totalIn: 0, folded: false, allIn: false, inHand: eligible,
        needs: false, actedRaise: -1, last: null, shown: false, won: 0, best: null, handName: null,
      });
    }
    const inHand = (s) => s.inHand;
    this.button = this.nextIdx(this.button < 0 ? -1 : this.button, inHand);
    const headsUp = this.seats.filter(inHand).length === 2;
    this.sbIdx = headsUp ? this.button : this.nextIdx(this.button, inHand);
    this.bbIdx = this.nextIdx(this.sbIdx, inHand);

    this.phase = 'betting';
    this.street = 'preflop';
    this.currentBet = this.s.bb;
    this.minRaise = this.s.bb;
    this.raiseId = 1;
    this.post(this.seats[this.sbIdx], this.s.sb);
    this.post(this.seats[this.bbIdx], this.s.bb);
    this.seats[this.sbIdx].last = 'Small blind';
    this.seats[this.bbIdx].last = 'Big blind';

    // Deal two cards each, one at a time, starting left of the button.
    for (let round = 0; round < 2; round++) {
      let i = this.sbIdx;
      for (let k = 0; k < this.seats.length; k++) {
        const s = this.seats[i];
        if (s.inHand) s.cards.push(this.deck.pop());
        i = (i + 1) % this.seats.length;
      }
    }
    for (const s of this.seats) if (this.canMove(s)) s.needs = true;

    this.note(`Hand #${this.handNo}. ${this.name(this.seats[this.button].pid)} has the button.`);
    this.emit('deal', { hand: this.handNo });
    this.toAct = -1;
    // Wait for the deal animation (200ms per card) plus a beat to look at your cards.
    const dealt = this.seats.filter(inHand).length * 2;
    this.after(1500 + dealt * 200, () => this.advance(this.bbIdx));
  }

  post(seat, amount) {
    const chips = this.chips(seat);
    const put = Math.min(amount, chips);
    this.put(seat, put);
  }

  put(seat, amount) {
    const p = this.player(seat.pid);
    p.chips -= amount;
    seat.bet += amount;
    seat.totalIn += amount;
    if (p.chips === 0) seat.allIn = true;
  }

  setTurn(i) {
    this.toAct = i;
    const seat = this.seats[i];
    const p = this.player(seat.pid);
    const t = this.now();
    if (this.s.timer > 0) this.deadline = t + this.s.timer * 1000;
    else this.deadline = p && !p.connected && !p.bot ? t + 15000 : 0;
    if (p && p.bot) this.botAt = t + 1200 + Math.random() * 1600;
    this.emit('turn', { pid: seat.pid });
  }

  // Move play to the next seat after `from` that still owes an action.
  advance(from) {
    const live = this.seats.filter((s) => this.isLive(s));
    if (live.length === 1) return this.endRound();
    const nxt = this.nextIdx(from, (s) => this.canMove(s) && s.needs);
    if (nxt >= 0) this.setTurn(nxt);
    else this.endRound();
  }

  legal(seat) {
    const chips = this.chips(seat);
    const toCall = Math.max(0, this.currentBet - seat.bet);
    const others = this.seats.some((s) => s !== seat && this.canMove(s));
    const canRaise = chips > toCall && seat.actedRaise !== this.raiseId && others;
    const maxTo = seat.bet + chips;
    return {
      toCall,
      callAmt: Math.min(toCall, chips),
      canCheck: toCall === 0,
      canCall: toCall > 0,
      canRaise,
      minTo: Math.min(this.currentBet + this.minRaise, maxTo),
      maxTo,
      isBet: this.currentBet === 0,
    };
  }

  step(t) {
    if (this.toAct < 0 || this.phase !== 'betting') return false;
    const seat = this.seats[this.toAct];
    const p = this.player(seat.pid);
    if (!p) return this.act(seat.pid, { type: 'fold' }, true);
    if (p.bot && t >= this.botAt) return this.act(seat.pid, holdemBot(this, this.toAct), true);
    if (this.deadline && t >= this.deadline) {
      const L = this.legal(seat);
      return this.act(seat.pid, { type: L.canCheck ? 'check' : 'fold' }, true);
    }
    return false;
  }

  handle(pid, a) {
    const seat = this.seats.find((s) => s.pid === pid);
    if (!seat) return false;
    switch (a.type) {
      case 'fold': case 'check': case 'call': case 'raise':
        return this.act(pid, a);
      case 'show':
        if (this.phase === 'handover' && seat.inHand && seat.cards.length && !seat.shown) {
          seat.shown = true;
          this.emit('show', { pid });
          this.note(`${this.name(pid)} shows ${seat.cards.join(' ')}.`);
          return true;
        }
        return false;
      case 'sitout':
        seat.sitOut = !!a.on;
        if (!seat.sitOut) this.maybeStart();
        return true;
      default:
        return false;
    }
  }

  act(pid, a, auto = false) {
    if (this.toAct < 0 || this.phase !== 'betting') return false;
    const seat = this.seats[this.toAct];
    if (seat.pid !== pid) return false;
    const L = this.legal(seat);
    const who = this.name(pid);

    if (a.type === 'fold') {
      seat.folded = true;
      seat.last = auto && this.deadline && this.now() >= this.deadline ? 'Timed out' : 'Fold';
      this.emit('fold', { pid });
      this.note(`${who} folds.`);
    } else if (a.type === 'check') {
      if (!L.canCheck) return false;
      seat.last = 'Check';
      this.emit('check', { pid });
      this.note(`${who} checks.`);
    } else if (a.type === 'call') {
      if (!L.canCall) return false;
      this.put(seat, L.callAmt);
      seat.last = seat.allIn ? 'All in' : 'Call';
      this.emit('chip', { pid, amount: L.callAmt });
      this.note(`${who} calls ${L.callAmt}${seat.allIn ? ' and is all in' : ''}.`);
    } else if (a.type === 'raise') {
      if (!L.canRaise) return false;
      let to = Math.round(Number(a.to) || 0);
      to = Math.max(L.minTo, Math.min(L.maxTo, to));
      const wasBet = L.isBet;
      this.put(seat, to - seat.bet);
      const inc = to - this.currentBet;
      if (inc >= this.minRaise) { this.minRaise = inc; this.raiseId++; }
      this.currentBet = Math.max(this.currentBet, to);
      for (const s of this.seats) if (s !== seat && this.canMove(s) && s.bet < this.currentBet) s.needs = true;
      seat.last = seat.allIn ? 'All in' : wasBet ? 'Bet' : 'Raise';
      this.emit('chip', { pid, amount: to, raise: true });
      this.note(`${who} ${seat.allIn ? 'goes all in for' : wasBet ? 'bets' : 'raises to'} ${to}.`);
    } else return false;

    seat.needs = false;
    seat.actedRaise = this.raiseId;
    const from = this.toAct;
    this.toAct = -1;
    this.deadline = 0;
    this.advance(from);
    return true;
  }

  returnUncalled() {
    const inHand = this.seats.filter((s) => s.inHand);
    const top = inHand.reduce((m, s) => (s.bet > (m ? m.bet : -1) ? s : m), null);
    if (!top) return;
    const second = Math.max(0, ...inHand.filter((s) => s !== top).map((s) => s.bet));
    if (top.bet > second) {
      const diff = top.bet - second;
      top.bet -= diff;
      top.totalIn -= diff;
      this.player(top.pid).chips += diff;
      if (top.allIn && this.player(top.pid).chips > 0 && this.seats.filter((s) => this.isLive(s)).length > 1) {
        // still effectively all in: nobody can bet against them
      }
    }
  }

  endRound() {
    this.toAct = -1;
    this.deadline = 0;
    this.returnUncalled();
    const hadBets = this.seats.some((s) => s.bet > 0);
    for (const s of this.seats) s.bet = 0;
    if (hadBets) this.emit('collect');

    const live = this.seats.filter((s) => this.isLive(s));
    if (live.length === 1) return this.awardUncontested(live[0]);

    if (this.street === 'river') {
      this.phase = 'dealing';
      return this.after(1100, () => this.showdown());
    }
    const movers = live.filter((s) => !s.allIn);
    if (movers.length <= 1) {
      // Everyone is all in: turn the cards over and run the board out slowly.
      this.phase = 'dealing';
      for (const s of live) s.shown = true;
      this.emit('reveal');
      this.note('All in. Cards on their backs.');
      const runOut = () => {
        if (this.street === 'river') return this.after(1400, () => this.showdown());
        this.dealStreet();
        this.after(this.street === 'flop' ? 3000 : 2200, runOut);
      };
      return this.after(1600 + live.length * 380, runOut);
    }
    this.phase = 'dealing';
    this.after(1000, () => {
      this.dealStreet();
      this.phase = 'betting';
      this.currentBet = 0;
      this.minRaise = this.s.bb;
      this.raiseId++;
      for (const s of this.seats) {
        s.needs = this.canMove(s);
        if (this.isLive(s) && !s.allIn) s.last = null;
      }
      // Let the flop spread and turn over (or the turn/river flip) before anyone acts.
      this.after(this.street === 'flop' ? 2000 : 1700, () => this.advance(this.button));
    });
  }

  dealStreet() {
    this.street = NEXT_STREET[this.street];
    this.deck.pop(); // burn
    const n = this.street === 'flop' ? 3 : 1;
    for (let i = 0; i < n; i++) this.board.push(this.deck.pop());
    this.emit('board', { street: this.street });
    this.note(`${this.street[0].toUpperCase() + this.street.slice(1)}: ${this.board.join(' ')}`);
  }

  pot() {
    if (this.phase === 'handover') return 0;
    return this.seats.reduce((a, s) => a + (s.inHand ? s.totalIn - s.bet : 0), 0);
  }

  awardUncontested(winner) {
    const amount = this.seats.reduce((a, s) => a + (s.inHand ? s.totalIn : 0), 0);
    this.player(winner.pid).chips += amount;
    winner.won = amount;
    this.results = { pots: [{ amount, winners: [winner.pid], name: null }] };
    this.phase = 'handover';
    this.emit('win', { pids: [winner.pid], amount });
    this.note(`${this.name(winner.pid)} takes ${amount} uncontested.`);
    this.after(3800, () => this.finishHand());
  }

  showdown() {
    const live = this.seats.filter((s) => this.isLive(s));
    for (const s of live) {
      const r = evaluate([...s.cards, ...this.board]);
      s.score = r.score;
      s.best = r.best;
      s.handName = r.name;
      s.shown = true;
    }

    // Build main pot and side pots from what each player put in.
    const contrib = this.seats.filter((s) => s.inHand);
    const levels = [...new Set(contrib.map((s) => s.totalIn).filter((x) => x > 0))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const lvl of levels) {
      let amount = 0;
      for (const s of contrib) amount += Math.min(s.totalIn, lvl) - Math.min(s.totalIn, prev);
      const eligible = contrib.filter((s) => !s.folded && s.totalIn >= lvl);
      const key = eligible.map((s) => s.pid).join(',');
      const last = pots[pots.length - 1];
      if (!eligible.length && last) last.amount += amount;
      else if (last && last.key === key) last.amount += amount;
      else pots.push({ amount, eligible, key });
      prev = lvl;
    }

    const results = [];
    const order = (s) => (this.seats.indexOf(s) - this.button - 1 + this.seats.length) % this.seats.length;
    for (const pot of pots) {
      const best = Math.max(...pot.eligible.map((s) => s.score));
      const winners = pot.eligible.filter((s) => s.score === best).sort((a, b) => order(a) - order(b));
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      for (const w of winners) {
        const amt = share + (odd > 0 ? 1 : 0);
        if (odd > 0) odd--;
        this.player(w.pid).chips += amt;
        w.won += amt;
      }
      results.push({ amount: pot.amount, winners: winners.map((w) => w.pid), name: winners[0].handName });
      this.note(`${winners.map((w) => this.name(w.pid)).join(' and ')} ${winners.length > 1 ? 'split' : 'wins'} ${pot.amount} with ${winners[0].handName.toLowerCase()}.`);
    }
    this.results = { pots: results, showdown: true };
    this.phase = 'handover';
    const winPids = [...new Set(results.flatMap((r) => r.winners))];
    this.emit('win', { pids: winPids, amount: results.reduce((a, r) => a + r.amount, 0), showdown: true });
    this.after(7500 + live.length * 380, () => this.finishHand());
  }

  finishHand() {
    for (const s of this.seats) {
      const p = this.player(s.pid);
      if (p && p.bot && p.chips === 0) this.room.rebuy(p.id);
    }
    this.phase = 'waiting';
    this.street = null;
    this.toAct = -1;
    this.maybeStart();
  }

  // ---- views -----------------------------------------------------------
  view(pid) {
    const mine = this.seats.find((s) => s.pid === pid);
    const showdown = this.results && this.results.showdown;
    const seats = this.seats.map((s, i) => {
      const p = this.player(s.pid);
      const visible = s.pid === pid || s.shown;
      return {
        pid: s.pid,
        chips: p ? p.chips : 0,
        bet: s.bet,
        folded: s.folded,
        allIn: s.allIn,
        inHand: s.inHand,
        sitOut: s.sitOut,
        last: s.last,
        won: s.won,
        cards: s.inHand ? (visible ? s.cards : s.cards.map(() => '??')) : [],
        best: showdown && s.shown && !s.folded ? s.best : null,
        handName: showdown && s.shown && !s.folded ? s.handName : null,
        btn: i === this.button,
        sb: s.inHand && i === this.sbIdx,
        bb: s.inHand && i === this.bbIdx,
      };
    });
    let you = null;
    if (mine) {
      const myTurn = this.toAct >= 0 && this.seats[this.toAct] === mine;
      let hand = null;
      if (mine.inHand && mine.cards.length && !mine.folded) {
        hand = this.board.length >= 3 ? evaluate([...mine.cards, ...this.board]).name : null;
      }
      you = {
        seated: true,
        myTurn,
        legal: myTurn ? this.legal(mine) : null,
        hand,
        sitOut: mine.sitOut,
        canShow: this.phase === 'handover' && mine.inHand && !mine.shown && mine.cards.length > 0,
      };
    }
    return {
      game: 'holdem',
      phase: this.phase,
      street: this.street,
      handNo: this.handNo,
      board: this.board,
      pot: this.pot(),
      currentBet: this.currentBet,
      toAct: this.toAct >= 0 ? this.seats[this.toAct].pid : null,
      timeLeft: this.remaining(this.deadline),
      timer: this.s.timer,
      seats,
      you,
      results: this.results,
      settings: this.s,
      paused: this.paused,
      events: this.events,
      log: this.log.slice(-30),
    };
  }
}
