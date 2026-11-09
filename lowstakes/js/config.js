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
  // When true, nobody can use the site without an account. Keep false until the games run on the
  // server and use the wallet; until then game chips are separate from the wallet.
  requireLogin: false,
  // Ad slots. Each one stays hidden until it has ad code (and the visitor has allowed ads). Every slot has size
  // tiers, biggest first: the first tier that fits the screen (minW / minH in pixels) is used, and it swaps when the
  // window is resized or a phone is turned. Paste the network's banner snippet for that exact size into `html`.
  // Slots: landing (home page), lobby (game setup), rail (beside the live table). Ad code loads inside a sandboxed
  // frame, away from the game.
  ads: {
    landing: [
      { minW: 1100, w: 970, h: 90, html: '' },
      { minW: 760, w: 728, h: 90, html: '' },
      { minW: 0, w: 320, h: 50, html: '' },
    ],
    lobby: [
      { minW: 1100, w: 728, h: 90, html: '' },
      { minW: 760, w: 468, h: 60, html: '' },
      { minW: 0, w: 320, h: 50, html: '' },
    ],
    rail: [
      { minW: 1180, minH: 1100, w: 300, h: 600, html: '' },
      { minW: 1180, minH: 700, w: 300, h: 250, html: '' },
      { minW: 0, w: 320, h: 50, html: '' },
    ],
  },
  // While true, every empty slot shows a bright dashed "ad goes here" box so you can see the layout. Set to false
  // before you want a clean site (slots with no ad code then stay invisible).
  adPreview: true,
};
