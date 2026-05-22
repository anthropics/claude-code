#!/usr/bin/env bash
# Git-aware Claude Code wrapper
# Installed by: https://github.com/ilanp-ob/claude-git-aware-history
#
# Disable without uninstalling:
#   rm ~/.claude/git-aware-history.enabled
# Re-enable:
#   touch ~/.claude/git-aware-history.enabled

if [[ -f "$HOME/.claude/git-aware-history.enabled" ]]; then
  if git_common=$(git rev-parse --git-common-dir 2>/dev/null); then
    [[ "$git_common" != /* ]] && git_common="$PWD/$git_common"
    git_root="${git_common%/.git}"
    cwd_slug="${PWD//[\/.]/-}"
    root_slug="${git_root//[\/.]/-}"

    if [[ "$cwd_slug" != "$root_slug" ]]; then
      projects_dir="$HOME/.claude/projects"
      mkdir -p "$projects_dir/$root_slug"
      ln -sfn "$projects_dir/$root_slug" "$projects_dir/$cwd_slug"
    fi
  fi
fi

exec REAL_CLAUDE "$@"
