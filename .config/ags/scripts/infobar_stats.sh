#!/bin/bash
# Lightweight stats for InfoBar (no CPU delta sleep)
eval "$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "mt=%d ma=%d",t,a}' /proc/meminfo)"
ram=$(( (mt - ma) * 100 / mt ))
gpu=$(cat /sys/class/drm/card1/device/gpu_busy_percent 2>/dev/null || echo 0)
printf '{"ram":%d,"gpu":%d}\n' "$ram" "$gpu"
