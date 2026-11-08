#!/usr/bin/env bash
# Runs test/sql.integration.mjs against a throwaway local Postgres with the real migrations applied.
# Needs postgresql-16 installed and to be run as root (or adapt the su lines).
set -euo pipefail
BIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d); chown postgres "$DIR"; PORT=${PGPORT_TEST:-54330}
here=$(cd "$(dirname "$0")" && pwd)
sql="$here/../../lowstakes/supabase"
su postgres -c "$BIN/initdb -D $DIR/data -A trust >/dev/null"
su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'su postgres -c "$BIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true; rm -rf "$DIR"' EXIT
P="psql -h $DIR -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$P -f "$sql/test/supabase_stub.sql" >/dev/null
$P -f "$sql/migrations/0001_accounts_wallet.sql" >/dev/null
$P -f "$sql/migrations/0002_table_rounds.sql" >/dev/null
cd "$here/.."
node scripts/sync-engines.mjs >/dev/null
PGHOST="$DIR" PGPORT="$PORT" node --test test/sql.integration.mjs
