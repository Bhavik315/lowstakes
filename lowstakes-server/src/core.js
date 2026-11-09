// One table on the server. It is plain JavaScript with no Cloudflare or browser APIs, so it is tested in Node and
// wrapped by the Durable Object in table.js.
//
// Who decides what:
//   * The game engines (the same files the browser uses) deal, spin and pay, on this server.
//   * Players only send actions ("bet 25 on red", "cash out"); they never send an amount to credit.
//   * Identity comes from a Supabase-verified token; the username and balance come from the database.
//   * Each finished round's NET result (a gain or loss) is written to the wallet once, through settle_round().
import { Holdem } from './engine/games/holdem.js';
import { Blackjack } from './engine/games/blackjack.js';
import { Roulette } from './engine/games/roulette.js';
import { Crash } from './engine/games/crash.js';

const GAMES = { holdem: Holdem, blackjack: Blackjack, roulette: Roulette, crash: Crash };
export const GAME_LIMITS = { holdem: 9, blackjack: 7, roulette: 12, crash: 12 };
export const GAME_NAMES = { holdem: 'Poker', blackjack: 'Blackjack', roulette: 'Roulette', crash: 'Crash' };
const MAX_PLAYERS = 12;
const BOT_START = 1000; // bots play with free chips; they have no wallet
const COLORS = ['#E0472F', '#2A55C9', '#E8A825', '#1E8C7E', '#8A3B78', '#EE7B30', '#E86A92', '#4BA3D9', '#7FA83A', '#5B4B8A', '#C2563A', '#2F7D57'];
const BOTS = [['Marguerite', 0.2], ['Big Sal', 0.85], ['Dottie', 0.4], ['Vinnie', 0.7], ['Professor', 0.3], ['June', 0.55], ['Otis', 0.65], ['Lola', 0.9], ['Hank', 0.15], ['Rosa', 0.5], ['Teddy', 0.75]];
const REACTIONS = ['nice', 'lol', 'ouch', 'gg', 'bluff', 'wow'];
const AWAY_MS = 60_000; // a disconnected player's seat is released after this, once nothing is staked

const DEFAULT_SETTINGS = {
  start: BOT_START,
  holdem: { sb: 10, bb: 20, timer: 30 },
  blackjack: { min: 10, timer: 20 },
  roulette: { min: 5, betTime: 20 },
  crash: { min: 5, betTime: 15 },
};
// The only values the owner may choose (same options as the lobby).
const ALLOWED = {
  holdem: { sb: [5, 10, 25, 50], bb: [10, 20, 50, 100], timer: [0, 15, 30, 60] },
  blackjack: { min: [5, 10, 25, 50], timer: [0, 10, 20, 45] },
  roulette: { min: [1, 5, 25], betTime: [15, 20, 40] },
  crash: { min: [1, 5, 25], betTime: [10, 15, 30] },
};

// Chips a player has committed to an unfinished round (same rules as the browser's held()).
export function held(gameId, engine, pid) {
  if (!engine) return 0;
  if (gameId === 'holdem') {
    if (!['betting', 'dealing'].includes(engine.phase)) return 0;
    const s = engine.seats.find((x) => x.pid === pid);
    return s && s.inHand ? s.totalIn : 0;
  }
  if (gameId === 'blackjack') {
    const s = engine.seats.find((x) => x.pid === pid);
    if (!s) return 0;
    return s.bet + (engine.phase === 'settle' ? 0 : s.hands.reduce((a, h) => a + h.bet, 0));
  }
  if (gameId === 'roulette') return engine.phase === 'result' ? 0 : engine.total(pid);
  if (gameId === 'crash') {
    const b = engine.bet(pid);
    if (!b || engine.phase === 'crashed') return 0;
    return b.cashed !== null ? 0 : b.amount;
  }
  return 0;
}

// When is a player's round over, and what is its reference? null = not yet.
function roundOf(gameId, engine, pid) {
  switch (gameId) {
    case 'roulette': return engine.phase === 'result' ? String(engine.spinNo) : null;
    case 'blackjack': return engine.phase === 'settle' ? String(engine.round) : null;
    case 'holdem': return engine.phase === 'handover' || engine.phase === 'waiting' ? String(engine.handNo) : null;
    case 'crash': {
      if (engine.phase === 'crashed') return String(engine.round);
      const b = engine.bet(pid);
      return b && b.cashed !== null && engine.phase === 'running' ? String(engine.round) : null; // paid out mid-round
    }
    default: return null;
  }
}

