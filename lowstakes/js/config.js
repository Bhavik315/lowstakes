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
  // Ad slots. Each one stays hidden until it has ad code (and the visitor has allowed ads). Paste the network's
  // banner snippet into `html` and set the size it was made for. Slots: rail (beside live tables, wide screens only),
  // landing (home page), lobby (before a game starts). Ads load inside a sandboxed frame, away from the game.
  ads: {
    rail: { w: 300, h: 250, html: '' },
    landing: { w: 728, h: 90, html: '' },
    lobby: { w: 300, h: 250, html: '' },
  },
};
