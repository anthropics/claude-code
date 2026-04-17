#!/usr/bin/env bash
# PreToolUse (Bash) hook: block docker bind-mounts of /mnt/* to protect the
# Windows drives exposed via WSL.
set -u

payload="$(cat)"
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
[ -z "$cmd" ] && exit 0

c="$(printf '%s' "$cmd" | tr '\n\t' '  ' | sed 's/  */ /g')"

is_docker=0
if printf '%s' "$c" | grep -qE '(^|[[:space:];&|`(])(sudo[[:space:]]+)?docker([[:space:]]+compose)?[[:space:]]'; then
  is_docker=1
fi
[ "$is_docker" -eq 0 ] && exit 0

deny() {
  echo "[block-mnt-mount] BLOCKED: $1" >&2
  echo "[block-mnt-mount] Offending command: $cmd" >&2
  echo "[block-mnt-mount] Use /workspace or a named volume instead of /mnt/*" >&2
  exit 2
}

# -v /mnt/... or --volume /mnt/...
if printf '%s' "$c" | grep -qE '(^|[[:space:]=])(-v|--volume)[[:space:]=]+["'\'']?/mnt/'; then
  deny "docker -v /mnt/* (Windows drive bind-mount) is not allowed"
fi

# --mount ...source=/mnt/... or ...src=/mnt/...
if printf '%s' "$c" | grep -qE -e '--mount[[:space:]=][^[:space:]]*(source|src)=["'\'']?/mnt/'; then
  deny "docker --mount source=/mnt/* is not allowed"
fi

exit 0
