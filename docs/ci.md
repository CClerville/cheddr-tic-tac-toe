# CI/CD (GitHub Actions)

This repo uses GitHub Actions for **versioned database migrations**, **Vercel production deploys** (API), and **Expo EAS Update / EAS Build** (mobile).

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`ci.yml`](../.github/workflows/ci.yml) | PR + push `main` | ESLint (`turbo run lint`), typecheck (`turbo run typecheck`), build, test; mobile `tsc` separately. |
| [`db-migrate.yml`](../.github/workflows/db-migrate.yml) | PR | `drizzle-kit check` on every PR; on `packages/db` changes, create Neon branch `preview/pr-<n>`, run `drizzle-kit migrate`, comment on PR. |
| [`db-cleanup.yml`](../.github/workflows/db-cleanup.yml) | PR closed | Delete Neon branch `preview/pr-<n>` (`continue-on-error` if it never existed). |
| [`mobile.yml`](../.github/workflows/mobile.yml) | PR (mobile paths) | Build workspace packages without secrets; optional **EAS Update** publish job (requires `EXPO_TOKEN` + GitHub Environment). |
| [`deploy.yml`](../.github/workflows/deploy.yml) | Push `main` | Prod migrate (if DB changed) → Vercel `--prod` (if API/DB paths) → EAS Update `production` + EAS Build `preview` (if mobile paths). |

Production API deploys from Git are **disabled for `main`** in [`apps/api/vercel.json`](../apps/api/vercel.json) so `deploy.yml` always runs migrations before `vercel deploy`.

## GitHub Actions secrets

| Name | Used by | Notes |
|------|---------|--------|
| `NEON_API_KEY` | `db-migrate`, `db-cleanup` | Neon console → API keys. |
| `NEON_PRODUCTION_DATABASE_URL_UNPOOLED` | `deploy` migrate | **Direct** (non-pooler) Postgres URL for DDL; pooler breaks migrations. |
| `VERCEL_TOKEN` | `deploy` | Vercel account token. |
| `VERCEL_ORG_ID` | `deploy` | From `.vercel/project.json` after `vercel link`, or Vercel project settings. |
| `VERCEL_PROJECT_ID` | `deploy` | Same as above. |
| `EXPO_TOKEN` | `mobile`, `deploy` | expo.dev → Access tokens. |

## GitHub repository variables

| Name | Used by | Notes |
|------|---------|--------|
| `NEON_PROJECT_ID` | `db-migrate`, `db-cleanup` | Neon project ID (Settings in Neon console). |
| `EXPO_PROJECT_ID` | `mobile`, `deploy` | Expo / EAS project UUID (not a secret). Passed as env `EAS_PROJECT_ID` in CI so [`app.config.ts`](../apps/mobile/app.config.ts) can set `updates.url` and `extra.eas.projectId`. |

## Local: EAS project setup (once)

```bash
cd apps/mobile
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

Commit any `app.json` / config changes EAS suggests, then copy the **project ID** into the GitHub variable `EXPO_PROJECT_ID`.

## Mobile: internal preview installs (testers)

Step-by-step for **EAS internal distribution** (APK + ad-hoc iOS), device registration, install URLs, and OTA updates on the `preview` channel: [mobile-preview-builds.md](mobile-preview-builds.md).

## Branch protection (recommended)

On `main`, require status checks:

- `ESLint, build, test, mobile typecheck` (CI job name in `ci.yml`)
- `drizzle-kit check` (DB migrations PR workflow)
- `Deploy (production)` jobs as appropriate once stable

## Drizzle (local)

From repo root, with API env file present:

```bash
pnpm --filter @cheddr/db db:generate   # after schema edits
pnpm --filter @cheddr/db db:migrate    # local migrate
```

CI uses `pnpm --filter @cheddr/db db:migrate:ci` with `DATABASE_URL` from the workflow environment.

## API: ops scripts (local / prod)

With `DATABASE_URL` set (e.g. `apps/api/.env.local`):

```bash
# Rebuild Redis leaderboard from Postgres `users.elo` (Clerk users only)
pnpm --filter @cheddr/api exec tsx src/scripts/rebuildLeaderboard.ts

# Recompute ranked aggregate counters on `users` from `games` (does not change ELO)
pnpm --filter @cheddr/api reconcile:stats
# Log drift only; exit 1 if any mismatch (useful for cron alerts)
pnpm --filter @cheddr/api reconcile:stats -- --dry-run
```

### AI: commentary spatial eval (manual, costs tokens)

Not run in CI. Before changing `AI_MODEL_COMMENTARY` or commentary prompts, run against the Vercel AI Gateway with `AI_GATEWAY_API_KEY` set (e.g. in `apps/api/.env.local`). Exits with code `1` if the pass rate falls below 90%.

```bash
pnpm --filter @cheddr/api eval:commentary
```

Fixtures live at [`apps/api/src/__tests__/fixtures/commentary-eval.json`](../apps/api/src/__tests__/fixtures/commentary-eval.json).

## Mobile PR workflow (`mobile.yml`)

- **`build` job** — Installs dependencies and builds `packages/*` only. Does **not** use `EXPO_TOKEN`, so fork PRs and secret-less forks still get a green compile check.
- **`publish` job** — Runs only for PRs from the same repository (`head.repo == github.repository`). Uses GitHub Environment **`eas-ota-preview`** so you can require manual approval before any job sees `EXPO_TOKEN`. Create that environment under **Settings → Environments** (optional protection rules / reviewers). If the environment does not exist yet, GitHub creates it on first run with no reviewers.

## EAS Update code signing (recommended)

Unsigned OTA updates mean anyone with `EXPO_TOKEN` could ship arbitrary JS to devices. Enable [EAS Update code signing](https://docs.expo.dev/eas-update/code-signing/): generate a key pair in EAS, add the public certificate to the native project, and configure `updates.codeSigningCertificate` / `updates.codeSigningMetadata` in `app.config.ts` once certificates exist locally (paths are usually gitignored). After that, wire `eas update` in CI as documented by Expo.

## API environment (production)

| Variable | Notes |
|----------|--------|
| `ALLOWED_ORIGINS` | Comma-separated browser origins for CORS (empty = deny browser reflection; native apps are unaffected). |
| `CLERK_AUTHORIZED_PARTIES` | Comma-separated `azp` allowlist for Clerk `verifyToken` (e.g. `cheddr://`, production web origins). |
| `AI_GLOBAL_DAILY_TOKEN_BUDGET` | Optional aggregate AI token ceiling per UTC day across all users (default `20000000`). |
