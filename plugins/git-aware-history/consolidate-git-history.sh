#!/usr/bin/env bash
set -euo pipefail

PROJECTS_DIR="${PROJECTS_DIR:-$HOME/.claude/projects}"
DRY_RUN=true

# ── Argument parsing ────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --execute) DRY_RUN=false ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: consolidate-git-history.sh [--dry-run|--execute]"
      echo ""
      echo "  --dry-run  (default) Show what would be merged without changing anything"
      echo "  --execute  Perform the merge and replace source dirs with symlinks"
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

$DRY_RUN && echo "[DRY RUN] Pass --execute to apply changes." || echo "[EXECUTE] Changes will be applied."
echo ""

# ── Utilities ────────────────────────────────────────────────────────────────

# Slugify a path: replace every / and . with -
slugify() {
  echo "${1//[\/.]/-}"
}

# Extract all unique cwd values from JSONL files in a project dir
extract_cwds() {
  local dir="$1"
  python3 - "$dir" <<'PYEOF'
import sys, json, glob, os

project_dir = sys.argv[1]
cwds = set()
for f in glob.glob(os.path.join(project_dir, "*.jsonl")):
    with open(f, errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
                cwd = d.get("cwd")
                if cwd:
                    cwds.add(cwd)
            except json.JSONDecodeError:
                pass
for c in sorted(cwds):
    print(c)
PYEOF
}

# Collect metadata for a project dir: session count, size, date range, branches
collect_metadata() {
  local dir="$1"
  python3 - "$dir" <<'PYEOF'
import sys, json, glob, os

project_dir = sys.argv[1]
sessions = set()
branches = set()
timestamps = []
total_bytes = 0

for f in glob.glob(os.path.join(project_dir, "*.jsonl")):
    total_bytes += os.path.getsize(f)
    with open(f, errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
                if d.get("sessionId"):
                    sessions.add(d["sessionId"])
                if d.get("gitBranch"):
                    branches.add(d["gitBranch"])
                if d.get("timestamp"):
                    timestamps.append(d["timestamp"])
            except json.JSONDecodeError:
                pass

size_mb = total_bytes / (1024 * 1024)
size_str = f"{size_mb:.1f}MB" if size_mb >= 0.1 else f"{total_bytes}B"
date_str = ""
if timestamps:
    timestamps.sort()
    from datetime import datetime
    try:
        first = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
        last  = datetime.fromisoformat(timestamps[-1].replace("Z", "+00:00"))
        date_str = f"{first.strftime('%b %d')} - {last.strftime('%b %d')}"
    except Exception:
        date_str = timestamps[-1][:10]

branch_str = ", ".join(sorted(branches)[:3])
if len(branches) > 3:
    branch_str += f" (+{len(branches)-3} more)"

print(f"{len(sessions)} sessions|{size_str}|{date_str}|{branch_str}")
PYEOF
}

# Given a path that no longer exists, walk up ancestor dirs to find
# the nearest existing git repo root. Prints the path and returns 0 if found.
infer_git_root_for_deleted_path() {
  local path="$1"
  [[ -z "$path" ]] && return 1
  local candidate="$path"
  while true; do
    if [[ -d "$candidate/.git" || -f "$candidate/.git" ]]; then
      echo "$candidate"
      return 0
    fi
    [[ "$candidate" == "/" ]] && break
    local next
    next=$(dirname "$candidate")
    [[ "$next" == "$candidate" ]] && break  # dirname returned same path, stop
    candidate="$next"
  done
  return 1
}

# Present an interactive multi-select for a group of orphaned project dirs.
# Prints selected 1-based indices to stdout, one per line.
interactive_select() {
  local prompt="$1"
  shift
  local items=("$@")

  # Use fzf only when stdin is a TTY (interactive terminal)
  if command -v fzf &>/dev/null && [[ -t 0 ]]; then
    printf '%s\n' "${items[@]}" \
      | fzf --multi --prompt="$prompt > " --header="Tab to select, Enter to confirm" \
      | while IFS= read -r selected; do
          for i in "${!items[@]}"; do
            [[ "${items[$i]}" == "$selected" ]] && echo "$((i+1))"
          done
        done
  else
    # Display goes to stderr so stdout is clean for the index output
    {
      echo ""
      echo "$prompt"
      for i in "${!items[@]}"; do
        printf "  [%d] %s\n" "$((i+1))" "${items[$i]}"
      done
      echo ""
      echo "  [a] all   [n] none   [1,2,...] pick numbers   [s] skip group"
      printf "> "
    } >&2
    local choice
    read -r choice || choice=""
    case "$choice" in
      a|A) for i in "${!items[@]}"; do echo "$((i+1))"; done ;;
      n|N|s|S) ;;
      *)
        local picks_str="$choice"
        local pick
        while IFS=',' read -r pick; do
          pick=$(echo "$pick" | tr -d ' ')
          [[ "$pick" =~ ^[0-9]+$ ]] && echo "$pick"
        done <<< "$picks_str"
        ;;
    esac
  fi
}

