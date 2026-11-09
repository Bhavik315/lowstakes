// Rooms are peer-to-peer. The person who starts a table is the host: their
// browser runs the game and sends every guest a personal view of the table
// (so nobody's browser ever receives another player's hidden cards).
import { Holdem } from '../games/holdem.js?v=54';
import { Blackjack } from '../games/blackjack.js?v=54';
import { Roulette } from '../games/roulette.js?v=54';
import { Crash } from '../games/crash.js?v=54';

const GAMES = { holdem: Holdem, blackjack: Blackjack, roulette: Roulette, crash: Crash };
const PREFIX = 'lowstakes-v1-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// How many people each game seats, bots included. The room holds as many as the biggest game; once a
// game is running, its own limit applies. Nobody is ever seated without a visible place at the table.
export const GAME_LIMITS = { holdem: 9, blackjack: 7, roulette: 12, crash: 12 };
export const MAX_PLAYERS = Math.max(...Object.values(GAME_LIMITS));
export const limitFor = (gameId) => GAME_LIMITS[gameId] || MAX_PLAYERS;

export const COLORS = ['#E0472F', '#2A55C9', '#E8A825', '#1E8C7E', '#8A3B78', '#EE7B30', '#E86A92', '#4BA3D9', '#7FA83A', '#5B4B8A', '#C2563A', '#2F7D57'];
const BOTS = [
  ['Marguerite', 0.2], ['Big Sal', 0.85], ['Dottie', 0.4], ['Vinnie', 0.7], ['Professor', 0.3],
  ['June', 0.55], ['Otis', 0.65], ['Lola', 0.9], ['Hank', 0.15], ['Rosa', 0.5], ['Teddy', 0.75],
];

export const DEFAULT_SETTINGS = {
  start: 1000,
  holdem: { sb: 10, bb: 20, timer: 30 },
  blackjack: { min: 10, timer: 20 },
  roulette: { min: 5, betTime: 20 },
  crash: { min: 5, betTime: 15 },
};

