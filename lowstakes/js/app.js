import { Ads } from './ads.js?v=56';
import { Slots } from './adslots.js?v=56';
import { Auth } from './auth.js?v=56';
import { CONFIG } from './config.js?v=56';
import * as AU from './ui/account-ui.js?v=56';
import morphdom from '../vendor/morphdom-esm.js?v=56';
import { Host, Guest, cleanCode, newCode, COLORS, GAME_NAMES, REACTIONS } from './net/room.js?v=56';
import { landing, gate } from './ui/landing.js?v=56';
import { lobby, inviteLink } from './ui/lobby.js?v=56';
import { ServerClient, serverEnabled } from './net/server-client.js?v=56';
import * as HU from './ui/holdem-ui.js?v=56';
import * as BU from './ui/blackjack-ui.js?v=56';
import * as RU from './ui/roulette-ui.js?v=56';
import * as CU from './ui/crash-ui.js?v=56';
import { sound } from './ui/sound.js?v=56';
import { esc, fmt, signed, avatar, chipStack } from './ui/parts.js?v=56';
import { WHEEL } from './games/roulette.js?v=56';
import * as Motion from './ui/motion.js?v=56';

const UIS = { holdem: HU, blackjack: BU, roulette: RU, crash: CU };
const REACT_LABEL = { nice: 'Nice hand', lol: 'Ha!', ouch: 'Ouch', gg: 'GG', bluff: 'Bluff!', wow: 'Wow' };
const app = document.getElementById('app');
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = reduceQuery.matches;
reduceQuery.addEventListener('change', (e) => { reduceMotion = e.matches; });

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const S = {
  me: {
    name: store.get('ls.name') || '',
    color: COLORS[0], // everyone's chips are red for now
  },
  client: null,
  state: null,
  screen: null,
  recvAt: 0,
  gameKey: null,
  seenEv: 0,
  seenChat: 0,
  dockSig: null,
  ui: {
    chatOpen: matchMedia('(min-width: 1180px)').matches,
    unread: 0,
    coach: store.get('ls.coach') === '1',
    pick: 'holdem',
    chip: 25,
    raiseTo: null,
    pop: null,
  },
};

// ---------------------------------------------------------------- routing
function route() {
  const h = location.hash;
  if (S.screen === 'landing' && h && !h.startsWith('#/')) return; // in-page anchors
  const sm = h.match(/^#\/s\/([A-Za-z0-9]{5})/);
  if (sm) {
    const code = cleanCode(sm[1]);
    if (S.client && S.client.code === code) { if (S.screen !== 'table' && S.state) showTable(); return; }
    if (S.client) leave(false);
    if (!serverEnabled()) { showLanding('Wallet tables are not switched on yet.'); return; }
    if (!Auth.ready()) {
      // A returning player's account is still loading at start-up: wait for it before deciding they are signed out.
      if (Auth.signedIn() && !S.authSettled) { showGate(code, { status: 'connecting' }); S.authReady.then(() => route()); return; }
      showLanding('Sign in with Google to join this table.'); AU.openAuth('signin'); return;
    }
    return joinServerTable(code, false);
  }
  const m = h.match(/^#\/t\/([A-Za-z0-9]{5})/);
  if (m) {
    const code = cleanCode(m[1]);
    if (S.client && S.client.code === code) {
      if (S.screen !== 'table' && S.state) showTable();
      return;
    }
    if (S.client) leave(false);
    const snap = hostSnapshot(code);
    if (snap) return startHost({ code, snapshot: snap });
    if (S.closedHost === code) { S.closedHost = null; S.flash = 'That table has closed.'; location.hash = '#/'; return; }
    // Reloaded this tab while sitting at this table: go straight back in.
    let last = null;
    try { last = sessionStorage.getItem('ls.room'); } catch {}
    if (last === code && S.me.name) { joinTable(code); return showGate(code, { status: 'connecting' }); }
    return showGate(code);
  }
  if (S.client) leave(false);
  showLanding();
}

function hostSnapshot(code) {
  try {
    const snap = JSON.parse(store.get('ls.host') || 'null');
    if (snap && snap.code === code && Date.now() - snap.at < 1000 * 60 * 60 * 3) return snap;
  } catch {}
  return null;
}

// ---------------------------------------------------------------- landing + gate
// Full screen hides the browser's bars (more room for the table). It must be asked for from a tap, so it is called from the
// Start / Join / Take a seat buttons on touch screens, and from the Menu's "Full screen" button anywhere.
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function goFullscreen() {
  const el = document.documentElement;
  const rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rq || isFull()) return Promise.resolve(false);
  return Promise.resolve(rq.call(el, { navigationUI: 'hide' })).then(() => {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch {}
    return true;
  }).catch(() => false);
}
function leaveFullscreen() { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {} }
const touchScreen = matchMedia('(pointer: coarse)').matches;

function showLanding(error = '') {
  if (!error && S.flash) error = S.flash;
  S.flash = '';
  S.screen = 'landing';
  document.body.className = 'on-landing';
  document.title = 'Low Stakes';
  app.innerHTML = landing(S.me, { error });
  AU.bindSlot();
  Slots.mount(app);
  Slots.askConsent(() => Slots.mount(document));
  const form = document.getElementById('start-form');
  const code = document.getElementById('code');
  code.addEventListener('input', () => { code.value = cleanCode(code.value); });
  let mode = 'host';
  form.querySelectorAll('button[type=submit]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sound.unlock();
    if (!readMe(form)) return;
    if (touchScreen) goFullscreen();
    const server = serverEnabled() && Auth.ready();
    if (mode === 'join') {
      const c = cleanCode(code.value);
      if (c.length !== 5) { formError('Table codes are five letters and numbers, like K7QXM.'); code.focus(); return; }
      location.hash = `#/${server ? 's' : 't'}/${c}`; // a signed-in player tries a wallet table first, then a friend's browser table
      return;
    }
    if (mode === 'host' && server) { startServerTable(); return; }
    startHost();
  });
}

function showGate(code, opts = {}) {
  S.screen = 'gate';
  document.body.className = 'on-gate';
  document.title = `Join table ${code} · Low Stakes`;
  app.innerHTML = gate(S.me, code, opts);
  const form = document.getElementById('gate-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sound.unlock();
    if (!readMe(form)) return;
    if (touchScreen) goFullscreen();
    joinTable(code);
    showGate(code, { status: 'connecting' });
  });
}

function gateStage({ stage, slow }) {
  const btn = document.querySelector('#gate-form button[type=submit]');
  const note = document.getElementById('form-error');
  if (btn) btn.textContent = stage === 'server' ? 'Contacting the matchmaking server…' : 'Connecting to the host…';
  if (note && slow) {
    note.classList.add('gate-wait');
    note.textContent = stage === 'server'
      ? 'This is taking a while. A VPN, ad blocker or school network can block the connection.'
      : 'Found the table. Still connecting. Make sure the person who started it still has the table open.';
  }
}

// The name at the table is the account username. Signed-out players (browser tables) get a stable guest name.
function readMe() {
  let name = Auth.ready() ? Auth.username() : '';
  if (!name) {
    name = store.get('ls.name');
    if (!name || !/^Guest \d+$/.test(name)) { name = `Guest ${10 + Math.floor(Math.random() * 90)}`; store.set('ls.name', name); }
  }
  S.me = { name, color: COLORS[0] };
  return true;
}

