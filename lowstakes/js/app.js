import morphdom from '../vendor/morphdom-esm.js?v=4';
import { Host, Guest, cleanCode, COLORS, GAME_NAMES, REACTIONS } from './net/room.js?v=4';
import { landing, gate } from './ui/landing.js?v=4';
import { lobby, inviteLink } from './ui/lobby.js?v=4';
import * as HU from './ui/holdem-ui.js?v=4';
import * as BU from './ui/blackjack-ui.js?v=4';
import * as RU from './ui/roulette-ui.js?v=4';
import * as CU from './ui/baccarat-ui.js?v=4';
import * as KU from './ui/craps-ui.js?v=4';
import { sound } from './ui/sound.js?v=4';
import { esc, fmt, signed, avatar, chipStack } from './ui/parts.js?v=4';
import { WHEEL } from './games/roulette.js?v=4';
import { DIE_ROT } from './ui/craps-ui.js?v=4';

const UIS = { holdem: HU, blackjack: BU, roulette: RU, baccarat: CU, craps: KU };
const REACT_LABEL = { nice: 'Nice hand', lol: 'Ha!', ouch: 'Ouch', gg: 'GG', bluff: 'Bluff!', wow: 'Wow' };
const app = document.getElementById('app');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const S = {
  me: {
    name: store.get('ls.name') || '',
    color: store.get('ls.color') || COLORS[Math.floor(Math.random() * 6)],
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
function showLanding(error = '') {
  S.screen = 'landing';
  document.body.className = 'on-landing';
  document.title = 'Low Stakes';
  app.innerHTML = landing(S.me, { error });
  const form = document.getElementById('start-form');
  const code = document.getElementById('code');
  code.addEventListener('input', () => { code.value = cleanCode(code.value); });
  let mode = 'host';
  form.querySelectorAll('button[type=submit]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sound.unlock();
    if (!readMe(form)) return;
    if (mode === 'join') {
      const c = cleanCode(code.value);
      if (c.length !== 5) { formError('Table codes are five letters and numbers, like K7QXM.'); code.focus(); return; }
      location.hash = `#/t/${c}`;
      return;
    }
    startHost({ bots: mode === 'bots' });
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
    joinTable(code);
    showGate(code, { status: 'connecting' });
  });
  if (!opts.status) form.querySelector('#name').focus();
}

function gateStage({ stage, slow }) {
  const btn = document.querySelector('#gate-form button[type=submit]');
  const note = document.getElementById('form-error');
  if (btn) btn.textContent = stage === 'server' ? 'Contacting the matchmaking server…' : 'Connecting to the host…';
  if (note && slow) {
    note.classList.add('gate-wait');
    note.textContent = stage === 'server'
      ? 'This is taking a while. A VPN, ad blocker or school network can block the connection.'
      : 'Found the table. Still connecting to the host’s browser. Make sure the host still has the table open.';
  }
}

function readMe(form) {
  const name = form.querySelector('#name').value.replace(/\s+/g, ' ').trim().slice(0, 16);
  const color = (form.querySelector('input[name=color]:checked') || {}).value || S.me.color;
  if (!name) { formError('Add your name so the table knows who you are.'); form.querySelector('#name').focus(); return false; }
  S.me = { name, color };
  store.set('ls.name', name);
  store.set('ls.color', color);
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
  S.ui.unread = 0;
  client.on('state', (msg) => { if (S.client === client) onState(msg); });
  client.on('status', (st) => { if (S.client === client) onStatus(st); });
  client.on('react', (msg) => { if (S.client === client) showReaction(msg); });
  client.on('stage', (st) => { if (S.client === client && S.screen === 'gate') gateStage(st); });
}

function onStatus(st) {
  const c = S.client;
  if (!c) return;
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
    if (st === 'full') { const code = c.code; leave(false); showGate(code, { error: 'That table is full. Twelve is the limit.' }); return; }
    if (st === 'offline' && S.screen !== 'table') { const code = c.code; leave(false); showGate(code, { error: 'Couldn’t reach the matchmaking server. Check your connection and try again.' }); return; }
    if (st === 'kicked') { leave(false); location.hash = '#/'; toast('The host removed you from the table.'); return; }
    if (st === 'closed') { if (S.screen === 'table') renderClosed(); return; }
  }
  if (S.screen === 'table') renderBanner();
}

