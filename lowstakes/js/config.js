// Public configuration. Everything here is safe to ship in the browser:
// the publishable key only identifies the project; what a player may do is decided by the database
// (row level security and the wallet functions). Never put a secret / service_role key in this file.
export const CONFIG = {
  supabaseUrl: 'https://pupyykzrfbuimvuwohya.supabase.co',
  supabaseKey: 'sb_publishable_COgy0nfCPaaPLH1CRWpuWg_pNf-_PO-',
  // Sign-in is Google only (no passwords, no email sign-up). It needs Google switched on in Supabase
  // (Authentication > Providers > Google), and the Email provider switched off.
  // The game server (Cloudflare Worker), as wss://... . Empty = tables run in the browser as before, with free chips.
  // Set it once the server is deployed (see lowstakes-server/README.md). Signed-in players then play for wallet coins.
  serverUrl: 'wss://lowstakes-server.bhavikjain315.workers.dev',
  // When true, nobody can use the site without signing in: visitors see the home page behind a sign-in box they cannot close,
  // and no table (server or browser) can be opened or joined until they are signed in with a username.
  requireLogin: true,
  // Ad slots. Each one stays hidden until it has ad code (and the visitor has allowed ads). Every slot has size
  // tiers, biggest first: the first tier that fits the screen (minW / minH in pixels) is used, and it swaps when the
  // window is resized or a phone is turned. Put the ad unit's key (from the network's snippet) in `key`; the ad is then served from the game server's address (see lowstakes-server/src/ads.js, which must list the same keys).
  // Slots: landing (home page), lobby (game setup), rail (beside the live table). Ad code loads inside a sandboxed
  // frame, away from the game.
  ads: {
    landing: [
      { minW: 760, w: 728, h: 90, key: '13f9a0a286e616b330d213ba508671bc' },
      { minW: 500, w: 468, h: 60, key: 'a18825a808f1d9c38b854bf60023c50c' },
      { minW: 0, w: 320, h: 50, key: '1a627a8f3a4793ba04130f439966e533' },
    ],
    lobby: [
      { minW: 760, w: 728, h: 90, key: '13f9a0a286e616b330d213ba508671bc' },
      { minW: 500, w: 468, h: 60, key: 'a18825a808f1d9c38b854bf60023c50c' },
      { minW: 0, w: 320, h: 50, key: '1a627a8f3a4793ba04130f439966e533' },
    ],
    rail: [
      { minW: 1180, minH: 700, w: 300, h: 250, key: '82f13974043f0644568ea90a3ed5d459' },
      { minW: 0, w: 320, h: 50, key: '1a627a8f3a4793ba04130f439966e533' },
    ],
  },
  // While true, every empty slot shows a bright dashed "ad goes here" box so you can see the layout. Set to false
  // before you want a clean site (slots with no ad code then stay invisible).
  adPreview: false,
};