const clean = (v) => String(v ?? '').trim();

// Players send small plain objects. Anything else (nested objects, huge strings, NaN, Infinity) is dropped
// before it can reach a game engine.
function cleanAction(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const out = {};
  for (const [k, v] of Object.entries(a)) {
    if (k.length > 12) return null;
    if (typeof v === 'string') { if (v.length > 24) return null; out[k] = v; }
    else if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > 1e12) return null; out[k] = v; }
    else if (typeof v === 'boolean' || v === null) out[k] = v;
    else return null;
  }
  return typeof out.type === 'string' ? out : null;
}
const uid = () => Math.random().toString(36).slice(2, 10);

export class TableCore {
  constructor({ code, wallet, now = () => Date.now(), log = () => {} }) {
    this.code = code;
    this.wallet = wallet;
    this.now = now;
    this.log = log;
    this.conns = new Map(); // pid -> connection
    this.engine = null;
    this.gameId = null;
    this.gameSeq = 0;
    this.dirty = true;
    this.closed = false;
    this.ownerId = null;
    this.settling = false;
    this.retry = []; // settle items that failed for a transient reason
    this.chatId = 0;
    this.lastTouch = 0;
    this.room = {
      players: [],
      gameId: null,
      settings: structuredClone(DEFAULT_SETTINGS),
      chat: [],
      rebuy: (pid) => { const p = this.player(pid); if (p && p.bot) { p.chips += BOT_START; } },
    };
  }

  // ---- basics -----------------------------------------------------------
  player(pid) { return this.room.players.find((p) => p.id === pid); }
  humans() { return this.room.players.filter((p) => !p.bot); }
  capacity() { return this.gameId ? GAME_LIMITS[this.gameId] : MAX_PLAYERS; }
  changed() { this.dirty = true; }
  systemMsg(text) { this.pushChat({ pid: null, text }); }

  pushChat(m) {
    m.id = ++this.chatId; m.at = this.now();
    this.room.chat.push(m);
    if (this.room.chat.length > 80) this.room.chat.shift();
    this.changed();
  }

  notify(pid, text, kind = 'info') { const c = this.conns.get(pid); if (c && c.open) { try { c.send({ t: 'notice', text, kind }); } catch {} } }

  assignOwner() {
    const cur = this.player(this.ownerId);
    if (cur && !cur.bot && cur.connected) return;
    const next = this.humans().find((p) => p.connected);
    this.ownerId = next ? next.id : null;
  }

  // ---- joining ------------------------------------------------------------
  // `user` is already verified by the caller: { id, email }. Returns true or a reason string.
  async connect(conn, user) {
    let p = this.player(user.id);
    if (!p && this.room.players.length >= this.capacity()) return { ok: false, why: 'full', game: this.gameId, limit: this.capacity() };
    let acc;
    try { acc = await this.wallet.join(user.id, this.code, this.gameId); }
    catch (e) { return { ok: false, why: e.code || 'error' }; }
    p = this.player(user.id);
    if (!p) {
      if (this.room.players.length >= this.capacity()) { try { await this.wallet.leave(user.id, this.code); } catch {} return { ok: false, why: 'full', game: this.gameId, limit: this.capacity() }; }
      p = {
        id: user.id, name: acc.username, color: COLORS[0], bot: false, connected: true,
        chips: Number(acc.balance), base: Number(acc.balance), joinBalance: Number(acc.balance), buyins: 1, done: new Set(),
      };
      this.room.players.push(p);
      this.systemMsg(`${p.name} sat down.`);
    } else {
      const old = this.conns.get(user.id);
      if (old && old !== conn) { try { old.close(); } catch {} }
      p.connected = true; p.away = 0; p.leaving = false; p.name = acc.username;
      this.systemMsg(`${p.name} is back.`);
    }
    this.conns.set(user.id, conn);
    this.assignOwner();
    if (this.engine && this.engine.onPlayersChanged) this.engine.onPlayersChanged();
    this.changed();
    return { ok: true };
  }

