import { esc, fmt, signed, chip, CHIP_VALUES, outOfChips } from './parts.js?v=34';
import { WHEEL, colorOf, spotInfo } from '../games/roulette.js?v=34';

const SEG = 360 / 37;

export const colorName = (n) => ({ red: 'Red', black: 'Black', green: 'Green' })[colorOf(n)];

export { SEG };

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, a) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
const POCKET_IN = 60;
const POCKET_OUT = 86;

// The wedge for pocket `i` (0 is at 12 o'clock, going clockwise).
export function pocketPath(i, r = POCKET_IN, R = POCKET_OUT) {
  const a0 = rad((i - 0.5) * SEG - 90);
  const a1 = rad((i + 0.5) * SEG - 90);
  return `M${pt(r, a0)} L${pt(R, a0)} A${R},${R} 0 0 1 ${pt(R, a1)} L${pt(r, a1)} A${r},${r} 0 0 0 ${pt(r, a0)}Z`;
}

let wheelSeq = 0;

// Three stacked layers so the part that spins is a plain CSS rotate on its own compositor
// layer: a still base (bowl, track, studs), the rotor (pockets, cone, turret) and the ball.
export function wheelSvg() {
  const u = `w${++wheelSeq}`;
  const vb = 'viewBox="-100 -100 200 200" aria-hidden="true"';
  const pockets = WHEEL.map((n, i) => `<path d="${pocketPath(i)}" class="pk pk-${colorOf(n)}"/>`).join('');
  const labels = WHEEL.map((n, i) => `<text transform="rotate(${(i * SEG).toFixed(2)}) translate(0,-75.6)" class="pk-n">${n}</text>`).join('');
  const studs = Array.from({ length: 8 }, (_, k) => `<path d="M0,-95.6 L2.1,-91.8 L0,-88 L-2.1,-91.8Z" transform="rotate(${k * 45 + 22.5})" class="stud"/>`).join('');
  const arms = [0, 90, 180, 270].map((a) => `<path d="M0,-12 L0,-52" transform="rotate(${a + 45})" class="arm"/>`).join('');
  return `
<div class="wheel">
  <svg class="wl wl-base" ${vb}>
    <defs>
      <radialGradient id="${u}wood" cx="-.18" cy="-.2" r="1.15">
        <stop offset="0" stop-color="#7a4a2a"/><stop offset=".55" stop-color="#4a2a17"/><stop offset="1" stop-color="#21110a"/>
      </radialGradient>
      <radialGradient id="${u}trk" cx="0" cy="0" r="96" gradientUnits="userSpaceOnUse">
        <stop offset=".88" stop-color="#170c06"/><stop offset=".915" stop-color="#3b2212"/><stop offset=".955" stop-color="#6a4126"/><stop offset="1" stop-color="#2a170b"/>
      </radialGradient>
      <linearGradient id="${u}gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f6e2a0"/><stop offset=".5" stop-color="#b98a34"/><stop offset="1" stop-color="#f0d98c"/>
      </linearGradient>
    </defs>
    <circle r="99.4" fill="url(#${u}wood)"/>
    <circle r="97.4" fill="none" stroke="url(#${u}gold)" stroke-width="1.5"/>
    <circle r="95.8" fill="url(#${u}trk)"/>
    <circle r="86.6" fill="none" stroke="url(#${u}gold)" stroke-width="1.1"/>
    ${studs}
  </svg>
  <div class="wl wl-rotor"><svg ${vb}>
    <defs>
      <radialGradient id="${u}cone" cx="-.2" cy="-.25" r="1" >
        <stop offset="0" stop-color="#f0c866"/><stop offset=".38" stop-color="#9a6630"/><stop offset="1" stop-color="#3a2112"/>
      </radialGradient>
      <radialGradient id="${u}shade" cx="0" cy="0" r="86" gradientUnits="userSpaceOnUse">
        <stop offset=".69" stop-color="#000" stop-opacity=".5"/><stop offset=".84" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/>
      </radialGradient>
      <radialGradient id="${u}chrome" cx="-.3" cy="-.35" r="1">
        <stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#c9ccd2"/><stop offset="1" stop-color="#4b4f58"/>
      </radialGradient>
    </defs>
    <g class="rotor-g">
      ${pockets}
      <path d="M${pt(POCKET_OUT, 0)} A${POCKET_OUT},${POCKET_OUT} 0 1 1 ${pt(POCKET_OUT, Math.PI)} A${POCKET_OUT},${POCKET_OUT} 0 1 1 ${pt(POCKET_OUT, 0)} L${pt(POCKET_IN, 0)} A${POCKET_IN},${POCKET_IN} 0 1 0 ${pt(POCKET_IN, Math.PI)} A${POCKET_IN},${POCKET_IN} 0 1 0 ${pt(POCKET_IN, 0)}Z" fill="url(#${u}shade)" fill-rule="evenodd" class="ring-shade"/>
      ${labels}
      <circle r="60.4" fill="url(#${u}cone)"/>
      <circle r="45" fill="none" class="cone-line"/><circle r="30" fill="none" class="cone-line"/>
      ${arms}
      <circle r="13.5" class="turret"/>
      <circle r="6.2" fill="url(#${u}chrome)"/>
    </g>
  </svg></div>
  <div class="wl wl-ball" aria-hidden="true">
    ${[0, 1, 2, 3].map(() => '<i class="trail" style="opacity:0;transform:translate(0cqw,-45.5cqw)"></i>').join('')}
    <i class="ball-shadow" style="transform:translate(.55cqw,-44.7cqw)"></i>
    <i class="ball" style="transform:translate(0cqw,-45.5cqw)"></i>
  </div>
</div>`;
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
    const net = view.phase === 'result' && view.net ? view.net[p.id] : null;
    const status = net != null ? `<em class="${net > 0 ? 'up' : net < 0 ? 'down' : ''}">${net ? signed(net) : 'even'}</em>`
      : view.ready.includes(p.id) && t ? '<em>done</em>' : '';
    return `<li id="rr-${esc(p.id)}" data-pid="${esc(p.id)}" class="${t ? 'in' : 'idle'}${p.id === state.you ? ' me' : ''}" style="--c:${esc(p.color)}"><i></i><span class="rn">${esc(p.name)}</span><span class="rc2">${fmt(p.chips)}</span><b>${t ? fmt(t) : '—'}</b>${status}</li>`;
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
    <ul class="rl-totals" aria-label="Players at the table">${totals}</ul>
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
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid">${outOfChips(state)}</div><div class="dock-side"></div>` };
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
