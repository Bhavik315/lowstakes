// Single-zero roulette on a shared layout.
import { Engine } from '../core/engine.js?v=37';
import { randInt } from '../core/cards.js?v=37';

export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

// Which numbers each spot covers, and what it pays (x to 1).
export function spotInfo(spot) {
  const [kind, arg] = spot.split(':');
  const nums = [];
  let pays = 1;
  if (kind === 'n') { nums.push(Number(arg)); pays = 35; }
  else if (kind === 'red' || kind === 'black') { for (let i = 1; i <= 36; i++) if (colorOf(i) === kind) nums.push(i); }
  else if (kind === 'odd') { for (let i = 1; i <= 36; i += 2) nums.push(i); }
  else if (kind === 'even') { for (let i = 2; i <= 36; i += 2) nums.push(i); }
  else if (kind === 'low') { for (let i = 1; i <= 18; i++) nums.push(i); }
  else if (kind === 'high') { for (let i = 19; i <= 36; i++) nums.push(i); }
  else if (kind === 'dozen') { const d = Number(arg); for (let i = (d - 1) * 12 + 1; i <= d * 12; i++) nums.push(i); pays = 2; }
  else if (kind === 'col') { const c = Number(arg); for (let i = c; i <= 36; i += 3) nums.push(i); pays = 2; }
  else return null;
  return { nums, pays };
}

export const SPOT_LABEL = (spot) => {
  const [k, a] = spot.split(':');
  return ({
    n: a, red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1 to 18', high: '19 to 36',
    dozen: ['1st 12', '2nd 12', '3rd 12'][a - 1], col: `Column ${a}`,
  })[k];
};

const SPIN_MS = 7000;

export class Roulette extends Engine {
  constructor(room, settings = {}) {
    super(room);
    this.s = { min: 5, betTime: 20, ...settings };
    this.phase = 'betting';
    this.bets = [];
    this.lastBets = {};
    this.ready = new Set();
    this.history = [];
    this.result = null;
    this.betDeadline = 0;
    this.spinEnd = 0;
    this.spinNo = 0;
    this.botsBet();
  }

  onPlayersChanged() { if (this.phase === 'betting') { this.botsBet(); this.checkReady(); } }

  myBets(pid) { return this.bets.filter((b) => b.pid === pid); }
  total(pid) { return this.myBets(pid).reduce((a, b) => a + b.amount, 0); }

  place(pid, spot, amount) {
    const p = this.player(pid);
    if (!p || !spotInfo(spot)) return false;
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount < 1 || amount > p.chips) return false;
    p.chips -= amount;
    const existing = this.bets.find((b) => b.pid === pid && b.spot === spot);
    if (existing) existing.amount += amount;
    else this.bets.push({ pid, spot, amount });
    this.emit('chip', { pid, spot });
    if (!this.betDeadline && !p.bot) this.betDeadline = this.now() + this.s.betTime * 1000;
    return true;
  }

  botsBet() {
    for (const p of this.room.players) {
      if (!p.bot || this.ready.has(p.id)) continue;
      this.ready.add(p.id);
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        this.after(900 + Math.random() * 3500, () => {
          if (this.phase !== 'betting') return;
          if (p.chips < this.s.min) this.room.rebuy(p.id);
          const pick = Math.random();
          const spot = pick < 0.45 ? `n:${randInt(37)}`
            : pick < 0.75 ? ['red', 'black', 'odd', 'even', 'low', 'high'][randInt(6)]
            : `${pick < 0.88 ? 'dozen' : 'col'}:${1 + randInt(3)}`;
          this.place(p.id, spot, this.s.min * [1, 1, 2, 4][randInt(4)]);
          this.checkReady();
        });
      }
    }
  }

  checkReady() {
    if (this.phase !== 'betting') return;
    const humans = this.room.players.filter((p) => !p.bot && p.connected);
    if (!humans.length) {
      // Nobody human is here to pace the round (an all-bot table, e.g. while
      // the one human is briefly disconnected). Don't just sit there.
      if (this.bets.length) this.spin();
      return;
    }
    const withBets = humans.filter((p) => this.total(p.id) > 0);
    if (!withBets.length) return;
    const waiting = humans.filter((p) => !this.ready.has(p.id) && (this.total(p.id) > 0 || p.chips >= this.s.min));
    if (!waiting.length) this.spin();
  }

  handle(pid, a) {
    if (this.phase !== 'betting') return false;
    const p = this.player(pid);
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
      case 'clear': {
        for (const b of this.myBets(pid)) p.chips += b.amount;
        this.bets = this.bets.filter((b) => b.pid !== pid);
        return true;
      }
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

  spin() {
    this.phase = 'spinning';
    this.betDeadline = 0;
    this.spinNo++;
    this.result = randInt(37);
    this.spinEnd = this.now() + SPIN_MS;
    this.emit('spin', { n: this.spinNo });
    this.note('No more bets.');
    this.after(SPIN_MS, () => this.settle());
  }

  settle() {
    const n = this.result;
    this.phase = 'result';
    this.history.unshift(n);
    this.history = this.history.slice(0, 14);
    const totals = {};
    for (const b of this.bets) {
      const info = spotInfo(b.spot);
      const won = info.nums.includes(n);
      b.won = won;
      b.payout = won ? b.amount * (info.pays + 1) : 0;
      const p = this.player(b.pid);
      if (p) p.chips += b.payout;
      totals[b.pid] = (totals[b.pid] || 0) + b.payout - b.amount;
    }
    this.net = totals;
    this.lastBets = {};
    for (const b of this.bets) (this.lastBets[b.pid] ||= []).push({ spot: b.spot, amount: b.amount });
    const winners = Object.keys(totals).filter((k) => totals[k] > 0);
    this.emit('land', { n, pids: winners });
    this.note(`${n} ${colorOf(n)}.${winners.length ? ' Paid: ' + winners.map((w) => this.name(w)).join(', ') + '.' : ''}`);
    this.after(5200, () => {
      this.phase = 'betting';
      this.bets = [];
      this.net = null;
      this.ready = new Set();
      this.result = null;
      this.botsBet();
    });
  }

  step(t) {
    if (this.phase === 'betting' && this.betDeadline && t >= this.betDeadline) {
      this.betDeadline = 0;
      if (this.bets.length) this.spin();
      return true;
    }
    return false;
  }

  view(pid) {
    const showResult = this.phase !== 'betting';
    return {
      game: 'roulette',
      phase: this.phase,
      spinNo: this.spinNo,
      bets: this.bets.map((b) => ({ pid: b.pid, spot: b.spot, amount: b.amount, won: showResult && this.phase === 'result' ? b.won : null })),
      result: showResult ? this.result : null,
      spinLeft: this.phase === 'spinning' ? this.remaining(this.spinEnd) : 0,
      spinMs: SPIN_MS,
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
