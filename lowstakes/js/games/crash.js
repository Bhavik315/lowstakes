// Crash: a multiplier climbs from 1.00x until it crashes at a point decided before launch.
// Everyone bets, then tries to cash out before the crash. Cash out in time and you get
// bet x multiplier; miss it and the bet is gone. Players can also set an auto cash-out.
import { Engine } from '../core/engine.js?v=46';
import { randInt } from '../core/cards.js?v=46';

// The multiplier is exp(GROWTH * seconds): 2x at ~8s, 10x at ~27s, 100x at ~54s.
export const GROWTH = 0.085;
export const EDGE = 0.01; // house edge: P(crash >= x) = (1 - EDGE) / x
export const MAX_CRASH = 1000;
export const AUTO_CHOICES = [1.2, 1.5, 2, 3, 5, 10];

export const multAt = (ms) => Math.floor(Math.exp((GROWTH * Math.max(0, ms)) / 1000) * 100) / 100;
export const timeFor = (x) => (Math.log(x) / GROWTH) * 1000;

// Uniform U in [0,1) from the platform CSPRNG, then the standard crash distribution.
export function crashPoint() {
  const u = randInt(2 ** 30) / 2 ** 30;
  const x = Math.floor((100 * (1 - EDGE)) / (1 - u)) / 100;
  return Math.min(MAX_CRASH, Math.max(1, x));
}

export class Crash extends Engine {
  constructor(room, settings = {}) {
    super(room);
    this.s = { min: 5, betTime: 15, ...settings };
    this.phase = 'betting';
    this.bets = []; // { pid, amount, auto, cashed, payout }
    this.lastBets = {};
    this.ready = new Set();
    this.history = []; // most recent first
    this.round = 0;
    this.crash = null; // decided at launch, shown only once it has happened
    this.t0 = 0;
    this.betDeadline = 0;
    this.net = null;
    this.botsBet();
  }

  onPlayersChanged() { if (this.phase === 'betting') { this.botsBet(); this.checkReady(); } }

  bet(pid) { return this.bets.find((b) => b.pid === pid); }
  total(pid) { const b = this.bet(pid); return b ? b.amount : 0; }

  elapsed() { return this.phase === 'running' ? this.now() - this.t0 : 0; }

  // ---- betting ---------------------------------------------------------
  setAmount(pid, amount) {
    const p = this.player(pid);
    if (!p) return false;
    amount = Math.floor(Number(amount));
    amount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const cur = this.bet(pid);
    const was = cur ? cur.amount : 0;
    if (amount - was > p.chips) return false;
    if (amount > 0 && amount < this.s.min) return false;
    p.chips -= amount - was;
    if (!amount) this.bets = this.bets.filter((b) => b.pid !== pid);
    else if (cur) cur.amount = amount;
    else this.bets.push({ pid, amount, auto: null, cashed: null, payout: 0 });
    if (amount > was) this.emit('chip', { pid, amount: amount - was });
    if (!this.betDeadline && !p.bot && amount) this.betDeadline = this.now() + this.s.betTime * 1000;
    return true;
  }

  botsBet() {
    for (const p of this.room.players) {
      if (!p.bot || this.ready.has(p.id)) continue;
      this.ready.add(p.id);
      if (Math.random() < 0.18) continue; // sits this one out
      this.after(700 + Math.random() * 4200, () => {
        if (this.phase !== 'betting') return;
        if (p.chips < this.s.min) this.room.rebuy(p.id);
        const units = [1, 1, 2, 2, 4, 10][randInt(6)];
        if (!this.setAmount(p.id, Math.min(p.chips, this.s.min * units))) return;
        // Bots cash out with a target, spread from cautious to greedy.
        const r = Math.random();
        const style = p.style == null ? 0.5 : p.style;
        const target = r < 0.5 ? 1.15 + Math.random() * 0.85 : r < 0.82 ? 2 + Math.random() * 3 : 5 + Math.random() * 12 * (0.5 + style);
        this.bet(p.id).auto = Math.round(target * 100) / 100;
        this.checkReady();
      });
    }
  }

  checkReady() {
    if (this.phase !== 'betting') return;
    const humans = this.room.players.filter((p) => !p.bot && p.connected);
    if (!humans.length) {
      if (this.bets.length) this.launch(); // nobody human to pace it
      return;
    }
    if (!humans.some((p) => this.total(p.id) > 0)) return;
    const waiting = humans.filter((p) => !this.ready.has(p.id) && (this.total(p.id) > 0 || p.chips >= this.s.min));
    if (!waiting.length) this.launch();
  }

