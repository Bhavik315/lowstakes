// A table that runs on the game server. It looks like the browser-run tables to the rest of the app
// (act, say, setGame...), but nothing is decided here: every action is a request the server may refuse,
// and the coins are the player's wallet, kept by the server and the database.
import { CONFIG } from '../config.js?v=52';
import { Auth } from '../auth.js?v=52';

class Emitter {
  constructor() { this.handlers = {}; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter((f) => f !== fn); }
  fire(type, data) { for (const fn of this.handlers[type] || []) fn(data); }
}

export const serverEnabled = () => !!CONFIG.serverUrl;

export class ServerClient extends Emitter {
  constructor({ code, create = false }) {
    super();
    this.isHost = false; // the server runs the table; the owner just has extra controls
    this.isServer = true;
    this.code = code;
    this.create = create;
    this.id = (Auth.user() && Auth.user().id) || '';
    this.status = 'connecting';
    this.tries = 0;
    this.lastMsg = Date.now();
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
    try { ws = new WebSocket(`${CONFIG.serverUrl.replace(/\/$/, '')}/ws/${this.code}`); }
    catch { this.retry(); return; }
    this.ws = ws;
    const opening = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch {} } }, 8000);
    ws.addEventListener('open', () => { clearTimeout(opening); this.lastMsg = Date.now(); ws.send(JSON.stringify({ t: 'hello', token, create: this.create && !this.everOpen })); });
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      this.lastMsg = Date.now();
      switch (msg.t) {
        case 'state':
          if (this.status !== 'open') { this.everOpen = true; this.tries = 0; this.setStatus('open'); }
          this.fire('state', msg);
          break;
        case 'react': this.fire('react', msg); break;
        case 'notice': this.fire('notice', msg); break;
        case 'reject': this.closed = true; this.rejectInfo = { game: msg.game, limit: msg.limit }; this.fullInfo = this.rejectInfo; this.setStatus(this.reasonStatus(msg.why)); break;
        case 'kicked': this.closed = true; this.setStatus('kicked'); break;
        case 'closed': this.closed = true; this.setStatus('closed'); break;
        default: // ping
      }
    });
    ws.addEventListener('close', () => { clearTimeout(opening); if (this.ws === ws) this.lost(); });
    ws.addEventListener('error', () => {});
  }

  reasonStatus(why) {
    return ({
      full: 'full', notfound: 'notfound', auth: 'signin', not_registered: 'unregistered',
      already_at_table: 'elsewhere',
    })[why] || 'rejected';
  }

  lost() {
    if (this.closed) return;
    this.retry();
  }

  retry() {
    if (this.closed || this.retrying) return;
    this.tries++;
    if (!this.everOpen && this.tries > 2) { this.closed = true; this.setStatus('noserver'); return; }
    if (this.tries > 12) { this.closed = true; this.setStatus('closed'); return; }
    this.retrying = true;
    if (this.status !== 'connecting') this.setStatus('reconnecting');
    setTimeout(() => { this.retrying = false; this.connect(); }, Math.min(700 * this.tries, 3000));
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(msg)); } catch {} } }
  act(a) { this.send({ t: 'act', a }); }
  say(text) { this.send({ t: 'chat', text }); }
  emote(r) { this.send({ t: 'react', r }); }
  requestRebuy() { this.send({ t: 'rebuy' }); }

  // Owner controls: the server checks who is asking and what is allowed, and tells the player if it says no.
  setGame(gameId) { this.send({ t: 'cmd', c: 'setGame', gameId }); return { ok: true }; }
  endGame() { this.send({ t: 'cmd', c: 'endGame' }); }
  addBot(forGame) { this.send({ t: 'cmd', c: 'addBot', forGame }); return { ok: true }; }
  removePlayer(pid) { this.send({ t: 'cmd', c: 'removePlayer', pid }); }
  updateSettings(patch) { this.send({ t: 'cmd', c: 'updateSettings', patch }); }
  setPaused(on) { this.send({ t: 'cmd', c: 'setPaused', on }); }

  close() {
    this.closed = true;
    clearInterval(this.watchdog);
    this.send({ t: 'bye' });
    setTimeout(() => { try { this.ws && this.ws.close(); } catch {} }, 250);
  }
}