export function newCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function cleanCode(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

function peerOptions() {
  const q = new URLSearchParams(location.search);
  const sig = q.get('signal');
  // Don't set `config` to undefined: PeerJS spreads our options over its defaults,
  // so that would wipe out its STUN/TURN servers and only same-network players could join.
  // STUN finds each browser's public address; TURN relays traffic when two
  // networks can't connect directly (strict routers, school Wi-Fi, VPNs).
  const opts = {
    debug: 0,
    config: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
        { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
        {
          urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443'],
          username: 'openrelayproject', credential: 'openrelayproject',
        },
      ],
      sdpSemantics: 'unified-plan',
    },
  };
  if (sig) {
    const [host, port] = sig.split(':');
    Object.assign(opts, { host, port: Number(port || 9000), path: '/', secure: q.get('secure') === '1' });
  }
  return opts;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function clientId() {
  try {
    let id = localStorage.getItem('ls.cid');
    if (!id) { id = uid(); localStorage.setItem('ls.cid', id); }
    return id;
  } catch { return uid(); }
}

// Tiny event emitter shared by Host and Guest.
class Emitter {
  constructor() { this.handlers = {}; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }
  fire(type, data) { for (const fn of this.handlers[type] || []) fn(data); }
}

// --------------------------------------------------------------------------
export class Host extends Emitter {
  constructor({ name, color, code, snapshot }) {
    super();
    this.isHost = true;
    this.id = clientId();
    this.code = code || newCode();
    this.conns = new Map(); // pid -> DataConnection
    this.status = 'starting';
    this.dirty = true;
    this.engine = null;
    this.room = {
      players: [],
      gameId: null,
      settings: structuredClone(DEFAULT_SETTINGS),
      chat: [],
      rebuy: (pid) => this.rebuy(pid),
    };
    if (snapshot) this.restore(snapshot);
    const me = this.room.players.find((p) => p.id === this.id);
    if (me) Object.assign(me, { name, color, connected: true });
    else this.addPlayer({ id: this.id, name, color });
    if (snapshot && snapshot.gameId) {
      const r = this.setGame(snapshot.gameId, true);
      if (!r.ok) this.system(r.message);
    }
    this.timer = setInterval(() => this.loop(), 100);
    this.pinger = setInterval(() => this.broadcastRaw({ t: 'ping' }), 4000);
    this.listen();
  }

  // ---- networking ----
  listen(attempt = 0) {
    if (typeof Peer === 'undefined') { this.setStatus('offline'); return; }
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on('open', () => { this.setStatus('open'); });
    setTimeout(() => { if (!this.closed && this.peer === peer && !peer.open && this.status !== 'taken') this.setStatus('offline'); }, 12000);
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('disconnected', () => {
      if (this.closed) return;
      this.setStatus('reconnecting');
      setTimeout(() => { if (!this.closed && peer.disconnected) peer.reconnect(); }, 1500);
    });
    peer.on('error', (err) => {
      if (this.closed) return;
      if (err.type === 'unavailable-id') {
        // The code is taken. After a refresh the old registration can linger for a few seconds.
        if (attempt < 6) { peer.destroy(); setTimeout(() => this.listen(attempt + 1), 1500); }
        else this.setStatus('taken');
      } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) {
        this.setStatus('offline');
      }
    });
  }

  setStatus(s) { this.status = s; this.dirty = true; this.fire('status', s); }

  accept(conn) {
    let pid = null;
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        pid = String(msg.cid || '').slice(0, 40);
        if (!pid || pid === this.id) { conn.send({ t: 'reject', why: 'duplicate' }); return; }
        const res = this.join(pid, msg, conn);
        if (res !== true) { conn.send({ t: 'reject', why: res, game: this.room.gameId, limit: this.capacity() }); setTimeout(() => conn.close(), 300); pid = null; }
        return;
      }
      if (pid) this.receive(pid, msg);
    });
    const gone = () => {
      if (pid && this.conns.get(pid) === conn) {
        this.conns.delete(pid);
        const p = this.player(pid);
        if (p) { p.connected = false; this.system(`${p.name} lost connection.`); }
        this.changed(true);
      }
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  join(pid, msg, conn) {
    let p = this.player(pid);
    if (!p) {
      if (this.room.players.length >= this.capacity()) return 'full';
      p = this.addPlayer({ id: pid, name: msg.name, color: msg.color });
      this.system(`${p.name} sat down.`);
    } else {
      const old = this.conns.get(pid);
      if (old && old !== conn) try { old.close(); } catch {}
      p.connected = true;
      p.name = cleanName(msg.name) || p.name;
      p.color = cleanColor(msg.color, p.color);
      this.system(`${p.name} is back.`);
      if (this.engine && this.engine.onPlayersChanged) this.engine.onPlayersChanged();
    }
    this.conns.set(pid, conn);
    this.changed(true);
    return true;
  }

  receive(pid, msg) {
    const p = this.player(pid);
    if (!p) return;
    switch (msg.t) {
      case 'act': if (this.engine && this.engine.handle(pid, msg.a || {})) this.changed(); break;
      case 'chat': this.chat(pid, msg.text); break;
      case 'react': this.react(pid, msg.r); break;
      case 'rebuy': this.rebuy(pid, true); break;
      case 'bye':
        p.connected = false;
        this.conns.delete(pid);
        this.system(`${p.name} left the table.`);
        this.changed(true);
        break;
      default:
    }
  }

  // ---- local API (same shape as Guest) ----
  act(a) { if (this.engine && this.engine.handle(this.id, a)) this.changed(); }
  say(text) { this.chat(this.id, text); }
  emote(r) { this.react(this.id, r); }
  requestRebuy() { this.rebuy(this.id, true); }

  // ---- host controls ----
  // Seats left for the game that is running (or for the whole room in the lobby).
  capacity() { return limitFor(this.room.gameId); }

  fullMessage(gameId) {
    const n = limitFor(gameId);
    return gameId ? `${GAME_NAMES[gameId]} seats ${n} and all ${n} seats are taken.` : `The table is full (${n} players).`;
  }

  setGame(gameId, quiet = false) {
    const G = GAMES[gameId];
    if (!G) return { ok: false, message: 'Unknown game.' };
    const cap = limitFor(gameId);
    const have = this.room.players.length;
    if (have > cap) {
      const over = have - cap;
      return { ok: false, message: `${GAME_NAMES[gameId]} seats ${cap}, but ${have} are at the table. Remove ${over} ${over === 1 ? 'player or bot' : 'players or bots'} to deal it.` };
    }
    if (this.engine) this.endGame(true);
    this.room.gameId = gameId;
    this.gameSeq = (this.gameSeq || 0) + 1;
    this.engine = new G(this.room, this.room.settings[gameId]);
    if (!quiet) this.system(`Now playing ${GAME_NAMES[gameId]}.`);
    this.changed(true);
    return { ok: true };
  }

  endGame(quiet = false) {
    if (this.engine) this.refundHeld();
    this.engine = null;
    this.room.gameId = null;
    if (!quiet) this.system('Back to the lobby.');
    this.changed(true);
  }

  // Return any chips that are sitting in an unfinished hand.
  refundHeld() {
    for (const p of this.room.players) p.chips += held(this.engine, p.id);
    this.engine.clearJobs();
  }

  // `forGame` is the game being picked in the lobby, so the lobby enforces that game's limit too.
  addBot(forGame) {
    const gameId = this.room.gameId || forGame || null;
    if (this.room.players.length >= limitFor(gameId)) return { ok: false, message: this.fullMessage(gameId) };
    const taken = new Set(this.room.players.map((p) => p.name));
    const pick = BOTS.find(([n]) => !taken.has(n)) || [`Bot ${this.room.players.length}`, 0.5];
    const used = new Set(this.room.players.map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) || COLORS[this.room.players.length % COLORS.length];
    this.addPlayer({ id: 'bot-' + uid(), name: pick[0], color, bot: true, style: pick[1] });
    this.system(`${pick[0]} (bot) sat down.`);
    this.changed(true);
    return { ok: true };
  }

  removePlayer(pid) {
    if (pid === this.id) return;
    const p = this.player(pid);
    if (!p) return;
    if (this.engine && held(this.engine, pid) > 0) {
      // Can't pull someone out mid-hand. Mark them gone; they'll fold out.
      p.connected = false;
      p.leaving = true;
    } else {
      this.room.players = this.room.players.filter((x) => x !== p);
    }
    const conn = this.conns.get(pid);
    if (conn) { try { conn.send({ t: 'kicked' }); } catch {} setTimeout(() => conn.close(), 200); this.conns.delete(pid); }
    this.system(`${p.name} was removed from the table.`);
    this.changed(true);
  }

  updateSettings(patch) {
    const s = this.room.settings;
    for (const k in patch) {
      if (typeof patch[k] === 'object') Object.assign(s[k], patch[k]);
      else s[k] = patch[k];
    }
    if (this.engine && this.engine.s) Object.assign(this.engine.s, s[this.room.gameId]);
    this.changed(true);
  }

  setPaused(on) {
    if (!this.engine || !('paused' in this.engine)) return;
    this.engine.paused = on;
    this.system(on ? 'The host paused the game after this hand.' : 'Game resumed.');
    if (!on && this.engine.phase === 'waiting') this.engine.maybeStart();
    this.changed();
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    clearInterval(this.pinger);
    this.broadcastRaw({ t: 'closed' });
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch {} }, 250);
    try { localStorage.removeItem('ls.host'); } catch {}
  }

  // ---- room bookkeeping ----
  player(pid) { return this.room.players.find((p) => p.id === pid); }

  addPlayer({ id, name, color, bot = false, style }) {
    const p = {
      id, name: cleanName(name) || 'Player', color: cleanColor(color, COLORS[this.room.players.length % COLORS.length]),
      bot, style, connected: true, chips: this.room.settings.start, buyins: 1,
    };
    this.room.players.push(p);
    if (this.engine && this.engine.onPlayersChanged) this.engine.onPlayersChanged();
    return p;
  }

  rebuy(pid, manual = false) {
    const p = this.player(pid);
    if (!p) return;
    const start = this.room.settings.start;
    if (manual && p.chips >= start / 2) return; // only when you're short
    p.chips += start;
    p.buyins++;
    if (manual) this.system(`${p.name} bought back in.`);
    if (this.engine && this.engine.onPlayersChanged) this.engine.onPlayersChanged();
    this.changed(true);
  }

  chat(pid, text) {
    const p = this.player(pid);
    text = String(text || '').trim().slice(0, 240);
    if (!p || !text) return;
    this.pushChat({ pid, name: p.name, color: p.color, text });
  }

  system(text) { this.pushChat({ pid: null, text }); }

  pushChat(m) {
    m.id = (this.chatId = (this.chatId || 0) + 1);
    m.at = Date.now();
    this.room.chat.push(m);
    if (this.room.chat.length > 80) this.room.chat.shift();
    this.changed(true);
  }

  react(pid, r) {
    if (!REACTIONS.includes(r)) return;
    const msg = { t: 'react', pid, r, id: uid() };
    this.broadcastRaw(msg);
    this.fire('react', msg);
  }

  changed(snapshot = false) {
    this.dirty = true;
    if (snapshot) this.snapNeeded = true;
  }

  loop() {
    if (this.engine) {
      if (this.engine.tick()) { this.dirty = true; }
      // players removed mid-hand leave once their chips are out of play
      const leavers = this.room.players.filter((p) => p.leaving && held(this.engine, p.id) === 0);
      if (leavers.length) {
        this.room.players = this.room.players.filter((p) => !leavers.includes(p));
        if (this.engine.onPlayersChanged) this.engine.onPlayersChanged();
        this.dirty = true;
      }
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.flush();
    const t = Date.now();
    if (this.snapNeeded || !this.lastSnap || t - this.lastSnap > 3000) this.snapshot();
  }

  roomView() {
    const start = this.room.settings.start;
    return {
      code: this.code,
      hostId: this.id,
      status: this.status,
      gameId: this.room.gameId,
      gameSeq: this.gameSeq || 0,
      limit: this.capacity(),
      settings: this.room.settings,
      players: this.room.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, bot: p.bot, connected: p.connected,
        chips: p.chips, buyins: p.buyins,
        net: p.chips + (this.engine ? held(this.engine, p.id) : 0) - p.buyins * start,
      })),
      chat: this.room.chat.slice(-50),
    };
  }

  flush() {
    const room = this.roomView();
    for (const [pid, conn] of this.conns) {
      if (!conn.open) continue;
      try { conn.send({ t: 'state', you: pid, room, game: this.engine ? this.engine.view(pid) : null }); } catch {}
    }
    this.fire('state', { you: this.id, room, game: this.engine ? this.engine.view(this.id) : null });
  }

  broadcastRaw(msg) {
    for (const conn of this.conns.values()) if (conn.open) try { conn.send(msg); } catch {}
  }

  snapshot() {
    this.snapNeeded = false;
    this.lastSnap = Date.now();
    try {
      const players = this.room.players.map((p) => ({
        ...p, chips: p.chips + (this.engine ? held(this.engine, p.id) : 0), connected: false,
      }));
      localStorage.setItem('ls.host', JSON.stringify({
        code: this.code, at: Date.now(), players, settings: this.room.settings, gameId: this.room.gameId,
        chat: this.room.chat.slice(-30),
      }));
    } catch {}
  }

  restore(snap) {
    this.room.players = snap.players.map((p) => ({ ...p, connected: !!p.bot }));
    this.room.settings = { ...structuredClone(DEFAULT_SETTINGS), ...snap.settings };
    this.room.chat = snap.chat || [];
    this.chatId = this.room.chat.reduce((m, c) => Math.max(m, c.id), 0);
  }
}

