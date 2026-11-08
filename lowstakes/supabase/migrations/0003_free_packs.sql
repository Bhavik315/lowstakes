-- Low Stakes: free coin packs, each on its own timer (claimable by anyone with an account, no matter their balance).
--
-- The database clock decides when a pack is ready, so a player cannot claim early by changing their device clock
-- or editing the page. Each claim is one ledger row of type 'free_pack'. The pack amounts and timers live in
-- free_pack_defs() below: change them there (then re-run that one function) to tune the economy.
--
-- Additive only: one new table, one widened CHECK constraint, new functions.

alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('welcome_bonus', 'wager', 'payout', 'refund', 'username_change_fee', 'adjustment', 'round_result', 'free_pack'));

create table public.pack_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pack text not null,
  last_claimed timestamptz not null,
  primary key (user_id, pack)
);
alter table public.pack_claims enable row level security;
alter table public.pack_claims force row level security;
revoke all on public.pack_claims from public, anon, authenticated;
grant select, insert, update, delete on public.pack_claims to service_role;
create policy service_all_pack_claims on public.pack_claims for all to service_role using (true) with check (true);

create or replace function public.free_pack_defs()
returns table (id text, name text, amount bigint, every interval, sort int) language sql immutable as $$
  select * from (values
    ('pocket'::text, 'Pocket change'::text, 1000::bigint,  interval '4 hours',  1),
    ('stack',        'Stack',                5000,         interval '6 hours',  2),
    ('tower',        'Tower',                15000,        interval '24 hours', 3),
    ('vault',        'High roller vault',    40000,        interval '72 hours', 4)
  ) v (id, name, amount, every, sort)
$$;

-- The four packs for the signed-in player, with seconds left on each timer (0 = ready now).
create or replace function public.get_free_packs() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'not_registered'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'amount', d.amount, 'every_seconds', extract(epoch from d.every)::bigint,
        'seconds_left', greatest(0, ceil(extract(epoch from (c.last_claimed + d.every - now()))))::bigint,
        'ready', c.last_claimed is null or now() >= c.last_claimed + d.every) order by d.sort)
    from public.free_pack_defs() d
    left join public.pack_claims c on c.user_id = v_uid and c.pack = d.id), '[]'::jsonb);
end $$;

-- Claim one pack. Refused until its timer has run out. One atomic step: timer reset + coins + ledger row.
create or replace function public.claim_free_pack(p_pack text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_def record; v_last timestamptz; v_bal bigint;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select balance into v_bal from public.wallets where user_id = v_uid for update;   -- serialises this player's claims
  if not found then raise exception 'not_registered'; end if;
  select * into v_def from public.free_pack_defs() d where d.id = p_pack;
  if not found then raise exception 'bad_pack'; end if;
  select last_claimed into v_last from public.pack_claims where user_id = v_uid and pack = p_pack;
  if v_last is not null and now() < v_last + v_def.every then raise exception 'not_ready'; end if;
  insert into public.pack_claims (user_id, pack, last_claimed) values (v_uid, p_pack, now())
    on conflict (user_id, pack) do update set last_claimed = excluded.last_claimed;
  perform public.wallet_apply(v_uid, 'free_pack', v_def.amount, null, p_pack, 'pack:' || p_pack || ':' || floor(extract(epoch from clock_timestamp()) * 1000000)::bigint);
  return public.account_json(v_uid) || jsonb_build_object('claimed', v_def.amount, 'pack', p_pack, 'packs', public.get_free_packs());
end $$;

revoke all on function public.free_pack_defs() from public, anon, authenticated;
revoke all on function public.get_free_packs(), public.claim_free_pack(text) from public, anon, authenticated;
grant execute on function public.free_pack_defs() to service_role;
grant execute on function public.get_free_packs(), public.claim_free_pack(text) to authenticated;
