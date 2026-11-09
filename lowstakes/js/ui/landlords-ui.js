// Landlords screens: create a table, join one (the fee is shown first), the waiting room, the board, trading, auctions, results.
// Everything here only DRAWS the server's state and sends requests. It is built for a phone first (one column, bottom sheets,
// big touch targets) and widens into a board with a side panel on a laptop.
import morphdom from '../../vendor/morphdom-esm.js?v=63';
import { esc, fmt } from './parts.js?v=63';
import { sound } from './sound.js?v=63';
import { Auth } from '../auth.js?v=63';
import { newCode } from '../net/room.js?v=63';
import { LandlordsClient, peekLandlords } from '../net/landlords-client.js?v=63';
import {
  BOARD, GROUPS, OWNABLE, MIN_SEATS, MAX_SEATS, ENTRY_FEES, OPTIONS, DEFAULT_SETTINGS, cleanSettings, groupOf,
  houseCost, mortgageValue, unmortgageCost,
} from '../games/landlords-data.js?v=63';

const app = () => document.getElementById('app');
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const COLORS = ['#E0472F', '#2A55C9', '#E8A825', '#1E8C7E', '#8A3B78', '#EE7B30'];
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---- state --------------------------------------------------------------------------------------------------------
const S = {
  screen: null, // create | checking | join | lobby | game | message
  client: null, view: null, recvAt: 0, code: '', cfg: null, info: null, msg: null,
  ui: { sheet: null, zoom: 1, seat: -1, trade: null, confirm: null, bid: '', dismissedResult: false, cardShown: 0 },
  seenEv: 0, shown: {}, timers: [], tick: 0, toastT: 0, floats: [],
};
export const active = () => !!S.screen;

function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; clearInterval(S.tick); S.tick = 0; }
function shell(cls, html) {
  document.body.className = `on-ll ${cls || ''}`;
  document.title = 'Landlords · Low Stakes';
  app().innerHTML = html;
}
export function close() {
  clearTimers();
  if (S.client) { S.client.close(); S.client = null; }
  S.screen = null; S.view = null; S.info = null;
  S.ui = { sheet: null, zoom: 1, seat: -1, trade: null, confirm: null, bid: '', dismissedResult: false, cardShown: 0 };
  S.seenEv = 0; S.shown = {};
}
const toHome = () => { location.hash = '#/'; };

// ---- screens: message / checking --------------------------------------------------------------------------------------
function showMessage(title, body, actions = [['Back to home', 'home']]) {
  clearTimers();
  S.screen = 'message';
  shell('', `<div class="llp"><main class="llp-body llp-center"><section class="llp-card llp-msg"><h1>${esc(title)}</h1><p>${esc(body)}</p>
    <div class="llp-acts">${actions.map(([l, a], i) => `<button class="btn ${i ? 'btn-quiet' : 'btn-primary'}" data-act="${a}">${esc(l)}</button>`).join('')}</div></section></main></div>`);
}
function showChecking(text = 'Finding the table…') {
  S.screen = 'checking';
  shell('', `<div class="llp"><main class="llp-body llp-center"><section class="llp-card llp-msg"><div class="llp-spin" aria-hidden="true"></div><h1>${esc(text)}</h1></section></main></div>`);
}

// ---- rules text (shared by the create screen, the join screen and the lobby) -----------------------------------------------
export const RULE_ROWS = [
  ['doubleRent', 'Double rent on full-set properties', 'When someone owns every property of a colour, streets with no houses charge double their base rent.'],
  ['vacationCash', 'Vacation cash', 'Money paid in taxes and fines to the bank is collected by whoever lands on Vacation.'],
  ['auction', 'Auction', 'A property nobody buys goes to auction and is sold to the highest bidder.'],
  ['noJailRent', 'Don’t collect rent while in prison', 'Players in Lockup collect no rent from their properties.'],
  ['mortgage', 'Mortgage', 'Properties can be mortgaged for half their price. Mortgaged properties collect no rent, and lifting a mortgage costs the loan plus 10%.'],
  ['evenBuild', 'Even building', 'Houses and hotels must be built and sold evenly across a complete colour set.'],
  ['randomOrder', 'Randomize player order', 'The order of play is drawn at random when the game starts.'],
];
const OPT_ROWS = [
  ['startCash', 'Starting cash', (v) => money(v), 'In-game cash each player starts with. It is separate from your coins.'],
  ['passGo', 'Passing Start bonus', (v) => (v ? money(v) : 'None'), 'Collected every time a player passes or lands on Start.'],
  ['incomeTax', 'Income tax', (v) => (v === 'flat' ? 'Flat $200' : '10% of everything you own'), 'What the Income Tax square costs.'],
  ['supply', 'House and hotel supply', (v) => (v === 'standard' ? '32 houses, 12 hotels' : 'Unlimited'), 'A limited bank can run out of buildings.'],
  ['jailFine', 'Lockup fine', (v) => money(v), 'Pay this to leave Lockup before rolling.'],
  ['jailTurns', 'Turns in Lockup', (v) => `${v} ${v === 1 ? 'turn' : 'turns'}`, 'Failed rolls for doubles before the fine is forced. Other ways out: roll doubles, or use a Get out of Lockup free card.'],
];
export const ruleSummary = (s) => {
  const on = RULE_ROWS.filter(([k]) => s[k]).map(([, t]) => t.replace('Don’t collect rent while in prison', 'No rent from Lockup'));
  const off = RULE_ROWS.filter(([k]) => !s[k]).map(([, t]) => t);
  return { on, off, line: `${money(s.startCash)} start · ${s.passGo ? `${money(s.passGo)} Start bonus` : 'no Start bonus'} · ${s.incomeTax === 'flat' ? 'flat tax' : '10% tax'}` };
};

// ---- create screen ---------------------------------------------------------------------------------------------------------
export async function openCreate() {
  close();
  S.screen = 'create';
  S.cfg = S.cfg || { fee: 1000, settings: { ...DEFAULT_SETTINGS } };
  S.balance = Auth.balance();
  renderCreate(true);
  Auth.loadAccount().then(() => { if (S.screen === 'create') { S.balance = Auth.balance(); renderCreate(); } }).catch(() => {});
}
function chips(name, values, cur, label) {
  return `<div class="llp-chips" role="radiogroup" aria-label="${esc(name)}">${values.map((v) => `<button type="button" class="llp-chip${v === cur ? ' on' : ''}" role="radio" aria-checked="${v === cur}" data-opt="${esc(name)}" data-v="${esc(String(v))}">${esc(label(v))}</button>`).join('')}</div>`;
}
function createHtml() {
  const { fee, settings: s } = S.cfg;
  const bal = S.balance;
  const poor = fee > bal;
  const rows = RULE_ROWS.map(([k, t, d]) => `<div class="llp-row"><div><b>${esc(t)}</b><small>${esc(d)}</small></div>
    <button type="button" class="llp-sw" role="switch" aria-checked="${!!s[k]}" aria-label="${esc(t)}" data-sw="${k}"><i></i></button></div>`).join('');
  const opts = OPT_ROWS.map(([k, t, f, d]) => `<div class="llp-opt"><div><b>${esc(t)}</b><small>${esc(d)}</small></div>${chips(k, OPTIONS[k], s[k], f)}</div>`).join('');
  return `<div class="llp">
    <header class="llp-top"><a class="llp-back" href="#/" data-act="home" aria-label="Back to home">‹ Back</a><h1>New Landlords table</h1></header>
    <main class="llp-body">
      <section class="llp-card"><h2>Entry fee</h2>
        <p class="llp-sub">Every player pays this to sit down, and the winner takes the whole pot. In-game cash is a separate currency and never becomes coins.</p>
        ${chips('fee', ENTRY_FEES, fee, (v) => (v ? fmt(v) : 'Free'))}
        <p class="llp-pot">${fee ? `Prize pool: <b>${fmt(fee * MIN_SEATS)}–${fmt(fee * MAX_SEATS)} coins</b> (${MIN_SEATS}–${MAX_SEATS} players)` : 'Free table: no coins change hands.'}<br>Your balance: <b class="${poor ? 'bad' : ''}">${fmt(bal)} coins</b>${poor ? ' · not enough for this fee' : ''}</p>
      </section>
      <section class="llp-card"><h2>Rules</h2>${rows}</section>
      <section class="llp-card"><h2>Money and Lockup</h2>${opts}</section>
      <p class="llp-note">${MIN_SEATS} to ${MAX_SEATS} players. Private table: friends join with the link or the table code. You play too, and the game starts when you press Start with at least ${MIN_SEATS} players seated. Each turn lasts 5 minutes.</p>
    </main>
    <footer class="llp-bar"><button class="btn btn-primary btn-wide" data-act="create"${poor ? ' disabled' : ''}>${fee ? `Create table · pay ${fmt(fee)} coins` : 'Create free table'}</button></footer>
  </div>`;
}
function renderCreate(first) {
  if (first) { shell('', createHtml()); return; }
  const root = app();
  const sc = root.querySelector('.llp-body'); const top = sc ? sc.scrollTop : 0;
  morphdom(root.firstElementChild, createHtml());
  const sc2 = root.querySelector('.llp-body'); if (sc2) sc2.scrollTop = top;
}