function formError(msg) {
  const el = document.getElementById('form-error');
  if (el) { el.textContent = msg; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
}

// ---------------------------------------------------------------- clients
function startHost({ code, snapshot, bots } = {}) {
  if (!S.me.name) { location.hash = '#/'; return; }
  const host = new Host({ name: S.me.name, color: S.me.color, code, snapshot });
  wire(host);
  if (bots) {
    for (let i = 0; i < 3; i++) host.addBot();
    host.setGame('holdem');
  }
  location.hash = `#/t/${host.code}`;
  if (snapshot) toast('Table restored. Your friends will reconnect automatically.');
}

// A table on the game server: the coins are the player's wallet.
function startServerTable() {
  const code = newCode();
  const client = new ServerClient({ code, create: true });
  wire(client);
  location.hash = `#/s/${code}`;
}

function joinServerTable(code, create) {
  const client = new ServerClient({ code, create });
  client.fromLink = true;
  wire(client);
  showGate(code, { status: 'connecting' });
}

function joinTable(code) {
  try { sessionStorage.setItem('ls.room', code); } catch {}
  const guest = new Guest({ name: S.me.name, color: S.me.color, code });
  wire(guest);
}

function wire(client) {
  S.client = client;
  S.state = null;
  S.gameKey = null;
  S.seenChat = 0;
  S.chatReady = false;
  S.ui.unread = 0;
  client.on('state', (msg) => { if (S.client === client) onState(msg); });
  client.on('status', (st) => { if (S.client === client) onStatus(st); });
  client.on('react', (msg) => { if (S.client === client) showReaction(msg); });
  client.on('notice', (n) => { if (S.client === client && n && n.text) toast(n.text); });
  client.on('stage', (st) => { if (S.client === client && S.screen === 'gate') gateStage(st); });
}

function onStatus(st) {
  const c = S.client;
  if (!c) return;
  if (c.isServer) return onServerStatus(c, st);
  if (!c.isHost) {
    if (st === 'notfound' && S.screen !== 'table') {
      const code = c.code;
      leave(false);
      showGate(code, { error: `There's no open table with code ${code}. Check the code, or ask the host to keep their tab open.` });
      return;
    }
    if (st === 'noserver' && S.screen !== 'table') {
      const code = c.code; leave(false);
      showGate(code, { error: 'Couldn’t reach the matchmaking server. A VPN, ad blocker or school/work network may be blocking it. Turn those off or switch to mobile data, then try again.' });
      return;
    }
    if (st === 'unreachable' && S.screen !== 'table') {
      const code = c.code; leave(false);
      showGate(code, { error: 'Found the table, but couldn’t connect to the host’s browser. Usually one of your networks is blocking it. Try turning off any VPN, or have one of you switch to mobile data, then try again.' });
      return;
    }
    if (st === 'full') {
      const code = c.code; const info = c.fullInfo || {};
      leave(false);
      showGate(code, { error: info.game ? `That ${GAME_NAMES[info.game]} table is full (${info.limit} players). Ask the host to make room.` : `That table is full (${info.limit || 12} players).` });
      return;
    }
    if (st === 'offline' && S.screen !== 'table') { const code = c.code; leave(false); showGate(code, { error: 'Couldn’t reach the matchmaking server. Check your connection and try again.' }); return; }
    if (st === 'kicked') { leave(false); location.hash = '#/'; toast('The host removed you from the table.'); return; }
    if (st === 'closed') { if (S.screen === 'table') renderClosed(); return; }
  }
  if (S.screen === 'table') renderBanner();
}

function onServerStatus(c, st) {
  const code = c.code;
  // Leave the table, go home, and show the reason on the landing page (the message survives the navigation).
  const back = (msg) => { leave(false); S.flash = msg || ''; if (location.hash === '#/') showLanding(); else location.hash = '#/'; };
  if (st === 'notfound') {
    // No wallet table has this code: it may be a friend's table running in their browser.
    leave(false);
    location.hash = `#/t/${code}`;
    return;
  }
  if (st === 'signin') { leave(false); location.hash = '#/'; AU.openAuth('signin', { message: 'Please sign in again to join a table.' }); return; }
  if (st === 'unregistered') { leave(false); location.hash = '#/'; AU.openProfile(); return; }
  if (st === 'elsewhere') { back('You are already at another table. Leave it first (or wait about a minute if you just closed it), then try again.'); return; }
  if (st === 'full') {
    const info = c.fullInfo || {};
    back(info.game ? `That ${GAME_NAMES[info.game]} table is full (${info.limit} players).` : `That table is full (${info.limit || 12} players).`);
    return;
  }
  if (st === 'noserver' || st === 'rejected') { back('Could not reach the game server. Check your connection and try again.'); return; }
  if (st === 'kicked') { leave(false); location.hash = '#/'; toast('The table owner removed you from the table.'); return; }
  if (st === 'closed') { if (S.screen === 'table') renderClosed(); return; }
  if (S.screen === 'table') renderBanner();
}

function leave(navigate = true) {
  const wasServer = !!(S.client && S.client.isServer);
  if (S.client && S.client.isHost) S.closedHost = S.client.code; // a table this browser was running and has now closed
  if (S.client) S.client.close();
  // coins won or lost at a wallet table are saved by the server; pick up the new balance once it has had a moment
  if (wasServer && Auth.signedIn()) setTimeout(() => Auth.loadAccount().catch(() => {}), 900);
  try { sessionStorage.removeItem('ls.room'); } catch {}
  S.client = null;
  S.state = null;
  S.screen = null;
  closePop();
  if (navigate) location.hash = '#/';
}

// ---------------------------------------------------------------- table
function onState(msg) {
  S.state = { you: msg.you, room: msg.room, game: msg.game };
  S.recvAt = performance.now();
  if (S.screen !== 'table') showTable();
  else renderTable();
}

const ICON = {
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M17 9l5 6M22 9l-5 6" fill="none"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  scores: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11h4v9zM10 20V5h4v15zM15 20v-7h4v7z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};

function showTable() {
  S.screen = 'table';
  document.body.className = 'on-table';
  app.innerHTML = `
<div class="room${S.ui.chatOpen ? ' chat-open' : ''}" id="room">
  <header class="r-top" id="r-top"></header>
  <div class="r-main">
    <main class="stage" id="stage"></main>
    <aside class="chat" id="chat" aria-label="Table chat">
      <div class="chat-head"><h2>Table talk</h2><button class="icon-btn" data-act="chat" aria-label="Close chat">×</button></div>
      <ol class="chat-list" id="chat-list"></ol>
      <div class="reacts" role="group" aria-label="Quick reactions">${REACTIONS.map((r) => `<button data-act="react" data-r="${r}">${REACT_LABEL[r]}</button>`).join('')}</div>
      <div class="ad-slot" data-slot="rail" data-static hidden></div>
      <form class="chat-form" id="chat-form"><input id="chat-input" maxlength="240" placeholder="Say something nice. Or don't." autocomplete="off" aria-label="Chat message"><button class="btn btn-dark btn-sm">Send</button></form>
    </aside>
  </div>
  <div class="dock" id="dock"></div>
  <div class="banner" id="banner" role="status"></div>
  <div class="rotate-gate" role="alert">
    <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="6" width="20" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M30 37h4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 50c6 8 22 10 34 2m0 0l-7-1m7 1l-1-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <h2>Turn your phone sideways</h2>
    <p>The tables are built for landscape: a bigger table, bigger buttons and room for everything.</p>
    <button class="btn btn-quiet btn-sm" data-act="leave">Leave the table</button>
  </div>
</div>
<div class="fx" id="fx" aria-hidden="true"></div>
<div id="pop"></div>`;
  S.dockSig = null;
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) S.client.say(text);
    input.value = '';
  });
  renderTable();
}

