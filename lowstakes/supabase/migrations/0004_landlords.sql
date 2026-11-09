-- Low Stakes: Landlords (private property-trading tables with an entry fee and a prize pool).
--
-- Two currencies, kept apart: wallet COINS live here; the in-game cash of a match lives only on the game server and is
-- never converted into coins. Coins move in exactly three ways, all through the functions below (service role only,
-- never callable from a browser), each idempotent and each one database transaction:
--   * landlords_create / landlords_join : the entry fee leaves the wallet and is held for the match (escrow).
--   * landlords_finish                  : the whole pot is paid to the winner, once (status flips playing -> finished).
--   * landlords_cancel                  : every held entry is refunded, once (status flips to cancelled).
-- A player who leaves a lobby is refunded; a player who leaves or is eliminated during play forfeits the fee into the pot.
-- landlords_sweep() cancels and refunds matches whose server never came back (called by the daily job and on demand).
--
-- Additive only: two tables, two widened CHECK constraints, new functions. Safe to run again.

alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('welcome_bonus', 'wager', 'payout', 'refund', 'username_change_fee', 'adjustment', 'round_result', 'free_pack',
                  'landlords_entry', 'landlords_prize', 'landlords_refund'));
alter table public.transactions drop constraint if exists transactions_game_check;
alter table public.transactions add constraint transactions_game_check
  check (game in ('blackjack', 'holdem', 'roulette', 'crash', 'landlords'));

create table if not exists public.landlord_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host uuid not null references public.profiles (id),
  fee bigint not null check (fee >= 0 and fee <= 100000),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  pot bigint not null default 0,
  winner uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  touched_at timestamptz not null default now()
);
-- Only one unfinished match may use a table code at a time.
create unique index if not exists landlord_open_code on public.landlord_matches (code) where status in ('lobby', 'playing');

