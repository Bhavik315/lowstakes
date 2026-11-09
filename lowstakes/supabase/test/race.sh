#!/usr/bin/env bash
# Concurrency checks: many simultaneous sessions hitting the same account. Called by run.sh with $P set.
set -uo pipefail
U=00000000-0000-0000-0000-0000000000ff
$P -c "insert into auth.users(id,email,email_confirmed_at) values ('$U','race@x.com',now())" >/dev/null
as_user() { echo "set role authenticated; select set_config('request.jwt.claim.sub','$U',false);"; }

# 1. thirty simultaneous registrations for the same account
for i in $(seq 1 30); do ( { as_user; echo "select complete_registration('Racer_$((i % 3))');"; } | $P >/dev/null 2>&1 ) & done; wait
bonus=$($P -tA -c "select count(*) from transactions where user_id='$U' and type='welcome_bonus'")
bal=$($P -tA -c "select balance from wallets where user_id='$U'")
echo "RACE registration x30: welcome bonuses=$bonus balance=$bal (want 1 / 20000)"
[ "$bonus" = 1 ] && [ "$bal" = 20000 ] || exit 1

# 2. twelve simultaneous username changes with different request ids and names; balance allows only four
for i in $(seq 1 12); do ( { as_user; echo "select change_username('Racer_N$i','race-req-$i');"; } | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$U'")
fees=$($P -tA -c "select count(*) from transactions where user_id='$U' and type='username_change_fee'")
echo "RACE rename x12: fees charged=$fees balance=$bal (want fees=4 balance=0)"
[ "$fees" = 4 ] && [ "$bal" = 0 ] || exit 1

# 3. the same rename request id sent twenty times at once is charged once
$P -c "update wallets set balance = 20000 where user_id='$U'" >/dev/null
for i in $(seq 1 20); do ( { as_user; echo "select change_username('Racer_Same','race-same-req');"; } | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$U'")
echo "RACE same request x20: balance=$bal (want 15000)"
[ "$bal" = 15000 ] || exit 1

# 4. twenty simultaneous wagers of 1,000 from a 15,000 wallet: at most fifteen can succeed, never overdrawn
S="set role service_role;"
for i in $(seq 1 20); do ( echo "$S select place_wager('$U','roulette','race-rl','1000','house','race-w-$i');" | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$U'")
n=$($P -tA -c "select count(*) from wagers where user_id='$U'")
echo "RACE wagers x20: placed=$n balance=$bal (want 15 / 0)"
[ "$n" = 15 ] && [ "$bal" = 0 ] || exit 1

# 5. the same wager settled by thirty simultaneous calls pays once
w=$($P -tA -c "select id from wagers where user_id='$U' limit 1")
for i in $(seq 1 30); do ( echo "$S select settle_wager('$w', 36000);" | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$U'")
echo "RACE settle x30: balance=$bal (want 36000)"
[ "$bal" = 36000 ] || exit 1

# 6. round settlement under load (migration 0002): seat the player, then hammer settle_round
$P -c "select complete_registration" >/dev/null 2>&1 || true
V=00000000-0000-0000-0000-0000000000fe
$P -c "insert into auth.users(id,email,email_confirmed_at) values ('$V','race2@x.com',now())" >/dev/null
echo "set role authenticated; select set_config('request.jwt.claim.sub','$V',false); select complete_registration('Race_Two');" | $P >/dev/null
echo "set role service_role; select join_table('$V','RACE1','crash');" | $P >/dev/null
for i in $(seq 1 30); do ( echo "set role service_role; select settle_round('[{\"user\":\"$V\",\"table\":\"RACE1\",\"game\":\"crash\",\"ref\":\"same\",\"delta\":-1000}]');" | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$V'")
echo "RACE settle same round x30: balance=$bal (want 19000)"
[ "$bal" = 19000 ] || exit 1
for i in $(seq 1 40); do ( echo "set role service_role; select settle_round('[{\"user\":\"$V\",\"table\":\"RACE1\",\"game\":\"crash\",\"ref\":\"r$i\",\"delta\":-1000}]');" | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$V'")
echo "RACE 40 different losing rounds of 1000 from 19000: balance=$bal (want 0, never negative)"
[ "$bal" = 0 ] || exit 1

# 7. free packs under load (migration 0003): thirty simultaneous claims of one pack pay once
W=00000000-0000-0000-0000-0000000000fd
$P -c "insert into auth.users(id,email,email_confirmed_at) values ('$W','race3@x.com',now())" >/dev/null
echo "set role authenticated; select set_config('request.jwt.claim.sub','$W',false); select complete_registration('Race_Three');" | $P >/dev/null
$P -c "update profiles set created_at = now() - interval '10 hours' where id = '$W'" >/dev/null   # (tests only) the wait is over
for i in $(seq 1 30); do ( echo "set role authenticated; select set_config('request.jwt.claim.sub','$W',false); select claim_free_pack('stack');" | $P >/dev/null 2>&1 ) & done; wait
bal=$($P -tA -c "select balance from wallets where user_id='$W'")
n=$($P -tA -c "select count(*) from transactions where user_id='$W' and type='free_pack'")
echo "RACE free pack x30: balance=$bal claims=$n (want 25000 / 1)"
[ "$bal" = 25000 ] && [ "$n" = 1 ] || exit 1
echo "RACE ALL OK"

# 7. Landlords (migration 0004): ten players race to join a six-seat table, the same finish and cancel are fired thirty times,
#    and a finish races a cancel. Nobody is ever charged twice, the table never exceeds six, the pot is paid at most once.
if [ -f "$(dirname "$0")/../migrations/0004_landlords.sql" ]; then
  W() { echo "00000000-0000-0000-0000-0000000e00$1"; }
  for i in 1 2 3 4 5 6 7 8 9 10; do
    id=$(printf '00000000-0000-0000-0000-0000000e%04d' $i)
    $P -c "insert into auth.users(id,email,email_confirmed_at) values ('$id','ll$i@race.com',now())" >/dev/null
    echo "set role authenticated; select set_config('request.jwt.claim.sub','$id',false); select complete_registration('LRace_$i');" | $P >/dev/null
  done
  uid() { printf '00000000-0000-0000-0000-0000000e%04d' "$1"; }
  echo "set role service_role; select landlords_create('$(uid 1)','RACEA',1000);" | $P >/dev/null
  for i in 2 3 4 5 6 7 8 9 10; do ( echo "set role service_role; select landlords_join('$(uid $i)','RACEA');" | $P >/dev/null 2>&1 ) & done; wait
  n=$($P -tA -c "select count(*) from landlord_entries e join landlord_matches m on m.id=e.match_id where m.code='RACEA'")
  charged=$($P -tA -c "select count(*) from transactions where type='landlords_entry' and ref=(select id::text from landlord_matches where code='RACEA')")
  echo "RACE landlords join x10: seated=$n charged=$charged (want 6 / 6)"
  [ "$n" = 6 ] && [ "$charged" = 6 ] || exit 1
  # a double join by the same player, fired many times at once, charges once
  w=$($P -tA -c "select user_id from landlord_entries where match_id=(select id from landlord_matches where code='RACEA') order by joined_at limit 1 offset 2")
  for i in $(seq 1 20); do ( echo "set role service_role; select landlords_join('$w','RACEA');" | $P >/dev/null 2>&1 ) & done; wait
  c2=$($P -tA -c "select count(*) from transactions where user_id='$w' and type='landlords_entry' and ref=(select id::text from landlord_matches where code='RACEA')")
  echo "RACE landlords re-join x20: entry charges for that player=$c2 (want 1)"
  [ "$c2" = 1 ] || exit 1
  echo "set role service_role; select landlords_start('RACEA','$(uid 1)');" | $P >/dev/null
  win=$(uid 1)
  for i in $(seq 1 30); do ( echo "set role service_role; select landlords_finish('RACEA','$win');" | $P >/dev/null 2>&1 ) & done; wait
  prizes=$($P -tA -c "select count(*) from transactions where type='landlords_prize' and ref=(select id::text from landlord_matches where code='RACEA')")
  paid=$($P -tA -c "select coalesce(sum(amount),0) from transactions where type='landlords_prize' and ref=(select id::text from landlord_matches where code='RACEA')")
  echo "RACE landlords finish x30: prize rows=$prizes paid=$paid (want 1 / 6000)"
  [ "$prizes" = 1 ] && [ "$paid" = 6000 ] || exit 1
  # a second match: finish and cancel race each other 20 against 20; exactly one of them takes effect
  echo "set role service_role; select landlords_create('$(uid 1)','RACEB',500);" | $P >/dev/null
  for i in 2 3 4; do echo "set role service_role; select landlords_join('$(uid $i)','RACEB');" | $P >/dev/null; done
  echo "set role service_role; select landlords_start('RACEB','$(uid 1)');" | $P >/dev/null
  for i in $(seq 1 20); do
    ( echo "set role service_role; select landlords_finish('RACEB','$(uid 2)');" | $P >/dev/null 2>&1 ) &
    ( echo "set role service_role; select landlords_cancel('RACEB','race');" | $P >/dev/null 2>&1 ) &
  done; wait
  st=$($P -tA -c "select status from landlord_matches where code='RACEB'")
  pr=$($P -tA -c "select count(*) from transactions where type='landlords_prize' and ref=(select id::text from landlord_matches where code='RACEB')")
  rf=$($P -tA -c "select count(*) from transactions where type='landlords_refund' and ref=(select id::text from landlord_matches where code='RACEB')")
  echo "RACE landlords finish-vs-cancel: status=$st prize rows=$pr refund rows=$rf (want one of finished/1/0 or cancelled/0/4)"
  { [ "$st" = finished ] && [ "$pr" = 1 ] && [ "$rf" = 0 ]; } || { [ "$st" = cancelled ] && [ "$pr" = 0 ] && [ "$rf" = 4 ]; } || exit 1
  ok=$($P -tA -c "select count(*) from wallets w where w.user_id::text like '00000000-0000-0000-0000-0000000e%' and w.balance <> 20000 + (select coalesce(sum(amount),0) from transactions t where t.user_id = w.user_id and t.type <> 'welcome_bonus')")
  echo "RACE landlords books: wallets not matching their ledger=$ok (want 0)"
  [ "$ok" = 0 ] || exit 1
fi