// ---- joining -----------------------------------------------------------------------------------------------------------------
export async function open(code) {
  if (S.client && S.client.code === code && S.screen !== 'message') { renderCurrent(); return; }
  close();
  S.code = code;
  showChecking();
  const r = await peekLandlords(code);
  if (S.screen !== 'checking' || S.code !== code) return;
  if (r.error) {
    if (r.error === 'notfound') return showMessage('No table with that code', `There is no open Landlords table ${code}. Check the code, or ask the host to send the link again.`);
    if (r.error === 'signin') { location.hash = '#/'; return; }
    return showMessage('Could not reach the game server', 'Check your connection and try again.', [['Try again', 'retry'], ['Back to home', 'home']]);
  }
  const info = r.info;
  if (info.seated) { connect({}); return; } // already holds a seat here: straight back in, never charged again
  S.info = info;
  renderJoin();
}
function connect(intent) {
  clearTimers();
  S.client = new LandlordsClient({ code: S.code, intent });
  S.client.on('state', onState);
  S.client.on('status', onStatus);
  S.client.on('notice', (n) => n && n.text && toast(n.text));
  S.client.on('closed', () => {});
  if (S.screen !== 'game' && S.screen !== 'lobby') showChecking(intent.create ? 'Creating your table…' : intent.join ? 'Taking your seat…' : 'Reconnecting…');
}
export function startCreate() {
  const { fee, settings } = S.cfg;
  const code = newCode();
  S.code = code;
  history.replaceState(null, '', `#/m/${code}`);
  connect({ create: { fee, settings: cleanSettings(settings) } });
}
function renderJoin() {
  const i = S.info;
  const s = i.settings; const sum = ruleSummary(s);
  const bal = i.balance;
  const poor = bal !== null && bal < i.fee;
  let block = '';
  if (i.state === 'cancelled') block = 'This table was closed.';
  else if (i.started) block = 'This game has already started. Only the players who joined before it started can play.';
  else if (i.full) block = `This table is full (${i.max} players).`;
  else if (poor) block = `You need ${fmt(i.fee)} coins to join and you have ${fmt(bal)}.`;
  shell('', `<div class="llp"><header class="llp-top"><a class="llp-back" href="#/" data-act="home">‹ Back</a><h1>Landlords table ${esc(S.code)}</h1></header>
    <main class="llp-body">
      <section class="llp-card llp-join">
        <p class="llp-sub">${esc(i.hostName)} invited you to a private game of Landlords.</p>
        <div class="llp-fee"><span>Entry fee</span><b>${i.fee ? `${fmt(i.fee)} coins` : 'Free'}</b></div>
        <p class="llp-sub">${i.fee ? `The winner takes the whole pot. It is <b>${fmt(i.fee * i.count)} coins</b> now with ${i.count} ${i.count === 1 ? 'player' : 'players'}, and up to <b>${fmt(i.fee * i.max)}</b> with ${i.max}. The fee is taken from your wallet only when you press Join, and refunded if you leave before the game starts or the table is cancelled.` : 'Nothing is charged to join this table.'}</p>
        <p class="llp-sub">Your balance: <b class="${poor ? 'bad' : ''}">${bal === null ? '—' : `${fmt(bal)} coins`}</b></p>
      </section>
      <section class="llp-card"><h2>At the table <small>${i.count} of ${i.max}</small></h2><ul class="llp-names">${i.names.map((n, k) => `<li><i style="background:${COLORS[k % 6]}"></i>${esc(n)}</li>`).join('')}</ul></section>
      <section class="llp-card"><h2>Rules</h2><p class="llp-sub">${esc(sum.line)}</p>
        <div class="llp-tags">${sum.on.map((t) => `<span class="on">${esc(t)}</span>`).join('')}${sum.off.map((t) => `<span class="off">${esc(t)}</span>`).join('')}</div></section>
      ${block ? `<p class="llp-warn" role="alert">${esc(block)}</p>` : ''}
    </main>
    <footer class="llp-bar"><button class="btn btn-primary btn-wide" data-act="join"${block ? ' disabled' : ''}>${i.fee ? `Join · pay ${fmt(i.fee)} coins` : 'Join the table'}</button><button class="btn btn-quiet btn-wide" data-act="home">Not now</button></footer></div>`);
}

// ---- connection status ------------------------------------------------------------------------------------------------------------
function onStatus(st) {
  if (st === 'open') return;
  if (st === 'reconnecting') { toast('Connection lost. Reconnecting… your seat is kept.'); return; }
  const code = S.code;
  const gone = (t, b, a) => { if (S.client) S.client.close(); S.client = null; showMessage(t, b, a); };
  if (st === 'signin') { toHome(); return; }
  if (st === 'unregistered') { toHome(); return; }
  if (st === 'elsewhere') return gone('You are already at another table', 'Leave your other table first (or wait about a minute if you just closed it), then try again.');
  if (st === 'full') return gone('The table is full', 'Six players are already seated.');
  if (st === 'started') return gone('The game has already started', 'Only players who were seated before it started can play.');
  if (st === 'poor') return gone('Not enough coins', 'You do not have enough coins for the entry fee. Nothing was charged.');
  if (st === 'taken') return gone('That table code is in use', 'Please try again.', [['Try again', 'retry'], ['Back to home', 'home']]);
  if (st === 'notfound') return gone('No table with that code', `There is no open Landlords table ${code}.`);
  if (st === 'kicked') return gone('You were removed from the table', 'The host removed you before the game started. Your entry fee was refunded.');
  if (st === 'left') return gone('You left the table', S.view && S.view.phase === 'lobby' ? 'Your entry fee was refunded.' : 'Leaving a running game means giving up: your entry fee stays in the pot.');
  if (st === 'noserver') return gone('Could not reach the game server', 'Check your connection and try again. Nothing was charged.', [['Try again', 'retry'], ['Back to home', 'home']]);
  gone('Could not join the table', 'Please try again. Nothing was charged.', [['Try again', 'retry'], ['Back to home', 'home']]);
}

function onState(v) {
  S.view = v; S.recvAt = performance.now();
  if (v.phase === 'lobby') { S.screen = 'lobby'; renderLobby(); return; }
  if (S.screen !== 'game') { S.screen = 'game'; S.ui.sheet = null; shell('ll-game', '<div id="ll-root"></div>'); S.seenEv = Math.max(0, ...(v.events || []).map((e) => e.id)); startTick(); }
  renderGame();
}
function renderCurrent() { if (S.view) onState(S.view); }

