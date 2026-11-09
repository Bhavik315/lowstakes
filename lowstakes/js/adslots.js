// Banner ad slots. Nothing here does anything until js/config.js has ad code for a slot AND the visitor has said yes
// to ads. Ad code runs inside a sandboxed frame (no access to the game, the sign-in session or local storage).
import { CONFIG } from './config.js?v=46';

const KEY = 'ls.adconsent'; // 'yes' | 'no' | unset
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch {} };
const narrow = () => matchMedia('(max-width: 759px)').matches;
// The size/code for this slot on this screen (phones use `mobile` when a slot has one).
const pickCfg = (name) => { const c = (CONFIG.ads || {})[name]; return c ? (narrow() && c.mobile ? c.mobile : c) : null; };
const slotCfg = (name) => { const c = pickCfg(name); return c && typeof c.html === 'string' && c.html.trim() ? c : null; };
const hasCode = (c) => !!(c && ((typeof c.html === 'string' && c.html.trim()) || (c.mobile && typeof c.mobile.html === 'string' && c.mobile.html.trim())));

export const Slots = {
  configured() { return Object.values(CONFIG.ads || {}).some(hasCode); },
  consent() { return read(); },

  // Fill every empty slot under `root` that has ad code, if the visitor allowed ads. Safe to call again and again.
  mount(root = document) {
    const allowed = read() === 'yes';
    root.querySelectorAll('.ad-slot').forEach((el) => {
      const cfg = slotCfg(el.dataset.slot);
      if (!cfg || !allowed) {
        // No ad code yet: in preview mode show where the ad will go, otherwise stay out of the way.
        const size = pickCfg(el.dataset.slot);
        if (CONFIG.adPreview && size && !el.dataset.filled) {
          el.hidden = false;
          el.innerHTML = `<div class="ad-ph" style="width:${size.w}px;height:${size.h}px"><b>AD SLOT</b><span>${el.dataset.slot} · ${size.w}×${size.h}</span></div>`;
        } else if (!el.dataset.filled) el.hidden = true;
        return;
      }
      el.hidden = false;
      if (el.dataset.filled) return;
      el.innerHTML = '';
      el.dataset.filled = '1';
      const f = document.createElement('iframe');
      f.title = 'Advertisement';
      f.width = String(cfg.w); f.height = String(cfg.h);
      f.setAttribute('scrolling', 'no');
      f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      f.referrerPolicy = 'origin';
      f.loading = 'lazy';
      f.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style>${cfg.html}`;
      el.appendChild(f);
    });
  },

  // A one-time question, shown only when there is ad code to load. Until it is answered, no ad is requested.
  askConsent(onDone) {
    if (!this.configured() || read() || document.getElementById('ad-consent')) return;
    const bar = document.createElement('div');
    bar.id = 'ad-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Ads');
    bar.innerHTML = `<p>Low Stakes is free because it shows a few ads. They come from an outside ad network, which may use cookies. Never at your tables on a phone. <a href="privacy.html">Privacy</a></p>
      <div><button class="btn btn-quiet btn-sm" data-ad="no">No thanks</button><button class="btn btn-primary btn-sm" data-ad="yes">Allow ads</button></div>`;
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ad]');
      if (!b) return;
      write(b.dataset.ad);
      bar.remove();
      if (onDone) onDone();
    });
    document.body.appendChild(bar);
  },
};
