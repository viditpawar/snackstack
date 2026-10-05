# SnackStack

A small web app for tracking groceries:

- **Shopping list**: add items, then mark them bought. Marking an item bought can record the price and move it into your pantry.
- **Pantry**: what you have at home, with quantities, categories and expiry dates. Items expiring soon are highlighted.
- **Spending**: what you paid, with a monthly total and a per-store breakdown.

Built with React + Vite, [Supabase](https://supabase.com) (database and login), and [Cloudflare Pages](https://pages.cloudflare.com) (hosting). All three have free tiers that are enough for personal use.

## Run your own copy

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, then **New query**. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables and the security rules that keep each user's data private.
3. Open **Project Settings**, then **API**, and copy:
   - the **Project URL**
   - the **publishable** key (labelled **anon** on older projects)

   Never use the **secret** / **service_role** key in this app. It bypasses all security rules.

### 2. Run it locally

You need [Node.js](https://nodejs.org) 20.19 or newer.

```sh
npm install
cp .env.example .env   # then paste your URL and key into .env
npm run dev
```

Open the URL it prints (usually http://localhost:5173) and create an account. Supabase sends a confirmation email by default. To skip it while testing, turn off **Confirm email** under **Authentication**, then **Sign In / Providers**, then **Email**.

### 3. Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages**, then **Create**, then **Pages**, then **Connect to Git**, and pick the repo.
3. Build settings:
   - Framework preset: **Vite** (or **None**)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Under **Environment variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` with the same values as in your `.env`.
5. Deploy. Every push to `main` redeploys automatically.

### 4. Point Supabase at your live site

In Supabase, go to **Authentication**, then **URL Configuration**:

- Set **Site URL** to your Cloudflare URL (for example `https://snackstack.pages.dev`).
- Add the same URL, plus `http://localhost:5173`, to **Redirect URLs**.

Without this step, confirmation emails link to the wrong place.

## Notes

- The Supabase key used in the browser is meant to be public. Your data is protected by the Row Level Security policies in `schema.sql`: each user can only read and change their own rows.
- Free Supabase projects pause after about a week with no activity. If that happens, click **Restore** in the Supabase dashboard.

## License

MIT
