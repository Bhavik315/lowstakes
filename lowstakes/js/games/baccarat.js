// Punto Banco baccarat. No decisions to make: the cards draw themselves by
// fixed rule, and everyone just bets on Player, Banker, Tie, or a pair.
import { Engine } from '../core/engine.js?v=4';
import { newDeck, shuffle } from '../core/cards.js?v=4';
import { randInt } from '../core/cards.js?v=4';

// Baccarat point value: ace=1, 2-9 face value, ten/picture=0.
const pointValue = (c) => {
  const r = c[0];
  if (r === 'A') return 1;
  if ('TJQK'.includes(r)) return 0;
  return Number(r);
};
const total = (cards) => cards.reduce((s, c) => (s + pointValue(c)) % 10, 0);
const isPair = (cards) => cards.length >= 2 && cards[0][0] === cards[1][0];

export const SPOTS = ['player', 'banker', 'tie', 'ppair', 'bpair'];
export const SPOT_LABEL = { player: 'Player', banker: 'Banker', tie: 'Tie', ppair: 'Player pair', bpair: 'Banker pair' };
// Net-to-1 odds (payout = amount * (PAYS + 1)); player/banker push back the
// stake on a tie instead of paying, handled in settle().
const PAYS = { player: 1, banker: 0.95, tie: 8, ppair: 11, bpair: 11 };

export class Baccarat extends Engine {
  constructor(room, settings = {}) {
    super(room);
    this.s = { min: 5, betTime: 18, ...settings };
    this.phase = 'betting';
    this.bets = [];
    this.lastBets = {};
    this.ready = new Set();
    this.history = []; // 'player' | 'banker' | 'tie', most recent first
    this.player = [];
    this.banker = [];
    this.result = null;
    this.round = 0;
    this.betDeadline = 0;
    this.shoe = shuffle(newDeck(8));
    this.cut = Math.floor(this.shoe.length * 0.2);
    this.botsBet();
  }

  onPlayersChanged() { if (this.phase === 'betting') { this.botsBet(); this.checkReady(); } }

  draw() {
    if (this.shoe.length < 1) this.shoe = shuffle(newDeck(8));
    return this.shoe.pop();
  }

  myBets(pid) { return this.bets.filter((b) => b.pid === pid); }
  total(pid) { return this.myBets(pid).reduce((a, b) => a + b.amount, 0); }

  place(pid, spot, amount) {
    const p = this.player2(pid);
    if (!p || !SPOTS.includes(spot)) return false;
    amount = Math.floor(amount);
    if (amount < 1 || amount > p.chips) return false;
    p.chips -= amount;
    const existing = this.bets.find((b) => b.pid === pid && b.spot === spot);
    if (existing) existing.amount += amount;
    else this.bets.push({ pid, spot, amount });
    this.emit('chip', { pid, spot });
    if (!this.betDeadline && !p.bot) this.betDeadline = this.now() + this.s.betTime * 1000;
    return true;
  }

  // `player` is also this engine's own per-round hand array, so route lookups
  // of a room participant through a differently-named helper.
  player2(pid) { return this.room.players.find((p) => p.id === pid); }

  botsBet() {
    for (const p of this.room.players) {
      if (!p.bot || this.ready.has(p.id)) continue;
      this.ready.add(p.id);
      this.after(700 + Math.random() * 2800, () => {
        if (this.phase !== 'betting') return;
        if (p.chips < this.s.min) this.room.rebuy(p.id);
        const r = Math.random();
        const spot = r < 0.47 ? 'banker' : r < 0.86 ? 'player' : r < 0.94 ? 'tie' : r < 0.97 ? 'ppair' : 'bpair';
        this.place(p.id, spot, this.s.min * [1, 1, 2, 2, 3, 5][randInt(6)]);
        this.checkReady();
      });
    }
  }

  checkReady() {
    if (this.phase !== 'betting') return;
    const humans = this.room.players.filter((p) => !p.bot && p.connected);
    if (!humans.length) {
      // Nobody human is here to pace the round (an all-bot table, e.g. while
      // the one human is briefly disconnected). Don't just sit there.
      if (this.bets.length) this.deal();
      return;
    }
    const withBets = humans.filter((p) => this.total(p.id) > 0);
    if (!withBets.length) return;
    const waiting = humans.filter((p) => !this.ready.has(p.id) && (this.total(p.id) > 0 || p.chips >= this.s.min));
    if (!waiting.length) this.deal();
  }

  handle(pid, a) {
    if (this.phase !== 'betting') return false;
    const p = this.player2(pid);
    if (!p) return false;
    if (this.ready.has(pid) && !p.bot && a.type !== 'unready') return false;
    switch (a.type) {
      case 'bet': return this.place(pid, a.spot, a.amount);
      case 'undo': {
        const mine = this.myBets(pid);
        if (!mine.length) return false;
        const last = mine[mine.length - 1];
        p.chips += last.amount;
        this.bets.splice(this.bets.indexOf(last), 1);
        return true;
      }
      case 'clear':
        for (const b of this.myBets(pid)) p.chips += b.amount;
        this.bets = this.bets.filter((b) => b.pid !== pid);
        return true;
      case 'rebet': {
        const prev = this.lastBets[pid] || [];
        const need = prev.reduce((s, b) => s + b.amount, 0);
        if (!prev.length || need > p.chips) return false;
        for (const b of prev) this.place(pid, b.spot, b.amount);
        return true;
      }
      case 'double': {
        const mine = this.myBets(pid).map((b) => ({ ...b }));
        if (!mine.length || this.total(pid) > p.chips) return false;
        for (const b of mine) this.place(pid, b.spot, b.amount);
        return true;
      }
      case 'ready':
        if (!this.total(pid)) return false;
        this.ready.add(pid);
        this.checkReady();
        return true;
      case 'unready':
        this.ready.delete(pid);
        return true;
      default: return false;
    }
  }

