# Backend Scripts

## regenerate-share-tokens.sql

Regenerates `share_token` for jobs that are missing one or older than 30 days, so report links work.

**How to run (Supabase):**

1. Open [Supabase Dashboard](https://app.supabase.com) → your project.
2. Go to **SQL Editor** → **New query**.
3. Paste the contents of `regenerate-share-tokens.sql`.
4. Click **Run**.

**What it does:**

- Enables the `uuid-ossp` extension (for `uuid_generate_v4()`).
- Updates `jobs` where `share_token IS NULL` or `created_at < NOW() - INTERVAL '30 days'` with a new UUID.

After running, copy the new report link from Edit Job Modal or from the `jobs.share_token` column and open `/report/<share_token>` to verify.
