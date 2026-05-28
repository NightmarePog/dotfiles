#!/bin/bash
read_cpu() {
    awk '/^cpu / {total=0; for(i=2;i<=NF;i++) total+=$i; print total, $5+$6}' /proc/stat
}
IFS=' ' read -r t1 i1 <<< "$(read_cpu)"
sleep 0.35
IFS=' ' read -r t2 i2 <<< "$(read_cpu)"

dt=$((t2 - t1)); di=$((i2 - i1))
cpu=$(( dt > 0 ? (dt - di) * 100 / dt : 0 ))

eval "$(awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "mt=%d ma=%d",t,a}' /proc/meminfo)"
ram=$(( (mt - ma) * 100 / mt ))
ram_used=$(awk "BEGIN{printf \"%.1f\", ($mt-$ma)/1048576}")
ram_total=$(( mt / 1048576 ))

gpu=$(cat /sys/class/drm/card1/device/gpu_busy_percent 2>/dev/null || echo 0)
gpu_temp=$(( $(cat /sys/class/hwmon/hwmon3/temp1_input 2>/dev/null || echo 0) / 1000 ))
cpu_temp=$(( $(cat /sys/class/hwmon/hwmon4/temp1_input 2>/dev/null || echo 0) / 1000 ))
gpu_mhz=$(( $(cat /sys/class/hwmon/hwmon3/freq1_input 2>/dev/null || echo 0) / 1000000 ))

printf '{"cpu":%d,"ram":%d,"ram_used":"%sG","ram_total":"%dG","gpu":%d,"gpu_temp":%d,"cpu_temp":%d,"gpu_mhz":%d}\n' \
    "$cpu" "$ram" "$ram_used" "$ram_total" "$gpu" "$gpu_temp" "$cpu_temp" "$gpu_mhz"
