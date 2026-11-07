-- Low Stakes: accounts, usernames, wallet and ledger.
--
-- Design rules (all enforced here, in the database, not in the browser):
--   * One profile + one wallet per auth user. Wallet balance can never go negative.
--   * Usernames are unique case-insensitively. The first one is free; every change costs 5,000.
--   * The 20,000 welcome bonus is granted once, by complete_registration(), and a partial unique
--     index makes a second grant impossible even if the function were called concurrently.
--   * The ledger (transactions) is append-only: UPDATE, DELETE and TRUNCATE are blocked by triggers.
--   * Players can only READ their own rows. Every balance change goes through a SECURITY DEFINER
--     function. Game money functions (place_wager / settle_wager / refund_wager / settle_pool)
--     are executable by the service role only, i.e. by the trusted game server, never by a browser.
--
-- Safe to run on a fresh Supabase project. It creates new objects only and drops nothing.

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email_lower text not null,
  username_changes integer not null default 0,
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,16}$')
);
create unique index profiles_username_key on public.profiles (lower(username));
-- One account per verified email: a second auth user with the same email can never finish registering,
-- so provider mix-ups cannot produce a second profile (and therefore never a second bonus).
create unique index profiles_email_key on public.profiles (email_lower);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  type text not null check (type in ('welcome_bonus', 'wager', 'payout', 'refund', 'username_change_fee', 'adjustment')),
  amount bigint not null,                                   -- signed: negative = coins leaving the wallet
  balance_after bigint not null check (balance_after >= 0),
  game text check (game in ('blackjack', 'holdem', 'roulette', 'crash')),
  ref text,                                                 -- game round / action reference
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index transactions_idem_key on public.transactions (user_id, idempotency_key) where idempotency_key is not null;
create unique index transactions_one_welcome on public.transactions (user_id) where type = 'welcome_bonus';
create index transactions_user_time on public.transactions (user_id, created_at desc);

-- Every stake placed by the game server. Payouts can only settle an open wager, once.
create table public.wagers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  game text not null check (game in ('blackjack', 'holdem', 'roulette', 'crash')),
  round_ref text not null,
  kind text not null check (kind in ('house', 'pool')),     -- house: capped multiple of the stake; pool: limited by the round's total stakes
  amount bigint not null check (amount > 0),
  max_payout bigint,                                        -- house wagers only
  status text not null default 'open' check (status in ('open', 'settled', 'refunded')),
  payout bigint not null default 0 check (payout >= 0),
  idempotency_key text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create unique index wagers_idem_key on public.wagers (user_id, idempotency_key) where idempotency_key is not null;
create index wagers_round on public.wagers (game, round_ref);

-- ---------------------------------------------------------------- append-only ledger
create function public.ledger_is_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'transactions is append-only' using errcode = '42501';
end $$;
create trigger transactions_no_update before update or delete on public.transactions
  for each row execute function public.ledger_is_append_only();
create trigger transactions_no_truncate before truncate on public.transactions
  for each statement execute function public.ledger_is_append_only();

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.wagers enable row level security;
alter table public.profiles force row level security;
alter table public.wallets force row level security;
alter table public.transactions force row level security;
alter table public.wagers force row level security;

revoke all on public.profiles, public.wallets, public.transactions, public.wagers from public, anon, authenticated;
grant select on public.profiles, public.wallets, public.transactions to authenticated;
grant select, insert, update, delete on public.profiles, public.wallets, public.transactions, public.wagers to service_role;

