// Account screens: sign in, create account, verify email, forgot/reset password, choose username,
// and the profile (username, wallet balance, username change, recent transactions).
// All state lives in the database; this file only presents it and relays the player's choices.
import { Auth, explain, usernameProblem } from '../auth.js?v=33';
import { esc, fmt, signed } from './parts.js?v=33';

let root = null; // the open modal, if any
let required = false; // true when the site demands an account and the modal can't be dismissed
let toastFn = () => {};
let checkSeq = 0;
let ctx = {}; // small per-screen memory (email typed, pending rename request id...)

export function setToast(fn) { toastFn = fn; }

// ---------------------------------------------------------------- frame
function close() {
  if (required && !Auth.ready()) return;
  if (root) { root.remove(); root = null; }
  document.removeEventListener('keydown', onKey, true);
}
function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }

function mount(html, { title }) {
  if (!root) {
    root = document.createElement('div');
    root.className = 'ls-modal ls-acct';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
    document.body.appendChild(root);
    document.addEventListener('keydown', onKey, true);
  }
  root.setAttribute('aria-label', title);
  const closable = !(required && !Auth.ready());
  root.innerHTML = `<div class="ls-modal-card acct-card">${closable ? '<button class="acct-x" data-x aria-label="Close">×</button>' : ''}${html}</div>`;
  const first = root.querySelector('[autofocus], input:not([type=hidden]), button.btn-primary');
  if (first) first.focus();
  return root.querySelector('.acct-card');
}

const notice = (t, kind = 'err') => (t ? `<p class="anote ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${esc(t)}</p>` : '<p class="anote" aria-live="polite"></p>');

function setMsg(card, text, kind = 'err') {
  const el = card.querySelector('.anote');
  if (!el) return;
  el.textContent = text;
  el.className = `anote ${text ? kind : ''}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
}

function busy(card, on, label) {
  card.querySelectorAll('button[type=submit], .btn-primary').forEach((b) => {
    if (on) { b.dataset.t = b.textContent; b.textContent = label || 'One moment…'; b.disabled = true; }
    else { if (b.dataset.t) b.textContent = b.dataset.t; b.disabled = false; }
  });
}

function wire(card, handlers = {}) {
  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { close(); return; }
    const go = e.target.closest('[data-go]');
    if (go && handlers.go) handlers.go(go.dataset.go, go);
  });
  card.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); if (handlers.submit) handlers.submit(f, e); }));
}

// Live "is this username free?" check under an input.
function watchUsername(card, input, hint, onResult = () => {}) {
  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const name = input.value.trim();
    const bad = name ? usernameProblem(name) : '';
    hint.className = 'ahint';
    if (!name) { hint.textContent = ''; onResult(null); return; }
    if (bad) { hint.textContent = bad; hint.classList.add('bad'); onResult(false); return; }
    hint.textContent = 'Checking…';
    onResult(null);
    const seq = ++checkSeq;
    timer = setTimeout(async () => {
      try {
        const r = await Auth.checkUsername(name);
        if (seq !== checkSeq) return;
        if (r.available) { hint.textContent = `${name} is available.`; hint.className = 'ahint ok'; onResult(true); }
        else { hint.textContent = explain({ code: r.valid ? 'username_taken' : r.reason }); hint.className = 'ahint bad'; onResult(false); }
      } catch (e) { if (seq === checkSeq) { hint.textContent = ''; onResult(null); } }
    }, 350);
  });
}

// ---------------------------------------------------------------- screens
const GOOGLE_G = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

export function openAuth(mode = 'signin', opts = {}) {
  if (opts.required !== undefined) required = !!opts.required;
  showSignIn(opts.message, opts.kind);
}

// Google is the only way in. There are no passwords and no email sign-up.
function showSignIn(message = '', kind = 'err') {
  const card = mount(`
    <h2>Sign in to Low Stakes</h2>
    <p class="asub">Use your Google account. New here? Signing in creates your account: you'll pick a username (free), then get a one-time <b>20,000 coin</b> welcome bonus.</p>
    ${notice(message, kind)}
    <button class="btn btn-google" type="button" data-go="google">${GOOGLE_G}<span>Continue with Google</span></button>
    <p class="asub small">We only receive your email address from Google, and never your password. Play money only.</p>`, { title: 'Sign in' });
  wire(card, {
    go: (g, btn) => {
      if (g !== 'google') return;
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Opening Google…';
      Auth.signInWithGoogle();
    },
  });
}

function showChooseUsername(message = '', suggestion = '') {
  let ok = null;
  const card = mount(`
    <h2>Choose your username</h2>
    <p class="asub">You're signed in with Google${Auth.email() ? ` as ${esc(Auth.email())}` : ''}. Pick the username everyone will see. It's free this time, and every change after costs ${fmt(Auth.FEE)} coins. You'll get <b>20,000 coins</b> right after.</p>
    <form novalidate>
      <label class="afield"><span>Username</span><input id="a-user" maxlength="16" autocapitalize="off" spellcheck="false" value="${esc(suggestion)}" placeholder="3 to 16 letters, numbers, _" required></label>
      <p class="ahint" id="a-hint" aria-live="polite"></p>
      ${notice(message)}
      <button class="btn btn-primary" type="submit">Claim username and coins</button>
    </form>`, { title: 'Choose a username' });
  const input = card.querySelector('#a-user');
  watchUsername(card, input, card.querySelector('#a-hint'), (v) => { ok = v; });
  if (suggestion) input.dispatchEvent(new Event('input'));
  wire(card, {
    submit: async () => {
      const name = input.value.trim();
      const bad = usernameProblem(name);
      if (bad) return setMsg(card, bad);
      if (ok === false) return setMsg(card, 'Pick a username that is available.');
      busy(card, true, 'Claiming…');
      try { const r = await Auth.completeRegistration(name); welcome(r); }
      catch (e) { busy(card, false); setMsg(card, explain(e)); }
    },
  });
}

function welcome(r) {
  const card = mount(`
    <h2>${r.already ? 'Welcome back' : `Welcome, ${esc(r.username)}!`}</h2>
    <p class="asub">${r.already ? 'Your account is ready.' : `You've received your one-time welcome bonus of <b>${fmt(r.bonus || 20000)} coins</b>.`}</p>
    <p class="abig">${fmt(r.balance)} <small>coins</small></p>
    <div class="aacts"><button class="btn btn-primary" data-x>Let's play</button></div>`, { title: 'Welcome' });
  wire(card);
}

