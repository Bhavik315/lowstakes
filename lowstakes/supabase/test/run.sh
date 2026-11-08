#!/usr/bin/env bash
# Runs the database tests on a throwaway local Postgres (needs postgresql-16 installed; run as root or postgres).
set -euo pipefail
BIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d); chown postgres "$DIR"; PORT=${PGPORT_TEST:-54329}
here=$(cd "$(dirname "$0")" && pwd)
su postgres -c "$BIN/initdb -D $DIR/data -A trust >/dev/null"
su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'su postgres -c "$BIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true; rm -rf "$DIR"' EXIT
P="psql -h $DIR -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$P -f "$here/supabase_stub.sql" >/dev/null
$P -f "$here/../migrations/0001_accounts_wallet.sql" >/dev/null
$P -f "$here/wallet.test.sql"
# second database: the round settlement layer (migration 0002) on top of 0001
$P -c "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role; delete from auth.users;" >/dev/null
$P -f "$here/../migrations/0001_accounts_wallet.sql" >/dev/null
$P -f "$here/../migrations/0002_table_rounds.sql" >/dev/null
$P -f "$here/rounds.test.sql"
export P; bash "$here/race.sh"
