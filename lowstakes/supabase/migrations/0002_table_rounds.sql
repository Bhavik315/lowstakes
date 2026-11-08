-- Low Stakes: seating and per-round settlement for the game server.
--
-- How coins move once games run on the server:
--   * A player is seated at ONE table at a time (table_presence). The server reads their wallet balance
--     when they sit down and plays with it.
--   * When a round ends, the server sends the NET result of that round (a gain or a loss) to
--     settle_round(). It is applied once per (player, game, round) however many times it is retried.
--   * settle_round() can only be called by the service role (the game server), never by a browser, and only
--     for a player who is seated at that table. It refuses anything that would take a balance below zero,
--     and caps a single gain at a multiple of the balance (a sanity ceiling on top of the game server's logic).
--   * If the server dies mid-round, nothing was written, so the round simply did not happen.
--
-- Additive only: one new table, one widened CHECK constraint, new functions. Nothing is dropped.

alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('welcome_bonus', 'wager', 'payout', 'refund', 'username_change_fee', 'adjustment', 'round_result'));

create table public.table_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  table_code text not null,
  game text,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.table_presence enable row level security;
alter table public.table_presence force row level security;
revoke all on public.table_presence from public, anon, authenticated;
grant select, insert, update, delete on public.table_presence to service_role;
create policy service_all_presence on public.table_presence for all to service_role using (true) with check (true);

-- Highest gain, as a multiple of the player's balance, one round of each game may ever add.
create function public.round_gain_cap(p_game text) returns numeric language sql immutable as $$
  select case p_game when 'roulette' then 35 when 'crash' then 999 when 'blackjack' then 12 when 'holdem' then 100 else null end
$$;

-- Sit a player down. One table at a time: another table (seen in the last two minutes) blocks it.
create function public.join_table(p_user uuid, p_code text, p_game text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_bal bigint; v_p public.table_presence;
begin
  if p_code is null or length(p_code) < 3 or length(p_code) > 20 then raise exception 'bad_table'; end if;
  select balance into v_bal from public.wallets where user_id = p_user for update;   -- serialises seating
  if not found then raise exception 'not_registered'; end if;
  select * into v_p from public.table_presence where user_id = p_user;
  if found and v_p.table_code <> p_code and v_p.last_seen > now() - interval '2 minutes' then
    raise exception 'already_at_table';
  end if;
  insert into public.table_presence (user_id, table_code, game) values (p_user, p_code, p_game)
    on conflict (user_id) do update set table_code = excluded.table_code, game = excluded.game, joined_at = now(), last_seen = now();
  return public.account_json(p_user);
end $$;

create function public.touch_table(p_user uuid, p_code text) returns void
language sql security definer set search_path = public as $$
  update public.table_presence set last_seen = now() where user_id = p_user and table_code = p_code
$$;

create function public.leave_table(p_user uuid, p_code text) returns void
language sql security definer set search_path = public as $$
  delete from public.table_presence where user_id = p_user and table_code = p_code
$$;

-- Apply the net result of finished rounds. Each item is handled on its own: one bad item never blocks the rest.
-- p_items: [{"user": uuid, "table": "ABCDE", "game": "roulette", "ref": "12", "delta": -500}, ...]
create function public.settle_round(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_user uuid; v_table text; v_game text; v_ref text; v_delta bigint; v_key text;
  v_bal bigint; v_cap numeric; v_new bigint; out jsonb := '[]'::jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    begin
      v_user := (it ->> 'user')::uuid; v_table := it ->> 'table'; v_game := it ->> 'game';
      v_ref := it ->> 'ref'; v_delta := (it ->> 'delta')::bigint;
      v_cap := public.round_gain_cap(v_game);
      if v_cap is null then raise exception 'bad_game'; end if;
      if v_ref is null or length(v_ref) = 0 or length(v_ref) > 60 then raise exception 'bad_ref'; end if;
      if v_delta is null then raise exception 'bad_amount'; end if;
      v_key := 'round:' || v_game || ':' || v_table || ':' || v_ref;

      select balance into v_bal from public.wallets where user_id = v_user for update;
      if not found then raise exception 'not_registered'; end if;
      if not exists (select 1 from public.table_presence where user_id = v_user and table_code = v_table) then raise exception 'not_seated'; end if;

      if exists (select 1 from public.transactions where user_id = v_user and idempotency_key = v_key) then
        out := out || jsonb_build_object('user', v_user, 'ok', true, 'already', true, 'balance', v_bal);
        continue;
      end if;
      if v_delta = 0 then
        out := out || jsonb_build_object('user', v_user, 'ok', true, 'balance', v_bal, 'noop', true);
        continue;
      end if;
      if v_delta < -v_bal then raise exception 'insufficient_balance'; end if;
      if v_delta > floor(v_cap * v_bal) then raise exception 'gain_too_large'; end if;
      v_new := public.wallet_apply(v_user, 'round_result', v_delta, v_game, v_table || ':' || v_ref, v_key);
      update public.table_presence set last_seen = now() where user_id = v_user;
      out := out || jsonb_build_object('user', v_user, 'ok', true, 'balance', v_new);
    exception when others then
      out := out || jsonb_build_object('user', it ->> 'user', 'ok', false, 'error', sqlerrm);
    end;
  end loop;
  return out;
end $$;

revoke all on function public.round_gain_cap(text), public.join_table(uuid, text, text), public.touch_table(uuid, text),
  public.leave_table(uuid, text), public.settle_round(jsonb) from public, anon, authenticated;
grant execute on function public.round_gain_cap(text), public.join_table(uuid, text, text), public.touch_table(uuid, text),
  public.leave_table(uuid, text), public.settle_round(jsonb) to service_role;

-- Renaming costs coins, so it must not happen while a table is playing with this wallet (the table would be
-- working from a stale balance). The rename is refused until the player has left their table.
create or replace function public.change_username(p_new text, p_request_id text) returns jsonb
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

  if exists (select 1 from public.table_presence where user_id = v_uid and last_seen > now() - interval '2 minutes') then
    raise exception 'leave_table_first';
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
