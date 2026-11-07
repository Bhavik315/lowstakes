import { esc, fmt, signed, chip, CHIP_VALUES } from './parts.js?v=5';
import { WHEEL, colorOf, spotInfo } from '../games/roulette.js?v=5';

const SEG = 360 / 37;

export const colorName = (n) => ({ red: 'Red', black: 'Black', green: 'Green' })[colorOf(n)];

export function wheelSvg() {
  const pockets = WHEEL.map((n, i) => {
    const a0 = ((i - 0.5) * SEG - 90) * (Math.PI / 180);
    const a1 = ((i + 0.5) * SEG - 90) * (Math.PI / 180);
    const R = 86;
    const r = 60;
    const p = (rad, a) => `${(rad * Math.cos(a)).toFixed(2)},${(rad * Math.sin(a)).toFixed(2)}`;
    const d = `M${p(r, a0)} L${p(R, a0)} A${R},${R} 0 0 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 0 0 ${p(r, a0)}Z`;
    const c = colorOf(n);
    return `<path d="${d}" class="pk pk-${c}"/>
      <text transform="rotate(${(i * SEG).toFixed(2)}) translate(0,-77)" class="pk-n">${n}</text>`;
  }).join('');
  const frets = Array.from({ length: 8 }, (_, i) => `<path d="M0,-58 L0,-26" transform="rotate(${i * 45})" class="spoke"/>`).join('');
  return `
<svg class="wheel" viewBox="-100 -100 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="cone" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(60)">
      <stop offset="0" stop-color="#d9a441"/><stop offset=".35" stop-color="#7a4a26"/><stop offset="1" stop-color="#3b2014"/>
    </radialGradient>
    <radialGradient id="bowl" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(100)">
      <stop offset=".86" stop-color="#2a170e"/><stop offset=".92" stop-color="#6b3f22"/><stop offset="1" stop-color="#2a170e"/>
    </radialGradient>
  </defs>
  <circle r="99" fill="url(#bowl)"/>
  <circle r="88" class="track"/>
  <g class="rotor">
    ${pockets}
    <circle r="60" fill="url(#cone)"/>
    ${frets}
    <circle r="14" class="turret"/><circle r="6" class="turret-top"/>
  </g>
  ${[0, 1, 2, 3, 4].map(() => '<circle class="trail" r="3.4" cx="0" cy="-92" style="opacity:0"/>').join('')}
  <circle class="ball" r="3.6" cx="0" cy="-92"/>
</svg>`;
}

function cell(spot, label, d, m, cls, view, state) {
  const bets = view.bets.filter((b) => b.spot === spot);
  const mine = bets.filter((b) => b.pid === state.you).reduce((a, b) => a + b.amount, 0);
  const others = [...new Set(bets.filter((b) => b.pid !== state.you).map((b) => b.pid))];
  const byId = Object.fromEntries(state.room.players.map((p) => [p.id, p]));
  const hit = view.phase === 'result' && view.result != null && spotInfo(spot).nums.includes(view.result);
  const style = `--c:${d[0]};--r:${d[1]};--cs:${d[2] || 1};--rs:${d[3] || 1};--mc:${m[0]};--mr:${m[1]};--mcs:${m[2] || 1};--mrs:${m[3] || 1}`;
  return `<button class="rc ${cls}${hit ? ' hit' : ''}" style="${style}" data-act="rl-bet" data-spot="${spot}" aria-label="Bet on ${esc(label)}">
    <span class="rc-l">${label}</span>
    ${others.length ? `<span class="marks">${others.slice(0, 4).map((id) => `<i style="--c:${esc((byId[id] || {}).color || '#888')}" title="${esc((byId[id] || {}).name || '')}"></i>`).join('')}</span>` : ''}
    ${mine ? `<span class="mine">${fmt(mine)}</span>` : ''}
  </button>`;
}

export function layout(view, state) {
  const cells = [];
  cells.push(cell('n:0', '0', [1, 1, 1, 3], [3, 1, 3, 1], 'num green zero', view, state));
  for (let n = 1; n <= 36; n++) {
    const d = [2 + Math.floor((n - 1) / 3), 3 - ((n - 1) % 3)];
    const m = [3 + ((n - 1) % 3), 2 + Math.floor((n - 1) / 3)];
    cells.push(cell(`n:${n}`, String(n), d, m, `num ${colorOf(n)}`, view, state));
  }
  for (let c = 1; c <= 3; c++) cells.push(cell(`col:${c}`, '2 to 1', [14, 4 - c], [2 + c, 14], 'out col', view, state));
  const dz = ['1st 12', '2nd 12', '3rd 12'];
  for (let z = 1; z <= 3; z++) cells.push(cell(`dozen:${z}`, dz[z - 1], [2 + (z - 1) * 4, 4, 4, 1], [2, 2 + (z - 1) * 4, 1, 4], 'out dozen', view, state));
  const outs = [['low', '1 to 18'], ['even', 'Even'], ['red', 'Red'], ['black', 'Black'], ['odd', 'Odd'], ['high', '19 to 36']];
  outs.forEach(([k, l], i) => cells.push(cell(k, l, [2 + i * 2, 5, 2, 1], [1, 2 + i * 2, 1, 2], `out even-money o-${k}`, view, state)));
  return `<div class="rl-layout" role="group" aria-label="Betting layout">${cells.join('')}</div>`;
}

