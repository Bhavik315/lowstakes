\set ON_ERROR_STOP on
\set QUIET on
create temp table r3(name text, ok boolean, detail text);
grant all on r3 to public;
create function pg_temp.t(name text, ok boolean, detail text default '') returns void language sql as $$ insert into r3 values (name, ok, detail) $$;
create function pg_temp.fails_with(sql text, expect text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm like '%'||expect||'%'; end $$;
create function pg_temp.bal(u uuid) returns bigint language sql as $$ select balance from wallets where user_id = u $$;

insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000c1', 'c1@x.com', now()), ('00000000-0000-0000-0000-0000000000c2', 'c2@x.com', now()), ('00000000-0000-0000-0000-0000000000c3', 'c3@x.com', null);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select complete_registration('Pack_One') \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select complete_registration('Pack_Two') \gset
reset role;

-- ===== who can use it
set role anon;
select pg_temp.t('signed-out visitors cannot list or claim packs', pg_temp.fails_with($$select get_free_packs()$$, 'permission denied') and pg_temp.fails_with($$select claim_free_pack('pocket')$$, 'permission denied'));
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select pg_temp.t('an account that has not finished registering cannot claim', pg_temp.fails_with($$select claim_free_pack('pocket')$$, 'not_registered') and pg_temp.fails_with($$select get_free_packs()$$, 'not_registered'));
select pg_temp.t('browsers cannot read the claims table or change the pack definitions', pg_temp.fails_with($$select * from pack_claims$$, 'permission denied') and pg_temp.fails_with($$select free_pack_defs()$$, 'permission denied'));

-- ===== a brand-new account has to wait: the timers start at registration
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.t('a new account sees four packs and none is ready', (select count(*) = 4 and not bool_or((p ->> 'ready')::boolean) from jsonb_array_elements(get_free_packs()) p));
select pg_temp.t('the timers start at full length (4h / 6h / 24h / 72h, give or take the seconds since signing up)',
  (select bool_and((p ->> 'seconds_left')::int between (p ->> 'every_seconds')::int - 60 and (p ->> 'every_seconds')::int) from jsonb_array_elements(get_free_packs()) p));
select pg_temp.t('claiming straight after signing up is refused for every pack, and pays nothing',
  pg_temp.fails_with($$select claim_free_pack('pocket')$$, 'not_ready') and pg_temp.fails_with($$select claim_free_pack('stack')$$, 'not_ready')
  and pg_temp.fails_with($$select claim_free_pack('tower')$$, 'not_ready') and pg_temp.fails_with($$select claim_free_pack('vault')$$, 'not_ready'));
reset role;
select pg_temp.t('...and nothing was written', pg_temp.bal('00000000-0000-0000-0000-0000000000c1') = 20000 and not exists (select 1 from transactions where type = 'free_pack') and not exists (select 1 from pack_claims));
-- time passes (the test moves the registration time back; a player cannot do this)
update profiles set created_at = now() - interval '3 hours 59 minutes' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.t('one minute short of four hours after signing up: the first pack is still not ready', pg_temp.fails_with($$select claim_free_pack('pocket')$$, 'not_ready'));
reset role;
update profiles set created_at = now() - interval '4 hours 1 minute' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.t('four hours after signing up only the first pack is ready', (select count(*) = 1 and bool_or(p ->> 'id' = 'pocket') from jsonb_array_elements(get_free_packs()) p where (p ->> 'ready')::boolean));
select pg_temp.t('the 6-hour timer shows about two hours left', (select (p ->> 'seconds_left')::int between 7100 and 7200 from jsonb_array_elements(get_free_packs()) p where p ->> 'id' = 'stack'));
reset role;
-- enough time for everything, for the claiming tests below
update profiles set created_at = now() - interval '100 hours' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
-- ===== listing and claiming

select pg_temp.t('after the wait, all four packs are ready', (select count(*) = 4 and bool_and((p ->> 'ready')::boolean) from jsonb_array_elements(get_free_packs()) p));
select pg_temp.t('the packs are 1,000 / 5,000 / 15,000 / 40,000 on 4h / 6h / 24h / 72h timers',
  (select array_agg(((p ->> 'amount') || '/' || ((p ->> 'every_seconds')::int / 3600))) from jsonb_array_elements(get_free_packs()) p) = array['1000/4','5000/6','15000/24','40000/72']);
select claim_free_pack('pocket') \gset
select pg_temp.t('claiming credits exactly the pack amount', pg_temp.bal('00000000-0000-0000-0000-0000000000c1') = 21000);
select pg_temp.t('claiming the same pack again is refused and charges nothing', pg_temp.fails_with($$select claim_free_pack('pocket')$$, 'not_ready') and pg_temp.bal('00000000-0000-0000-0000-0000000000c1') = 21000);
select pg_temp.t('the timer now counts down from about four hours', (select (p ->> 'seconds_left')::int between 14390 and 14400 and not (p ->> 'ready')::boolean from jsonb_array_elements(get_free_packs()) p where p ->> 'id' = 'pocket'));
select pg_temp.t('the other packs are still ready', (select count(*) = 3 from jsonb_array_elements(get_free_packs()) p where (p ->> 'ready')::boolean));
select pg_temp.t('an unknown pack is refused', pg_temp.fails_with($$select claim_free_pack('nonsense')$$, 'bad_pack') and pg_temp.fails_with($$select claim_free_pack(null)$$, 'bad_pack'));
select claim_free_pack('vault') \gset
select pg_temp.t('the big pack pays 40,000', pg_temp.bal('00000000-0000-0000-0000-0000000000c1') = 61000);
reset role;
select pg_temp.t('another (brand-new) player is unaffected and still has to wait', pg_temp.bal('00000000-0000-0000-0000-0000000000c2') = 20000 and not exists (select 1 from pack_claims where user_id = '00000000-0000-0000-0000-0000000000c2'));

-- ===== time passing (the test moves the stored claim time back; a player cannot do this)
update pack_claims set last_claimed = now() - interval '3 hours 59 minutes' where pack = 'pocket' and user_id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.t('one minute short of four hours: still not ready', pg_temp.fails_with($$select claim_free_pack('pocket')$$, 'not_ready'));
reset role;
update pack_claims set last_claimed = now() - interval '4 hours 1 minute' where pack = 'pocket' and user_id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select claim_free_pack('pocket') \gset
select pg_temp.t('after four hours it can be claimed again', pg_temp.bal('00000000-0000-0000-0000-0000000000c1') = 62000);
reset role;

-- ===== the ledger
select pg_temp.t('each claim is one ledger row of type free_pack with the pack as reference', (select count(*) from transactions where user_id = '00000000-0000-0000-0000-0000000000c1' and type = 'free_pack') = 3
  and exists (select 1 from transactions where type = 'free_pack' and ref = 'vault' and amount = 40000 and balance_after = 61000));
select pg_temp.t('wallets still equal the sum of their ledgers', not exists (select 1 from wallets w where w.balance <> (select coalesce(sum(amount),0) from transactions t where t.user_id = w.user_id)));

\unset QUIET
select case when ok then 'PASS' else 'FAIL' end as r, name, case when ok then '' else detail end from r3 order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from r3;