// ---- lobby -------------------------------------------------------------------------------------------------------------------------
function inviteLink() { const u = new URL(location.href); u.hash = `#/m/${S.code}`; return u.toString(); }
function renderLobby() {
  const v = S.view; const sum = ruleSummary(v.settings);
  const host = v.you.host; const n = v.members.length; const need = Math.max(0, v.min - n);
  const slots = Array.from({ length: v.max }, (_, k) => {
    const m = v.members[k];
    if (!m) return `<li class="empty"><i></i><span>Open seat</span></li>`;
    return `<li class="${m.connected ? '' : 'away'}"><i style="background:${COLORS[k % 6]}"></i><span>${esc(m.name)}${m.id === v.hostId ? ' <em>host</em>' : ''}${m.id === v.you.id ? ' <em>you</em>' : ''}${m.connected ? '' : ` <em>away</em>`}</span>
      ${host && m.id !== v.you.id ? `<button class="llp-x" data-act="kick" data-pid="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">×</button>` : ''}</li>`;
  }).join('');
  const html = `<div class="llp"><header class="llp-top"><button class="llp-back" data-act="leave-ask">‹ Leave</button><h1>Waiting room</h1></header>
    <main class="llp-body">
      <section class="llp-card llp-code"><span>Table code</span><b>${esc(v.code)}</b>
        <div class="llp-invite"><input readonly value="${esc(inviteLink())}" aria-label="Invite link" id="ll-link"><button class="btn btn-dark" data-act="copy">Copy link</button></div>
        <p class="llp-sub">Send the link or the code to your friends. Only people you send it to can join.</p></section>
      <section class="llp-card"><h2>Players <small>${n} of ${v.max}</small></h2><ul class="llp-seats">${slots}</ul>
        <p class="llp-sub">${n < v.min ? `Waiting for ${need} more ${need === 1 ? 'player' : 'players'} (at least ${v.min} are needed).` : host ? 'Ready when you are.' : 'Waiting for the host to start the game.'}</p></section>
      <section class="llp-card"><h2>Entry fee and prize</h2>
        <div class="llp-fee"><span>Entry fee</span><b>${v.fee ? `${fmt(v.fee)} coins` : 'Free'}</b></div>
        ${v.fee ? `<div class="llp-fee"><span>Prize pool now</span><b>${fmt(v.pot)} coins</b></div><p class="llp-sub">The pot is locked when the game starts and goes to the last player standing. Leave before the start (or if the table is cancelled) and your fee is refunded.</p>` : '<p class="llp-sub">Nothing is charged at this table.</p>'}</section>
      <section class="llp-card"><h2>Rules</h2><p class="llp-sub">${esc(sum.line)}</p><div class="llp-tags">${sum.on.map((t) => `<span class="on">${esc(t)}</span>`).join('')}${sum.off.map((t) => `<span class="off">${esc(t)}</span>`).join('')}</div></section>
    </main>
    <footer class="llp-bar">${host ? `<button class="btn btn-primary btn-wide" data-act="start"${n < v.min ? ' disabled' : ''}>${n < v.min ? `Need ${need} more ${need === 1 ? 'player' : 'players'}` : 'Start the game'}</button>` : '<p class="llp-sub llp-centered">The host starts the game.</p>'}
      <button class="btn btn-quiet btn-wide" data-act="leave-ask">Leave and get my ${v.fee ? 'fee back' : 'seat free'}</button></footer>${confirmHtml()}</div>`;
  if (!document.querySelector('.llp-code')) shell('', html);
  else morphdom(app().firstElementChild, html, { onBeforeElUpdated(from, to) { if (from.id === 'll-link' && document.activeElement === from) return false; return !from.isEqualNode(to); } });
}