# Merge all JSONL files and subagent dirs from src_dir into dst_dir.
# Replaces src_dir with a symlink to dst_dir if --execute.
merge_into() {
  local src_dir="$1"
  local dst_dir="$2"

  # Copy JSONL session files
  for f in "$src_dir"/*.jsonl; do
    [[ -e "$f" ]] || continue
    local fname
    fname=$(basename "$f")
    if [[ -e "$dst_dir/$fname" ]]; then
      echo "  WARNING: collision on $fname — skipping" >&2
      continue
    fi
    if $DRY_RUN; then
      echo "    copy $fname"
    else
      cp "$f" "$dst_dir/$fname"
    fi
  done

  # Copy subagent subdirectories (named by session UUID)
  for d in "$src_dir"/*/; do
    [[ -d "$d" ]] || continue
    local dname
    dname=$(basename "$d")
    if [[ -e "$dst_dir/$dname" ]]; then
      echo "  WARNING: collision on subdir $dname — skipping" >&2
      continue
    fi
    if $DRY_RUN; then
      echo "    copy subdir $dname/"
    else
      cp -r "$d" "$dst_dir/$dname"
    fi
  done

  # Replace source dir with symlink
  if $DRY_RUN; then
    echo "    replace $(basename "$src_dir") with symlink -> $(basename "$dst_dir")"
  else
    local src_name
    src_name=$(basename "$src_dir")
    [[ "$src_dir" == "$PROJECTS_DIR/"* ]] || { echo "ERROR: refusing to remove $src_dir (not under $PROJECTS_DIR)" >&2; return 1; }
    rm -rf "$src_dir"
    ln -sfn "$dst_dir" "$PROJECTS_DIR/$src_name"
    echo "  Merged and linked: $src_name -> $(basename "$dst_dir")"
  fi
}

# ── Phase 1: Live paths ──────────────────────────────────────────────────────
echo "=== Phase 1: Live worktree paths ==="
echo ""

# Parallel indexed arrays (bash 3.2-compatible; no declare -A)
root_slugs=()    # unique root slugs
root_members=()  # space-separated project dir names per slug
root_paths_arr=() # git root absolute path per slug

# Returns the index of a slug in root_slugs, or exits 1 if not found
_find_slug_idx() {
  local target="$1" i
  for i in "${!root_slugs[@]}"; do
    [[ "${root_slugs[$i]}" == "$target" ]] && { echo "$i"; return 0; }
  done
  return 1
}

for project_dir in "$PROJECTS_DIR"/*/; do
  [[ -d "$project_dir" ]] || continue
  [[ -L "$project_dir" ]] && continue  # skip existing symlinks

  # Get the CWDs recorded in this project dir's sessions
  while IFS= read -r cwd; do
    [[ -z "$cwd" ]] && continue
    [[ -d "$cwd" ]] || continue  # skip if path doesn't exist (Phase 2 handles these)

    # Resolve git root for this live path
    git_common=$(git -C "$cwd" rev-parse --git-common-dir 2>/dev/null) || continue
    [[ "$git_common" != /* ]] && git_common="$cwd/$git_common"
    git_root="${git_common%/.git}"
    root_slug=$(slugify "$git_root")
    proj_name=$(basename "$project_dir")

    # Record this project dir under its root slug
    if idx=$(_find_slug_idx "$root_slug"); then
      root_members[$idx]="${root_members[$idx]} $proj_name"
    else
      root_slugs+=("$root_slug")
      root_members+=("$proj_name")
      root_paths_arr+=("$git_root")
    fi
    break  # one cwd is enough to identify the root
  done < <(extract_cwds "$project_dir")
done

# Report and merge groups with more than one member
merged_any=false
for i in "${!root_slugs[@]}"; do
  root_slug="${root_slugs[$i]}"
  IFS=' ' read -ra members <<< "${root_members[$i]}"
  [[ ${#members[@]} -le 1 ]] && continue  # nothing to merge

  git_root="${root_paths_arr[$i]}"
  root_dir="$PROJECTS_DIR/$root_slug"
  mkdir -p "$root_dir"

  echo "Git root: $git_root"
  for member in "${members[@]}"; do
    [[ "$member" == "$root_slug" ]] && continue  # skip the target itself
    member_dir="$PROJECTS_DIR/$member"
    meta=$(collect_metadata "$member_dir")
    printf "  -> %s  (%s)\n" "$member" "${meta//|/  }"
    merge_into "$member_dir" "$root_dir"
  done
  echo ""
  merged_any=true
done

if ! $merged_any; then
  echo "No live-path worktree sessions to merge."
  echo ""
fi

# ── Phase 2: Deleted paths (interactive) ─────────────────────────────────────
echo "=== Phase 2: Orphaned sessions (deleted worktree paths) ==="
echo ""

# Phase 2 uses parallel arrays for bash 3.2 compatibility (same as Phase 1)
orphan_slugs=()
orphan_members=()
orphan_roots_arr=()
unrecognised=()

_find_orphan_idx() {
  local slug="$1"
  local i
  for i in "${!orphan_slugs[@]}"; do
    [[ "${orphan_slugs[$i]}" == "$slug" ]] && echo "$i" && return 0
  done
  return 1
}

for project_dir in "$PROJECTS_DIR"/*/; do
  [[ -d "$project_dir" ]] || continue
  [[ -L "$project_dir" ]] && continue  # skip symlinks

  proj_name=$(basename "$project_dir")

  # Check if any cwd from this dir still exists — Phase 1 handled those
  has_live_cwd=false
  while IFS= read -r cwd; do
    [[ -z "$cwd" ]] && continue
    [[ -d "$cwd" ]] && { has_live_cwd=true; break; }
  done < <(extract_cwds "$project_dir")
  $has_live_cwd && continue

  # Try to infer git root from any stored cwd
  inferred_root=""
  while IFS= read -r cwd; do
    [[ -z "$cwd" ]] && continue
    inferred_root=$(infer_git_root_for_deleted_path "$cwd") && break
  done < <(extract_cwds "$project_dir")

  if [[ -z "$inferred_root" ]]; then
    unrecognised+=("$proj_name")
    continue
  fi

  inferred_slug=$(slugify "$inferred_root")
  if idx=$(_find_orphan_idx "$inferred_slug"); then
    orphan_members[$idx]="${orphan_members[$idx]} $proj_name"
  else
    orphan_slugs+=("$inferred_slug")
    orphan_members+=("$proj_name")
    orphan_roots_arr+=("$inferred_root")
  fi
