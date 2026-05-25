#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/Users/bzx/Projects/student-ai-console}"
LOG_ROOT="${STUDENT_LOG_DIR:-/Users/bzx/Logs/student-ai-console}"
PORT="${STUDENT_SERVER_PORT:-3000}"
PID_FILE="$LOG_ROOT/student-ai-console.pid"
OUT_LOG="$LOG_ROOT/server.out.log"
ERR_LOG="$LOG_ROOT/server.err.log"

mkdir -p "$LOG_ROOT"
cd "$PROJECT_ROOT"

if [[ -f "$PID_FILE" ]]; then
    existing_pid="$(cat "$PID_FILE")"
    if kill -0 "$existing_pid" 2>/dev/null; then
        echo "Student AI Console is already running."
        echo "PID: $existing_pid"
        echo "URL: http://localhost:$PORT"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is already in use. Run scripts/status-server.sh to inspect it."
    exit 1
fi

STUDENT_CONSOLE_ENV="${STUDENT_CONSOLE_ENV:-production}" nohup node server/server.js >> "$OUT_LOG" 2>> "$ERR_LOG" &
server_pid="$!"
echo "$server_pid" > "$PID_FILE"
sleep 1

if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Failed to start Student AI Console. Check logs:"
    echo "$OUT_LOG"
    echo "$ERR_LOG"
    exit 1
fi

local_name="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
lan_ip="$(ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || true)"
echo "Student AI Console started."
echo "PID: $server_pid"
echo "Local: http://localhost:$PORT"
echo "LAN: http://$local_name.local:$PORT"
if [[ -n "$lan_ip" ]]; then
    echo "LAN IP: http://$lan_ip:$PORT"
fi
echo "Logs: $OUT_LOG"