function leave(navigate = true) {
  if (S.client) S.client.close();
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
      <form class="chat-form" id="chat-form"><input id="chat-input" maxlength="240" placeholder="Say something nice. Or don't." autocomplete="off" aria-label="Chat message"><button class="btn btn-dark btn-sm">Send</button></form>
    </aside>
  </div>
  <div class="dock" id="dock"></div>
  <div class="banner" id="banner" role="status"></div>
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
  const me = room.players.find((p) => p.id === S.state.you);
  return `
    <a class="wordmark sm" href="#/" data-act="leave" aria-label="Leave and go home"><span>Low</span><span>Stakes</span></a>
    <button class="code-pill" data-act="copy-link" title="Copy the invite link"><span>Table</span><b>${esc(room.code)}</b><em>Copy invite</em></button>
    <p class="r-title">${room.gameId ? esc(GAME_NAMES[room.gameId]) : 'Lobby'}${sub ? `<span>${sub}</span>` : ''}</p>
    <div class="r-tools">
      ${me ? `<span class="my-stack">${avatar(me, 'xs')}<b>${fmt(me.chips)}</b></span>` : ''}
      <button class="tool" data-act="scores" aria-label="Scores">${ICON.scores}<span>Scores</span></button>
      <button class="tool" data-act="sound" aria-label="${sound.on ? 'Mute sounds' : 'Turn sounds on'}" aria-pressed="${sound.on}">${sound.on ? ICON.sound : ICON.mute}<span>Sound</span></button>
      <button class="tool" data-act="chat" aria-label="Chat" aria-expanded="${S.ui.chatOpen}">${ICON.chat}<span>Chat</span>${S.ui.unread ? `<i class="badge">${S.ui.unread}</i>` : ''}</button>
      ${isHost ? `<button class="tool" data-act="menu" aria-label="Table menu">${ICON.menu}<span>Table</span></button>` : ''}
      <button class="tool tool-leave" data-act="leave">Leave</button>
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
  const html = game ? UIS[game.game].stage(game, S.state, S.ui) : lobby(S.state, S.ui);
  morphdom(stage, `<main class="stage" id="stage" data-game="${room.gameId || 'lobby'}">${html}</main>`, {
    ...morphOpts,
    onBeforeElUpdated(from, to) {
      if (from.dataset && from.dataset.static) return false;
      // keep the "instant" class while we're suppressing first-paint animation
      if (from === stage) { to.className = from.className.includes('instant') ? 'stage instant' : 'stage'; }
      return !from.isEqualNode(to);
    },
  });
  postEffects(newEvents);
  if (game && game.game === 'roulette') wheelLoop();

  // Action dock
  const dockEl = document.getElementById('dock');
  let d;
  if (game) d = UIS[game.game].dock(game, S.state, S.ui);
  else d = lobbyDock();
  if (d.sig !== S.dockSig) {
    S.dockSig = d.sig;
    dockEl.innerHTML = d.html;
    dockEl.className = `dock${game && game.you && game.you.myTurn ? ' my-turn' : ''}`;
    bindDock();
  }

  renderChat();
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
    const fresh = chat.filter((m) => m.id > S.seenChat && m.pid && m.pid !== S.state.you);
    if (S.seenChat && fresh.length) {
      if (!S.ui.chatOpen) { S.ui.unread += fresh.length; morphdom(document.getElementById('r-top'), `<header class="r-top" id="r-top">${headerHtml()}</header>`, morphOpts); }
      sound.play('message');
      for (const m of fresh) speech(m.pid, m.text);
    }
    S.seenChat = newest;
  }
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  morphdom(list, `<ol class="chat-list" id="chat-list">${chat.map((m) => m.pid
    ? `<li id="m${m.id}" class="msg${m.pid === S.state.you ? ' mine' : ''}"><b style="--c:${esc(m.color)}">${esc(m.name)}</b> ${esc(m.text)}</li>`
    : `<li id="m${m.id}" class="msg sys">${esc(m.text)}</li>`).join('')}</ol>`);
  if (atBottom) list.scrollTop = list.scrollHeight;
}

function renderBanner() {
  const el = document.getElementById('banner');
  if (!el || !S.client) return;
  const st = S.client.status;
  let msg = '';
  if (!S.client.isHost && st === 'reconnecting') msg = 'Lost the connection to the host. Reconnecting…';
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
  } else if (S.ui.pop === 'menu') {
    const paused = game && game.paused;
    body = `<h2>Table</h2>
      <div class="menu-list">
        ${room.gameId ? '<button class="btn btn-quiet btn-sm" data-act="to-lobby">Back to the lobby</button>' : ''}
        ${game && game.game === 'holdem' ? `<button class="btn btn-quiet btn-sm" data-act="pause">${paused ? 'Resume dealing' : 'Pause after this hand'}</button>` : ''}
        <button class="btn btn-quiet btn-sm" data-act="add-bot">Add a bot</button>
      </div>
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
    case 'copy-link': copyInvite(); return;
    case 'sound': sound.toggle(); renderTable(); return;
    case 'chat':
      S.ui.chatOpen = !S.ui.chatOpen;
      S.ui.unread = 0;
      document.getElementById('room').classList.toggle('chat-open', S.ui.chatOpen);
      renderTable();
      if (S.ui.chatOpen && matchMedia('(min-width: 700px)').matches) document.getElementById('chat-input').focus();
      return;
    case 'scores': case 'menu': S.ui.pop = S.ui.pop === act ? null : act; S.ui.pop ? renderPop() : closePop(); return;
    case 'close-pop': closePop(); return;
    case 'react': c.emote(el.dataset.r); return;
    case 'rebuy': c.requestRebuy(); return;
    // lobby / host
    case 'pick': S.ui.pick = el.dataset.game; renderTable(); return;
    case 'start-game': c.setGame(S.ui.pick); return;
    case 'add-bot': c.addBot(); return;
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
      c.act({ type: 'add', amount: Number(el.dataset.v) });
      sound.play('chip');
      return;
    }
    case 'bj-clear': c.act({ type: 'bet', amount: 0 }); return;
    case 'bj-rebet': { const seat = game.seats.find((s) => s.pid === S.state.you); c.act({ type: 'bet', amount: seat.lastBet }); return; }
    case 'bj-ready': c.act({ type: 'ready' }); return;
    case 'bj-hit': case 'bj-stand': case 'bj-double': case 'bj-split': c.act({ type: act.slice(3) }); return;
    // roulette
    case 'rl-chip': S.ui.chip = Number(el.dataset.v); S.dockSig = null; renderTable(); return;
    case 'rl-bet':
      if (game && game.phase === 'betting' && you && !you.ready) { c.act({ type: 'bet', spot: el.dataset.spot, amount: S.ui.chip }); sound.play('chip'); }
      return;
    case 'rl-undo': case 'rl-clear': case 'rl-rebet': case 'rl-double': case 'rl-ready': case 'rl-unready':
      c.act({ type: act.slice(3) }); return;
    // baccarat
    case 'bc-chip': S.ui.chip = Number(el.dataset.v); S.dockSig = null; renderTable(); return;
    case 'bc-bet':
      if (game && game.phase === 'betting' && you && !you.ready) { c.act({ type: 'bet', spot: el.dataset.spot, amount: S.ui.chip }); sound.play('chip'); }
      return;
    case 'bc-undo': case 'bc-clear': case 'bc-rebet': case 'bc-double': case 'bc-ready': case 'bc-unready':
      c.act({ type: act.slice(3) }); return;
    // craps
    case 'cr-chip': S.ui.chip = Number(el.dataset.v); S.dockSig = null; renderTable(); return;
    case 'cr-bet':
      if (game && game.phase === 'betting') { c.act({ type: 'bet', spot: el.dataset.spot, amount: S.ui.chip }); sound.play('chip'); }
      return;
    case 'cr-undo': case 'cr-clear': c.act({ type: act.slice(3) }); return;
    case 'cr-roll': c.act({ type: 'roll' }); return;
    default:
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!S.client) return;
  if (el.matches('[data-act=sitout]')) S.client.act({ type: 'sitout', on: el.checked });
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
    blackjack: { h: 'bj-hit', s: 'bj-stand', d: 'bj-double', p: 'bj-split', enter: 'bj-ready' },
    roulette: { enter: 'rl-ready' },
    baccarat: { enter: 'bc-ready' },
    craps: { enter: 'cr-roll' },
  }[S.state.game.game];
  let target = map && map[k];
  if (!target) return;
  if (Array.isArray(target)) target = target.find((t) => document.querySelector(`#dock [data-act="${t}"]`));
  const btn = document.querySelector(`#dock [data-act="${target}"]`);
  if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
});