create policy profiles_read_own on public.profiles for select to authenticated using (id = auth.uid());
create policy wallets_read_own on public.wallets for select to authenticated using (user_id = auth.uid());
create policy transactions_read_own on public.transactions for select to authenticated using (user_id = auth.uid());
-- (wagers has no policy for browsers: they never read or write it)
create policy service_all_profiles on public.profiles for all to service_role using (true) with check (true);
create policy service_all_wallets on public.wallets for all to service_role using (true) with check (true);
create policy service_all_transactions on public.transactions for all to service_role using (true) with check (true);
create policy service_all_wagers on public.wagers for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------- helpers
create function public.username_problem(p_name text) returns text language sql immutable as $$
  select case
    when p_name is null or length(btrim(p_name)) = 0 then 'username_empty'
    when length(p_name) < 3 or length(p_name) > 16 then 'username_length'
    when p_name !~ '^[A-Za-z0-9_]+$' then 'username_chars'
    when lower(p_name) in ('admin', 'administrator', 'system', 'dealer', 'house', 'lowstakes', 'moderator', 'support') then 'username_reserved'
  end
$$;

create function public.game_payout_cap(p_game text) returns numeric language sql immutable as $$
  -- Highest multiple of a single stake a house game can ever pay (stake included). A sanity ceiling
  -- on top of the game server's own logic: roulette 35:1, crash 1000x, blackjack insurance 2:1.
  select case p_game when 'roulette' then 36 when 'crash' then 1000 when 'blackjack' then 3 else null end
$$;

create function public.account_json(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registered', true,
    'id', p.id, 'username', p.username, 'balance', w.balance,
    'username_changes', p.username_changes, 'change_fee', 5000)
  from public.profiles p join public.wallets w on w.user_id = p.id where p.id = p_user
$$;

