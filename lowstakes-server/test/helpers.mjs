import { TableCore } from '../src/core.js';
import { WalletError } from '../src/wallet.js';

const CAP = { roulette: 35, crash: 999, blackjack: 12, holdem: 100 };

// Behaves like supabase/migrations/0001 + 0002 (seating, idempotent per-round settlement, caps, never below zero).
export class FakeWallet {
  constructor() { this.users = new Map(); this.presence = new Map(); this.ledger = []; this.fail = null; this.calls = []; this.clock = () => Date.now(); }
  add(id, username, balance = 20000) { this.users.set(id, { username, balance }); return id; }
  bal(id) { return this.users.get(id).balance; }
  async join(id, code, game) {
    this.calls.push(['join', id, code]);
    const u = this.users.get(id); if (!u) throw new WalletError('not_registered');
    const p = this.presence.get(id);
    if (p && p.code !== code && this.clock() - p.seen < 120000) throw new WalletError('already_at_table');
    this.presence.set(id, { code, game, seen: this.clock() });
    return { username: u.username, balance: u.balance };
  }
  async leave(id, code) { this.calls.push(['leave', id, code]); const p = this.presence.get(id); if (p && p.code === code) this.presence.delete(id); }
  async touch(id, code) { const p = this.presence.get(id); if (p && p.code === code) p.seen = this.clock(); }
  async balance(id) { return this.users.get(id).balance; }
  async settle(items) {
    this.calls.push(['settle', items]);
    if (this.fail) { const f = this.fail; if (f.times-- > 0) throw new WalletError(f.code || 'network'); this.fail = null; }
    return items.map((it) => {
      const u = this.users.get(it.user);
      try {
        if (!u) throw new Error('not_registered');
        if (!CAP[it.game]) throw new Error('bad_game');
        const p = this.presence.get(it.user); if (!p || p.code !== it.table) throw new Error('not_seated');
        const key = `round:${it.game}:${it.table}:${it.ref}`;
        if (this.ledger.some((l) => l.user === it.user && l.key === key)) return { user: it.user, ok: true, already: true, balance: u.balance };
        if (it.delta === 0) return { user: it.user, ok: true, noop: true, balance: u.balance };
        if (it.delta < -u.balance) throw new Error('insufficient_balance');
        if (it.delta > Math.floor(CAP[it.game] * u.balance)) throw new Error('gain_too_large');
        u.balance += it.delta;
        this.ledger.push({ user: it.user, key, delta: it.delta, balance_after: u.balance, game: it.game, ref: it.ref });
        return { user: it.user, ok: true, balance: u.balance };
      } catch (e) { return { user: it.user, ok: false, error: e.message }; }
    });
  }
}