// Chips a player has committed to an unfinished round.
export function held(engine, pid) {
  if (!engine) return 0;
  if (engine instanceof Holdem) {
    if (!['betting', 'dealing'].includes(engine.phase)) return 0;
    const s = engine.seats.find((x) => x.pid === pid);
    return s && s.inHand ? s.totalIn : 0;
  }
  if (engine instanceof Blackjack) {
    const s = engine.seats.find((x) => x.pid === pid);
    if (!s) return 0;
    const inHands = engine.phase === 'settle' ? 0 : s.hands.reduce((a, h) => a + h.bet, 0);
    return s.bet + inHands;
  }
  if (engine instanceof Roulette) {
    if (engine.phase === 'result') return 0;
    return engine.total(pid);
  }
  if (engine instanceof Crash) {
    const b = engine.bet(pid);
    if (!b || engine.phase === 'crashed') return 0;
    return b.cashed !== null ? 0 : b.amount;
  }
  return 0;
}

// --------------------------------------------------------------------------
export class Guest extends Emitter {
  constructor({ name, color, code }) {
    super();
    this.isHost = false;
    this.id = clientId();
    this.code = code;
    this.name = name;
    this.color = color;
    this.status = 'connecting';
    this.stage = 'server';
    this.tries = 0;
    this.connect();
    // If the first join is taking a while, say what we're stuck on well before we give up.
    this.slowTimer = setTimeout(() => { if (!this.everOpen && !this.closed) this.fire('stage', { stage: this.stage, slow: true }); }, 6000);
    // Absolute backstop: whatever state the connection logic is in, never let the
    // first join sit on "Finding the table" forever. This doesn't depend on any
    // particular event firing, so it catches cases the per-step timeouts miss.
    this.hardTimer = setTimeout(() => {
      if (this.everOpen || this.closed) return;
      this.closed = true;
      try { this.peer && this.peer.destroy(); } catch {}
      this.setStatus(this.stage === 'server' ? 'noserver' : 'unreachable');
    }, 15000);
    this.watchdog = setInterval(() => {
      if (this.status === 'open' && Date.now() - this.lastMsg > 12000) this.lost();
    }, 2000);
  }

