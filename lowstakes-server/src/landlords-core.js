// One private Landlords table on the server. Plain JavaScript with no Cloudflare or browser APIs, so it is tested in Node and
// wrapped by the Durable Object in table.js (the same wrapper the other games use).
//
// Who decides what:
//   * The rules engine (engine/games/landlords.js) decides every game fact. Players only send small requests.
//   * The database decides money. The entry fee is taken (escrow) when a player is seated, the pot is paid once to the winner,
//     or everything is refunded if the match is cancelled. This file never edits a balance; it asks and records the answer.
//   * Seats belong to accounts. A browser that disconnects keeps its seat for five minutes; coming back (any device, same account)
//     restores everything. Nothing here depends on the connection that is open at the moment.
import { Landlords, RECONNECT_MS } from './engine/games/landlords.js';
import { cleanSettings, cleanFee, MIN_SEATS, MAX_SEATS } from './engine/games/landlords-data.js';

const TOUCH_MS = 30_000;
const MATCH_TOUCH_MS = 60_000;
const SETTLE_RETRY_MS = 3_000;
const MAX_NAME = 20;

// Requests from a browser are plain data. Anything that is not (deep nesting, huge arrays or strings, odd keys, NaN) is refused
// before it can reach the rules engine.
export function sanitize(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > 1e9) throw new Error('bad'); return v; }
  if (typeof v === 'string') { if (v.length > 64) throw new Error('bad'); return v; } // long enough for a UUID player id
  if (depth > 3) throw new Error('bad');
  if (Array.isArray(v)) { if (v.length > 30) throw new Error('bad'); return v.map((x) => sanitize(x, depth + 1)); }
  if (typeof v === 'object') {
    const out = {};
    const keys = Object.keys(v);
    if (keys.length > 12) throw new Error('bad');
    for (const k of keys) {
      if (k.length > 12 || k === '__proto__' || k === 'constructor' || k === 'prototype') throw new Error('bad');
      out[k] = sanitize(v[k], depth + 1);
    }
    return out;
  }
  throw new Error('bad');
}

export class LandlordsCore {
  constructor({ code, wallet, now = () => Date.now(), log = () => {}, onSave = () => {}, rng } = {}) {
    this.kind = 'landlords';
    this.code = code;
    this.wallet = wallet;
    this.now = now;
    this.log = log;
    this.onSave = onSave;
    this.rng = rng;
    this.conns = new Map(); // pid -> connection
    this.closed = false;
    this.phase = 'new'; // new -> lobby -> play -> done | cancelled
    this.fee = 0;
    this.hostId = null;
    this.settings = cleanSettings({});
    this.members = []; // { id, name, dcAt }
    this.game = null;
    this.reserved = new Set();
    this.settle = { status: 'none', winner: null, pot: 0, tries: 0, at: 0 }; // none | pending | paid | refunded
    this.dirty = true;
    this.lastTouch = 0;
    this.lastMatchTouch = 0;
    this.settling = false;
    this.starting = false;
    this.saveDirty = false;
  }