  handle(pid, a) {
    const p = this.player(pid);
    if (!p) return false;
    if (a.type === 'cashout') return this.cashOut(pid);
    if (this.phase !== 'betting') return false;
    if (this.ready.has(pid) && !p.bot && a.type !== 'unready') return false;
    switch (a.type) {
      case 'add': return this.setAmount(pid, this.total(pid) + Number(a.amount || 0));
      case 'bet': return this.setAmount(pid, Number(a.amount || 0));
      case 'clear': return this.setAmount(pid, 0);
      case 'auto': {
        const b = this.bet(pid);
        if (!b) return false;
        const x = a.x == null ? null : Math.round(Number(a.x) * 100) / 100;
        if (x !== null && !(x >= 1.01 && x <= MAX_CRASH)) return false;
        b.auto = x;
        return true;
      }
      case 'rebet': {
        const prev = this.lastBets[pid];
        if (!prev || this.total(pid)) return false;
        if (!this.setAmount(pid, prev.amount)) return false;
        this.bet(pid).auto = prev.auto;
        return true;
      }
      case 'ready':
        if (!this.total(pid)) return false;
        this.ready.add(pid);
        this.checkReady();
        return true;
      case 'unready': this.ready.delete(pid); return true;
      default: return false;
    }
  }

  // ---- the flight ------------------------------------------------------
  launch() {
    if (this.phase !== 'betting') return;
    this.phase = 'running';
    this.betDeadline = 0;
    this.round++;
    this.crash = crashPoint(); // decided now; nothing a player does can change it
    this.t0 = this.now();
    this.emit('launch');
    this.note('Lift off.');
  }

  pay(b, x) {
    const p = this.player(b.pid);
    b.cashed = x;
    b.payout = Math.floor(b.amount * x);
    if (p) p.chips += b.payout;
    this.emit('cashout', { pid: b.pid, x });
  }

  cashOut(pid) {
    if (this.phase !== 'running') return false;
    const b = this.bet(pid);
    if (!b || b.cashed !== null) return false;
    const el = this.elapsed();
    if (el >= timeFor(this.crash)) return false; // too late: it already went
    this.pay(b, Math.min(multAt(el), this.crash));
    return true;
  }

  step(t) {
    if (this.phase === 'betting' && this.betDeadline && t >= this.betDeadline) {
      this.betDeadline = 0;
      if (this.bets.length) this.launch();
      return true;
    }
    if (this.phase !== 'running') return false;
    const el = t - this.t0;
    let changed = false;
    // Auto cash-outs pay exactly their target, as soon as the curve reaches it.
    for (const b of this.bets) {
      if (b.cashed === null && b.auto && b.auto <= this.crash && el >= timeFor(b.auto)) { this.pay(b, b.auto); changed = true; }
    }
    if (el >= timeFor(this.crash)) { this.land(); changed = true; }
    return changed;
  }

  land() {
    this.phase = 'crashed';
    const x = this.crash;
    const net = {};
    this.history.unshift(x);
    this.history = this.history.slice(0, 16);
    this.lastBets = {};
    for (const b of this.bets) {
      net[b.pid] = b.payout - b.amount;
      this.lastBets[b.pid] = { amount: b.amount, auto: b.auto };
    }
    this.net = net;
    this.emit('crash', { x, pids: Object.keys(net).filter((k) => net[k] > 0) });
    this.note(`Crashed at ${x.toFixed(2)}x.`);
    this.after(5000, () => {
      this.phase = 'betting';
      this.bets = [];
      this.net = null;
      this.crash = null;
      this.ready = new Set();
      this.botsBet();
    });
  }

  // ---- view ------------------------------------------------------------
  view(pid) {
    const running = this.phase === 'running';
    const crashed = this.phase === 'crashed';
    const mine = this.bet(pid);
    return {
      game: 'crash',
      phase: this.phase,
      round: this.round,
      growth: GROWTH,
      elapsed: this.elapsed(),
      mult: running ? Math.min(multAt(this.elapsed()), this.crash) : crashed ? this.crash : 1,
      crashAt: crashed ? this.crash : null,
      history: this.history,
      bets: this.bets.map((b) => ({
        pid: b.pid,
        amount: b.amount,
        // Targets are private until the cash-out happens, so nobody can ride on someone else's number.
        auto: b.pid === pid ? b.auto : null,
        cashed: b.cashed,
        payout: crashed || b.cashed !== null ? b.payout : 0,
      })),
      betLeft: this.remaining(this.betDeadline),
      betTime: this.s.betTime,
      ready: [...this.ready],
      net: crashed ? this.net : null,
      you: {
        ready: this.ready.has(pid),
        total: mine ? mine.amount : 0,
        auto: mine ? mine.auto : null,
        cashed: mine ? mine.cashed : null,
        canCashout: !!(running && mine && mine.cashed === null),
        canRebet: !!(this.lastBets[pid] && !mine),
      },
      settings: this.s,
      events: this.events,
      log: this.log.slice(-30),
    };
  }
}
