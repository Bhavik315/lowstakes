// The game server's only door to the database. It uses the Supabase SECRET key, which must never be
// sent to a browser or committed: it lives in the server's environment only.
export class WalletError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export class SupabaseWallet {
  constructor({ url, secretKey, fetchFn }) {
    this.url = url.replace(/\/$/, '');
    this.key = secretKey;
    this.fetch = fetchFn || ((...a) => fetch(...a));
  }

  async rpc(fn, args) {
    let res;
    try {
      res = await this.fetch(`${this.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: this.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
    } catch { throw new WalletError('network'); }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const msg = data && data.message ? String(data.message) : `http_${res.status}`;
      throw new WalletError(/^[a-z_]+$/.test(msg) ? msg : (res.status >= 500 ? 'network' : 'error'), msg);
    }
    return data;
  }

  // Seat a player; resolves { username, balance }. Throws already_at_table / not_registered.
  join(userId, code, game) { return this.rpc('join_table', { p_user: userId, p_code: code, p_game: game || null }); }
  leave(userId, code) { return this.rpc('leave_table', { p_user: userId, p_code: code }).then(() => {}); }
  touch(userId, code) { return this.rpc('touch_table', { p_user: userId, p_code: code }).then(() => {}); }
  settle(items) { return this.rpc('settle_round', { p_items: items }); }
  async balance(userId) { return Number((await this.rpc('account_json', { p_user: userId })).balance); }
}

// Checks a browser's sign-in token with Supabase and returns the verified user, or null.
export async function verifyUser(token, { url, publishableKey, fetchFn }) {
  if (!token || typeof token !== 'string' || token.length > 4000) return null;
  const f = fetchFn || ((...a) => fetch(...a));
  try {
    const res = await f(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.id ? { id: u.id, email: u.email || '' } : null;
  } catch { return null; }
}
