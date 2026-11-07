// Multiplayer blackjack: everyone plays their own hands against one dealer.
import { Engine } from '../core/engine.js?v=30';
import { newDeck, shuffle } from '../core/cards.js?v=30';
import { handValue, isNatural, cardValue, basicStrategy } from '../core/blackjack-rules.js?v=30';

export const BJ_SEATS = 7;
const GAP = 280;
// Presentation pacing only. Every card is drawn at the moment of the action, so the
// outcome is already fixed; these delays just control when it is shown.
const HIT_SETTLE = 460;
const DOUBLE_PAUSE = 680;
const SPLIT_PAUSE = 760; // the two cards separate and settle before anything is dealt
const SPLIT_GAP = 540; // between the two new cards
const PEEK_MS = 950; // dealer leans in on the hole card before turning it
const INS_MS = 9000; // how long the table has to decide on insurance
const FLIP_MS = 1000; // the flip itself, then a beat to read the total

export class Blackjack extends Engine {
  constructor(room, settings = {}) {
    super(room);
    this.s = { decks: 6, min: 10, timer: 20, betTime: 12, ...settings };
    this.seats = [];
    this.dealer = { cards: [], hidden: true };
    this.phase = 'betting';
    this.turn = null;
    this.deadline = 0;
    this.betDeadline = 0;
    this.insDeadline = 0;
    this.check = null;
    this.checkSeq = 0;
    this.round = 0;
    this.botAt = 0;
    this.locked = false;
    this.hidSeq = 0;
    this.newShoe();
    this.syncSeats();
    this.botsBet();
  }

  newShoe() {
    this.shoe = shuffle(newDeck(this.s.decks));
    this.cut = Math.floor(this.shoe.length * 0.25);
    this.emit('shuffle');
    this.note('Fresh shoe.');
  }

  draw() {
    if (!this.shoe.length) this.newShoe();
    return this.shoe.pop();
  }

  syncSeats() {
    const ids = new Set(this.room.players.map((p) => p.id));
    this.seats = this.seats.filter((s) => ids.has(s.pid) || s.hands.length);
    for (const p of this.room.players) {
      if (this.seats.length >= BJ_SEATS) break;
      if (!this.seats.some((s) => s.pid === p.id)) {
        this.seats.push({ pid: p.id, bet: 0, ready: false, lastBet: 0, hands: [] });
      }
    }
  }

  onPlayersChanged() {
    if (this.phase === 'betting') { this.syncSeats(); this.botsBet(); this.checkAllReady(); }
  }

  botsBet() {
    for (const s of this.seats) {
      const p = this.player(s.pid);
      if (!p || !p.bot || s.ready) continue;
      this.after(700 + Math.random() * 1600, () => {
        if (this.phase !== 'betting' || s.ready) return;
        if (p.chips < this.s.min) this.room.rebuy(p.id);
        const units = [1, 1, 2, 2, 3, 5, 10][Math.floor(Math.random() * 7)];
        const amount = Math.min(p.chips, this.s.min * units);
        this.setBet(s, amount);
        s.ready = true;
        this.emit('chip', { pid: s.pid });
        this.checkAllReady();
      });
    }
  }

  setBet(seat, amount) {
    const p = this.player(seat.pid);
    amount = Math.max(0, Math.floor(amount));
    const bank = p.chips + seat.bet;
    amount = Math.min(amount, bank);
    p.chips = bank - amount;
    seat.bet = amount;
  }

  humansPending() {
    return this.seats.filter((s) => {
      const p = this.player(s.pid);
      return p && !p.bot && p.connected && !s.ready && (p.chips + s.bet) >= this.s.min && !s.sitOut;
    });
  }

  checkAllReady() {
    if (this.phase !== 'betting') return;
    const anyReady = this.seats.some((s) => s.ready && s.bet >= this.s.min);
    const humansReady = this.seats.some((s) => s.ready && !this.player(s.pid)?.bot);
    if (!anyReady) return;
    if (this.humansPending().length === 0 && humansReady) {
      this.betDeadline = 0;
      this.phase = 'dealing';
      this.after(500, () => this.deal());
    } else if (!this.betDeadline && humansReady) {
      this.betDeadline = this.now() + this.s.betTime * 1000;
    }
  }

