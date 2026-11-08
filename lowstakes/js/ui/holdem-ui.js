import { esc, fmt, card, chipStack, avatar, outOfChips } from './parts.js?v=39';

// Time between cards when dealing round the table (keep in step with the engine).
export const DEAL_GAP = 200;

// Entrance animations that have actually finished. Once a card's has, it renders with animations off,
// so nothing (a re-render, a DOM move, a new player joining) can ever play its dealing again.
const played = new Set();
let playedHand = -1;
export const markDealt = (id) => played.add(id);

export function lastEvent(view, type) {
  for (let i = view.events.length - 1; i >= 0; i--) if (view.events[i].type === type) return view.events[i];
  return null;
}

export function timerRing(key, total, left) {
  if (!total || left == null) return '';
  const elapsed = Math.max(0, total - left);
  return `<svg class="ring" id="${key}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" pathLength="100" style="animation-duration:${total}ms;animation-delay:-${elapsed}ms"/></svg>`;
}

// Place seats around an ellipse with the viewer at the bottom.
export function seatOrder(seats, you) {
  const mine = seats.findIndex((s) => s.pid === you);
  if (mine < 0) return seats.map((s, i) => ({ s, k: i }));
  return seats.map((s, i) => ({ s, k: (i - mine + seats.length) % seats.length }));
}

