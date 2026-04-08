#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

# ── Parse flags ──────────────────────────────────────────────
DEV=false
BUILD=false
for arg in "$@"; do
  case "$arg" in
    --dev|-d)   DEV=true   ;;
    --build|-b) BUILD=true ;;
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
# --build is opt-in: images are built automatically on first run (when they
# don't exist yet) and reused on every subsequent restart.  Pass --build / -b
# explicitly only when you have changed a Dockerfile, package.json,
# or (for prod) want to bake in new source code.
BUILD_FLAG=""
[ "$BUILD" = true ] && BUILD_FLAG="--build"

if [ "$DEV" = true ]; then
  echo "Starting Jobby in DEVELOPMENT mode (hot-reload enabled)..."
  # shellcheck disable=SC2086
  docker compose -f docker-compose.dev.yml up $BUILD_FLAG -d
  echo ""
  echo "  Jobby (dev) is running at  http://localhost:3000"
  echo "  Edit files locally — changes are picked up automatically."
  echo "  Logs:                      docker compose -f docker-compose.dev.yml logs -f node"
  echo "  Stop:                      docker compose -f docker-compose.dev.yml down"
  echo "  Rebuild images:            ./scripts/start.sh --dev --build"
else
  echo "Starting Jobby..."
  # shellcheck disable=SC2086
  docker compose up $BUILD_FLAG -d
  echo ""
  echo "  Jobby is running at  http://localhost:3000"
  echo "  Stop with:           docker compose down"
  echo "  Rebuild images:      ./scripts/start.sh --build"
fi
echo ""

# ── Wait for the Next.js server, then open the browser ───────
_open_when_ready() {
  local url="http://localhost:3000"
  local health="${url}/api/health"
  local max_wait=60   # seconds before giving up
  local waited=0

  echo "  Waiting for server to be ready..."
  while ! curl -sf "$health" >/dev/null 2>&1; do
    if [ "$waited" -ge "$max_wait" ]; then
      echo "  Server did not respond within ${max_wait}s — open $url manually."
      return
    fi
    sleep 1
    waited=$((waited + 1))
  done

  echo "  Server is ready (${waited}s)."
  if command -v open &>/dev/null; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url"
  fi
}

# Run in the background so the shell prompt returns immediately
_open_when_ready &
