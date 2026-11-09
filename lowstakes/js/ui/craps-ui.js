import { esc, fmt, avatar, chip, CHIP_VALUES } from './parts.js?v=49';
import { PLACE_NUMS, HARD_NUMS, HARD_PAYS } from '../games/craps.js?v=49';

const DOTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};
// The rotation that brings each value to face the viewer (see css for the cube's face layout).
export const DIE_ROT = { 1: 'rotateX(0deg) rotateY(0deg)', 2: 'rotateY(-90deg)', 3: 'rotateX(-90deg)', 4: 'rotateX(90deg)', 5: 'rotateY(90deg)', 6: 'rotateY(180deg)' };

function face(cls, n) {
  return `<div class="f ${cls}">${DOTS[n].map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('')}</div>`;
}

export function dieSvg(value, id) {
  const rot = DIE_ROT[value] || DIE_ROT[1];
  return `<div class="die" id="${id}" style="--rot:${rot}">
    <div class="die-in">
      ${face('f1', 1)}${face('f2', 2)}${face('f3', 3)}${face('f4', 4)}${face('f5', 5)}${face('f6', 6)}
    </div>
  </div>`;
}

const PLACE_ODDS_LABEL = { 4: '9 to 5', 10: '9 to 5', 5: '7 to 5', 9: '7 to 5', 6: '7 to 6', 8: '7 to 6' };
const ODDS = (n) => PLACE_ODDS_LABEL[n];

function numSpot(n, view, state, byId) {
  const place = view.bets.filter((b) => b.spot === `place:${n}`);
  const placeMine = place.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
  const placeOthers = [...new Set(place.filter((b) => b.pid !== state.you).map((b) => b.pid))];
  const hard = HARD_NUMS.includes(n) ? view.bets.filter((b) => b.spot === `hard:${n}`) : [];
  const hardMine = hard.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
  const hardOthers = [...new Set(hard.filter((b) => b.pid !== state.you).map((b) => b.pid))];
  const isPoint = view.point === n;
  const hit = view.phase === 'result' && view.lastRoll && view.lastRoll.sum === n;
  const sevened = view.phase === 'result' && view.lastRoll && view.lastRoll.sum === 7;
  return `
    <div class="cr-num${isPoint ? ' on' : ''}">
      <button class="cr-place${hit && !sevened ? ' hit' : ''}${sevened ? ' lose' : ''}" data-act="cr-bet" data-spot="place:${n}" aria-label="Place ${n}">
        <span class="cr-n">${n}</span>
        <span class="cr-odds">${ODDS(n)}</span>
        ${placeOthers.length ? `<span class="marks">${placeOthers.slice(0, 4).map((id) => `<i style="--c:${esc((byId[id] || {}).color || '#888')}"></i>`).join('')}</span>` : ''}
        ${placeMine ? `<span class="mine">${fmt(placeMine)}</span>` : ''}
      </button>
      ${isPoint ? '<span class="puck">ON</span>' : ''}
      ${HARD_NUMS.includes(n) ? `
      <button class="cr-hard${hit && view.lastRoll.hard && !sevened ? ' hit' : ''}${(sevened || (hit && !view.lastRoll.hard)) ? ' lose' : ''}" data-act="cr-bet" data-spot="hard:${n}" aria-label="Hard ${n}">
        <span class="cr-hard-dice">${dieSvg(n / 2, `hs${n}a`)}${dieSvg(n / 2, `hs${n}b`)}</span>
        <span class="cr-odds">${HARD_PAYS[n]} to 1</span>
        ${hardOthers.length ? `<span class="marks">${hardOthers.slice(0, 4).map((id) => `<i style="--c:${esc((byId[id] || {}).color || '#888')}"></i>`).join('')}</span>` : ''}
        ${hardMine ? `<span class="mine">${fmt(hardMine)}</span>` : ''}
      </button>` : '<div class="cr-hard-gap"></div>'}
    </div>`;
}

function lineSpot(spot, label, odds, view, state, byId, cls) {
  const bets = view.bets.filter((b) => b.spot === spot);
  const mine = bets.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
  const others = [...new Set(bets.filter((b) => b.pid !== state.you).map((b) => b.pid))];
  const r = view.lastRoll;
  const outcome = view.phase === 'result' && r && r.line ? r.line[spot] : null;
  const locked = spot !== 'field' && view.point !== null && !mine;
  return `<button class="cr-line ${cls}${outcome ? ' ' + outcome : ''}${locked ? ' locked' : ''}" data-act="cr-bet" data-spot="${spot}" aria-label="${label}"${locked ? ' disabled' : ''}>
    <span class="cr-l">${label}</span><span class="cr-odds">${odds}</span>
    ${others.length ? `<span class="marks">${others.slice(0, 5).map((id) => `<i style="--c:${esc((byId[id] || {}).color || '#888')}"></i>`).join('')}</span>` : ''}
    ${mine ? `<span class="mine">${fmt(mine)}</span>` : ''}
  </button>`;
}

