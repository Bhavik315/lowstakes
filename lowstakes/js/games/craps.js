// Craps: one shooter rolls for the whole table. Everyone else can bet on
// what the dice do. Core table: Pass/Don't Pass, Field, Place and Hardways.
// (Come/Don't Come are a deliberate omission — they'd double the state
// machine for a bet most casual tables barely use.)
import { Engine } from '../core/engine.js?v=63';
import { rollTwo, isHard } from '../core/dice.js?v=63';
import { randInt } from '../core/cards.js?v=63';

export const PLACE_NUMS = [4, 5, 6, 8, 9, 10];
export const HARD_NUMS = [4, 6, 8, 10];
export const PLACE_PAYS = { 4: 9 / 5, 10: 9 / 5, 5: 7 / 5, 9: 7 / 5, 6: 7 / 6, 8: 7 / 6 };
export const HARD_PAYS = { 4: 7, 10: 7, 6: 9, 8: 9 };
export const fieldPays = (sum) => (sum === 2 ? 2 : sum === 12 ? 3 : [3, 4, 9, 10, 11].includes(sum) ? 1 : null);

export class Craps extends Engine {
  constructor(room, settings = {}) {
    super(room);
    this.s = { min: 5, betTime: 13, ...settings };
    this.phase = 'betting';
    this.bets = []; // { pid, spot, amount }
    this.point = null;
    this.shooterId = null;
    this.rollNo = 0;
    this.rollDice = null;
    this.lastRoll = null;
    this.history = []; // most recent first: { sum, dice, point }
    this.roundNet = {};
    this.betDeadline = 0;
    this.botShooterAt = 0;
    this.ensureShooter();
    // Deferred through the job queue (not called directly) so every deadline
    // this computes is based on `now()` as it is once the game actually
    // starts ticking, not at construction time.
    this.after(10, () => this.nextBetting(true));
  }

  onPlayersChanged() {
    this.ensureShooter();
    if (this.phase === 'betting') this.botsBet();
  }

  // ---- shooter rotation -------------------------------------------------
  eligible(p) { return p && (p.bot || p.connected); }

  ensureShooter() {
    const cur = this.shooterId && this.player(this.shooterId);
    if (this.eligible(cur)) return;
    this.advanceShooter();
  }

  advanceShooter() {
    const order = this.room.players;
    if (!order.length) { this.shooterId = null; return; }
    const start = this.shooterId ? order.findIndex((p) => p.id === this.shooterId) : -1;
    for (let k = 1; k <= order.length; k++) {
      const p = order[(start + k + order.length) % order.length];
      if (this.eligible(p)) { this.shooterId = p.id; return; }
    }
    this.shooterId = order[0].id;
  }

  // ---- betting ------------------------------------------------------------
  myBets(pid) { return this.bets.filter((b) => b.pid === pid); }
  total(pid) { return this.myBets(pid).reduce((a, b) => a + b.amount, 0); }
  removable(b) { return !((b.spot === 'pass' || b.spot === 'dpass') && this.point !== null); }
  validSpot(spot) {
    if (spot === 'pass' || spot === 'dpass') return this.point === null;
    if (spot === 'field') return true;
    const [k, n] = spot.split(':');
    if (k === 'place') return PLACE_NUMS.includes(Number(n));
    if (k === 'hard') return HARD_NUMS.includes(Number(n));
    return false;
  }

  place(pid, spot, amount) {
    const p = this.player(pid);
    if (!p || !this.validSpot(spot)) return false;
    amount = Math.floor(amount);
    if (amount < 1 || amount > p.chips) return false;
    p.chips -= amount;
    const existing = this.bets.find((b) => b.pid === pid && b.spot === spot);
    if (existing) existing.amount += amount;
    else this.bets.push({ pid, spot, amount });
    this.emit('chip', { pid, spot });
    return true;
  }