function headerHtml() {
  const { room, game } = S.state;
  const isHost = room.hostId === S.state.you;
  let sub = '';
  if (game && game.game === 'holdem') sub = `Blinds ${game.settings.sb}/${game.settings.bb}`;
  if (game && game.game === 'blackjack') sub = `Minimum bet ${game.settings.min}`;
  if (game && game.game === 'roulette') sub = 'Single zero';
  if (game && game.game === 'crash') sub = `Minimum bet ${game.settings.min}`;
  const me = room.players.find((p) => p.id === S.state.you);
  return `
    <a class="wordmark sm" href="#/" data-act="leave" aria-label="Leave and go home"><span>Low</span><span>Stakes</span></a>
    <button class="code-pill" data-act="copy-link" title="Copy the invite link"><span>Table</span><b>${esc(room.code)}</b><em>Copy invite</em></button>
    <p class="r-title">${room.gameId ? esc(GAME_NAMES[room.gameId]) : 'Lobby'}${sub ? `<span>${sub}</span>` : ''}</p>
    <div class="r-tools">
      ${me ? `<span class="my-stack">${avatar(me, 'xs')}<b>${fmt(me.chips)}</b></span>` : ''}
      <button class="tool tool-scores" data-act="scores" aria-label="Scores">${ICON.scores}<span>Scores</span></button>
      <button class="tool tool-sound" data-act="sound" aria-label="${sound.on ? 'Mute sounds' : 'Turn sounds on'}" aria-pressed="${sound.on}">${sound.on ? ICON.sound : ICON.mute}<span>Sound</span></button>
      <button class="tool" data-act="chat" aria-label="Chat" aria-expanded="${S.ui.chatOpen}">${ICON.chat}<span>Chat</span>${S.ui.unread ? `<i class="badge">${S.ui.unread}</i>` : ''}</button>
      ${isHost ? `<button class="tool tool-menu" data-act="menu" aria-label="Table menu">${ICON.menu}<span>Table</span></button>` : ''}
      <button class="tool tool-leave" data-act="leave">Leave</button>
      <button class="tool tool-more" data-act="more" aria-label="More options" aria-haspopup="dialog">${ICON.menu}</button>
    </div>`;
}

const morphOpts = {
  onBeforeElUpdated(from, to) {
    if (from.dataset && from.dataset.static) return false;
    return !from.isEqualNode(to);
  },
};

function renderTable() {
  if (!S.state || S.screen !== 'table') return;
  const { room, game } = S.state;
  const stage = document.getElementById('stage');
  document.title = `${room.gameId ? GAME_NAMES[room.gameId] : 'Lobby'} · Table ${room.code}`;

  morphdom(document.getElementById('r-top'), `<header class="r-top" id="r-top">${headerHtml()}</header>`, morphOpts);

  // A different game (or our first look at this one): don't replay old events.
  const key = `${room.gameId}:${room.gameSeq}`;
  const fresh = key !== S.gameKey;
  if (fresh) {
    S.gameKey = key;
    S.seenEv = game ? Math.max(0, ...game.events.map((e) => e.id)) : 0;
    S.dockSig = null;
    S.ui.raiseTo = null;
    stage.classList.add('instant');
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('instant')));
  }
  const newEvents = game ? game.events.filter((e) => e.id > S.seenEv) : [];
  if (newEvents.length) S.seenEv = newEvents[newEvents.length - 1].id;

  preEffects(newEvents);
  const isBJ = !!game && game.game === 'blackjack';
  const cardsBefore = isBJ && newEvents.length ? Motion.snapshot(stage) : null;
  const newCards = [];
  const html = game ? UIS[game.game].stage(game, S.state, S.ui) : lobby(S.state, S.ui);
  morphdom(stage, `<main class="stage" id="stage" data-game="${room.gameId || 'lobby'}">${html}</main>`, {
    ...morphOpts,
    onBeforeElUpdated(from, to) {
      if (from.dataset && from.dataset.static) return false;
      if (from.id && from.id.startsWith('ring-') && to.id === from.id) return false;
      // keep the "instant" class while we're suppressing first-paint animation
      if (from === stage) { to.className = from.className.includes('instant') ? 'stage instant' : 'stage'; }
      return !from.isEqualNode(to);
    },
    onNodeAdded(node) {
      if (isBJ && node.nodeType === 1 && node.classList.contains('card') && node.id) newCards.push(node);
      return node;
    },
  });
  if (isBJ && cardsBefore) {
    // A split moves a card from one hand to the other: tell the animator where it came from.
    const moves = {};
    for (const ev of newEvents) {
      if (ev.type === 'split') moves[`bj${game.round}-${ev.pid}-${ev.to}-0`] = `bj${game.round}-${ev.pid}-${ev.from}-1`;
    }
    Motion.afterRender({ root: stage, before: cardsBefore, added: newCards, moves });
  }
  postEffects(newEvents);
  if (game && game.game === 'roulette') wheelLoop();
  if (game && game.game === 'crash') CU.crashLoop(() => S.state && S.state.game);

  // Action dock
  const dockEl = document.getElementById('dock');
  let d;
  if (game) d = UIS[game.game].dock(game, S.state, S.ui);
  else d = lobbyDock();
  if (d.sig !== S.dockSig) {
    S.dockSig = d.sig;
    dockEl.innerHTML = d.html;
    dockEl.className = `dock${game && game.you && game.you.myTurn ? ' my-turn' : ''}`;
    dockEl.dataset.game = room.gameId || '';
    bindDock();
  }

  renderChat();
  Slots.mount(document);
  renderBanner();
  if (S.ui.pop) renderPop();
}

function lobbyDock() {
  const { room, you } = S.state;
  const host = room.players.find((p) => p.id === room.hostId);
  const me = room.players.find((p) => p.id === you);
  const sig = `lobby:${room.hostId === you}:${me ? me.chips : 0}`;
  const note = room.hostId === you ? 'Pick a game above and deal when everyone’s here.' : `Waiting for ${esc(host ? host.name : 'the host')} to deal.`;
  return { sig, html: `<div class="dock-hand">${me ? `<span>Your chips</span><b>${fmt(me.chips)}</b>` : ''}</div><div class="dock-mid"><p class="dock-note">${note}</p></div><div class="dock-side"></div>` };
}

function bindDock() {
  const range = document.getElementById('raise-range');
  if (range) {
    const amt = document.getElementById('raise-amt');
    const sync = () => { S.ui.raiseTo = Number(range.value); amt.textContent = fmt(range.value); };
    range.addEventListener('input', sync);
    sync();
  }
}

function renderChat() {
  const list = document.getElementById('chat-list');
  if (!list) return;
  const chat = S.state.room.chat;
  const newest = chat.length ? chat[chat.length - 1].id : 0;
  if (newest > S.seenChat) {
    const fresh = chat.filter((m) => m.id > S.seenChat && m.pid);
    if (S.chatReady && fresh.length) {
      const others = fresh.filter((m) => m.pid !== S.state.you);
      if (others.length) {
        if (!S.ui.chatOpen) { S.ui.unread += others.length; morphdom(document.getElementById('r-top'), `<header class="r-top" id="r-top">${headerHtml()}</header>`, morphOpts); }
        sound.play('message');
      }
      for (const m of fresh) speech(m.pid, m.text); // a short bubble over the sender, you included
    }
    S.seenChat = newest;
  }
  S.chatReady = true; // from now on new messages get a bubble (the very first one included)
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  morphdom(list, `<ol class="chat-list" id="chat-list">${chat.map((m) => m.pid
    ? `<li id="m${m.id}" class="msg${m.pid === S.state.you ? ' own' : ''}"><b style="--c:${esc(m.color)}">${esc(m.name)}</b> ${esc(m.text)}</li>`
    : `<li id="m${m.id}" class="msg sys">${esc(m.text)}</li>`).join('')}</ol>`);
  if (atBottom) list.scrollTop = list.scrollHeight;
}

function renderBanner() {
  const el = document.getElementById('banner');
  if (!el || !S.client) return;
  const st = S.client.status;
  let msg = '';
  if (S.client.isServer && st === 'reconnecting') msg = 'Lost the connection to the game server. Reconnecting…';
  else if (!S.client.isHost && st === 'reconnecting') msg = 'Lost the connection to the host. Reconnecting…';
  if (S.client.isHost && st === 'reconnecting') msg = 'Lost the matchmaking server. Players already here can keep playing; reconnecting…';
  if (S.client.isHost && st === 'offline' && S.state && S.state.room.gameId) msg = 'Offline: friends can’t join right now, but bots can still play.';
  el.textContent = msg;
  el.classList.toggle('on', !!msg);
}

function renderClosed() {
  const el = document.getElementById('banner');
  if (!el) return;
  el.innerHTML = 'The host closed the table. <a href="#/" class="btn btn-primary btn-sm">Start your own</a>';
  el.classList.add('on', 'closed');
  const dock = document.getElementById('dock');
  if (dock) dock.innerHTML = '';
}

// ---------------------------------------------------------------- popovers
function closePop() { S.ui.pop = null; const p = document.getElementById('pop'); if (p) p.innerHTML = ''; }

