#!/bin/bash

set -euo pipefail

readonly EWW_COMMAND=/usr/sbin/eww
readonly VOLUME_STEP_PERCENTAGE=5
readonly BRIGHTNESS_STEP_PERCENTAGE=5

ensure_eww_daemon() {
    if "$EWW_COMMAND" ping >/dev/null 2>&1; then
        return
    fi

    "$EWW_COMMAND" daemon >/dev/null 2>&1

    for ((attempt = 0; attempt < 20; attempt += 1)); do
        if "$EWW_COMMAND" ping >/dev/null 2>&1; then
            return
        fi
        sleep 0.05
    done

    printf 'eww did not start\n' >&2
    exit 1
}

read_sink_volume_percentage() {
    pactl get-sink-volume @DEFAULT_SINK@ | awk '
        {
            for (field = 1; field <= NF; field += 1) {
                if ($field ~ /^[0-9]+%$/) {
                    gsub(/%/, "", $field)
                    print $field
                    exit
                }
            }
        }
    '
}

read_source_volume_percentage() {
    pactl get-source-volume @DEFAULT_SOURCE@ | awk '
        {
            for (field = 1; field <= NF; field += 1) {
                if ($field ~ /^[0-9]+%$/) {
                    gsub(/%/, "", $field)
                    print $field
                    exit
                }
            }
        }
    '
}

read_sink_muted() {
    if pactl get-sink-mute @DEFAULT_SINK@ | grep -q 'yes$'; then
        printf 'true\n'
    else
        printf 'false\n'
    fi
}

read_source_muted() {
    if pactl get-source-mute @DEFAULT_SOURCE@ | grep -q 'yes$'; then
        printf 'true\n'
    else
        printf 'false\n'
    fi
}

read_brightness_percentage() {
    brightnessctl -m | awk -F, '
        NR == 1 {
            gsub(/%/, "", $4)
            print $4
            exit
        }
    '
}

set_sink_volume_by_step() {
    local direction="$1"
    local current_percentage
    local target_percentage

    current_percentage="$(read_sink_volume_percentage)"
    if [[ ! "$current_percentage" =~ ^[0-9]+$ ]]; then
        printf 'could not read the current volume\n' >&2
        exit 1
    fi

    if [[ "$direction" == "up" ]]; then
        target_percentage=$((current_percentage + VOLUME_STEP_PERCENTAGE))
    else
        target_percentage=$((current_percentage - VOLUME_STEP_PERCENTAGE))
    fi

    if ((target_percentage > 100)); then target_percentage=100; fi
    if ((target_percentage < 0)); then target_percentage=0; fi

    pactl set-sink-volume @DEFAULT_SINK@ "${target_percentage}%"
}

show_osd() {
    local kind="$1"
    local percentage="$2"
    local muted="$3"
    local label
    local icon

    case "$kind" in
        brightness)
            label="BRIGHTNESS"
            icon="󰃠"
            ;;
        microphone)
            label="MICROPHONE"
            if [[ "$muted" == "true" ]]; then icon="󰍭"; else icon="󰍬"; fi
            ;;
        volume)
            label="VOLUME"
            if [[ "$muted" == "true" || "$percentage" -eq 0 ]]; then
                icon="󰝟"
            elif ((percentage < 34)); then
                icon="󰕿"
            elif ((percentage < 67)); then
                icon="󰖀"
            else
                icon="󰕾"
            fi
            ;;
    esac

    ensure_eww_daemon
    "$EWW_COMMAND" update \
        "osd_kind=$kind" \
        "osd_label=$label" \
        "osd_icon=$icon" \
        "osd_value=$percentage" \
        "osd_muted=$muted"
    "$EWW_COMMAND" close osd >/dev/null 2>&1 || true
    "$EWW_COMMAND" open osd --duration 1400ms >/dev/null
}

case "${1:-}" in
    volume-up)
        set_sink_volume_by_step up
        show_osd volume "$(read_sink_volume_percentage)" "$(read_sink_muted)"
        ;;
    volume-down)
        set_sink_volume_by_step down
        show_osd volume "$(read_sink_volume_percentage)" "$(read_sink_muted)"
        ;;
    volume-toggle)
        pactl set-sink-mute @DEFAULT_SINK@ toggle
        show_osd volume "$(read_sink_volume_percentage)" "$(read_sink_muted)"
        ;;
    microphone-toggle)
        pactl set-source-mute @DEFAULT_SOURCE@ toggle
        show_osd microphone "$(read_source_volume_percentage)" "$(read_source_muted)"
        ;;
    brightness-up)
        brightnessctl set "${BRIGHTNESS_STEP_PERCENTAGE}%+" >/dev/null
        show_osd brightness "$(read_brightness_percentage)" false
        ;;
    brightness-down)
        brightnessctl set "${BRIGHTNESS_STEP_PERCENTAGE}%-" >/dev/null
        show_osd brightness "$(read_brightness_percentage)" false
        ;;
    *)
        printf 'usage: %s {volume-up|volume-down|volume-toggle|microphone-toggle|brightness-up|brightness-down}\n' "$0" >&2
        exit 2
        ;;
esac
