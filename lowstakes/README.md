# Low Stakes

Hold'em, blackjack and roulette with your friends, in the browser. Play money only.

Start a table, send the link, deal. Everyone gets 1,000 chips that are worth exactly nothing.

## What's in it

- **Texas Hold'em**: no-limit, 2–9 players, proper side pots, all-in run-outs with cards turned face up, turn timer, "show your cards" after an uncontested win, sit-out toggle.
- **Blackjack**: up to 7 players against the dealer, 6-deck shoe, dealer stands on all 17s, blackjack pays 3 to 2, dealer peeks for blackjack, splits (up to four hands) and doubles. A **coach** toggle highlights the basic-strategy move.
- **Roulette**: single zero, everyone bets on one shared layout (your chips show your amount, other players show as coloured dots), animated wheel, recent-numbers strip.
- Up to 12 people per table, **bots** to fill seats, chat and quick reactions, a scoreboard that counts buy-ins so you can see who's really ahead, free rebuys, sounds synthesised in the browser (no audio files), keyboard shortcuts (F/C/R in hold'em, H/S/D/P in blackjack, Enter to deal or spin).
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
js/games/*.js         hold'em, blackjack and roulette engines (host side)
js/core/*.js          cards, hand evaluator, blackjack rules
js/bots/holdem-bot.js Monte Carlo hold'em bot
js/ui/*.js            markup for each screen
js/ui/motion.js       card flight, split and dealer-reveal animation (presentation only)
vendor/               PeerJS and morphdom (MIT)
test/                 engine tests
```

## Parked games

Baccarat and craps were built and tested but are not wired into the app right now. Their engines (`js/games/baccarat.js`, `js/games/craps.js`), screens (`js/ui/baccarat-ui.js`, `js/ui/craps-ui.js`), styles and tests are still in the repo; restoring them means re-registering them in `js/net/room.js`, `js/app.js` and the lobby.
