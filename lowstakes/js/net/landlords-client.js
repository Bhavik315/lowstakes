// The browser's side of a Landlords table. Nothing is decided here: every action is a request the server may refuse, the dice are
// the server's, and the entry fee and prize are handled by the server and the database.
//
// Closing the page does NOT leave the match (a refresh or a dropped connection keeps your seat for five minutes). Leaving is an
// explicit request, sent only by the Leave button.
import { CONFIG } from '../config.js?v=63';
import { Auth } from '../auth.js?v=63';

const wsUrl = (code) => `${CONFIG.serverUrl.replace(/\/$/, '')}/ws/${code}`;

class Emitter {
  constructor() { this.handlers = {}; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }
  fire(type, data) { for (const fn of this.handlers[type] || []) fn(data); }
}

// Look at a table without joining it: who is in, what it costs, the rules. Nothing is charged.
export function peekLandlords(code) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); try { ws && ws.close(); } catch {} resolve(v); } };
    let ws = null;
    const timer = setTimeout(() => finish({ error: 'noserver' }), 9000);
    Auth.accessToken().then((token) => {
      try { ws = new WebSocket(wsUrl(code)); } catch { return finish({ error: 'noserver' }); }
      ws.addEventListener('open', () => ws.send(JSON.stringify({ t: 'hello', token, game: 'landlords', peek: true })));
      ws.addEventListener('message', (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'll' && m.phase === 'peek') finish({ info: m });
        else if (m.t === 'reject') finish({ error: m.why });
      });
      ws.addEventListener('close', () => finish({ error: 'noserver' }));
      ws.addEventListener('error', () => {});
    }).catch(() => finish({ error: 'signin' }));
  });
}

const REASONS = {
  notfound: 'notfound', auth: 'signin', not_registered: 'unregistered', already_at_table: 'elsewhere', full: 'full', already_started: 'started',
  insufficient_balance: 'poor', code_taken: 'taken', bad_fee: 'rejected', confirm: 'confirm', landlords: 'rejected',
};

export class LandlordsClient extends Emitter {
  // intent: { create: {fee, settings} } to make a table, { join: true } to take a seat (the fee is charged), {} to go back to a seat you hold
  constructor({ code, intent = {} }) {
    super();
    this.isLandlords = true;
    this.code = code;
    this.intent = intent;
    this.status = 'connecting';
    this.tries = 0;
    this.lastMsg = Date.now();
    this.recvAt = 0;
    this.last = null;
    this.connect();
    this.watchdog = setInterval(() => { if (this.status === 'open' && Date.now() - this.lastMsg > 15000) this.lost(); }, 3000);
  }

  setStatus(s) { this.status = s; this.fire('status', s); }

  async connect() {
    if (this.closed) return;
    let token;
    try { token = await Auth.accessToken(); } catch { this.closed = true; this.setStatus('signin'); return; }
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(wsUrl(this.code)); } catch { this.retry(); return; }
    this.ws = ws;
    const opening = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch {} } }, 8000);
    ws.addEventListener('open', () => {
      clearTimeout(opening); this.lastMsg = Date.now();
      const first = !this.everOpen;
      const hello = { t: 'hello', token, game: 'landlords' };
      if (first && this.intent.create) Object.assign(hello, { create: true, fee: this.intent.create.fee, settings: this.intent.create.settings });
      else if (first && this.intent.join) hello.join = true;
      ws.send(JSON.stringify(hello));
    });
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      this.lastMsg = Date.now();
      switch (m.t) {
        case 'll':
          if (this.status !== 'open') { this.everOpen = true; this.tries = 0; this.setStatus('open'); }
          this.recvAt = performance.now(); this.last = m;
          this.fire('state', m);
          break;
        case 'notice': this.fire('notice', m); break;
        case 'reject': this.closed = true; this.reject = m; this.setStatus(REASONS[m.why] || 'rejected'); break;
        case 'kicked': this.closed = true; this.setStatus('kicked'); break;
        case 'left': this.closed = true; this.setStatus('left'); break;
        case 'closed': this.fire('closed', m); break;
        default: // ping
      }
    });
    ws.addEventListener('close', () => { clearTimeout(opening); if (this.ws === ws) this.lost(); });
    ws.addEventListener('error', () => {});
  }

  lost() { if (!this.closed) this.retry(); }
  retry() {
    if (this.closed || this.retrying) return;
    this.tries++;
    if (!this.everOpen && this.tries > 2) { this.closed = true; this.setStatus('noserver'); return; }
    this.retrying = true;
    if (this.status !== 'connecting') this.setStatus('reconnecting');
    setTimeout(() => { this.retrying = false; this.connect(); }, Math.min(700 * this.tries, 3000)); // keeps trying: the seat is held for five minutes
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(msg)); } catch {} } }
  act(a) { this.send({ t: 'lact', a }); }
  start() { this.send({ t: 'lcmd', c: 'start' }); }
  kick(pid) { this.send({ t: 'lcmd', c: 'kick', pid }); }
  leaveMatch() { this.send({ t: 'lcmd', c: 'leave' }); }

  // Closing the page or going to another screen only drops the connection: the seat is kept.
  close() {
    this.closed = true;
    clearInterval(this.watchdog);
    setTimeout(() => { try { this.ws && this.ws.close(); } catch {} }, 100);
  }
}
