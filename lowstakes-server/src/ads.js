// Serves the banner ads from the game server's address, which is a different origin from the website. Ad code (other
// companies' scripts) therefore runs where it cannot read the website's storage, sign-in session or wallet.
// Only these exact ad units can be requested, so the page cannot be used to run anything else.
export const AD_UNITS = {
  '13f9a0a286e616b330d213ba508671bc': [728, 90],
  '82f13974043f0644568ea90a3ed5d459': [300, 250],
  '1a627a8f3a4793ba04130f439966e533': [320, 50],
  'a18825a808f1d9c38b854bf60023c50c': [468, 60],
  '80b279b4428ca92652b0e697736608de': [160, 600],
  'f83ac12bbcfec3b70a4a453fccaa9408': [160, 300],
};

// Returns a Response for /ad?k=<key>, or null if the request is not a known ad unit.
export function adResponse(url, allowedOrigins = []) {
  const key = url.searchParams.get('k') || '';
  const size = Object.hasOwn(AD_UNITS, key) ? AD_UNITS[key] : null;
  if (!size) return null;
  const [w, h] = size;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>` +
    `<script>atOptions = {'key' : '${key}','format' : 'iframe','height' : ${h},'width' : ${w},'params' : {}};</script>` +
    `<script src="https://bauval.org/22/${key}"></script>`;
  const frames = allowedOrigins.length ? allowedOrigins.join(' ') : "'none'";
  return new Response(html, { status: 200, headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=3600',
    'content-security-policy': `frame-ancestors ${frames}`,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'origin',
  } });
}
