// Banner ad slots. Nothing here does anything until js/config.js has ad code for a slot AND the visitor has said yes
// to ads. Ads are shown in frames loaded from the game server's address (another origin), so ad code cannot reach this site's
// storage, sign-in session or wallet.
//
// Each slot lists size tiers, biggest first. The first tier that fits the screen is used (width and, if given,
// height), and the slot swaps to another tier when the window is resized or the phone is turned.
import { CONFIG } from './config.js?v=63';

const KEY = 'ls.adconsent'; // 'yes' | 'no' | unset
// Ads load for every visitor (there is no "allow ads" question any more).
const read = () => 'yes';
const write = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

const tiersOf = (name) => { const c = (CONFIG.ads || {})[name]; return Array.isArray(c) ? c : c ? [c] : []; };
const fits = (t) => innerWidth >= (t.minW || 0) && innerHeight >= (t.minH || 0);
// The size this screen gets for a slot (null if none fits).
export const tierFor = (name) => tiersOf(name).find(fits) || null;
const hasCode = (t) => !!(t && typeof t.key === 'string' && /^[0-9a-f]{32}$/.test(t.key));
// Ads come from the game server's own address (a different origin from this site), never from code running here.
const adBase = () => String(CONFIG.serverUrl || '').replace(/^ws/, 'http').replace(/\/$/, '');

function fill(el) {
  const name = el.dataset.slot;
  const tier = tierFor(name);
  const key = tier ? `${tier.w}x${tier.h}:${hasCode(tier) && !!adBase() ? 'ad' : 'ph'}` : 'none';
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.innerHTML = '';
  if (!tier) { el.hidden = true; return; }
  if (hasCode(tier) && !!adBase()) {
    el.hidden = false;
    const f = document.createElement('iframe');
    f.title = 'Advertisement';
    f.width = String(tier.w); f.height = String(tier.h);
    f.setAttribute('scrolling', 'no');
    // Cross-origin, so it cannot see this site's storage or sign-in. The sandbox only adds: no navigating this page away without a tap.
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    f.referrerPolicy = 'origin';
    f.loading = 'lazy';
    f.src = `${adBase()}/ad?k=${tier.key}`;
    el.appendChild(f);
  } else if (CONFIG.adPreview) {
    // No ad code yet: show where the ad will go (preview mode), otherwise stay out of the way.
    el.hidden = false;
    el.innerHTML = `<div class="ad-ph" style="width:${tier.w}px;height:${tier.h}px"><b>AD SLOT</b><span>${name} · ${tier.w}×${tier.h}</span></div>`;
  } else el.hidden = true;
}

let resizeTimer = 0;
const refresh = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => Slots.mount(document), 250); };
addEventListener('resize', refresh);
addEventListener('orientationchange', refresh);

export const Slots = {
  configured() { return Object.keys(CONFIG.ads || {}).some((n) => tiersOf(n).some(hasCode)); },
  consent() { return read(); },
  tierFor,

  // Fill (or re-size) every slot under `root`. Safe to call again and again.
  mount(root = document) { root.querySelectorAll('.ad-slot').forEach(fill); },

  // (kept so older callers still work; ads no longer ask first)
  askConsent(onDone) { if (onDone) onDone(); },
};