create table if not exists public.landlord_entries (
  match_id uuid not null references public.landlord_matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  fee bigint not null,
  status text not null default 'held' check (status in ('held', 'forfeit', 'won', 'lost', 'refunded')),
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index if not exists landlord_entries_user on public.landlord_entries (user_id);

alter table public.landlord_matches enable row level security;
alter table public.landlord_matches force row level security;
alter table public.landlord_entries enable row level security;
alter table public.landlord_entries force row level security;
revoke all on public.landlord_matches, public.landlord_entries from public, anon, authenticated;
grant select, insert, update, delete on public.landlord_matches, public.landlord_entries to service_role;
drop policy if exists service_all_ll_matches on public.landlord_matches;
create policy service_all_ll_matches on public.landlord_matches for all to service_role using (true) with check (true);
drop policy if exists service_all_ll_entries on public.landlord_entries;
create policy service_all_ll_entries on public.landlord_entries for all to service_role using (true) with check (true);

-- Internal: seat a user at a code (one table at a time, same rule as join_table).
create or replace function public.landlords_seat(p_user uuid, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_p public.table_presence;
begin
  select * into v_p from public.table_presence where user_id = p_user;
  if found and v_p.table_code <> p_code and v_p.last_seen > now() - interval '2 minutes' then raise exception 'already_at_table'; end if;
  insert into public.table_presence (user_id, table_code, game) values (p_user, p_code, 'landlords')
    on conflict (user_id) do update set table_code = excluded.table_code, game = 'landlords', joined_at = now(), last_seen = now();
end $$;

-- Internal: take the entry fee from a wallet (caller holds the match lock). Raises insufficient_balance.
create or replace function public.landlords_charge(p_match uuid, p_user uuid, p_fee bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_bal bigint;
begin
  select balance into v_bal from public.wallets where user_id = p_user for update;
  if not found then raise exception 'not_registered'; end if;
  if p_fee > v_bal then raise exception 'insufficient_balance'; end if;
  if p_fee > 0 then perform public.wallet_apply(p_user, 'landlords_entry', -p_fee, 'landlords', p_match::text, 'landlords:entry:' || p_match || ':' || p_user); end if;
  insert into public.landlord_entries (match_id, user_id, fee) values (p_match, p_user, p_fee);
  return v_bal - p_fee;
end $$;

create or replace function public.landlords_create(p_user uuid, p_code text, p_fee bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if p_code is null or p_code !~ '^[A-Z0-9]{5}$' then raise exception 'bad_table'; end if;
  if p_fee is null or p_fee < 0 or p_fee > 100000 then raise exception 'bad_fee'; end if;
  select username into v_name from public.profiles where id = p_user;
  if not found then raise exception 'not_registered'; end if;
  if exists (select 1 from public.landlord_matches where code = p_code and status in ('lobby', 'playing')) then raise exception 'code_taken'; end if;
  perform public.landlords_seat(p_user, p_code);
  insert into public.landlord_matches (code, host, fee) values (p_code, p_user, p_fee) returning id into v_id;
  perform public.landlords_charge(v_id, p_user, p_fee);
  return jsonb_build_object('match', v_id, 'username', v_name, 'fee', p_fee, 'balance', (select balance from public.wallets where user_id = p_user));
end $$;

create or replace function public.landlords_join(p_user uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.landlord_matches; v_name text; v_n int;
begin
  select username into v_name from public.profiles where id = p_user;
  if not found then raise exception 'not_registered'; end if;
  select * into v_m from public.landlord_matches where code = p_code and status in ('lobby', 'playing') for update;
  if not found then raise exception 'notfound'; end if;
  if exists (select 1 from public.landlord_entries where match_id = v_m.id and user_id = p_user and status in ('held', 'forfeit', 'won', 'lost')) then
    return jsonb_build_object('match', v_m.id, 'username', v_name, 'fee', v_m.fee, 'already', true);   -- reconnecting: never charged twice
  end if;
  if v_m.status <> 'lobby' then raise exception 'already_started'; end if;
  select count(*) into v_n from public.landlord_entries where match_id = v_m.id and status = 'held';
  if v_n >= 6 then raise exception 'full'; end if;
  perform public.landlords_seat(p_user, p_code);
  perform public.landlords_charge(v_m.id, p_user, v_m.fee);
  return jsonb_build_object('match', v_m.id, 'username', v_name, 'fee', v_m.fee, 'balance', (select balance from public.wallets where user_id = p_user));
end $$;

-- Leave a lobby (fee refunded) or leave a running match (fee stays in the pot).
create or replace function public.landlords_leave(p_user uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.landlord_matches; v_e public.landlord_entries; v_bal bigint;
begin
  select * into v_m from public.landlord_matches where code = p_code order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('left', true); end if;
  select * into v_e from public.landlord_entries where match_id = v_m.id and user_id = p_user for update;
  if found and v_m.status = 'lobby' and v_e.status = 'held' then
    select balance into v_bal from public.wallets where user_id = p_user for update;
    if v_e.fee > 0 then perform public.wallet_apply(p_user, 'landlords_refund', v_e.fee, 'landlords', v_m.id::text, 'landlords:refund:' || v_m.id || ':' || p_user); end if;
    delete from public.landlord_entries where match_id = v_m.id and user_id = p_user;
  elsif found and v_m.status = 'playing' and v_e.status = 'held' then
    update public.landlord_entries set status = 'forfeit' where match_id = v_m.id and user_id = p_user;
  end if;
  delete from public.table_presence where user_id = p_user and table_code = p_code;
  return jsonb_build_object('left', true);
end $$;

create or replace function public.landlords_start(p_code text, p_host uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.landlord_matches; v_n int;
begin
  select * into v_m from public.landlord_matches where code = p_code and status in ('lobby', 'playing') for update;
  if not found then raise exception 'notfound'; end if;
  if v_m.host <> p_host then raise exception 'not_host'; end if;
  if v_m.status = 'playing' then return jsonb_build_object('match', v_m.id, 'pot', v_m.pot, 'already', true); end if;
  select count(*) into v_n from public.landlord_entries where match_id = v_m.id and status = 'held';
  if v_n < 4 then raise exception 'not_enough_players'; end if;
  update public.landlord_matches set status = 'playing', started_at = now(), touched_at = now(), pot = v_m.fee * v_n where id = v_m.id;
  return jsonb_build_object('match', v_m.id, 'pot', v_m.fee * v_n, 'players', v_n);
end $$;

create or replace function public.landlords_touch(p_code text) returns void
language sql security definer set search_path = public as $$
  update public.landlord_matches set touched_at = now() where code = p_code and status in ('lobby', 'playing')
$$;

-- Pay the winner the whole pot. Exactly once: the status flip and the ledger key both guard it.
create or replace function public.landlords_finish(p_code text, p_winner uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.landlord_matches; v_bal bigint;
begin
  select * into v_m from public.landlord_matches where code = p_code order by created_at desc limit 1 for update;
  if not found then raise exception 'notfound'; end if;
  if v_m.status = 'finished' then return jsonb_build_object('match', v_m.id, 'winner', v_m.winner, 'pot', v_m.pot, 'already', true); end if;
  if v_m.status <> 'playing' then raise exception 'not_playing'; end if;
  if not exists (select 1 from public.landlord_entries where match_id = v_m.id and user_id = p_winner) then raise exception 'bad_winner'; end if;
  select balance into v_bal from public.wallets where user_id = p_winner for update;
  if v_m.pot > 0 then perform public.wallet_apply(p_winner, 'landlords_prize', v_m.pot, 'landlords', v_m.id::text, 'landlords:prize:' || v_m.id); end if;
  update public.landlord_matches set status = 'finished', winner = p_winner, ended_at = now() where id = v_m.id;
  update public.landlord_entries set status = case when user_id = p_winner then 'won' else 'lost' end where match_id = v_m.id;
  delete from public.table_presence where table_code = p_code and user_id in (select user_id from public.landlord_entries where match_id = v_m.id);
  return jsonb_build_object('match', v_m.id, 'winner', p_winner, 'pot', v_m.pot, 'balance', (select balance from public.wallets where user_id = p_winner));
end $$;

-- Cancel a lobby or a running match and give every entry fee back, once.
create or replace function public.landlords_cancel(p_code text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m public.landlord_matches; e record; v_n int := 0;
begin
  select * into v_m from public.landlord_matches where code = p_code order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('cancelled', false); end if;
  if v_m.status in ('finished', 'cancelled') then return jsonb_build_object('match', v_m.id, 'already', true, 'status', v_m.status); end if;
  for e in select * from public.landlord_entries where match_id = v_m.id and status in ('held', 'forfeit') loop
    perform 1 from public.wallets where user_id = e.user_id for update;
    if e.fee > 0 then perform public.wallet_apply(e.user_id, 'landlords_refund', e.fee, 'landlords', v_m.id::text, 'landlords:refund:' || v_m.id || ':' || e.user_id); end if;
    update public.landlord_entries set status = 'refunded' where match_id = v_m.id and user_id = e.user_id;
    v_n := v_n + 1;
  end loop;
  update public.landlord_matches set status = 'cancelled', reason = left(coalesce(p_reason, 'cancelled'), 60), ended_at = now() where id = v_m.id;
  delete from public.table_presence where table_code = p_code and user_id in (select user_id from public.landlord_entries where match_id = v_m.id);
  return jsonb_build_object('match', v_m.id, 'cancelled', true, 'refunded', v_n);
end $$;

-- The match, its entries and who is still held: what a restarted game server needs.
create or replace function public.landlords_status(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('match', m.id, 'status', m.status, 'fee', m.fee, 'host', m.host, 'pot', m.pot, 'winner', m.winner,
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('user', e.user_id, 'status', e.status)), '[]'::jsonb) from public.landlord_entries e where e.match_id = m.id))
    from public.landlord_matches m where m.code = p_code order by m.created_at desc limit 1), jsonb_build_object('status', 'none'))
$$;

-- Cancel (and refund) matches nobody is running any more.
create or replace function public.landlords_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare m record; n int := 0;
begin
  for m in select code from public.landlord_matches
    where (status = 'lobby' and touched_at < now() - interval '3 hours')
       or (status = 'playing' and touched_at < now() - interval '30 minutes') loop
    perform public.landlords_cancel(m.code, 'stale');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.landlords_seat(uuid, text), public.landlords_charge(uuid, uuid, bigint), public.landlords_create(uuid, text, bigint),
  public.landlords_join(uuid, text), public.landlords_leave(uuid, text), public.landlords_start(text, uuid), public.landlords_touch(text),
  public.landlords_finish(text, uuid), public.landlords_cancel(text, text), public.landlords_status(text), public.landlords_sweep() from public, anon, authenticated;
grant execute on function public.landlords_create(uuid, text, bigint), public.landlords_join(uuid, text), public.landlords_leave(uuid, text),
  public.landlords_start(text, uuid), public.landlords_touch(text), public.landlords_finish(text, uuid), public.landlords_cancel(text, text),
  public.landlords_status(text), public.landlords_sweep() to service_role;