  // ---- actions ---------------------------------------------------------
  handle(pid, a) {
    const seat = this.seats.find((s) => s.pid === pid);
    if (!seat) return false;
    if (this.phase === 'betting') {
      if (a.type === 'bet' || a.type === 'add') {
        if (seat.ready) return false;
        const was = seat.bet;
        this.setBet(seat, a.type === 'add' ? seat.bet + Number(a.amount || 0) : a.amount);
        this.emit('chip', { pid, amount: seat.bet - was });
        return true;
      }
      if (a.type === 'ready') {
        if (seat.bet < this.s.min) return false;
        seat.ready = true;
        seat.sitOut = false;
        this.checkAllReady();
        return true;
      }
      if (a.type === 'sitout') {
        this.setBet(seat, 0);
        seat.ready = false;
        seat.sitOut = !!a.on;
        this.checkAllReady();
        return true;
      }
      return false;
    }
    if (this.phase === 'insurance' && (a.type === 'insure' || a.type === 'decline')) {
      return this.decideInsurance(seat, a.type === 'insure');
    }
    if (this.phase === 'playing' && this.turn && this.seats[this.turn.seat] === seat && !this.locked) {
      return this.play(seat, a.type);
    }
    return false;
  }

  options(seat) {
    const hand = seat.hands[this.turn.hand];
    const p = this.player(seat.pid);
    const two = hand.cards.length === 2;
    const splitAces = hand.fromSplit && hand.cards[0][0] === 'A';
    return {
      hit: !splitAces,
      stand: true,
      double: two && !splitAces && p.chips >= hand.bet,
      split: two && !splitAces && seat.hands.length < 4 && p.chips >= hand.bet &&
        cardValue(hand.cards[0]) === cardValue(hand.cards[1]),
    };
  }

  play(seat, type, auto = false) {
    const opt = this.options(seat);
    if (!opt[type]) return false;
    const hand = seat.hands[this.turn.hand];
    const p = this.player(seat.pid);
    const who = this.name(seat.pid);

    if (type === 'hit') {
      hand.cards.push(this.draw());
      this.emit('card', { pid: seat.pid });
      this.deadline = 0;
      this.locked = true;
      this.after(HIT_SETTLE, () => this.finishHit(seat, hand, who));
      return true;
    }

    if (type === 'double') {
      const stake = hand.bet;
      p.chips -= stake;
      hand.bet *= 2;
      hand.doubled = true;
      const c = this.draw(); // decided now; shown after the stake lands
      this.emit('chip', { pid: seat.pid, double: true, amount: stake });
      this.note(`${who} doubles and draws to ${handValue([...hand.cards, c]).total}.`);
      this.deadline = 0;
      this.locked = true;
      this.after(DOUBLE_PAUSE, () => {
        hand.cards.push(c);
        this.emit('card', { pid: seat.pid });
        hand.done = true;
        if (handValue(hand.cards).total > 21) {
          hand.result = 'Bust';
          this.after(HIT_SETTLE, () => this.emit('bust', { pid: seat.pid }));
        }
        this.after(HIT_SETTLE + 300, () => { this.locked = false; this.nextTurn(); });
      });
      return true;
    }

    if (type === 'split') {
      p.chips -= hand.bet;
      const idx = this.turn.hand;
      const second = hand.cards.pop();
      const fresh = { hid: ++this.hidSeq, cards: [second], bet: hand.bet, done: false, fromSplit: true };
      hand.fromSplit = true;
      seat.hands.splice(idx + 1, 0, fresh);
      const first = this.draw(); // both new cards are decided now, in the same order as before
      const next = this.draw();
      this.emit('chip', { pid: seat.pid, split: true, amount: hand.bet });
      this.emit('split', { pid: seat.pid, from: hand.hid, to: fresh.hid });
      this.note(`${who} splits ${second[0] === 'T' ? '10' : second[0]}s.`);
      this.deadline = 0;
      this.locked = true;
      this.after(SPLIT_PAUSE, () => { hand.cards.push(first); this.emit('card', { pid: seat.pid }); });
      this.after(SPLIT_PAUSE + SPLIT_GAP, () => { fresh.cards.push(next); this.emit('card', { pid: seat.pid }); });
      this.after(SPLIT_PAUSE + SPLIT_GAP + 460, () => {
        if (second[0] === 'A') { hand.done = true; fresh.done = true; }
        else if (handValue(hand.cards).total === 21) hand.done = true;
        this.locked = false;
        if (hand.done) this.nextTurn(); else this.armTurn();
      });
      return true;
    }

    // stand
    hand.done = true;
    hand.stood = true;
    if (auto) hand.timedOut = true;
    this.emit('stand', { pid: seat.pid, hid: hand.hid });
    this.note(`${who} stands on ${handValue(hand.cards).total}.`);
    this.deadline = 0;
    this.locked = true;
    this.after(450, () => { this.locked = false; this.nextTurn(); });
    return true;
  }