export function stage(view, state) {
  const byId = Object.fromEntries(state.room.players.map((p) => [p.id, p]));
  const shooter = byId[view.shooter];
  const rolling = view.phase === 'rolling';
  const dice = view.dice || [1, 1];

  let msg = '';
  if (view.phase === 'betting') {
    const left = view.betLeft != null ? Math.ceil(view.betLeft / 1000) : null;
    msg = left != null
      ? `${view.point ? `Point is ${view.point}.` : "Come out."} <b class="countdown" data-ms="${view.betLeft}">${left}</b>`
      : (view.point ? `Point is ${view.point}.` : 'Come out roll.');
  } else if (rolling) msg = 'Rolling…';
  else if (view.lastRoll) msg = view.lastRoll.notes.join(' ') || `Rolled ${view.lastRoll.sum}.`;

  const field = { 2: 'Pays 2 to 1', 3: '', 4: '', 9: '', 10: '', 11: '', 12: 'Pays 3 to 1' };
  const fieldHit = view.phase === 'result' && view.lastRoll && [2, 3, 4, 9, 10, 11, 12].includes(view.lastRoll.sum);
  const fbets = view.bets.filter((b) => b.spot === 'field');
  const fmine = fbets.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
  const fothers = [...new Set(fbets.filter((b) => b.pid !== state.you).map((b) => b.pid))];

  const hist = view.history.map((h, i) => `<li class="ch-${h.sum === 7 ? 'seven' : 'n'}${i === 0 && view.phase === 'result' ? ' fresh' : ''}">${h.sum}</li>`).join('');

  return `
<div class="craps">
  <div class="cr-felt">
    <div class="cr-shooter">
      ${shooter ? `${avatar(shooter, 'xs')}<span>${esc(shooter.name)} ${shooter.id === state.you ? 'has' : 'has'} the dice</span>` : ''}
    </div>
    <div class="cr-dice" id="dice-box" data-static="1">
      ${dieSvg(dice[0], 'die1')}${dieSvg(dice[1], 'die2')}
      <div class="cr-sum" id="dice-sum"></div>
    </div>
    <p class="cr-msg" aria-live="polite">${msg}</p>
    <ol class="history cr-history" aria-label="Recent rolls">${hist}</ol>
  </div>

  <div class="cr-layout">
    <div class="cr-lines">
      ${lineSpot('pass', 'Pass line', '1 to 1', view, state, byId, 'pass')}
      ${lineSpot('dpass', "Don't pass", '1 to 1', view, state, byId, 'dpass')}
    </div>
    <div class="cr-nums">${PLACE_NUMS.map((n) => numSpot(n, view, state, byId)).join('')}</div>
    <button class="cr-field${fieldHit ? ' hit' : ''}" data-act="cr-bet" data-spot="field" aria-label="Field">
      <span class="cr-l">Field</span>
      <span class="cr-field-nums">${[2, 3, 4, 9, 10, 11, 12].map((n) => `<i class="${n === 2 || n === 12 ? 'big' : ''}">${n}</i>`).join('')}</span>
      ${fothers.length ? `<span class="marks">${fothers.slice(0, 5).map((id) => `<i style="--c:${esc((byId[id] || {}).color || '#888')}"></i>`).join('')}</span>` : ''}
      ${fmine ? `<span class="mine">${fmt(fmine)}</span>` : ''}
    </button>
  </div>
</div>`;
}

export function dock(view, state, ui) {
  const player = state.room.players.find((p) => p.id === state.you);
  const chips = player ? player.chips : 0;
  const me = view.you;
  const sel = ui.chip || 10;
  const sig = JSON.stringify([view.phase, me, chips, sel, view.point]);

  if (chips < view.settings.min && !me.total) {
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">You're out of chips.</p><button class="btn btn-primary" data-act="rebuy">Buy back in for ${fmt(state.room.settings.start)}</button></div><div class="dock-side"></div>` };
  }
  if (me.canRoll) {
    return {
      sig,
      html: `<div class="dock-hand"><span>You have the dice</span><b>${view.point ? `Point ${view.point}` : 'Come out'}</b></div>
      <div class="dock-mid"><button class="btn btn-primary" data-act="cr-roll">Roll the dice<kbd>↵</kbd></button></div>
      <div class="dock-side"></div>`,
    };
  }
  if (view.phase !== 'betting') {
    const mine = view.net && view.net[state.you];
    const note = view.phase === 'rolling' ? (me.total ? `You have ${fmt(me.total)} riding on this.` : 'Watching this roll.')
      : mine > 0 ? `You won ${fmt(mine)}.` : mine < 0 ? `You lost ${fmt(-mine)}.` : 'Nothing resolved for you that roll.';
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">${note}</p></div><div class="dock-side"></div>` };
  }
  const values = [view.settings.min, ...CHIP_VALUES.filter((v) => v > view.settings.min)].slice(0, 5);
  return {
    sig,
    html: `<div class="dock-hand"><span>On the table</span><b>${fmt(me.total)}</b></div>
    <div class="dock-mid bets">
      <div class="tray" role="radiogroup" aria-label="Chip size">${values.map((v) => `<button class="tray-chip${v === sel ? ' sel' : ''}" role="radio" aria-checked="${v === sel}" data-act="cr-chip" data-v="${v}"${v > chips ? ' disabled' : ''}>${chip(v)}</button>`).join('')}</div>
      <div class="bet-acts">
        <button class="btn btn-quiet btn-sm" data-act="cr-undo"${me.total ? '' : ' disabled'}>Undo</button>
        <button class="btn btn-quiet btn-sm" data-act="cr-clear"${me.total ? '' : ' disabled'}>Clear</button>
      </div>
    </div>
    <div class="dock-side"><p class="dock-tip">Pick a chip, then tap a bet. ${view.point ? '' : 'Pass or don’t pass before the come-out.'}</p></div>`,
  };
}
