#!/usr/bin/env bash
# PreToolUse (Write|Edit) hook: block writes to docker compose YAML that bind
# /mnt/* into containers. Prevents the YAML detour around block-mnt-mount.sh.
set -u

payload="$(cat)"
file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0

base="$(basename "$file")"
case "$base" in
  docker-compose*.yml|docker-compose*.yaml|compose*.yml|compose*.yaml) ;;
  *) exit 0 ;;
esac

# Write provides .content; Edit provides .new_string. replace_all edits still
# route through new_string, so one field is enough.
content="$(printf '%s' "$payload" | jq -r '.tool_input.content // .tool_input.new_string // empty')"
[ -z "$content" ] && exit 0

deny() {
  echo "[block-mnt-in-compose] BLOCKED: $1" >&2
  echo "[block-mnt-in-compose] File: $file" >&2
  echo "[block-mnt-in-compose] /mnt/* は Windows ドライブ保護のため禁止です" >&2
  exit 2
}

# Short-form volume: "- /mnt/c/foo:/bar"
if printf '%s' "$content" | grep -qE '(^|[[:space:]])-[[:space:]]+["'\'']?/mnt/'; then
  deny "short-form bind mount of /mnt/* found in compose YAML"
fi

# Long-form bind mount: "source: /mnt/..." or "device: /mnt/..."
if printf '%s' "$content" | grep -qE '(^|[[:space:]])(source|device)[[:space:]]*:[[:space:]]*["'\'']?/mnt/'; then
  deny "long-form source/device of /mnt/* found in compose YAML"
fi

exit 0