  deal() {
    this.phase = 'dealing';
    this.betDeadline = 0;
    this.round++;
    this.player = [];
    this.banker = [];
    this.emit('deal');
    this.note(`Round ${this.round}.`);
    let t = 0;
    const dealOne = (hand, who) => this.after((t += 420), () => { hand.push(this.draw()); this.emit('card', { pid: who }); });
    dealOne(this.player, 'player'); dealOne(this.banker, 'banker');
    dealOne(this.player, 'player'); dealOne(this.banker, 'banker');
    this.after(t + 550, () => this.resolveTableau());
  }

  resolveTableau() {
    let pt = total(this.player);
    let bt = total(this.banker);
    const playerPair = isPair(this.player);
    const bankerPair = isPair(this.banker);
    const natural = pt >= 8 || bt >= 8;

    const finish = () => {
      pt = total(this.player);
      bt = total(this.banker);
      const winner = pt === bt ? 'tie' : pt > bt ? 'player' : 'banker';
      this.after(650, () => this.reveal({ pt, bt, winner, playerPair, bankerPair, natural }));
    };

    if (natural) return finish();

    // Player draws on 0-5, stands on 6-7.
    const drawPlayer = pt <= 5;
    if (!drawPlayer) return this.after(500, () => this.bankerDraw(null, finish));
    this.after(500, () => {
      const c = this.draw();
      this.player.push(c);
      this.emit('card', { pid: 'player' });
      this.after(500, () => this.bankerDraw(c, finish));
    });
  }

  bankerDraw(playerThird, finish) {
    const bt = total(this.banker);
    let draws;
    if (playerThird == null) draws = bt <= 5;
    else {
      const pc = pointValue(playerThird);
      if (bt <= 2) draws = true;
      else if (bt === 3) draws = pc !== 8;
      else if (bt === 4) draws = pc >= 2 && pc <= 7;
      else if (bt === 5) draws = pc >= 4 && pc <= 7;
      else if (bt === 6) draws = pc === 6 || pc === 7;
      else draws = false;
    }
    if (!draws) return finish();
    this.banker.push(this.draw());
    this.emit('card', { pid: 'banker' });
    this.after(500, finish);
  }

  reveal(r) {
    this.phase = 'reveal';
    this.result = r;
    this.emit('reveal');
    this.note(`Player ${r.pt}, Banker ${r.bt}. ${r.winner === 'tie' ? 'Push.' : r.winner[0].toUpperCase() + r.winner.slice(1) + ' wins.'}`);
    this.after(900, () => this.settle());
  }

  settle() {
    this.phase = 'result';
    const r = this.result;
    const net = {};
    for (const b of this.bets) {
      let payout = 0;
      if (b.spot === 'player') payout = r.winner === 'player' ? Math.round(b.amount * (PAYS.player + 1)) : r.winner === 'tie' ? b.amount : 0;
      else if (b.spot === 'banker') payout = r.winner === 'banker' ? Math.floor(b.amount * (PAYS.banker + 1)) : r.winner === 'tie' ? b.amount : 0;
      else if (b.spot === 'tie') payout = r.winner === 'tie' ? b.amount * (PAYS.tie + 1) : 0;
      else if (b.spot === 'ppair') payout = r.playerPair ? b.amount * (PAYS.ppair + 1) : 0;
      else if (b.spot === 'bpair') payout = r.bankerPair ? b.amount * (PAYS.bpair + 1) : 0;
      b.payout = payout;
      b.won = payout > b.amount;
      const p = this.player2(b.pid);
      if (p) p.chips += payout;
      net[b.pid] = (net[b.pid] || 0) + payout - b.amount;
    }
    this.net = net;
    this.history.unshift(r.winner);
    this.history = this.history.slice(0, 20);
    this.lastBets = {};
    for (const b of this.bets) (this.lastBets[b.pid] ||= []).push({ spot: b.spot, amount: b.amount });
    const winners = Object.keys(net).filter((k) => net[k] > 0);
    this.emit('settle', { winner: r.winner, pids: winners });
    if (this.shoe.length < this.cut) this.after(100, () => { this.shoe = shuffle(newDeck(8)); this.emit('shuffle'); this.note('Fresh shoe.'); });
    this.after(5200, () => {
      this.phase = 'betting';
      this.bets = [];
      this.net = null;
      this.result = null;
      this.ready = new Set();
      this.botsBet();
    });
  }

  step(t) {
    if (this.phase === 'betting' && this.betDeadline && t >= this.betDeadline) {
      this.betDeadline = 0;
      if (this.bets.length) this.deal();
      return true;
    }
    return false;
  }

  view(pid) {
    const showCards = this.phase !== 'betting';
    return {
      game: 'baccarat',
      phase: this.phase,
      round: this.round,
      player: showCards ? this.player : [],
      banker: showCards ? this.banker : [],
      result: this.phase === 'result' || this.phase === 'reveal' ? this.result : null,
      bets: this.bets.map((b) => ({ pid: b.pid, spot: b.spot, amount: b.amount, won: this.phase === 'result' ? b.won : null })),
      history: this.history,
      betLeft: this.remaining(this.betDeadline),
      betTime: this.s.betTime,
      ready: [...this.ready],
      net: this.phase === 'result' ? this.net : null,
      you: { ready: this.ready.has(pid), total: this.total(pid), canRebet: !!(this.lastBets[pid] && this.lastBets[pid].length) },
      settings: this.s,
      events: this.events,
      log: this.log.slice(-30),
    };
  }
}
