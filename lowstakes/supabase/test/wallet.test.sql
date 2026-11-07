\set ON_ERROR_STOP on
\set QUIET on
create temp table results(name text, ok boolean, detail text);
grant all on results to public;
create function pg_temp.t(name text, ok boolean, detail text default '') returns void language sql as $$ insert into results values (name, ok, detail) $$;
create function pg_temp.fails_with(sql text, expect text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when others then return sqlerrm like '%'||expect||'%'; end $$;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;

insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a', 'a@x.com', now()),
 ('00000000-0000-0000-0000-00000000000b', 'b@x.com', now()),
 ('00000000-0000-0000-0000-00000000000c', 'c@x.com', null),
 ('00000000-0000-0000-0000-00000000000d', 'A@X.com', now());   -- same email as user a, a different auth user

-- ===== registration
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.t('unverified email cannot register', pg_temp.fails_with($$select complete_registration('Unverified')$$, 'email_not_verified'));
select pg_temp.t('unverified user has no wallet', (select (get_account()->>'registered')::boolean = false and (get_account()->>'email_verified')::boolean = false));

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.t('invalid usernames rejected', pg_temp.fails_with($$select complete_registration('ab')$$, 'username_length')
  and pg_temp.fails_with($$select complete_registration('bad name!')$$, 'username_chars')
  and pg_temp.fails_with($$select complete_registration('')$$, 'username_empty')
  and pg_temp.fails_with($$select complete_registration('Admin')$$, 'username_reserved')
  and pg_temp.fails_with($$select complete_registration('abcdefghijklmnopq')$$, 'username_length'));
select pg_temp.t('availability: free name', (username_available('LuckyPlayer')->>'available')::boolean);
select pg_temp.t('no coins before registering', not exists (select 1 from wallets) );
select complete_registration('LuckyPlayer') as reg \gset
select pg_temp.t('registration gives exactly 20000', (get_account()->>'balance')::bigint = 20000, get_account()::text);
select pg_temp.t('repeat registration is a no-op (no 2nd bonus)', (complete_registration('LuckyPlayer')->>'balance')::bigint = 20000
  and (complete_registration('Other_Name')->>'username') = 'LuckyPlayer' and (complete_registration('Other_Name')->>'balance')::bigint = 20000);
select pg_temp.t('exactly one welcome_bonus row', (select count(*) from transactions where type='welcome_bonus') = 1);
select pg_temp.t('case-insensitive: taken name reported unavailable', not (username_available('luckyplayer')->>'available')::boolean);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.t('duplicate username (different case) rejected', pg_temp.fails_with($$select complete_registration('LUCKYPLAYER')$$, 'username_taken'));
select pg_temp.t('failed registration leaves no wallet/bonus', not exists (select 1 from wallets));
select complete_registration('Bob_99') as regb \gset
select pg_temp.t('second user gets own 20000', (get_account()->>'balance')::bigint = 20000);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.t('same email under another auth user cannot make a 2nd account', pg_temp.fails_with($$select complete_registration('Dupe_Email')$$, 'email_in_use'));

-- ===== row level security
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.t('can only see own wallet/profile/ledger', (select count(*) from wallets) = 1 and (select count(*) from profiles) = 1 and (select count(*) from transactions) = 1);
select pg_temp.t('cannot edit own balance', pg_temp.fails_with($$update wallets set balance = 999999$$, 'permission denied'));
select pg_temp.t('cannot insert a transaction', pg_temp.fails_with($$insert into transactions(user_id,type,amount,balance_after) values ('00000000-0000-0000-0000-00000000000b','adjustment',1,1)$$, 'permission denied'));
select pg_temp.t('cannot delete ledger', pg_temp.fails_with($$delete from transactions$$, 'permission denied'));
select pg_temp.t('cannot rename via table update', pg_temp.fails_with($$update profiles set username='Hacker'$$, 'permission denied'));
select pg_temp.t('cannot read wagers table', pg_temp.fails_with($$select * from wagers$$, 'permission denied'));
select pg_temp.t('cannot call game money functions', pg_temp.fails_with($$select place_wager('00000000-0000-0000-0000-00000000000b','roulette','r1',100,'house','k')$$, 'permission denied')
  and pg_temp.fails_with($$select wallet_apply('00000000-0000-0000-0000-00000000000b','adjustment',1000000,null,'x','x')$$, 'permission denied')
  and pg_temp.fails_with($$select settle_wager(gen_random_uuid(), 1000000)$$, 'permission denied'));
reset role; set role anon;
select pg_temp.t('anon cannot read accounts or call get_account', pg_temp.fails_with($$select * from wallets$$, 'permission denied') and pg_temp.fails_with($$select get_account()$$, 'permission denied'));
select pg_temp.t('anon can check availability only', (username_available('FreeName1')->>'available')::boolean);
reset role;

-- ===== username change
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.t('change to taken name: refused, not charged', pg_temp.fails_with($$select change_username('luckyplayer','req-00000001')$$, 'username_taken')
  and (get_account()->>'balance')::bigint = 20000);
select pg_temp.t('invalid new name: refused, not charged', pg_temp.fails_with($$select change_username('x','req-00000002')$$, 'username_length') and (get_account()->>'balance')::bigint = 20000);
select pg_temp.t('same name refused', pg_temp.fails_with($$select change_username('bob_99','req-00000003')$$, 'same_username') and (get_account()->>'balance')::bigint = 20000);
select change_username('Bobby_Tables','req-00000004') \gset
select pg_temp.t('first change costs exactly 5000', (get_account()->>'balance')::bigint = 15000 and get_account()->>'username' = 'Bobby_Tables', get_account()::text);
select pg_temp.t('same request twice charges once', (change_username('Bobby_Tables','req-00000004')->>'already')::boolean and (get_account()->>'balance')::bigint = 15000);
select change_username('Bob_Again','req-00000005') \gset
select pg_temp.t('second change costs 5000 too', (get_account()->>'balance')::bigint = 10000);
select pg_temp.t('old name is free again', (username_available('Bob_99')->>'available')::boolean);
select pg_temp.t('fee rows in ledger', (select count(*) from transactions where type='username_change_fee' and amount=-5000) = 2);
reset role;
update wallets set balance = 4999 where user_id = '00000000-0000-0000-0000-00000000000b';   -- test setup as superuser
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.t('under 5000: refused, name and balance unchanged', pg_temp.fails_with($$select change_username('Poor_Bob','req-00000006')$$, 'insufficient_balance')
  and get_account()->>'username' = 'Bob_Again' and (get_account()->>'balance')::bigint = 4999);
reset role;
update wallets set balance = 10000 where user_id = '00000000-0000-0000-0000-00000000000b';

-- ===== ledger is append-only (even for the service role)
set role service_role;
select pg_temp.t('service role cannot update ledger rows', pg_temp.fails_with($$update transactions set amount = 1$$, 'append-only'));
select pg_temp.t('service role cannot delete ledger rows', pg_temp.fails_with($$delete from transactions$$, 'append-only'));
select pg_temp.t('service role cannot truncate the ledger', pg_temp.fails_with($$truncate transactions$$, 'permission denied') or pg_temp.fails_with($$truncate transactions$$, 'append-only'));
select pg_temp.t('second welcome bonus row impossible', pg_temp.fails_with($$insert into transactions(user_id,type,amount,balance_after) values ('00000000-0000-0000-0000-00000000000b','welcome_bonus',20000,1)$$, 'duplicate key'));
reset role;

-- ===== game wagers (service role)
set role service_role;
select place_wager('00000000-0000-0000-0000-00000000000a','roulette','rl-1',1000,'house','bet-1') as w1 \gset
select pg_temp.t('wager deducts', (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 19000);
select pg_temp.t('same wager key does not deduct twice', (place_wager('00000000-0000-0000-0000-00000000000a','roulette','rl-1',1000,'house','bet-1')->>'already')::boolean
  and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 19000);
select pg_temp.t('overdraft refused', pg_temp.fails_with($$select place_wager('00000000-0000-0000-0000-00000000000a','roulette','rl-2',99999,'house','bet-big')$$, 'insufficient_balance'));
select pg_temp.t('bad amounts refused', pg_temp.fails_with($$select place_wager('00000000-0000-0000-0000-00000000000a','roulette','rl-2',0,'house','k0')$$, 'bad_amount')
  and pg_temp.fails_with($$select place_wager('00000000-0000-0000-0000-00000000000a','roulette','rl-2',-5,'house','k-1')$$, 'bad_amount'));
select (place_wager('00000000-0000-0000-0000-00000000000a','roulette','rl-1',1000,'house','bet-1')->>'wager_id') as wid \gset
select pg_temp.t('payout above cap refused (35:1 + stake = 36x)', pg_temp.fails_with(format($$select settle_wager(%L, 36001)$$, :'wid'), 'payout_out_of_range'));
select settle_wager(:'wid'::uuid, 36000);
select pg_temp.t('winning payout credited', (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 55000);
select pg_temp.t('settling twice pays once', (settle_wager(:'wid'::uuid, 36000)->>'already')::boolean and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 55000);
select pg_temp.t('refund after settle is refused (no-op)', (refund_wager(:'wid'::uuid)->>'already')::boolean and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 55000);
select (place_wager('00000000-0000-0000-0000-00000000000a','crash','cr-1',500,'house','bet-c1')->>'wager_id') as wc \gset
select refund_wager(:'wc'::uuid);
select pg_temp.t('refund returns stake once', (refund_wager(:'wc'::uuid)->>'already')::boolean and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 55000);
select pg_temp.t('cannot settle a refunded wager', (settle_wager(:'wc'::uuid, 99999)->>'already')::boolean and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 55000);

-- pool (hold'em): payouts cannot exceed what was staked
select (place_wager('00000000-0000-0000-0000-00000000000a','holdem','hd-1',2000,'pool','bi-a')->>'wager_id') as pa \gset
select (place_wager('00000000-0000-0000-0000-00000000000b','holdem','hd-1',3000,'pool','bi-b')->>'wager_id') as pb \gset
select pg_temp.t('pool payouts above total stakes refused', pg_temp.fails_with(format($$select settle_pool('holdem','hd-1', '[{"wager_id":"%s","payout":6000},{"wager_id":"%s","payout":0}]')$$, :'pa', :'pb'), 'payouts_exceed_pool'));
select pg_temp.t('pool must cover every wager', pg_temp.fails_with(format($$select settle_pool('holdem','hd-1', '[{"wager_id":"%s","payout":5000}]')$$, :'pa'), 'payouts_must_cover_round'));
select settle_pool('holdem','hd-1', format('[{"wager_id":"%s","payout":5000},{"wager_id":"%s","payout":0}]', :'pa', :'pb')::jsonb);
select pg_temp.t('pool settled and conserved', (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 58000
  and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000b') = 7000);
select pg_temp.t('pool settle repeat pays nothing', (settle_pool('holdem','hd-1','[]')->>'already')::boolean and (select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a') = 58000);
reset role;

-- ===== concurrency-free invariants over the whole ledger
select pg_temp.t('every ledger balance_after equals the running sum of that user''s amounts', not exists (
  select 1 from (select balance_after, sum(amount) over (partition by user_id order by seq) as run from (select *, row_number() over (order by created_at, id) as seq from transactions) z) q where balance_after <> run)
  and (select count(*) from transactions) > 8);
select pg_temp.t('wallet balance equals sum of ledger for each user', not exists (
  select 1 from wallets w where w.balance <> (select coalesce(sum(amount),0) from transactions t where t.user_id = w.user_id) and w.user_id <> '00000000-0000-0000-0000-00000000000b'));
select pg_temp.t('exactly one welcome bonus per account', (select count(*) from transactions where type='welcome_bonus') = 2);

\unset QUIET
select case when ok then 'PASS' else 'FAIL' end as r, name, case when ok then '' else detail end from results order by ok, name;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
