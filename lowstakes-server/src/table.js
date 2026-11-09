// One Durable Object per table code. It holds the table's core (TableCore for the wallet tables, LandlordsCore for a private
// Landlords match) while anyone is connected. A Landlords match is also written to storage and the object wakes itself with an
// alarm, so a restart or an empty room cannot lose a match or freeze its timers.
import { TableCore } from './core.js';
import { LandlordsCore } from './landlords-core.js';
import { SupabaseWallet, verifyUser } from './wallet.js';

const MAX_MESSAGE = 4096;
const MSGS_PER_SECOND = 30;
const IDLE_CLOSE_MS = 120_000; // nobody connected for this long: save everything and let the table go
const ALARM_MS = 20_000;
const SAVE_MS = 400;

export class Table {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.core = null;
    this.timer = null;
    this.pinger = null;
    this.emptySince = 0;
    this.loaded = false;
    this.saveTimer = null;
  }

  wallet() {
    return new SupabaseWallet({ url: this.env.SUPABASE_URL, secretKey: this.env.SUPABASE_SECRET_KEY });
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a websocket', { status: 426 });
    const code = request.headers.get('x-table-code') || '';
    if (!/^[A-Z0-9]{5}$/.test(code)) return new Response('Bad table', { status: 400 });
    if (!this.env.SUPABASE_SECRET_KEY) return new Response('Server is not configured', { status: 500 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.attach(server, code);
    return new Response(null, { status: 101, webSocket: client });
  }

  getCore(code) {
    if (!this.core || this.core.closed) this.core = new TableCore({ code, wallet: this.wallet(), log: (...a) => console.log('[table]', code, ...a) });
    return this.core;
  }

  // ---- Landlords: persistence and wake-ups ---------------------------------------------------------------------------
  llDeps(code) { return { code, wallet: this.wallet(), log: (...a) => console.log('[landlords]', code, ...a), onSave: () => this.scheduleSave() }; }

  // After a restart: pick the match up again from storage.
  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const snap = await this.state.storage.get('ll');
      if (snap && snap.v === 1 && /^[A-Z0-9]{5}$/.test(snap.code) && ['lobby', 'play', 'done', 'cancelled'].includes(snap.phase)) {
        this.core = LandlordsCore.restore(snap, this.llDeps(snap.code));
        this.start();
      }
    } catch (e) { console.log('[landlords] restore failed', e && e.message); }
  }

  scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.save().catch(() => {}); }, SAVE_MS);
  }
  async save() {
    const core = this.core;
    if (!core || core.kind !== 'landlords') return;
    await this.state.storage.put('ll', core.snapshot());
    if (core.needsWake()) await this.state.storage.setAlarm(Date.now() + ALARM_MS);
  }

  // The object woke itself up: run the timers (turn limits, reconnect deadlines, retrying the payout) even with nobody connected.
  async alarm() {
    await this.load();
    const core = this.core;
    if (!core || core.kind !== 'landlords') return;
    core.tick();
    await this.save();
    if (!core.needsWake()) await this.state.storage.delete('ll');
  }

  attach(ws, code) {
    const conn = {
      open: true,
      send: (m) => { try { ws.send(JSON.stringify(m)); } catch {} },
      close: () => { conn.open = false; try { ws.close(1000, 'bye'); } catch {} },
    };
    let user = null;
    let queue = Promise.resolve(); // one message at a time per socket, in order
    let windowStart = Date.now();
    let count = 0;
    const helloTimer = setTimeout(() => { if (!user) conn.close(); }, 10_000);
    const reject = (why, extra = {}) => { conn.send({ t: 'reject', why, ...extra }); setTimeout(() => conn.close(), 300); };

    ws.addEventListener('message', (ev) => {
      const now = Date.now();
      if (now - windowStart > 1000) { windowStart = now; count = 0; }
      if (++count > MSGS_PER_SECOND) return; // flooding: ignore the excess
      queue = queue.then(async () => {
        if (typeof ev.data !== 'string' || ev.data.length > MAX_MESSAGE) return;
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!user) {
          if (!msg || msg.t !== 'hello') return;
          const u = await verifyUser(msg.token, { url: this.env.SUPABASE_URL, publishableKey: this.env.SUPABASE_PUBLISHABLE_KEY });
          if (!u) { reject('auth'); return; }
          await this.load();
          const ok = msg.game === 'landlords' ? await this.helloLandlords(msg, u, conn, code, reject) : await this.helloWallet(msg, u, conn, code, reject);
          if (!ok) return;
          user = u;
          clearTimeout(helloTimer);
          this.emptySince = 0;
          this.start();
          if (this.core && this.core.kind === 'landlords') this.scheduleSave();
          return;
        }
        if (this.core) this.core.receive(user.id, msg);
      }).catch((e) => console.log('[table] message error', e && e.message));
    });

    const gone = () => {
      clearTimeout(helloTimer);
      conn.open = false;
      if (user && this.core) this.core.disconnect(user.id, conn);
    };
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
  }

  async helloWallet(msg, u, conn, code, reject) {
    if (this.core && this.core.kind === 'landlords' && !this.core.closed) { reject('landlords'); return false; }
    // A table exists only while someone is at it. Opening an unknown code is an error unless the player is creating it.
    if ((!this.core || this.core.closed) && msg.create !== true) { reject('notfound'); return false; }
    const core = this.getCore(code);
    const r = await core.connect(conn, u);
    if (!r.ok) { reject(r.why, { game: r.game, limit: r.limit }); return false; }
    return true;
  }

  async helloLandlords(msg, u, conn, code, reject) {
    const have = this.core && !this.core.closed;
    if (have && this.core.kind !== 'landlords') { reject('notfound'); return false; }
    if (msg.peek === true) { // look, do not join: nothing is charged and nobody is seated
      if (!have || this.core.phase === 'new') { reject('notfound'); return false; }
      conn.send({ t: 'll', ...(await this.core.peek(u)) });
      setTimeout(() => conn.close(), 300);
      return false;
    }
    if (!have) {
      if (msg.create !== true) { reject('notfound'); return false; }
      const core = new LandlordsCore(this.llDeps(code));
      this.core = core;
      const r = await core.create(conn, u, { fee: msg.fee, settings: msg.settings });
      if (!r.ok) { if (this.core === core) this.core = null; reject(r.why); return false; }
      return true;
    }
    const r = await this.core.connect(conn, u, msg);
    if (!r.ok) { reject(r.why, { limit: r.limit }); return false; }
    return true;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const core = this.core;
      if (!core) return;
      core.tick();
      if (core.conns.size === 0) {
        if (!this.emptySince) this.emptySince = Date.now();
        else if (Date.now() - this.emptySince > IDLE_CLOSE_MS) this.stop();
      } else this.emptySince = 0;
    }, 100);
    this.pinger = setInterval(() => { if (this.core) this.core.broadcast({ t: 'ping' }); }, 4000);
  }

  stop() {
    clearInterval(this.timer); clearInterval(this.pinger);
    this.timer = null; this.pinger = null;
    const core = this.core;
    this.core = null;
    if (!core) return;
    if (core.kind === 'landlords') {
      // A running match is not abandoned just because the room is empty: it stays in storage and the alarm keeps its clocks going.
      const keep = core.needsWake();
      const done = async () => { try { if (keep) await this.state.storage.put('ll', core.snapshot()); else await this.state.storage.delete('ll'); if (keep) await this.state.storage.setAlarm(Date.now() + ALARM_MS); } catch {} };
      this.loaded = false;
      done();
      return;
    }
    core.shutdown().catch(() => {});
  }
}