// ---- toasts and floating text -----------------------------------------------------------------------------------------------------------------
export function toast(text) {
  let el = document.getElementById('ll-toast');
  if (!el) { el = document.createElement('div'); el.id = 'll-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text; el.classList.add('on');
  clearTimeout(S.toastT); S.toastT = setTimeout(() => el.classList.remove('on'), 3200);
}
function floatText(seat, text, cls) {
  const el = document.querySelector(`.llpl[data-seat="${seat}"]`);
  if (!el) return;
  const f = document.createElement('i'); f.className = `llfl ${cls}`; f.textContent = text; el.appendChild(f);
  setTimeout(() => f.remove(), 1500);
}

// ---- confirm sheet -----------------------------------------------------------------------------------------------------------------------------
function confirmHtml() {
  const c = S.ui.confirm;
  if (!c) return '';
  return `<div class="lls-wrap"><div class="lls-scrim" data-act="confirm-no"></div><div class="lls" role="alertdialog" aria-label="${esc(c.title)}"><div class="lls-grip"></div><h2>${esc(c.title)}</h2><p class="llp-sub">${esc(c.body)}</p>
    <div class="lls-acts"><button class="btn btn-quiet" data-act="confirm-no">Stay</button><button class="btn btn-primary" data-act="confirm-yes">${esc(c.yes)}</button></div></div></div>`;
}
function ask(title, body, yes, run) { S.ui.confirm = { title, body, yes, run }; if (S.screen === 'game') renderGame(); else renderLobby(); }

// ---- the game screen -----------------------------------------------------------------------------------------------------------------------------
const gp = (i) => (i <= 10 ? [11, 11 - i] : i <= 20 ? [11 - (i - 10), 1] : i <= 30 ? [1, 1 + (i - 20)] : [1 + (i - 30), 11]); // [row, col]
const centre = (c) => (c === 1 ? 0.75 : c === 11 ? 11.25 : 1.5 + (c - 2) + 0.5);
const side = (i) => (i < 10 ? 'b' : i < 20 ? 'l' : i < 30 ? 't' : 'r');
const abbr = (n) => n.replace(/’/g, '').split(' ').map((w) => w[0]).join('').slice(0, 3);
const ICON = {
  start: '<svg viewBox="0 0 24 24"><path d="M4 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  jail: '<svg viewBox="0 0 24 24"><path d="M5 4v16M10 4v16M14 4v16M19 4v16M3 8h18M3 16h18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  vacation: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4" fill="currentColor"/><path d="M3 18c3-3 6-3 9 0s6 3 9 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  gojail: '<svg viewBox="0 0 24 24"><path d="M12 3v11M7 9l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  luck: '<svg viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-size="22" font-weight="900" fill="currentColor">?</text></svg>',
  fund: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  tax: '<svg viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-size="20" font-weight="900" fill="currentColor">$</text></svg>',
  station: '<svg viewBox="0 0 24 24"><path d="M5 3h14v12H5zM7 5v6h10V5zM4 18h16v2H4zM8 15l-2 3h12l-2-3z" fill="currentColor"/></svg>',
  utility: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>',
};
const SHORT = { start: 'START', jail: 'LOCKUP', vacation: 'VACATION', gojail: 'GO TO LOCKUP', luck: 'LUCK', fund: 'TOWN FUND', tax: 'TAX' };

function squareHtml(sq, v) {
  const [r, c] = gp(sq.i);
  const pr = sq.price ? v.props.find((p) => p.sq === sq.i) : null;
  const owner = pr && pr.owner >= 0 ? pr.owner : -1;
  const cls = ['sq', `t-${sq.type}`, `s-${side(sq.i)}`, sq.i % 10 === 0 ? 'corner' : '', pr && pr.mortgaged ? 'mortgaged' : '', owner >= 0 ? 'owned' : '', S.ui.sheet === 'prop' && S.ui.sq === sq.i ? 'sel' : ''].filter(Boolean).join(' ');
  let band = '';
  if (sq.type === 'street') {
    const h = pr ? pr.houses : 0;
    band = `<i class="band" style="background:${GROUPS[sq.group].color}">${h === 5 ? '<s></s>' : '<u></u>'.repeat(h)}</i>`;
  }
  const ico = ICON[sq.type] ? `<span class="ico">${ICON[sq.type]}</span>` : '';
  const label = sq.price ? `<b class="nm">${esc(sq.name)}</b><span class="pr">${money(sq.price)}</span>` : `<b class="nm sp">${esc(SHORT[sq.type] || sq.name)}</b>`;
  const own = owner >= 0 ? `<i class="own" style="background:${COLORS[owner % 6]}"></i>` : '';
  return `<button class="${cls}" style="grid-area:${r}/${c}" data-act="sq" data-sq="${sq.i}" aria-label="${esc(sq.name)}${owner >= 0 ? `, owned by ${esc(v.seats[owner].name)}` : ''}">${band}${ico}${label}${own}</button>`;
}

function diceHtml(d, key) {
  const pips = { 0: [], 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const one = (n) => `<span class="lldie">${(pips[n] || []).map((p) => `<i style="grid-area:${Math.ceil(p / 3)}/${((p - 1) % 3) + 1}"></i>`).join('')}</span>`;
  return `<div class="dice" id="dice-${key}">${one(d[0])}${one(d[1])}</div>`;
}

function statusText(v) {
  if (v.phase !== 'play') return '';
  const t = v.seats[v.turn]; const you = v.you.myTurn;
  switch (v.step) {
    case 'roll': return you ? (t.jail ? 'You are in Lockup. Roll for doubles, or pay to get out.' : 'Your turn. Roll the dice.') : `${t.name} is about to roll…`;
    case 'buy': { const s = BOARD[t.pos]; return you ? `${s.name} is for sale at ${money(s.price)}.` : `${t.name} is deciding on ${s.name}…`; }
    case 'auction': return `Auction: ${BOARD[v.auction.sq].name}`;
    case 'debt': return you ? `You owe ${money(v.debt.total)}. Raise the money or give up.` : `${t.name} owes ${money(v.debt.total)}…`;
    default: return you ? (v.again ? 'Doubles! Roll again.' : 'Build, trade, or end your turn.') : `${t.name} is finishing their turn…`;
  }
}

function playersHtml(v) {
  return v.seats.map((s) => {
    const cls = ['llpl', v.turn === s.i && v.phase === 'play' && !s.out ? 'turn' : '', s.out ? 'out' : '', !s.connected && !s.out ? 'away' : '', s.i === v.you.seat ? 'me' : ''].filter(Boolean).join(' ');
    const tags = [s.jail ? '<em class="jail">Lockup</em>' : '', s.cards ? `<em>${s.cards}× card</em>` : '', s.out ? `<em class="out">${s.reason === 'bankrupt' ? 'Bankrupt' : s.reason === 'abandoned' ? 'Left' : s.reason === 'afk' ? 'Away' : 'Out'}</em>` : '',
      !s.connected && !s.out ? `<em class="dc" data-dc="${s.dcLeft}">Offline <span class="dcl">${mmss(s.dcLeft)}</span></em>` : ''].join('');
    return `<button class="${cls}" data-act="player" data-seat="${s.i}" data-seat-i="${s.i}" aria-label="${esc(s.name)}, ${money(s.cash)}"><span class="tk" style="background:${COLORS[s.i % 6]}">${esc(s.name.slice(0, 1).toUpperCase())}</span>
      <span class="pn">${esc(s.name)}${s.i === v.you.seat ? ' <small>you</small>' : ''}</span><b class="pc">${s.out ? '—' : money(s.cash)}</b><span class="pt">${tags}</span></button>`;
  }).join('');
}

function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function dockHtml(v) {
  const you = v.you; const me = v.seats[you.seat]; const can = you.can;
  const tradeBadge = v.trades.filter((t) => t.to === you.id).length;
  const sec = you.out || !me ? '' : `<div class="lld-sec"><button class="btn btn-quiet" data-act="trade">Trade${tradeBadge ? `<i class="llbadge">${tradeBadge}</i>` : ''}</button><button class="btn btn-quiet" data-act="assets">Properties</button><button class="btn btn-quiet" data-act="menu">More</button></div>`;
  let main = '';
  const note = `<p class="lld-note" id="ll-note">${esc(statusText(v))}</p>`;
  if (v.phase !== 'play') main = '<p class="lld-note">The game is over.</p>';
  else if (you.out) main = `<p class="lld-note">You are out of the game. You can keep watching.</p><div class="lld-main"><button class="btn btn-quiet" data-act="menu">More</button></div>`;
  else if (v.step === 'auction') main = `${note}<div class="lld-main"><button class="btn btn-primary" data-act="bidsheet">Open the auction</button></div>`;
  else if (v.step === 'debt' && v.debt.seat === you.seat) main = `${note}<div class="lld-main"><button class="btn btn-primary" data-act="assets">Raise money</button><button class="btn btn-quiet" data-act="giveup-ask">Give up</button></div>`;
  else if (can.roll) main = `${note}<div class="lld-main"><button class="btn btn-primary btn-big" data-act="a" data-a="roll">Roll dice</button>${me.jail ? `<button class="btn btn-quiet" data-act="a" data-a="jailpay"${can.jailPay ? '' : ' disabled'}>Pay ${money(v.settings.jailFine)}</button>${can.jailCard ? '<button class="btn btn-quiet" data-act="a" data-a="jailcard">Use card</button>' : ''}` : ''}</div>`;
  else if (v.step === 'buy' && you.myTurn) { const s = BOARD[me.pos]; main = `${note}<div class="lld-main"><button class="btn btn-primary btn-big" data-act="a" data-a="buy"${can.buy ? '' : ' disabled'}>Buy ${money(s.price)}</button><button class="btn btn-quiet" data-act="a" data-a="decline">${v.settings.auction ? 'Auction it' : 'Pass'}</button></div>`; }
  else if (can.end) main = `${note}<div class="lld-main"><button class="btn btn-primary btn-big" data-act="a" data-a="end">${v.again ? 'Roll again' : 'End turn'}</button></div>`;
  else main = note;
  return `<div class="lld-in">${main}${sec}</div>`;
}

function boardHtml(v) {
  const sq = BOARD.map((s) => squareHtml(s, v)).join('');
  const supply = v.supply.houses === null ? 'Unlimited buildings' : `Bank: ${v.supply.houses} houses · ${v.supply.hotels} hotels`;
  const card = v.card && v.card.n === v.rollNo ? `<div class="llcard ${v.card.deck}" id="card-${v.rollNo}-${v.seats[v.card.seat] ? v.card.seat : 0}"><b>${v.card.deck === 'luck' ? 'Luck' : 'Town Fund'}</b><p>${esc(v.card.text)}</p></div>` : '';
  return `<div class="ll-board" style="--z:${S.ui.zoom}"><div class="llc">
      <div class="llc-in"><p class="llc-st" aria-live="polite">${esc(statusText(v))}</p>${v.dice[0] ? diceHtml(v.dice, v.rollNo) : '<div class="dice ph"></div>'}${card}
      <p class="llc-sub">${esc(supply)}${v.vacationPot !== null ? ` · Vacation pot ${money(v.vacationPot)}` : ''}</p></div></div>${sq}<div class="ll-toks" data-static="1"></div></div>`;
}

function sheetHtml(v) {
  const u = S.ui;
  if (u.confirm) return confirmHtml();
  if (v.phase !== 'play' && !u.dismissedResult) return resultHtml(v);
  if (v.auction && v.you.seat >= 0 && !v.you.out && u.sheet !== 'menu') return auctionHtml(v);
  switch (u.sheet) {
    case 'menu': return menuHtml(v);
    case 'log': return wrap('Game log', `<ol class="lls-log">${v.log.slice().reverse().map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>`);
    case 'assets': return assetsHtml(v);
    case 'trade': return tradeHtml(v);
    case 'prop': return propHtml(v);
    case 'player': return playerHtml(v);
    default: return '';
  }
}
const wrap = (title, body, extra = '') => `<div class="lls-wrap"><div class="lls-scrim" data-act="sheet-close"></div><div class="lls ${extra}" role="dialog" aria-label="${esc(title)}"><div class="lls-grip"></div><header class="lls-h"><h2>${esc(title)}</h2><button class="lls-x" data-act="sheet-close" aria-label="Close">×</button></header><div class="lls-b">${body}</div></div></div>`;

function menuHtml(v) {
  const sum = ruleSummary(v.settings);
  return wrap('Menu', `<div class="lls-list">
    <button class="btn btn-quiet" data-act="sound">Sound: ${sound.on ? 'on' : 'off'}</button>
    <button class="btn btn-quiet" data-act="zoom">${S.ui.zoom > 1 ? 'Show the whole board' : 'Zoom in on the board'}</button>
    <button class="btn btn-quiet" data-act="log">Game log</button>
    <button class="btn btn-quiet" data-act="full">Full screen</button>
    <button class="btn btn-quiet danger" data-act="giveup-ask">Leave the game</button></div>
    <h3>This game's rules</h3><p class="llp-sub">${esc(sum.line)}</p><div class="llp-tags">${sum.on.map((t) => `<span class="on">${esc(t)}</span>`).join('')}${sum.off.map((t) => `<span class="off">${esc(t)}</span>`).join('')}</div>
    <p class="llp-sub">Prize pool: <b>${fmt(v.pot)} coins</b> to the last player standing. Each turn lasts 5 minutes.</p>`);
}

function rentTable(sq) {
  if (sq.type === 'street') return `<table class="lls-rent"><tr><td>Rent</td><td>${money(sq.rents[0])}</td></tr><tr><td>Complete set</td><td>${money(sq.rents[0] * 2)}<small>*</small></td></tr>${[1, 2, 3, 4].map((h) => `<tr><td>${h} house${h > 1 ? 's' : ''}</td><td>${money(sq.rents[h])}</td></tr>`).join('')}<tr><td>Hotel</td><td>${money(sq.rents[5])}</td></tr></table><p class="llp-sub">Houses cost ${money(houseCost(sq.i))} each. Mortgage value ${money(mortgageValue(sq.i))}. <small>* only when the table has “double rent on full sets” on.</small></p>`;
  if (sq.type === 'station') return `<table class="lls-rent"><tr><td>1 station</td><td>$25</td></tr><tr><td>2 stations</td><td>$50</td></tr><tr><td>3 stations</td><td>$100</td></tr><tr><td>4 stations</td><td>$200</td></tr></table><p class="llp-sub">Mortgage value ${money(mortgageValue(sq.i))}.</p>`;
  return `<table class="lls-rent"><tr><td>1 utility</td><td>4 × dice</td></tr><tr><td>Both utilities</td><td>10 × dice</td></tr></table><p class="llp-sub">Mortgage value ${money(mortgageValue(sq.i))}.</p>`;
}
function propHtml(v) {
  const sq = BOARD[S.ui.sq]; if (!sq) return '';
  if (!sq.price) return wrap(sq.name, `<p class="llp-sub">${{ start: 'Pass or land here to collect the Start bonus.', jail: 'Just visiting, or serving time.', vacation: v.vacationPot === null ? 'A free stop. Nothing happens.' : `Collect the vacation pot (now ${money(v.vacationPot)}).`, gojail: 'Go straight to Lockup. Do not pass Start.', luck: 'Draw a Luck card.', fund: 'Draw a Town Fund card.', tax: sq.tax === 'income' ? (v.settings.incomeTax === 'flat' ? 'Pay $200.' : 'Pay 10% of everything you own.') : `Pay ${money(sq.amount)}.` }[sq.type] || ''}</p>`);
  const pr = v.props.find((p) => p.sq === sq.i); const owner = pr.owner >= 0 ? v.seats[pr.owner] : null;
  const mine = pr.owner === v.you.seat;
  const can = v.you.can;
  const acts = [];
  if (mine) {
    if (sq.type === 'street') { acts.push(`<button class="btn btn-dark" data-act="a" data-a="build" data-sq="${sq.i}"${can.build.includes(sq.i) ? '' : ' disabled'}>Build ${money(houseCost(sq.i))}</button>`, `<button class="btn btn-quiet" data-act="a" data-a="sell" data-sq="${sq.i}"${can.sell.includes(sq.i) ? '' : ' disabled'}>Sell building</button>`); }
    if (v.settings.mortgage) acts.push(pr.mortgaged ? `<button class="btn btn-dark" data-act="a" data-a="unmortgage" data-sq="${sq.i}"${can.unmortgage.includes(sq.i) ? '' : ' disabled'}>Unmortgage ${money(unmortgageCost(sq.i))}</button>` : `<button class="btn btn-quiet" data-act="a" data-a="mortgage" data-sq="${sq.i}"${can.mortgage.includes(sq.i) ? '' : ' disabled'}>Mortgage +${money(mortgageValue(sq.i))}</button>`);
  } else if (owner && !v.you.out && !owner.out) acts.push(`<button class="btn btn-primary" data-act="trade-for" data-sq="${sq.i}">Make an offer for it</button>`);
  const g = sq.group ? `<i class="lls-band" style="background:${GROUPS[sq.group].color}"></i>` : '';
  return wrap(sq.name, `${g}<p class="lls-price">${money(sq.price)} <small>${owner ? `Owned by ${esc(owner.name)}${pr.mortgaged ? ' · mortgaged' : ''}${pr.houses ? ` · ${pr.houses === 5 ? 'hotel' : `${pr.houses} house${pr.houses > 1 ? 's' : ''}`}` : ''}` : 'Not owned'}</small></p>${rentTable(sq)}${acts.length ? `<div class="lls-acts wrap">${acts.join('')}</div>` : ''}`);
}

function playerHtml(v) {
  const s = v.seats[S.ui.seat]; if (!s) return '';
  const props = v.props.filter((p) => p.owner === s.i);
  const list = props.length ? props.map((p) => propChip(p, v)).join('') : '<span class="llp-sub">No properties yet.</span>';
  return wrap(s.name, `<p class="lls-price">${s.out ? 'Out of the game' : money(s.cash)} <small>net worth ${money(s.worth)}${s.jail ? ' · in Lockup' : ''}${s.cards ? ` · ${s.cards} free card${s.cards > 1 ? 's' : ''}` : ''}</small></p><div class="lls-props">${list}</div>
    ${s.i !== v.you.seat && !s.out && !v.you.out ? `<div class="lls-acts"><button class="btn btn-primary" data-act="trade-with" data-seat="${s.i}">Trade with ${esc(s.name)}</button></div>` : ''}`);
}
function propChip(p, v, extra = '') {
  const sq = BOARD[p.sq];
  return `<button class="pchip ${p.mortgaged ? 'mort' : ''} ${extra}" style="--c:${sq.group ? GROUPS[sq.group].color : '#999'}" data-act="sq" data-sq="${p.sq}"><i></i><span>${esc(sq.name)}</span>${p.houses ? `<em>${p.houses === 5 ? 'H' : p.houses}</em>` : ''}</button>`;
}

function assetsHtml(v) {
  const me = v.you.seat; const mine = v.props.filter((p) => p.owner === me); const can = v.you.can;
  if (!mine.length) return wrap('Your properties', '<p class="llp-sub">You do not own any properties yet.</p>');
  const rows = mine.map((p) => {
    const sq = BOARD[p.sq];
    const b = [];
    if (sq.type === 'street') b.push(`<button class="btn btn-dark btn-xs" data-act="a" data-a="build" data-sq="${p.sq}"${can.build.includes(p.sq) ? '' : ' disabled'}>Build ${money(houseCost(p.sq))}</button><button class="btn btn-quiet btn-xs" data-act="a" data-a="sell" data-sq="${p.sq}"${can.sell.includes(p.sq) ? '' : ' disabled'}>Sell +${money(houseCost(p.sq) / 2)}</button>`);
    if (v.settings.mortgage) b.push(p.mortgaged ? `<button class="btn btn-dark btn-xs" data-act="a" data-a="unmortgage" data-sq="${p.sq}"${can.unmortgage.includes(p.sq) ? '' : ' disabled'}>Unmortgage ${money(unmortgageCost(p.sq))}</button>` : `<button class="btn btn-quiet btn-xs" data-act="a" data-a="mortgage" data-sq="${p.sq}"${can.mortgage.includes(p.sq) ? '' : ' disabled'}>Mortgage +${money(mortgageValue(p.sq))}</button>`);
    return `<li style="--c:${sq.group ? GROUPS[sq.group].color : '#999'}"><i class="rb"></i><div class="llrn"><b>${esc(sq.name)}</b><small>${p.mortgaged ? 'Mortgaged' : p.houses === 5 ? 'Hotel' : p.houses ? `${p.houses} house${p.houses > 1 ? 's' : ''}` : 'No buildings'}</small></div><div class="rb2">${b.join('')}</div></li>`;
  }).join('');
  const debt = v.debt && v.debt.seat === me ? `<p class="llp-warn">You owe ${money(v.debt.total)}. You have ${money(v.seats[me].cash)}. Sell buildings or mortgage properties to pay it.</p>` : '';
  return wrap('Your properties', `${debt}<p class="llp-sub">Cash ${money(v.seats[me].cash)}${v.supply.houses === null ? '' : ` · Bank has ${v.supply.houses} houses and ${v.supply.hotels} hotels`}</p><ul class="lls-assets">${rows}</ul>`, 'tall');
}

// -- auctions ------------------------------------------------------------------------------------------------------------------------
function auctionHtml(v) {
  const a = v.auction; const sq = BOARD[a.sq]; const can = v.you.can;
  const hi = a.bidder >= 0 ? v.seats[a.bidder] : null;
  const next = can.bid ? can.bid.min : a.bid ? a.bid + 10 : 10;
  const amt = Number(S.ui.bid) || next;
  const g = sq.group ? GROUPS[sq.group].color : '#999';
  return `<div class="lls-wrap auction"><div class="lls-scrim"></div><div class="lls tall" role="dialog" aria-label="Auction"><div class="lls-grip"></div>
    <header class="lls-h"><h2>Auction</h2><span class="aucleft" id="auc-left" data-left="${a.left}">${Math.ceil(a.left / 1000)}s</span></header>
    <div class="lls-b"><div class="aucbar"><i id="auc-bar" style="width:${Math.min(100, (a.left / a.total) * 100)}%"></i></div>
      <div class="aucprop"><i style="background:${g}"></i><div><b>${esc(sq.name)}</b><small>List price ${money(sq.price)}</small></div></div>
      <div class="aucbid ${hi ? 'on' : ''}" id="auc-bid"><span>${hi ? 'Highest bid' : 'No bids yet'}</span><b>${hi ? money(a.bid) : '—'}</b><small>${hi ? `${hi.i === v.you.seat ? 'You are' : esc(hi.name) + ' is'} winning` : 'Be the first to bid'}</small></div>
      ${can.bid ? `<div class="aucform"><div class="aucquick">${[10, 50, 100].map((d) => `<button class="btn btn-quiet" data-act="bid-add" data-d="${d}"${a.bid + d > can.bid.max ? ' disabled' : ''}>+${d}</button>`).join('')}</div>
        <label class="aucamt">Your bid <input id="ll-bid" type="number" inputmode="numeric" min="${next}" max="${can.bid.max}" step="10" value="${amt}" aria-label="Your bid"></label>
        <button class="btn btn-primary btn-big" data-act="bid" data-amt="${amt}">Bid ${money(amt)}</button><p class="llp-sub">You have ${money(v.seats[v.you.seat].cash)}. Bids go up by at least $10.</p></div>`
        : `<p class="llp-sub">${hi && hi.i === v.you.seat ? 'You are the highest bidder. Wait for the clock, or for someone to outbid you.' : v.seats[v.you.seat].cash < next ? 'You do not have enough cash to bid.' : 'Wait for the clock.'}</p>`}
    </div></div></div>`;
}

// -- trading -------------------------------------------------------------------------------------------------------------------------
function tradable(v, seat) { return v.props.filter((p) => p.owner === seat && !groupOf(BOARD[p.sq].group).some((q) => (v.props.find((x) => x.sq === q) || {}).houses > 0)); }
function sideSummary(v, side) {
  const bits = side.props.map((sq) => esc(BOARD[sq].name));
  if (side.cash) bits.push(`<b>${money(side.cash)}</b>`);
  return bits.length ? bits.join(', ') : 'nothing';
}
function tradeHtml(v) {
  const t = S.ui.trade; const me = v.you.seat;
  const offers = v.trades.map((x) => {
    const mineOut = x.from === v.you.id;
    const other = v.seats.find((q) => q.id === (mineOut ? x.to : x.from));
    if (!other) return '';
    const yourSide = mineOut ? x.give : x.get; const theirSide = mineOut ? x.get : x.give;
    return `<li class="tr ${mineOut ? 'out' : 'in'}"><div class="trh"><b>${mineOut ? `Your offer to ${esc(other.name)}` : `${esc(other.name)} offers you a trade`}</b><small>${mineOut ? 'waiting for an answer' : 'your answer is needed'}</small></div>
      <div class="trs"><div><small>You give</small><p>${sideSummary(v, yourSide)}</p></div><i aria-hidden="true">⇄</i><div><small>You get</small><p>${sideSummary(v, theirSide)}</p></div></div>
      <div class="lls-acts wrap">${mineOut ? `<button class="btn btn-quiet" data-act="trade-cancel" data-id="${x.id}">Cancel offer</button>` : `<button class="btn btn-primary" data-act="trade-accept" data-id="${x.id}" data-ver="${x.ver}">Accept</button><button class="btn btn-dark" data-act="trade-counter" data-id="${x.id}">Counter-offer</button><button class="btn btn-quiet" data-act="trade-reject" data-id="${x.id}">Reject</button>`}</div></li>`;
  }).join('');
  if (!t) {
    const others = v.seats.filter((s) => !s.out && s.i !== me);
    return wrap('Trades', `${offers ? `<ul class="lls-trades">${offers}</ul>` : '<p class="llp-sub">No open offers.</p>'}<h3>New offer</h3><p class="llp-sub">Pick a player.</p>
      <div class="lls-pick">${others.map((s) => `<button class="btn btn-quiet" data-act="trade-with" data-seat="${s.i}"><i class="tk" style="background:${COLORS[s.i % 6]}">${esc(s.name.slice(0, 1).toUpperCase())}</i>${esc(s.name)}</button>`).join('')}</div>`, 'tall');
  }
  const other = v.seats[t.to];
  const mineP = tradable(v, me); const theirP = tradable(v, t.to);
  const side = (key, label, who, list, maxCash) => `<div class="trcol"><h4>${label}</h4>
    <div class="lls-props">${list.length ? list.map((p) => propChip(p, v, `${t[key].props.includes(p.sq) ? 'on' : ''}`).replace('data-act="sq"', `data-act="tr-toggle" data-key="${key}"`)).join('') : '<span class="llp-sub">Nothing to trade.</span>'}</div>
    <label class="trcash">Cash<input type="number" inputmode="numeric" min="0" max="${maxCash}" step="10" value="${t[key].cash || ''}" placeholder="0" data-key="${key}" data-cash aria-label="Cash ${label}"></label>
    <div class="trq">${[10, 50, 100].map((d) => `<button class="btn btn-quiet btn-xs" data-act="tr-cash" data-key="${key}" data-d="${d}">+${d}</button>`).join('')}<button class="btn btn-quiet btn-xs" data-act="tr-cash" data-key="${key}" data-d="0">Clear</button></div></div>`;
  const ok = t.give.props.length || t.give.cash || t.get.props.length || t.get.cash;
  const title = t.counterOf ? `Counter-offer to ${other.name}` : `Offer to ${other.name}`;
  return wrap(title, `<div class="trgrid">${side('give', 'You give', 'me', mineP, v.seats[me].cash)}${side('get', `${other.name} gives`, 'other', theirP, other.cash)}</div>
    <div class="trsum"><small>Summary</small><p>You give <b>${sideSummary(v, t.give)}</b> and get <b>${sideSummary(v, t.get)}</b>.</p><small>Both of you must agree. Only in-game cash and properties can be traded, never coins. Mortgaged properties keep their mortgage and the new owner pays 10% interest straight away.</small></div>
    <div class="lls-acts wrap"><button class="btn btn-primary" data-act="trade-send"${ok ? '' : ' disabled'}>${t.counterOf ? 'Send counter-offer' : 'Send offer'}</button><button class="btn btn-quiet" data-act="trade-back">Back</button></div>`, 'tall');
}

// -- results -----------------------------------------------------------------------------------------------------------------------------
function resultHtml(v) {
  const cancelled = v.phase === 'cancelled';
  const win = v.winner >= 0 ? v.seats[v.winner] : null;
  const youWon = win && win.i === v.you.seat;
  const st = v.settle || {};
  let money1 = '';
  if (cancelled) money1 = st.status === 'refunded' ? 'The game was cancelled. Every entry fee has been refunded to the players’ wallets.' : 'The game was cancelled. Refunds are being processed…';
  else if (st.status === 'paid') money1 = `${esc(win.name)} receives the whole pot: <b>${fmt(st.pot)} coins</b>${youWon ? ' in your wallet' : ''}.`;
  else if (st.status === 'error') money1 = 'There was a problem paying the prize. It will be sorted out automatically; your balance is safe.';
  else money1 = `Paying the pot of ${fmt(st.pot || v.pot)} coins to ${esc(win ? win.name : 'the winner')}…`;
  const rows = v.standings.map((s, k) => `<li class="${s.out ? 'out' : ''}"><span class="rk">${k + 1}</span><span class="tk" style="background:${COLORS[v.seats.findIndex((x) => x.id === s.id) % 6]}">${esc(s.name.slice(0, 1).toUpperCase())}</span><b>${esc(s.name)}${s.id === v.you.id ? ' <small>you</small>' : ''}</b><em>${s.out ? ({ bankrupt: 'bankrupt', abandoned: 'left the game', afk: 'away too long', resigned: 'gave up' }[s.reason] || 'out') : money(s.worth)}</em></li>`).join('');
  return `<div class="lls-wrap result"><div class="lls-scrim"></div><div class="lls tall" role="dialog" aria-label="Game over"><div class="lls-grip"></div>
    <div class="res-top ${youWon ? 'won' : ''}"><div class="res-burst" aria-hidden="true"></div><h2>${cancelled ? 'Game cancelled' : youWon ? 'You won!' : `${esc(win ? win.name : 'Nobody')} wins`}</h2><p>${money1}</p></div>
    ${cancelled ? '' : `<ol class="res-list">${rows}</ol>`}
    <div class="lls-acts wrap"><button class="btn btn-primary" data-act="finish">Back to home</button><button class="btn btn-quiet" data-act="res-close">See the board</button></div></div></div>`;
}

// ---- rendering the game -----------------------------------------------------------------------------------------------------------------------
function renderGame() {
  const v = S.view;
  if (!v) return;
  const root = document.getElementById('ll-root');
  if (!root) return;
  const curTurn = S.turnShown !== `${v.turn}:${v.rollNo}`;
  const html = `<div class="ll" data-step="${v.step}" data-phase="${v.phase}" data-mine="${v.you.myTurn ? 1 : 0}">
    <header class="ll-top"><button class="ll-ic" data-act="menu" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg></button>
      <span class="ll-code">${esc(v.code)}</span>
      <span class="ll-timer${v.you.myTurn ? ' llmine' : ''}" id="ll-timer" data-left="${v.turnLeft}" data-phase="${v.phase}"><span class="ll-who">${v.phase === 'play' ? esc(v.seats[v.turn].name) : 'Game over'}</span><b id="ll-clock">${mmss(v.turnLeft)}</b></span>
      <span class="ll-pot" title="Prize pool">${v.fee ? `<small>Pot</small>${fmt(v.pot)}` : 'Free'}</span>
      <button class="ll-ic" data-act="log" aria-label="Game log"><svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4z" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/></svg></button></header>
    <section class="ll-players" aria-label="Players">${playersHtml(v)}</section>
    <main class="ll-stage" id="ll-stage">${boardHtml(v)}<button class="ll-zoom" data-act="zoom" aria-label="${S.ui.zoom > 1 ? 'Zoom out' : 'Zoom in'}">${S.ui.zoom > 1 ? '−' : '+'}</button></main>
    <footer class="ll-dock">${dockHtml(v)}</footer>
    ${sheetHtml(v)}</div>`;
  morphdom(root, `<div id="ll-root">${html}</div>`, {
    onBeforeElUpdated(from, to) {
      if (from.dataset && from.dataset.static) return false;
      if (from.id === 'll-bid' && document.activeElement === from) { to.value = from.value; }
      if (from.tagName === 'INPUT' && document.activeElement === from) return false;
      return !from.isEqualNode(to);
    },
  });
  handleEvents(v);
  animateTokens(v);
  if (curTurn) { S.turnShown = `${v.turn}:${v.rollNo}`; if (S.ui.zoom > 1) panToToken(v.seats[v.turn].pos); }
}

// ---- effects from server events ------------------------------------------------------------------------------------------------------------------
function handleEvents(v) {
  const fresh = (v.events || []).filter((e) => e.id > S.seenEv);
  if (!fresh.length) return;
  S.seenEv = fresh[fresh.length - 1].id;
  const me = v.you.seat;
  for (const e of fresh) {
    const seatOf = (id) => v.seats.findIndex((s) => s.id === id);
    switch (e.type) {
      case 'roll': sound.play('diceroll'); setTimeout(() => sound.play('diceland'), 650); break;
      case 'rent': { const f = seatOf(e.from); const t = seatOf(e.to); floatText(f, `−${money(e.n)}`, 'neg'); floatText(t, `+${money(e.n)}`, 'pos'); sound.play(f === me ? 'bust' : t === me ? 'win' : 'chip'); break; }
      case 'money': { const s = seatOf(e.pid); floatText(s, `${e.n > 0 ? '+' : '−'}${money(Math.abs(e.n))}`, e.n > 0 ? 'pos' : 'neg'); sound.play(e.n > 0 ? 'chip' : 'collect'); break; }
      case 'buy': { sound.play('collect'); flashSq(e.sq); break; }
      case 'build': sound.play('collect'); flashSq(e.sq); break;
      case 'draw': sound.play('flip'); break;
      case 'trade': sound.play('win'); toast('Deal done!'); burst(); break;
      case 'trade-offer': if (seatOf(e.to) === me) { sound.play('turn'); toast(`${v.seats[seatOf(e.from)].name} sent you a trade offer`); } break;
      case 'auction': sound.play('whoosh'); S.ui.bid = ''; break;
      case 'bid': if (seatOf(e.pid) !== me) sound.play('chip'); break;
      case 'turn': if (seatOf(e.pid) === me) { sound.play('turn'); if (document.hidden) document.title = 'Your turn · Landlords'; } break;
      case 'out': sound.play('bust'); toast(`${v.seats[seatOf(e.pid)].name} is out`); break;
      case 'over': sound.play(seatOf(e.pid) === me ? 'win' : 'lose'); S.ui.dismissedResult = false; break;
      case 'gone': toast(`${v.seats[seatOf(e.pid)].name} lost connection`); break;
      case 'back': toast(`${v.seats[seatOf(e.pid)].name} is back`); break;
      default:
    }
  }
}
function flashSq(i) { const el = document.querySelector(`.sq[data-sq="${i}"]`); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }
function burst() {
  const b = document.createElement('div'); b.className = 'll-burst'; b.innerHTML = '<b>Deal!</b>'; document.body.appendChild(b); setTimeout(() => b.remove(), 1600);
}

// ---- tokens ---------------------------------------------------------------------------------------------------------------------------------------
const OFF = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, -0.32], [0, 0.32]];
function tokenXY(pos, seat) {
  const [r, c] = gp(pos);
  const o = OFF[seat % 6];
  return { x: ((centre(c) + o[0] * (c === 1 || c === 11 ? 1.2 : 0.9)) / 12) * 100, y: ((centre(r) + o[1] * (r === 1 || r === 11 ? 1.2 : 0.9)) / 12) * 100 };
}
function placeTokens(v) {
  const layer = document.querySelector('.ll-toks');
  if (!layer) return;
  for (const s of v.seats) {
    if (s.out) { const old = layer.querySelector(`#tok-${s.i}`); if (old) old.remove(); continue; }
    let el = layer.querySelector(`#tok-${s.i}`);
    if (!el) { el = document.createElement('i'); el.id = `tok-${s.i}`; el.className = 'tok'; el.style.background = COLORS[s.i % 6]; el.textContent = s.name.slice(0, 1).toUpperCase(); layer.appendChild(el); }
    const p = S.shown[s.i] ?? s.pos;
    const { x, y } = tokenXY(p, s.i);
    el.style.left = `${x}%`; el.style.top = `${y}%`;
    el.classList.toggle('turn', v.phase === 'play' && v.turn === s.i);
  }
}
// A token walks square by square toward where the server says it is.
function animateTokens(v) {
  for (const s of v.seats) if (S.shown[s.i] === undefined) S.shown[s.i] = s.pos;
  placeTokens(v);
  if (S.walk) return;
  const step = () => {
    const vv = S.view; let moving = false;
    for (const s of vv.seats) {
      const cur = S.shown[s.i];
      if (cur === s.pos) continue;
      moving = true;
      const fwd = (s.pos - cur + 40) % 40;
      if (fwd > 12 || s.jail === 1 && s.pos === 10) S.shown[s.i] = s.pos; // jumps (Lockup, cards that go back) go straight there
      else { S.shown[s.i] = (cur + 1) % 40; if (s.i === vv.you.seat || fwd < 4) sound.play('slide'); }
    }
    placeTokens(vv);
    if (!moving) { clearInterval(S.walk); S.walk = 0; }
  };
  const need = v.seats.some((s) => S.shown[s.i] !== s.pos);
  if (need) { S.walk = setInterval(step, 130); S.timers.push(S.walk); }
}
function panToToken(pos) {
  const st = document.getElementById('ll-stage'); const el = document.querySelector('.ll-board');
  if (!st || !el || S.ui.zoom <= 1) return;
  const { x, y } = tokenXY(pos, 0);
  st.scrollTo({ left: (x / 100) * el.offsetWidth - st.clientWidth / 2, top: (y / 100) * el.offsetHeight - st.clientHeight / 2, behavior: 'smooth' });
}

