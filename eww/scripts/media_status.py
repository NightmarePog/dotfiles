#!/usr/bin/env python3

import json
import subprocess


def command_output(arguments: list[str]) -> str:
    try:
        completed_process = subprocess.run(
            arguments,
            check=False,
            capture_output=True,
            text=True,
            timeout=1,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""

    if completed_process.returncode != 0:
        return ""
    return completed_process.stdout.strip()


def shortened(text: str, maximum_length: int) -> str:
    cleaned_text = " ".join(text.split())
    if len(cleaned_text) <= maximum_length:
        return cleaned_text
    return f"{cleaned_text[: maximum_length - 1]}…"


def main() -> None:
    player_name = "playerctld"
    playback_status = command_output(["playerctl", "-p", player_name, "status"])
    title = command_output(
        ["playerctl", "-p", player_name, "metadata", "--format", "{{title}}"]
    )
    artist = command_output(
        ["playerctl", "-p", player_name, "metadata", "--format", "{{artist}}"]
    )

    if not title and not artist:
        playback_status = "Stopped"
        title = "NO PLAYER"

    print(
        json.dumps(
            {
                "status": playback_status or "Stopped",
                "title": shortened(title, 34),
                "artist": shortened(artist, 30),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
