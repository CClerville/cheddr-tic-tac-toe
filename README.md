# Cheddr Tic-Tac-Toe

Misère tic-tac-toe against an AI, with **ranked** (server-backed ELO), **casual** play, **leaderboards**, and **anonymous → Clerk** account upgrade. Monorepo: **Expo** mobile app, **Hono** API, **Drizzle** + Postgres (Neon), **Upstash Redis** for sessions, **Clerk** auth.

## Tech stack

| Layer | Stack |
|-------|--------|
| Mobile | Expo 54, React Native, Expo Router, TanStack Query, Clerk, Skia (board), Reanimated |
| API | Hono, Drizzle ORM, Neon (HTTP driver), Upstash Redis, Zod (`@cheddr/api-types`) |
| Domain | `@cheddr/game-engine` — pure rules + negamax AI + property tests (`fast-check`) |
| CI/CD | Turborepo, GitHub Actions (migrations → deploy order), Vercel (API), EAS (mobile) |

## Repo layout

```
apps/
  api/          # Hono server
  mobile/       # Expo app
packages/
  api-types/    # Zod schemas + inferred TS types (API contract)
  db/           # Drizzle schema + migrations + ELO helpers
  game-engine/  # Board, rules, AI (no I/O)
  config-eslint/
  config-ts/
```

## Prerequisites

- **Node 20+**
- **pnpm** 10 (`packageManager` in root `package.json`)
- **Neon** (or any Postgres) + **Upstash Redis** + **Clerk** for full-stack local dev

## Quickstart

```bash
pnpm install
pnpm dev          # API + mobile (Turbo TUI)
# or separately:
pnpm dev:api
pnpm dev:mobile
```

API defaults to port **3005** (see `apps/api`). Point the mobile app at your API base URL (env / dev client).

### Full tunnel (device hitting laptop API)

```bash
pnpm dev:full-tunnel
```

See [`scripts/dev-full-tunnel.sh`](scripts/dev-full-tunnel.sh) for Cloudflare + Expo wiring.

## Environment variables

**API** (`apps/api/.env.local` — never commit secrets):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (pooled OK for queries; migrations often need unpooled — see [`docs/ci.md`](docs/ci.md)) |
| `REDIS_URL` / Upstash KV vars | Session + rate limits |
| `JWT_SECRET` | Anonymous JWT signing |
| `CLERK_SECRET_KEY` | Clerk-issued tokens + user sync |

**Mobile**: Clerk publishable key, API base URL, Sentry DSN (optional) — see `apps/mobile` env docs in `app.config.ts` / EAS.

Full CI secrets and deploy order: **[`docs/ci.md`](docs/ci.md)**.

## Scripts (root)

| Script | Description |
|--------|-------------|
| `pnpm build` | Turbo build |
| `pnpm dev` | API + mobile dev |
| `pnpm lint` | ESLint + package lint tasks via Turbo |
| `pnpm test` | Turbo test |

## Documentation

- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — system diagram, move lifecycle, auth, persistence tradeoffs
- **[`docs/ci.md`](docs/ci.md)** — GitHub Actions, Neon, Vercel, EAS
- **[`docs/mobile-preview-builds.md`](docs/mobile-preview-builds.md)** — internal preview installs
- **[`AGENTS.md`](AGENTS.md)** — Cursor / agent conventions

## License

Private / take-home assignment — not for App Store submission unless you choose to ship it.
