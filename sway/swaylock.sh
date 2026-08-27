#!/bin/sh

convert /home/nightmare/Desktop/wallpapers/joy_division_02.jpeg -blur 0x8 /tmp/wallpaper_blur.png


swaylock \
  --image /tmp/wallpaper_blur.png \
  --font "monospace" \
  --font-size 22 \
  --text-color C0C0C0 \
  --text-ver-color FFB000 \
  --ring-color 444444 \
  --line-color 00000000 \
  --inside-color 000000 \
  --separator-color ffffff \
  --key-hl-color FFFFFF \
  --indicator-radius 90 \
  --indicator-thickness 4 \
  --indicator-idle-visible \
  --fade-in 0.2 \
  --clock \
  --timestr '%H:%M:%S' \
  --text-wrong-color C0C0C0AA \
  --text-ver-color FFB000AA \
  --ring-color 444444AA \
  --ring-ver-color FFFFFF \
  --ring-wrong-color FFFFFF \
  --indicator-radius 80 \
  --indicator-thickness 5 \
  --indicator-idle-visible \
  --show-failed-attempts \
  --key-hl-color C0C0C0AA \
  --inside-color 00000000 \
  --line-color 00000000 \
  --separator-color 00000000 \
  --inside-ver-color 00000000 \
  --inside-wrong-color 00000000
