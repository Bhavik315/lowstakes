// Every sound is synthesised on the fly with Web Audio: no files to load.
let ctx = null;
let master = null;
let enabled = true;
try { enabled = localStorage.getItem('ls.sound') !== 'off'; } catch {}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const sound = {
  get on() { return enabled; },
  toggle() {
    enabled = !enabled;
    try { localStorage.setItem('ls.sound', enabled ? 'on' : 'off'); } catch {}
    if (enabled) this.play('chip');
    return enabled;
  },
  unlock() { if (enabled) ac(); },
  play(name, opts) {
    if (!enabled) return;
    const c = ac();
    if (!c || !SOUNDS[name]) return;
    try { SOUNDS[name](c, c.currentTime + 0.005, opts || {}); } catch {}
  },
};

let noiseBuf = null;
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

function burst(c, t, { freq = 2000, q = 1, dur = 0.06, gain = 0.5, type = 'bandpass' } = {}) {
  const src = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

function tone(c, t, { freq = 440, dur = 0.2, gain = 0.2, type = 'sine', attack = 0.005, end } = {}) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function clack(c, t, pitch = 1, gain = 0.35) {
  // Two clay chips touching: a bright, short, slightly pitched click.
  tone(c, t, { freq: 3100 * pitch, dur: 0.035, gain: gain * 0.5, type: 'triangle' });
  tone(c, t, { freq: 4700 * pitch, dur: 0.025, gain: gain * 0.3, type: 'sine' });
  burst(c, t, { freq: 5200 * pitch, q: 3, dur: 0.03, gain: gain * 0.7 });
}

const SOUNDS = {
  card(c, t) { burst(c, t, { freq: 2600, q: 0.7, dur: 0.07, gain: 0.55 }); burst(c, t + 0.012, { freq: 900, q: 0.8, dur: 0.05, gain: 0.25 }); },
  flip(c, t) { burst(c, t, { freq: 3400, q: 0.9, dur: 0.05, gain: 0.35 }); },
  chip(c, t) {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) clack(c, t + i * (0.035 + Math.random() * 0.03), 0.9 + Math.random() * 0.25, 0.3 - i * 0.04);
  },
  collect(c, t) { for (let i = 0; i < 7; i++) clack(c, t + i * 0.028 + Math.random() * 0.02, 0.85 + Math.random() * 0.3, 0.22); },
  check(c, t) {
    for (const dt of [0, 0.11]) {
      tone(c, t + dt, { freq: 140, end: 70, dur: 0.09, gain: 0.5 });
      burst(c, t + dt, { freq: 400, q: 1, dur: 0.05, gain: 0.35, type: 'lowpass' });
    }
  },
  fold(c, t) { burst(c, t, { freq: 1500, q: 0.4, dur: 0.18, gain: 0.25 }); },
  turn(c, t) { tone(c, t, { freq: 880, dur: 0.18, gain: 0.12 }); tone(c, t + 0.09, { freq: 1320, dur: 0.3, gain: 0.1 }); },
  win(c, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + i * 0.085, { freq: f, dur: 0.42, gain: 0.11, type: 'triangle' }));
    for (let i = 0; i < 6; i++) clack(c, t + 0.35 + i * 0.03, 1, 0.18);
  },
  lose(c, t) { tone(c, t, { freq: 220, end: 150, dur: 0.35, gain: 0.12, type: 'triangle' }); },
  bust(c, t) { tone(c, t, { freq: 160, end: 60, dur: 0.3, gain: 0.35 }); },
  shuffle(c, t) { for (let i = 0; i < 26; i++) burst(c, t + i * 0.022, { freq: 2200 + Math.random() * 1500, q: 1, dur: 0.03, gain: 0.18 }); },
  blackjack(c, t) { [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => tone(c, t + i * 0.07, { freq: f, dur: 0.5, gain: 0.1, type: 'triangle' })); },
  spin(c, t, { ms = 6500 } = {}) {
    // The ball rattling round the rim and slowing down.
    let dt = 0;
    let gap = 0.05;
    const end = ms / 1000 - 0.5;
    while (dt < end) {
      burst(c, t + dt, { freq: 3800 + Math.random() * 800, q: 4, dur: 0.02, gain: 0.08 + 0.1 * (dt / end) });
      gap *= 1.028;
      dt += gap;
    }
  },
  land(c, t) { clack(c, t, 1.2, 0.5); clack(c, t + 0.09, 1.1, 0.3); clack(c, t + 0.16, 1.15, 0.2); },
  bounce(c, t, { n = 0 } = {}) { clack(c, t, 1.3 - n * 0.06, 0.42 - n * 0.1); },
  whoosh(c, t) {
    const src = noise(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.9);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    src.loop = true;
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 1);
  },
  boom(c, t) {
    tone(c, t, { freq: 110, end: 38, dur: 0.7, gain: 0.5 });
    burst(c, t, { freq: 180, q: 0.7, dur: 0.25, gain: 0.4, type: 'lowpass' });
  },
  message(c, t) { tone(c, t, { freq: 1046.5, dur: 0.12, gain: 0.05 }); },
  react(c, t) { tone(c, t, { freq: 740, dur: 0.1, gain: 0.06, type: 'triangle' }); },
};