// After coming back from Google: sign the player in, or finish registering if they are new.
async function afterAuth() {
  if (!Auth.account()) await Auth.loadAccount();
  const acc = Auth.account();
  if (acc && acc.registered) { required = false; close(); toastFn(`Signed in as ${acc.username}.`); return; }
  if (acc && acc.email_verified === false) {
    showSignIn('Google did not give us a verified email address, so we cannot create an account. Try another Google account.');
    await Auth.signOut();
    return;
  }
  showChooseUsername('');
}

// Called once at start-up with whatever Google's redirect carried.
export async function handleLink(link) {
  if (!link) return;
  if (link.error) {
    openAuth('signin', { message: link.error === 'access_denied' ? 'Google sign-in was cancelled. Try again when you are ready.' : 'Google sign-in did not work. Please try again.' });
    return;
  }
  try {
    await Auth.refreshUser();
    await Auth.loadAccount();
  } catch (e) { openAuth('signin', { message: explain(e) }); return; }
  await afterAuth();
}

// ---------------------------------------------------------------- profile
const TYPE_LABEL = {
  welcome_bonus: 'Welcome bonus', wager: 'Bet', payout: 'Winnings', refund: 'Refund',
  username_change_fee: 'Username change', adjustment: 'Adjustment',
};
const GAME_LABEL = { blackjack: 'Blackjack', holdem: "Hold'em", roulette: 'Roulette', crash: 'Crash' };

export function openProfile() {
  if (!Auth.signedIn()) return openAuth('signin');
  if (!Auth.ready()) return afterAuth('');
  renderProfile();
}

