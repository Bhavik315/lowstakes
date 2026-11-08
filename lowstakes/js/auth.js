// Accounts: Google sign-in through Supabase Auth (GoTrue), plus the wallet functions, over plain fetch (no SDK).
// There are no passwords and no email sign-up: Google has already verified the address.
// The browser only ever holds a session token. Username and balance are read from the database,
// and every change (registration bonus, username fee, later game payouts) happens in database
// functions that check who is asking. Nothing here is trusted by the backend.
import { CONFIG } from './config.js?v=40';

const STORE = 'ls.auth';
const FEE = 5000;

let session = null; // { access_token, refresh_token, expires_at (ms), user }
let account = null; // result of get_account(): { registered, username, balance, ... } or { registered:false, email_verified }
let refreshing = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => { try { fn(); } catch {} });
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } };
const save = () => { try { if (session) localStorage.setItem(STORE, JSON.stringify(session)); else localStorage.removeItem(STORE); } catch {} };

export class AuthError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

function toError(status, data) {
  const code = (data && (data.error_code || (typeof data.code === 'string' ? data.code : '') || data.error)) || '';
  // PostgREST puts our own error keys (username_taken, insufficient_balance...) in `message`.
  const msg = (data && (data.message || data.msg || data.error_description)) || '';
  const own = /^[a-z_]+$/.test(msg) ? msg : '';
  return new AuthError(status, own || code || `http_${status}`, msg);
}

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(CONFIG.supabaseUrl + path, {
      method,
      headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new AuthError(0, 'network', 'network'); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw toError(res.status, data);
  return data;
}

function setSession(tok, user) {
  session = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: Date.now() + (Number(tok.expires_in) || 3600) * 1000,
    user: user || tok.user || (session && session.user) || null,
  };
  save();
}

function clearSession(reason = '') {
  session = null; account = null; save();
  emit();
  if (reason) lastNotice = reason;
}
let lastNotice = '';

async function refresh() {
  if (!session) throw new AuthError(401, 'no_session');
  if (!refreshing) {
    const rt = session.refresh_token;
    refreshing = call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: rt } })
      .then((t) => { setSession(t, t.user); })
      .catch((e) => { if (e.status === 400 || e.status === 401 || e.status === 403) clearSession('expired'); throw e; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

// Calls the API as the signed-in player, refreshing the token when it is about to expire.
async function authed(path, opts = {}) {
  if (!session) throw new AuthError(401, 'not_authenticated');
  if (session.expires_at - Date.now() < 60000) await refresh();
  try { return await call(path, { ...opts, token: session.access_token }); }
  catch (e) {
    if (e.status === 401) { await refresh(); return call(path, { ...opts, token: session.access_token }); }
    throw e;
  }
}

const rpc = (fn, args = {}) => authed(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });

export const Auth = {
  FEE,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  session: () => session,
  signedIn: () => !!session,
  account: () => account,
  user: () => (session && session.user) || null,
  email: () => (session && session.user && session.user.email) || '',
  // A player is "ready" once they have a username (and so a wallet).
  ready: () => !!(account && account.registered),
  username: () => (account && account.registered ? account.username : ''),
  balance: () => (account && account.registered ? Number(account.balance) : 0),
  takeNotice() { const n = lastNotice; lastNotice = ''; return n; },

  // Reads tokens left in the URL by email links (verification, password reset) and tidies the address bar.
  // Returns { type, error } or null.
  consumeLink() {
    // Errors can come back in the query string (Google cancelled or failed) or in the fragment.
    const qs = new URLSearchParams(location.search);
    if (qs.get('error') && (qs.get('error_code') || qs.get('error_description'))) {
      const code = qs.get('error_code') || qs.get('error');
      ['error', 'error_code', 'error_description'].forEach((k) => qs.delete(k));
      const rest = qs.toString();
      history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
      return { error: code, type: '' };
    }
    const h = location.hash.replace(/^#/, '');
    if (!/(^|&)(access_token|error)=/.test(h)) return null;
    const q = new URLSearchParams(h);
    history.replaceState(null, '', location.pathname + location.search + '#/');
    if (q.get('error')) return { error: q.get('error_code') || q.get('error'), type: q.get('type') || '' };
    setSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_in: q.get('expires_in') });
    return { type: q.get('type') || 'oauth', error: '' };
  },

  async init() {
    session = load();
    if (!session) return;
    try {
      if (session.expires_at - Date.now() < 60000) await refresh();
      await this.refreshUser();
      await this.loadAccount();
    } catch (e) {
      // Offline or the server is down: keep the session for next time, just don't show account details.
      if (e.code === 'network') return;
    }
    emit();
  },

  // Sends the player to Google (via Supabase). They come back to this page with tokens in the address,
  // which consumeLink() picks up.
  // A valid access token for the game server (refreshed first if it is about to expire).
  async accessToken() {
    if (!session) throw new AuthError(401, 'not_authenticated');
    if (session.expires_at - Date.now() < 60000) await refresh();
    return session.access_token;
  },

  signInWithGoogle() {
    const back = encodeURIComponent(location.origin + location.pathname);
    location.href = `${CONFIG.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${back}`;
  },

  async refreshUser() {
    const user = await authed('/auth/v1/user');
    session.user = user; save();
    return user;
  },

  async loadAccount() {
    account = await rpc('get_account');
    emit();
    return account;
  },






  async signOut() {
    const tok = session && session.access_token;
    clearSession();
    if (tok) { try { await call('/auth/v1/logout', { method: 'POST', token: tok }); } catch {} }
  },

  async checkUsername(name) {
    return call('/rest/v1/rpc/username_available', { method: 'POST', body: { p_name: name } });
  },

  async completeRegistration(username) {
    const r = await rpc('complete_registration', { p_username: username });
    account = { ...r };
    emit();
    return r;
  },

  async changeUsername(newName, requestId) {
    const r = await rpc('change_username', { p_new: newName, p_request_id: requestId });
    account = { ...r };
    emit();
    return r;
  },

  // Free coin packs: four timers, decided by the database clock.
  async freePacks() {
    const packs = await rpc('get_free_packs');
    this.packs = { list: packs, at: Date.now() };
    emit();
    return packs;
  },

  async claimFreePack(id) {
    const r = await rpc('claim_free_pack', { p_pack: id });
    account = { ...r };
    delete account.packs;
    this.packs = { list: r.packs, at: Date.now() };
    emit();
    return r;
  },

  // How many packs could be claimed right now, from the last time we asked (null = not asked yet).
  packsReady() {
    if (!this.packs) return null;
    const waited = (Date.now() - this.packs.at) / 1000;
    return this.packs.list.filter((p) => p.ready || p.seconds_left - waited <= 0).length;
  },

  async transactions(limit = 30) {
    return authed(`/rest/v1/transactions?select=id,type,amount,balance_after,game,ref,created_at&order=created_at.desc&limit=${limit}`);
  },
};

