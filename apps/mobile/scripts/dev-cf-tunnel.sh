#!/usr/bin/env bash
# Start Expo with a Cloudflare Quick Tunnel fronting Metro on :8081.
#
# Why: Expo's bundled `expo start --tunnel` uses a shared ngrok account that
# is currently rate-limited (https://github.com/expo/expo/issues/43335).
# Cloudflare Quick Tunnels are free, account-less, and reliable.
#
# Requires: cloudflared (`brew install cloudflared`).
#
# Usage: pnpm dev:cf-tunnel

set -euo pipefail

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it with: brew install cloudflared" >&2
  exit 1
fi

LOG_FILE="$(mktemp -t expo-cf-tunnel.XXXXXX)"
echo "cloudflared log: $LOG_FILE"

cloudflared tunnel --no-autoupdate --url http://localhost:8081 \
  >"$LOG_FILE" 2>&1 &
CF_PID=$!

cleanup() {
  echo ""
  echo "Stopping cloudflared (pid $CF_PID)..."
  kill "$CF_PID" 2>/dev/null || true
  wait "$CF_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Waiting for Cloudflare tunnel URL..."
TUNNEL_URL=""
for _ in $(seq 1 60); do
  TUNNEL_URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_FILE" | head -n 1 || true)"
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "Failed to obtain tunnel URL. Last 40 lines of log:" >&2
  tail -n 40 "$LOG_FILE" >&2
  exit 1
fi

echo ""
echo "Cloudflare tunnel ready: $TUNNEL_URL"
echo "Open this in Expo Go: exp+https://${TUNNEL_URL#https://}"
echo ""

EXPO_PACKAGER_PROXY_URL="$TUNNEL_URL" \
EXPO_MANIFEST_PROXY_URL="$TUNNEL_URL" \
  pnpm expo start --lan --port 8081
