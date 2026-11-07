import { esc, fmt, signed, chip, avatar, CHIP_VALUES } from './parts.js?v=27';
import { AUTO_CHOICES } from '../games/crash.js?v=27';

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
    return { sig, html: `<div class="dock-hand"></div><div class="dock-mid"><p class="dock-note">You're out of chips.</p><button class="btn btn-primary" data-act="rebuy">Buy back in for ${fmt(state.room.settings.start)}</button></div><div class="dock-side"></div>` };
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
  const xMax = Math.max(10000, el * 1.1);
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

  if (view.phase === 'betting') return;
  // the curve
  const n = 90;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (el * i) / n;
    pts.push([X(t), Y(Math.exp((view.growth * t) / 1000))]);
  }
  const col = crashed ? c.red : c.mustard;
  g.beginPath(); g.moveTo(pts[0][0], Y(1));
  pts.forEach(([x, y]) => g.lineTo(x, y));
  g.lineTo(pts[n][0], Y(1)); g.closePath();
  const grad = g.createLinearGradient(0, pad.t, 0, pad.t + ph);
  grad.addColorStop(0, crashed ? 'rgba(224,71,47,.32)' : 'rgba(242,190,69,.30)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fill();
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.stroke();

  const [tx, ty] = pts[n];
  if (!crashed) {
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16;
    g.beginPath(); g.arc(tx, ty, 6, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
  } else {
    // a short burst at the crash point
    const age = Math.min(1, (now - CR.crashedAt) / 650);
    g.strokeStyle = c.red; g.lineWidth = 3; g.globalAlpha = 1 - age;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath(); g.moveTo(tx + Math.cos(a) * (8 + age * 6), ty + Math.sin(a) * (8 + age * 6));
      g.lineTo(tx + Math.cos(a) * (14 + age * 30), ty + Math.sin(a) * (14 + age * 30)); g.stroke();
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