  handle(pid, a) {
    if (a.type === 'roll') {
      if (this.phase !== 'betting' || pid !== this.shooterId) return false;
      this.startRoll();
      return true;
    }
    if (this.phase !== 'betting') return false;
    const p = this.player(pid);
    if (!p) return false;
    switch (a.type) {
      case 'bet': return this.place(pid, a.spot, a.amount);
      case 'undo': {
        const mine = this.myBets(pid).filter((b) => this.removable(b));
        if (!mine.length) return false;
        const last = mine[mine.length - 1];
        p.chips += last.amount;
        this.bets.splice(this.bets.indexOf(last), 1);
        return true;
      }
      case 'clear': {
        const mine = this.myBets(pid).filter((b) => this.removable(b));
        for (const b of mine) { p.chips += b.amount; this.bets.splice(this.bets.indexOf(b), 1); }
        return mine.length > 0;
      }
      default: return false;
    }
  }

  botsBet() {
    for (const p of this.room.players) {
      if (!p.bot) continue;
      this.after(400 + Math.random() * (this.s.betTime * 480), () => {
        if (this.phase !== 'betting') return;
        if (p.chips < this.s.min) this.room.rebuy(p.id);
        if (this.point === null && !this.myBets(p.id).some((b) => b.spot === 'pass' || b.spot === 'dpass')) {
          this.place(p.id, Math.random() < 0.82 ? 'pass' : 'dpass', this.s.min * [1, 1, 2, 3][randInt(4)]);
        }
        if (Math.random() < 0.3) this.place(p.id, 'field', this.s.min);
        if (this.point !== null && Math.random() < 0.3) {
          const n = PLACE_NUMS[randInt(PLACE_NUMS.length)];
          if (!this.myBets(p.id).some((b) => b.spot === `place:${n}`)) this.place(p.id, `place:${n}`, this.s.min * 2);
        }
      });
    }
  }

  armShooterBot() {
    const shooter = this.player(this.shooterId);
    this.botShooterAt = shooter && shooter.bot ? this.now() + 1400 + Math.random() * (this.s.betTime * 350) : 0;
  }

  // ---- rolling --------------------------------------------------------
  step(t) {
    if (this.phase !== 'betting') return false;
    if (t >= this.betDeadline) { this.startRoll(); return true; }
    if (this.botShooterAt && t >= this.botShooterAt) { this.startRoll(); return true; }
    return false;
  }

  startRoll() {
    if (this.phase !== 'betting') return;
    this.phase = 'rolling';
    this.betDeadline = 0;
    this.botShooterAt = 0;
    this.rollNo++;
    this.rollDice = rollTwo();
    this.emit('roll-start', { dice: this.rollDice });
    this.after(1650, () => this.land());
  }

  resolveBet(b, outcome, netPays, clear) {
    const payout = outcome === 'win' ? Math.floor(b.amount * (netPays + 1)) : outcome === 'push' ? b.amount : 0;
    const p = this.player(b.pid);
    if (p) p.chips += payout;
    b.outcome = outcome;
    this.roundNet[b.pid] = (this.roundNet[b.pid] || 0) + payout - b.amount;
    if (clear) this.bets.splice(this.bets.indexOf(b), 1);
  }

  resolveLine(spot, outcome) {
    for (const b of this.bets.filter((b) => b.spot === spot).slice()) this.resolveBet(b, outcome, 1, true);
  }

