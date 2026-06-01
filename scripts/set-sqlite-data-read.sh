#!/bin/zsh
set -euo pipefail

LABEL="com.bzx.student-ai-console"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
PLIST_BUDDY="/usr/libexec/PlistBuddy"

usage() {
    echo "Usage: scripts/set-sqlite-data-read.sh on|off|status"
}

if [[ $# -ne 1 ]]; then
    usage
    exit 2
fi

if [[ ! -f "$PLIST_PATH" ]]; then
    echo "LaunchAgent plist not found: $PLIST_PATH"
    echo "Run scripts/install-launchd.sh first."
    exit 1
fi

mode="$1"

read_value() {
    "$PLIST_BUDDY" -c "Print :EnvironmentVariables:STUDENT_READ_FULL_DATA_FROM_SQLITE" "$PLIST_PATH" 2>/dev/null || echo "0"
}

set_value() {
    local value="$1"
    if "$PLIST_BUDDY" -c "Print :EnvironmentVariables:STUDENT_READ_FULL_DATA_FROM_SQLITE" "$PLIST_PATH" >/dev/null 2>&1; then
        "$PLIST_BUDDY" -c "Set :EnvironmentVariables:STUDENT_READ_FULL_DATA_FROM_SQLITE $value" "$PLIST_PATH"
    else
        "$PLIST_BUDDY" -c "Add :EnvironmentVariables:STUDENT_READ_FULL_DATA_FROM_SQLITE string $value" "$PLIST_PATH"
    fi
}

case "$mode" in
    on)
        set_value "1"
        launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
        launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
        launchctl kickstart -k "gui/$(id -u)/$LABEL"
        echo "SQLite full /data read: ON"
        ;;
    off)
        set_value "0"
        launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
        launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
        launchctl kickstart -k "gui/$(id -u)/$LABEL"
        echo "SQLite full /data read: OFF"
        ;;
    status)
        value="$(read_value)"
        if [[ "$value" == "1" ]]; then
            echo "SQLite full /data read: ON"
        else
            echo "SQLite full /data read: OFF"
        fi
        ;;
    *)
        usage
        exit 2
        ;;
esac
