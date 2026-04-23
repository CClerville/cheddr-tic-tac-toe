#!/usr/bin/env bash
# Boot the full local dev stack with Cloudflare tunnels for both the API
# and the Metro bundler so a physical device on Expo Go (any network) can
# load the app and reach the API without LAN connectivity.
#
# What it does:
#   1. Starts the Hono API on :3005.
#   2. Brings up a Cloudflare Quick Tunnel for the API and captures the URL.
#   3. Brings up a Cloudflare Quick Tunnel for Metro on :8081.
#   4. Boots Expo (Metro) with EXPO_PACKAGER_PROXY_URL and EXPO_PUBLIC_API_URL
#      pointed at the two tunnels. EXPO_PUBLIC_API_URL is read from process.env
#      at bundle time, so the on-device app calls the API through Cloudflare.
#
# Cleans up all child processes on Ctrl-C or exit.
#
# Why not the bundled `expo start --tunnel`? Expo's shared ngrok account is
# currently rate-limited (https://github.com/expo/expo/issues/43335).
#
# Requires: cloudflared (`brew install cloudflared`).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it with: brew install cloudflared" >&2
  exit 1
fi

API_LOG="$(mktemp -t cheddr-api.XXXXXX)"
API_TUNNEL_LOG="$(mktemp -t cheddr-api-tunnel.XXXXXX)"
METRO_TUNNEL_LOG="$(mktemp -t cheddr-metro-tunnel.XXXXXX)"

echo "Logs:"
echo "  api          : $API_LOG"
echo "  api tunnel   : $API_TUNNEL_LOG"
echo "  metro tunnel : $METRO_TUNNEL_LOG"
echo ""

API_PID=""
API_TUNNEL_PID=""
METRO_TUNNEL_PID=""
ENV_LOCAL="$REPO_ROOT/apps/mobile/.env.local"
ENV_LOCAL_BACKUP=""

restore_env_local() {
  if [ "$ENV_LOCAL_BACKUP" = "MISSING" ]; then
    rm -f "$ENV_LOCAL"
    echo "Removed $ENV_LOCAL (it did not exist before)."
    ENV_LOCAL_BACKUP=""
  elif [ -n "$ENV_LOCAL_BACKUP" ] && [ -f "$ENV_LOCAL_BACKUP" ]; then
    mv "$ENV_LOCAL_BACKUP" "$ENV_LOCAL"
    echo "Restored $ENV_LOCAL"
    ENV_LOCAL_BACKUP=""
  fi
}

cleanup() {
  echo ""
  echo "Shutting down..."
  restore_env_local
  for pid in "$METRO_TUNNEL_PID" "$API_TUNNEL_PID" "$API_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  for pid in "$METRO_TUNNEL_PID" "$API_TUNNEL_PID" "$API_PID"; do
    if [ -n "$pid" ]; then
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

wait_for_port() {
  local port="$1"
  local label="$2"
  local timeout="${3:-60}"
  for _ in $(seq 1 "$timeout"); do
    if nc -z localhost "$port" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $label on :$port" >&2
  return 1
}

extract_tunnel_url() {
  local log_file="$1"
  local label="$2"
  local timeout="${3:-60}"
  local url=""
  for _ in $(seq 1 "$timeout"); do
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$log_file" | head -n 1 || true)"
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $label tunnel URL. Log:" >&2
  tail -n 40 "$log_file" >&2
  return 1
}

echo "Starting API (pnpm dev:api)..."
pnpm dev:api >"$API_LOG" 2>&1 &
API_PID=$!

if ! wait_for_port 3005 "API" 60; then
  echo "API failed to start. Last 40 lines:" >&2
  tail -n 40 "$API_LOG" >&2
  exit 1
fi
echo "API listening on http://localhost:3005"

echo "Starting Cloudflare tunnel for API (:3005)..."
cloudflared tunnel --no-autoupdate --url http://localhost:3005 \
  >"$API_TUNNEL_LOG" 2>&1 &
API_TUNNEL_PID=$!

API_TUNNEL_URL="$(extract_tunnel_url "$API_TUNNEL_LOG" "API")"
echo "API tunnel: $API_TUNNEL_URL"

echo "Starting Cloudflare tunnel for Metro (:8081)..."
cloudflared tunnel --no-autoupdate --url http://localhost:8081 \
  >"$METRO_TUNNEL_LOG" 2>&1 &
METRO_TUNNEL_PID=$!

METRO_TUNNEL_URL="$(extract_tunnel_url "$METRO_TUNNEL_LOG" "Metro")"
echo "Metro tunnel: $METRO_TUNNEL_URL"

echo ""
echo "================================================================"
echo " API URL (baked into bundle): $API_TUNNEL_URL"
echo " Metro URL (Expo Go target):  $METRO_TUNNEL_URL"
echo " Open in Expo Go:             exp+https://${METRO_TUNNEL_URL#https://}"
echo "================================================================"
echo ""

# Patch apps/mobile/.env.local so EXPO_PUBLIC_API_URL points at the API tunnel.
# babel-preset-expo inlines EXPO_PUBLIC_* values from .env.local into the bundle,
# and that value can win over a shell-set env var depending on Metro worker timing.
# We back up the original and restore it on exit.
if [ -f "$ENV_LOCAL" ]; then
  ENV_LOCAL_BACKUP="$(mktemp -t cheddr-env-local.XXXXXX)"
  cp "$ENV_LOCAL" "$ENV_LOCAL_BACKUP"
  # Strip any existing EXPO_PUBLIC_API_URL line, then append the tunnel URL.
  grep -v '^EXPO_PUBLIC_API_URL=' "$ENV_LOCAL_BACKUP" >"$ENV_LOCAL" || true
  echo "EXPO_PUBLIC_API_URL=$API_TUNNEL_URL" >>"$ENV_LOCAL"
  echo "Patched $ENV_LOCAL with tunnel API URL (will be restored on exit)."
else
  ENV_LOCAL_BACKUP="MISSING"
  echo "EXPO_PUBLIC_API_URL=$API_TUNNEL_URL" >"$ENV_LOCAL"
  echo "Wrote $ENV_LOCAL with tunnel API URL (will be removed on exit)."
fi

EXPO_PACKAGER_PROXY_URL="$METRO_TUNNEL_URL" \
EXPO_MANIFEST_PROXY_URL="$METRO_TUNNEL_URL" \
EXPO_PUBLIC_API_URL="$API_TUNNEL_URL" \
  pnpm --filter @cheddr/mobile exec expo start --lan --port 8081 --clear
