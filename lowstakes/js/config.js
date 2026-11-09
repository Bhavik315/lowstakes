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
      { minW: 760, w: 728, h: 90, html: "<script>atOptions = {'key' : '13f9a0a286e616b330d213ba508671bc','format' : 'iframe','height' : 90,'width' : 728,'params' : {}};</script><script src=\"https://bauval.org/22/13f9a0a286e616b330d213ba508671bc\"></script>" },
      { minW: 500, w: 468, h: 60, html: "<script>atOptions = {'key' : 'a18825a808f1d9c38b854bf60023c50c','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script src=\"https://bauval.org/22/a18825a808f1d9c38b854bf60023c50c\"></script>" },
      { minW: 0, w: 320, h: 50, html: "<script>atOptions = {'key' : '1a627a8f3a4793ba04130f439966e533','format' : 'iframe','height' : 50,'width' : 320,'params' : {}};</script><script src=\"https://bauval.org/22/1a627a8f3a4793ba04130f439966e533\"></script>" },
    ],
    lobby: [
      { minW: 760, w: 728, h: 90, html: "<script>atOptions = {'key' : '13f9a0a286e616b330d213ba508671bc','format' : 'iframe','height' : 90,'width' : 728,'params' : {}};</script><script src=\"https://bauval.org/22/13f9a0a286e616b330d213ba508671bc\"></script>" },
      { minW: 500, w: 468, h: 60, html: "<script>atOptions = {'key' : 'a18825a808f1d9c38b854bf60023c50c','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script src=\"https://bauval.org/22/a18825a808f1d9c38b854bf60023c50c\"></script>" },
      { minW: 0, w: 320, h: 50, html: "<script>atOptions = {'key' : '1a627a8f3a4793ba04130f439966e533','format' : 'iframe','height' : 50,'width' : 320,'params' : {}};</script><script src=\"https://bauval.org/22/1a627a8f3a4793ba04130f439966e533\"></script>" },
    ],
    rail: [
      { minW: 1180, minH: 700, w: 300, h: 250, html: "<script>atOptions = {'key' : '82f13974043f0644568ea90a3ed5d459','format' : 'iframe','height' : 250,'width' : 300,'params' : {}};</script><script src=\"https://bauval.org/22/82f13974043f0644568ea90a3ed5d459\"></script>" },
      { minW: 0, w: 320, h: 50, html: "<script>atOptions = {'key' : '1a627a8f3a4793ba04130f439966e533','format' : 'iframe','height' : 50,'width' : 320,'params' : {}};</script><script src=\"https://bauval.org/22/1a627a8f3a4793ba04130f439966e533\"></script>" },
    ],
  },
  // While true, every empty slot shows a bright dashed "ad goes here" box so you can see the layout. Set to false
  // before you want a clean site (slots with no ad code then stay invisible).
  adPreview: false,
};
