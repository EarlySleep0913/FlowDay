# FlowDay

FlowDay is a personal TODO, focus timer, habit, mood, and statistics app.

## Cloudflare Pages + D1

This repository contains:

- `src/`: React frontend.
- `functions/`: Cloudflare Pages Functions API.
- `migrations/`: Cloudflare D1 database schema and seed data.

The default administrator is seeded by `migrations/0001_initial.sql`.

## Deploy

1. Install dependencies locally:

   ```bash
   npm install
   ```

2. Create a D1 database:

   ```bash
   npx wrangler login
   npx wrangler d1 create flowday-db
   ```

3. Apply the migration:

   ```bash
   npx wrangler d1 migrations apply flowday-db --remote
   ```

4. In Cloudflare Dashboard, open your Pages project:

   ```txt
   Workers & Pages -> flowday-cvz -> Settings -> Functions -> D1 database bindings
   ```

5. Add a D1 binding:

   ```txt
   Variable name: DB
   D1 database: flowday-db
   ```

6. Redeploy Pages:

   ```txt
   Deployments -> Retry deployment
   ```

   Or push a new commit to GitHub.

7. Log in from the `账号` tab.

## Build Settings

Use these Cloudflare Pages build settings:

```txt
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
```

## Notes

- Local data is still cached in `localStorage` for quick loading.
- After login, data is synced to D1 through `/api/sync`.
- Admin users can create, update, disable, and reset passwords for other users.
- Change the initial administrator password after the first successful login.
