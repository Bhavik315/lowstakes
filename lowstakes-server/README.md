# Low Stakes game server

A Cloudflare Worker with one Durable Object per table. It runs the same game engines as the website, over WebSocket, and writes the
net result of each finished round into the player's wallet in Supabase. Players only send actions ("bet 25 on red", "cash out");
they can never send a coin amount to credit.

## How coins move
- Sign-in is checked with Supabase on every connection. The username and balance come from the database.
- A player sits at **one table at a time** (`join_table`). The table plays with their wallet balance.
- When a round ends, the server sends its **net result** to `settle_round` once. Retries use the same key, so nothing is paid twice.
- If the server dies mid-round, nothing was written: that round simply did not happen.
- The database refuses results that would take a balance below zero, and caps a single gain at a multiple of the balance.
- Bots have no wallet: they play with free chips, so coins won from bots are new coins.

## Deploy (all free tiers)
1. **Supabase**: SQL Editor, run `lowstakes/supabase/migrations/0002_table_rounds.sql` (after 0001, which you already ran).
2. **Supabase secret key**: Project Settings, API Keys, create or copy the **Secret key** (`sb_secret_...`). Keep it private.
3. **Cloudflare**: Workers & Pages, **Create**, **Import a repository** (Workers, not Pages), choose `Bhavik315/lowstakes`.
   - Project name: `lowstakes-server`
   - Production branch: `claude/epic-gauss-fb52gi`
   - Root directory: `lowstakes-server`
   - Build command: *(leave empty; `wrangler.toml` syncs the engines itself)*
   - Deploy command: `npx wrangler deploy`
4. After the first deploy: the Worker, **Settings, Variables and Secrets**, add a **Secret** named `SUPABASE_SECRET_KEY` with the secret key, then deploy again.
5. Copy the Worker address (`https://lowstakes-server.<you>.workers.dev`), change `https` to `wss`, and put it in `lowstakes/js/config.js` as `serverUrl`.
6. Add your site to `ALLOWED_ORIGINS` in `wrangler.toml` if it is not `https://lowstakes.pages.dev`.

## Tests
- `npm test`: table logic with a fake wallet (15 tests).
- `bash test/sql-integration.sh`: the same logic against the real SQL migrations in a throwaway Postgres (needs postgresql-16, run as root).
- `bash test/e2e.sh`: real WebSockets through `wrangler dev` (the Workers runtime).
- `bash test/browser-e2e.sh`: the website in Chromium against `wrangler dev` (needs Playwright and the site on `localhost:8080`).
