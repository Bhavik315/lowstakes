import { esc, fmt, signed, chip, avatar, CHIP_VALUES, outOfChips } from './parts.js?v=38';
import { AUTO_CHOICES } from '../games/crash.js?v=38';

const fx = (x) => `${x.toFixed(2)}x`;
const tier = (x) => (x < 2 ? 'lo' : x < 10 ? 'mid' : 'hi');

// ---------------------------------------------------------------- stage
function rosterRow(p, view, you) {
  const b = view.bets.find((x) => x.pid === p.id);
  const crashed = view.phase === 'crashed';
  const running = view.phase === 'running';
  let state = 'idle';
  let label = '—';
  let amt = '';
  if (b) {
    amt = fmt(b.amount);
    if (b.cashed !== null) { state = 'won'; label = `${fx(b.cashed)} ${signed(b.payout - b.amount)}`; }
    else if (crashed) { state = 'bust'; label = `Busted ${signed(-b.amount)}`; }
    else if (running) { state = 'in'; label = b.auto && p.id === you ? `Auto ${fx(b.auto)}` : 'Riding'; }
    else { state = 'in'; label = view.ready.includes(p.id) ? 'Ready' : 'Bet in'; }
  } else label = running || crashed ? 'Watching' : 'No bet yet';
  return `<li id="cr-${esc(p.id)}" data-pid="${esc(p.id)}" class="cr-p ${state}${p.id === you ? ' me' : ''}" style="--c:${esc(p.color)}">
    <i></i><span class="n">${esc(p.name)}</span><span class="b">${amt}</span><span class="s">${label}</span>
  </li>`;
}

export function stage(view, state) {
  const hist = view.history.map((x, i) => `<li class="ch-${tier(x)}${i === 0 && view.phase === 'crashed' ? ' fresh' : ''}">${fx(x)}</li>`).join('');
  const roster = state.room.players.map((p) => rosterRow(p, view, state.you)).join('');
  return `
<div class="cr">
  <ol class="cr-hist" aria-label="Recent crash points">${hist || '<li class="none">No rounds yet</li>'}</ol>
  <div class="cr-graph" id="cr-graph" data-static="1">
    <canvas id="cr-canvas" aria-hidden="true"></canvas>
    <div class="cr-read" role="status" aria-live="polite">
      <div class="cr-mult" id="cr-mult">1.00x</div>
      <div class="cr-sub" id="cr-sub"></div>
    </div>
  </div>
  <ul class="cr-roster" aria-label="Players at the table">${roster}</ul>
</div>`;
}

