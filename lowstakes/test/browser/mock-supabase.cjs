// A stand-in for Supabase Auth + the wallet functions, for browser tests only.
// It mirrors the real behaviour: obfuscated duplicate signups, email confirmation, token refresh,
// and the same rules and error keys as supabase/migrations/0001_accounts_wallet.sql.
const crypto = require('crypto');
const RESERVED = ['admin', 'administrator', 'system', 'dealer', 'house', 'lowstakes', 'moderator', 'support'];
module.exports = function makeMock() {
  const m = { users: new Map(), byId: new Map(), access: new Map(), refresh: new Map(), profiles: new Map(), tx: [], log: [], rateLimit: false };
  const id = () => crypto.randomUUID();
  const tokensFor = (u) => { const a = 'at-' + id(), r = 'rt-' + id(); m.access.set(a, u.id); m.refresh.set(r, u.id); return { access_token: a, refresh_token: r, expires_in: 3600, token_type: 'bearer', user: pub(u) }; };
  const pub = (u) => ({ id: u.id, email: u.email, email_confirmed_at: u.confirmed ? new Date().toISOString() : null, user_metadata: { username: u.meta }, identities: [{ id: 'x' }] });
  const problem = (n) => !n || !n.trim() ? 'username_empty' : (n.length < 3 || n.length > 16) ? 'username_length' : !/^[A-Za-z0-9_]+$/.test(n) ? 'username_chars' : RESERVED.includes(n.toLowerCase()) ? 'username_reserved' : null;
  const taken = (n) => [...m.profiles.values()].some((p) => p.username.toLowerCase() === n.toLowerCase());
  const bal = (uid) => m.profiles.get(uid).balance;
  const apply = (uid, type, amount, ref, key) => { const p = m.profiles.get(uid); if (p.balance + amount < 0) throw new Error('check'); p.balance += amount; m.tx.push({ id: id(), user_id: uid, type, amount, balance_after: p.balance, game: null, ref, key, created_at: new Date(Date.now() + m.tx.length).toISOString() }); };
  const acct = (uid) => { const p = m.profiles.get(uid); return { registered: true, id: uid, username: p.username, balance: p.balance, username_changes: p.changes, change_fee: 5000 }; };
  const J = (status, body) => ({ status, body });
  const gt = (code, msg, status = 400) => J(status, { code: status, error_code: code, msg });
  const pg = (message, status = 400) => J(status, { code: 'P0001', message, details: null, hint: null });
  m.confirm = (email, type = 'signup') => { const u = m.users.get(email.toLowerCase()); u.confirmed = true; const t = tokensFor(u); return `#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer&type=${type}`; };
  m.recovery = (email) => { const u = m.users.get(email.toLowerCase()); const t = tokensFor(u); return `#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer&type=recovery`; };
  m.expireAccess = () => m.access.clear();
  m.killRefresh = () => m.refresh.clear();
  m.txOf = (name) => { const p = [...m.profiles.entries()].find(([, v]) => v.username === name); return p ? m.tx.filter((t) => t.user_id === p[0]) : []; };
  m.profileOf = (name) => [...m.profiles.values()].find((v) => v.username === name);
  m.setBalance = (name, n) => { const p = m.profileOf(name); p.balance = n; };

  function handle(method, url, headers, bodyText) {
    const u = new URL(url); const path = u.pathname; let body = {}; try { body = bodyText ? JSON.parse(bodyText) : {}; } catch {}
    const auth = (headers.authorization || '').replace(/^Bearer /, ''); const uid = m.access.get(auth);
    m.log.push({ method, path, hasBearer: !!auth, body });
    if (m.rateLimit && path.startsWith('/auth/v1')) return gt('over_request_rate_limit', 'rate', 429);
    const needUser = () => (uid ? null : J(401, { code: 'PGRST301', message: 'JWT expired' }));
    if (path === '/auth/v1/signup') {
      const email = (body.email || '').toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return gt('validation_failed', 'bad email', 400);
      if ((body.password || '').length < 6) return gt('weak_password', 'Password should be at least 6 characters.', 422);
      const ex = m.users.get(email);
      if (ex && ex.confirmed) return J(200, { id: id(), email, identities: [], user_metadata: {} }); // obfuscated, no email sent
      const user = ex || { id: id(), email, confirmed: false };
      user.password = body.password; user.meta = (body.data || {}).username; m.users.set(email, user); m.byId.set(user.id, user);
      return J(200, { id: user.id, email, identities: [{ id: 'x' }], user_metadata: { username: user.meta } });
    }
    if (path === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      const user = m.users.get((body.email || '').toLowerCase());
      if (!user || user.password !== body.password) return gt('invalid_credentials', 'Invalid login credentials');
      if (!user.confirmed) return gt('email_not_confirmed', 'Email not confirmed');
      return J(200, tokensFor(user));
    }
    if (path === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
      const rid = m.refresh.get(body.refresh_token); if (!rid) return gt('refresh_token_not_found', 'Invalid Refresh Token');
      m.refresh.delete(body.refresh_token); return J(200, tokensFor(m.byId.get(rid)));
    }
    if (path === '/auth/v1/user') {
      if (!uid) return gt('bad_jwt', 'invalid JWT', 401);
      const user = m.byId.get(uid);
      if (method === 'PUT') { if (body.password === user.password) return gt('same_password', 'New password should be different', 422); if (body.password.length < 6) return gt('weak_password', 'weak', 422); user.password = body.password; }
      return J(200, pub(user));
    }
    if (path === '/auth/v1/logout') { m.access.delete(auth); return J(204, null); }
    if (path === '/auth/v1/recover' || path === '/auth/v1/resend') return J(200, {});
    if (path === '/rest/v1/rpc/username_available') {
      const pr = problem(body.p_name); if (pr) return J(200, { valid: false, available: false, reason: pr });
      return J(200, { valid: true, available: !taken(body.p_name) });
    }
    if (path === '/rest/v1/rpc/get_account') {
      const e = needUser(); if (e) return e;
      if (m.profiles.has(uid)) return J(200, acct(uid));
      return J(200, { registered: false, email_verified: m.byId.get(uid).confirmed });
    }
    if (path === '/rest/v1/rpc/complete_registration') {
      const e = needUser(); if (e) return e; const user = m.byId.get(uid);
      if (!user.confirmed) return pg('email_not_verified');
      if (m.profiles.has(uid)) return J(200, { ...acct(uid), already: true });
      const pr = problem(body.p_username); if (pr) return pg(pr);
      if ([...m.profiles.values()].some((p) => p.email === user.email)) return pg('email_in_use');
      if (taken(body.p_username)) return pg('username_taken');
      m.profiles.set(uid, { username: body.p_username, email: user.email, balance: 0, changes: 0 });
      apply(uid, 'welcome_bonus', 20000, 'welcome', 'welcome');
      return J(200, { ...acct(uid), already: false, bonus: 20000 });
    }
    if (path === '/rest/v1/rpc/change_username') {
      const e = needUser(); if (e) return e;
      if (!m.profiles.has(uid)) return pg('not_registered');
      const p = m.profiles.get(uid); const key = 'username:' + body.p_request_id;
      if (!body.p_request_id || body.p_request_id.length < 8) return pg('bad_request');
      if (m.tx.some((t) => t.user_id === uid && t.key === key)) return J(200, { ...acct(uid), already: true });
      const pr = problem(body.p_new); if (pr) return pg(pr);
      if (body.p_new.toLowerCase() === p.username.toLowerCase()) return pg('same_username');
      if (p.balance < 5000) return pg('insufficient_balance');
      if (taken(body.p_new)) return pg('username_taken');
      const old = p.username; p.username = body.p_new; p.changes++; apply(uid, 'username_change_fee', -5000, `username:${old}>${body.p_new}`, key);
      return J(200, { ...acct(uid), already: false, fee: 5000 });
    }
    if (path === '/rest/v1/transactions') {
      const e = needUser(); if (e) return e;
      return J(200, m.tx.filter((t) => t.user_id === uid).slice().reverse().map(({ key, user_id, ...r }) => r));
    }
    return J(404, { message: 'no such route ' + path });
  }
  m.handle = handle;
  return m;
};