export function stage(view, state) {
  const { room, you } = state;
  const byId = Object.fromEntries(room.players.map((p) => [p.id, p]));
  const n = view.seats.length;
  const turnEv = lastEvent(view, 'turn');
  const winners = new Set(view.results ? view.results.pots.flatMap((p) => p.winners) : []);
  const hiCards = new Set();
  if (view.results && view.results.showdown) {
    for (const s of view.seats) if (winners.has(s.pid) && s.best) s.best.forEach((c) => hiCards.add(c));
  }
  const showdown = view.results && view.results.showdown;
  if (view.handNo !== playedHand) { played.clear(); playedHand = view.handNo; }
  const seen = (id) => (played.has(id) ? ' played' : '') + (played.has(`${id}#in`) ? ' played-in' : '');

  // Deal order starts at the small blind and goes round the table, so each
  // card can leave the dealer at its real moment.
  const live = view.seats.filter((s) => s.inHand);
  const sbAt = Math.max(0, live.findIndex((s) => s.sb));
  const order = new Map(live.map((s, j) => [s.pid, (j - sbAt + live.length) % live.length]));

  const seatHtml = seatOrder(view.seats, you).map(({ s, k }) => {
    const p = byId[s.pid] || { name: '?', color: '#777' };
    const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const X = 50 + 50 * cx;
    const Y = 50 + 50 * cy;
    const BX = 50 + 31 * cx;
    const BY = 50 + 29 * cy;
    const k0 = order.has(s.pid) ? order.get(s.pid) : 0;
    // --ox/--oy: path back to the dealer; --mx/--my: where folded cards are tossed; --fd: showdown flip delay
    const pos = `--x:${X.toFixed(2)}%;--y:${Y.toFixed(2)}%;--ox:${(50 - X).toFixed(1)};--oy:${(44 - Y).toFixed(1)};--mx:${((50 - X) * 0.55).toFixed(1)};--my:${((50 - Y) * 0.55).toFixed(1)};--fd:${k0 * 380}ms`;
    const betPos = `--x:${BX.toFixed(2)}%;--y:${BY.toFixed(2)}%;--bx:${(X - BX).toFixed(1)};--by:${(Y - BY).toFixed(1)}`;
    const ba = a + 0.32;
    const btnPos = `--x:${(50 + 37 * Math.cos(ba)).toFixed(2)}%;--y:${(50 + 34 * Math.sin(ba)).toFixed(2)}%`;
    const me = s.pid === you;
    const acting = view.toAct === s.pid;
    const won = winners.has(s.pid) && view.phase === 'handover';
    const cls = [
      'seat', me && 'me', acting && 'acting', s.folded && 'folded', won && 'won',
      !s.inHand && 'out', !p.connected && !p.bot && 'away', cy < -0.3 && 'top', Math.abs(cx) > 0.8 && 'side',
    ].filter(Boolean).join(' ');
    const cards = s.cards.map((c, i) => {
      let extra = '';
      if (showdown && s.best) extra = hiCards.has(c) ? 'hi' : 'lo';
      const id = `h${view.handNo}-${s.pid}-${i}`;
      return card(c, { key: id, cls: extra + seen(id), style: `--dd:${(i * live.length + k0) * DEAL_GAP}ms` });
    }).join('');
    const tag = s.handName ? `<span class="tag tag-hand">${esc(s.handName)}</span>`
      : won && s.won ? `<span class="tag tag-win">+${fmt(s.won)}</span>`
      : s.allIn && s.inHand && !s.folded ? '<span class="tag tag-allin">All in</span>'
      : s.last ? `<span class="tag">${esc(s.last)}</span>`
      : s.sitOut ? '<span class="tag">Sitting out</span>'
      : !s.inHand && s.chips === 0 ? '<span class="tag">Busted</span>' : '';
    const ring = acting ? timerRing(`ring-${turnEv ? turnEv.id : 0}`, view.timer * 1000, view.timeLeft) : '';
    return {
      seat: `<div class="${cls}" style="${pos}" data-seat="${esc(s.pid)}" id="seat-${esc(s.pid)}"><div class="seat-cards">${cards}</div><div class="plate"><span class="av-wrap">${avatar(p)}${ring}</span><span class="plate-text"><span class="pname">${esc(p.name)}</span><span class="pchips">${fmt(s.chips)}</span></span></div>${tag}</div>`,
      // Keyed by player only (not by amount), so a changed bet is patched in place instead of re-created.
      bet: s.bet > 0 ? `<div class="bet" style="${betPos}" id="bet-${esc(s.pid)}" data-bet="${esc(s.pid)}">${chipStack(s.bet, 6)}<b>${fmt(s.bet)}</b></div>` : '',
      btn: s.btn ? `<div class="dealer-btn" style="${btnPos}" id="dealer-btn" aria-label="Dealer button">D</div>` : '',
    };
  });

  const slots = Array.from({ length: 5 }, (_, i) => {
    const c = view.board[i];
    if (!c) return '<div class="slot"></div>';
    const extra = showdown ? (hiCards.has(c) ? 'hi' : 'lo') : '';
    return `<div class="slot">${card(c, { key: `b${view.handNo}-${i}`, cls: `${i < 3 ? 'flop' : 'late'} ${extra}`, style: `--i:${i < 3 ? i : 0}` })}</div>`;
  }).join('');

  // When the pot reaches the winner (matches the chip flight in app.js).
  const shownCount = view.seats.filter((s) => s.handName).length;
  const winDelay = showdown ? 900 + shownCount * 380 + 700 : 900;

  let center = '';
  if (view.results && view.phase === 'handover') {
    center = view.results.pots.map((pot, i) => {
      const names = pot.winners.map((id) => esc((byId[id] || {}).name || '?'));
      const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} split` : `${names[0]} ${pot.name ? 'wins' : 'takes'}`;
      const label = view.results.pots.length > 1 ? (i === 0 ? 'Main pot: ' : 'Side pot: ') : '';
      return `<p>${label}${who} <b>${fmt(pot.amount)}</b>${pot.name ? ` with ${esc(pot.name.toLowerCase())}` : ''}</p>`;
    }).join('');
  } else if (view.phase === 'waiting') {
    const ready = view.seats.filter((s) => s.chips > 0 && !s.sitOut).length;
    center = view.paused ? '<p>Paused. The host can resume from the table menu.</p>'
      : ready < 2 ? '<p>Waiting for one more player with chips.</p>' : '<p>Shuffling up…</p>';
  }

  return `
<div class="tbl-wrap">
  <div class="tbl holdem" style="--n:${n};--wd:${winDelay}ms">
    <div class="felt">
      <div class="board" aria-label="Community cards">${slots}</div>
      <div class="pot" id="pot" aria-live="polite">${view.pot > 0 ? `${chipStack(view.pot, 7)}<span>Pot <b>${fmt(view.pot)}</b></span>` : ''}</div>
      <div class="center-msg" aria-live="polite">${center}</div>
    </div>
    <div class="seats">${seatHtml.map((x) => x.seat).join('')}</div>
    <div class="bets">${seatHtml.map((x) => x.bet).join('')}</div>
    <div class="btn-layer">${seatHtml.map((x) => x.btn).join('')}</div>
  </div>
</div>`.replace(/>\s+</g, '><');
}

export function dock(view, state, ui) {
  const me = view.you;
  const mySeat = view.seats.find((s) => s.pid === state.you);
  const player = state.room.players.find((p) => p.id === state.you);
  if (!me) {
    return { sig: 'watch', html: '<div class="dock-msg">All nine seats are taken, so you’re watching this one. You’ll get a seat when someone leaves.</div>' };
  }
  const broke = player && player.chips === 0 && (!mySeat.inHand || mySeat.folded || view.phase === 'waiting' || view.phase === 'handover');
  const sig = JSON.stringify([me.myTurn, me.legal, me.canShow, me.sitOut, broke, me.hand, view.phase === 'handover', mySeat && mySeat.inHand && !mySeat.folded, view.handNo]);

  const left = me.hand ? `<div class="dock-hand"><span>You have</span><b>${esc(me.hand)}</b></div>` : '<div class="dock-hand"></div>';
  const sit = `<label class="toggle"><input type="checkbox" data-act="sitout"${me.sitOut ? ' checked' : ''}><span>Sit out next hand</span></label>`;

  if (broke) {
    return { sig, html: `${left}<div class="dock-mid">${outOfChips(state)}</div><div class="dock-side"></div>` };
  }

  if (me.myTurn && me.legal) {
    const L = me.legal;
    const pot = view.pot + view.seats.reduce((a, s) => a + s.bet, 0);
    const presets = [];
    if (L.canRaise) {
      const potRaise = (frac) => Math.min(L.maxTo, Math.max(L.minTo, view.currentBet + Math.round((pot + L.toCall) * frac)));
      presets.push(['Min', L.minTo], ['½ pot', potRaise(0.5)], ['¾ pot', potRaise(0.75)], ['Pot', potRaise(1)], ['All in', L.maxTo]);
    }
    const initial = ui.raiseTo && ui.raiseTo >= L.minTo && ui.raiseTo <= L.maxTo ? ui.raiseTo : (presets[1] ? presets[1][1] : L.minTo);
    const raise = L.canRaise ? `
      <div class="raise">
        <div class="presets">${presets.map(([l, v]) => `<button class="chip-btn" data-act="preset" data-to="${v}">${l}</button>`).join('')}</div>
        <div class="raise-row">
          <input type="range" id="raise-range" min="${L.minTo}" max="${L.maxTo}" step="1" value="${initial}" aria-label="Raise amount">
          <button class="btn btn-primary" data-act="raise" id="raise-btn"><span>${L.isBet ? 'Bet' : 'Raise to'}</span> <b id="raise-amt">${fmt(initial)}</b><kbd>R</kbd></button>
        </div>
      </div>` : '';
    return {
      sig,
      html: `${left}
      <div class="dock-mid acts">
        <button class="btn btn-fold" data-act="fold">Fold<kbd>F</kbd></button>
        ${L.canCheck ? '<button class="btn btn-dark" data-act="check">Check<kbd>C</kbd></button>'
          : `<button class="btn btn-dark" data-act="call">${L.callAmt >= L.maxTo - mySeat.bet ? 'Call all in' : 'Call'} <b>${fmt(L.callAmt)}</b><kbd>C</kbd></button>`}
        ${raise}
      </div>
      <div class="dock-side">${sit}</div>`,
    };
  }

  let note = '';
  if (me.canShow) note = '<button class="btn btn-quiet" data-act="show">Show your cards</button>';
  else if (view.phase === 'waiting') note = '<p class="dock-note">Next hand starts in a moment.</p>';
  else if (mySeat && mySeat.inHand && !mySeat.folded) note = '<p class="dock-note">Waiting for the others.</p>';
  else if (mySeat && mySeat.folded) note = '<p class="dock-note">You folded this one.</p>';
  else note = '<p class="dock-note">You’ll be dealt in next hand.</p>';
  return { sig, html: `${left}<div class="dock-mid">${note}</div><div class="dock-side">${sit}</div>` };
}