  finishHit(seat, hand, who) {
    const v = handValue(hand.cards).total;
    if (v > 21) {
      hand.done = true;
      hand.result = 'Bust';
      this.emit('bust', { pid: seat.pid });
      this.note(`${who} busts with ${v}.`);
    } else if (v === 21) hand.done = true;
    if (hand.done) this.after(320, () => { this.locked = false; this.nextTurn(); });
    else { this.locked = false; this.armTurn(); }
  }

  // ---- round flow ------------------------------------------------------
  deal() {
    this.round++;
    const playing = this.seats.filter((s) => s.bet >= this.s.min);
    if (!playing.length) { this.phase = 'betting'; return; }
    for (const s of this.seats) {
      if (s.bet >= this.s.min) {
        s.hands = [{ hid: ++this.hidSeq, cards: [], bet: s.bet, done: false }];
        s.lastBet = s.bet;
      } else {
        // Not enough on the felt to play: hand it back.
        this.setBet(s, 0);
        s.hands = [];
      }
      s.bet = 0;
      s.ready = false;
      s.insurance = 0;
      s.insNet = null;
      s.insChoice = null;
    }
    this.dealer = { cards: [], hidden: true };
    this.emit('deal');
    this.note(`Round ${this.round}.`);
    let t = 0;
    for (let r = 0; r < 2; r++) {
      for (const s of playing) {
        this.after((t += GAP), () => { s.hands[0].cards.push(this.draw()); this.emit('card', { pid: s.pid }); });
      }
      this.after((t += GAP), () => { this.dealer.cards.push(this.draw()); this.emit('card', { pid: 'dealer' }); });
    }
    this.after(t + 450, () => this.afterDeal());
  }

  afterDeal() {
    // Dealer shows an ace: offer insurance before anyone looks under the card.
    if (this.dealer.cards[0][0] === 'A' && this.seats.some((s) => this.canInsure(s))) return this.startInsurance();
    this.peek();
  }

  // Insurance costs half the seat's total bet (rounded down) and pays 2 to 1 if the dealer has blackjack.
  insuranceCost(seat) {
    return Math.floor(seat.hands.reduce((t, h) => t + h.bet, 0) / 2);
  }

  canInsure(seat) {
    const p = this.player(seat.pid);
    const cost = this.insuranceCost(seat);
    return !!p && seat.hands.length > 0 && cost >= 1 && p.chips >= cost;
  }

  startInsurance() {
    this.phase = 'insurance';
    this.insDeadline = this.now() + INS_MS;
    this.emit('insurance');
    this.note('Dealer shows an ace. Insurance?');
    for (const s of this.seats) {
      if (!this.canInsure(s)) { s.insChoice = 'na'; continue; }
      s.insChoice = null;
      const p = this.player(s.pid);
      if (p && p.bot) {
        // Basic strategy says never; a few bots take it anyway, like real tables.
        this.after(900 + Math.random() * 3200, () => this.decideInsurance(s, Math.random() < 0.15));
      }
    }
    this.checkInsurance();
  }

  decideInsurance(seat, take) {
    if (this.phase !== 'insurance' || seat.insChoice !== null) return false;
    const p = this.player(seat.pid);
    if (take) {
      if (!this.canInsure(seat)) return false;
      const cost = this.insuranceCost(seat);
      p.chips -= cost;
      seat.insurance = cost;
      seat.insChoice = 'take';
      this.emit('chip', { pid: seat.pid, amount: cost, insurance: true });
      this.note(`${this.name(seat.pid)} takes insurance.`);
    } else seat.insChoice = 'decline';
    this.checkInsurance();
    return true;
  }

  checkInsurance() {
    if (this.phase !== 'insurance') return;
    if (this.seats.every((s) => s.insChoice !== null)) this.endInsurance();
  }

  endInsurance() {
    if (this.phase !== 'insurance') return;
    this.insDeadline = 0;
    for (const s of this.seats) if (s.insChoice === null) s.insChoice = 'decline';
    this.phase = 'dealing';
    this.after(450, () => this.peek());
  }

