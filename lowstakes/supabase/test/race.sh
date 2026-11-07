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
echo "RACE ALL OK"