  connect() {
    if (typeof Peer === 'undefined') { this.setStatus('offline'); return; }
    if (!this.peer || this.peer.destroyed) {
      this.peer = new Peer(undefined, peerOptions());
      const peer = this.peer;
      setTimeout(() => { if (!this.closed && this.peer === peer && !peer.open) { peer.destroy(); this.retry(); } }, 6000);
      this.peer.on('open', () => { this.stage = 'host'; this.fire('stage', { stage: 'host' }); this.dial(); });
      this.peer.on('error', (err) => {
        if (this.closed) return;
        if (err.type === 'peer-unavailable') {
          if (this.everOpen) this.retry();
          else this.setStatus('notfound');
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          this.retry();
        } else if (err.type === 'browser-incompatible') this.setStatus('offline');
      });
      this.peer.on('disconnected', () => { if (!this.closed) setTimeout(() => { if (this.peer && this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect(); }, 1000); });
    } else if (this.peer.open) this.dial();
  }

  dial() {
    if (this.closed) return;
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    const timeout = setTimeout(() => { if (!conn.open) { try { conn.close(); } catch {} this.retry(); } }, 7000);
    conn.on('open', () => {
      clearTimeout(timeout);
      this.lastMsg = Date.now();
      conn.send({ t: 'hello', cid: this.id, name: this.name, color: this.color });
    });
    conn.on('data', (msg) => {
      this.lastMsg = Date.now();
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'state') {
        if (this.status !== 'open') { this.everOpen = true; this.tries = 0; clearTimeout(this.slowTimer); clearTimeout(this.hardTimer); this.setStatus('open'); }
        this.fire('state', msg);
      } else if (msg.t === 'react') this.fire('react', msg);
      else if (msg.t === 'reject') { this.closed = true; this.fullInfo = { game: msg.game, limit: msg.limit }; this.setStatus(msg.why === 'full' ? 'full' : 'rejected'); }
      else if (msg.t === 'closed') { this.closed = true; this.setStatus('closed'); }
      else if (msg.t === 'kicked') { this.closed = true; this.setStatus('kicked'); }
    });
    conn.on('close', () => { if (this.conn === conn) this.lost(); });
  }

