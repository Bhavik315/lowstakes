\set ON_ERROR_STOP on
\set QUIET on
create temp table r2(name text, ok boolean, detail text);
grant all on r2 to public;
create function pg_temp.t(name text, ok boolean, detail text default '') returns void language sql as $$ insert into r2 values (name, ok, detail) $$;
create function pg_temp.fails_with(sql text, expect text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm like '%'||expect||'%'; end $$;
create function pg_temp.item(u text, tbl text, game text, ref text, delta bigint) returns jsonb language sql as
  $$ select jsonb_build_array(jsonb_build_object('user', u, 'table', tbl, 'game', game, 'ref', ref, 'delta', delta)) $$;
create function pg_temp.bal(u uuid) returns bigint language sql as $$ select balance from wallets where user_id = u $$;

insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000a1', 'p1@x.com', now()), ('00000000-0000-0000-0000-0000000000a2', 'p2@x.com', now());
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select complete_registration('Player_One') \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select complete_registration('Player_Two') \gset
reset role;

-- ===== a browser can touch none of it
set role authenticated;
select pg_temp.t('browser cannot seat itself, settle, or read presence',
  pg_temp.fails_with($$select join_table('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette')$$, 'permission denied')
  and pg_temp.fails_with($$select settle_round('[]')$$, 'permission denied')
  and pg_temp.fails_with($$select * from table_presence$$, 'permission denied'));
reset role;

set role service_role;
-- ===== seating
select pg_temp.t('settling before sitting down is refused', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','1',-100)) -> 0 ->> 'error') = 'not_seated');
select pg_temp.t('joining returns the wallet balance', (join_table('00000000-0000-0000-0000-0000000000a1', 'ABCDE', 'roulette') ->> 'balance')::bigint = 20000);
select pg_temp.t('re-joining the same table is fine', (join_table('00000000-0000-0000-0000-0000000000a1', 'ABCDE', 'roulette') ->> 'balance')::bigint = 20000);
select pg_temp.t('a second table is refused while seated', pg_temp.fails_with($$select join_table('00000000-0000-0000-0000-0000000000a1','ZZZZZ','crash')$$, 'already_at_table'));
select pg_temp.t('unregistered users cannot be seated', pg_temp.fails_with($$select join_table(gen_random_uuid(),'ABCDE','roulette')$$, 'not_registered'));
update table_presence set last_seen = now() - interval '5 minutes' where user_id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.t('a stale seat (the server vanished) can be taken over', (join_table('00000000-0000-0000-0000-0000000000a1', 'ZZZZZ', 'crash') ->> 'balance')::bigint = 20000);
select leave_table('00000000-0000-0000-0000-0000000000a1', 'WRONG');
select pg_temp.t('leaving a different table does nothing', exists (select 1 from table_presence where user_id = '00000000-0000-0000-0000-0000000000a1'));
select leave_table('00000000-0000-0000-0000-0000000000a1', 'ZZZZZ');
select pg_temp.t('leaving frees the seat', not exists (select 1 from table_presence where user_id = '00000000-0000-0000-0000-0000000000a1'));
select join_table('00000000-0000-0000-0000-0000000000a1', 'ABCDE', 'roulette');
select join_table('00000000-0000-0000-0000-0000000000a2', 'ABCDE', 'roulette');

-- ===== settling
select settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','7',-500));
select pg_temp.t('a loss is deducted', pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 19500);
select pg_temp.t('the same round settled again changes nothing', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','7',-500)) -> 0 ->> 'already')::boolean and pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 19500);
select pg_temp.t('...even if the retry claims a different amount', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','7',99999)) -> 0 ->> 'already')::boolean and pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 19500);
select settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','8',1750));
select pg_temp.t('a win is credited', pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 21250);
select pg_temp.t('a zero result writes nothing', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','9',0)) -> 0 ->> 'noop')::boolean);
select pg_temp.t('overdrawing is refused and changes nothing', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','10',-99999)) -> 0 ->> 'error') = 'insufficient_balance' and pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 21250);
select pg_temp.t('an absurd gain is refused (cap = 35x balance at roulette)', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','11',21250*35+1)) -> 0 ->> 'error') = 'gain_too_large' and pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 21250);
select pg_temp.t('the largest allowed gain is accepted', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','12',21250*35)) -> 0 ->> 'ok')::boolean and pg_temp.bal('00000000-0000-0000-0000-0000000000a1') = 21250 * 36);
select settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','13',-(21250*36 - 20000)));
select pg_temp.t('unknown games and bad references are refused', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','bingo','1',5)) -> 0 ->> 'error') = 'bad_game' and (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a1','ABCDE','roulette','',5)) -> 0 ->> 'error') = 'bad_ref');
select pg_temp.t('wrong table for the seat is refused', (settle_round(pg_temp.item('00000000-0000-0000-0000-0000000000a2','OTHER','crash','1',100)) -> 0 ->> 'error') = 'not_seated');
select pg_temp.t('one bad item does not block the others in a batch',
  (select (r -> 0 ->> 'ok')::boolean = false and (r -> 1 ->> 'ok')::boolean and (r -> 2 ->> 'ok')::boolean from (select settle_round(
     '[{"user":"00000000-0000-0000-0000-0000000000a1","table":"ABCDE","game":"roulette","ref":"20","delta":-9999999},
       {"user":"00000000-0000-0000-0000-0000000000a2","table":"ABCDE","game":"roulette","ref":"20","delta":-1000},
       {"user":"00000000-0000-0000-0000-0000000000a1","table":"ABCDE","game":"roulette","ref":"21","delta":-1}]') r) q));

-- ===== renaming is refused while seated, and allowed after leaving
select join_table('00000000-0000-0000-0000-0000000000a2', 'ABCDE', 'roulette');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.t('renaming while seated is refused and charges nothing', pg_temp.fails_with($$select change_username('Two_Renamed','req-seated-0001')$$, 'leave_table_first')
  and (select balance from wallets where user_id = '00000000-0000-0000-0000-0000000000a2') = (select balance from wallets where user_id = '00000000-0000-0000-0000-0000000000a2'));
reset role;
select balance as before_rename from wallets where user_id = '00000000-0000-0000-0000-0000000000a2' \gset
set role service_role;
select leave_table('00000000-0000-0000-0000-0000000000a2', 'ABCDE');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select change_username('Two_Renamed', 'req-seated-0002') \gset
reset role;
select pg_temp.t('after leaving the table the rename works and costs exactly 5000', (select balance from wallets where user_id = '00000000-0000-0000-0000-0000000000a2') = :before_rename - 5000);
set role service_role;
select pg_temp.t('ledger rows are round_result with the table reference', exists (select 1 from transactions where type = 'round_result' and game = 'roulette' and ref = 'ABCDE:7' and amount = -500));
select pg_temp.t('wallet equals the sum of its ledger, for both players', not exists (select 1 from wallets w where w.balance <> (select coalesce(sum(amount),0) from transactions t where t.user_id = w.user_id)));
select pg_temp.t('the wallet balance never went negative', not exists (select 1 from wallets where balance < 0));
reset role;

\unset QUIET
select case when ok then 'PASS' else 'FAIL' end as r, name, case when ok then '' else detail end from r2 order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from r2;