// Behaves like supabase/migrations/0004 (escrowed entry fees, one payout, refunds on cancel).
Object.assign(FakeWallet.prototype, {
  _m(code) { this.matches ||= new Map(); return this.matches.get(code); },
  _fail(code) { if (this.failLl && this.failLl.times-- > 0) throw new WalletError(this.failLl.code || 'network'); },
  _seat(id, code) {
    const p = this.presence.get(id);
    if (p && p.code !== code && this.clock() - p.seen < 120000) throw new WalletError('already_at_table');
    this.presence.set(id, { code, game: 'landlords', seen: this.clock() });
  },
  _charge(m, id) {
    const u = this.users.get(id); if (!u) throw new WalletError('not_registered');
    if (m.fee > u.balance) throw new WalletError('insufficient_balance');
    if (m.fee > 0) { u.balance -= m.fee; this.ledger.push({ user: id, type: 'landlords_entry', delta: -m.fee, ref: m.id }); }
    m.entries.set(id, { status: 'held', fee: m.fee });
  },
  async landlordsCreate(id, code, fee) {
    this._fail(); const u = this.users.get(id); if (!u) throw new WalletError('not_registered');
    if (!/^[A-Z0-9]{5}$/.test(code)) throw new WalletError('bad_table'); if (!Number.isInteger(fee) || fee < 0 || fee > 100000) throw new WalletError('bad_fee');
    const open = this._m(code); if (open && ['lobby', 'playing'].includes(open.status)) throw new WalletError('code_taken');
    this._seat(id, code);
    const m = { id: `m${(this.matchSeq = (this.matchSeq || 0) + 1)}`, code, host: id, fee, status: 'lobby', entries: new Map(), pot: 0, winner: null };
    this.matches.set(code, m); this._charge(m, id);
    return { match: m.id, username: u.username, fee, balance: u.balance };
  },
  async landlordsJoin(id, code) {
    this._fail(); const u = this.users.get(id); if (!u) throw new WalletError('not_registered');
    const m = this._m(code); if (!m || !['lobby', 'playing'].includes(m.status)) throw new WalletError('notfound');
    const e = m.entries.get(id); if (e && e.status !== 'refunded') return { match: m.id, username: u.username, fee: m.fee, already: true };
    if (m.status !== 'lobby') throw new WalletError('already_started');
    if ([...m.entries.values()].filter((x) => x.status === 'held').length >= 6) throw new WalletError('full');
    this._seat(id, code); this._charge(m, id);
    return { match: m.id, username: u.username, fee: m.fee, balance: u.balance };
  },
  async landlordsLeave(id, code) {
    this._fail(); const m = this._m(code);
    if (m) {
      const e = m.entries.get(id);
      if (e && m.status === 'lobby' && e.status === 'held') { const u = this.users.get(id); if (e.fee > 0) { u.balance += e.fee; this.ledger.push({ user: id, type: 'landlords_refund', delta: e.fee, ref: m.id }); } m.entries.delete(id); }
      else if (e && m.status === 'playing' && e.status === 'held') e.status = 'forfeit';
    }
    const p = this.presence.get(id); if (p && p.code === code) this.presence.delete(id);
    return { left: true };
  },
  async landlordsStart(code, host) {
    this._fail(); const m = this._m(code); if (!m || !['lobby', 'playing'].includes(m.status)) throw new WalletError('notfound');
    if (m.host !== host) throw new WalletError('not_host'); if (m.status === 'playing') return { already: true, pot: m.pot };
    const n = [...m.entries.values()].filter((x) => x.status === 'held').length; if (n < 4) throw new WalletError('not_enough_players');
    m.status = 'playing'; m.pot = m.fee * n; return { match: m.id, pot: m.pot, players: n };
  },
  async landlordsFinish(code, winner) {
    this._fail(); const m = this._m(code); if (!m) throw new WalletError('notfound');
    if (m.status === 'finished') return { already: true, winner: m.winner, pot: m.pot };
    if (m.status !== 'playing') throw new WalletError('not_playing'); if (!m.entries.has(winner)) throw new WalletError('bad_winner');
    const u = this.users.get(winner); if (m.pot > 0) { u.balance += m.pot; this.ledger.push({ user: winner, type: 'landlords_prize', delta: m.pot, ref: m.id }); }
    m.status = 'finished'; m.winner = winner;
    for (const id of m.entries.keys()) { const p = this.presence.get(id); if (p && p.code === code) this.presence.delete(id); }
    return { match: m.id, winner, pot: m.pot, balance: u.balance };
  },
  async landlordsCancel(code, reason) {
    this._fail(); const m = this._m(code); if (!m) return { cancelled: false };
    if (['finished', 'cancelled'].includes(m.status)) return { already: true, status: m.status };
    let n = 0;
    for (const [id, e] of m.entries) if (['held', 'forfeit'].includes(e.status)) { const u = this.users.get(id); if (e.fee > 0) { u.balance += e.fee; this.ledger.push({ user: id, type: 'landlords_refund', delta: e.fee, ref: m.id }); } e.status = 'refunded'; n++; }
    m.status = 'cancelled'; m.reason = reason;
    for (const id of m.entries.keys()) { const p = this.presence.get(id); if (p && p.code === code) this.presence.delete(id); }
    return { cancelled: true, refunded: n };
  },
  async landlordsTouch() {},
  async landlordsSweep() { return 0; },
});

export function fakeConn() {
  const c = { open: true, sent: [], closed: false, send(m) { c.sent.push(m); }, close() { c.open = false; c.closed = true; } };
  c.last = (t) => [...c.sent].reverse().find((m) => m.t === t);
  c.notices = () => c.sent.filter((m) => m.t === 'notice').map((m) => m.text);
  return c;
}

export function setup({ users = [['u1', 'Alice_1', 20000]], code = 'TESTA' } = {}) {
  const clock = { t: 1_000_000 };
  const wallet = new FakeWallet();
  wallet.clock = () => clock.t;
  for (const [id, name, bal] of users) wallet.add(id, name, bal);
  const core = new TableCore({ code, wallet, now: () => clock.t });
  const conns = {};
  const advance = async (ms) => { for (let t = 0; t < ms; t += 50) { clock.t += 50; core.tick(); if (t % 200 === 0) await Promise.resolve(); } for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
  const join = async (id) => { conns[id] = fakeConn(); return core.connect(conns[id], { id, email: `${id}@x.com` }); };
  return { clock, wallet, core, conns, advance, join };
}