function renderPop() {
  const pop = document.getElementById('pop');
  if (!pop || !S.state) return;
  const { room, you, game } = S.state;
  let body = '';
  if (S.ui.pop === 'scores') {
    const rows = [...room.players].sort((a, b) => b.net - a.net).map((p, i) => `
      <tr class="${p.id === you ? 'me' : ''}"><td class="rank">${i + 1}</td><td>${avatar(p, 'xs')} ${esc(p.name)}${p.bot ? ' <em>bot</em>' : ''}</td>
      <td class="num">${fmt(p.chips)}</td><td class="num ${p.net > 0 ? 'up' : p.net < 0 ? 'down' : ''}">${p.net ? signed(p.net) : 'even'}</td><td class="num">${p.buyins}</td></tr>`).join('');
    body = `<h2>Scores</h2><table class="scores"><thead><tr><th></th><th>Player</th><th class="num">Chips</th><th class="num">Up/down</th><th class="num">Buy-ins</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="pop-note">Up/down counts every buy-in, so it's the fair way to see who's actually winning.</p>`;
  } else if (S.ui.pop === 'more') {
    const isHost = room.hostId === you;
    body = `<h2>Menu</h2>
      <div class="more-list">
        <button class="btn btn-quiet" data-act="scores">Scores</button>
        <button class="btn btn-quiet" data-act="sound">Sound: ${sound.on ? 'on' : 'off'}</button>
        <button class="btn btn-quiet" data-act="fullscreen">${isFull() ? 'Exit full screen' : 'Full screen'}</button>
        <button class="btn btn-quiet" data-act="copy-link">Copy invite link</button>
        ${isHost ? '<button class="btn btn-quiet" data-act="menu">Table options</button>' : ''}
        <button class="btn btn-quiet danger" data-act="leave">Leave table</button>
      </div>`;
  } else if (S.ui.pop === 'menu') {
    const paused = game && game.paused;
    body = `<h2>Table</h2>
      <div class="menu-list">
        ${room.gameId ? '<button class="btn btn-quiet btn-sm" data-act="to-lobby">Back to the lobby</button>' : ''}
        ${game && game.game === 'holdem' ? `<button class="btn btn-quiet btn-sm" data-act="pause">${paused ? 'Resume dealing' : 'Pause after this hand'}</button>` : ''}
        <button class="btn btn-quiet btn-sm" data-act="add-bot"${room.players.length >= room.limit ? ' disabled' : ''}>Add a bot</button>
      </div>
      ${room.players.length >= room.limit ? `<p class="pop-note" role="status">${room.gameId ? `${GAME_NAMES[room.gameId]} seats ${room.limit} and every seat is taken.` : 'The table is full.'}</p>` : ''}
      <h3>Players</h3>
      <ul class="menu-players">${room.players.map((p) => `<li>${avatar(p, 'xs')} <span>${esc(p.name)}${p.bot ? ' <em>bot</em>' : !p.connected ? ' <em>away</em>' : ''}</span>${p.id !== you ? `<button class="link-btn" data-act="remove" data-pid="${esc(p.id)}">Remove</button>` : '<em>you</em>'}</li>`).join('')}</ul>`;
  }
  pop.innerHTML = body ? `<div class="pop-scrim" data-act="close-pop"></div><div class="pop" role="dialog" aria-label="${S.ui.pop}">${body}<button class="icon-btn pop-x" data-act="close-pop" aria-label="Close">×</button></div>` : '';
}

// ---------------------------------------------------------------- actions
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (el.tagName === 'INPUT') return; // handled on change
  sound.unlock();
  const c = S.client;
  const game = S.state && S.state.game;
  const you = S.state && S.state.game && S.state.game.you;
  switch (act) {
    case 'leave':
      e.preventDefault();
      if (c && c.isHost && S.state && S.state.room.players.some((p) => !p.bot && p.connected && p.id !== S.state.you)) {
        if (!confirm('Leaving closes the table for everyone. Leave anyway?')) return;
      }
      leave();
      return;
    case 'copy-link': closePop(); copyInvite(); return;
    case 'sound': sound.toggle(); renderTable(); return;
    case 'fullscreen': if (isFull()) leaveFullscreen(); else goFullscreen(); closePop(); return;
    case 'chat':
      S.ui.chatOpen = !S.ui.chatOpen;
      S.ui.unread = 0;
      document.getElementById('room').classList.toggle('chat-open', S.ui.chatOpen);
      renderTable();
      if (S.ui.chatOpen && matchMedia('(min-width: 700px)').matches) document.getElementById('chat-input').focus();
      return;
    case 'scores': case 'menu': case 'more': S.ui.pop = S.ui.pop === act ? null : act; S.ui.pop ? renderPop() : closePop(); return;
    case 'close-pop': closePop(); return;
    case 'react': c.emote(el.dataset.r); return;
    case 'free-coins': AU.openFreeCoins(); return;
    case 'rebuy': {
      // With an ad network connected the refill is a rewarded ad; otherwise it is the free rebuy.
      if (!Ads.enabled()) { c.requestRebuy(); return; }
      if (S.adBusy) return;
      S.adBusy = true;
      el.disabled = true;
      Ads.showRewarded(() => dialog({
        title: 'Watch a short ad to refill?',
        body: 'Ads are how Low Stakes stays free. This is the only place you will ever see one. The ad is requested without personalisation, and you can stop at any time. If it does not finish, you get no chips.',
        yes: 'Watch the ad', no: 'Not now',
      })).then((ok) => {
        S.adBusy = false;
        el.disabled = false;
        if (ok) { c.requestRebuy(); toast('Thanks for watching. Chips added.'); } else toast('No ad finished, so no chips this time.');
      });
      return;
    }
    // lobby / host
    case 'pick': S.ui.pick = el.dataset.game; renderTable(); return;
    case 'start-game': { const r = c.setGame(S.ui.pick); if (r && !r.ok) toast(r.message); return; }
    case 'add-bot': { const r = c.addBot(S.state.room.gameId ? undefined : S.ui.pick); if (r && !r.ok) toast(r.message); return; }
    case 'remove': c.removePlayer(el.dataset.pid); return;
    case 'to-lobby': closePop(); c.endGame(); return;
    case 'pause': c.setPaused(!(game && game.paused)); closePop(); return;
    // hold'em
    case 'fold': case 'check': case 'call': c.act({ type: act }); return;
    case 'raise': c.act({ type: 'raise', to: S.ui.raiseTo }); return;
    case 'preset': {
      const r = document.getElementById('raise-range');
      if (r) { r.value = el.dataset.to; r.dispatchEvent(new Event('input')); }
      return;
    }
    case 'show': c.act({ type: 'show' }); return;
    // blackjack
    case 'bj-add': {
      S.chipSrc = { ...centre(el.getBoundingClientRect()), t: performance.now() };
      c.act({ type: 'add', amount: Number(el.dataset.v) });
      return;
    }
    case 'bj-clear': c.act({ type: 'bet', amount: 0 }); return;
    case 'bj-rebet': { const seat = game.seats.find((s) => s.pid === S.state.you); c.act({ type: 'bet', amount: seat.lastBet }); return; }
    case 'bj-ready': c.act({ type: 'ready' }); return;
    case 'bj-insure': c.act({ type: 'insure' }); return;
    case 'bj-decline': c.act({ type: 'decline' }); return;
    case 'bj-hit': case 'bj-stand': case 'bj-double': case 'bj-split': c.act({ type: act.slice(3) }); return;
    // crash
    case 'cr-add': S.chipSrc = { ...centre(el.getBoundingClientRect()), t: performance.now() }; c.act({ type: 'add', amount: Number(el.dataset.v) }); return;
    case 'cr-clear': case 'cr-rebet': case 'cr-ready': case 'cr-unready': c.act({ type: act.slice(3) }); return;
    case 'cr-cash': c.act({ type: 'cashout' }); return;
    // roulette
    case 'rl-chip': S.ui.chip = Number(el.dataset.v); S.dockSig = null; renderTable(); return;
    case 'rl-bet':
      if (game && game.phase === 'betting' && you && !you.ready) { c.act({ type: 'bet', spot: el.dataset.spot, amount: S.ui.chip }); sound.play('chip'); }
      return;
    case 'rl-undo': case 'rl-clear': case 'rl-rebet': case 'rl-double': case 'rl-ready': case 'rl-unready':
      c.act({ type: act.slice(3) });
      // Pressing Spin takes you straight to the big wheel (it waits there for the other players, then spins).
      if (act === 'rl-ready' && game && game.phase === 'betting' && you && you.total) openSpinView(null, null, true);
      if (act === 'rl-unready' && SV.early) closeSpinView(true);
      return;
    default:
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!S.client) return;
  if (el.matches('[data-act=sitout]')) S.client.act({ type: 'sitout', on: el.checked });
  if (el.matches('[data-act=cr-auto]')) S.client.act({ type: 'auto', x: el.value === '' ? null : Number(el.value) });
  if (el.matches('[data-act=coach]')) { S.ui.coach = el.checked; store.set('ls.coach', el.checked ? '1' : '0'); S.dockSig = null; renderTable(); }
  if (el.matches('[data-set]')) {
    const path = el.dataset.set;
    if (path === 'holdem.blinds') {
      const [sb, bb] = el.value.split('/').map(Number);
      S.client.updateSettings({ holdem: { sb, bb } });
    } else if (path === 'start') S.client.updateSettings({ start: Number(el.value) });
    else {
      const [g, k] = path.split('.');
      S.client.updateSettings({ [g]: { [k]: Number(el.value) } });
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.ui.pop) { closePop(); return; }
  if (S.screen !== 'table' || !S.state || !S.state.game) return;
  if (e.target.closest('input, textarea, select') && e.target.type !== 'range') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const map = {
    holdem: { f: 'fold', c: ['check', 'call'], r: 'raise' },
    blackjack: { h: 'bj-hit', s: 'bj-stand', d: 'bj-double', p: 'bj-split', y: 'bj-insure', n: 'bj-decline', enter: 'bj-ready' },
    roulette: { enter: 'rl-ready' },
    crash: { enter: ['cr-cash', 'cr-ready'], ' ': ['cr-cash', 'cr-ready'], c: 'cr-cash' },
  }[S.state.game.game];
  let target = map && map[k];
  if (!target) return;
  if (Array.isArray(target)) target = target.find((t) => document.querySelector(`#dock [data-act="${t}"]`));
  const btn = document.querySelector(`#dock [data-act="${target}"]`);
  if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
});

