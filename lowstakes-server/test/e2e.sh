#!/usr/bin/env bash
# Runs test/e2e.mjs against `wrangler dev` (the real Workers runtime, locally).
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd); cd "$here"
SB_PORT=${SB_PORT:-54399}; WPORT=${WPORT:-8788}
node scripts/sync-engines.mjs >/dev/null
pkill -f workerd 2>/dev/null || true; pkill -f 'wrangler dev' 2>/dev/null || true; sleep 1
npx wrangler dev --local --test-scheduled --port "$WPORT" --ip 127.0.0.1 \
  --var SUPABASE_URL:http://127.0.0.1:$SB_PORT --var SUPABASE_PUBLISHABLE_KEY:pub --var SUPABASE_SECRET_KEY:test-secret \
  --var ALLOWED_ORIGINS:http://localhost:8080 > /tmp/wrangler-dev.log 2>&1 &
WP=$!
trap 'kill $WP 2>/dev/null || true; pkill -f workerd 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$WPORT/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "http://127.0.0.1:$WPORT/health" >/dev/null || { echo "worker did not start"; tail -30 /tmp/wrangler-dev.log; exit 1; }
SB_PORT=$SB_PORT WORKER_URL="ws://127.0.0.1:$WPORT" node --test --test-force-exit test/e2e.mjs