async function copyInvite() {
  const link = inviteLink(S.state.room.code);
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
        } else if (game.game === 'baccarat') {
          for (let i = 0; i < 4; i++) setTimeout(() => sound.play('card'), i * 420);
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
      case 'chip': sound.play('chip'); break;
      case 'check': sound.play('check'); break;
      case 'fold': sound.play('fold'); break;
      case 'collect': sound.play('collect'); break;
      case 'reveal': {
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
        break;
      case 'spin': if (game && game.game === 'roulette') startSpin(game); break;
      case 'land': {
        if (game.game === 'roulette') {
          const bet = game.bets.some((b) => b.pid === you);
          const r = { n: ev.n, net: (game.net || {})[you] || 0, bet };
          // Wait for the ball to actually stop on this screen before revealing.
          if (W.spin) W.pending = r; else revealSpin(r);
        } else if (game.game === 'craps') {
          landDice(game);
        }
        break;
      }
      case 'roll-start': if (game && game.game === 'craps') startDiceRoll(game); break;
      default:
    }
  }
}

function showReaction(msg) {
  sound.play('react');
  speech(msg.pid, REACT_LABEL[msg.r] || msg.r, true);
}

function speech(pid, text, isReact = false) {
  const fx = document.getElementById('fx');
  const anchor = document.querySelector(`#stage [data-seat="${CSS.escape(pid)}"]`);
  if (!fx || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `bubble${isReact ? ' react' : ''}`;
  el.textContent = text.length > 60 ? `${text.slice(0, 58)}…` : text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  fx.appendChild(el);
  setTimeout(() => el.classList.add('out'), isReact ? 1800 : 3200);
  setTimeout(() => el.remove(), isReact ? 2300 : 3700);
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
// One wheel state drives every wheel on screen: the small one on the table
// and the big one in the full-screen spin view.
const SEG = 360 / 37;
const W = { angle: 0, ball: 0, r: 92, spin: null, raf: 0, last: 0, pocket: null, vel: 0, pending: null, timers: [] };

function startSpin(view) {
  const idx = WHEEL.indexOf(view.result);
  const total = view.spinMs;
  const left = view.spinLeft || total;
  const w0 = W.angle;
  const w1 = w0 + 400 + Math.random() * 120;
  const b1 = w1 + idx * SEG;
  const b0 = b1 + 360 * 6;
  const t0 = performance.now() - (total - left);
  W.spin = { t0, total, w0, w1, b0, b1, idx };
  W.pocket = null;
  W.pending = null;
  sound.play('spin', { ms: left });
  // The ball hits the frets three times as it drops (matches the bounce curve below).
  W.timers.forEach(clearTimeout);
  W.timers = [0.72, 0.82, 0.92].map((p, i) => setTimeout(() => sound.play('bounce', { n: i }), t0 + p * total - performance.now()));
  if (left > 2500) openSpinView(total, left);
}

function wheelLoop() {
  if (W.raf) return;
  W.last = performance.now();
  const frame = (t) => {
    const rotors = document.querySelectorAll('.rotor');
    if (!rotors.length || !S.state || !S.state.game || S.state.game.game !== 'roulette') { W.raf = 0; closeSpinView(true); return; }
    const dt = Math.max(1, t - W.last);
    W.last = t;
    const game = S.state.game;
    const prevBall = W.ball;
    if (W.spin) {
      const p = Math.min(1, (t - W.spin.t0) / W.spin.total);
      const ew = 1 - (1 - p) ** 3;
      const eb = 1 - (1 - p) ** 4;
      W.angle = W.spin.w0 + (W.spin.w1 - W.spin.w0) * ew;
      W.ball = W.spin.b0 + (W.spin.b1 - W.spin.b0) * eb;
      const drop = Math.min(1, Math.max(0, (p - 0.62) / 0.3));
      const bounce = drop > 0 && drop < 1 ? Math.abs(Math.sin(drop * Math.PI * 3)) * (1 - drop) * 7 : 0;
      W.r = 92 - drop * 20 + bounce;
      if (p >= 1) { W.pocket = W.spin.idx; W.spin = null; }
    } else {
      if (!reduceMotion) W.angle += dt * 0.008;
      if (W.pocket == null && game.history && game.history.length) W.pocket = WHEEL.indexOf(game.history[0]);
      if (W.pocket != null) { W.ball = W.angle + W.pocket * SEG; W.r = 72; }
      else { W.r = 92; }
      if (W.pending) { const r = W.pending; W.pending = null; revealSpin(r); }
    }
    W.vel = W.spin ? (W.ball - prevBall) / dt : 0; // degrees per ms
    const rot = `rotate(${W.angle.toFixed(2)})`;
    rotors.forEach((r) => r.setAttribute('transform', rot));
    const place = (el, ang, r) => {
      const a = (ang * Math.PI) / 180;
      el.setAttribute('cx', (r * Math.sin(a)).toFixed(2));
      el.setAttribute('cy', (-r * Math.cos(a)).toFixed(2));
    };
    document.querySelectorAll('.wheel').forEach((svg) => {
      const ball = svg.querySelector('.ball');
      if (ball) place(ball, W.ball, W.r);
      // Motion trail: ghost balls strung out behind the real one while it's fast.
      const step = Math.max(-11, Math.min(11, -W.vel * 14));
      svg.querySelectorAll('.trail').forEach((tr, i) => {
        place(tr, W.ball + step * (i + 1), W.r);
        tr.style.opacity = Math.abs(W.vel) > 0.04 ? String(0.42 - i * 0.07) : '0';
      });
    });
    W.raf = requestAnimationFrame(frame);
  };
  W.raf = requestAnimationFrame(frame);
}

// ---- the full-screen spin view
const SV = { el: null, timers: [] };

function wheelBoxRect() {
  const box = document.querySelector('#stage .wheel-box');
  return box ? box.getBoundingClientRect() : null;
}

function flipFrom(cam) {
  const from = wheelBoxRect();
  const to = cam.getBoundingClientRect();
  if (!from || !to.width) return 'translate(0,0) scale(.3)';
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width})`;
}

function openSpinView(total, left) {
  if (reduceMotion) return;
  closeSpinView(true);
  const el = document.createElement('div');
  el.className = 'spin-ov';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'The wheel is spinning');
  el.innerHTML = `
    <div class="spin-bg"></div>
    <p class="spin-title" aria-hidden="true"><span>No more bets</span></p>
    <div class="spin-cam"><div class="spin-tilt">${RU.wheelSvg()}</div></div>
    <div class="spin-result" aria-live="assertive"></div>
    <p class="spin-skip">Tap anywhere to close</p>`;
  document.body.appendChild(el);
  SV.el = el;
  el.addEventListener('click', () => closeSpinView());
  const cam = el.querySelector('.spin-cam');
  const tilt = el.querySelector('.spin-tilt');
  // Lift the wheel off the table and into the spotlight...
  cam.animate([{ transform: flipFrom(cam) }, { transform: 'translate(0,0) scale(1)' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  tilt.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(48deg)' }], { duration: 1100, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
  // ...then push the camera in as the ball slows down.
  const pushAt = Math.max(0, left - total * 0.5);
  cam.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,4%) scale(1.16)' }], {
    duration: Math.max(800, left - pushAt), delay: pushAt, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards', composite: 'replace',
  });
  sound.play('whoosh');
}

function revealSpin({ n, net, bet }) {
  sound.play('land');
  const won = net > 0;
  if (won) setTimeout(() => sound.play('win'), 250);
  const el = SV.el;
  if (!el) return;
  const colour = RU.colorName(n);
  const line = !bet ? 'You sat this one out.'
    : won ? `You win <b>${fmt(net)}</b>` : net === 0 ? 'You broke even.' : `You lose <b>${fmt(-net)}</b>`;
  const res = el.querySelector('.spin-result');
  res.innerHTML = `
    <div class="sr-disc sr-${colour.toLowerCase()}"><span>${n}</span><i></i><i></i><i></i></div>
    <p class="sr-word">${colour}${n === 0 ? '' : `, ${n % 2 ? 'odd' : 'even'}`}</p>
    <p class="sr-line${won ? ' up' : ''}">${line}</p>`;
  el.classList.add('landed');
  sound.play('boom');
  const tilt = el.querySelector('.spin-tilt');
  tilt.animate([{ transform: 'rotateX(48deg)' }, { transform: 'rotateX(20deg)' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
  if (won) chipRain(el, Math.min(60, 18 + Math.round(net / 10)));
  SV.timers.push(setTimeout(() => closeSpinView(), 3400));
}

function chipRain(host, count) {
  const kinds = ['c5', 'c25', 'c100', 'c500', 'k1', 'k5'];
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.className = `chip rain ${kinds[i % kinds.length]}`;
    host.appendChild(c);
    const x0 = w / 2 + (Math.random() - 0.5) * 80;
    const y0 = h * 0.45;
    const vx = (Math.random() - 0.5) * w * 0.9;
    const up = h * (0.25 + Math.random() * 0.35);
    const spin = (Math.random() - 0.5) * 1440;
    const dur = 1400 + Math.random() * 900;
    c.style.left = `${x0}px`;
    c.style.top = `${y0}px`;
    c.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${vx * 0.45}px), calc(-50% - ${up}px)) rotate(${spin * 0.4}deg) scale(1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${vx}px), calc(-50% + ${h * 0.7}px)) rotateX(${spin}deg) rotate(${spin}deg) scale(1)`, opacity: 1 },
    ], { duration: dur, delay: Math.random() * 250, easing: 'cubic-bezier(.25,.6,.5,1)', fill: 'both' }).onfinish = () => c.remove();
  }
}