  resolveRoll(sum, hard) {
    const comeOut = this.point === null;
    const notes = [];
    let shooterChanges = false;
    const line = { pass: null, dpass: null };

    for (const b of this.bets.filter((b) => b.spot === 'field').slice()) {
      const pays = fieldPays(sum);
      this.resolveBet(b, pays !== null ? 'win' : 'lose', pays || 0, true);
    }

    if (sum === 7) {
      for (const b of this.bets.filter((b) => b.spot.startsWith('place:') || b.spot.startsWith('hard:')).slice()) {
        this.resolveBet(b, 'lose', 0, true);
      }
    } else if (PLACE_NUMS.includes(sum)) {
      for (const b of this.bets.filter((b) => b.spot === `place:${sum}`).slice()) {
        this.resolveBet(b, 'win', PLACE_PAYS[sum], false);
      }
      const hardSpot = `hard:${sum}`;
      for (const b of this.bets.filter((b) => b.spot === hardSpot).slice()) {
        this.resolveBet(b, hard ? 'win' : 'lose', HARD_PAYS[sum], !hard);
      }
    }

    if (comeOut) {
      if (sum === 7 || sum === 11) {
        this.resolveLine('pass', 'win'); this.resolveLine('dpass', 'lose');
        line.pass = 'win'; line.dpass = 'lose';
        notes.push(`${sum === 7 ? 'Seven' : 'Eleven'}, a natural — pass line wins.`);
      } else if (sum === 2 || sum === 3) {
        this.resolveLine('pass', 'lose'); this.resolveLine('dpass', 'win');
        line.pass = 'lose'; line.dpass = 'win';
        notes.push(`Craps, ${sum} — pass line loses.`);
      } else if (sum === 12) {
        this.resolveLine('pass', 'lose'); this.resolveLine('dpass', 'push');
        line.pass = 'lose'; line.dpass = 'push';
        notes.push('Twelve — craps, don’t pass pushes.');
      } else {
        this.point = sum;
        notes.push(`Point is ${sum}.`);
      }
    } else if (sum === this.point) {
      this.resolveLine('pass', 'win'); this.resolveLine('dpass', 'lose');
      line.pass = 'win'; line.dpass = 'lose';
      notes.push(`${sum} — the point! Pass line wins.`);
      this.point = null;
    } else if (sum === 7) {
      this.resolveLine('pass', 'lose'); this.resolveLine('dpass', 'win');
      line.pass = 'lose'; line.dpass = 'win';
      notes.push('Seven out.');
      this.point = null;
      shooterChanges = true;
    }
    return { notes, shooterChanges, line };
  }

  land() {
    const [a, b] = this.rollDice;
    const sum = a + b;
    const hard = isHard(this.rollDice);
    const pointBefore = this.point;
    const { notes, shooterChanges, line } = this.resolveRoll(sum, hard);
    this.phase = 'result';
    this.lastRoll = { dice: this.rollDice, sum, hard, pointBefore, point: this.point, notes, shooterChanges, line };
    this.history.unshift({ dice: this.rollDice, sum });
    this.history = this.history.slice(0, 16);
    this.emit('land', { sum, dice: this.rollDice, shooterChanges });
    for (const n of notes) this.note(n);
    if (shooterChanges) {
      this.advanceShooter();
      this.note(`${this.name(this.shooterId)} has the dice.`);
    }
    this.after(2900, () => this.nextBetting());
  }

  nextBetting(first = false) {
    this.phase = 'betting';
    this.roundNet = {};
    this.betDeadline = this.now() + this.s.betTime * 1000 + (first ? 1500 : 0);
    this.botsBet();
    this.armShooterBot();
  }

  // ---- views -------------------------------------------------------------
  view(pid) {
    return {
      game: 'craps',
      phase: this.phase,
      point: this.point,
      shooter: this.shooterId,
      rollNo: this.rollNo,
      dice: this.phase === 'rolling' || this.phase === 'result' ? this.rollDice : null,
      lastRoll: this.lastRoll,
      history: this.history,
      bets: this.bets.map((b) => ({ pid: b.pid, spot: b.spot, amount: b.amount, outcome: this.phase === 'result' ? b.outcome : null })),
      betLeft: this.remaining(this.betDeadline),
      betTime: this.s.betTime,
      net: this.phase === 'result' ? this.roundNet : null,
      you: {
        isShooter: pid === this.shooterId,
        canRoll: pid === this.shooterId && this.phase === 'betting',
        total: this.total(pid),
      },
      settings: this.s,
      events: this.events,
      log: this.log.slice(-30),
    };
  }
}
