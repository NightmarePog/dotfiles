#!/usr/bin/env bash
# Screenshot vybrané oblasti s mírným zpožděním, pak uloží do clipboardu.

# Zkus vybrat oblast
selection=$(slurp)
if [ -z "$selection" ]; then
    notify-send "Screenshot" "Výběr zrušen."
    exit 1
fi



# Udělej screenshot a zkopíruj do clipboardu
grim -g "$selection" - | wl-copy

# Pošli notifikaci
notify-send "Screenshot" "Oblast zkopírována do schránky."
