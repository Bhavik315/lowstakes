// Worker entry point: sends each WebSocket to the Durable Object for its table code.
export { Table } from './table.js';
import { keepAlive } from './keepalive.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json(200, { ok: true, service: 'lowstakes-server', configured: !!env.SUPABASE_SECRET_KEY });
    const m = /^\/ws\/([A-Z0-9]{5})$/.exec(url.pathname);
    if (!m) return json(404, { error: 'not found' });
    if (request.headers.get('Upgrade') !== 'websocket') return json(426, { error: 'expected a websocket' });

    // Only the real site may open tables from a browser. (The sign-in token is the actual gate; this stops other
    // websites from making a visitor's browser connect on their behalf.)
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    if (!origin || !allowed.includes(origin)) return json(403, { error: 'origin not allowed' });

    const stub = env.TABLE.get(env.TABLE.idFromName(m[1]));
    const headers = new Headers(request.headers);
    headers.set('x-table-code', m[1]);
    return stub.fetch(new Request(request, { headers }));
  },

  // Runs once a day (see [triggers] in wrangler.toml).
  async scheduled(event, env, ctx) {
    ctx.waitUntil(keepAlive(env).then((r) => console.log('[keepalive]', JSON.stringify(r))));
  },
};
