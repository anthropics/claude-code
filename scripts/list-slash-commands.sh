#!/usr/bin/env bash
set -u
set -o pipefail

WORKSPACE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      if [[ $# -lt 2 ]]; then
        echo "Error: --workspace requires a value" >&2
        exit 1
      fi
      WORKSPACE="$2"
      shift 2
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      echo "Usage: $0 [--workspace PATH]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$WORKSPACE" ]]; then
  WORKSPACE="$(pwd)"
fi

if [[ ! -d "$WORKSPACE" ]]; then
  echo "Error: workspace is not a directory: $WORKSPACE" >&2
  exit 1
fi

WORKSPACE="$(cd "$WORKSPACE" && pwd)"
WARNINGS=0

RECORDS_FILE="$(mktemp)"
cleanup() {
  rm -f "$RECORDS_FILE"
}
trap cleanup EXIT

sanitize_field() {
  local value="${1:-}"
  value="${value//$'\t'/ }"
  value="${value//$'\n'/ }"
  printf '%s' "$value"
}

extract_frontmatter_field() {
  local file="$1"
  local field="$2"

  awk -v key="$field" '
    NR == 1 {
      if ($0 != "---") {
        exit
      }
      next
    }
    $0 == "---" {
      exit
    }
    {
      line = $0
      if (match(line, "^[[:space:]]*" key ":[[:space:]]*")) {
        sub("^[[:space:]]*" key ":[[:space:]]*", "", line)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
        if (line ~ /^".*"$/) {
          line = substr(line, 2, length(line) - 2)
        }
        print line
        exit
      }
    }
  ' "$file" 2>/dev/null
}

extract_plugin_name() {
  local manifest="$1"
  local plugin_name=""

  if command -v jq >/dev/null 2>&1; then
    plugin_name="$(jq -r 'if .name == null then empty else .name end' "$manifest" 2>/dev/null || true)"
  fi

  if [[ -z "$plugin_name" ]]; then
    plugin_name="$(awk -F'"' '/"name"[[:space:]]*:[[:space:]]*"/ { print $4; exit }' "$manifest" 2>/dev/null || true)"
  fi

  printf '%s' "$plugin_name"
}

command_name_from_relative_markdown() {
  local rel_path="$1"
  rel_path="${rel_path%.md}"
  rel_path="${rel_path#/}"
  rel_path="${rel_path//\//:}"
  printf '/%s' "$rel_path"
}

relative_to_workspace() {
  local path="$1"
  if [[ "$path" == "$WORKSPACE/"* ]]; then
    printf '%s' "${path#$WORKSPACE/}"
  else
    printf '%s' "$path"
  fi
}

append_record() {
  local category="$1"
  local name="$2"
  local source="$3"
  local description="$4"
  local usage="$5"
  local origin="$6"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$category" \
    "$(sanitize_field "$name")" \
    "$(sanitize_field "$source")" \
    "$(sanitize_field "$description")" \
    "$(sanitize_field "$usage")" \
    "$(sanitize_field "$origin")" \
    >> "$RECORDS_FILE"
}

collect_project_commands() {
  local commands_dir="$WORKSPACE/.claude/commands"
  local file=""

  if [[ ! -e "$commands_dir" ]]; then
    return
  fi

  if [[ ! -d "$commands_dir" || ! -r "$commands_dir" ]]; then
    WARNINGS=1
    return
  fi

  while IFS= read -r file; do
    local rel_path command_name description usage origin
    rel_path="${file#$commands_dir/}"
    command_name="$(command_name_from_relative_markdown "$rel_path")"
    description="$(extract_frontmatter_field "$file" "description")"
    usage="$(extract_frontmatter_field "$file" "argument-hint")"
    origin="$(relative_to_workspace "$file")"
    append_record "project" "$command_name" "project" "$description" "$usage" "$origin"
  done < <(LC_ALL=C find "$commands_dir" -type f -name '*.md' 2>/dev/null | LC_ALL=C sort)
}

collect_plugin_commands() {
  local plugins_dir="$WORKSPACE/plugins"
  local file=""

  if [[ ! -e "$plugins_dir" ]]; then
    return
  fi

  if [[ ! -d "$plugins_dir" || ! -r "$plugins_dir" ]]; then
    WARNINGS=1
    return
  fi

  while IFS= read -r file; do
    local rest plugin_dir_name plugin_dir manifest plugin_name after_commands
    local command_name description usage origin

    rest="${file#$plugins_dir/}"
    plugin_dir_name="${rest%%/*}"
    plugin_dir="$plugins_dir/$plugin_dir_name"
    manifest="$plugin_dir/.claude-plugin/plugin.json"
    plugin_name="$plugin_dir_name"

    if [[ -f "$manifest" && -r "$manifest" ]]; then
      local parsed_name
      parsed_name="$(extract_plugin_name "$manifest")"
      if [[ -n "$parsed_name" ]]; then
        plugin_name="$parsed_name"
      fi
    elif [[ -e "$manifest" && ! -r "$manifest" ]]; then
      WARNINGS=1
    fi

    after_commands="${rest#*/commands/}"
    if [[ "$after_commands" == "$rest" ]]; then
      WARNINGS=1
      continue
    fi

    command_name="$(command_name_from_relative_markdown "$after_commands")"
    description="$(extract_frontmatter_field "$file" "description")"
    usage="$(extract_frontmatter_field "$file" "argument-hint")"
    origin="$(relative_to_workspace "$file")"
    append_record "plugin" "$command_name" "plugin:$plugin_name" "$description" "$usage" "$origin"
  done < <(LC_ALL=C find "$plugins_dir" -type f -name '*.md' -path '*/commands/*' 2>/dev/null | LC_ALL=C sort)
}

print_section() {
  local header="$1"
  local category="$2"
  local rows row
  local tab

  tab="$(printf '\t')"
  rows="$(
    awk -F'\t' -v c="$category" '$1 == c { print }' "$RECORDS_FILE" \
      | LC_ALL=C sort -t "$tab" -k2,2 -k3,3 -k6,6
  )"

  echo "$header"
  if [[ -z "$rows" ]]; then
    echo "  (none detected)"
    echo
    return
  fi

  while IFS= read -r row; do
    local _category name source description usage origin
    _category="$(printf '%s\n' "$row" | awk -F'\t' '{ print $1 }')"
    name="$(printf '%s\n' "$row" | awk -F'\t' '{ print $2 }')"
    source="$(printf '%s\n' "$row" | awk -F'\t' '{ print $3 }')"
    description="$(printf '%s\n' "$row" | awk -F'\t' '{ print $4 }')"
    usage="$(printf '%s\n' "$row" | awk -F'\t' '{ print $5 }')"
    origin="$(printf '%s\n' "$row" | awk -F'\t' '{ print $6 }')"

    if [[ -z "$description" ]]; then
      description="-"
    fi
    if [[ -z "$usage" ]]; then
      usage="-"
    fi

    echo "  $name"
    echo "    source: $source"
    echo "    description: $description"
    echo "    usage: $usage"
    echo "    origin: $origin"
  done <<< "$rows"

  echo
}

collect_project_commands
collect_plugin_commands

echo "Detected slash commands in current workspace:"
echo

print_section "Project" "project"
print_section "Plugins" "plugin"

if [[ "$WARNINGS" -eq 1 ]]; then
  echo "Note: Some command sources could not be introspected."
fi
