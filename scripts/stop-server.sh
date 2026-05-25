#!/bin/zsh
set -euo pipefail

LOG_ROOT="${STUDENT_LOG_DIR:-/Users/bzx/Logs/student-ai-console}"
PID_FILE="$LOG_ROOT/student-ai-console.pid"

if [[ ! -f "$PID_FILE" ]]; then
    echo "No PID file found. The managed service may already be stopped."
    echo "Run scripts/status-server.sh to inspect port usage."
    exit 0
fi

server_pid="$(cat "$PID_FILE")"
if ! kill -0 "$server_pid" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "Stale PID file removed."
    exit 0
fi

kill "$server_pid"
for _ in {1..20}; do
    if ! kill -0 "$server_pid" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "Student AI Console stopped."
        exit 0
    fi
    sleep 0.2
done

echo "Service did not stop after 4 seconds. PID: $server_pid"
exit 1
