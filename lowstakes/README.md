# Low Stakes

Poker, blackjack, roulette, crash and a property-trading board game (Landlords) with your friends, in the browser. Play money only.

Start a table, send the link, deal. Everyone gets 1,000 chips that are worth exactly nothing.

**Play it:** https://lowstakes.pages.dev

## Accounts (in progress)

Sign-in is Google only: no passwords, no email sign-up. It runs on Supabase (project URL and *publishable* key in `js/config.js`; never put a secret key there).
A new player signs in with Google, chooses a username (free), and receives a one-time 20,000 coin welcome bonus. The profile shows the wallet balance, recent transactions,
and username change (5,000 coins, with confirmation). The rules are enforced in the database: `supabase/migrations/0001_accounts_wallet.sql`.
Supabase setup is in `supabase/README.md` (switch the Email provider off, switch Google on, publish the Google consent screen before opening to the public).
`requireLogin` is `true`: nobody can open or join a table without signing in with Google and picking a username. Everyone plays at server tables with their wallet coins. (The old peer-to-peer browser tables still exist in the code, but nothing in the site opens one.)
Turning it on, and moving the games onto a server so payouts can be trusted, is the next stage. Account deletion is not built yet (it is a manual step in Supabase).

The game server (`lowstakes-server/`) runs tables for signed-in players and settles each round into the wallet; see its README. Until `serverUrl` is set in `js/config.js`, tables run in the browser as before.

Free coins: four packs (1,000 / 5,000 / 15,000 / 40,000 every 4 / 6 / 24 / 72 hours) can be claimed by anyone with an account. The database clock decides when a pack is ready, and each claim is a ledger row.
The amounts and timers live in `free_pack_defs()` in `supabase/migrations/0003_free_packs.sql`. At a wallet table the "out of coins" message offers them.

Tests: `supabase/test/run.sh` (SQL rules and races on a local Postgres) and `test/browser/accounts.cjs` (screens against a stand-in backend).

## Ads

There are no banner or display ads, ever. The only ad is an optional rewarded video on the out-of-chips screen ("Watch an ad to refill").
No ad network is connected yet, so that button still gives the free rebuy. When a network approves the site, register its adapter
with `window.LowStakesAds.register({ name, show })` (see `js/ads.js`). Ads are requested non-personalised, with a one-time notice first.
A self-declared 18+ gate, `privacy.html` and `terms.html` are in place. When accounts arrive, the refill must be granted by the server after the network confirms the view.

## Hosting

The site is static files, hosted free on Cloudflare Pages and redeployed on every push to `claude/epic-gauss-fb52gi`.
Cloudflare Pages settings: production branch `claude/epic-gauss-fb52gi`, framework preset None, build command empty, build output directory `lowstakes`.

## What's in it