  // ---- basics ---------------------------------------------------------------------------------------------------
  member(id) { return this.members.find((m) => m.id === id); }
  name(id) { const m = this.member(id); return m ? m.name : 'Someone'; }
  changed() { this.dirty = true; this.saveDirty = true; }
  notify(pid, text, kind = 'info') { const c = this.conns.get(pid); if (c && c.open) { try { c.send({ t: 'notice', text, kind }); } catch {} } }
  active() { return this.phase === 'lobby' || this.phase === 'play' || (this.phase === 'done' && this.settle.status === 'pending'); }
  cleanName(n) { return String(n || 'Player').replace(/[^\w .'-]/g, '').slice(0, MAX_NAME) || 'Player'; }

  // ---- creating, previewing and joining ---------------------------------------------------------------------------------
  async create(conn, user, { fee, settings }) {
    if (this.phase !== 'new') return { ok: false, why: 'code_taken' };
    const f = cleanFee(fee);
    if (f === null) return { ok: false, why: 'bad_fee' };
    let r;
    try { r = await this.wallet.landlordsCreate(user.id, this.code, f); }
    catch (e) { return { ok: false, why: (e && e.code) || 'error' }; }
    this.phase = 'lobby';
    this.fee = f;
    this.hostId = user.id;
    this.settings = cleanSettings(settings);
    this.members = [{ id: user.id, name: this.cleanName(r && r.username), dcAt: 0 }];
    this.conns.set(user.id, conn);
    this.lastMatchTouch = this.now();
    this.changed();
    return { ok: true };
  }

  // What someone sees before they decide to join. Nothing is charged and nobody is seated.
  async peek(user) {
    const seated = !!this.member(user.id);
    let balance = null;
    try { balance = await this.wallet.balance(user.id); } catch {}
    return {
      phase: 'peek', state: this.phase, fee: this.fee, hostName: this.name(this.hostId), count: this.members.length, max: MAX_SEATS, min: MIN_SEATS,
      settings: this.settings, seated, balance, names: this.members.map((m) => m.name),
      full: this.members.length + this.reserved.size >= MAX_SEATS, started: this.phase !== 'lobby',
    };
  }

  async connect(conn, user, msg = {}) {
    if (this.closed || this.phase === 'new' || this.phase === 'cancelled' && !this.member(user.id)) return { ok: false, why: 'notfound' };
    const m = this.member(user.id);
    if (m) { // coming back to a seat they already hold: never charged again
      const old = this.conns.get(user.id);
      if (old && old !== conn) { try { old.close(); } catch {} }
      this.conns.set(user.id, conn);
      m.dcAt = 0;
      if (this.game) this.game.setConnected(user.id, true);
      this.changed();
      return { ok: true };
    }
    if (msg.join !== true) return { ok: false, why: 'confirm' };
    if (this.phase !== 'lobby') return { ok: false, why: 'already_started' };
    if (this.members.length + this.reserved.size >= MAX_SEATS) return { ok: false, why: 'full', limit: MAX_SEATS };
    this.reserved.add(user.id);
    let r;
    try { r = await this.wallet.landlordsJoin(user.id, this.code); }
    catch (e) { return { ok: false, why: (e && e.code) || 'error' }; }
    finally { this.reserved.delete(user.id); }
    // Something changed while the fee was being taken (should be impossible, but never keep money for a seat that is not there).
    if (this.phase !== 'lobby' || this.members.length >= MAX_SEATS || this.closed) {
      try { await this.wallet.landlordsLeave(user.id, this.code); } catch { this.log('refund after failed join did not go through', user.id); }
      return { ok: false, why: this.phase === 'lobby' ? 'full' : 'already_started' };
    }
    this.members.push({ id: user.id, name: this.cleanName(r && r.username), dcAt: 0 });
    this.conns.set(user.id, conn);
    this.changed();
    return { ok: true };
  }

  disconnect(pid, conn) {
    if (this.conns.get(pid) !== conn) return;
    this.conns.delete(pid);
    const m = this.member(pid);
    if (m && !m.dcAt) m.dcAt = this.now();
    if (this.game) this.game.setConnected(pid, false);
    this.changed();
  }

  // ---- messages from a seated player -----------------------------------------------------------------------------------
  receive(pid, msg) {
    if (!this.member(pid) || !msg || typeof msg !== 'object') return;
    if (msg.t === 'lact') {
      if (this.phase !== 'play' || !this.game) return;
      let a;
      try { a = sanitize(msg.a); } catch { this.notify(pid, 'That request was not understood.', 'warn'); return; }
      const r = this.game.act(pid, a);
      if (!r.ok && r.error && r.error !== 'not_now') this.notify(pid, ERRORS[r.error] || 'That is not allowed right now.', 'warn');
      else if (!r.ok) this.notify(pid, ERRORS.not_now, 'warn');
      this.changed();
    } else if (msg.t === 'lcmd') this.command(pid, msg).catch((e) => this.log('command failed', e && e.message));
    else if (msg.t === 'refresh') this.changed();
  }

  async command(pid, msg) {
    switch (msg.c) {
      case 'start': return this.start(pid);
      case 'leave': return this.leave(pid);
      case 'kick': return this.kick(pid, String(msg.pid || ''));
      default:
    }
  }

  async start(pid) {
    if (pid !== this.hostId) return this.notify(pid, 'Only the host can start the game.', 'warn');
    if (this.phase !== 'lobby' || this.starting) return;
    if (this.members.length < MIN_SEATS) return this.notify(pid, `You need at least ${MIN_SEATS} players to start.`, 'warn');
    this.starting = true;
    try {
      try { await this.wallet.landlordsStart(this.code, this.hostId); }
      catch (e) { return this.notify(pid, e && e.code === 'not_enough_players' ? `You need at least ${MIN_SEATS} players to start.` : 'Could not start the game. Try again.', 'warn'); }
      if (this.phase !== 'lobby') return;
      this.game = new Landlords({ players: this.members.map((m) => ({ id: m.id, name: m.name })), settings: this.settings, now: this.now, rng: this.rng });
      for (const m of this.members) if (m.dcAt) this.game.setConnected(m.id, false);
      this.phase = 'play';
      this.changed();
    } finally { this.starting = false; }
  }

  async leave(pid) {
    const m = this.member(pid);
    if (!m) return;
    if (this.phase === 'lobby') {
      if (pid === this.hostId) { // the host leaving closes the lobby; everybody is refunded
        await this.cancelMatch('host_left');
        return;
      }
      try { await this.wallet.landlordsLeave(pid, this.code); } catch (e) { return this.notify(pid, 'Could not leave right now. Try again.', 'warn'); }
      this.members = this.members.filter((x) => x.id !== pid);
      this.sendTo(pid, { t: 'left' });
      this.dropConn(pid);
      this.changed();
    } else if (this.phase === 'play' && this.game) {
      this.game.act(pid, { type: 'resign' }); // leaving a running match is giving up: the same as going bankrupt, entry fee stays in the pot
      try { await this.wallet.landlordsLeave(pid, this.code); } catch {}
      this.sendTo(pid, { t: 'left' });
      this.dropConn(pid);
      this.changed();
    } else {
      try { await this.wallet.landlordsLeave(pid, this.code); } catch {}
      this.sendTo(pid, { t: 'left' });
      this.dropConn(pid);
    }
  }

  async kick(host, target) {
    if (host !== this.hostId || this.phase !== 'lobby' || target === host || !this.member(target)) return;
    try { await this.wallet.landlordsLeave(target, this.code); } catch { return this.notify(host, 'Could not remove that player right now.', 'warn'); }
    this.members = this.members.filter((x) => x.id !== target);
    this.sendTo(target, { t: 'kicked' });
    this.dropConn(target);
    this.changed();
  }

  sendTo(pid, msg) { const c = this.conns.get(pid); if (c && c.open) { try { c.send(msg); } catch {} } }
  dropConn(pid) { const c = this.conns.get(pid); this.conns.delete(pid); if (c) setTimeout(() => { try { c.close(); } catch {} }, 250); }

  async cancelMatch(reason) {
    if (this.phase === 'cancelled') return;
    const prev = this.phase;
    this.phase = 'cancelled';
    this.settle = { status: 'pending', winner: null, pot: 0, tries: 0, at: 0, cancel: reason };
    if (this.game) this.game.cancel(reason);
    this.broadcast({ t: 'closed', reason });
    this.changed();
    await this.runSettle();
    return prev;
  }

  // ---- the clock ---------------------------------------------------------------------------------------------------
  tick() {
    if (this.closed) return;
    const t = this.now();
    if (this.phase === 'lobby') this.lobbyTimers(t);
    if (this.game && this.phase === 'play') {
      if (this.game.tick()) this.changed();
      if (this.game.phase === 'over') this.endMatch(this.game.winner);
      else if (this.game.phase === 'cancelled') { this.phase = 'cancelled'; this.settle = { status: 'pending', winner: null, pot: 0, tries: 0, at: 0, cancel: this.game.endReason }; this.changed(); }
    }
    if ((this.phase === 'done' || this.phase === 'cancelled') && this.settle.status === 'pending' && !this.settling && t - this.settle.at >= SETTLE_RETRY_MS) this.runSettle();
    if (t - this.lastTouch > TOUCH_MS) {
      this.lastTouch = t;
      for (const m of this.members) if (!m.dcAt) this.wallet.touch(m.id, this.code).catch(() => {});
    }
    if (this.active() && t - this.lastMatchTouch > MATCH_TOUCH_MS) { this.lastMatchTouch = t; this.wallet.landlordsTouch(this.code).catch(() => {}); }
    if (this.dirty) { this.dirty = false; this.flush(); }
    if (this.saveDirty) { this.saveDirty = false; try { this.onSave(); } catch {} }
  }

  // In the lobby a seat is held for five minutes after a disconnect too; the host vanishing closes the lobby.
  lobbyTimers(t) {
    for (const m of [...this.members]) {
      if (!m.dcAt || t - m.dcAt < RECONNECT_MS) continue;
      if (m.id === this.hostId) { this.cancelMatch('host_left'); return; }
      this.members = this.members.filter((x) => x.id !== m.id);
      this.wallet.landlordsLeave(m.id, this.code).catch(() => { this.members.push(m); }); // not refunded? keep the seat and try again next tick
      this.changed();
    }
  }

  endMatch(winnerId) {
    if (this.phase !== 'play') return;
    this.phase = 'done';
    this.settle = { status: 'pending', winner: winnerId, pot: 0, tries: 0, at: 0 };
    this.changed();
    this.runSettle();
  }

  // Tell the database. Safe to repeat: the database pays the winner once however many times this runs.
  async runSettle() {
    if (this.settling) return;
    this.settling = true;
    try {
      this.settle.tries++; this.settle.at = this.now();
      if (this.phase === 'done') {
        const r = await this.wallet.landlordsFinish(this.code, this.settle.winner);
        this.settle = { ...this.settle, status: 'paid', pot: Number(r && r.pot) || 0, winner: (r && r.winner) || this.settle.winner };
      } else if (this.phase === 'cancelled') {
        await this.wallet.landlordsCancel(this.code, (this.settle.cancel || 'cancelled'));
        this.settle = { ...this.settle, status: 'refunded' };
      }
      this.changed();
    } catch (e) {
      this.log('settlement failed, will retry', e && e.code);
      this.settle.at = this.now();
      if (e && ['not_playing', 'notfound', 'bad_winner'].includes(e.code)) { this.settle = { ...this.settle, status: 'error', error: e.code }; this.changed(); }
    } finally { this.settling = false; }
  }

  // ---- what each player is shown --------------------------------------------------------------------------------------------
  lobbyView(pid) {
    const t = this.now();
    return {
      phase: 'lobby', code: this.code, fee: this.fee, hostId: this.hostId, settings: this.settings, min: MIN_SEATS, max: MAX_SEATS,
      pot: this.fee * this.members.length,
      members: this.members.map((m) => ({ id: m.id, name: m.name, connected: !m.dcAt, dcLeft: m.dcAt ? Math.max(0, RECONNECT_MS - (t - m.dcAt)) : 0 })),
      you: { id: pid, host: pid === this.hostId },
    };
  }
  view(pid) {
    if (this.phase === 'lobby') return this.lobbyView(pid);
    const g = this.game ? this.game.view(pid) : {};
    const n = this.members.length;
    return { ...g, phase: this.phase === 'play' ? 'play' : this.phase, code: this.code, fee: this.fee, hostId: this.hostId, pot: this.fee * n, entries: n,
      settle: { status: this.settle.status, winner: this.settle.winner, pot: this.settle.pot || this.fee * n }, you: { ...(g.you || {}), id: pid, host: pid === this.hostId } };
  }
  broadcast(msg) { for (const c of this.conns.values()) if (c.open) { try { c.send(msg); } catch {} } }
  flush() {
    for (const [pid, conn] of this.conns) {
      if (!conn.open) continue;
      try { conn.send({ t: 'll', ...this.view(pid) }); } catch {}
    }
  }

  // ---- persistence (so a restarted server carries on) --------------------------------------------------------------------------
  snapshot() {
    return {
      v: 1, code: this.code, phase: this.phase, fee: this.fee, hostId: this.hostId, settings: this.settings, members: this.members,
      settle: this.settle, game: this.game ? this.game.snapshot() : null,
    };
  }
  static restore(snap, deps) {
    const c = new LandlordsCore(deps);
    c.code = snap.code; c.phase = snap.phase; c.fee = snap.fee; c.hostId = snap.hostId; c.settings = snap.settings; c.members = snap.members; c.settle = snap.settle;
    for (const m of c.members) if (!m.dcAt) m.dcAt = c.now(); // nobody is connected after a restart; the clock for coming back starts now
    if (snap.game) { c.game = Landlords.restore(snap.game, { now: deps.now, rng: deps.rng }); for (const s of c.game.seats) if (!s.out && !s.dcAt) c.game.setConnected(s.id, false); }
    c.lastMatchTouch = 0;
    c.changed();
    return c;
  }
  // Does the Durable Object still have to wake up on its own (alarm) to run timers?
  needsWake() { return this.active() && !this.closed; }

  async shutdown() { this.closed = true; }
}

const ERRORS = {
  not_now: 'Not right now.', not_playing: 'You are not in this game any more.', cannot_buy: 'You cannot buy that.', not_enough_cash: 'You do not have enough cash.',
  cannot_build: 'You cannot build there right now.', cannot_sell: 'You cannot sell that right now.', cannot_mortgage: 'That cannot be mortgaged.', cannot_unmortgage: 'That cannot be un-mortgaged.',
  bid_too_low: 'Your bid is too low.', bad_amount: 'That is not a valid amount.', already_highest: 'You are already the highest bidder.',
  not_owner: 'You do not own one of those properties.', has_buildings: 'Sell the buildings on that colour set first.', empty_trade: 'The offer is empty.',
  trade_exists: 'You already have an offer open with that player.', too_many_trades: 'You have three offers open already.', trade_changed: 'That offer has changed.',
  cannot_pay_interest: 'A mortgaged property needs 10% interest paid straight away, and there is not enough cash.', bad_trade: 'That offer is not valid.', bad_player: 'Pick another player.',
  game_over: 'The game is over.', bad_action: 'That request was not understood.',
};
