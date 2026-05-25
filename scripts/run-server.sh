#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/Users/bzx/Projects/student-ai-console}"

if [[ -z "${NODE_BIN:-}" ]]; then
    if command -v node >/dev/null 2>&1; then
        NODE_BIN="$(command -v node)"
    elif [[ -x "/Applications/Codex.app/Contents/Resources/node" ]]; then
        NODE_BIN="/Applications/Codex.app/Contents/Resources/node"
    elif [[ -x "/opt/homebrew/bin/node" ]]; then
        NODE_BIN="/opt/homebrew/bin/node"
    elif [[ -x "/usr/local/bin/node" ]]; then
        NODE_BIN="/usr/local/bin/node"
    else
        echo "Node executable not found. Install Node 24+ or set NODE_BIN." >&2
        exit 1
    fi
fi

cd "$PROJECT_ROOT"
exec "$NODE_BIN" server/server.js
