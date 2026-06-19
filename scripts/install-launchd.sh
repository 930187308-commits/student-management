#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-/Users/bzx/Projects/student-ai-console}"
LOG_ROOT="${STUDENT_LOG_DIR:-/Users/bzx/Logs/student-ai-console}"
DATA_ROOT="${STUDENT_DATA_DIR:-/Users/bzx/Data/student-ai-console}"
PORT="${STUDENT_SERVER_PORT:-3000}"
LABEL="com.bzx.student-ai-console"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"

mkdir -p "$PLIST_DIR" "$LOG_ROOT" "$DATA_ROOT"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PROJECT_ROOT/scripts/run-server.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>STUDENT_CONSOLE_ENV</key>
        <string>production</string>
        <key>STUDENT_SERVER_HOST</key>
        <string>0.0.0.0</string>
        <key>STUDENT_SERVER_PORT</key>
        <string>$PORT</string>
        <key>STUDENT_DATA_DIR</key>
        <string>$DATA_ROOT</string>
        <key>STUDENT_LOG_DIR</key>
        <string>$LOG_ROOT</string>
        <key>STUDENT_READ_FULL_DATA_FROM_SQLITE</key>
        <string>1</string>
        <key>STUDENT_READ_FULL_DATA_FROM_SQLITE_COLUMNS</key>
        <string>1</string>
        <key>NODE_BIN</key>
        <string>$(command -v node)</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_ROOT/server.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_ROOT/server.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "LaunchAgent installed."
echo "Label: $LABEL"
echo "Plist: $PLIST_PATH"
echo "Local: http://localhost:$PORT"
