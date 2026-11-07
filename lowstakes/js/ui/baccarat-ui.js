import { esc, fmt, signed, card, chipStack, chip, avatar, CHIP_VALUES } from './parts.js?v=25';
import { SPOTS, SPOT_LABEL } from '../games/baccarat.js?v=25';

const WORD = { player: 'Player', banker: 'Banker', tie: 'Tie' };
const HIST_LETTER = { player: 'P', banker: 'B', tie: 'T' };

function handBox(side, cards, pts, byId, state, view, won) {
  const bets = view.bets.filter((b) => b.spot === side);
  const byPid = {};
  for (const b of bets) byPid[b.pid] = (byPid[b.pid] || 0) + b.amount;
  const marks = Object.keys(byPid).map((pid) => {
    const p = byId[pid] || {};
    const mine = pid === state.you;
    return `<span class="bb-mark${mine ? ' mine' : ''}" style="--c:${esc(p.color || '#888')}" title="${esc(p.name || '')} bet ${fmt(byPid[pid])}">${mine ? fmt(byPid[pid]) : ''}</span>`;
  }).join('');
  return `
    <div class="bb-side bb-${side}${won ? ' won' : ''}">
      <div class="bb-label">${WORD[side]}</div>
      <div class="bb-cards">${cards.map((c, i) => card(c, { key: `bc${view.round}-${side}-${i}`, style: `--i:${i}` })).join('')}</div>
      <div class="bb-total">${cards.length ? pts : ''}</div>
      <div class="bb-marks">${marks}</div>
    </div>`;
}

export function stage(view, state) {
  const byId = Object.fromEntries(state.room.players.map((p) => [p.id, p]));
  const r = view.result;
  const showCards = view.player.length > 0 || view.banker.length > 0;

  const player = handBox('player', view.player, r ? r.pt : '', byId, state, view, r && r.winner === 'player');
  const banker = handBox('banker', view.banker, r ? r.bt : '', byId, state, view, r && r.winner === 'banker');

  let msg = '';
  if (view.phase === 'betting') {
    msg = view.betLeft != null ? `Bets close in <b class="countdown" data-ms="${view.betLeft}">${Math.ceil(view.betLeft / 1000)}</b>` : 'Place your bets';
  } else if (view.phase === 'dealing') msg = 'Dealing…';
  else if (r) {
    const natTxt = r.natural ? ' — natural' : '';
    msg = r.winner === 'tie' ? `Push${natTxt}. Player and banker bets return.` : `${WORD[r.winner]} wins${natTxt}.`;
  }

  const tray = SPOTS.filter((s) => s !== 'ppair' && s !== 'bpair').map((spot) => {
    const bets = view.bets.filter((b) => b.spot === spot);
    const mine = bets.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
    const others = [...new Set(bets.filter((b) => b.pid !== state.you).map((b) => b.pid))];
    const hit = view.phase === 'result' && r && (spot === r.winner);
    return `<button class="bc ${spot}${hit ? ' hit' : ''}" data-act="bc-bet" data-spot="${spot}" aria-label="Bet on ${SPOT_LABEL[spot]}">
      <span class="bc-l">${SPOT_LABEL[spot]}</span>
      <span class="bc-pay">${spot === 'tie' ? 'Pays 8 to 1' : spot === 'banker' ? 'Pays 19 to 20' : 'Pays 1 to 1'}</span>
      ${others.length ? `<span class="marks">${others.slice(0, 5).map((id) => `<i style="--c:${esc((byId[id] || {}).color || '#888')}"></i>`).join('')}</span>` : ''}
      ${mine ? `<span class="mine">${fmt(mine)}</span>` : ''}
    </button>`;
  }).join('');
  const pairs = ['ppair', 'bpair'].map((spot) => {
    const bets = view.bets.filter((b) => b.spot === spot);
    const mine = bets.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
    const hit = view.phase === 'result' && r && ((spot === 'ppair' && r.playerPair) || (spot === 'bpair' && r.bankerPair));
    return `<button class="bc pair${hit ? ' hit' : ''}" data-act="bc-bet" data-spot="${spot}" aria-label="Bet on ${SPOT_LABEL[spot]}">
      <span class="bc-l">${SPOT_LABEL[spot]}</span><span class="bc-pay">11 to 1</span>
      ${mine ? `<span class="mine">${fmt(mine)}</span>` : ''}
    </button>`;
  }).join('');

  const hist = view.history.map((w, i) => `<li class="bh-${w}${i === 0 && view.phase === 'result' ? ' fresh' : ''}">${HIST_LETTER[w]}</li>`).join('');

  return `
<div class="bcrt">
  <div class="bcrt-felt">
    <p class="bb-msg" aria-live="polite">${msg}</p>
    <div class="bb-table">${player}<div class="bb-vs">VS</div>${banker}</div>
    <ol class="history bc-history" aria-label="Recent results">${hist}</ol>
  </div>
  <div class="bc-tray">${tray}</div>
  <div class="bc-pairs">${pairs}</div>
</div>`;
}

