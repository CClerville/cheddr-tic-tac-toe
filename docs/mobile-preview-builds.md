# Mobile: EAS internal preview builds (Android + iOS)

Testers install **real binaries** (not Expo Go). Config lives in [`apps/mobile/eas.json`](../apps/mobile/eas.json) under the `preview` profile: internal distribution, Android APK, iOS device builds, update channel `preview`.

## Prerequisites

- Expo account logged in: `pnpm dlx eas-cli@latest login` (from repo root or `apps/mobile`).
- **Apple Developer Program** ($/year) for iOS — linked the first time you run an interactive iOS build (Apple ID + 2FA).
- **Android**: no per-tester setup; APK installs on any device (user may enable “Install unknown apps” once).

## If `eas device:list` says “Couldn't find any teams”

Your Expo account has not yet linked an Apple Developer team for this project. Fix by running **one interactive iOS build** (below). After Apple credentials exist on EAS, `eas device:create` / `eas device:list` work.

## 1. Register iOS testers (one-time per device)

Internal iOS builds use **ad-hoc** provisioning (device UDIDs must be registered before the build that includes them).

```bash
cd apps/mobile
pnpm eas:device:create
```

Share the URL/QR with each tester. They open it on the iPhone (Safari), install the profile, then **Settings → General → VPN & Device Management** (or **Profile Downloaded**) to finish.

Verify:

```bash
cd apps/mobile
pnpm eas:devices
```

## 2. Build preview binaries

**Android** (non-interactive once the default Android keystore exists on EAS):

```bash
cd apps/mobile
pnpm eas:build:preview:android
```

**iOS** — the **first** internal iOS build must be run **interactively** (no `--non-interactive`) so EAS can create an Apple distribution certificate and an **internal** provisioning profile that includes your registered devices:

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

Use your Apple Developer Apple ID when prompted. After credentials exist, CI-style builds work:

```bash
eas build --platform ios --profile preview --non-interactive --no-wait
```

**Both platforms** (Android queues immediately; iOS fails in non-interactive mode until step above is done once):

```bash
cd apps/mobile
pnpm eas:build:preview
# then separately, if iOS is not set up yet:
eas build --platform ios --profile preview
```

## 3. Share install links

- **Project (all builds):** [expo.dev — cheddr-tic-tac-toe](https://expo.dev/accounts/cclerv/projects/cheddr-tic-tac-toe/builds)
- **Per build:** EAS prints `https://expo.dev/accounts/cclerv/projects/cheddr-tic-tac-toe/builds/<build-id>` when the build is queued.

**iOS:** tester opens the **iOS** build page on their iPhone and installs (UDID must already be registered).

**Android:** tester opens the **Android** build page, downloads the APK, and installs.

## 4. OTA updates (JS/asset only, no reinstall)

Preview installs use channel **`preview`**. After changing JS/TS only (no new native modules, no `app.json` / plugin / permission changes):

```bash
cd apps/mobile
pnpm eas:update:preview
```

Rebuild and redistribute when you change native code, Expo SDK, plugins, or entitlements.

## npm scripts (see `apps/mobile/package.json`)

| Script | Purpose |
|--------|---------|
| `pnpm eas:device:create` | Register a device for internal iOS builds |
| `pnpm eas:devices` | List registered devices |
| `pnpm eas:build:preview:android` | Queue Android `preview` build (non-interactive) |
| `pnpm eas:build:preview` | Queue Android + iOS `preview` builds (iOS may need interactive first run) |
| `pnpm eas:update` | `eas update --auto` (branch from git; good for CI-style flows) |
| `pnpm eas:update:preview` | Publish OTA to **`preview`** channel for internal preview installs |

## Related

- CI secrets and EAS Update on PRs: [`docs/ci.md`](ci.md)
- API env for mobile builds: [`apps/api/DEPLOY.md`](../apps/api/DEPLOY.md)
