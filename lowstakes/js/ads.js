// Rewarded ads for the coin refill, and nowhere else. There are no banners or display slots.
//
// No ad network is connected yet, so `enabled()` is false and the "out of chips" button keeps giving the
// free rebuy. Once a network approves the site, register its adapter and the same button starts showing
// a rewarded ad first:
//
//   window.LowStakesAds.register({
//     name: 'some-network',
//     // Resolve true only if the player watched the whole ad.
//     show: ({ personalized }) => Promise<boolean>,
//   });
//
// Ads are requested as NON-personalised by default (`personalized: false`), which keeps consent simple.
// A player sees a one-time notice before their first ad.
//
// NOTE: today the "ad finished" signal comes from the browser, which is acceptable because coins are free
// and reset. When accounts and a permanent wallet arrive, the refill must instead be granted by the server
// after the ad network confirms the view to the server (server-side verification).

const KEY = 'ls.adsok';
let provider = null;

const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const write = () => { try { localStorage.setItem(KEY, '1'); } catch {} };

export const Ads = {
  register(p) { if (p && typeof p.show === 'function') provider = p; },
  enabled() { return !!provider; },
  name() { return provider ? provider.name || 'ads' : null; },

  // Resolves true if the refill should be granted. `ask` shows the one-time notice (resolves true/false).
  async showRewarded(ask) {
    if (!provider) return false;
    if (!read()) {
      const ok = ask ? await ask() : true;
      if (!ok) return false;
      write();
    }
    try { return (await provider.show({ personalized: false })) === true; } catch { return false; }
  },
};

window.LowStakesAds = Ads;