function renderProfile(extra = {}) {
  const acc = Auth.account();
  const fee = Auth.FEE;
  const card = mount(`
    <p class="aeyebrow">Your account</p>
    <h2 class="aname">${esc(acc.username)}</h2>
    <p class="abig">${fmt(acc.balance)} <small>coins</small></p>
    <p class="asub small">This is your permanent wallet. Table chips in the games are separate until the games move to the server.</p>
    ${extra.message ? notice(extra.message, extra.kind || 'ok') : notice('')}
    <section class="asec">
      <h3>Change username</h3>
      <div id="rn"></div>
    </section>
    <section class="asec">
      <h3>Recent transactions</h3>
      <ul class="txs" id="txs"><li class="tx-empty">Loading…</li></ul>
    </section>
    <div class="aacts"><button class="btn btn-quiet" data-go="out">Sign out</button><button class="btn btn-primary" data-x>Done</button></div>`, { title: 'Your account' });

  const rn = card.querySelector('#rn');
  const poor = acc.balance < fee;
  const showEdit = () => {
    ctx.reqId = null;
    rn.innerHTML = `<form novalidate>
      <label class="afield"><span>New username</span><input id="a-new" maxlength="16" autocapitalize="off" spellcheck="false" placeholder="${esc(acc.username)}"${poor ? ' disabled' : ''}></label>
      <p class="ahint" id="a-hint" aria-live="polite"></p>
      <p class="asub small">Each change costs <b>${fmt(fee)} coins</b>, including the first one. ${poor ? `<b class="bad-t">You need ${fmt(fee)} coins to change it.</b>` : 'You will be asked to confirm before anything is charged.'}</p>
      <button class="btn btn-quiet" type="submit"${poor ? ' disabled' : ''}>Change username…</button>
    </form>`;
    let ok = null;
    const input = rn.querySelector('#a-new');
    watchUsername(card, input, rn.querySelector('#a-hint'), (v) => { ok = v; });
    rn.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      const bad = usernameProblem(name);
      if (bad) return setMsg(card, bad);
      if (name.toLowerCase() === acc.username.toLowerCase()) return setMsg(card, explain({ code: 'same_username' }));
      if (ok === false) return setMsg(card, 'Pick a username that is available.');
      showConfirm(name);
    });
  };
  const showConfirm = (name) => {
    // One request id per confirmation, so a retry of the same request can never charge twice.
    if (!ctx.reqId || ctx.reqName !== name) { ctx.reqId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`); ctx.reqName = name; }
    rn.innerHTML = `<div class="confirm">
      <p>Change your username from <b>${esc(acc.username)}</b> to <b>${esc(name)}</b>?</p>
      <p class="asub small">This costs <b>${fmt(fee)} coins</b>. Your balance goes from ${fmt(acc.balance)} to ${fmt(acc.balance - fee)}.</p>
      <div class="aacts"><button class="btn btn-quiet" data-go="cancel-rn">Cancel</button><button class="btn btn-primary" data-go="do-rn">Pay ${fmt(fee)} and change</button></div>
    </div>`;
  };
  showEdit();

  let busyRn = false;
  wire(card, {
    go: async (g, btn) => {
      if (g === 'out') { await Auth.signOut(); required = false; close(); toastFn('Signed out.'); return; }
      if (g === 'cancel-rn') { showEdit(); return; }
      if (g === 'do-rn') {
        if (busyRn) return;
        busyRn = true; btn.disabled = true; btn.textContent = 'Changing…';
        try {
          const r = await Auth.changeUsername(ctx.reqName, ctx.reqId);
          ctx.reqId = null;
          renderProfile({ message: r.already ? 'That change was already done. You were not charged again.' : `Username changed to ${r.username}. ${fmt(fee)} coins were deducted.`, kind: 'ok' });
        } catch (e) {
          busyRn = false;
          if (e.code !== 'network') ctx.reqId = null; // a definite answer: the next try is a new request
          renderProfile({ message: explain(e), kind: 'err' });
        }
      }
    },
  });

  // transactions load separately so the profile appears instantly
  Auth.transactions(30).then((rows) => {
    const ul = card.querySelector('#txs');
    if (!ul || !root) return;
    ul.innerHTML = rows.length ? rows.map((t) => `<li class="tx"><span class="tx-main"><b>${esc(TYPE_LABEL[t.type] || t.type)}</b>${t.game ? `<em>${esc(GAME_LABEL[t.game] || t.game)}</em>` : ''}<small>${esc(new Date(t.created_at).toLocaleString())}</small></span><span class="tx-amt ${t.amount > 0 ? 'up' : 'down'}">${signed(t.amount)}<small>${fmt(t.balance_after)}</small></span></li>`).join('')
      : '<li class="tx-empty">No transactions yet.</li>';
  }).catch((e) => {
    const ul = card.querySelector('#txs');
    if (ul) ul.innerHTML = `<li class="tx-empty">${esc(explain(e))}</li>`;
  });
}

// ---------------------------------------------------------------- nav slot
export function slotHtml() {
  if (Auth.ready()) return `<button class="acct-chip" data-acct="profile" aria-label="Your account"><span class="an">${esc(Auth.username())}</span><span class="ab">${fmt(Auth.balance())}</span></button>`;
  if (Auth.signedIn()) return '<button class="acct-chip" data-acct="profile">Finish sign-up</button>';
  return '<button class="btn btn-dark btn-sm" data-acct="signin">Sign in with Google</button>';
}

export function bindSlot() {
  document.querySelectorAll('.acct-slot').forEach((s) => { s.innerHTML = slotHtml(); });
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-acct]');
  if (!b) return;
  const a = b.dataset.acct;
  if (a === 'profile') openProfile();
  else openAuth(a);
});
