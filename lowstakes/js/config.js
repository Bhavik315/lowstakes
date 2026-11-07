// Public configuration. Everything here is safe to ship in the browser:
// the publishable key only identifies the project; what a player may do is decided by the database
// (row level security and the wallet functions). Never put a secret / service_role key in this file.
export const CONFIG = {
  supabaseUrl: 'https://pupyykzrfbuimvuwohya.supabase.co',
  supabaseKey: 'sb_publishable_COgy0nfCPaaPLH1CRWpuWg_pNf-_PO-',
  // Turn on once Google sign-in is configured in Supabase (Authentication > Providers > Google).
  google: false,
  // When true, nobody can use the site without an account. Keep false until the games run on the
  // server and use the wallet; until then game chips are separate from the wallet.
  requireLogin: false,
};