// ---- clocks (updated in place; a re-render is not needed to count down) -------------------------------------------------------------------------------
function startTick() {
  clearInterval(S.tick);
  S.tick = setInterval(() => {
    const v = S.view; if (!v || S.screen !== 'game') return;
    const el = performance.now() - S.recvAt;
    const t = document.getElementById('ll-timer');
    if (t) {
      const left = Math.max(0, v.turnLeft - el);
      const c = document.getElementById('ll-clock'); if (c && v.phase === 'play') c.textContent = mmss(left);
      t.classList.toggle('warn', v.phase === 'play' && left <= 60000 && left > 30000); t.classList.toggle('danger', v.phase === 'play' && left <= 30000);
      if (v.phase === 'play' && v.you.myTurn && left <= 30000 && left > 29000 && S.warned !== v.rollNo + ':' + v.turn) { S.warned = v.rollNo + ':' + v.turn; sound.play('turn'); toast('30 seconds left in your turn'); }
    }
    document.querySelectorAll('.dc').forEach((n) => { const l = Math.max(0, Number(n.dataset.dc) - el); const s = n.querySelector('.dcl'); if (s) s.textContent = mmss(l); });
    if (v.auction) {
      const left = Math.max(0, v.auction.left - el);
      const l = document.getElementById('auc-left'); if (l) l.textContent = `${Math.ceil(left / 1000)}s`;
      const b = document.getElementById('auc-bar'); if (b) b.style.width = `${Math.min(100, (left / v.auction.total) * 100)}%`;
    }
  }, 250);
  S.timers.push(S.tick);
}