async function copyInvite() {
  const link = inviteLink(S.state.room.code, S.state.room.server);
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: 'Low Stakes', text: `Pull up a chair: table ${S.state.room.code}`, url: link }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(link); toast('Invite link copied. Paste it in the group chat.'); }
  catch {
    const input = document.getElementById('invite-link');
    if (input) { input.select(); toast('Press Ctrl+C (or ⌘C) to copy the link.'); }
    else toast(link);
  }
}

let toastTimer = 0;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3200);
}

// ---------------------------------------------------------------- effects
function rectOf(el) { return el ? el.getBoundingClientRect() : null; }
function centre(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

function fly(html, from, to, { dur = 700, delay = 0, cls = '', lift = 30 } = {}) {
  if (reduceMotion || !from || !to) return;
  const fx = document.getElementById('fx');
  if (!fx) return;
  const el = document.createElement('div');
  el.className = `flyer ${cls}`;
  el.innerHTML = html;
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  fx.appendChild(el);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // A gentle arc: the chips lift a little on the way, like they're being pushed across felt.
  const anim = el.animate([
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.06 },
    { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - lift}px)) scale(1.08)`, opacity: 1, offset: 0.5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.9 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9)`, opacity: 0 },
  ], { duration: dur, delay, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'both' });
  anim.onfinish = () => el.remove();
}

function feltCentre() {
  const pot = document.getElementById('pot');
  if (pot && pot.children.length) return centre(rectOf(pot));
  const felt = document.querySelector('.felt');
  return felt ? centre(rectOf(felt)) : null;
}

function preEffects(events) {
  if (!events.some((e) => e.type === 'collect')) return;
  const to = feltCentre();
  document.querySelectorAll('#stage .bet').forEach((b, i) => {
    const stack = b.querySelector('.stack');
    if (stack) fly(stack.outerHTML, centre(rectOf(b)), to, { dur: 750, delay: i * 70, lift: 14 });
  });
}

function postEffects(events) {
  const you = S.state.you;
  const game = S.state.game;
  let cardSounds = 0;
  for (const ev of events) {
    switch (ev.type) {
      case 'deal': {
        if (game.game === 'holdem') {
          const n = game.seats.filter((s) => s.inHand).length * 2;
          for (let i = 0; i < n; i++) setTimeout(() => sound.play('card'), 80 + i * HU.DEAL_GAP);
          setTimeout(() => sound.play('flip'), n * HU.DEAL_GAP + 900);
        } else {
          for (let i = 0; i < 2; i++) setTimeout(() => sound.play('card'), i * 110);
        }
        break;
      }
      case 'board': {
        if (ev.street === 'flop') {
          sound.play('card');
          setTimeout(() => sound.play('fold'), 420);
          for (let i = 0; i < 3; i++) setTimeout(() => sound.play('flip'), 1150 + i * 260);
        } else {
          sound.play('card');
          setTimeout(() => sound.play('flip'), 700);
        }
        break;
      }
      case 'card': if (cardSounds++ < 3) sound.play('card'); break;
      case 'chip':
        sound.play('chip');
        if (game.game === 'blackjack') bjChipFlight(ev);
        else if (game.game === 'holdem') hdBetPop(ev);
        break;
      case 'check': sound.play('check'); break;
      case 'fold': sound.play('fold'); break;
      case 'collect': sound.play('collect'); break;
      case 'peek':
        if (game.game === 'blackjack') { Motion.dealerPeek(document.getElementById('stage'), BJ_PEEK_MS); sound.play('tension'); }
        break;
      case 'split': sound.play('slide'); break;
      case 'stand': if (game.game === 'blackjack') bjStand(ev); break;
      case 'reveal': {
        if (game.game === 'blackjack') { Motion.dealerReveal(document.getElementById('stage'), BJ_FLIP_MS); sound.play('hole'); break; }
        const n = game.seats ? game.seats.filter((s) => s.inHand && !s.folded).length : 1;
        for (let i = 0; i < n; i++) setTimeout(() => sound.play('flip'), i * 380);
        break;
      }
      case 'show': sound.play('flip'); break;
      case 'bust': sound.play('bust'); break;
      case 'blackjack': sound.play('blackjack'); break;
      case 'shuffle': sound.play('shuffle'); break;
      case 'turn':
        if (ev.pid === you) {
          sound.play('turn');
          if (navigator.vibrate && document.hidden === false) try { navigator.vibrate(30); } catch {}
          if (document.hidden) flashTitle('Your turn');
        }
        break;
      case 'win': {
        // At a showdown, wait for every hand to turn over before pushing the pot.
        const shown = ev.showdown && game.seats ? game.seats.filter((s) => s.handName).length : 0;
        const wait = ev.showdown ? 900 + shown * 380 : 350;
        const from = feltCentre();
        setTimeout(() => {
          if (!S.state || !S.state.game || S.state.game.handNo !== game.handNo) return;
          sound.play(ev.pids.includes(you) ? 'win' : 'collect');
          ev.pids.forEach((pid, i) => {
            const seat = document.querySelector(`#stage [data-seat="${CSS.escape(pid)}"] .plate`);
            fly(chipStack(Math.max(1, Math.round(ev.amount / ev.pids.length)), 6), from, seat && centre(rectOf(seat)), { dur: 1100, delay: i * 140, lift: 40 });
          });
        }, wait);
        break;
      }
      case 'settle':
        if (ev.pids.includes(you)) sound.play('win');
        if (game.game === 'blackjack') bjSettleFx(game);
        break;
      case 'spin': if (game && game.game === 'roulette') startSpin(game); break;
      case 'launch': sound.play('whoosh'); break;
      case 'cashout':
        if (ev.pid === you) sound.play('win'); else sound.play('chip');
        break;
      case 'crash': {
        const mine = game.bets && game.bets.find((b) => b.pid === you);
        sound.play('boom');
        if (mine && mine.cashed === null) setTimeout(() => sound.play('bust'), 220);
        break;
      }
      case 'land': {
        if (game.game === 'roulette') {
          const bet = game.bets.some((b) => b.pid === you);
          const r = { n: ev.n, net: (game.net || {})[you] || 0, bet };
          // Wait for the ball to actually stop on this screen before revealing.
          if (W.spin) W.pending = r; else revealSpin(r);
        }
        break;
      }
      default:
    }
  }
}