  disconnect(pid, conn) {
    if (this.conns.get(pid) !== conn) return;
    this.conns.delete(pid);
    const p = this.player(pid);
    if (p) { p.connected = false; p.away = this.now(); this.systemMsg(`${p.name} lost connection.`); }
    this.assignOwner();
    this.changed();
  }

  // ---- messages from a seated player ---------------------------------------
  receive(pid, msg) {
    const p = this.player(pid);
    if (!p || !msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'act': { const a = cleanAction(msg.a); if (this.engine && a && this.engine.handle(pid, a)) this.changed(); break; }
      case 'chat': this.chat(pid, msg.text); break;
      case 'react': if (REACTIONS.includes(msg.r)) this.broadcast({ t: 'react', pid, r: msg.r, id: uid() }); break;
      case 'refresh': this.resync(pid); break;
      case 'rebuy': this.notify(pid, 'Free rebuys are off at wallet tables. Your coins are your wallet.', 'warn'); break;
      case 'bye': this.leave(pid); break;
      case 'cmd': this.command(pid, msg); break;
      default:
    }
  }

  chat(pid, text) {
    const p = this.player(pid);
    text = clean(text).slice(0, 240);
    if (p && text) this.pushChat({ pid, name: p.name, color: p.color, text });
  }

  leave(pid) {
    const p = this.player(pid);
    if (!p) return;
    p.leaving = true; p.connected = false;
    this.conns.delete(pid);
    this.systemMsg(`${p.name} left the table.`);
    this.assignOwner();
    this.changed();
  }

  // A player's wallet grew outside the table (a free pack). Bring the table up to date; never mid-save, never downwards.
  // Credits only: a rename (the one thing that spends) is refused while seated, and round results go through settle.
  async resync(pid) {
    const p = this.player(pid);
    if (!p || p.bot) return;
    if (p.saving || this.settling) { p.resyncLater = true; return; }
    let bal;
    try { bal = await this.wallet.balance(p.id); } catch { return; }
    if (p.saving || this.settling) { p.resyncLater = true; return; }
    const diff = bal - p.base;
    if (diff > 0) {
      p.chips += diff; p.base = bal; p.joinBalance += diff; // a top-up is not a table win, so the scoreboard ignores it
      this.notify(pid, `${diff.toLocaleString('en-US')} coins added to your stack.`, 'info');
      this.changed();
    }
  }

  // ---- owner commands --------------------------------------------------------
  command(pid, msg) {
    if (pid !== this.ownerId) { this.notify(pid, 'Only the table owner can do that.', 'warn'); return; }
    const reply = (r) => { if (r && r.ok === false) this.notify(pid, r.message, 'warn'); };
    switch (msg.c) {
      case 'setGame': reply(this.setGame(clean(msg.gameId))); break;
      case 'endGame': this.endGame(); break;
      case 'addBot': reply(this.addBot(msg.forGame ? clean(msg.forGame) : undefined)); break;
      case 'removePlayer': this.removePlayer(clean(msg.pid)); break;
      case 'updateSettings': this.updateSettings(msg.patch); break;
      case 'setPaused': if (this.engine && 'paused' in this.engine) { this.engine.paused = !!msg.on; if (!msg.on && this.engine.phase === 'waiting') this.engine.maybeStart(); this.changed(); } break;
      default:
    }
  }

  fullMessage(gameId) {
    const n = gameId ? GAME_LIMITS[gameId] : MAX_PLAYERS;
    return gameId ? `${GAME_NAMES[gameId]} seats ${n} and all ${n} seats are taken.` : `The table is full (${n} players).`;
  }

  setGame(gameId) {
    const G = GAMES[gameId];
    if (!G) return { ok: false, message: 'Unknown game.' };
    const cap = GAME_LIMITS[gameId];
    const have = this.room.players.length;
    if (have > cap) {
      const over = have - cap;
      return { ok: false, message: `${GAME_NAMES[gameId]} seats ${cap}, but ${have} are at the table. Remove ${over} ${over === 1 ? 'player or bot' : 'players or bots'} to deal it.` };
    }
    if (this.engine) this.endGame(true);
    this.gameId = gameId;
    this.room.gameId = gameId;
    this.gameSeq += 1;
    const t0 = Date.now();
    this.engine = new G(this.room, this.room.settings[gameId]);
    this.engine.now = this.now;
    // Engines schedule their first jobs in the constructor using the real clock; re-base them onto this table's clock
    // (a no-op in production, where the two are the same).
    const skew = this.now() - t0;
    if (Math.abs(skew) > 5) for (const j of this.engine.jobs) j.at += skew;
    this.systemMsg(`Now playing ${GAME_NAMES[gameId]}.`);
    this.changed();
    return { ok: true };
  }

