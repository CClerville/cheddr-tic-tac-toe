# Cheddr Tic-Tac-Toe

Misère tic-tac-toe against an AI, with **ranked** (server-backed ELO), **casual** play, **leaderboards**, and **anonymous → Clerk** account upgrade. Includes streaming **AI commentary**, **hints**, and post-game **analysis** via the **Vercel AI Gateway**. Monorepo: **Expo** mobile app, **Hono** API, **Drizzle** + Postgres (Neon), **Upstash Redis** for sessions, **Clerk** auth.

## Tech stack

| Layer | Stack |
|-------|--------|
| Mobile | Expo 54, React Native, Expo Router, TanStack Query, Clerk, Skia (board), Reanimated, i18n (`expo-localization`), Sentry |
| API | Hono, Drizzle ORM, Neon (HTTP driver), Upstash Redis, Zod (`@cheddr/api-types`), Vercel AI Gateway (`@ai-sdk/gateway`) |
| AI | Streaming commentary (`move` / `terminal` triggers), hints, analysis — per-user + global daily token budgets and per-route rate limits (Redis); ranked post-game commentary waits on server terminal confirmation + Redis snapshot |
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

## Run the app (macOS)

1. Install **[Expo Go](https://expo.dev/go)** on your phone (iOS App Store or Google Play).
2. Clone this repo, `cd` into it, and run:

   ```bash
   ./start.sh
   ```

   (Requires execute permission: `chmod +x start.sh` if needed.) After the first successful run you can also use `pnpm start` if `pnpm` is already on your PATH.

   The script installs **Homebrew** (if needed), **Node 20+**, **pnpm**, and **cloudflared**, writes `apps/api/.env.local` and `apps/mobile/.env.local` on first run only, runs `pnpm install`, then starts the API and Metro with **Cloudflare quick tunnels** so your device does not need to be on the same LAN.

3. When the script prints an **Expo Go deep link** (`exp+https://...`), open it on your device (e.g. paste into Safari on iOS, or tap the link from your terminal on Android). Ignore the QR that Expo CLI prints later — it is broken for HTTPS tunnels; the correct link is the one from this script (see [`scripts/dev-full-tunnel.sh`](scripts/dev-full-tunnel.sh)).

Stop everything with **Ctrl-C**.

## Scripts (root)

| Script | Description |
|--------|-------------|
| `./start.sh` / `pnpm start` | Full setup + install + tunnel dev (recommended) |
| `pnpm build` | Turbo build |
| `pnpm dev` | API + mobile dev (Turbo TUI) |
| `pnpm dev:api` / `pnpm dev:mobile` | Run API or mobile only |
| `pnpm dev:full-tunnel` | Tunnel flow only (assumes deps and env already set) |
| `pnpm lint` | ESLint + package lint tasks via Turbo |
| `pnpm test` | Turbo test |

## Advanced (manual setup)

If you prefer not to use `start.sh`:

- **Prerequisites:** Node 20+, pnpm 10 (`packageManager` in root `package.json`), Postgres (Neon) + Upstash Redis + Clerk credentials in `apps/api/.env.local`, and mobile `EXPO_PUBLIC_*` vars in `apps/mobile/.env.local`.
- **Install:** `pnpm install`
- **Dev:** `pnpm dev` (API defaults to port **3005**). For a physical device without LAN, use `pnpm dev:full-tunnel` after installing `cloudflared` (`brew install cloudflared`).

Environment variable reference and CI secrets: **[`docs/ci.md`](docs/ci.md)**.

## Documentation

- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — system diagram, move lifecycle, auth, AI, persistence tradeoffs
- **[`docs/ci.md`](docs/ci.md)** — GitHub Actions, Neon, Vercel, EAS, AI env and `eval:commentary`
- **[`docs/mobile-preview-builds.md`](docs/mobile-preview-builds.md)** — internal preview installs
- **[`AGENTS.md`](AGENTS.md)** — Cursor / agent conventions

## License

Private / take-home assignment — not for App Store submission unless you choose to ship it.
