#!/usr/bin/env bash
# Boot the full local dev stack with Cloudflare tunnels for both the API
# and the Metro bundler so a physical device on Expo Go (any network) can
# load the app and reach the API without LAN connectivity.
#
# What it does:
#   1. Starts the Hono API on :3005.
#   2. Brings up a Cloudflare Quick Tunnel for the API and captures the URL.
#   3. Brings up a Cloudflare Quick Tunnel for Metro on :8081.
#   4. Health-checks both tunnels via HTTPS before continuing.
#   5. Patches apps/mobile/.env.local with EXPO_PUBLIC_API_URL.
#   6. Boots Expo (Metro) with EXPO_PACKAGER_PROXY_URL so the on-device app
#      loads the bundle through the Cloudflare tunnel.
#   7. Prints its OWN QR code with the correct `exp+https://` deep link
#      (Expo CLI's built-in QR is broken for HTTPS proxies — it generates
#      `exp://hostname:443` which iOS/Expo Go interpret as plain HTTP and
#      fail with "hostname could not be found").
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
    # Cloudflared logs `https://api.trycloudflare.com` (its control-plane
    # endpoint) before — and sometimes racily interleaved with — the real
    # quick-tunnel URL announcement. We must skip that hostname or we end
    # up opening exp://api.trycloudflare.com in Expo Go, which 404s.
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$log_file" \
      | grep -v '^https://api\.trycloudflare\.com$' \
      | head -n 1 || true)"
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

# Poll a tunnel URL until it returns any HTTP response (DNS + edge ready).
# Cloudflare quick tunnels typically take 2-10s after the URL is announced
# before they actually start serving traffic.
wait_for_tunnel_ready() {
  local url="$1"
  local label="$2"
  local timeout="${3:-45}"
  local code=""
  for i in $(seq 1 "$timeout"); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url/" 2>/dev/null || echo "000")"
    # Anything that isn't 000 (curl failure) or 502/503/504 (Cloudflare not
    # ready yet) means the edge is reachable. We don't care about the actual
    # status from the origin here.
    case "$code" in
      000|502|503|504)
        sleep 1
        continue
        ;;
      *)
        echo "$label tunnel reachable (HTTP $code after ${i}s)"
        return 0
        ;;
    esac
  done
  echo "Timed out waiting for $label tunnel to become reachable (last code: $code)" >&2
  return 1
}

print_qr() {
  local url="$1"
  # qrcode-terminal is a transitive dep hoisted at the repo root by pnpm.
  # We deliberately do NOT use `{small: true}` — that half-block rendering
  # confuses phone cameras (modules are too thin to focus on). The default
  # full-size rendering uses 2-char-wide modules and scans reliably.
  if ! ( cd "$REPO_ROOT" && node -e "
    try {
      require('qrcode-terminal').generate(process.argv[1]);
    } catch (e) {
      console.error('qrcode-terminal not available:', e.message);
      process.exit(1);
    }
  " "$url" 2>/dev/null ); then
    echo "(could not render QR — open the URL above manually in Expo Go)"
  fi
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
echo "API tunnel: $API_TUNNEL_URL (waiting for it to become reachable...)"
if ! wait_for_tunnel_ready "$API_TUNNEL_URL" "API"; then
  echo "API tunnel never became reachable. Last 40 lines of cloudflared log:" >&2
  tail -n 40 "$API_TUNNEL_LOG" >&2
  exit 1
fi

echo "Starting Cloudflare tunnel for Metro (:8081)..."
cloudflared tunnel --no-autoupdate --url http://localhost:8081 \
  >"$METRO_TUNNEL_LOG" 2>&1 &
METRO_TUNNEL_PID=$!

METRO_TUNNEL_URL="$(extract_tunnel_url "$METRO_TUNNEL_LOG" "Metro")"
echo "Metro tunnel: $METRO_TUNNEL_URL (waiting for it to become reachable...)"
# Metro isn't running yet (we start it below) so we expect 502/503/504 from
# the origin until then. We just want to confirm the edge resolves.
for _ in $(seq 1 30); do
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$METRO_TUNNEL_URL/" 2>/dev/null || echo "000")"
  if [ "$CODE" != "000" ]; then
    echo "Metro tunnel edge reachable (HTTP $CODE — origin not up yet, expected)"
    break
  fi
  sleep 1
done
if [ "$CODE" = "000" ]; then
  echo "Metro tunnel never became reachable. Last 40 lines of cloudflared log:" >&2
  tail -n 40 "$METRO_TUNNEL_LOG" >&2
  exit 1
fi

# The deep link Expo Go expects for an HTTPS-fronted Metro:
#   exp+https://<host>     -> Expo Go fetches the manifest via HTTPS:443
# NOT:
#   exp://<host>:443       -> Expo Go tries HTTP and fails with
#                             "hostname could not be found"
# Expo CLI's built-in QR code generates the broken `exp://` form when
# EXPO_PACKAGER_PROXY_URL is HTTPS, so we render our own QR below and tell
# the user to ignore the one Metro prints.
EXPO_GO_URL="exp+https://${METRO_TUNNEL_URL#https://}"

echo ""
echo "================================================================"
echo " API URL (baked into bundle): $API_TUNNEL_URL"
echo " Metro URL (HTTPS):           $METRO_TUNNEL_URL"
echo " Expo Go deep link:           $EXPO_GO_URL"
echo "================================================================"
echo ""
echo "Scan this QR with the iOS Camera app (it will hand off to Expo Go),"
echo "or open the deep link above directly. IGNORE the QR that Expo prints"
echo "below — it generates a broken 'exp://...:443' link for HTTPS tunnels."
echo ""
print_qr "$EXPO_GO_URL"
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
