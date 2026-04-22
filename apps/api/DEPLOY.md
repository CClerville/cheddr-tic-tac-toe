# Deploying the API to Vercel

The API is a Hono app served by a single Vercel Serverless Function
(`apps/api/api/index.ts`) using the `hono/vercel` adapter. It depends on
three managed services, all of which can be provisioned through the
Vercel Marketplace:

| Capability      | Provider        | Marketplace integration               |
| --------------- | --------------- | ------------------------------------- |
| Postgres        | **Neon**        | Storage → Neon                        |
| Redis (REST)    | **Upstash**     | Storage → Upstash for Redis           |
| Auth            | **Clerk**       | Authentication → Clerk                |
| Error tracking  | **Sentry**      | Observability → Sentry                |

## 1. Link the project

From the repo root:

```bash
cd apps/api
vercel link             # choose existing project or create one
vercel git connect      # connect to your GitHub repo (optional but recommended)
```

Set the **Root Directory** of the Vercel project to `apps/api` so it
picks up `vercel.json` and the `api/` folder.

The build command is the default (`pnpm install && pnpm build`); Vercel
runs `pnpm install` from the repo root because of the workspace
configuration.

## 2. Wire Marketplace integrations

In the Vercel dashboard, on the project Settings → Integrations:

1. **Neon** → "Connect" → create a new database. Vercel will inject:
   - `DATABASE_URL` (pooled, used at runtime)
   - `DATABASE_URL_UNPOOLED` (direct, used by drizzle-kit migrations)
2. **Upstash for Redis** → "Connect" → create a new database. Vercel
   injects the marketplace aliases:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

   The API reads either these aliases or the canonical
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` names, so no
   extra env-var plumbing is needed.
3. **Clerk** → "Connect" → pick the application. Vercel injects:
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
4. **Sentry** → "Connect" → pick the project. Vercel injects:
   - `SENTRY_DSN`

## 3. Set the remaining env vars

In Vercel → Settings → Environment Variables, add for **all
environments** (Production / Preview / Development):

```
JWT_SECRET=<32+ char random string>   # openssl rand -hex 32
ALLOWED_ORIGINS=https://your-app.com  # comma-separated, no trailing slashes
```

For local dev, copy `.env.example` to `.env` and fill in equivalents.

## 4. Run database migrations

DrizzleKit owns the schema. Two options:

### Option A — Vercel Build hook (simplest)

Add to the Vercel project's **Build Command**:

```
pnpm install --frozen-lockfile && \
  pnpm --filter @cheddr/db drizzle-kit push && \
  pnpm --filter @cheddr/api build
```

This runs `drizzle-kit push` against `DATABASE_URL_UNPOOLED` on every
deployment (preview branches included, since Neon's integration creates
a fresh branch per Vercel preview).

### Option B — GitHub Actions (more control)

Use `.github/workflows/db-migrate.yml`. You'll need two repo secrets:

- `NEON_PRODUCTION_DATABASE_URL`
- `NEON_PREVIEW_DATABASE_URL` (the Neon GitHub integration can mint
  a per-PR branch URL automatically)

## 5. Mobile build

In the mobile app, set:

```
EXPO_PUBLIC_API_URL=https://<your-api>.vercel.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_SENTRY_DSN=https://...
```

If you use EAS Build, expose those via `eas.json` `env` blocks per
profile.

## 6. Smoke test the deploy

```bash
curl https://<your-api>.vercel.app/health
# {"status":"ok","timestamp":"…","requestId":"…"}

curl -X POST https://<your-api>.vercel.app/auth/anon \
  -H 'content-type: application/json' \
  -d '{"deviceId":"smoke-test"}'
# { "token": "...", "userId": "anon_..." }
```

## 7. Recovery: rebuild the leaderboard

If Redis is wiped, hydrate the sorted set from Postgres:

```bash
pnpm --filter @cheddr/api exec tsx src/scripts/rebuildLeaderboard.ts
```
