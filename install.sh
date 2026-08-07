#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
CONFIG_DIR="${CONFIG_DIR:-$HOME/.config}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

SKIP_NAMES=(install.sh uninstall.sh README.md .git)

should_skip() {
  local name="$1"
  for skip in "${SKIP_NAMES[@]}"; do
    [[ "$name" == "$skip" ]] && return 0
  done
  return 1
}

link_one() {
  local repo_path="$1"
  local rel_path="${repo_path#"$DOTFILES_DIR"/}"
  local target_path="$CONFIG_DIR/$rel_path"

  if [[ -L "$target_path" ]] && [[ "$(readlink -f "$target_path")" == "$(readlink -f "$repo_path")" ]]; then
    echo "skip (already linked): $target_path"
    return
  fi

  if [[ -e "$target_path" || -L "$target_path" ]]; then
    local backup="${target_path}.bak.$(date +%s)"
    echo "backup: $target_path -> $backup"
    if [[ "$DRY_RUN" -eq 0 ]]; then
      mkdir -p "$(dirname "$backup")"
      mv "$target_path" "$backup"
    fi
  fi

  echo "link: $target_path -> $repo_path"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    mkdir -p "$(dirname "$target_path")"
    ln -s "$repo_path" "$target_path"
  fi
}

while IFS= read -r -d '' file; do
  top_level="${file#"$DOTFILES_DIR"/}"
  top_level="${top_level%%/*}"
  should_skip "$top_level" && continue
  link_one "$file"
done < <(find "$DOTFILES_DIR" -type f -not -path '*/.git/*' -print0)

echo "Done."