function showReaction(msg) {
  sound.play('react');
  speech(msg.pid, REACT_LABEL[msg.r] || msg.r, true);
}

// A short bubble over a player's seat. It follows the seat while the table scrolls or resizes, and hides if the seat is
// scrolled out of view, so it always stays on top of the name of whoever spoke.
function speech(pid, text, isReact = false) {
  const fx = document.getElementById('fx');
  if (!fx) return;
  const sel = `#stage [data-seat="${CSS.escape(pid)}"], #stage [data-pid="${CSS.escape(pid)}"]`;
  if (!document.querySelector(sel)) return;
  const el = document.createElement('div');
  el.className = `bubble${isReact ? ' react' : ''}`;
  el.textContent = text.length > 44 ? `${text.slice(0, 42)}…` : text;
  fx.appendChild(el);
  let raf = 0;
  const place = () => {
    const anchor = document.querySelector(sel);
    const area = document.getElementById('stage');
    if (!anchor || !area || !el.isConnected) { el.remove(); return; }
    const r = anchor.getBoundingClientRect();
    const v = area.getBoundingClientRect();
    const inView = r.bottom > v.top + 4 && r.top < v.bottom - 4 && r.right > v.left && r.left < v.right;
    el.style.left = `${Math.min(Math.max(r.left + r.width / 2, v.left + 40), v.right - 40)}px`;
    el.style.top = `${Math.max(r.top, v.top + 24)}px`;
    el.style.visibility = inView ? '' : 'hidden';
    raf = requestAnimationFrame(place);
  };
  place();
  const life = isReact ? 1800 : 3200;
  setTimeout(() => el.classList.add('out'), life);
  setTimeout(() => { cancelAnimationFrame(raf); el.remove(); }, life + (isReact ? 500 : 500));
}

let titleTimer = 0;
function flashTitle(text) {
  clearInterval(titleTimer);
  const base = document.title;
  let on = false;
  titleTimer = setInterval(() => {
    if (!document.hidden) { clearInterval(titleTimer); document.title = base; return; }
    document.title = (on = !on) ? `● ${text}` : base;
  }, 900);
}

// ---------------------------------------------------------------- roulette wheel
// The pocket the ball lands in is chosen by the game (view.result) before any of this runs.
// Here we only decide how to *show* it: the ball's angle is the wheel's angle plus an angle
// relative to the wheel, and that relative angle is built to decay to exactly the chosen pocket
// at the moment the spin ends. Wheel and ball both slow down; timing can't change the result.
const SEG = 360 / 37;
const TRACK_R = 91; // ball running on the outer track
const POCKET_R = 73; // ball sitting in a pocket
const DROP_FROM = 0.58; // fraction of the spin at which the ball leaves the track
const DROP_TO = 0.8; // ...and is settled in its pocket
const W = { angle: 0, ball: 0, r: TRACK_R, spin: null, raf: 0, last: 0, pocket: null, vel: 0, pending: null, timers: [], els: null };

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeInOut = (x) => x * x * (3 - 2 * x);

function startSpin(view) {
  const idx = WHEEL.indexOf(view.result);
  const total = view.spinMs;
  const left = view.spinLeft || total;
  const t0 = performance.now() - (total - left);
  W.spin = {
    t0, total, idx,
    w0: W.angle,
    wTotal: 560 + Math.random() * 90, // degrees the wheel turns while it slows to a stop
    turns: 7 + Math.floor(Math.random() * 2), // laps the ball makes relative to the wheel
    seed: Math.random() * Math.PI * 2,
  };
  W.pocket = null;
  W.pending = null;
  sound.play('spin', { ms: left });
  // The ball clatters off the studs and frets as it falls: one knock per hop.
  W.timers.forEach(clearTimeout);
  W.timers = [0.6, 0.665, 0.725, 0.785].map((p, i) => ({ i, at: t0 + p * total - performance.now() })).filter((k) => k.at > 0).map((k) => setTimeout(() => sound.play('bounce', { n: k.i }), k.at));
  if (left > 2500) openSpinView(total, left);
}

function wheelEls() {
  if (!W.els || W.els.some((w) => !w.rotor.isConnected)) {
    W.els = [...document.querySelectorAll('.wheel')].map((root) => ({
      root,
      rotor: root.querySelector('.wl-rotor'),
      ball: root.querySelector('.ball'),
      shadow: root.querySelector('.ball-shadow'),
      trails: [...root.querySelectorAll('.trail')],
    })).filter((w) => w.rotor && w.ball);
  }
  return W.els;
}

function wheelLoop() {
  if (W.raf) return;
  W.last = performance.now();
  const frame = (t) => {
    const wheels = wheelEls();
    if (!wheels.length || !S.state || !S.state.game || S.state.game.game !== 'roulette') { W.raf = 0; W.els = null; closeSpinView(true); return; }
    const dt = Math.max(1, t - W.last);
    W.last = t;
    const game = S.state.game;
    const prev = W.ball;
    if (W.spin) {
      const sp = W.spin;
      const p = clamp01((t - sp.t0) / sp.total);
      W.angle = sp.w0 + sp.wTotal * (1 - (1 - p) ** 3); // ease-out: friction slows the wheel
      const rel = sp.idx * SEG + (1 - p) ** 3 * sp.turns * 360; // ball laps against the wheel, slowing as it goes
      const d = clamp01((p - DROP_FROM) / (DROP_TO - DROP_FROM));
      const env = d * (1 - d) * 4; // 0 at both ends of the fall, so the ball is never displaced at the start or the end
      const hop = Math.sin(d * Math.PI * 3.1 + sp.seed) * env * (1 - d) * 1.7 * SEG; // skips across a few pockets
      const bounce = Math.abs(Math.sin(d * Math.PI * 3.6)) * env * (1 - d) * 5; // and bounces off the frets
      W.r = TRACK_R + (POCKET_R - TRACK_R) * easeInOut(d) - bounce;
      W.ball = W.angle + rel + hop;
      if (p >= 1) { W.pocket = sp.idx; W.spin = null; W.ball = W.angle + sp.idx * SEG; W.r = POCKET_R; }
    } else {
      if (!reduceMotion) W.angle += dt * 0.008;
      if (W.pocket == null && game.history && game.history.length) W.pocket = WHEEL.indexOf(game.history[0]);
      if (W.pocket != null) { W.ball = W.angle + W.pocket * SEG; W.r = POCKET_R; } else { W.r = TRACK_R; }
    }
    W.vel = W.spin ? (W.ball - prev) / dt : 0; // degrees per millisecond
    const rot = `rotate(${W.angle.toFixed(2)}deg)`;
    const a = (W.ball * Math.PI) / 180;
    const bx = W.r * Math.sin(a);
    const by = -W.r * Math.cos(a);
    // One wheel unit is .5cqw of the wheel's width (see the .wl-ball rules in main.css).
    const cq = (n) => `${(n * 0.5).toFixed(3)}cqw`;
    const ballT = `translate(${cq(bx)}, ${cq(by)})`;
    const shadowT = `translate(${cq(bx + 1.1)}, ${cq(by + 1.6)})`;
    const fast = Math.abs(W.vel) > 0.05;
    const step = Math.max(-10, Math.min(10, -W.vel * 9));
    // Transforms on plain elements only, so a frame never triggers layout.
    for (const w of wheels) {
      w.rotor.style.transform = rot;
      w.ball.style.transform = ballT;
      w.shadow.style.transform = shadowT;
      w.trails.forEach((tr, i) => {
        const ta = ((W.ball + step * (i + 1)) * Math.PI) / 180;
        tr.style.transform = `translate(${cq(W.r * Math.sin(ta))}, ${cq(-W.r * Math.cos(ta))})`;
        tr.style.opacity = fast ? String(0.34 - i * 0.08) : '0';
      });
    }
    if (!W.spin && W.pending) { const r = W.pending; W.pending = null; revealSpin(r); }
    W.raf = requestAnimationFrame(frame);
  };
  W.raf = requestAnimationFrame(frame);
}

