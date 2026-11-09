import { esc, fmt, signed, card, chipStack, chip, avatar, CHIP_VALUES, outOfChips } from './parts.js?v=58';
import { lastEvent, timerRing } from './holdem-ui.js?v=58';

const HINT_WORD = { hit: 'hit', stand: 'stand', double: 'double down', split: 'split' };

function totalLabel(h) {
  if (!h.cards.length) return '';
  if (h.natural) return 'Blackjack';
  return h.soft ? `${h.total - 10} or ${h.total}` : String(h.total);
}

export function stage(view, state) {
  const { room, you } = state;
  const byId = Object.fromEntries(room.players.map((p) => [p.id, p]));
  const turnEv = lastEvent(view, 'turn');
  const n = view.seats.length;

  // Spots sit on an arc along the bottom of the felt, first seat on the left
  // from the dealer's point of view (i.e. the player's right).
  const spots = view.seats.map((s, i) => {
    const p = byId[s.pid] || { name: '?', color: '#777' };
    const t = n === 1 ? 0.5 : i / (n - 1);
    const spread = Math.min(1, 0.35 + n * 0.1);
    const ang = Math.PI * (0.5 + (0.5 - t) * spread * 0.92);
    const x = 50 + 46 * Math.cos(ang);
    const y = 6 + 74 * Math.sin(ang);
    const me = s.pid === you;
    const amount = s.hands.length ? s.hands.reduce((t, h) => t + h.bet, 0) : s.bet;
    const cls = ['spot', me && 'me', s.active && 'acting', !p.connected && !p.bot && 'away', s.ready && 'ready'].filter(Boolean).join(' ');
    const settled = view.phase === 'settle';
    const net = s.hands.reduce((t, h) => t + (h.net || 0), 0);
    const circleCls = ['circle', amount && 'has', settled && net > 0 && 'won', settled && net < 0 && 'swept'].filter(Boolean).join(' ');
    const hands = s.hands.map((h, hi) => {
      const res = h.result && settled
        ? `<span class="res res-${h.result.toLowerCase()}" style="animation-delay:${i * 130 + hi * 90}ms">${h.result === 'Lose' ? 'Lose' : h.result}${h.net ? ` ${signed(h.net)}` : ''}</span>`
        : h.result === 'Bust' ? '<span class="res res-bust">Bust</span>' : '';
      return `
        <div class="hand${s.activeHand === hi ? ' on' : ''}${h.result === 'Bust' ? ' bust' : ''}${h.natural ? ' natural' : ''}${h.done && h.result !== 'Bust' && !settled ? ' held' : ''}" id="hand-${esc(s.pid)}-${h.hid}" data-hid="${h.hid}">
          <div class="hand-cards">${h.cards.map((c, ci) => card(c, { key: `bj${view.round}-${s.pid}-${h.hid}-${ci}`, style: `--k:${ci}` })).join('')}</div>
          <span class="total">${totalLabel(h)}</span>
          ${res}
          <span class="hand-bet">${chipStack(h.bet, 5)}<b>${fmt(h.bet)}</b>${h.doubled ? '<em>×2</em>' : ''}</span>
        </div>`;
    }).join('');
    const ring = s.active ? timerRing(`ring-${turnEv ? turnEv.id : 0}`, view.timer * 1000, view.timeLeft) : '';
    return `
      <div class="${cls}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--ax:${Math.cos(ang).toFixed(3)};--ay:${Math.sin(ang).toFixed(3)}" data-seat="${esc(s.pid)}" id="spot-${esc(s.pid)}">
        <div class="hands h${s.hands.length}">${hands}</div>
        <div class="${circleCls}">${amount ? `${chipStack(amount, 6)}<b>${fmt(amount)}</b>` : ''}</div>
        <div class="plate">
          <span class="av-wrap">${avatar(p)}${ring}</span>
          <span class="plate-text"><span class="pname">${esc(p.name)}</span><span class="pchips">${fmt(s.chips)}</span></span>
        </div>
        ${view.phase === 'betting' && s.ready ? '<span class="tag tag-ready">In</span>' : ''}
        ${view.phase === 'betting' && s.sitOut ? '<span class="tag">Sitting out</span>' : ''}
        ${insTag(view, s)}
      </div>`;
  }).join('');

  const d = view.dealer;
  const dealerTotal = d.cards.length ? (d.total > 21 ? `Bust, ${d.total}` : String(d.total)) : '';
  const shoePct = Math.round((view.shoe.left / view.shoe.total) * 100);

  let center = '';
  if (view.phase === 'betting') {
    center = view.betLeft != null ? `<p>Bets close in <b class="countdown" data-ms="${view.betLeft}">${Math.ceil(view.betLeft / 1000)}</b></p>` : '<p>Place your bets</p>';
  }

  return `
<div class="tbl-wrap bj-wrap">
  <div class="tbl blackjack" style="--n:${n}">
    <div class="felt bj-felt">
      <svg class="felt-arc" viewBox="0 0 1000 560" aria-hidden="true">
        <path id="arc1" d="M140,170 Q500,470 860,170" fill="none"/>
        <path id="arc2" d="M210,150 Q500,410 790,150" fill="none"/>
        <text><textPath href="#arc1" startOffset="50%" text-anchor="middle">Blackjack pays 3 to 2</textPath></text>
        <text class="small"><textPath href="#arc2" startOffset="50%" text-anchor="middle">Dealer must draw to 16 and stand on all 17s</textPath></text>
      </svg>
      <div class="dealer">
        <div class="shoe" title="${view.shoe.left} cards left in the shoe"><span style="--fill:${shoePct}%"></span></div>
        <div class="dealer-cards">${d.cards.map((c, i) => card(c, { key: `bjd${view.round}-${i}`, style: `--k:${i}` })).join('')}</div>
        ${dealerTotal ? `<span class="total dealer-total">${dealerTotal}</span>` : ''}
        ${view.check ? `<div class="dealer-check ${view.check.bj ? 'bj' : 'none'}" id="dealer-check-${view.check.id}" role="status">${view.check.bj ? 'Dealer has blackjack' : 'No dealer blackjack'}<small>${view.check.bj ? 'Hands without blackjack lose' : 'Play continues'}</small></div>` : ''}
      </div>
      <div class="center-msg">${center}</div>
    </div>
    ${spots}
  </div>
</div>`;
}

