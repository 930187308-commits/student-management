#!/bin/zsh
set -euo pipefail

LOG_ROOT="${STUDENT_LOG_DIR:-/Users/bzx/Logs/student-ai-console}"
PROJECT_ROOT="${PROJECT_ROOT:-/Users/bzx/Projects/student-ai-console}"
PORT="${STUDENT_SERVER_PORT:-3000}"
PID_FILE="$LOG_ROOT/student-ai-console.pid"
LABEL="com.bzx.student-ai-console"

echo "Student AI Console status"
echo "Port: $PORT"

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
    launchd_pid="$(launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | awk '/pid =/ {print $3; exit}')"
    if [[ -n "$launchd_pid" ]]; then
        echo "LaunchAgent: running, PID $launchd_pid"
    else
        echo "LaunchAgent: installed"
    fi
else
    echo "LaunchAgent: not installed"
fi

if [[ -f "$PID_FILE" ]]; then
    server_pid="$(cat "$PID_FILE")"
    if kill -0 "$server_pid" 2>/dev/null; then
        echo "Managed PID: $server_pid"
    else
        echo "Managed PID file exists but process is not running: $server_pid"
        rm -f "$PID_FILE"
        echo "Removed stale PID file."
    fi
else
    echo "Managed PID: none"
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN; then
    echo "Port $PORT is listening."
else
    echo "Port $PORT is not listening."
fi

local_name="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
lan_ip="$(ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || true)"
echo "Local: http://localhost:$PORT"
echo "LAN: http://$local_name.local:$PORT"
if [[ -n "$lan_ip" ]]; then
    echo "LAN IP: http://$lan_ip:$PORT"
fi

echo ""
if command -v curl >/dev/null 2>&1; then
    if health_json="$(curl -fsS "http://localhost:$PORT/api/sqlite/status" 2>/dev/null)"; then
        "$PROJECT_ROOT/scripts/node.sh" -e '
const status = JSON.parse(process.argv[1]);
console.log(`SQLite /data read: ${status.readFullDataFromSqlite ? "ON" : "OFF"}`);
console.log(`SQLite column /data read: ${status.readFullDataFromSqliteColumns ? "ON" : "OFF"}`);
console.log(`SQLite reconcile: ${status.migrationStatus}`);
console.log(`SQLite health mismatches: ${status.healthMismatches}`);
if (!status.ok) process.exitCode = 1;
' "$health_json" || echo "SQLite status: unhealthy"
    else
        echo "SQLite status: unavailable"
    fi

    if "$PROJECT_ROOT/scripts/node.sh" "$PROJECT_ROOT/server/check-sqlite-metrics-runtime.js" >/dev/null 2>&1; then
        echo "SQLite metrics parity: OK"
    else
        echo "SQLite metrics parity: mismatch"
    fi

    if "$PROJECT_ROOT/scripts/node.sh" "$PROJECT_ROOT/server/check-reports-summary-runtime.js" >/dev/null 2>&1; then
        echo "Reports summary parity: OK"
    else
        echo "Reports summary parity: mismatch"
    fi

    if "$PROJECT_ROOT/scripts/node.sh" "$PROJECT_ROOT/server/check-dashboard-summary-runtime.js" >/dev/null 2>&1; then
        echo "Dashboard summary parity: OK"
    else
        echo "Dashboard summary parity: mismatch"
    fi

    if "$PROJECT_ROOT/scripts/node.sh" "$PROJECT_ROOT/server/check-data-health-runtime.js" >/dev/null 2>&1; then
        echo "Data health parity: OK"
    else
        echo "Data health parity: mismatch"
    fi

    if "$PROJECT_ROOT/scripts/node.sh" "$PROJECT_ROOT/server/check-collection-api-runtime.js" >/dev/null 2>&1; then
        echo "Collection API parity: OK"
    else
        echo "Collection API parity: mismatch"
    fi
fi