// ---- the full-screen spin view
const SV = { el: null, timers: [] };

function smallBox() { return document.querySelector('#stage .wheel-box'); }

// Transform that makes the big wheel look like it is sitting exactly on the small one.
function flipFrom(cam) {
  const box = smallBox();
  const from = box && box.getBoundingClientRect();
  const to = cam.getBoundingClientRect();
  if (!from || !to.width) return 'translate(0px, 0px) scale(.3)';
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width})`;
}

function openSpinView(total, left, early = false) {
  // (shown even when the phone asks for reduced motion: it is the result of your bet, not decoration)
  if (SV.el && SV.early && !early) {
    // The wheel was already brought up when Spin was pressed: now the spin really starts.
    SV.early = false;
    const el = SV.el;
    const t = el.querySelector('.spin-title span'); if (t) { t.textContent = 'No more bets'; t.style.opacity = ''; }
    const cam = el.querySelector('.spin-cam');
    const pushAt = Math.max(0, left - total * 0.42);
    cam.animate([{ scale: '1' }, { scale: '1.045' }], { duration: Math.max(800, left - pushAt), delay: pushAt, easing: 'ease-in-out', fill: 'forwards' });
    SV.timers.push(setTimeout(() => { const tt = el.querySelector('.spin-title span'); if (tt && !el.classList.contains('landed')) tt.style.opacity = '.55'; }, 2200));
    return;
  }
  if (SV.el && early) return;
  closeSpinView(true);
  const el = document.createElement('div');
  el.className = 'spin-ov';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'The wheel is spinning');
  el.innerHTML = `
    <div class="spin-bg"></div>
    <p class="spin-title" aria-live="assertive"><span class="tt-in">${early ? 'Spinning when everyone is ready…' : 'No more bets'}</span></p>
    <div class="spin-cam">${RU.wheelSvg()}<div class="spin-medal" aria-live="assertive"></div></div>
    <p class="spin-skip">Tap anywhere to close</p>`;
  document.body.appendChild(el);
  W.els = null; // the wheel list now includes the big one
  SV.el = el;
  SV.early = early;
  el.addEventListener('click', () => closeSpinView());
  const cam = el.querySelector('.spin-cam');
  const box = smallBox();
  // Lift the wheel off the table and carry it to the middle of the screen; the small one steps aside meanwhile.
  cam.animate([{ transform: flipFrom(cam) }, { transform: 'translate(0px, 0px) scale(1)' }], { duration: reduceMotion ? 1 : 850, easing: 'cubic-bezier(.2,.8,.2,1)' });
  if (box) box.classList.add('away');
  // A very slow push-in as the ball settles; subtle on purpose.
  if (!early) {
    const pushAt = Math.max(0, left - total * 0.42);
    cam.animate([{ scale: '1' }, { scale: '1.045' }], { duration: Math.max(800, left - pushAt), delay: pushAt, easing: 'ease-in-out', fill: 'forwards' });
  }
  sound.play('whoosh');
  if (!early) SV.timers.push(setTimeout(() => { const t = el.querySelector('.spin-title span'); if (t && !el.classList.contains('landed')) t.style.opacity = '.55'; }, 2200));
}

function revealSpin({ n, net, bet }) {
  sound.play('land');
  const won = net > 0;
  if (won) setTimeout(() => sound.play('win'), 250);
  const el = SV.el;
  if (!el) return;
  const colour = RU.colorName(n);
  const parity = n === 0 ? '' : n % 2 ? 'odd' : 'even';
  // Highlight the pocket the ball is sitting in (it rotates with the wheel).
  const rotorG = el.querySelector('.rotor-g');
  const idx = WHEEL.indexOf(n);
  if (rotorG && idx >= 0) {
    const ns = 'http://www.w3.org/2000/svg';
    const hit = document.createElementNS(ns, 'path');
    hit.setAttribute('d', RU.pocketPath(idx));
    hit.setAttribute('class', 'pocket-hit');
    rotorG.appendChild(hit);
  }
  const medal = el.querySelector('.spin-medal');
  medal.className = `spin-medal m-${colour.toLowerCase()}`;
  medal.innerHTML = `<b>${n}</b><i>${colour}${parity ? `, ${parity}` : ''}</i>`;
  const line = !bet ? 'You sat this one out' : won ? `You win <b class="up">${fmt(net)}</b>` : net === 0 ? 'You broke even' : `You lose <b>${fmt(-net)}</b>`;
  const title = el.querySelector('.spin-title');
  title.innerHTML = `<span class="tt-in">${line}</span>`;
  el.classList.add('landed');
  sound.play('boom');
  if (won) chipRain(el, Math.min(36, 14 + Math.round(net / 12)));
  SV.timers.push(setTimeout(() => closeSpinView(), 3800));
}

function chipRain(host, count) {
  const kinds = ['c5', 'c25', 'c100', 'c500', 'k1', 'k5'];
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.className = `chip rain ${kinds[i % kinds.length]}`;
    host.appendChild(c);
    c.style.left = `${w / 2 + (Math.random() - 0.5) * 60}px`;
    c.style.top = `${h * 0.46}px`;
    const vx = (Math.random() - 0.5) * w * 0.8;
    const up = h * (0.2 + Math.random() * 0.28);
    const spin = (Math.random() - 0.5) * 720;
    c.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg) scale(.5)', opacity: 0 },
      { transform: `translate(calc(-50% + ${vx * 0.45}px), calc(-50% - ${up}px)) rotate(${spin * 0.4}deg) scale(1)`, opacity: 1, offset: 0.34 },
      { transform: `translate(calc(-50% + ${vx}px), calc(-50% + ${h * 0.62}px)) rotate(${spin}deg) scale(1)`, opacity: 1, offset: 0.9 },
      { transform: `translate(calc(-50% + ${vx}px), calc(-50% + ${h * 0.7}px)) rotate(${spin}deg) scale(1)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, delay: Math.random() * 220, easing: 'cubic-bezier(.25,.6,.5,1)', fill: 'both' }).onfinish = () => c.remove();
  }
}

function closeSpinView(instant = false) {
  const el = SV.el;
  const box = smallBox();
  if (!el) { if (box) box.classList.remove('away'); return; }
  SV.el = null; SV.early = false;
  SV.timers.forEach(clearTimeout);
  SV.timers = [];
  const done = () => { el.remove(); W.els = null; if (!SV.el && smallBox()) smallBox().classList.remove('away'); };
  if (instant) { done(); return; }
  const cam = el.querySelector('.spin-cam');
  cam.getAnimations().forEach((a) => a.cancel());
  el.classList.add('closing');
  const back = cam.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: flipFrom(cam) }], { duration: 620, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
  back.onfinish = done;
  setTimeout(done, 720); // safety net if the animation is interrupted
}