export function stage(view, state) {
  const byId = Object.fromEntries(state.room.players.map((p) => [p.id, p]));
  const hist = view.history.map((n, i) => `<li class="h-${colorOf(n)}${i === 0 && view.phase === 'result' ? ' fresh' : ''}">${n}</li>`).join('');
  let msg = '';
  if (view.phase === 'betting') {
    msg = view.betLeft != null ? `Bets close in <b class="countdown" data-ms="${view.betLeft}">${Math.ceil(view.betLeft / 1000)}</b>` : 'Place your bets';
  } else if (view.phase === 'spinning') msg = 'No more bets';
  else if (view.phase === 'result') {
    const nets = Object.entries(view.net || {}).sort((a, b) => b[1] - a[1]);
    const word = { red: 'Red', black: 'Black', green: 'Green' }[colorOf(view.result)];
    msg = `<span class="big-n n-${colorOf(view.result)}">${view.result}</span><span class="rl-word">${word}.</span> ${nets.slice(0, 4).map(([id, v]) =>
      `<span class="rl-net">${esc((byId[id] || {}).name || '?')} <b class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v ? signed(v) : 'even'}</b></span>`).join('')}`;
  }

  const totals = state.room.players.map((p) => {
    const t = view.bets.filter((b) => b.pid === p.id).reduce((a, b) => a + b.amount, 0);
    return t ? `<li style="--c:${esc(p.color)}"><i></i>${esc(p.name)}<b>${fmt(t)}</b>${view.ready.includes(p.id) ? '<em>done</em>' : ''}</li>` : '';
  }).join('');

  return `
<div class="rl">
  <div class="rl-wheel">
    <div class="wheel-box" data-static="1" id="wheel-box">${wheelSvg()}</div>
    <ol class="history" aria-label="Recent numbers">${hist}</ol>
  </div>
  <div class="rl-board">
    <p class="rl-msg" aria-live="polite">${msg}</p>
    ${layout(view, state)}
    <ul class="rl-totals">${totals}</ul>
  </div>
</div>`;
}

export function dock(view, state, ui) {
  const player = state.room.players.find((p) => p.id === state.you);
  const chips = player ? player.chips : 0;
  const me = view.you;
  const sel = ui.chip || 25;
  const sig = JSON.stringify([view.phase, me, chips, sel]);
  if (view.phase !== 'betting') {
    const mine = view.net && view.net[state.you];
    const note = view.phase === 'spinning' ? (me.total ? `You have ${fmt(me.total)} riding on this.` : 'Watching this one.')
      : mine > 0 ? `You won ${fmt(mine)}.` : mine < 0 ? `You lost ${fmt(-mine)}.` : 'Next round in a moment.';
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">${note}</p></div><div class="dock-side"></div>` };
  }
  if (chips < view.settings.min && !me.total) {
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">You're out of chips.</p><button class="btn btn-primary" data-act="rebuy">Buy back in for ${fmt(state.room.settings.start)}</button></div><div class="dock-side"></div>` };
  }
  if (me.ready) {
    return { sig, html: `<div class="dock-hand"><span>On the table</span><b>${fmt(me.total)}</b></div><div class="dock-mid"><p class="dock-note">You're done. Spinning when everyone else is.</p><button class="btn btn-quiet btn-sm" data-act="rl-unready">Change my bets</button></div><div class="dock-side"></div>` };
  }
  const values = [view.settings.min, ...CHIP_VALUES.filter((v) => v > view.settings.min)].slice(0, 5);
  return {
    sig,
    html: `<div class="dock-hand"><span>On the table</span><b>${fmt(me.total)}</b></div>
    <div class="dock-mid bets">
      <div class="tray" role="radiogroup" aria-label="Chip size">${values.map((v) => `<button class="tray-chip${v === sel ? ' sel' : ''}" role="radio" aria-checked="${v === sel}" data-act="rl-chip" data-v="${v}"${v > chips ? ' disabled' : ''}>${chip(v)}</button>`).join('')}</div>
      <div class="bet-acts">
        <button class="btn btn-quiet btn-sm" data-act="rl-undo"${me.total ? '' : ' disabled'}>Undo</button>
        <button class="btn btn-quiet btn-sm" data-act="rl-clear"${me.total ? '' : ' disabled'}>Clear</button>
        ${me.total ? `<button class="btn btn-quiet btn-sm" data-act="rl-double"${me.total <= chips ? '' : ' disabled'}>Double</button>` : me.canRebet ? '<button class="btn btn-quiet btn-sm" data-act="rl-rebet">Same again</button>' : ''}
        <button class="btn btn-primary" data-act="rl-ready"${me.total ? '' : ' disabled'}>Spin<kbd>↵</kbd></button>
      </div>
    </div>
    <div class="dock-side"><p class="dock-tip">Pick a chip, then tap the layout.</p></div>`,
  };
}
