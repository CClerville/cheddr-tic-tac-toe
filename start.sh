#!/usr/bin/env bash
# One-command local setup: Homebrew + toolchain, env files, install, full tunnel dev.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script is intended for macOS." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/pnpm-workspace.yaml" ]]; then
  echo "Run this from the repository root (pnpm-workspace.yaml not found)." >&2
  exit 1
fi

ensure_brew_on_path() {
  if command -v brew >/dev/null 2>&1; then
    return 0
  fi
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    return 0
  fi
  if [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
    return 0
  fi
  return 1
}

install_homebrew() {
  echo "Installing Homebrew (non-interactive)..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ensure_brew_on_path || {
    echo "Homebrew installed but not found on PATH. Add brew to your shell profile and re-run." >&2
    exit 1
  }
}

ensure_brew() {
  if ensure_brew_on_path; then
    return 0
  fi
  install_homebrew
}

ensure_brew

brew_install_if_missing() {
  local formula="$1"
  if brew list --formula "$formula" &>/dev/null; then
    return 0
  fi
  echo "Installing $formula via Homebrew..."
  brew install "$formula"
}

if ! command -v node >/dev/null 2>&1; then
  brew_install_if_missing node
fi

node_major="$(node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0)"
if [[ "$node_major" -lt 20 ]]; then
  echo "Node 20+ is required (found: $(node -v 2>/dev/null || echo none)). Installing/upgrading node via Homebrew..."
  brew_install_if_missing node
  node_major="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
  if [[ "$node_major" -lt 20 ]]; then
    echo "Node is still below 20 after install. Please upgrade Node manually." >&2
    exit 1
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  brew_install_if_missing pnpm
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  brew_install_if_missing cloudflared
fi

API_ENV="$REPO_ROOT/apps/api/.env.local"
if [[ ! -f "$API_ENV" ]]; then
  echo "Writing $API_ENV (first run only)..."
  mkdir -p "$(dirname "$API_ENV")"
  cat <<'CHEHDR_API_ENV' >"$API_ENV"