// ---------------------------------------------------------------- hold'em effects
// A bet slides out from its seat once, when the engine says a bet was made. The bet element itself is
// keyed by player (not amount), so ordinary re-renders patch it in place and never replay this.
function hdBetPop(ev) {
  if (reduceMotion || !(ev.amount > 0)) return;
  const el = document.querySelector(`#stage .bet[data-bet="${CSS.escape(ev.pid)}"]`);
  if (!el) return;
  el.animate([
    { transform: 'translate(calc(-50% + var(--bx, 0) * 1cqw), calc(-50% + var(--by, 0) * 1cqw / var(--ar))) scale(.85)', opacity: 0 },
    { opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
  ], { duration: 600, easing: 'cubic-bezier(.2,.7,.2,1)' });
}

// Remember every card entrance that has finished, so it can never be replayed (see holdem-ui.js).
document.addEventListener('animationend', (e) => {
  const el = e.target;
  if (!el.classList) return;
  if (el.classList.contains('card') && el.id && /^(deal-seat|flop-spread|late-in)$/.test(e.animationName)) HU.markDealt(el.id);
  else if (el.classList.contains('card-in') && e.animationName === 'turnover') {
    const c = el.closest('.card');
    if (c && c.id) HU.markDealt(`${c.id}#in`);
  }
}, true);

// ---------------------------------------------------------------- blackjack effects
// Keep these two in step with PEEK_MS / FLIP_MS in js/games/blackjack.js.
const BJ_PEEK_MS = 950;
const BJ_FLIP_MS = 1000;

function bjSpot(pid, part) {
  return document.querySelector(`#stage #spot-${CSS.escape(pid)} ${part}`);
}

// A stake slides from where it came from (the tapped chip, or the player's plate) onto the felt.
function bjChipFlight(ev) {
  if (!(ev.amount > 0)) return;
  const circle = bjSpot(ev.pid, '.circle');
  if (!circle) return;
  const to = centre(circle.getBoundingClientRect());
  let from = null;
  if (ev.pid === S.state.you && S.chipSrc && performance.now() - S.chipSrc.t < 900) from = S.chipSrc;
  else { const plate = bjSpot(ev.pid, '.plate'); if (plate) from = centre(plate.getBoundingClientRect()); }
  fly(chipStack(ev.amount, 5), from, to, { dur: ev.double || ev.split ? 620 : 480, lift: ev.double || ev.split ? 28 : 16 });
}

function bjStand(ev) {
  sound.play('check');
  const pill = document.querySelector(`#stage #hand-${CSS.escape(ev.pid)}-${ev.hid} .total`);
  if (pill && !reduceMotion) pill.animate([{ scale: '1' }, { scale: '1.22' }, { scale: '1' }], { duration: 360, easing: 'cubic-bezier(.3,.7,.3,1)' });
}

// Winners are paid from the dealer's side; losing stakes are swept back to it.
function bjSettleFx(game) {
  const dealer = document.querySelector('#stage .dealer-cards');
  if (!dealer) return;
  const dealerAt = centre(dealer.getBoundingClientRect());
  const you = S.state.you;
  let paid = false;
  game.seats.forEach((s, i) => {
    if (!s.hands.length) return;
    const circle = bjSpot(s.pid, '.circle');
    if (!circle) return;
    const at = centre(circle.getBoundingClientRect());
    const net = s.hands.reduce((t, h) => t + (h.net || 0), 0);
    const staked = s.hands.reduce((t, h) => t + h.bet, 0);
    if (net > 0) {
      paid = true;
      fly(chipStack(net, 7), dealerAt, at, { dur: 950, delay: 380 + i * 150, lift: 38 });
      if (!reduceMotion) circle.animate([{ scale: '1' }, { scale: '1.2' }, { scale: '1' }], { duration: 520, delay: 1250 + i * 150, easing: 'ease-out' });
    } else if (net < 0) {
      fly(chipStack(Math.min(staked, -net), 6), at, dealerAt, { dur: 700, delay: 450 + i * 110, lift: 12 });
    }
    if (s.pid === you && net < 0) setTimeout(() => sound.play('lose'), 520);
  });
  if (paid) setTimeout(() => sound.play('collect'), 1250);
}

// ---------------------------------------------------------------- dialogs and the 18+ gate
function dialog({ title, body, yes, no }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ls-modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', title);
    el.innerHTML = `<div class="ls-modal-card"><h2>${esc(title)}</h2><p>${esc(body)}</p>
      <div class="ls-modal-acts">${no ? `<button class="btn btn-quiet" data-m="no">${esc(no)}</button>` : ''}<button class="btn btn-primary" data-m="yes">${esc(yes)}</button></div></div>`;
    const done = (v) => { document.removeEventListener('keydown', onKey, true); el.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape' && no) { e.preventDefault(); done(false); } };
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'yes'); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
    el.querySelector('[data-m=yes]').focus();
  });
}

// Low Stakes is casino-style, so it is for adults only. This is a self-declaration, not identity verification.
function ageOk() { return store.get('ls.age') === '18'; }
function ageGate(done) {
  const state = store.get('ls.age');
  if (state === '18') return done();
  document.body.className = 'on-gate';
  const el = document.createElement('div');
  el.className = 'ls-modal ls-age';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Age check');
  const blocked = () => {
    el.innerHTML = `<div class="ls-modal-card"><h2>Sorry, this one is for adults</h2><p>Low Stakes is a play-money casino-style game and is only for people aged 18 or over. Come back when you are 18.</p></div>`;
  };
  if (state === 'under') { blocked(); document.body.appendChild(el); return; }
  el.innerHTML = `<div class="ls-modal-card"><h2>Are you 18 or older?</h2>
    <p>Low Stakes has poker, blackjack, roulette and crash. It uses play money only, but it is casino-style, so it is for adults.</p>
    <div class="ls-modal-acts"><button class="btn btn-quiet" data-a="under">No, I am under 18</button><button class="btn btn-primary" data-a="18">Yes, I am 18 or older</button></div></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    store.set('ls.age', b.dataset.a);
    if (b.dataset.a === '18') { el.remove(); done(); } else blocked();
  });
  document.body.appendChild(el);
  el.querySelector('[data-a="18"]').focus();
}

// ---------------------------------------------------------------- countdowns
setInterval(() => {
  if (S.screen !== 'table') return;
  const elapsed = performance.now() - S.recvAt;
  document.querySelectorAll('.countdown[data-ms]').forEach((el) => {
    const s = Math.max(0, Math.ceil((Number(el.dataset.ms) - elapsed) / 1000));
    if (el.textContent !== String(s)) el.textContent = s;
  });
}, 250);

window.addEventListener('beforeunload', (e) => {
  if (S.client && S.client.isHost && S.state && S.state.room.players.some((p) => !p.bot && p.connected && p.id !== S.state.you)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
window.addEventListener('pagehide', () => { if (S.client && !S.client.isHost) S.client.close(); });

const accountsOk = () => !CONFIG.requireLogin || Auth.ready();
window.addEventListener('hashchange', () => {
  if (!ageOk()) return;
  // An email link opened in a tab that already has the site loaded.
  if (/(^#|&)(access_token|error)=/.test(location.hash)) {
    const link = Auth.consumeLink();
    Auth.init().then(() => AU.handleLink(link));
    return;
  }
  if (accountsOk()) route();
});
Auth.onChange(() => { AU.bindSlot(); });
AU.setToast(toast);
// free coins claimed while sitting at a wallet table: ask the table to add them to the stack
AU.setCoinsHook(() => { if (S.client && S.client.isServer) S.client.send({ t: 'refresh' }); });
const pollPacks = () => { if (Auth.ready()) Auth.freePacks().catch(() => {}); };
setInterval(pollPacks, 60000);
setInterval(() => AU.bindSlot(), 15000);
Auth.onChange(() => { if (Auth.ready() && !Auth.packs && !S.packsAsked) { S.packsAsked = true; pollPacks(); } });
ageGate(async () => {
  const link = Auth.consumeLink(); // must run before route() reads the address
  const starting = Auth.init();
  S.authReady = starting.catch(() => {}).then(() => { S.authSettled = true; });
  if (CONFIG.requireLogin) {
    await starting;
    if (!Auth.ready()) { if (link) await AU.handleLink(link); else AU.openAuth('signin', { required: true }); }
    const wait = setInterval(() => { if (Auth.ready()) { clearInterval(wait); route(); } }, 400);
    if (Auth.ready()) { clearInterval(wait); route(); }
    return;
  }
  route();
  starting.then(() => { const n = Auth.takeNotice(); if (n === 'expired') toast('Your session expired. Please sign in again.'); });
  if (link) { await starting; AU.handleLink(link); }
});

// Exposed for debugging in the console.
window.lowstakes = S;
