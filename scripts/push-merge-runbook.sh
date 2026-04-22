#!/usr/bin/env bash
set -euo pipefail

DEST_REPO="GoodshytGroup/Ethos-Aegis-Agentic-Immune-Veriflow"
SRC_REPO="GoodshytGroup/veriflow-Sovereign-Lattice"
MERGE_BRANCH="merge/veriflow-sovereign-lattice"
PR_TITLE="Merge veriflow-Sovereign-Lattice into Ethos monorepo preserving history"
PR_BODY="History-preserving repository consolidation for Veriflow into Ethos Aegis."

log() { printf "[merge-runbook] %s\n" "$1"; }
die() { printf "[merge-runbook] ERROR: %s\n" "$1" >&2; exit 1; }

require_repo_root() {
  git rev-parse --show-toplevel >/dev/null 2>&1 || die "Run inside the destination git repository."
}

ensure_auth() {
  if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
      log "Using authenticated gh CLI session."
      return 0
    fi
  fi

  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    log "Using GITHUB_TOKEN from environment."
    return 0
  fi

  if [[ -n "${GH_TOKEN:-}" ]]; then
    log "Using GH_TOKEN from environment."
    return 0
  fi

  die "Authenticate with 'gh auth login' or export GITHUB_TOKEN / GH_TOKEN before running."
}

configure_remote() {
  if git remote get-url veriflow >/dev/null 2>&1; then
    log "Remote 'veriflow' already configured."
  else
    git remote add veriflow "https://github.com/${SRC_REPO}.git"
    log "Added remote: veriflow -> ${SRC_REPO}"
  fi
}

perform_merge() {
  git fetch origin
  git fetch veriflow
  git checkout -B "${MERGE_BRANCH}" origin/main
  git merge veriflow/main --allow-unrelated-histories -m "merge: import veriflow-Sovereign-Lattice history"
}

push_and_open_pr() {
  git push -u origin "${MERGE_BRANCH}"
  if command -v gh >/dev/null 2>&1; then
    gh pr create \
      --repo "${DEST_REPO}" \
      --base main \
      --head "${MERGE_BRANCH}" \
      --title "${PR_TITLE}" \
      --body "${PR_BODY}" || true
  else
    log "gh CLI not available; push completed. Open the PR manually in GitHub."
  fi
}

main() {
  require_repo_root
  ensure_auth
  configure_remote
  perform_merge
  push_and_open_pr
  log "Merge branch prepared. Resolve any conflicts, then merge the PR in GitHub."
}

main "$@"