// Plain-English messages for every error the account screens can show.
export function explain(e) {
  const c = (e && e.code) || '';
  const map = {
    network: 'Could not reach the server. Check your connection and try again.',
    invalid_credentials: 'That email and password do not match.',
    email_not_confirmed: 'Please verify your email first. Check your inbox for the link.',
    over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes and try again.',
    over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
    weak_password: 'That password is too weak. Use at least 8 characters with a mix of letters and numbers.',
    same_password: 'Choose a different password from your old one.',
    user_already_exists: 'An account with that email already exists. Try signing in.',
    email_exists: 'An account with that email already exists. Try signing in.',
    validation_failed: 'Please check the email address.',
    otp_expired: 'That link has expired. Ask for a new one.',
    access_denied: 'That link is no longer valid. Ask for a new one.',
    username_empty: 'Choose a username.',
    username_length: 'Usernames are 3 to 16 characters.',
    username_chars: 'Use letters, numbers and underscores only.',
    username_reserved: 'That username is reserved. Pick another.',
    username_taken: 'That username is taken. Try another.',
    same_username: 'That is already your username.',
    not_ready: 'That pack is not ready yet.',
    bad_pack: 'That pack does not exist.',
    leave_table_first: 'Leave your table first, then change your username. Your coins are in play while you are seated.',
    insufficient_balance: `You need ${FEE.toLocaleString('en-US')} coins to change your username.`,
    email_not_verified: 'Verify your email first, then choose your username.',
    email_in_use: 'That email already has a Low Stakes account. Sign in with it instead.',
    not_registered: 'Finish choosing your username first.',
    not_authenticated: 'Please sign in again.',
    no_session: 'Please sign in again.',
    bad_request: 'Something went wrong. Please try again.',
  };
  if (e && e.status === 429) return map.over_request_rate_limit;
  return map[c] || 'Something went wrong. Please try again.';
}

export const usernameProblem = (n) => {
  if (!n) return 'Choose a username.';
  if (n.length < 3 || n.length > 16) return 'Usernames are 3 to 16 characters.';
  if (!/^[A-Za-z0-9_]+$/.test(n)) return 'Use letters, numbers and underscores only.';
  return '';
};
