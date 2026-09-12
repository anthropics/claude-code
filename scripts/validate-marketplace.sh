#!/usr/bin/env bash

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to validate marketplace metadata" >&2
  exit 1
fi

MARKETPLACE_FILE="${1:-.claude-plugin/marketplace.json}"

if [[ ! -f "$MARKETPLACE_FILE" ]]; then
  echo "Error: marketplace file not found: $MARKETPLACE_FILE" >&2
  exit 1
fi

if ! jq -e '.plugins | type == "array"' "$MARKETPLACE_FILE" >/dev/null; then
  echo "Error: $MARKETPLACE_FILE does not contain a valid plugins array" >&2
  exit 1
fi

marketplace_dir=$(cd "$(dirname "$MARKETPLACE_FILE")" && pwd)
marketplace_root=$(cd "$marketplace_dir/.." && pwd)

failures=0

declare -A seen_names=()

while IFS= read -r plugin_json; do
  name=$(printf '%s' "$plugin_json" | jq -r '.name // empty')
  source_type=$(printf '%s' "$plugin_json" | jq -r '(.source | type) // empty')

  if [[ -z "$name" ]]; then
    echo "Error: encountered marketplace entry without a plugin name" >&2
    failures=1
    continue
  fi

  if [[ -n "${seen_names[$name]:-}" ]]; then
    echo "Error: duplicate marketplace entry for plugin '$name'" >&2
    failures=1
    continue
  fi
  seen_names["$name"]=1

  if [[ "$source_type" != "string" ]]; then
    # Remote/object sources are validated elsewhere by Claude Code itself.
    continue
  fi

  source=$(printf '%s' "$plugin_json" | jq -r '.source')

  if [[ "$source" != ./* ]]; then
    continue
  fi

  plugin_rel_path=${source#./}
  case "$plugin_rel_path" in
    ""|../*|*/../*|*/..|*'/./'*|./*)
      echo "Error: plugin '$name' uses a non-portable relative source path: $source" >&2
      failures=1
      continue
      ;;
  esac

  plugin_path="$marketplace_root/$plugin_rel_path"

  if [[ ! -d "$plugin_path" ]]; then
    echo "Error: plugin '$name' source path does not exist or is not a directory: $source" >&2
    failures=1
    continue
  fi

  manifest_path="$plugin_path/.claude-plugin/plugin.json"
  if [[ ! -f "$manifest_path" ]]; then
    echo "Error: plugin '$name' is missing required manifest: ${manifest_path#$marketplace_root/}" >&2
    failures=1
    continue
  fi

  if ! jq -e . "$manifest_path" >/dev/null; then
    echo "Error: plugin '$name' manifest is not valid JSON: ${manifest_path#$marketplace_root/}" >&2
    failures=1
    continue
  fi

  manifest_name=$(jq -r '.name // empty' "$manifest_path")
  if [[ "$manifest_name" != "$name" ]]; then
    echo "Error: plugin '$name' manifest name mismatch: found '$manifest_name' in ${manifest_path#$marketplace_root/}" >&2
    failures=1
    continue
  fi

done < <(jq -c '.plugins[]' "$MARKETPLACE_FILE")

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

echo "Marketplace validation passed for $MARKETPLACE_FILE"
