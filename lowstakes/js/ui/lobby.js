import { esc, fmt, signed, avatar, card, ROCKET_SVG } from './parts.js?v=60';
import { GAME_NAMES, limitFor } from '../net/room.js?v=60';

const BLURB = {
  holdem: 'Texas Hold’em, no-limit. Two to nine players.',
  blackjack: 'Everyone against the dealer. Up to seven.',
  roulette: 'Single zero. Everyone bets together. Up to twelve.',
  crash: 'Cash out before it crashes. Up to twelve.',
};
const GAME_ORDER = ['holdem', 'blackjack', 'roulette', 'crash'];

function opt(value, current, label) {
  return `<option value="${value}"${String(value) === String(current) ? ' selected' : ''}>${label}</option>`;
}

function settingsForm(gameId, s) {
  if (gameId === 'holdem') {
    const blinds = [[5, 10], [10, 20], [25, 50], [50, 100]];
    return `
      <label class="field sm"><span>Blinds</span><select data-set="holdem.blinds">${blinds.map(([a, b]) => opt(`${a}/${b}`, `${s.holdem.sb}/${s.holdem.bb}`, `${a} / ${b}`)).join('')}</select></label>
      <label class="field sm"><span>Time to act</span><select data-set="holdem.timer">${[[15, '15 seconds'], [30, '30 seconds'], [60, 'A minute'], [0, 'No limit']].map(([v, l]) => opt(v, s.holdem.timer, l)).join('')}</select></label>`;
  }
  if (gameId === 'blackjack') {
    return `
      <label class="field sm"><span>Minimum bet</span><select data-set="blackjack.min">${[5, 10, 25, 50].map((v) => opt(v, s.blackjack.min, v)).join('')}</select></label>
      <label class="field sm"><span>Time to act</span><select data-set="blackjack.timer">${[[10, '10 seconds'], [20, '20 seconds'], [45, '45 seconds'], [0, 'No limit']].map(([v, l]) => opt(v, s.blackjack.timer, l)).join('')}</select></label>`;
  }
  if (gameId === 'crash') {
    return `
      <label class="field sm"><span>Minimum bet</span><select data-set="crash.min">${[1, 5, 25].map((v) => opt(v, s.crash.min, v)).join('')}</select></label>
      <label class="field sm"><span>Betting time</span><select data-set="crash.betTime">${[[10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds']].map(([v, l]) => opt(v, s.crash.betTime, l)).join('')}</select></label>`;
  }
  return `
      <label class="field sm"><span>Minimum chip</span><select data-set="roulette.min">${[1, 5, 25].map((v) => opt(v, s.roulette.min, v)).join('')}</select></label>
      <label class="field sm"><span>Betting time</span><select data-set="roulette.betTime">${[[15, '15 seconds'], [20, '20 seconds'], [40, '40 seconds']].map(([v, l]) => opt(v, s.roulette.betTime, l)).join('')}</select></label>`;
}

const ART = {
  holdem: () => ['Qs', 'Qd'].map((c, i) => card(c, { style: `--i:${i}` })).join(''),
  blackjack: () => ['Jc', 'Ad'].map((c, i) => card(c, { style: `--i:${i}` })).join(''),
  roulette: () => '<div class="mini-wheel"></div>',
  crash: () => ROCKET_SVG,
};