function closeSpinView(instant = false) {
  const el = SV.el;
  if (!el) return;
  SV.el = null;
  SV.timers.forEach(clearTimeout);
  SV.timers = [];
  if (instant) { el.remove(); return; }
  const cam = el.querySelector('.spin-cam');
  cam.getAnimations().forEach((a) => a.commitStyles && a.commitStyles());
  cam.getAnimations().forEach((a) => a.cancel());
  const back = flipFrom(cam);
  el.classList.add('closing');
  el.querySelector('.spin-tilt').animate([{ transform: 'rotateX(0deg)' }], { duration: 500, fill: 'forwards' });
  cam.animate([{ transform: getComputedStyle(cam).transform }, { transform: back }], { duration: 650, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
  setTimeout(() => el.remove(), 680);
}

// ---------------------------------------------------------------- craps dice
const DICE_MS = 1650; // matches the engine's land() delay in js/games/craps.js
const DIE_EULER = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const dieT = (x, y) => `rotateX(${x}deg) rotateY(${y}deg)`;

function tumbleDie(el, value, seed) {
  if (!el) return;
  const inner = el.querySelector('.die-in');
  if (!inner) return;
  inner.getAnimations().forEach((a) => a.cancel());
  const [fx, fy] = DIE_EULER[value] || DIE_EULER[1];
  if (reduceMotion) { inner.style.transform = dieT(fx, fy); return; }
  const turns = 2 + (seed % 2);
  const dir1 = seed % 2 ? 1 : -1;
  const dir2 = seed % 3 === 0 ? 1 : -1;
  const steps = 6;
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    if (i === steps) frames.push({ transform: dieT(fx, fy), offset: 1 });
    else frames.push({ transform: dieT(fx + dir1 * 360 * turns * (1 - p), fy + dir2 * 360 * turns * (1 - p) * 0.8), offset: p * 0.92 });
  }
  inner.animate(frames, { duration: DICE_MS, easing: 'cubic-bezier(.22,.6,.3,1)', fill: 'forwards' });
  const box = el;
  box.animate([
    { transform: 'translateY(0) scale(1)' },
    { transform: `translateY(${-14 - seed * 3}px) scale(1.05)`, offset: 0.3 },
    { transform: 'translateY(2px) scale(.97)', offset: 0.88 },
    { transform: 'translateY(0) scale(1)' },
  ], { duration: DICE_MS, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
}

function startDiceRoll(view) {
  if (!view.dice) return;
  sound.play('diceroll', { ms: DICE_MS });
  tumbleDie(document.getElementById('die1'), view.dice[0], 1);
  tumbleDie(document.getElementById('die2'), view.dice[1], 2);
  const sumEl = document.getElementById('dice-sum');
  if (sumEl) sumEl.textContent = '';
}

function landDice(view) {
  sound.play('diceland');
  const sumEl = document.getElementById('dice-sum');
  if (sumEl && view.lastRoll) sumEl.textContent = view.lastRoll.sum;
  const box = document.getElementById('dice-box');
  if (box) { box.classList.add('landed'); setTimeout(() => box.classList.remove('landed'), 400); }
  if (!view.lastRoll) return;
  const youNet = (view.net || {})[S.state.you] || 0;
  setTimeout(() => {
    if (view.lastRoll.shooterChanges) sound.play('sevenout');
    else if (view.lastRoll.notes.some((n) => n.includes('Point is'))) sound.play('point');
    if (youNet > 0) setTimeout(() => sound.play('win'), 200);
    else if (youNet < 0) setTimeout(() => sound.play('lose'), 150);
  }, 120);
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

window.addEventListener('hashchange', route);
route();

// Exposed for debugging in the console.
window.lowstakes = S;
