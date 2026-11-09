// A stand-in Supabase for the WORKER side (token check + wallet functions), served over HTTP for browser tests.
// Debug endpoints under /__ let a test read the wallet and ledger.
import http from 'node:http';
import { FakeWallet } from './helpers.mjs';

export function startMock(port, users, tokens) {
  const wallet = new FakeWallet();
  for (const [id, name, bal] of users) wallet.add(id, name, bal);
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(obj)); };
      if (req.url.startsWith('/__/wallet/')) { const id = req.url.split('/').pop(); return send(200, { balance: wallet.bal(id), ledger: wallet.ledger.filter((l) => l.user === id), presence: wallet.presence.has(id) }); }
      if (req.url === '/auth/v1/user') {
        const id = tokens[(req.headers.authorization || '').replace('Bearer ', '')];
        return id ? send(200, { id, email: id + '@x.com' }) : send(401, { msg: 'bad jwt' });
      }
      const m = /^\/rest\/v1\/rpc\/(\w+)$/.exec(req.url);
      if (!m) return send(404, {});
      if (req.headers.apikey !== 'test-secret') return send(401, { message: 'permission denied' });
      const a = JSON.parse(body || '{}');
      try {
        if (m[1] === 'join_table') return send(200, await wallet.join(a.p_user, a.p_code, a.p_game));
        if (m[1] === 'leave_table') { await wallet.leave(a.p_user, a.p_code); return send(200, null); }
        if (m[1] === 'touch_table') { await wallet.touch(a.p_user, a.p_code); return send(200, null); }
        if (m[1] === 'settle_round') return send(200, await wallet.settle(a.p_items));
        if (m[1] === 'account_json') return send(200, { balance: await wallet.balance(a.p_user) });
      } catch (e) { return send(400, { message: e.code || 'error' }); }
      send(404, {});
    });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, wallet })));
}

if (process.argv[1] && process.argv[1].endsWith('mock-sb-http.mjs')) {
  const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
  await startMock(Number(process.env.SB_PORT || 54399), [[A, 'Alice_1', 20000], [B, 'Bob_22', 20000], [C, 'Carol_3', 20000]], { 'tok-alice': A, 'tok-bob': B, 'tok-carol': C });
  console.log('mock supabase up');
}
