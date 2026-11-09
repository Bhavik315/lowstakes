\set ON_ERROR_STOP on
\set QUIET on
create temp table r4(name text, ok boolean, detail text);
grant all on r4 to public;
create function pg_temp.t(name text, ok boolean, detail text default '') returns void language sql as $$ insert into r4 values (name, ok, detail) $$;
create function pg_temp.fails_with(sql text, expect text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm like '%'||expect||'%'; end $$;
create function pg_temp.bal(u int) returns bigint language sql as $$ select balance from wallets where user_id = ('00000000-0000-0000-0000-00000000d00' || u)::uuid $$;
create function pg_temp.u(i int) returns uuid language sql as $$ select ('00000000-0000-0000-0000-00000000d00' || i)::uuid $$;

do $$ begin
  for i in 1..8 loop
    insert into auth.users (id, email, email_confirmed_at) values (('00000000-0000-0000-0000-00000000d00' || i)::uuid, 'll' || i || '@x.com', now());
  end loop;
end $$;
set role authenticated;
do $$ begin
  for i in 1..8 loop
    perform set_config('request.jwt.claim.sub', ('00000000-0000-0000-0000-00000000d00' || i), false);
    perform complete_registration('Land_' || i);
  end loop;
end $$;
reset role;

-- ===== a browser can call none of it
set role authenticated;
select pg_temp.t('browsers cannot create, join, finish or cancel matches', pg_temp.fails_with($$select landlords_create(pg_temp.u(1), 'AAAAA', 100)$$, 'permission denied')
  and pg_temp.fails_with($$select landlords_join(pg_temp.u(1), 'AAAAA')$$, 'permission denied')
  and pg_temp.fails_with($$select landlords_finish('AAAAA', pg_temp.u(1))$$, 'permission denied')
  and pg_temp.fails_with($$select landlords_cancel('AAAAA', 'x')$$, 'permission denied')
  and pg_temp.fails_with($$select * from landlord_matches$$, 'permission denied') and pg_temp.fails_with($$select * from landlord_entries$$, 'permission denied'));
reset role;
set role service_role;

-- ===== create and join: the fee is taken once, only after the seat is valid
select landlords_create(pg_temp.u(1), 'AAAAA', 1000) \gset
select pg_temp.t('the host pays the entry fee when creating', pg_temp.bal(1) = 19000 and (select count(*) from transactions where type = 'landlords_entry') = 1);
select pg_temp.t('bad table codes and fees are refused and charge nothing', pg_temp.fails_with($$select landlords_create(pg_temp.u(2), 'abc', 100)$$, 'bad_table') and pg_temp.fails_with($$select landlords_create(pg_temp.u(2), 'BBBBB', -5)$$, 'bad_fee') and pg_temp.fails_with($$select landlords_create(pg_temp.u(2), 'BBBBB', 999999)$$, 'bad_fee') and pg_temp.bal(2) = 20000);
select pg_temp.t('a code with an open match cannot be created again', pg_temp.fails_with($$select landlords_create(pg_temp.u(2), 'AAAAA', 100)$$, 'code_taken') and pg_temp.bal(2) = 20000);
select landlords_join(pg_temp.u(2), 'AAAAA') \gset
select pg_temp.t('joining charges the fee', pg_temp.bal(2) = 19000);
select pg_temp.t('joining twice charges once and says so', (landlords_join(pg_temp.u(2), 'AAAAA') ->> 'already')::boolean and pg_temp.bal(2) = 19000);
select pg_temp.t('joining a table that does not exist charges nothing', pg_temp.fails_with($$select landlords_join(pg_temp.u(3), 'ZZZZZ')$$, 'notfound') and pg_temp.bal(3) = 20000);
update wallets set balance = 500 where user_id = pg_temp.u(3);
select pg_temp.t('not enough coins: refused, nothing charged, not seated', pg_temp.fails_with($$select landlords_join(pg_temp.u(3), 'AAAAA')$$, 'insufficient_balance') and pg_temp.bal(3) = 500
  and not exists (select 1 from table_presence where user_id = pg_temp.u(3)) and not exists (select 1 from landlord_entries where user_id = pg_temp.u(3)));
update wallets set balance = 20000 where user_id = pg_temp.u(3);
select landlords_join(pg_temp.u(3), 'AAAAA') \gset
select pg_temp.t('starting with fewer than four players is refused', pg_temp.fails_with($$select landlords_start('AAAAA', pg_temp.u(1))$$, 'not_enough_players'));
select landlords_join(pg_temp.u(4), 'AAAAA') \gset
select pg_temp.t('only the host can start', pg_temp.fails_with($$select landlords_start('AAAAA', pg_temp.u(2))$$, 'not_host'));
select landlords_join(pg_temp.u(5), 'AAAAA') \gset
select landlords_join(pg_temp.u(6), 'AAAAA') \gset
select pg_temp.t('a seventh player is refused and not charged', pg_temp.fails_with($$select landlords_join(pg_temp.u(7), 'AAAAA')$$, 'full') and pg_temp.bal(7) = 20000);
select landlords_leave(pg_temp.u(6), 'AAAAA') \gset
select pg_temp.t('leaving the lobby refunds the fee', pg_temp.bal(6) = 20000 and not exists (select 1 from landlord_entries where user_id = pg_temp.u(6)) and not exists (select 1 from table_presence where user_id = pg_temp.u(6)), pg_temp.bal(6)::text || ' entries=' || (select count(*) from landlord_entries where user_id = pg_temp.u(6)) || ' presence=' || (select count(*) from table_presence where user_id = pg_temp.u(6)));
select pg_temp.t('...and refunding twice is impossible (the entry is gone)', (landlords_leave(pg_temp.u(6), 'AAAAA') ->> 'left')::boolean and pg_temp.bal(6) = 20000);
select pg_temp.t('one table at a time: a seated player cannot create another match', pg_temp.fails_with($$select landlords_create(pg_temp.u(5), 'CCCCC', 100)$$, 'already_at_table') and pg_temp.bal(5) = 19000);

-- ===== start: the pot is locked, nobody can join a started match
select landlords_start('AAAAA', pg_temp.u(1)) as started \gset
select pg_temp.t('start with five players locks the pot at 5,000', (:'started'::jsonb ->> 'pot')::bigint = 5000 and (select pot from landlord_matches where code = 'AAAAA') = 5000);
select pg_temp.t('starting twice is harmless', (landlords_start('AAAAA', pg_temp.u(1)) ->> 'already')::boolean);
select pg_temp.t('joining a started match is refused and charges nothing', pg_temp.fails_with($$select landlords_join(pg_temp.u(7), 'AAAAA')$$, 'already_started') and pg_temp.bal(7) = 20000);
select pg_temp.t('a player already in can reconnect to a started match without being charged', (landlords_join(pg_temp.u(2), 'AAAAA') ->> 'already')::boolean and pg_temp.bal(2) = 19000);
select landlords_leave(pg_temp.u(5), 'AAAAA') \gset
select pg_temp.t('leaving a running match forfeits the fee (no refund)', pg_temp.bal(5) = 19000 and (select status from landlord_entries where user_id = pg_temp.u(5)) = 'forfeit');
select pg_temp.t('a running match cannot be cancelled by leaving, and cannot be won by a stranger', pg_temp.fails_with($$select landlords_finish('AAAAA', pg_temp.u(7))$$, 'bad_winner'));

-- ===== finish: the winner is paid the whole pot, exactly once
select landlords_finish('AAAAA', pg_temp.u(2)) \gset
select pg_temp.t('the winner receives the whole pot (5,000)', pg_temp.bal(2) = 19000 + 5000);
select pg_temp.t('finishing again pays nothing more', (landlords_finish('AAAAA', pg_temp.u(2)) ->> 'already')::boolean and pg_temp.bal(2) = 24000);
select pg_temp.t('finishing again naming someone else pays nobody', (landlords_finish('AAAAA', pg_temp.u(4)) ->> 'already')::boolean and pg_temp.bal(4) = 19000 and pg_temp.bal(2) = 24000);
select pg_temp.t('a finished match cannot be cancelled and refunded', (landlords_cancel('AAAAA', 'x') ->> 'already')::boolean and pg_temp.bal(1) = 19000 and pg_temp.bal(2) = 24000);
select pg_temp.t('exactly one prize ledger row', (select count(*) from transactions where type = 'landlords_prize') = 1);
select pg_temp.t('everyone is released from the table afterwards', not exists (select 1 from table_presence where table_code = 'AAAAA'));
select pg_temp.t('the code can be used again after the match', (landlords_create(pg_temp.u(1), 'AAAAA', 0) ->> 'fee')::bigint = 0);
select landlords_cancel('AAAAA', 'test cleanup');

-- ===== cancel: everyone is refunded, once
select landlords_create(pg_temp.u(1), 'DDDDD', 2000) \gset
select landlords_join(pg_temp.u(2), 'DDDDD') \gset
select landlords_join(pg_temp.u(3), 'DDDDD') \gset
select landlords_join(pg_temp.u(4), 'DDDDD') \gset
select landlords_start('DDDDD', pg_temp.u(1)) \gset
select landlords_leave(pg_temp.u(4), 'DDDDD') \gset
select pg_temp.t('before the cancel the four fees are held', pg_temp.bal(1) = 17000 and pg_temp.bal(2) = 22000 and pg_temp.bal(3) = 17000 and pg_temp.bal(4) = 17000);
select pg_temp.t('cancelling a running match refunds every entry, even a player who had left', (landlords_cancel('DDDDD', 'server failure') ->> 'refunded')::int = 4 and pg_temp.bal(1) = 19000 and pg_temp.bal(2) = 24000 and pg_temp.bal(3) = 19000 and pg_temp.bal(4) = 19000);
select pg_temp.t('cancelling again refunds nothing more', (landlords_cancel('DDDDD', 'again') ->> 'already')::boolean and pg_temp.bal(1) = 19000);
select pg_temp.t('a cancelled match cannot pay a winner', pg_temp.fails_with($$select landlords_finish('DDDDD', pg_temp.u(1))$$, 'not_playing') and pg_temp.bal(1) = 19000);

-- ===== sweep: a match nobody runs any more is refunded
select landlords_create(pg_temp.u(5), 'EEEEE', 500) \gset
select landlords_join(pg_temp.u(6), 'EEEEE') \gset
select pg_temp.t('a fresh lobby is not swept', landlords_sweep() = 0);
update landlord_matches set touched_at = now() - interval '4 hours' where code = 'EEEEE';
select pg_temp.t('a stale lobby is cancelled and refunded', landlords_sweep() = 1 and pg_temp.bal(5) = 19000 and pg_temp.bal(6) = 20000);
select landlords_create(pg_temp.u(5), 'FFFFF', 0) \gset
select landlords_join(pg_temp.u(6), 'FFFFF') \gset
select landlords_join(pg_temp.u(7), 'FFFFF') \gset
select landlords_join(pg_temp.u(8), 'FFFFF') \gset
select landlords_start('FFFFF', pg_temp.u(5)) \gset
select pg_temp.t('a free (fee 0) match writes no ledger rows and pays no pot', (select pot from landlord_matches where code = 'FFFFF') = 0);
select landlords_finish('FFFFF', pg_temp.u(6)) \gset
select pg_temp.t('...and finishing it changes no balance', pg_temp.bal(6) = 20000 and pg_temp.bal(5) = 19000);

-- ===== the books balance
reset role;
select pg_temp.t('wallets still equal the sum of their ledgers', not exists (select 1 from wallets w where w.balance <> (select coalesce(sum(amount),0) from transactions t where t.user_id = w.user_id)));
select pg_temp.t('coins are never created: all entry fees equal all prizes plus refunds of cancelled matches, taken as a whole',
  (select coalesce(sum(amount), 0) from transactions where type in ('landlords_entry', 'landlords_prize', 'landlords_refund')) = (select -coalesce(sum(fee), 0) from landlord_entries where status in ('held', 'forfeit', 'lost', 'won')) + (select coalesce(sum(pot), 0) from landlord_matches where status = 'finished'));

\unset QUIET
select case when ok then 'PASS' else 'FAIL' end as r, name, case when ok then '' else detail end from r4 order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from r4;
