// One Durable Object per table code. It holds the TableCore while anyone is connected.
import { TableCore } from './core.js';
import { SupabaseWallet, verifyUser } from './wallet.js';

const MAX_MESSAGE = 4096;
const MSGS_PER_SECOND = 30;
const IDLE_CLOSE_MS = 120_000; // nobody connected for this long: save everything and let the table go

export class Table {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.core = null;
    this.timer = null;
    this.pinger = null;
    this.emptySince = 0;
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
          if (!u) { conn.send({ t: 'reject', why: 'auth' }); setTimeout(() => conn.close(), 200); return; }
          // A table exists only while someone is at it. Opening an unknown code is an error unless the player is creating it.
          if ((!this.core || this.core.closed) && msg.create !== true) { conn.send({ t: 'reject', why: 'notfound' }); setTimeout(() => conn.close(), 300); return; }
          const core = this.getCore(code);
          const r = await core.connect(conn, u);
          if (!r.ok) { conn.send({ t: 'reject', why: r.why, game: r.game, limit: r.limit }); setTimeout(() => conn.close(), 300); return; }
          user = u;
          clearTimeout(helloTimer);
          this.emptySince = 0;
          this.start();
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
    if (core) core.shutdown().catch(() => {});
  }
}