  peek() {
    const up = this.dealer.cards[0];
    const dealerBJ = isNatural(this.dealer.cards);
    // Insurance settles on the peek, whether or not the dealer has it.
    for (const s of this.seats) {
      if (!s.insurance) continue;
      const p = this.player(s.pid);
      if (dealerBJ) { if (p) p.chips += s.insurance * 3; s.insNet = s.insurance * 2; }
      else s.insNet = -s.insurance;
    }
    if (this.seats.some((s) => s.insurance)) {
      this.note(dealerBJ ? 'Dealer has blackjack. Insurance pays 2 to 1.' : 'No blackjack. Insurance bets lose.');
    }
    const checks = up[0] === 'A' || cardValue(up) === 10; // the dealer looks under an ace or a ten
    if (!checks) return this.beginPlay();
    this.emit('peek');
    this.after(PEEK_MS, () => {
      // Everyone is told the result; the card itself stays hidden unless it is a blackjack.
      this.check = { id: ++this.checkSeq, bj: dealerBJ };
      this.after(dealerBJ ? 4200 : 2600, () => { this.check = null; });
      if (dealerBJ) {
        for (const s of this.seats) for (const h of s.hands) h.done = true;
        this.dealer.hidden = false;
        this.emit('reveal');
        this.emit('dealer-check', { bj: true });
        this.note('Dealer has blackjack. Hands without one lose.');
        this.after(FLIP_MS + 700, () => this.settle());
      } else {
        this.emit('dealer-check', { bj: false });
        this.note('Dealer checks: no blackjack. Play continues.');
        this.after(650, () => this.beginPlay());
      }
    });
  }

  beginPlay() {
    for (const s of this.seats) {
      for (const h of s.hands) {
        if (isNatural(h.cards, false)) { h.done = true; h.natural = true; this.emit('blackjack', { pid: s.pid }); }
      }
    }
    this.phase = 'playing';
    this.turn = null;
    this.nextTurn();
  }

