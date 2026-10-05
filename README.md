# SnackStack

A web app for tracking groceries, built to feel like a native phone app:

- **Shopping list**: quick-add that understands "2 kg rice", bulk add ("milk, eggs, bread"), voice input, notes, grouping by aisle, sharing, and suggestions for items running low or bought before.
- **Check out**: tap items into your cart at the store, then log prices and expiry dates in one step. Everything moves into your pantry.
- **Pantry**: expiry tracking, low-stock levels ("keep at least 2"), fridge/freezer/cupboard locations, search and filters, and price history.
- **Spending**: receipt scanning (snap a photo; the items, tax and total are read on your phone), monthly totals, a 6-month chart, a budget with a month-end projection, breakdown by store or aisle, top items, and food-waste tracking.
- **Extras**: your choice of currency, CSV export, keyboard shortcuts, light and dark themes, undo on deletes, and installing it to your home screen.

Built with React + Vite, [Supabase](https://supabase.com) (database and login), and [Cloudflare Workers](https://workers.cloudflare.com) (hosting). All three have free tiers that are enough for personal use.

## Run your own copy

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, then **New query**. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. Then do the same for each file in [`supabase/migrations/`](supabase/migrations/), in order. This creates the tables and the security rules that keep each user's data private.
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

### 3. Deploy to Cloudflare

The app is served as a static site from a Cloudflare Worker, configured in [`wrangler.jsonc`](wrangler.jsonc).

1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages**, then **Create**, then **Import a repository**, and pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
4. Under **Build variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` with the same values as in your `.env`.
5. Deploy. Every push to `main` redeploys automatically.

### 4. Point Supabase at your live site

In Supabase, go to **Authentication**, then **URL Configuration**:

- Set **Site URL** to your Cloudflare URL (for example `https://snackstack.your-subdomain.workers.dev`).
- Add the same URL, plus `http://localhost:5173`, to **Redirect URLs**.

Without this step, confirmation emails link to the wrong place.

## Notes

- The Supabase key used in the browser is meant to be public. Your data is protected by the Row Level Security policies in `schema.sql`: each user can only read and change their own rows.
- Free Supabase projects pause after about a week with no activity. If that happens, click **Restore** in the Supabase dashboard.

## License

MIT
