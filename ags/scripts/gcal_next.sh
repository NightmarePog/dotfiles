#!/bin/bash
# Outputs JSON array of upcoming events: [{title, start}]

if ! command -v gcalcli >/dev/null 2>&1; then
    echo "[]"
    exit 0
fi

python3 - <<'PYEOF'
import sys, json, subprocess
from datetime import datetime

result = subprocess.run(
    ["gcalcli", "agenda", "--nocolor", "--tsv", "--military"],
    capture_output=True, text=True
)

events = []
for line in result.stdout.strip().splitlines():
    parts = line.split("\t")
    if len(parts) < 5 or parts[0] == "start_date":
        continue
    date_str, time_str = parts[0], parts[1]
    title = parts[4] if len(parts) > 4 else "event"
    try:
        if time_str:
            dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            now = datetime.now()
            diff = dt - now
            mins = int(diff.total_seconds() / 60)
            if mins < -60:
                continue
            elif mins < 0:
                rel = "now"
            elif mins < 60:
                rel = f"in {mins}m"
            elif mins < 1440:
                rel = f"in {mins // 60}h"
            else:
                rel = dt.strftime("%b %d")
        else:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            rel = dt.strftime("%b %d")
        events.append({"title": title[:40], "start": rel})
    except Exception:
        continue
    if len(events) >= 3:
        break

print(json.dumps(events))
PYEOF
