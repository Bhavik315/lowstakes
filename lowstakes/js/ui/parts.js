// Small markup builders shared by every screen.
import { Ads } from '../ads.js?v=30';

export const ROCKET_SVG = `<svg class="mini-crash" viewBox="0 0 90 90" aria-hidden="true"><g transform="rotate(45 45 45)">
<path d="M45 70 C37 78 40 88 45 92 C50 88 53 78 45 70Z" fill="#FFB43C"/><path d="M45 70 C41 75 42 82 45 85 C48 82 49 75 45 70Z" fill="#FFF3B0"/>
<path d="M33 52 L20 68 L35 64Z" fill="#C8312A"/><path d="M57 52 L70 68 L55 64Z" fill="#C8312A"/>
<path d="M45 6 C57 16 60 34 58 62 L32 62 C30 34 33 16 45 6Z" fill="#FFFDF7"/><path d="M45 6 C57 16 60 34 58 62 L52 62 C54 36 51 18 45 6Z" fill="#CFC6B4"/>
<path d="M45 6 C52 12 56 20 57.500 28 L32.500 28 C34 20 38 12 45 6Z" fill="#E0472F"/>
<rect x="32" y="52" width="26" height="6" fill="#E0472F"/>
<circle cx="45" cy="40" r="7.500" fill="#10302A"/><circle cx="43.500" cy="38.500" r="4.800" fill="#6FC3E8"/></g></svg>`;
// The out-of-chips button: a rewarded ad when a network is connected, otherwise the free rebuy.
export const refillLabel = (n) => (Ads.enabled() ? `Watch an ad to refill ${fmt(n)}` : `Buy back in for ${fmt(n)}`);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

const SUIT_NAME = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK_LABEL = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
const RANK_WORD = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: '10' };

// Pip positions on a 3 x 7 grid (col, row); rows > 4 are drawn upside down.
const PIPS = {
  2: [[2, 1], [2, 7]],
  3: [[2, 1], [2, 4], [2, 7]],
  4: [[1, 1], [3, 1], [1, 7], [3, 7]],
  5: [[1, 1], [3, 1], [2, 4], [1, 7], [3, 7]],
  6: [[1, 1], [3, 1], [1, 4], [3, 4], [1, 7], [3, 7]],
  7: [[1, 1], [3, 1], [2, 2.5], [1, 4], [3, 4], [1, 7], [3, 7]],
  8: [[1, 1], [3, 1], [2, 2.5], [1, 4], [3, 4], [2, 5.5], [1, 7], [3, 7]],
  9: [[1, 1], [3, 1], [1, 3], [3, 3], [2, 4], [1, 5], [3, 5], [1, 7], [3, 7]],
  10: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3], [1, 5], [3, 5], [2, 6], [1, 7], [3, 7]],
};

export const suitSvg = (s, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#suit-${s}"/></svg>`;

export function cardLabel(c) {
  if (!c || c === '??') return 'face-down card';
  const r = c[0];
  return `${RANK_WORD[r] || r} of ${SUIT_NAME[c[1]]}`;
}

function face(c) {
  const r = c[0];
  const s = c[1];
  const label = RANK_LABEL[r] || r;
  const n = r === 'T' ? 10 : Number(r);
  let middle;
  if (r === 'A') {
    middle = `<div class="ace">${suitSvg(s)}</div>`;
  } else if ('JQK'.includes(r)) {
    middle = `<div class="court"><b>${r}</b>${suitSvg(s)}</div>`;
  } else {
    middle = `<div class="pips">${PIPS[n].map(([x, y]) =>
      `<i style="left:${[0, 12, 50, 88][x]}%;top:${10 + (y - 1) * 13.33}%"${y > 4 ? ' class="flip"' : ''}>${suitSvg(s)}</i>`).join('')}</div>`;
  }
  return `<span class="ix">${label}${suitSvg(s)}</span>${middle}<span class="ix ix-b">${label}${suitSvg(s)}</span>`;
}

// `key` must be stable for the lifetime of the card so the DOM node is
// reused (that's what lets a face-down card flip over in place).
export function card(c, { key, cls = '', style = '' } = {}) {
  const down = !c || c === '??';
  const red = !down && (c[1] === 'h' || c[1] === 'd');
  return `<div class="card${down ? ' down' : ''}${red ? ' red' : ''} ${cls}"${key ? ` id="${key}"` : ''} style="${style}" role="img" aria-label="${cardLabel(c)}">
    <div class="card-in"><div class="card-face">${down ? '' : face(c)}</div><div class="card-back"></div></div></div>`;
}

// Chip denominations and colours.
const DENOMS = [
  [5000, 'k5'], [1000, 'k1'], [500, 'c500'], [100, 'c100'], [25, 'c25'], [5, 'c5'], [1, 'c1'],
];
export const CHIP_VALUES = [5, 25, 100, 500, 1000];
export const chipClass = (v) => (DENOMS.find(([d]) => d === v) || [0, 'c1'])[1];

export function chipStack(amount, max = 9) {
  if (!amount) return '';
  const chips = [];
  let left = amount;
  for (const [d, cls] of DENOMS) {
    while (left >= d && chips.length < 40) { chips.push(cls); left -= d; }
  }
  if (left > 0 || !chips.length) chips.push('c1');
  // Group by colour into short towers, biggest first.
  const towers = [];
  for (const cls of chips) {
    const t = towers.find((x) => x.cls === cls);
    if (t) t.n++; else towers.push({ cls, n: 1 });
  }
  return `<span class="stack">${towers.slice(0, 3).map((t) =>
    `<span class="tower">${Array.from({ length: Math.min(t.n, max) }, (_, i) => `<i class="chip ${t.cls}" style="--n:${i}"></i>`).join('')}</span>`).join('')}</span>`;
}

export function chip(value, extra = '') {
  return `<span class="chip big ${chipClass(value)} ${extra}"><b>${value >= 1000 ? value / 1000 + 'k' : value}</b></span>`;
}

export function avatar(p, size = '') {
  if (!p) return '';
  const initial = esc((p.name || '?').trim()[0] || '?').toUpperCase();
  return `<span class="avatar ${size}${p.bot ? ' bot' : ''}" style="--c:${esc(p.color)}" aria-hidden="true"><b>${initial}</b></span>`;
}

export function initialsLabel(p) { return p ? esc(p.name) : ''; }
