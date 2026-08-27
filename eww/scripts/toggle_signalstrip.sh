#!/bin/bash

set -euo pipefail

readonly EWW_COMMAND=/usr/sbin/eww

if "$EWW_COMMAND" active-windows 2>/dev/null | grep -Eq ': (signalstrip|powermenu)$'; then
    "$EWW_COMMAND" close signalstrip powermenu >/dev/null 2>&1 || true
    exit
fi

focused_monitor_id="$(
    hyprctl monitors -j |
        jq -r '.[] | select(.focused) | .id' |
        head -n 1
)"

if [[ -n "$focused_monitor_id" && "$focused_monitor_id" != "null" ]]; then
    "$EWW_COMMAND" open signalstrip --screen "$focused_monitor_id"
else
    "$EWW_COMMAND" open signalstrip
fi