// ---- clicks ------------------------------------------------------------------------------------------------------------------------------------------
const blankTrade = (to) => ({ to, give: { props: [], cash: 0 }, get: { props: [], cash: 0 }, counterOf: null, ver: 0, id: null });
function sendTrade() {
  const t = S.ui.trade; const v = S.view;
  const to = v.seats[t.to];
  if (t.counterOf) S.client.act({ type: 'tradeCounter', id: t.counterOf, ver: t.ver, give: t.give, get: t.get });
  else S.client.act({ type: 'trade', to: to.id, give: t.give, get: t.get });
  S.ui.trade = null; S.ui.sheet = 'trade';
  renderGame();
}
function closeSheet() { S.ui.sheet = null; S.ui.trade = null; S.ui.confirm = null; }

document.addEventListener('click', (e) => {
  if (!S.screen) return;
  const el = e.target.closest('[data-act], [data-opt], [data-sw]');
  if (!el) return;
  sound.unlock();
  const v = S.view;
  // create-screen controls
  if (el.dataset.sw) { const k = el.dataset.sw; S.cfg.settings[k] = !S.cfg.settings[k]; renderCreate(); return; }
  if (el.dataset.opt) {
    const k = el.dataset.opt; const raw = el.dataset.v;
    if (k === 'fee') S.cfg.fee = Number(raw); else S.cfg.settings[k] = typeof DEFAULT_SETTINGS[k] === 'number' ? Number(raw) : raw;
    renderCreate(); return;
  }
  const act = el.dataset.act;
  const done = () => (S.screen === 'game' ? renderGame() : S.screen === 'lobby' ? renderLobby() : null);
  switch (act) {
    case 'home': e.preventDefault(); toHome(); return;
    case 'retry': e.preventDefault(); { const c = S.code; close(); if (c) open(c); else toHome(); } return;
    case 'create': if (S.cfg.fee > S.balance) return; startCreate(); return;
    case 'join': connect({ join: true }); return;
    case 'copy': copyInvite(); return;
    case 'start': S.client.start(); return;
    case 'kick': S.client.kick(el.dataset.pid); return;
    case 'leave-ask': ask(v && v.phase === 'lobby' ? 'Leave this table?' : 'Leave the game?', v && v.phase === 'lobby' ? (v.fee ? 'Your entry fee will be refunded.' : 'You can come back with the link.') : 'You will be out of the game and your entry fee stays in the pot.', 'Leave', () => S.client.leaveMatch()); return;
    case 'giveup-ask': S.ui.sheet = null; ask('Leave the game?', 'You will be out of the game, your properties go back to the bank (or to the player you owe), and your entry fee stays in the pot.', 'Leave the game', () => S.client.leaveMatch()); return;
    case 'confirm-yes': { const c = S.ui.confirm; S.ui.confirm = null; done(); if (c) c.run(); return; }
    case 'confirm-no': S.ui.confirm = null; done(); return;
    case 'sheet-close': closeSheet(); done(); return;
    case 'menu': S.ui.sheet = S.ui.sheet === 'menu' ? null : 'menu'; done(); return;
    case 'log': S.ui.sheet = 'log'; done(); return;
    case 'assets': S.ui.sheet = 'assets'; done(); return;
    case 'sound': sound.toggle(); done(); return;
    case 'full': { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); S.ui.sheet = null; done(); return; }
    case 'zoom': S.ui.zoom = S.ui.zoom > 1 ? 1 : 2.2; S.ui.sheet = S.ui.sheet === 'menu' ? null : S.ui.sheet; done(); if (S.ui.zoom > 1 && v) setTimeout(() => panToToken(v.seats[v.turn].pos), 50); return;
    case 'sq': S.ui.sq = Number(el.dataset.sq); S.ui.sheet = 'prop'; done(); return;
    case 'player': S.ui.seat = Number(el.dataset.seat); S.ui.sheet = 'player'; done(); return;
    case 'a': { const a = { type: el.dataset.a }; if (el.dataset.sq !== undefined) a.sq = Number(el.dataset.sq); S.client.act(a); return; }
    case 'res-close': S.ui.dismissedResult = true; done(); return;
    case 'finish': close(); toHome(); return;
    case 'bidsheet': S.ui.sheet = null; done(); return;
    case 'bid': S.client.act({ type: 'bid', amount: Number(el.dataset.amt) }); S.ui.bid = ''; return;
    case 'bid-add': { const a = v.auction; S.ui.bid = String(a.bid + Number(el.dataset.d)); done(); return; }
    // trading
    case 'trade': S.ui.sheet = 'trade'; S.ui.trade = null; done(); return;
    case 'trade-with': S.ui.trade = blankTrade(Number(el.dataset.seat)); S.ui.sheet = 'trade'; done(); return;
    case 'trade-for': { const p = v.props.find((x) => x.sq === Number(el.dataset.sq)); const t = blankTrade(p.owner); t.get.props = [p.sq]; S.ui.trade = t; S.ui.sheet = 'trade'; done(); return; }
    case 'trade-back': S.ui.trade = null; done(); return;
    case 'tr-toggle': { const t = S.ui.trade; const k = el.dataset.key; const q = Number(el.dataset.sq); t[k].props = t[k].props.includes(q) ? t[k].props.filter((x) => x !== q) : [...t[k].props, q]; done(); return; }
    case 'tr-cash': { const t = S.ui.trade; const k = el.dataset.key; const d = Number(el.dataset.d); t[k].cash = d === 0 ? 0 : t[k].cash + d; done(); return; }
    case 'trade-send': sendTrade(); return;
    case 'trade-accept': S.client.act({ type: 'tradeAccept', id: Number(el.dataset.id), ver: Number(el.dataset.ver) }); return;
    case 'trade-reject': S.client.act({ type: 'tradeReject', id: Number(el.dataset.id) }); return;
    case 'trade-cancel': S.client.act({ type: 'tradeCancel', id: Number(el.dataset.id) }); return;
    case 'trade-counter': {
      const x = v.trades.find((q) => q.id === Number(el.dataset.id)); if (!x) return;
      const t = blankTrade(v.seats.findIndex((q) => q.id === x.from)); t.counterOf = x.id; t.ver = x.ver; t.give = { props: [...x.get.props], cash: x.get.cash }; t.get = { props: [...x.give.props], cash: x.give.cash };
      S.ui.trade = t; S.ui.sheet = 'trade'; done(); return;
    }
    default:
  }
});
document.addEventListener('input', (e) => {
  if (!S.screen || S.screen !== 'game') return;
  const el = e.target;
  if (el.id === 'll-bid') { S.ui.bid = el.value; const b = document.querySelector('[data-act=bid]'); if (b) { b.dataset.amt = el.value; b.textContent = `Bid ${money(Number(el.value) || 0)}`; } }
  if (el.matches('[data-cash]') && S.ui.trade) { const k = el.dataset.key; S.ui.trade[k].cash = Math.max(0, Math.floor(Number(el.value) || 0)); const s = document.querySelector('.trsum p'); if (s) { /* summary refreshes on the next render */ } }
});
document.addEventListener('keydown', (e) => {
  if (!S.screen) return;
  if (e.key === 'Escape' && S.screen === 'game' && (S.ui.sheet || S.ui.confirm)) { closeSheet(); renderGame(); }
  if (e.key === 'Enter' && e.target.id === 'll-bid') { const b = document.querySelector('[data-act=bid]'); if (b) b.click(); }
});

async function copyInvite() {
  const link = inviteLink();
  if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: 'Landlords on Low Stakes', text: `Join my Landlords table ${S.code}`, url: link }); return; } catch {} }
  try { await navigator.clipboard.writeText(link); toast('Invite link copied. Paste it in your group chat.'); }
  catch { const i = document.getElementById('ll-link'); if (i) { i.select(); toast('Press Ctrl+C (or ⌘C) to copy the link.'); } else toast(link); }
}

// A player's browser is closed or reloaded: nothing is sent, the seat is kept by the server. (See LandlordsClient.close.)
window.addEventListener('pagehide', () => { if (S.client) S.client.close(); });
export const lastCode = () => S.code;
export { store, OWNABLE, MAX_SEATS };
