// Account screens: sign in, create account, verify email, forgot/reset password, choose username,
// and the profile (username, wallet balance, username change, recent transactions).
// All state lives in the database; this file only presents it and relays the player's choices.
import { Auth, explain, usernameProblem } from '../auth.js?v=31';
import { esc, fmt, signed } from './parts.js?v=31';

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

const pwField = (id, label, auto) => `
  <label class="afield"><span>${label}</span>
    <span class="pw"><input id="${id}" type="password" autocomplete="${auto}" minlength="8" required>
    <button type="button" class="pw-toggle" data-pw="${id}" aria-label="Show password" aria-pressed="false">Show</button></span>
  </label>`;

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
    const pw = e.target.closest('[data-pw]');
    if (pw) {
      const input = card.querySelector(`#${pw.dataset.pw}`);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      pw.textContent = show ? 'Hide' : 'Show';
      pw.setAttribute('aria-pressed', String(show));
      pw.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      return;
    }
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
export function openAuth(mode = 'signin', opts = {}) {
  if (opts.required !== undefined) required = !!opts.required;
  if (mode === 'signup') return showSignUp(opts.message);
  return showSignIn(opts.message, opts.kind);
}

function tabs(active) {
  return `<div class="atabs" role="tablist"><button role="tab" aria-selected="${active === 'signin'}" data-go="signin">Sign in</button><button role="tab" aria-selected="${active === 'signup'}" data-go="signup">Create account</button></div>`;
}

function showSignIn(message = '', kind = 'err') {
  const card = mount(`
    ${tabs('signin')}
    <h2>Welcome back</h2>
    <form novalidate>
      <label class="afield"><span>Email</span><input id="a-email" type="email" autocomplete="email" inputmode="email" value="${esc(ctx.email || '')}" required></label>
      ${pwField('a-pass', 'Password', 'current-password')}
      ${notice(message, kind)}
      <button class="btn btn-primary" type="submit">Sign in</button>
      <p class="alinks"><button type="button" class="linkish" data-go="forgot">Forgot your password?</button></p>
    </form>`, { title: 'Sign in' });
  wire(card, {
    go: (g) => (g === 'signup' ? showSignUp() : g === 'forgot' ? showForgot() : 0),
    submit: async () => {
      const email = card.querySelector('#a-email').value.trim();
      const pass = card.querySelector('#a-pass').value;
      ctx.email = email;
      if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg(card, 'Enter a valid email address.');
      if (!pass) return setMsg(card, 'Enter your password.');
      busy(card, true, 'Signing in…');
      try { await Auth.signIn(email, pass); await afterAuth('Signed in.'); }
      catch (e) {
        busy(card, false);
        if (e.code === 'email_not_confirmed') { showCheckEmail(email, 'Please verify your email first.'); return; }
        setMsg(card, explain(e));
      }
    },
  });
}

function showSignUp(message = '') {
  let nameOk = null;
  const card = mount(`
    ${tabs('signup')}
    <h2>Create your account</h2>
    <p class="asub">Pick your username now. It's free, and it's the name everyone sees. You get <b>20,000 coins</b> once, after you verify your email.</p>
    <form novalidate>
      <label class="afield"><span>Email</span><input id="a-email" type="email" autocomplete="email" inputmode="email" value="${esc(ctx.email || '')}" required></label>
      <label class="afield"><span>Username</span><input id="a-user" maxlength="16" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="3 to 16 letters, numbers, _" required></label>
      <p class="ahint" id="a-hint" aria-live="polite"></p>
      ${pwField('a-pass', 'Password', 'new-password')}
      <p class="asub small">At least 8 characters.</p>
      ${notice(message)}
      <button class="btn btn-primary" type="submit">Create account</button>
    </form>`, { title: 'Create account' });
  watchUsername(card, card.querySelector('#a-user'), card.querySelector('#a-hint'), (ok) => { nameOk = ok; });
  wire(card, {
    go: (g) => (g === 'signin' ? showSignIn() : 0),
    submit: async () => {
      const email = card.querySelector('#a-email').value.trim();
      const username = card.querySelector('#a-user').value.trim();
      const pass = card.querySelector('#a-pass').value;
      ctx.email = email;
      if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg(card, 'Enter a valid email address.');
      const bad = usernameProblem(username);
      if (bad) return setMsg(card, bad);
      if (nameOk === false) return setMsg(card, 'Pick a username that is available.');
      if (pass.length < 8) return setMsg(card, 'Use at least 8 characters for your password.');
      busy(card, true, 'Creating…');
      try {
        // Check once more right before registering, so a taken name is caught now rather than after the email.
        const r = await Auth.checkUsername(username);
        if (!r.available) { busy(card, false); return setMsg(card, explain({ code: r.valid ? 'username_taken' : r.reason })); }
        const out = await Auth.signUp(email, pass, username);
        if (!out.needsVerification) await afterAuth('Account created.');
        else showCheckEmail(email, '', out.existing);
      } catch (e) { busy(card, false); setMsg(card, explain(e)); }
    },
  });
}

