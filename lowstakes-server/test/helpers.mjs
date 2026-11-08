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
