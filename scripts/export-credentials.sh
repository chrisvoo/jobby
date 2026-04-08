#!/usr/bin/env bash
set -e

# Re-exports the Claude OAuth token from the macOS Keychain to a plaintext
# file that Docker containers can read.
#
# Why: Docker can't access the host Keychain.  scripts/start.sh does this automatically,
#      but if the container has been running for a while and the token expires,
#      you can run this script instead of a full restart.
#
# After running:  docker compose restart node

if [ "$(uname)" != "Darwin" ]; then
  echo "This script is only needed on macOS."
  echo "On Linux the Claude SDK stores credentials as plaintext under ~/.claude/ already."
  echo "If you're seeing auth errors, re-authenticate with:  claude  →  /login"
  exit 0
fi

CRED_FILE="$HOME/.claude/.credentials.json"

CRED_DATA=$(security find-generic-password -a "$USER" -s "Claude Code-credentials" -w 2>/dev/null || true)

if [ -z "$CRED_DATA" ]; then
  echo "No Claude credentials found in Keychain."
  echo ""
  echo "  1. Run:   claude"
  echo "  2. Type:  /login"
  echo "  3. Re-run this script."
  exit 1
fi

mkdir -p "$HOME/.claude"
echo "$CRED_DATA" > "$CRED_FILE"
chmod 600 "$CRED_FILE"

echo "Credentials exported to $CRED_FILE"
echo ""
echo "If Jobby is running in Docker, restart the container to pick up the new token:"
echo "  docker compose restart node"