// ---------------------------------------------------------------- dock
export function dock(view, state, ui) {
  const player = state.room.players.find((p) => p.id === state.you);
  const chips = player ? player.chips : 0;
  const me = view.you;
  const sel = ui.chip || 25;
  const sig = JSON.stringify([view.phase, view.round, me, chips, sel]);
  const empty = (note, extra = '') => ({ sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">${note}</p>${extra}</div><div class="dock-side"></div>` });

  if (view.phase === 'running') {
    if (me.canCashout) {
      return {
        sig,
        html: `<div class="dock-hand"><span>On the table</span><b>${fmt(me.total)}</b></div>
        <div class="dock-mid"><button class="btn btn-primary cr-cash" data-act="cr-cash"><span>Cash out</span><b data-live="cr-payout">${fmt(me.total)}</b><small data-live="cr-x">1.00x</small><kbd>Space</kbd></button></div>
        <div class="dock-side">${me.auto ? `<p class="dock-tip">Auto cash-out at ${fx(me.auto)}</p>` : ''}</div>`,
      };
    }
    if (me.cashed !== null) return empty(`Cashed out at ${fx(me.cashed)}. Watching it fly.`);
    return empty(me.total ? 'Riding…' : 'Watching this one. Bet in the next round.');
  }
  if (view.phase === 'crashed') {
    const mine = view.net && view.net[state.you];
    if (!me.total) return empty('Next round in a moment.');
    return empty(mine > 0 ? `You won ${fmt(mine)}.` : mine < 0 ? `Crashed at ${fx(view.crashAt)}. You lost ${fmt(-mine)}.` : 'You broke even.');
  }
  if (chips < view.settings.min && !me.total) {
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid">${outOfChips(state)}</div><div class="dock-side"></div>` };
  }
  if (me.ready) {
    return empty(`You're in for ${fmt(me.total)}. Launching when everyone is ready.`, '<button class="btn btn-quiet btn-sm" data-act="cr-unready">Change my bet</button>');
  }
  const values = [view.settings.min, ...CHIP_VALUES.filter((v) => v > view.settings.min)].slice(0, 5);
  const autoOpts = ['<option value="">Auto: off</option>', ...AUTO_CHOICES.map((x) => `<option value="${x}"${me.auto === x ? ' selected' : ''}>Auto ${fx(x)}</option>`)];
  if (me.auto && !AUTO_CHOICES.includes(me.auto)) autoOpts.push(`<option value="${me.auto}" selected>Auto ${fx(me.auto)}</option>`);
  return {
    sig,
    html: `<div class="dock-hand"><span>Your bet</span><b>${fmt(me.total)}</b></div>
    <div class="dock-mid bets">
      <div class="tray" role="group" aria-label="Add chips">${values.map((v) => `<button class="tray-chip" data-act="cr-add" data-v="${v}"${v > chips ? ' disabled' : ''} aria-label="Add ${v}">${chip(v)}</button>`).join('')}</div>
      <div class="bet-acts">
        <button class="btn btn-quiet btn-sm" data-act="cr-clear"${me.total ? '' : ' disabled'}>Clear</button>
        ${!me.total && me.canRebet ? '<button class="btn btn-quiet btn-sm" data-act="cr-rebet">Same again</button>' : ''}
        <label class="cr-auto"><span>Auto cash-out</span><select data-act="cr-auto" aria-label="Auto cash-out"${me.total ? '' : ' disabled'}>${autoOpts.join('')}</select></label>
        <button class="btn btn-primary" data-act="cr-ready"${me.total ? '' : ' disabled'}>Launch<kbd>↵</kbd></button>
      </div>
    </div>
    <div class="dock-side"><p class="dock-tip">Bet, then cash out before it crashes.</p></div>`,
  };
}

// ---------------------------------------------------------------- the graph
// The crash point is decided by the game. Here we only draw the climb: the multiplier is
// exp(growth * time), extrapolated between snapshots, and the final picture comes from the game.
const CR = { raf: 0, view: null, at: 0, base: 0, crashedAt: 0, round: -1, size: '', cols: null };

function colours() {
  if (CR.cols) return CR.cols;
  const cs = getComputedStyle(document.documentElement);
  const v = (n, d) => (cs.getPropertyValue(n) || d).trim() || d;
  CR.cols = { cream: v('--cream', '#F5EBDD'), dim: v('--cream-dim', 'rgba(245,235,221,.68)'), mustard: v('--mustard', '#F2BE45'), red: v('--vermilion', '#E0472F'), line: v('--cream-faint', 'rgba(245,235,221,.12)') };
  return CR.cols;
}

function estimate(view, now) {
  const dt = now - CR.at;
  if (view.phase === 'running') {
    const el = CR.base + dt;
    return { el, m: Math.max(1, Math.floor(Math.exp((view.growth * el) / 1000) * 100) / 100) };
  }
  if (view.phase === 'crashed') return { el: (Math.log(view.crashAt) / view.growth) * 1000, m: view.crashAt };
  return { el: 0, m: 1 };
}

function draw(canvas, view, el, m, now) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const size = `${w}x${h}x${dpr}`;
  if (size !== CR.size) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); CR.size = size; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const c = colours();
  const crashed = view.phase === 'crashed';
  const pad = { l: 42, r: 18, t: 18, b: 26 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const xMax = Math.max(10000, el * 1.18);
  const yMax = Math.max(2, m * 1.2);
  const X = (t) => pad.l + (t / xMax) * pw;
  const Y = (x) => pad.t + ph - ((x - 1) / (yMax - 1)) * ph;

  // grid and axis labels
  g.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.lineWidth = 1;
  const marks = [1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000].filter((x) => x < yMax);
  marks.unshift(1);
  for (const x of marks) {
    const y = Y(x);
    g.strokeStyle = c.line; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke();
    g.fillStyle = c.dim; g.textAlign = 'right'; g.fillText(`${x}x`, pad.l - 7, y);
  }
  g.textAlign = 'center'; g.textBaseline = 'top';
  const step = xMax > 40000 ? 20 : xMax > 20000 ? 10 : 5;
  for (let s = 0; s * 1000 <= xMax; s += step) { g.fillStyle = c.dim; g.fillText(`${s}s`, X(s * 1000), h - pad.b + 8); }

  // The rocket flies the curve. Behind it, smoke puffs mark where it has been.
  const rs = Math.max(18, Math.min(38, w / 15));
  const idle = view.phase === 'betting';
  const exploded = view.phase === 'crashed';
  const age = exploded ? Math.max(0, now - CR.crashedAt) : 0;
  const tipT = idle ? 0 : el;
  const tx = X(tipT) + (idle ? rs * 1.5 : 0);
  const ty = Y(idle ? 1 : Math.exp((view.growth * el) / 1000)) - (idle ? rs * 1.1 : 0);
  // heading from the curve's slope, in screen space
  const dt = Math.max(1, el * 0.02);
  const ang = idle ? -0.6 : Math.atan2(Y(Math.exp((view.growth * el) / 1000)) - Y(Math.exp((view.growth * Math.max(0, el - dt)) / 1000)), X(el) - X(Math.max(0, el - dt)));

  g.save();
  if (exploded && age < 420) g.translate(Math.sin(age * 0.09) * 6 * (1 - age / 420), Math.cos(age * 0.11) * 4 * (1 - age / 420));
  if (!idle) smoke(g, view, el, X, Y, rs, exploded ? age : 0, now);
  if (!exploded) {
    rocket(g, tx, ty, ang, rs, now, idle);
  } else {
    explosion(g, tx, ty, rs, age);
  }
  g.restore();
}

// Exhaust: soft billowing puffs along the path already flown. Hot and bright at the engine, they
// swell, cool to grey and drift apart as they age; after a crash the cloud keeps spreading and fades.
const PUFF = {};
function puffSprite(rgb) {
  if (PUFF[rgb]) return PUFF[rgb];
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  return (PUFF[rgb] = c);
}
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

function smoke(g, view, el, X, Y, size, age, now) {
  const puffs = 70;
  const span = Math.min(el, 8000);
  const fade = Math.max(0, 1 - age / 2000);
  const spread = 1 + age / 1400;
  const hot = [255, 196, 110];
  const cool = [214, 206, 224];
  for (let i = puffs; i >= 1; i--) {
    const f = i / puffs; // 0 at the engine, 1 at the far end of the trail
    const t = el - f * f * span; // denser near the rocket
    if (t < 0) continue;
    const alpha = Math.pow(1 - f, 1.4) * 0.5 * fade;
    if (alpha <= 0.008) continue;
    const wob = Math.sin(now * 0.0016 + i * 1.7) * size * 0.3 * f + Math.sin(i * 12.9898) * size * 0.3 * f;
    const lift = Math.cos(now * 0.0013 + i * 2.3) * size * 0.25 * f - f * f * size * 0.9;
    const px = X(t) - size * 1.05 + wob * spread;
    const py = Y(Math.exp((view.growth * t) / 1000)) + size * 0.2 + lift * spread;
    const r = size * (0.5 + f * 1.7) * spread;
    const [cr, cg, cb] = mix(hot, cool, Math.min(1, f * 2.4));
    g.globalAlpha = alpha;
    g.drawImage(puffSprite(`${cr},${cg},${cb}`), px - r, py - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  // a few embers streaming off the engine while it burns
  if (!age) {
    for (let i = 0; i < 7; i++) {
      const k = ((now * 0.0012 + i / 7) % 1);
      const t = el - k * Math.min(el, 700);
      if (t < 0) continue;
      g.globalAlpha = (1 - k) * 0.9;
      g.fillStyle = i % 2 ? '#FFD976' : '#FF9A45';
      g.beginPath();
      g.arc(X(t) - size * 1.2 + Math.sin(i * 5.1 + now * 0.01) * size * 0.25, Y(Math.exp((view.growth * t) / 1000)) + size * 0.2 + Math.cos(i * 3.7) * size * 0.3, size * 0.07 * (1 - k * 0.5), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
const isBoom = (view) => view.phase === 'crashed';

function rocket(g, x, y, ang, size, now, idle) {
  const flick = 0.8 + 0.2 * Math.sin(now * 0.05) + 0.12 * Math.sin(now * 0.13 + 1);
  const bob = idle ? Math.sin(now * 0.004) * 2 : 0;
  g.save();
  g.translate(x, y + bob);
  g.rotate(ang);
  const L = size * 2.1; // body length
  const H = size * 0.78; // body thickness
  // flame
  const fl = size * (idle ? 0.7 : 1.5) * flick;
  const fg = g.createLinearGradient(-L * 0.5 - fl, 0, -L * 0.5, 0);
  fg.addColorStop(0, 'rgba(255,90,30,0)'); fg.addColorStop(0.35, 'rgba(255,140,40,.9)'); fg.addColorStop(1, '#fff3b0');
  g.fillStyle = fg;
  g.beginPath(); g.moveTo(-L * 0.5, -H * 0.3); g.quadraticCurveTo(-L * 0.5 - fl * 0.6, -H * 0.12, -L * 0.5 - fl, 0); g.quadraticCurveTo(-L * 0.5 - fl * 0.6, H * 0.12, -L * 0.5, H * 0.3); g.closePath(); g.fill();
  // fins
  g.fillStyle = '#C8312A';
  g.beginPath(); g.moveTo(-L * 0.42, -H * 0.4); g.lineTo(-L * 0.62, -H * 1.0); g.lineTo(-L * 0.12, -H * 0.4); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-L * 0.42, H * 0.4); g.lineTo(-L * 0.62, H * 1.0); g.lineTo(-L * 0.12, H * 0.4); g.closePath(); g.fill();
  // body
  const bg = g.createLinearGradient(0, -H / 2, 0, H / 2);
  bg.addColorStop(0, '#FFFDF7'); bg.addColorStop(1, '#CFC6B4');
  g.fillStyle = bg;
  g.beginPath(); g.moveTo(-L * 0.5, -H * 0.5); g.lineTo(L * 0.12, -H * 0.5); g.quadraticCurveTo(L * 0.5, -H * 0.4, L * 0.55, 0); g.quadraticCurveTo(L * 0.5, H * 0.4, L * 0.12, H * 0.5); g.lineTo(-L * 0.5, H * 0.5); g.closePath(); g.fill();
  // nose
  g.fillStyle = '#E0472F';
  g.beginPath(); g.moveTo(L * 0.12, -H * 0.5); g.quadraticCurveTo(L * 0.5, -H * 0.4, L * 0.55, 0); g.quadraticCurveTo(L * 0.5, H * 0.4, L * 0.12, H * 0.5); g.quadraticCurveTo(L * 0.26, 0, L * 0.12, -H * 0.5); g.closePath(); g.fill();
  // band and window
  g.fillStyle = '#E0472F'; g.fillRect(-L * 0.3, -H * 0.5, L * 0.09, H);
  g.fillStyle = '#10302A'; g.beginPath(); g.arc(-L * 0.02, 0, H * 0.24, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6FC3E8'; g.beginPath(); g.arc(-L * 0.02 - H * 0.04, -H * 0.04, H * 0.15, 0, Math.PI * 2); g.fill();
  g.restore();
}

// Flash, shockwave, fireball and flying debris. All positions come from the time since the crash.
function explosion(g, x, y, size, age) {
  const T = 1500;
  if (age < 140) { // white-hot flash
    const k = 1 - age / 140;
    const fg = g.createRadialGradient(x, y, 0, x, y, size * (3 + (1 - k) * 4));
    fg.addColorStop(0, `rgba(255,255,240,${0.95 * k})`); fg.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(x, y, size * 7, 0, Math.PI * 2); g.fill();
  }
  const ring = Math.min(1, age / 700);
  if (ring < 1) {
    g.strokeStyle = `rgba(255,214,150,${(1 - ring) * 0.8})`; g.lineWidth = 3 + (1 - ring) * 4;
    g.beginPath(); g.arc(x, y, size * (0.6 + ring * 5.5), 0, Math.PI * 2); g.stroke();
  }
  if (age < 800) { // fireball
    const k = age / 800;
    const fg = g.createRadialGradient(x, y, 0, x, y, size * (1.2 + k * 3.2));
    fg.addColorStop(0, `rgba(255,236,150,${0.95 * (1 - k)})`); fg.addColorStop(0.45, `rgba(255,120,40,${0.8 * (1 - k)})`); fg.addColorStop(1, 'rgba(180,40,20,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(x, y, size * 5, 0, Math.PI * 2); g.fill();
  }
  // sparks and rocket pieces
  const n = 34;
  for (let i = 0; i < n; i++) {
    const r1 = (Math.sin(i * 91.7) + 1) / 2;
    const r2 = (Math.sin(i * 47.3 + 2) + 1) / 2;
    const a = (i / n) * Math.PI * 2 + r1 * 0.5;
    const sp = size * (2.2 + r2 * 5.5);
    const life = 0.55 + r1 * 0.45;
    const k = Math.min(1, age / (T * life));
    if (k >= 1) continue;
    const px = x + Math.cos(a) * sp * (1 - Math.pow(1 - k, 2)) * 1.6;
    const py = y + Math.sin(a) * sp * (1 - Math.pow(1 - k, 2)) * 1.6 + k * k * size * 5;
    const piece = i % 6 === 0;
    g.globalAlpha = 1 - k;
    if (piece) {
      g.save(); g.translate(px, py); g.rotate(k * (r2 * 12 - 6)); g.fillStyle = i % 12 === 0 ? '#E0472F' : '#FFFDF7';
      g.fillRect(-size * 0.28, -size * 0.12, size * 0.56, size * 0.24); g.restore();
    } else {
      g.fillStyle = r2 > 0.5 ? '#FFD976' : '#FF8A3D';
      g.beginPath(); g.arc(px, py, size * (0.1 + r1 * 0.12) * (1 - k * 0.5), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (age > 150 && age < 1900) { // dark smoke cloud left behind, built from the same soft puffs
    const k = (age - 150) / 1750;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.sin(i * 7.7);
      const d = size * (0.4 + k * (1.2 + (i % 3) * 0.5));
      const r = size * (1.1 + k * 1.6);
      g.globalAlpha = 0.5 * (1 - k);
      g.drawImage(puffSprite('70,58,66'), x + Math.cos(a) * d - r, y + Math.sin(a) * d * 0.8 - k * size * 1.4 - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }
}

function paint(view, now) {
  const graph = document.getElementById('cr-graph');
  const canvas = document.getElementById('cr-canvas');
  if (!graph || !canvas) return;
  const { el, m } = estimate(view, now);
  const multEl = document.getElementById('cr-mult');
  const subEl = document.getElementById('cr-sub');
  let sub = '';
  let text = '1.00x';
  if (view.phase === 'betting') {
    const left = view.betLeft != null ? Math.max(0, view.betLeft - (now - CR.at)) : null;
    text = left != null ? `${Math.ceil(left / 1000)}` : 'Bet';
    sub = left != null ? 'Launching soon. Place your bets.' : 'Place your bets';
  } else if (view.phase === 'running') { text = fx(m); sub = 'Cash out before it crashes'; }
  else { text = fx(view.crashAt); sub = 'Crashed'; }
  if (multEl.textContent !== text) multEl.textContent = text;
  if (subEl.textContent !== sub) subEl.textContent = sub;
  const cls = `cr-graph is-${view.phase}${view.phase === 'running' ? ` t-${tier(m)}` : ''}${view.phase === 'betting' && view.betLeft != null ? ' counting' : ''}`;
  if (graph.className !== cls) graph.className = cls;
  draw(canvas, view, el, m, now);
  // live numbers in the dock's cash-out button
  const payout = document.querySelector('[data-live=cr-payout]');
  if (payout && view.you) {
    const p = String(Math.floor(view.you.total * m));
    const label = Number(p).toLocaleString('en-US');
    if (payout.textContent !== label) payout.textContent = label;
    const xl = document.querySelector('[data-live=cr-x]');
    if (xl) xl.textContent = fx(m);
  }
}

// Called after every render; keeps one animation loop alive while a Crash table is on screen.
export function crashLoop(getView) {
  const view = getView();
  if (!view || view.game !== 'crash') return;
  if (view !== CR.view) {
    const now = performance.now();
    if (view.phase === 'crashed' && !(CR.view && CR.view.phase === 'crashed' && CR.round === view.round)) CR.crashedAt = now;
    CR.view = view; CR.at = now; CR.base = view.elapsed || 0; CR.round = view.round;
  }
  if (CR.raf) return;
  const frame = () => {
    const v = getView();
    if (!v || v.game !== 'crash') { CR.raf = 0; CR.view = null; CR.size = ''; return; }
    paint(CR.view || v, performance.now());
    CR.raf = requestAnimationFrame(frame);
  };
  CR.raf = requestAnimationFrame(frame);
}