// Small status under a seat while insurance is being decided, then what it paid.
function insTag(view, s) {
  if (s.insNet != null) return `<span class="tag tag-ins ${s.insNet > 0 ? 'up' : 'down'}">Insurance ${signed(s.insNet)}</span>`;
  if (view.phase !== 'insurance') return '';
  if (s.insChoice === 'take') return '<span class="tag tag-ins">Insured</span>';
  if (s.insChoice === null) return '<span class="tag tag-ins wait">Deciding…</span>';
  return '';
}

export function dock(view, state, ui) {
  const me = view.you;
  const seat = view.seats.find((s) => s.pid === state.you);
  const player = state.room.players.find((p) => p.id === state.you);
  if (!me || !seat) return { sig: 'watch', html: '<div class="dock-msg">All seven spots are taken, so you’re watching. You’ll get a spot when one opens up.</div>' };
  const chips = player ? player.chips : 0;
  const min = view.settings.min;
  const sig = JSON.stringify([view.phase, me.insurance, seat.insChoice, seat.insurance, seat.bet, seat.ready, seat.sitOut, chips, me.myTurn, me.options, me.hint, ui.coach, seat.lastBet, view.round]);

  if (view.phase === 'betting') {
    if (chips + seat.bet < min) {
      return { sig, html: `<div class="dock-hand"></div><div class="dock-mid">${outOfChips(state)}</div><div class="dock-side"></div>` };
    }
    if (seat.ready) {
      const waiting = view.seats.filter((s) => !s.ready && !s.sitOut).map((s) => state.room.players.find((p) => p.id === s.pid)).filter((p) => p && !p.bot && p.connected);
      return { sig: sig + waiting.length, html: `<div class="dock-hand"><span>Your bet</span><b>${fmt(seat.bet)}</b></div><div class="dock-mid"><p class="dock-note">${waiting.length ? `You're in. Waiting for ${waiting.map((p) => esc(p.name)).join(', ')}.` : 'You’re in. Dealing…'}</p></div><div class="dock-side"></div>` };
    }
    const tray = CHIP_VALUES.map((v) => `<button class="tray-chip" data-act="bj-add" data-v="${v}"${v > chips ? ' disabled' : ''} aria-label="Add ${v}">${chip(v)}</button>`).join('');
    const canRebet = seat.lastBet && seat.lastBet <= chips + seat.bet && seat.lastBet !== seat.bet;
    return {
      sig,
      html: `<div class="dock-hand"><span>Your bet</span><b>${fmt(seat.bet)}</b><small>Minimum ${min}</small></div>
      <div class="dock-mid bets">
        <div class="tray" role="group" aria-label="Add chips">${tray}</div>
        <div class="bet-acts">
          <button class="btn btn-quiet btn-sm" data-act="bj-clear"${seat.bet ? '' : ' disabled'}>Clear</button>
          ${canRebet ? `<button class="btn btn-quiet btn-sm" data-act="bj-rebet">Same as last time (${fmt(seat.lastBet)})</button>` : ''}
          <button class="btn btn-primary" data-act="bj-ready"${seat.bet >= min ? '' : ' disabled'}>Deal me in<kbd>↵</kbd></button>
        </div>
      </div>
      <div class="dock-side"><label class="toggle"><input type="checkbox" data-act="coach"${ui.coach ? ' checked' : ''}><span>Coach</span></label></div>`,
    };
  }

  if (view.phase === 'insurance') {
    if (me.insurance) {
      const cost = me.insurance.cost;
      return {
        sig,
        html: `<div class="dock-hand"><span>Dealer shows an ace</span><b>Insurance ${fmt(cost)}</b></div>
        <div class="dock-mid acts">
          <button class="btn btn-primary" data-act="bj-insure">Take insurance<kbd>Y</kbd></button>
          <button class="btn btn-dark" data-act="bj-decline">No thanks<kbd>N</kbd></button>
        </div>
        <div class="dock-side"><p class="dock-tip">Half your bet. Pays 2 to 1 if the dealer has blackjack.</p></div>`,
      };
    }
    const note = seat.insChoice === 'take' ? `Insured for ${fmt(seat.insurance)}. Waiting for the others.`
      : seat.insChoice === 'decline' ? 'No insurance. Waiting for the others.' : 'Waiting for the others to decide on insurance.';
    return { sig: sig + note, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">${note}</p></div><div class="dock-side"></div>` };
  }

  if (me.myTurn && me.options) {
    const o = me.options;
    const hint = ui.coach && me.hint ? me.hint : null;
    const btn = (k, label, key, cls = 'btn-dark') => o[k] ? `<button class="btn ${cls}${hint === k ? ' coached' : ''}" data-act="bj-${k}">${label}<kbd>${key}</kbd></button>` : '';
    return {
      sig,
      html: `<div class="dock-hand">${hint ? `<span>Coach says</span><b>${HINT_WORD[hint]}</b>` : '<span>Your move</span>'}</div>
      <div class="dock-mid acts">
        ${btn('hit', 'Hit', 'H', 'btn-primary')}${btn('stand', 'Stand', 'S')}${btn('double', 'Double', 'D')}${btn('split', 'Split', 'P')}
      </div>
      <div class="dock-side"><label class="toggle"><input type="checkbox" data-act="coach"${ui.coach ? ' checked' : ''}><span>Coach</span></label></div>`,
    };
  }

  let note = 'Waiting for the others.';
  if (view.phase === 'settle') {
    const net = seat.hands.reduce((a, h) => a + (h.net || 0), 0);
    note = seat.hands.length ? (net > 0 ? `You won ${fmt(net)}.` : net < 0 ? `You lost ${fmt(-net)}.` : 'You broke even.') : 'New round in a moment.';
  } else if (view.phase === 'dealer') note = 'Dealer’s turn.';
  else if (!seat.hands.length) note = 'You’ll be dealt in next round.';
  return { sig: sig + note, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">${note}</p></div><div class="dock-side"><label class="toggle"><input type="checkbox" data-act="coach"${ui.coach ? ' checked' : ''}><span>Coach</span></label></div>` };
}