  nextTurn() {
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      for (let h = 0; h < s.hands.length; h++) {
        if (!s.hands[h].done) {
          this.turn = { seat: i, hand: h };
          this.armTurn();
          this.emit('turn', { pid: s.pid });
          return;
        }
      }
    }
    this.turn = null;
    this.dealerPlay();
  }

  armTurn() {
    const seat = this.seats[this.turn.seat];
    const p = this.player(seat.pid);
    const t = this.now();
    if (p && p.bot) this.botAt = t + 700 + Math.random() * 900;
    if (this.s.timer > 0) this.deadline = t + this.s.timer * 1000;
    else this.deadline = p && !p.connected && !p.bot ? t + 8000 : 0;
  }

  step(t) {
    if (this.phase === 'betting' && this.betDeadline && t >= this.betDeadline) {
      this.betDeadline = 0;
      if (this.seats.some((s) => s.bet >= this.s.min)) {
        this.phase = 'dealing';
        this.deal();
      }
      return true;
    }
    if (this.phase === 'insurance') {
      if (this.insDeadline && t >= this.insDeadline) { this.endInsurance(); return true; }
      return false;
    }
    if (this.phase !== 'playing' || !this.turn || this.locked) return false;
    const seat = this.seats[this.turn.seat];
    const p = this.player(seat.pid);
    if (!p) return this.play(seat, 'stand', true);
    if (p.bot && t >= this.botAt) {
      const o = this.options(seat);
      const hand = seat.hands[this.turn.hand];
      let move = basicStrategy(hand.cards, this.dealer.cards[0], o.double, o.split);
      if (!o[move]) move = 'stand';
      return this.play(seat, move);
    }
    if (this.deadline && t >= this.deadline) return this.play(seat, 'stand', true);
    return false;
  }

  dealerPlay() {
    this.phase = 'dealer';
    const hands = this.seats.flatMap((s) => s.hands);
    const live = hands.some((h) => h.result !== 'Bust' && !h.natural);
    // With nobody left to beat there's no tension to build, so skip the long beat.
    const lead = live ? 450 : 250;
    const peek = live ? PEEK_MS : 250;
    this.after(lead, () => {
      if (live) this.emit('peek');
      this.after(peek, () => {
        this.dealer.hidden = false;
        this.emit('reveal');
        const drawNext = () => {
          const { total } = handValue(this.dealer.cards);
          if (live && total < 17) {
            this.dealer.cards.push(this.draw());
            this.emit('card', { pid: 'dealer' });
            this.after(900, drawNext);
          } else this.after(live ? 650 : 400, () => this.settle());
        };
        this.after(live ? FLIP_MS : 500, drawNext);
      });
    });
  }

  settle() {
    this.phase = 'settle';
    this.turn = null;
    const d = handValue(this.dealer.cards).total;
    const dNat = isNatural(this.dealer.cards);
    const winners = [];
    for (const s of this.seats) {
      const p = this.player(s.pid);
      for (const h of s.hands) {
        const v = handValue(h.cards).total;
        const nat = isNatural(h.cards, h.fromSplit);
        let pay = 0;
        if (h.result === 'Bust') pay = 0;
        else if (nat && !dNat) { pay = Math.floor(h.bet * 2.5); h.result = 'Blackjack'; }
        else if (nat && dNat) { pay = h.bet; h.result = 'Push'; }
        else if (dNat) { h.result = 'Lose'; }
        else if (d > 21 || v > d) { pay = h.bet * 2; h.result = 'Win'; }
        else if (v === d) { pay = h.bet; h.result = 'Push'; }
        else h.result = 'Lose';
        h.payout = pay;
        h.net = pay - h.bet;
        if (p) p.chips += pay;
        if (h.net > 0) winners.push(s.pid);
      }
    }
    this.emit('settle', { pids: [...new Set(winners)] });
    this.note(d > 21 ? `Dealer busts with ${d}.` : `Dealer makes ${d}.`);
    this.after(4800, () => this.nextRound());
  }

  nextRound() {
    for (const s of this.seats) s.hands = [];
    this.dealer = { cards: [], hidden: true };
    this.check = null;
    if (this.shoe.length < this.cut) this.newShoe();
    this.phase = 'betting';
    this.syncSeats();
    this.botsBet();
  }

  // ---- views -----------------------------------------------------------
  view(pid) {
    const mine = this.seats.find((s) => s.pid === pid);
    const dealerCards = this.dealer.cards.map((c, i) => (i === 1 && this.dealer.hidden ? '??' : c));
    const seats = this.seats.map((s, i) => {
      const p = this.player(s.pid);
      return {
        pid: s.pid,
        chips: p ? p.chips : 0,
        bet: s.bet,
        ready: s.ready,
        sitOut: !!s.sitOut,
        lastBet: s.lastBet,
        insurance: s.insurance || 0,
        insNet: s.insNet ?? null,
        insChoice: s.insChoice || null,
        active: this.turn && this.turn.seat === i,
        activeHand: this.turn && this.turn.seat === i ? this.turn.hand : -1,
        hands: s.hands.map((h) => {
          const v = handValue(h.cards);
          return {
            hid: h.hid, cards: h.cards, total: v.total, soft: v.soft && v.total < 21, bet: h.bet,
            done: h.done, result: h.result || null, net: h.net ?? null, doubled: !!h.doubled,
            natural: !!h.natural, timedOut: !!h.timedOut,
          };
        }),
      };
    });
    let you = null;
    if (mine) {
      const myTurn = this.phase === 'playing' && this.turn && this.seats[this.turn.seat] === mine && !this.locked;
      let options = null;
      let hint = null;
      if (myTurn) {
        options = this.options(mine);
        const hand = mine.hands[this.turn.hand];
        hint = basicStrategy(hand.cards, this.dealer.cards[0], options.double, options.split);
        if (!options[hint]) hint = 'stand';
      }
      const insurance = this.phase === 'insurance' && mine.insChoice === null ? { cost: this.insuranceCost(mine) } : null;
      you = { seated: true, myTurn, options, hint, insurance };
    }
    return {
      game: 'blackjack',
      phase: this.phase,
      round: this.round,
      dealer: { cards: dealerCards, ...handValue(dealerCards), hidden: this.dealer.hidden },
      seats,
      turn: this.turn ? { pid: this.seats[this.turn.seat].pid, hand: this.turn.hand } : null,
      timeLeft: this.remaining(this.deadline),
      betLeft: this.remaining(this.betDeadline),
      insLeft: this.phase === 'insurance' ? this.remaining(this.insDeadline) : 0,
      insMs: INS_MS,
      check: this.check,
      timer: this.s.timer,
      betTime: this.s.betTime,
      shoe: { left: this.shoe.length, total: this.s.decks * 52 },
      you,
      settings: this.s,
      events: this.events,
      log: this.log.slice(-30),
    };
  }
}
