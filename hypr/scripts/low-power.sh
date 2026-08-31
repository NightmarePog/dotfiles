#!/usr/bin/env bash
set -euo pipefail

runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
state_file="$runtime_dir/low-power.state"

apply_root() {
    local action="$1" owner_uid="${PKEXEC_UID:-}"
    [[ $EUID -eq 0 && $owner_uid =~ ^[0-9]+$ ]] || exit 1
    local file="/run/user/$owner_uid/low-power.state"

    if [[ $action == enter ]]; then
        : > "$file"
        for policy in /sys/devices/system/cpu/cpufreq/policy*; do
            [[ -d $policy ]] || continue
            for setting in energy_performance_preference scaling_max_freq; do
                [[ -r "$policy/$setting" && -w "$policy/$setting" ]] || continue
                printf '%s\t%s\n' "$policy/$setting" "$(<"$policy/$setting")" >> "$file"
            done
            [[ -w "$policy/energy_performance_preference" ]] && printf '%s\n' power > "$policy/energy_performance_preference"
            if [[ -w "$policy/scaling_max_freq" ]]; then
                local min max cap
                min=$(<"$policy/cpuinfo_min_freq")
                max=$(<"$policy/cpuinfo_max_freq")
                cap=$((min + (max - min) / 4))
                printf '%s\n' "$cap" > "$policy/scaling_max_freq"
            fi
        done
        chown "$owner_uid" "$file"
    elif [[ $action == exit && -f $file ]]; then
        while IFS=$'\t' read -r path value; do
            [[ $path == /sys/devices/system/cpu/cpufreq/policy*/energy_performance_preference ||
               $path == /sys/devices/system/cpu/cpufreq/policy*/scaling_max_freq ]] || continue
            printf '%s\n' "$value" > "$path"
        done < "$file"
        rm -f "$file"
    fi
}

if [[ ${1:-} == --root ]]; then
    apply_root "${2:-}"
    exit
fi

case "${1:-toggle}" in
    enter)
        [[ ! -e $state_file ]] || exit 0
        pkexec "$0" --root enter
        loginctl lock-session
        hyprctl dispatch dpms off
        notify-send "Low-power mode" "CPU capped near 25%; displays off"
        ;;
    exit)
        pkexec "$0" --root exit
        hyprctl dispatch dpms on
        notify-send "Low-power mode" "Normal performance restored"
        ;;
    toggle)
        if [[ -e $state_file ]]; then "$0" exit; else "$0" enter; fi
        ;;
    status)
        if [[ -e $state_file ]]; then echo active; else echo inactive; fi
        ;;
    *)
        echo "usage: ${0##*/} {enter|exit|toggle|status}" >&2
        exit 2
        ;;
esac