export function dock(view, state, ui) {
  const player = state.room.players.find((p) => p.id === state.you);
  const chips = player ? player.chips : 0;
  const me = view.you;
  const sel = ui.chip || 25;
  const sig = JSON.stringify([view.phase, me, chips, sel]);
  if (view.phase !== 'betting') {
    let note;
    if (view.phase !== 'result') note = me.total ? 'Dealing…' : 'Next round in a moment.';
    else {
      const mine = (view.net && view.net[state.you]) || 0;
      note = mine > 0 ? `You won ${fmt(mine)}.` : mine < 0 ? `You lost ${fmt(-mine)}.` : me.total ? 'You broke even.' : 'Next round in a moment.';
    }
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">${note}</p></div><div class="dock-side"></div>` };
  }
  if (chips < view.settings.min && !me.total) {
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">You're out of chips.</p><button class="btn btn-primary" data-act="rebuy">Buy back in for ${fmt(state.room.settings.start)}</button></div><div class="dock-side"></div>` };
  }
  if (me.ready) {
    return { sig, html: `<div class="dock-hand"><span>On the table</span><b>${fmt(me.total)}</b></div><div class="dock-mid"><p class="dock-note">You're in. Dealing when everyone's ready.</p><button class="btn btn-quiet btn-sm" data-act="bc-unready">Change my bets</button></div><div class="dock-side"></div>` };
  }
  const values = [view.settings.min, ...CHIP_VALUES.filter((v) => v > view.settings.min)].slice(0, 5);
  return {
    sig,
    html: `<div class="dock-hand"><span>On the table</span><b>${fmt(me.total)}</b></div>
    <div class="dock-mid bets">
      <div class="tray" role="radiogroup" aria-label="Chip size">${values.map((v) => `<button class="tray-chip${v === sel ? ' sel' : ''}" role="radio" aria-checked="${v === sel}" data-act="bc-chip" data-v="${v}"${v > chips ? ' disabled' : ''}>${chip(v)}</button>`).join('')}</div>
      <div class="bet-acts">
        <button class="btn btn-quiet btn-sm" data-act="bc-undo"${me.total ? '' : ' disabled'}>Undo</button>
        <button class="btn btn-quiet btn-sm" data-act="bc-clear"${me.total ? '' : ' disabled'}>Clear</button>
        ${me.total ? `<button class="btn btn-quiet btn-sm" data-act="bc-double"${me.total <= chips ? '' : ' disabled'}>Double</button>` : me.canRebet ? '<button class="btn btn-quiet btn-sm" data-act="bc-rebet">Same again</button>' : ''}
        <button class="btn btn-primary" data-act="bc-ready"${me.total ? '' : ' disabled'}>Deal<kbd>↵</kbd></button>
      </div>
    </div>
    <div class="dock-side"><p class="dock-tip">Pick a chip, then tap Player, Banker or Tie.</p></div>`,
  };
}
