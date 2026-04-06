#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# ── Parse flags ──────────────────────────────────────────────
DEV=false
for arg in "$@"; do
  case "$arg" in
    --dev|-d) DEV=true ;;
  esac
done

# ── Check Docker ─────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Docker is required but not installed."
  echo "Install from https://docker.com/get-started"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo "Docker daemon is not running. Please start Docker Desktop and try again."
  exit 1
fi

# ── Check Claude auth ────────────────────────────────────────
if [ ! -f "$HOME/.claude.json" ]; then
  echo "Claude authentication not found at ~/.claude.json"
  echo "Run 'npx @anthropic-ai/claude-code' once to log in, then re-run this script."
  exit 1
fi

# ── Export Claude credentials for Docker ─────────────────────
# The Claude SDK stores OAuth tokens in the OS keychain (macOS Keychain / Windows
# Credential Manager). Docker containers can't access the host keychain, so we
# export the credentials to a plaintext JSON file that the SDK's built-in
# fallback can read.
CRED_FILE="$HOME/.claude/.credentials.json"
if [ "$(uname)" = "Darwin" ]; then
  CRED_DATA=$(security find-generic-password -a "$USER" -s "Claude Code-credentials" -w 2>/dev/null || true)
  if [ -n "$CRED_DATA" ]; then
    mkdir -p "$HOME/.claude"
    echo "$CRED_DATA" > "$CRED_FILE"
    chmod 600 "$CRED_FILE"
  fi
elif [ "$(uname)" = "Linux" ]; then
  # On Linux, credentials may already be in the plaintext file
  :
fi

if [ ! -f "$CRED_FILE" ]; then
  echo "Could not export Claude credentials for Docker."
  echo "Make sure you've logged in with 'npx @anthropic-ai/claude-code' first."
  exit 1
fi

# ── Build and start ──────────────────────────────────────────
if [ "$DEV" = true ]; then
  echo "Starting Jobby in DEVELOPMENT mode (hot-reload enabled)..."
  docker compose -f docker-compose.dev.yml up --build -d
  echo ""
  echo "  Jobby (dev) is running at  http://localhost:3000"
  echo "  Edit files locally — changes are picked up automatically."
  echo "  Logs:                      docker compose -f docker-compose.dev.yml logs -f node"
  echo "  Stop:                      docker compose -f docker-compose.dev.yml down"
else
  echo "Building and starting Jobby..."
  docker compose up --build -d
  echo ""
  echo "  Jobby is running at  http://localhost:3000"
  echo "  Stop with:           docker compose down"
fi
echo ""

# ── Open browser ─────────────────────────────────────────────
if command -v open &>/dev/null; then
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
fi
