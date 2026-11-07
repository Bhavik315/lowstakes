# Low Stakes accounts and wallet: free setup

Everything below uses free tiers. Free-tier limits change, so check each provider's pricing page before relying on them.

## 1. Create the Supabase project (free)
1. Sign up at supabase.com and choose **New project** (Free plan). Pick a region near your friends and set a database password. Keep it in a password manager; never commit it.
2. Free projects pause after about a week with no activity. If that happens, press **Restore** in the dashboard; your data is kept.

## 2. Apply the database
Open **SQL Editor**, paste `supabase/migrations/0001_accounts_wallet.sql`, and run it. It only creates new objects.
Optional local check: `supabase/test/run.sh` runs 52 assertions plus concurrency races on a throwaway Postgres.

## 3. Authentication settings
**Authentication → Providers → Email**: enable it, and keep **Confirm email** ON (the welcome bonus requires a verified address).
**Authentication → URL Configuration**: set **Site URL** to your GitHub Pages address, and add the same address (and `http://localhost:8080`) under **Redirect URLs**. Password-reset and verification links only work for listed URLs.
Leave automatic identity linking on: Supabase links Google to an email account only when the email is verified. The database also refuses a second profile for the same email.

## 4. Google sign-in (free)
1. console.cloud.google.com → create a project → **APIs & Services → OAuth consent screen** (External, add your email) → **Credentials → Create credentials → OAuth client ID → Web application**.
2. Add this under **Authorized redirect URIs**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy the client ID and secret into Supabase → **Authentication → Providers → Google**.

## 5. Keys
**Project Settings → API**: the **Project URL** and the **anon public** key are safe for the website. The **service_role** key is a secret: it goes only into the game server's environment, never into the repo, the website or a chat.

## 6. Email
Supabase's built-in sender is rate-limited and meant for testing. It is fine for a few friends. For more, add a free SMTP provider under **Authentication → SMTP Settings**.
