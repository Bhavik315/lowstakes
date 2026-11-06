// Shared plumbing for host-side game engines: a time-ordered job queue
// (so engines can stage deals and reveals) and a short event log that clients
// use to trigger sounds and animations.
export class Engine {
  constructor(room) {
    this.room = room;
    this.jobs = [];
    this.events = [];
    this.evId = 0;
    this.log = [];
    this.now = () => Date.now();
  }

  after(ms, fn) {
    this.jobs.push({ at: this.now() + ms, fn });
    this.jobs.sort((a, b) => a.at - b.at);
  }

  clearJobs() { this.jobs = []; }

  // Called by the host on an interval. Returns true if state changed.
  tick() {
    let changed = false;
    const t = this.now();
    while (this.jobs.length && this.jobs[0].at <= t) {
      const job = this.jobs.shift();
      job.fn();
      changed = true;
    }
    if (this.step && this.step(t)) changed = true;
    return changed;
  }

  emit(type, data = {}) {
    this.events.push({ id: ++this.evId, type, ...data });
    if (this.events.length > 40) this.events.shift();
  }

  note(text) {
    this.log.push({ id: this.evId, text, at: this.now() });
    if (this.log.length > 60) this.log.shift();
  }

  player(pid) { return this.room.players.find((p) => p.id === pid); }
  name(pid) { const p = this.player(pid); return p ? p.name : 'Someone'; }

  remaining(deadline) { return deadline ? Math.max(0, deadline - this.now()) : null; }
}