function showCheckEmail(email, message = '', existing = false) {
  const card = mount(`
    <h2>Check your email</h2>
    <p class="asub">We sent a link to <b>${esc(email)}</b>. Open it to verify your address${existing ? '' : ', and your 20,000 coins will be waiting'}.</p>
    ${existing ? '<p class="asub small">If that address already has a Low Stakes account, sign in with it instead.</p>' : ''}
    ${notice(message)}
    <div class="aacts"><button class="btn btn-quiet" data-go="resend">Send it again</button><button class="btn btn-primary" data-go="signin">Back to sign in</button></div>`, { title: 'Check your email' });
  wire(card, {
    go: async (g, btn) => {
      if (g === 'signin') return showSignIn();
      if (g === 'resend') {
        btn.disabled = true;
        try { await Auth.resend(email); setMsg(card, 'Sent. It can take a minute, so check spam too.', 'ok'); }
        catch (e) { setMsg(card, explain(e)); }
        setTimeout(() => { btn.disabled = false; }, 30000);
      }
    },
  });
}

function showForgot(message = '', kind = 'err') {
  const card = mount(`
    <h2>Reset your password</h2>
    <p class="asub">Enter your email and we'll send a link to choose a new password.</p>
    <form novalidate>
      <label class="afield"><span>Email</span><input id="a-email" type="email" autocomplete="email" inputmode="email" value="${esc(ctx.email || '')}" required></label>
      ${notice(message, kind)}
      <button class="btn btn-primary" type="submit">Send reset link</button>
      <p class="alinks"><button type="button" class="linkish" data-go="signin">Back to sign in</button></p>
    </form>`, { title: 'Reset password' });
  wire(card, {
    go: (g) => (g === 'signin' ? showSignIn() : 0),
    submit: async () => {
      const email = card.querySelector('#a-email').value.trim();
      ctx.email = email;
      if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg(card, 'Enter a valid email address.');
      busy(card, true, 'Sending…');
      try { await Auth.forgot(email); setMsg(card, 'If that address has an account, a reset link is on its way.', 'ok'); }
      catch (e) { setMsg(card, explain(e)); }
      busy(card, false);
    },
  });
}

function showReset() {
  const card = mount(`
    <h2>Choose a new password</h2>
    <form novalidate>
      ${pwField('a-pass', 'New password', 'new-password')}
      <p class="asub small">At least 8 characters.</p>
      ${notice('')}
      <button class="btn btn-primary" type="submit">Save password</button>
    </form>`, { title: 'New password' });
  wire(card, {
    submit: async () => {
      const pass = card.querySelector('#a-pass').value;
      if (pass.length < 8) return setMsg(card, 'Use at least 8 characters.');
      busy(card, true, 'Saving…');
      try { await Auth.setPassword(pass); await Auth.refreshUser(); await Auth.loadAccount(); await afterAuth('Password updated.'); }
      catch (e) { busy(card, false); setMsg(card, explain(e)); }
    },
  });
}

function showChooseUsername(message = '', suggestion = '') {
  let ok = null;
  const card = mount(`
    <h2>Choose your username</h2>
    <p class="asub">Your email is verified. Pick the username everyone will see. It's free this time, and every change after costs ${fmt(Auth.FEE)} coins. You'll get <b>20,000 coins</b> right after.</p>
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

// After any successful sign-in or email link: finish registration if needed, otherwise just say hello.
async function afterAuth(msg) {
  if (!Auth.account()) await Auth.loadAccount();
  const acc = Auth.account();
  if (acc && acc.registered) { required = false; close(); toastFn(`Signed in as ${acc.username}.`); return; }
  if (acc && acc.email_verified === false) { showCheckEmail(Auth.email(), 'Verify your email to continue.'); return; }
  // Verified but no username yet. Try the one chosen at sign-up; fall back to asking.
  const chosen = (Auth.user() && Auth.user().user_metadata && Auth.user().user_metadata.username) || '';
  if (chosen) {
    try { const r = await Auth.completeRegistration(chosen); required = false; welcome(r); return; }
    catch (e) { showChooseUsername(explain(e), ''); return; }
  }
  showChooseUsername('');
}

// Called once at start-up with whatever the email link carried.
export async function handleLink(link) {
  if (!link) return;
  if (link.error) {
    ctx.email = ctx.email || '';
    openAuth('signin', { message: `${explain({ code: link.error })} Sign in, or use "Forgot your password?" for a fresh link.`, kind: 'err' });
    return;
  }
  try {
    await Auth.refreshUser();
    await Auth.loadAccount();
  } catch (e) { openAuth('signin', { message: explain(e) }); return; }
  if (link.type === 'recovery') { showReset(); return; }
  await afterAuth('Email verified.');
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
  return '<button class="btn btn-quiet btn-sm" data-acct="signin">Sign in</button><button class="btn btn-dark btn-sm" data-acct="signup">Create account</button>';
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
