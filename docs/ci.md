# CI/CD (GitHub Actions)

This repo uses GitHub Actions for **versioned database migrations**, **Vercel production deploys** (API), and **Expo EAS Update / EAS Build** (mobile).

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`ci.yml`](../.github/workflows/ci.yml) | PR + push `main` | Lint, typecheck, test (Turbo; mobile `tsc` separately). |
| [`db-migrate.yml`](../.github/workflows/db-migrate.yml) | PR | `drizzle-kit check` on every PR; on `packages/db` changes, create Neon branch `preview/pr-<n>`, run `drizzle-kit migrate`, comment on PR. |
| [`db-cleanup.yml`](../.github/workflows/db-cleanup.yml) | PR closed | Delete Neon branch `preview/pr-<n>` (`continue-on-error` if it never existed). |
| [`mobile.yml`](../.github/workflows/mobile.yml) | PR (mobile paths) | EAS Update to branch `pr-<n>` + PR comment (Expo preview action). |
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

## Branch protection (recommended)

On `main`, require status checks:

- `lint • typecheck • test` (CI)
- `drizzle-kit check` (DB migrations PR workflow)
- `Deploy (production)` jobs as appropriate once stable

## Drizzle (local)

From repo root, with API env file present:

```bash
pnpm --filter @cheddr/db db:generate   # after schema edits
pnpm --filter @cheddr/db db:migrate    # local migrate
```

CI uses `pnpm --filter @cheddr/db db:migrate:ci` with `DATABASE_URL` from the workflow environment.