  endGame(quiet = false) {
    if (this.engine) {
      // Chips in an unfinished round go back to their owners; the round never happened.
      for (const p of this.room.players) p.chips += held(this.gameId, this.engine, p.id);
      this.engine.clearJobs();
    }
    this.engine = null;
    this.gameId = null;
    this.room.gameId = null;
    if (!quiet) this.systemMsg('Back to the lobby.');
    this.changed();
  }

  addBot(forGame) {
    const gameId = this.gameId || forGame || null;
    const cap = gameId && GAME_LIMITS[gameId] ? GAME_LIMITS[gameId] : MAX_PLAYERS;
    if (this.room.players.length >= cap) return { ok: false, message: this.fullMessage(gameId) };
    const taken = new Set(this.room.players.map((p) => p.name));
    const pick = BOTS.find(([n]) => !taken.has(n)) || [`Bot ${this.room.players.length}`, 0.5];
    const used = new Set(this.room.players.map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[this.room.players.length % COLORS.length];
    this.room.players.push({ id: `bot-${uid()}`, name: pick[0], color, bot: true, style: pick[1], connected: true, chips: BOT_START, buyins: 1, joinBalance: BOT_START });
    this.systemMsg(`${pick[0]} (bot) sat down.`);
    if (this.engine && this.engine.onPlayersChanged) this.engine.onPlayersChanged();
    this.changed();
    return { ok: true };
  }

  removePlayer(pid) {
    const p = this.player(pid);
    if (!p || pid === this.ownerId) return;
    if (this.engine && held(this.gameId, this.engine, pid) > 0) { p.leaving = true; p.connected = false; }
    else this.dropPlayer(p, 'removed');
    const conn = this.conns.get(pid);
    if (conn) { try { conn.send({ t: 'kicked' }); } catch {} setTimeout(() => { try { conn.close(); } catch {} }, 200); this.conns.delete(pid); }
    this.systemMsg(`${p.name} was removed from the table.`);
    this.changed();
  }

  updateSettings(patch) {
    if (!patch || typeof patch !== 'object') return;
    for (const g of Object.keys(ALLOWED)) {
      const src = patch[g];
      if (!src || typeof src !== 'object') continue;
      for (const k of Object.keys(ALLOWED[g])) {
        if (k in src && ALLOWED[g][k].includes(Number(src[k]))) this.room.settings[g][k] = Number(src[k]);
      }
    }
    if (this.engine && this.engine.s) Object.assign(this.engine.s, this.room.settings[this.gameId]);
    this.changed();
  }

  // Take a player off the table. Nothing may be staked and their last round must already be saved.
  dropPlayer(p, why = '') {
    this.room.players = this.room.players.filter((x) => x !== p);
    if (!p.bot) { this.wallet.leave(p.id, this.code).catch(() => {}); }
    if (this.engine && this.engine.onPlayersChanged) this.engine.onPlayersChanged();
    this.assignOwner();
    this.changed();
    return why;
  }

  // ---- the clock ------------------------------------------------------------
  tick() {
    if (this.closed) return;
    if (this.engine && this.engine.tick()) this.dirty = true;
    this.settleDue();
    for (const p of this.humans()) if (p.resyncLater && !p.saving && !this.settling) { p.resyncLater = false; this.resync(p.id); }
    this.releaseSeats();
    if (this.dirty) { this.dirty = false; this.flush(); }
  }

  // Players who left (or vanished) are released once nothing is staked and their last round is saved.
  releaseSeats() {
    const t = this.now();
    for (const p of this.humans()) {
      const gone = p.leaving || (!p.connected && p.away && t - p.away > AWAY_MS);
      if (!gone || p.saving) continue;
      if (held(this.gameId, this.engine, p.id) !== 0) continue;
      if (p.chips !== p.base) continue; // a result is still waiting to be saved
      this.dropPlayer(p, 'left');
    }
    // keep the seat alive in the database while someone is here
    if (t - this.lastTouch > 30_000) {
      this.lastTouch = t;
      for (const p of this.humans()) if (p.connected) this.wallet.touch(p.id, this.code).catch(() => {});
    }
  }

  // ---- saving results to the wallet ------------------------------------------
  settleDue() {
    if (!this.engine) { if (this.retry.length) this.runSettle([]); return; }
    const items = [];
    for (const p of this.humans()) {
      const ref = roundOf(this.gameId, this.engine, p.id);
      if (!ref) continue;
      const key = `${this.gameId}:${ref}`;
      if (p.done.has(key)) continue;
      p.done.add(key);
      if (p.done.size > 50) p.done.delete(p.done.values().next().value);
      const delta = p.chips - p.base;
      if (delta === 0) continue;
      p.base += delta; // optimistic: the engine's number is now what the wallet will say
      p.saving = (p.saving || 0) + 1;
      items.push({ user: p.id, table: this.code, game: this.gameId, ref, delta });
    }
    if (items.length || this.retry.length) this.runSettle(items);
  }

  async runSettle(fresh) {
    if (this.settling) { this.retry.push(...fresh); return; }
    this.settling = true;
    const batch = [...this.retry, ...fresh];
    this.retry = [];
    try {
      let results;
      try { results = await this.wallet.settle(batch); }
      catch (e) { results = null; this.log('settle failed', e && e.code); }
      if (!results) { this.retry.push(...batch); return; } // network trouble: try again, same keys, nothing is ever paid twice
      for (let i = 0; i < batch.length; i++) {
        const it = batch[i];
        const r = (results && results[i]) || {};
        const p = this.player(it.user);
        if (p) p.saving = Math.max(0, (p.saving || 1) - 1);
        if (r.ok) continue;
        await this.settleFailed(p, it, r.error || 'error');
      }
    } finally { this.settling = false; this.changed(); }
  }

  // The database refused a result. Never leave a player with coins the wallet does not have.
  async settleFailed(p, it, error) {
    this.log('settle refused', it.user, error);
    if (!p) return;
    let bal = null;
    try { bal = await this.wallet.balance(p.id); } catch {}
    if (bal === null) { this.retry.push(it); p.saving = (p.saving || 0) + 1; return; }
    p.chips = bal; p.base = bal;
    this.notify(p.id, error === 'not_seated' ? 'Your seat expired, so your last round could not be saved. Rejoin the table.' : 'Your last round could not be saved, so your balance was restored from your wallet.', 'warn');
    if (error === 'not_seated') { p.leaving = true; p.connected = false; }
  }

  // ---- views ---------------------------------------------------------------
  roomView() {
    return {
      code: this.code,
      hostId: this.ownerId,
      status: 'open',
      server: true,
      walletMode: true,
      gameId: this.gameId,
      gameSeq: this.gameSeq,
      limit: this.capacity(),
      settings: this.room.settings,
      players: this.room.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, bot: p.bot, connected: p.connected,
        chips: p.chips, buyins: 1,
        net: p.chips + held(this.gameId, this.engine, p.id) - p.joinBalance,
      })),
      chat: this.room.chat.slice(-50),
    };
  }

  broadcast(msg) { for (const c of this.conns.values()) if (c.open) { try { c.send(msg); } catch {} } }

  flush() {
    const room = this.roomView();
    for (const [pid, conn] of this.conns) {
      if (!conn.open) continue;
      try { conn.send({ t: 'state', you: pid, room, game: this.engine ? this.engine.view(pid) : null }); } catch {}
    }
  }

  // Best-effort final save when the last person leaves.
  async shutdown() {
    this.closed = true;
    this.settleDue();
    let guard = 0;
    while ((this.settling || this.retry.length) && guard++ < 20) { await new Promise((r) => setTimeout(r, 50)); if (!this.settling && this.retry.length) await this.runSettle([]); }
    for (const p of this.humans()) { try { await this.wallet.leave(p.id, this.code); } catch {} }
  }
}