  lost() {
    if (this.closed) return;
    this.setStatus('reconnecting');
    this.retry();
  }

  retry() {
    if (this.closed || this.retrying) return;
    this.tries++;
    // Give up on the first join quickly (~20s total) rather than leaving someone staring
    // at "Finding the table" for over a minute before they learn anything's wrong.
    if (!this.everOpen && this.tries > 2) { this.closed = true; this.setStatus(this.stage === 'server' ? 'noserver' : 'unreachable'); return; }
    if (this.tries > 12) { this.setStatus(this.everOpen ? 'closed' : 'notfound'); return; }
    this.retrying = true;
    if (this.status !== 'connecting') this.setStatus('reconnecting');
    setTimeout(() => { this.retrying = false; this.connect(); }, Math.min(700 * this.tries, 1500));
  }

  setStatus(s) { this.status = s; this.fire('status', s); }

  send(msg) { if (this.conn && this.conn.open) try { this.conn.send(msg); } catch {} }
  act(a) { this.send({ t: 'act', a }); }
  say(text) { this.send({ t: 'chat', text }); }
  emote(r) { this.send({ t: 'react', r }); }
  requestRebuy() { this.send({ t: 'rebuy' }); }

  close() {
    this.closed = true;
    clearInterval(this.watchdog);
    this.send({ t: 'bye' });
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch {} }, 250);
  }
}

export const REACTIONS = ['nice', 'lol', 'ouch', 'gg', 'bluff', 'wow'];
export const GAME_NAMES = { holdem: 'Poker', blackjack: 'Blackjack', roulette: 'Roulette', crash: 'Crash' };

// A colour from a guest is only ever used if it is a plain #rrggbb (it ends up inside a style attribute everyone sees).
const cleanColor = (c, fallback) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);

function cleanName(n) {
  return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 16);
}