export function lobby(state, ui) {
  const { room, you } = state;
  const isHost = room.hostId === you;
  const host = room.players.find((p) => p.id === room.hostId);
  const pick = ui.pick || 'holdem';
  const limit = limitFor(pick);
  const have = room.players.length;
  const over = Math.max(0, have - limit);
  const full = have >= limit;
  const link = inviteLink(room.code, room.server);
  const offline = room.status === 'offline' || room.status === 'taken';

  const players = room.players.map((p) => `
    <li class="lp${p.connected ? '' : ' away'}" data-seat="${esc(p.id)}">
      ${avatar(p)}
      <span class="lp-name">${esc(p.name)}${p.id === you ? ' <em>(you)</em>' : ''}${p.id === room.hostId ? ' <em>host</em>' : ''}${p.bot ? ' <em>bot</em>' : ''}${!p.connected && !p.bot ? ' <em>away</em>' : ''}</span>
      <span class="lp-chips">${fmt(p.chips)}<small class="${p.net > 0 ? 'up' : p.net < 0 ? 'down' : ''}">${p.net ? signed(p.net) : 'even'}</small></span>
      ${isHost && p.id !== you ? `<button class="icon-btn" data-act="remove" data-pid="${esc(p.id)}" aria-label="Remove ${esc(p.name)}" title="Remove from table">×</button>` : ''}
    </li>`).join('');

  return `
<div class="lobby">
  <section class="lobby-invite">
    <p class="lobby-kicker">Table code</p>
    <h1 class="lobby-code">${esc(room.code)}</h1>
    ${offline
      ? `<p class="lobby-warn">${room.status === 'taken' ? 'That table code is in use somewhere else.' : 'Couldn’t reach the matchmaking server, so friends can’t join right now.'} You can still play against bots here.</p>`
      : `<p>Send this link to your friends. They join from any browser, phone included.</p>
    <div class="invite">
      <input id="invite-link" readonly value="${esc(link)}" aria-label="Invite link">
      <button class="btn btn-dark" data-act="copy-link">Copy link</button>
    </div>
    ${room.status !== 'open' && room.hostId === you ? '<p class="lobby-wait">Opening the table to guests…</p>' : ''}`}
  </section>

  <section class="lobby-seats">
    <h2>At the table <span class="count">${have} of ${limit}</span></h2>
    <ul class="lp-list">${players}</ul>
    ${isHost ? `<button class="btn btn-quiet btn-sm" data-act="add-bot"${full ? ' disabled' : ''}>Add a bot</button>${full ? `<p class="lobby-hint cap-note" role="status">${GAME_NAMES[pick]} seats ${limit}${over ? `, and there are ${have} here` : ', and every seat is taken'}.</p>` : ''}` : ''}
  </section>

  <section class="lobby-games">
    <h2>${isHost ? 'Pick a game' : `${esc(host ? host.name : 'The host')} is picking a game`}</h2>
    <div class="pick-row" role="radiogroup" aria-label="Game">
      ${GAME_ORDER.map((g) => `
        <button class="pick${pick === g ? ' on' : ''} pk-${g}" role="radio" aria-checked="${pick === g}" data-act="pick" data-game="${g}"${isHost ? '' : ' disabled'}>
          <span class="pick-art">${ART[g]()}</span>
          <span class="pick-name">${GAME_NAMES[g]}</span>
          <span class="pick-blurb">${BLURB[g]}</span>
        </button>`).join('')}
    </div>
    ${isHost ? `
    <div class="settings">
      ${settingsForm(pick, room.settings)}
      ${room.walletMode ? '<p class="asub small wallet-note">Everyone plays with their own wallet coins here.</p>' : `      <label class="field sm"><span>Chips per buy-in</span><select data-set="start">${[500, 1000, 2500, 10000].map((v) => opt(v, room.settings.start, fmt(v))).join('')}</select></label>`}
    </div>
    <button class="btn btn-primary btn-wide" data-act="start-game"${over ? ' disabled' : ''}>Deal ${GAME_NAMES[pick]}</button>
    ${over ? `<p class="lobby-hint cap-note" role="status">${GAME_NAMES[pick]} seats ${limit}, but ${have} are at the table. Remove ${over} ${over === 1 ? 'player or bot' : 'players or bots'} to deal it.</p>` : ''}
    ${pick === 'holdem' && room.players.length < 2 ? '<p class="lobby-hint">Hold\'em needs at least two players. Add a bot or wait for a friend.</p>' : ''}`
    : '<p class="lobby-hint">You’re in. The game starts when the host deals.</p>'}
  </section>
  <div class="ad-slot" data-slot="lobby" data-static hidden></div>
</div>`;
}

export function inviteLink(code, server = false) {
  const url = new URL(location.href);
  url.hash = `#/${server ? 's' : 't'}/${code}`;
  return url.toString();
}