-- Internal: apply a signed amount to a wallet (caller must already hold the row lock) and write the ledger row.
create function public.wallet_apply(p_user uuid, p_type text, p_amount bigint, p_game text, p_ref text, p_key text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_bal bigint;
begin
  update public.wallets set balance = balance + p_amount, updated_at = now()
    where user_id = p_user returning balance into v_bal;          -- the CHECK (balance >= 0) rejects overdrafts
  insert into public.transactions (user_id, type, amount, balance_after, game, ref, idempotency_key)
    values (p_user, p_type, p_amount, v_bal, p_game, p_ref, p_key);
  return v_bal;
end $$;

-- ---------------------------------------------------------------- browser-callable functions
create function public.username_available(p_name text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_problem text := public.username_problem(p_name);
begin
  if v_problem is not null then return jsonb_build_object('valid', false, 'available', false, 'reason', v_problem); end if;
  return jsonb_build_object('valid', true,
    'available', not exists (select 1 from public.profiles where lower(username) = lower(p_name)));
end $$;

create function public.get_account() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_conf timestamptz; v_acc jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  v_acc := public.account_json(v_uid);
  if v_acc is not null then return v_acc; end if;
  select email_confirmed_at into v_conf from auth.users where id = v_uid;
  return jsonb_build_object('registered', false, 'email_verified', v_conf is not null);
end $$;

-- Finish registration: choose the (free) username and receive the one-time welcome bonus.
create function public.complete_registration(p_username text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_conf timestamptz; v_problem text; v_rows int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select email, email_confirmed_at into v_email, v_conf from auth.users where id = v_uid;
  if v_email is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  -- Email/password users must have verified the address; Google users arrive already verified.
  if v_conf is null then raise exception 'email_not_verified'; end if;

  -- Idempotent: an existing account is returned untouched, and no second bonus is ever possible.
  if exists (select 1 from public.profiles where id = v_uid) then return public.account_json(v_uid) || jsonb_build_object('already', true); end if;

  v_problem := public.username_problem(p_username);
  if v_problem is not null then raise exception '%', v_problem; end if;

  begin
    insert into public.profiles (id, username, email_lower) values (v_uid, p_username, lower(v_email))
      on conflict (id) do nothing;
    get diagnostics v_rows = row_count;
  exception when unique_violation then
    if exists (select 1 from public.profiles where email_lower = lower(v_email)) then raise exception 'email_in_use'; end if;
    raise exception 'username_taken';
  end;
  if v_rows = 0 then return public.account_json(v_uid) || jsonb_build_object('already', true); end if;

  insert into public.wallets (user_id, balance) values (v_uid, 0);
  perform public.wallet_apply(v_uid, 'welcome_bonus', 20000, null, 'welcome', 'welcome');
  return public.account_json(v_uid) || jsonb_build_object('already', false, 'bonus', 20000);
end $$;

-- Change username for 5,000 coins. One atomic statement: rename + fee + ledger row, or nothing at all.
create function public.change_username(p_new text, p_request_id text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid(); v_key text; v_bal bigint; v_cur text; v_problem text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_request_id is null or length(p_request_id) < 8 or length(p_request_id) > 80 then raise exception 'bad_request'; end if;
  v_key := 'username:' || p_request_id;

  select balance into v_bal from public.wallets where user_id = v_uid for update;   -- serialises this player's requests
  if not found then raise exception 'not_registered'; end if;

  if exists (select 1 from public.transactions where user_id = v_uid and idempotency_key = v_key) then
    return public.account_json(v_uid) || jsonb_build_object('already', true);       -- a retry: never charge twice
  end if;

  v_problem := public.username_problem(p_new);
  if v_problem is not null then raise exception '%', v_problem; end if;
  select username into v_cur from public.profiles where id = v_uid;
  if lower(p_new) = lower(v_cur) then raise exception 'same_username'; end if;
  if v_bal < 5000 then raise exception 'insufficient_balance'; end if;

  begin
    update public.profiles set username = p_new, username_changes = username_changes + 1, username_changed_at = now() where id = v_uid;
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  perform public.wallet_apply(v_uid, 'username_change_fee', -5000, null, 'username:' || v_cur || '>' || p_new, v_key);
  return public.account_json(v_uid) || jsonb_build_object('already', false, 'fee', 5000);
end $$;

-- ---------------------------------------------------------------- game money (service role only)
-- Place a stake. Idempotent per key, locked per player, and refused if it would overdraw the wallet.
create function public.place_wager(p_user uuid, p_game text, p_round text, p_amount bigint, p_kind text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal bigint; v_w public.wagers; v_cap numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  if p_kind = 'house' then
    v_cap := public.game_payout_cap(p_game);
    if v_cap is null then raise exception 'bad_game'; end if;
  elsif p_kind <> 'pool' or p_game <> 'holdem' then raise exception 'bad_kind';
  end if;
  select balance into v_bal from public.wallets where user_id = p_user for update;
  if not found then raise exception 'not_registered'; end if;
  select * into v_w from public.wagers where user_id = p_user and idempotency_key = p_key;
  if found then return jsonb_build_object('wager_id', v_w.id, 'balance', v_bal, 'already', true); end if;
  if v_bal < p_amount then raise exception 'insufficient_balance'; end if;
  insert into public.wagers (user_id, game, round_ref, kind, amount, max_payout, idempotency_key)
    values (p_user, p_game, p_round, p_kind, p_amount, case when p_kind = 'house' then floor(p_amount * v_cap)::bigint end, p_key)
    returning * into v_w;
  v_bal := public.wallet_apply(p_user, 'wager', -p_amount, p_game, p_round, 'wager:' || v_w.id);
  return jsonb_build_object('wager_id', v_w.id, 'balance', v_bal, 'already', false);
end $$;

-- Pay out one house wager, exactly once. A repeat returns the first result and pays nothing more.
create function public.settle_wager(p_wager uuid, p_payout bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w public.wagers; v_bal bigint;
begin
  select * into v_w from public.wagers where id = p_wager for update;
  if not found then raise exception 'wager_not_found'; end if;
  perform 1 from public.wallets where user_id = v_w.user_id for update;
  select balance into v_bal from public.wallets where user_id = v_w.user_id;
  if v_w.status <> 'open' then return jsonb_build_object('balance', v_bal, 'already', true, 'status', v_w.status); end if;
  if v_w.kind <> 'house' then raise exception 'use_settle_pool'; end if;
  if p_payout is null or p_payout < 0 or p_payout > v_w.max_payout then raise exception 'payout_out_of_range'; end if;
  if p_payout > 0 then v_bal := public.wallet_apply(v_w.user_id, 'payout', p_payout, v_w.game, v_w.round_ref, 'payout:' || v_w.id); end if;
  update public.wagers set status = 'settled', payout = p_payout, settled_at = now() where id = v_w.id;
  return jsonb_build_object('balance', v_bal, 'already', false, 'payout', p_payout);
end $$;

-- Give a stake back (a round that never happened). Only an open wager can be refunded, once.
create function public.refund_wager(p_wager uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w public.wagers; v_bal bigint;
begin
  select * into v_w from public.wagers where id = p_wager for update;
  if not found then raise exception 'wager_not_found'; end if;
  perform 1 from public.wallets where user_id = v_w.user_id for update;
  select balance into v_bal from public.wallets where user_id = v_w.user_id;
  if v_w.status <> 'open' then return jsonb_build_object('balance', v_bal, 'already', true, 'status', v_w.status); end if;
  v_bal := public.wallet_apply(v_w.user_id, 'refund', v_w.amount, v_w.game, v_w.round_ref, 'refund:' || v_w.id);
  update public.wagers set status = 'refunded', payout = v_w.amount, settled_at = now() where id = v_w.id;
  return jsonb_build_object('balance', v_bal, 'already', false);
end $$;

-- Settle a pool (poker): payouts are limited to the coins that players actually put in, so no coin is created.
-- p_payouts: [{"wager_id": "...", "payout": 123}, ...] covering every open wager of the round.
create function public.settle_pool(p_game text, p_round text, p_payouts jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_in bigint; v_out bigint := 0; r record; v_w public.wagers; v_open int; v_listed int := 0;
begin
  select count(*), coalesce(sum(amount), 0) into v_open, v_in from public.wagers
    where game = p_game and round_ref = p_round and kind = 'pool' and status = 'open';
  if v_open = 0 then return jsonb_build_object('already', true); end if;
  for r in select (e ->> 'wager_id')::uuid as id, (e ->> 'payout')::bigint as payout from jsonb_array_elements(p_payouts) e loop
    if r.payout is null or r.payout < 0 then raise exception 'payout_out_of_range'; end if;
    v_out := v_out + r.payout; v_listed := v_listed + 1;
  end loop;
  if v_listed <> v_open then raise exception 'payouts_must_cover_round'; end if;
  if v_out > v_in then raise exception 'payouts_exceed_pool'; end if;
  for r in select (e ->> 'wager_id')::uuid as id, (e ->> 'payout')::bigint as payout from jsonb_array_elements(p_payouts) e loop
    select * into v_w from public.wagers where id = r.id for update;
    if not found or v_w.status <> 'open' or v_w.game <> p_game or v_w.round_ref <> p_round or v_w.kind <> 'pool' then raise exception 'wager_not_in_round'; end if;
    perform 1 from public.wallets where user_id = v_w.user_id for update;
    if r.payout > 0 then perform public.wallet_apply(v_w.user_id, 'payout', r.payout, v_w.game, v_w.round_ref, 'payout:' || v_w.id); end if;
    update public.wagers set status = 'settled', payout = r.payout, settled_at = now() where id = v_w.id;
  end loop;
  return jsonb_build_object('already', false, 'paid', v_out, 'staked', v_in);
end $$;

-- ---------------------------------------------------------------- function permissions
revoke all on function public.wallet_apply(uuid, text, bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.account_json(uuid) from public, anon, authenticated;
revoke all on function public.place_wager(uuid, text, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.settle_wager(uuid, bigint) from public, anon, authenticated;
revoke all on function public.refund_wager(uuid) from public, anon, authenticated;
revoke all on function public.settle_pool(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, text, bigint, text, text, text), public.account_json(uuid) to service_role;
grant execute on function public.place_wager(uuid, text, text, bigint, text, text), public.settle_wager(uuid, bigint),
  public.refund_wager(uuid), public.settle_pool(text, text, jsonb) to service_role;

revoke all on function public.username_available(text), public.get_account(), public.complete_registration(text),
  public.change_username(text, text) from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.get_account(), public.complete_registration(text), public.change_username(text, text) to authenticated;
