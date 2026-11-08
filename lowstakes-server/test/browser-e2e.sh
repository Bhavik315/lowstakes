#!/usr/bin/env bash
# Browser test of wallet tables: the real site + the real Workers runtime (wrangler dev) + stand-in Supabase.
# Needs Playwright and the site served at http://localhost:8080/lowstakes/ (python3 -m http.server 8080 from the repo root).
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd); cd "$here"
SB_PORT=${SB_PORT:-54399}; WPORT=${WPORT:-8788}
node scripts/sync-engines.mjs >/dev/null
pkill -f workerd 2>/dev/null || true; pkill -f 'wrangler dev' 2>/dev/null || true; pkill -f mock-sb-http 2>/dev/null || true; sleep 1
SB_PORT=$SB_PORT node test/mock-sb-http.mjs > /tmp/mock-sb.log 2>&1 &
MP=$!
npx wrangler dev --local --port "$WPORT" --ip 127.0.0.1 \
  --var SUPABASE_URL:http://127.0.0.1:$SB_PORT --var SUPABASE_PUBLISHABLE_KEY:pub --var SUPABASE_SECRET_KEY:test-secret \
  --var ALLOWED_ORIGINS:http://localhost:8080 > /tmp/wrangler-dev.log 2>&1 &
WP=$!
trap 'kill $WP $MP 2>/dev/null || true; pkill -f workerd 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$WPORT/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "http://127.0.0.1:$WPORT/health" >/dev/null || { echo "worker did not start"; tail -30 /tmp/wrangler-dev.log; exit 1; }
SB_PORT=$SB_PORT WPORT=$WPORT node test/browser-e2e.cjs