- **Poker (Texas Hold'em)**: no-limit, 2–9 players, proper side pots, all-in run-outs with cards turned face up, turn timer, "show your cards" after an uncontested win, sit-out toggle.
- **Blackjack**: up to 7 players against the dealer, 6-deck shoe, dealer stands on all 17s, blackjack pays 3 to 2, **insurance** when the dealer shows an ace (half your bet, pays 2 to 1), dealer peeks for blackjack, splits (up to four hands) and doubles. A **coach** toggle highlights the basic-strategy move.
- **Roulette**: up to 12 players (a roster strip lists everyone's balance, bet and result), single zero, everyone bets on one shared layout (your chips show your amount, other players show as coloured dots), animated wheel, recent-numbers strip.
- **Crash**: up to 12 players. Bet, watch the multiplier climb, cash out before it crashes (or set an auto cash-out). The crash point is decided at launch from the browser's secure random generator with a 1% house edge, so cashing out at any target returns 99% on average. Other players can't see your auto target.
- **Landlords** (original property-trading board game, 4 to 6 players, private tables only: invite link or code, no spectators, `#/m/CODE`). The host picks an **entry fee** (free, 100 ... 10,000 coins) and the rules (double rent on full sets, vacation cash, auction, no rent in Lockup, mortgages, even building, starting cash, Start bonus, income tax, house/hotel supply, Lockup fine and turns, random order). The fee is shown before joining and is taken from the wallet only when the server accepts the seat. Fees are held in escrow per match (`landlord_matches`, `landlord_entries`, migration `0004_landlords.sql`); the winner is paid the whole pot exactly once (ledger key `landlords:prize:<match>`), a cancelled or never-started table refunds everyone, leaving a running game forfeits your fee into the pot. **In-game cash is a separate currency kept only in the game server's memory** and is never converted to coins. The whole game runs in the Worker (`lowstakes-server/src/landlords-core.js` + the shared engine `js/games/landlords.js`): dice, rent, auctions, trades (per-pair offers, both sides must agree, a counter-offer cancels earlier acceptance, executed atomically), bankruptcy and the 5-minute turn clock are all decided by the server. A disconnected player keeps their seat and state for 5 minutes (server timestamps); their turns are played automatically (roll, decline purchases, end turn) and after 5 minutes away they are out and lose the fee; the last player standing wins.
- Table limits are per game (Hold'em 9, Blackjack 7, Roulette 12, Crash 12; joining or adding a bot to a full table is refused with a message), **bots** to fill seats, chat and quick reactions, a scoreboard that counts buy-ins so you can see who's really ahead, free rebuys, sounds synthesised in the browser (no audio files), keyboard shortcuts (F/C/R in hold'em, H/S/D/P in blackjack, Enter to deal or spin).
- Works on phones in portrait and landscape: a compact header (everything else is in a ⋯ menu), 44px touch targets, tables sized from the space actually available, and a side-by-side wheel and board for roulette.

## Motion

The game engine decides everything first (every card is drawn, every payout computed) and the interface only *presents* it. Pacing delays in the engines (a split pauses before dealing, the dealer leans in before turning the hole card) never change what was dealt.

- Blackjack and hold'em deal from the shoe or dealer with an arc and a gentle tilt; a split lifts a card across to its own hand; stakes fly onto the felt; winners are paid from the dealer's side and losing stakes are swept back.
- Roulette's enlarged wheel is a true circle drawn in three layers so the rotor spins on the compositor. The ball is the wheel's angle plus an angle relative to it that decays to the pocket the game chose, so wheel and ball slow together.
- Only `transform` and `opacity` are animated. Nothing in the spin uses blur or filters.
- Honours `prefers-reduced-motion` (live, if you change it mid-session).

The card movement lives in `js/ui/motion.js`.

## How it works

There's no game server. The person who starts a table is the **host**: their browser runs the game engine and sends each guest a personal view of the table over WebRTC (via [PeerJS](https://peerjs.com/)). Guests never receive anyone else's hidden cards.

- If a guest reloads, they slide straight back into their seat.
- If the host reloads, the table is restored from local storage with everyone's chips, and guests reconnect on their own. A hand that was in progress is refunded.
- The host's tab has to stay open. Closing it closes the table.

The public PeerJS server is used only to introduce browsers to each other; game traffic goes directly between players (or through PeerJS's TURN relay when a direct connection isn't possible).

## Run it

It's a static site. Serve the folder and open it:

```sh
python3 -m http.server 8000
# visit http://localhost:8000/lowstakes/
```

Opening `index.html` straight from disk won't work because the code uses ES modules.

To develop without the public matchmaking server, run your own PeerJS server and point the page at it with `?signal=host:port`:

```sh
npx peerjs --port 9000 --path /
# visit http://localhost:8000/lowstakes/?signal=127.0.0.1:9000
```

## Tests

The game engines are plain modules with no DOM, so they're tested directly in Node:

```sh
npm test
```

## Layout

```
index.html            page shell and suit symbols
css/main.css          all styles
js/app.js             routing, rendering, effects, input
js/net/room.js        host and guest (rooms, players, chat, reconnects)
js/games/*.js         hold'em, blackjack, roulette and crash engines (host side)
js/core/*.js          cards, hand evaluator, blackjack rules
js/bots/holdem-bot.js Monte Carlo hold'em bot
js/ui/*.js            markup for each screen
js/ui/motion.js       card flight, split and dealer-reveal animation (presentation only)
vendor/               PeerJS and morphdom (MIT)
test/                 engine tests
```

## Parked games

Baccarat and craps were built and tested but are not wired into the app right now. Their engines (`js/games/baccarat.js`, `js/games/craps.js`), screens (`js/ui/baccarat-ui.js`, `js/ui/craps-ui.js`), styles and tests are still in the repo; restoring them means re-registering them in `js/net/room.js`, `js/app.js` and the lobby.

## Ads

`js/adslots.js` and the `ads` block in `js/config.js` hold three empty banner slots (`rail`, `landing`, `lobby`). A slot stays hidden until you paste an ad network's banner snippet into its `html` and the visitor has pressed "Allow ads" on the one-time notice. Ad code runs in a sandboxed iframe. The `rail` slot sits at the bottom of the table chat panel and is not shown on screens narrower than 1180px.