# Created by Vercel CLI
# AI Gateway: set a valid key from Vercel → AI → API keys, or leave empty and
# rely on VERCEL_OIDC_TOKEN below (from `vercel env pull`). A bad key blocks OIDC.
# Optional Vercel AI Gateway models (see apps/api/.env.example and apps/api/.env.local.example):
# AI_MODEL — hints + post-game analysis (API default openai/gpt-4o-mini when unset).
# AI_MODEL_COMMENTARY — streaming in-game commentary (API default openai/gpt-4.1-mini when unset).
# AI_MODEL=openai/gpt-4o-mini
# AI_MODEL_COMMENTARY=openai/gpt-4.1-mini
CLERK_PUBLISHABLE_KEY="pk_test_aHVtb3JvdXMtdHVya2V5LTUuY2xlcmsuYWNjb3VudHMuZGV2JA"
CLERK_SECRET_KEY="sk_test_OHXKtBN2EzpDhLCFy0HUH5Yhf6jmryOV3TsfxvO447"
DATABASE_URL="postgresql://neondb_owner:npg_scCrAoutY0R4@ep-lively-credit-amftir94-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:npg_scCrAoutY0R4@ep-lively-credit-amftir94.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="05386cab854228fc44c1c9cbf65de736d939d268bc66e7ec59b54c25c8daf8f6"
KV_REST_API_READ_ONLY_TOKEN="ggAAAAAAAZikAAIgcDGlrRNuyKvr1r1VGyV2DK71dLekJ2LXqZaMmIevAyV7LA"
KV_REST_API_TOKEN="gQAAAAAAAZikAAIgcDFhY2NjZjkyMWU4NmE0Njk4OGEzYTIyYWQ2NWU4ZDBiZA"
KV_REST_API_URL="https://smooth-mouse-104612.upstash.io"
KV_URL="rediss://default:gQAAAAAAAZikAAIgcDFhY2NjZjkyMWU4NmE0Njk4OGEzYTIyYWQ2NWU4ZDBiZA@smooth-mouse-104612.upstash.io:6379"
NEON_PROJECT_ID="snowy-mountain-66839127"
PGDATABASE="neondb"
PGHOST="ep-lively-credit-amftir94-pooler.c-5.us-east-1.aws.neon.tech"
PGHOST_UNPOOLED="ep-lively-credit-amftir94.c-5.us-east-1.aws.neon.tech"
PGPASSWORD="npg_scCrAoutY0R4"
PGUSER="neondb_owner"
POSTGRES_DATABASE="neondb"
POSTGRES_HOST="ep-lively-credit-amftir94-pooler.c-5.us-east-1.aws.neon.tech"
POSTGRES_PASSWORD="npg_scCrAoutY0R4"
POSTGRES_PRISMA_URL="postgresql://neondb_owner:npg_scCrAoutY0R4@ep-lively-credit-amftir94-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&connect_timeout=15&sslmode=require"
POSTGRES_URL="postgresql://neondb_owner:npg_scCrAoutY0R4@ep-lively-credit-amftir94-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
POSTGRES_URL_NON_POOLING="postgresql://neondb_owner:npg_scCrAoutY0R4@ep-lively-credit-amftir94.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
POSTGRES_URL_NO_SSL="postgresql://neondb_owner:npg_scCrAoutY0R4@ep-lively-credit-amftir94-pooler.c-5.us-east-1.aws.neon.tech/neondb"
POSTGRES_USER="neondb_owner"
REDIS_URL="rediss://default:gQAAAAAAAZikAAIgcDFhY2NjZjkyMWU4NmE0Njk4OGEzYTIyYWQ2NWU4ZDBiZA@smooth-mouse-104612.upstash.io:6379"
VERCEL_OIDC_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im1yay00MzAyZWMxYjY3MGY0OGE5OGFkNjFkYWRlNGEyM2JlNyJ9.eyJpc3MiOiJodHRwczovL29pZGMudmVyY2VsLmNvbS9jaHJpcy1jbGVydmlsbGVzLXByb2plY3RzIiwic3ViIjoib3duZXI6Y2hyaXMtY2xlcnZpbGxlcy1wcm9qZWN0czpwcm9qZWN0OmNoZWRkci10aWMtdGFjLXRvZS1hcGk6ZW52aXJvbm1lbnQ6ZGV2ZWxvcG1lbnQiLCJzY29wZSI6Im93bmVyOmNocmlzLWNsZXJ2aWxsZXMtcHJvamVjdHM6cHJvamVjdDpjaGVkZHItdGljLXRhYy10b2UtYXBpOmVudmlyb25tZW50OmRldmVsb3BtZW50IiwiYXVkIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NocmlzLWNsZXJ2aWxsZXMtcHJvamVjdHMiLCJvd25lciI6ImNocmlzLWNsZXJ2aWxsZXMtcHJvamVjdHMiLCJvd25lcl9pZCI6InRlYW1fcXFIbmJhaXp2aGV2N1VQekdLVE9Td0FBIiwicHJvamVjdCI6ImNoZWRkci10aWMtdGFjLXRvZS1hcGkiLCJwcm9qZWN0X2lkIjoicHJqX2cyRnNJajlYTlBDNUZ2UnBlWE5xZnBZb0hHWm0iLCJlbnZpcm9ubWVudCI6ImRldmVsb3BtZW50IiwicGxhbiI6InBybyIsInVzZXJfaWQiOiJ1bjlLRGx1eXNYU0FXdDRQQzhjMDhPUDAiLCJjbGllbnRfaWQiOiJjbF9IWXlPUEJOdEZNZkhoYVVuOUw0UVBmVFp6NlRQNDdicCIsIm5iZiI6MTc3NzA1MjAxNCwiaWF0IjoxNzc3MDUyMDE0LCJleHAiOjE3NzcwOTUyMTR9.TH9SJVZtPG87w_6H2WAIOxgAwZRCBIzRkHykSvmx_jwrEhozqGtG5fxFuEt5TBcbCcYcHkkYaLm0LwhXY60hPvseEDHmedRZcaU7A6jm7HzLnqSxonbx__LFCAojBk3yAWCUXkqXU_NmJuPd9SHRA-7WojfoiTSaWYX16Rgow_5L1ZWTBPXdmOTj9skH3et44sFhSivSR1F2pMVdkjmgCpS4h6tkyRpwlbYj-WxpeTqxT6aNagixgC_ZPrqxaOaYU01V2af8fDx7tHOwGnbpWyP8BF5yL1EO67rXTRKTbrkLpACYUyxaWKtJ3zQXHK3zIJCPaCvj1x9iC8kdRckbGg"
CHEHDR_API_ENV
else
  echo "Keeping existing $API_ENV"
  echo "Tip: optional AI env in $API_ENV — AI_GATEWAY_API_KEY (or OIDC via VERCEL_OIDC_TOKEN), AI_MODEL, AI_MODEL_COMMENTARY. See apps/api/.env.local.example."
fi

MOBILE_ENV="$REPO_ROOT/apps/mobile/.env.local"
if [[ ! -f "$MOBILE_ENV" ]]; then
  echo "Writing $MOBILE_ENV (first run only)..."
  mkdir -p "$(dirname "$MOBILE_ENV")"
  cat <<'CHEHDR_MOBILE_ENV' >"$MOBILE_ENV"
# Mobile app environment. Anything starting with EXPO_PUBLIC_ is bundled
# into the JS at build time, so do NOT put secrets here.

# Clerk publishable key (safe to expose).
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aHVtb3JvdXMtdHVya2V5LTUuY2xlcmsuYWNjb3VudHMuZGV2JA

# Sentry DSN for the mobile app (optional).
EXPO_PUBLIC_SENTRY_DSN=

# EXPO_PUBLIC_API_URL is set by scripts/dev-full-tunnel.sh while tunnels run.
CHEHDR_MOBILE_ENV
else
  echo "Keeping existing $MOBILE_ENV"
fi

echo "Installing dependencies (pnpm install)..."
pnpm install

echo "Starting API + Metro with Cloudflare tunnels (Ctrl-C to stop)..."
exec bash "$REPO_ROOT/scripts/dev-full-tunnel.sh"