done

if [[ ${#orphan_slugs[@]} -eq 0 && ${#unrecognised[@]} -eq 0 ]]; then
  echo "No orphaned sessions found."
  echo ""
fi

# ── Present each inferred group interactively ────────────────────────────────
for i in "${!orphan_slugs[@]}"; do
  inferred_slug="${orphan_slugs[$i]}"
  inferred_root="${orphan_roots_arr[$i]}"
  IFS=' ' read -ra members <<< "${orphan_members[$i]}"

  display_lines=()
  for member in "${members[@]}"; do
    meta=$(collect_metadata "$PROJECTS_DIR/$member")
    IFS='|' read -r sess_count size date branches <<< "$meta"
    display_lines+=("$member  |  $sess_count  |  $size  |  $date  |  $branches")
  done

  printf "Orphaned sessions — inferred repo: %s\n" "$inferred_root"
  $DRY_RUN && echo "(dry-run: no changes will be made)"

  selected_indices=()
  while IFS= read -r line; do
    selected_indices+=("$line")
  done < <(interactive_select "Merge into $inferred_slug?" "${display_lines[@]}")

  if [[ ${#selected_indices[@]} -eq 0 ]]; then
    echo "  Skipped."
    echo ""
    continue
  fi

  target_dir="$PROJECTS_DIR/$inferred_slug"
  mkdir -p "$target_dir"

  for idx2 in "${selected_indices[@]}"; do
    member="${members[$((idx2-1))]}"
    member_dir="$PROJECTS_DIR/$member"
    echo "  Merging: $member"
    merge_into "$member_dir" "$target_dir"
  done
  echo ""
done

# ── Unrecognisable orphans ────────────────────────────────────────────────────
if [[ ${#unrecognised[@]} -gt 0 ]]; then
  echo "Unrecognised orphans (cannot infer git repo):"
  for u in "${unrecognised[@]}"; do
    meta=$(collect_metadata "$PROJECTS_DIR/$u")
    printf "  %s  (%s)\n" "$u" "${meta//|/  }"
  done
  echo ""
  printf "Keep these as-is? [Y/n] "
  keep_choice=""
  read -r keep_choice || true
  if [[ "$keep_choice" =~ ^[Nn] ]]; then
    for u in "${unrecognised[@]}"; do
      if $DRY_RUN; then
        echo "  [DRY RUN] Would delete: $u"
      else
        [[ "$PROJECTS_DIR/$u" == "$PROJECTS_DIR/"* ]] || { echo "ERROR: refusing to remove $u" >&2; continue; }
        rm -rf "${PROJECTS_DIR:?}/$u"
        echo "  Deleted: $u"
      fi
    done
  else
    echo "  Kept."
  fi
  echo ""
fi

echo "Done."
