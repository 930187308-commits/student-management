#!/bin/zsh
set -euo pipefail

if [[ -n "${NODE_BIN:-}" && -x "$NODE_BIN" ]]; then
    exec "$NODE_BIN" "$@"
fi

if command -v node >/dev/null 2>&1; then
    exec "$(command -v node)" "$@"
fi

if [[ -x "/Applications/Codex.app/Contents/Resources/node" ]]; then
    exec "/Applications/Codex.app/Contents/Resources/node" "$@"
fi

if [[ -x "/opt/homebrew/bin/node" ]]; then
    exec "/opt/homebrew/bin/node" "$@"
fi

if [[ -x "/usr/local/bin/node" ]]; then
    exec "/usr/local/bin/node" "$@"
fi

echo "Node executable not found. Install Node 24+ or run this from Codex." >&2
exit 1
