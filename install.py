#!/usr/bin/env python3

import argparse
import os
import shutil
import time
from pathlib import Path


SKIPPED_TOP_LEVEL_NAMES = {
    ".git",
    ".gitignore",
    "README.md",
    "install.py",
    "uninstall.py",
    "wallpapers",
}


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Link files from this repository into the user config directory."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="show the changes without modifying any files",
    )
    return parser.parse_args()


def configured_path(environment_variable: str, default: Path) -> Path:
    configured_value = os.environ.get(environment_variable)
    if configured_value is None:
        return default
    return Path(configured_value).expanduser().resolve()


def repository_files(dotfiles_directory: Path) -> list[Path]:
    files: list[Path] = []

    for candidate in dotfiles_directory.rglob("*"):
        relative_path = candidate.relative_to(dotfiles_directory)
        if relative_path.parts[0] in SKIPPED_TOP_LEVEL_NAMES:
            continue
        if candidate.is_file():
            files.append(candidate)

    return sorted(files)


def link_file(
    repository_path: Path,
    dotfiles_directory: Path,
    config_directory: Path,
    dry_run: bool,
) -> None:
    relative_path = repository_path.relative_to(dotfiles_directory)
    target_path = config_directory / relative_path

    if (
        target_path.is_symlink()
        and target_path.resolve(strict=False) == repository_path.resolve()
    ):
        print(f"skip (already linked): {target_path}")
        return

    if target_path.exists() or target_path.is_symlink():
        backup_path = target_path.with_name(
            f"{target_path.name}.bak.{time.time_ns()}"
        )
        print(f"backup: {target_path} -> {backup_path}")
        if not dry_run:
            shutil.move(target_path, backup_path)

    print(f"link: {target_path} -> {repository_path}")
    if not dry_run:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.symlink_to(repository_path)


def main() -> None:
    arguments = parse_arguments()
    script_directory = Path(__file__).resolve().parent
    dotfiles_directory = configured_path("DOTFILES_DIR", script_directory)
    config_directory = configured_path("CONFIG_DIR", Path.home() / ".config")

    for repository_path in repository_files(dotfiles_directory):
        link_file(
            repository_path,
            dotfiles_directory,
            config_directory,
            arguments.dry_run,
        )

    print("Done.")


if __name__ == "__main__":
    main()
