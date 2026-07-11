#!/bin/bash

# Shared state-path resolver for Ralph setup, Stop, and cancellation scripts.
# State belongs to the Claude Code session, not to the repository checkout.

ralph_resolve_state_path() {
  local session_id="$1"
  local config_root

  RALPH_STATE_ERROR=""
  if [[ -n "${CLAUDE_CONFIG_DIR:-}" ]]; then
    config_root="$CLAUDE_CONFIG_DIR"
  elif [[ -n "${HOME:-}" ]]; then
    config_root="$HOME/.claude"
  else
    RALPH_STATE_ERROR="CLAUDE_CONFIG_DIR or HOME is required to locate private Ralph state"
    return 1
  fi

  if [[ "$config_root" != /* || "$config_root" = "/" ]]; then
    RALPH_STATE_ERROR="Claude configuration directory must be an absolute non-root path"
    return 1
  fi

  RALPH_STATE_ROOT="${config_root%/}"
  RALPH_STATE_DIR="$RALPH_STATE_ROOT/ralph-loop"
  RALPH_STATE_FILE="$RALPH_STATE_DIR/$session_id.local.md"
}

ralph_canonicalize_existing_directory() {
  local directory="$1"

  [[ "$directory" = /* && -d "$directory" ]] || return 1
  (cd -- "$directory" 2>/dev/null && pwd -P)
}

ralph_canonicalize_path_with_missing_suffix() {
  local path="$1"
  local suffix=""
  local component
  local canonical_parent

  [[ "$path" = /* && "$path" != "/" ]] || return 1
  while [[ ! -e "$path" && ! -L "$path" ]]; do
    component="${path##*/}"
    [[ -n "$component" && "$component" != "." && "$component" != ".." ]] || \
      return 1
    suffix="/$component$suffix"
    path="${path%/*}"
    [[ -n "$path" ]] || path="/"
  done

  canonical_parent=$(ralph_canonicalize_existing_directory "$path") || return 1
  printf '%s%s\n' "${canonical_parent%/}" "$suffix"
}

ralph_path_identity() {
  local path="$1"
  local identity

  # BSD/macOS and GNU stat use different format flags. Device plus inode lets
  # Stop distinguish the original directory from another project recreated at
  # the same path.
  if identity=$(stat -f '%d:%i' -- "$path" 2>/dev/null) &&
    [[ "$identity" =~ ^[0-9]+:[0-9]+$ ]]; then
    printf '%s\n' "$identity"
    return 0
  fi
  if identity=$(stat -c '%d:%i' -- "$path" 2>/dev/null) &&
    [[ "$identity" =~ ^[0-9]+:[0-9]+$ ]]; then
    printf '%s\n' "$identity"
    return 0
  fi
  return 1
}

ralph_directory_identity() {
  local directory="$1"

  [[ -d "$directory" && ! -L "$directory" ]] || return 1
  ralph_path_identity "$directory"
}

ralph_path_mtime_epoch() {
  local path="$1"
  local modified_at

  if modified_at=$(stat -f '%m' -- "$path" 2>/dev/null) &&
    [[ "$modified_at" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$modified_at"
    return 0
  fi
  if modified_at=$(stat -c '%Y' -- "$path" 2>/dev/null) &&
    [[ "$modified_at" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$modified_at"
    return 0
  fi
  return 1
}

ralph_path_size() {
  local path="$1"
  local size

  if size=$(stat -f '%z' -- "$path" 2>/dev/null) &&
    [[ "$size" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$size"
    return 0
  fi
  if size=$(stat -c '%s' -- "$path" 2>/dev/null) &&
    [[ "$size" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$size"
    return 0
  fi
  return 1
}

ralph_process_identity() {
  local pid="$1"
  local process_stat
  local process_fields
  local process_start
  local boot_identity
  local started_at

  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1

  if [[ -r "/proc/$pid/stat" ]]; then
    IFS= read -r process_stat < "/proc/$pid/stat" || return 1
    # The comm field is parenthesized and may itself contain spaces. Strip
    # through its final closing parenthesis; starttime is then field 20.
    process_fields="${process_stat##*) }"
    [[ "$process_fields" != "$process_stat" ]] || return 1
    process_start=$(
      printf '%s\n' "$process_fields" | awk '{ print $20 }'
    )
    [[ "$process_start" =~ ^[0-9]+$ ]] || return 1

    if [[ -r /proc/sys/kernel/random/boot_id ]]; then
      IFS= read -r boot_identity < /proc/sys/kernel/random/boot_id || return 1
    elif [[ -r /proc/stat ]]; then
      boot_identity=$(awk '$1 == "btime" { print $2; exit }' /proc/stat)
    else
      return 1
    fi
    [[ -n "$boot_identity" ]] || return 1
    printf 'linux:%s:%s\n' "$boot_identity" "$process_start"
    return 0
  fi

  # macOS does not expose /proc. Convert ps's locale-sensitive timestamp to an
  # epoch so a changed locale or TZ does not change a live owner's identity.
  if ! started_at=$(
    LC_ALL=C ps -o lstart= -p "$pid" 2>/dev/null |
      LC_ALL=C awk '{$1=$1; print}'
  ) || [[ -z "$started_at" ]]; then
    return 1
  fi
  if process_start=$(
    LC_ALL=C date -j -f '%a %b %e %T %Y' "$started_at" '+%s' 2>/dev/null
  ) || process_start=$(
    LC_ALL=C date -d "$started_at" '+%s' 2>/dev/null
  ); then
    [[ "$process_start" =~ ^[0-9]+$ ]] || return 1
    printf 'ps:%s\n' "$process_start"
    return 0
  fi
  return 1
}

ralph_read_state_lock_owner() {
  local owner_file="$RALPH_STATE_LOCK_DIR/owner.json"
  local owner_record

  if [[ ! -e "$owner_file" && ! -L "$owner_file" ]]; then
    return 3
  fi
  [[ -f "$owner_file" && ! -L "$owner_file" && -O "$owner_file" ]] ||
    return 2
  if ! owner_record=$(jq -er '
    if type == "object"
      and (.pid | type == "number")
      and (.pid > 0)
      and (.pid == (.pid | floor))
      and (.identity | type == "string")
      and (.identity | length > 0)
    then [(.pid | tostring), .identity] | @tsv
    else error("invalid lock owner")
    end
  ' "$owner_file" 2>/dev/null); then
    return 3
  fi

  RALPH_STATE_LOCK_READ_PID="${owner_record%%$'\t'*}"
  RALPH_STATE_LOCK_READ_IDENTITY="${owner_record#*$'\t'}"
  [[ "$RALPH_STATE_LOCK_READ_PID" =~ ^[1-9][0-9]*$ &&
    -n "$RALPH_STATE_LOCK_READ_IDENTITY" &&
    "$RALPH_STATE_LOCK_READ_IDENTITY" != "$owner_record" ]]
}

# Return 0 for the same live owner, 1 for a dead/reused owner, 2 when the
# owner cannot be authenticated safely, and 3 for an incomplete owner record.
ralph_state_lock_owner_status() {
  local current_identity
  local read_status

  if ralph_read_state_lock_owner; then
    :
  else
    read_status=$?
    [[ "$read_status" -eq 3 ]] && return 3
    return 2
  fi
  if ! kill -0 "$RALPH_STATE_LOCK_READ_PID" 2>/dev/null; then
    return 1
  fi
  if ! current_identity=$(
    ralph_process_identity "$RALPH_STATE_LOCK_READ_PID"
  ); then
    # A live process whose identity is temporarily unavailable is never stale.
    return 2
  fi
  [[ "$current_identity" = "$RALPH_STATE_LOCK_READ_IDENTITY" ]] && return 0
  return 1
}

# A process can be killed after mkdir publishes the lock but before owner.json
# is complete. Only recover that unauthenticated state after a grace period,
# and preserve a snapshot so an acquisition still being published is not
# mistaken for an abandoned lock.
ralph_capture_incomplete_state_lock() {
  local require_grace="$1"
  local owner_file="$RALPH_STATE_LOCK_DIR/owner.json"
  local lock_identity
  local lock_mtime
  local owner_identity
  local owner_mtime
  local owner_size
  local latest_mtime
  local now

  lock_identity=$(ralph_directory_identity "$RALPH_STATE_LOCK_DIR") ||
    return 1
  lock_mtime=$(ralph_path_mtime_epoch "$RALPH_STATE_LOCK_DIR") || return 1
  latest_mtime="$lock_mtime"

  if [[ ! -e "$owner_file" && ! -L "$owner_file" ]]; then
    RALPH_STATE_LOCK_INCOMPLETE_OWNER_SNAPSHOT="absent"
  elif [[ -f "$owner_file" && ! -L "$owner_file" && -O "$owner_file" ]]; then
    owner_identity=$(ralph_path_identity "$owner_file") || return 1
    owner_mtime=$(ralph_path_mtime_epoch "$owner_file") || return 1
    owner_size=$(ralph_path_size "$owner_file") || return 1
    if (( owner_mtime > latest_mtime )); then
      latest_mtime="$owner_mtime"
    fi
    RALPH_STATE_LOCK_INCOMPLETE_OWNER_SNAPSHOT="file:${owner_identity}:${owner_mtime}:${owner_size}"
  else
    # Do not remove redirects, foreign files, or unexpected file types.
    return 1
  fi

  if [[ "$require_grace" = true ]]; then
    now=$(date +%s) || return 1
    [[ "$now" =~ ^[0-9]+$ && "$now" -ge "$latest_mtime" ]] || return 1
    (( now - latest_mtime >= 2 )) || return 1
  fi
  RALPH_STATE_LOCK_INCOMPLETE_DIRECTORY_IDENTITY="$lock_identity"
}

ralph_choose_state_lock_archive_path() {
  local purpose="$1"
  local owner_pid="${BASHPID:-$$}"
  local attempt=0
  local candidate

  while (( attempt < 20 )); do
    candidate="${RALPH_STATE_LOCK_DIR}.${purpose}.${owner_pid}.${RANDOM}"
    if [[ ! -e "$candidate" && ! -L "$candidate" ]]; then
      RALPH_STATE_LOCK_ARCHIVE_DIR="$candidate"
      return 0
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

ralph_cleanup_state_lock_archive() {
  local archive_dir="$1"

  rm -f -- "$archive_dir/owner.json" 2>/dev/null || true
  rmdir -- "$archive_dir/.reclaim" 2>/dev/null || true
  rmdir -- "$archive_dir" 2>/dev/null || true
}

ralph_try_reclaim_stale_state_lock() {
  local owner_status
  local reclaim_dir="$RALPH_STATE_LOCK_DIR/.reclaim"
  local reclaim_mode
  local expected_lock_identity
  local expected_owner_snapshot
  local current_lock_identity

  if ralph_state_lock_owner_status; then
    owner_status=0
  else
    owner_status=$?
  fi
  case "$owner_status" in
    1)
      reclaim_mode="stale-owner"
      expected_lock_identity=$(ralph_directory_identity "$RALPH_STATE_LOCK_DIR") ||
        return 1
      ;;
    3)
      ralph_capture_incomplete_state_lock true || return 1
      reclaim_mode="incomplete-owner"
      expected_lock_identity="$RALPH_STATE_LOCK_INCOMPLETE_DIRECTORY_IDENTITY"
      expected_owner_snapshot="$RALPH_STATE_LOCK_INCOMPLETE_OWNER_SNAPSHOT"
      ;;
    *)
      return 1
      ;;
  esac

  # Only one waiter may reclaim a proven-stale directory. Recheck while holding
  # the claim so two waiters cannot remove a newly acquired lock.
  mkdir -m 700 -- "$reclaim_dir" 2>/dev/null || return 1
  if [[ "$reclaim_mode" = "incomplete-owner" ]]; then
    # Give an acquisition that was already writing owner.json one final chance
    # to publish it. The acquirer also waits for this marker before proceeding.
    sleep 0.05
  fi

  current_lock_identity=$(ralph_directory_identity "$RALPH_STATE_LOCK_DIR") ||
    current_lock_identity=""
  if [[ "$current_lock_identity" != "$expected_lock_identity" ]]; then
    rmdir -- "$reclaim_dir" 2>/dev/null || true
    return 1
  fi

  if ralph_state_lock_owner_status; then
    owner_status=0
  else
    owner_status=$?
  fi
  if [[ "$reclaim_mode" = "stale-owner" ]]; then
    if [[ "$owner_status" -ne 1 ]]; then
      rmdir -- "$reclaim_dir" 2>/dev/null || true
      return 1
    fi
  else
    if [[ "$owner_status" -ne 3 ]] ||
      ! ralph_capture_incomplete_state_lock false ||
      [[ "$RALPH_STATE_LOCK_INCOMPLETE_DIRECTORY_IDENTITY" != "$expected_lock_identity" ]] ||
      [[ "$RALPH_STATE_LOCK_INCOMPLETE_OWNER_SNAPSHOT" != "$expected_owner_snapshot" ]]; then
      rmdir -- "$reclaim_dir" 2>/dev/null || true
      return 1
    fi
  fi

  if ! ralph_choose_state_lock_archive_path stale; then
    rmdir -- "$reclaim_dir" 2>/dev/null || true
    return 1
  fi
  if ! mv -- "$RALPH_STATE_LOCK_DIR" "$RALPH_STATE_LOCK_ARCHIVE_DIR" \
    2>/dev/null; then
    rmdir -- "$reclaim_dir" 2>/dev/null || true
    return 1
  fi
  ralph_cleanup_state_lock_archive "$RALPH_STATE_LOCK_ARCHIVE_DIR"
  return 0
}

# Serialize all state transitions for one session. mkdir is an atomic operation
# on the state filesystem and is available on both macOS and Linux. The owner
# identity lets later invocations recover after SIGKILL without confusing a
# reused PID for the original process.
ralph_acquire_state_lock() {
  local session_id="$1"
  local attempt=0
  local owner_pid="${BASHPID:-$$}"
  local owner_identity
  local owner_file
  local owner_temp_file
  local created_lock_identity
  local current_lock_identity
  local publish_wait=0

  if ! owner_identity=$(ralph_process_identity "$owner_pid"); then
    RALPH_STATE_ERROR="could not identify the Ralph session lock owner"
    return 1
  fi

  RALPH_STATE_LOCK_DIR="$RALPH_STATE_DIR/.${session_id}.lock"
  while ! mkdir -m 700 -- "$RALPH_STATE_LOCK_DIR" 2>/dev/null; do
    if [[ -L "$RALPH_STATE_LOCK_DIR" || \
      ! -d "$RALPH_STATE_LOCK_DIR" || \
      ! -O "$RALPH_STATE_LOCK_DIR" ]]; then
      RALPH_STATE_ERROR="Ralph session lock path is unsafe"
      return 1
    fi
    if ralph_try_reclaim_stale_state_lock; then
      continue
    fi
    attempt=$((attempt + 1))
    if (( attempt >= 500 )); then
      RALPH_STATE_ERROR="timed out waiting for the active Ralph session operation"
      return 1
    fi
    sleep 0.01
  done

  created_lock_identity=$(ralph_directory_identity "$RALPH_STATE_LOCK_DIR") || {
    RALPH_STATE_ERROR="could not identify the new Ralph session lock"
    return 1
  }
  owner_file="$RALPH_STATE_LOCK_DIR/owner.json"
  owner_temp_file=$(mktemp "$RALPH_STATE_DIR/.${session_id}.owner.XXXXXX") || {
    RALPH_STATE_ERROR="could not prepare the Ralph session lock owner"
    return 1
  }
  if ! jq -n --argjson pid "$owner_pid" --arg identity "$owner_identity" \
    '{pid: $pid, identity: $identity}' > "$owner_temp_file" ||
    ! chmod 600 "$owner_temp_file" ||
    ! (
      cd -- "$RALPH_STATE_LOCK_DIR" 2>/dev/null || exit 1
      [[ "$(ralph_directory_identity .)" = "$created_lock_identity" ]] ||
        exit 1
      [[ ! -e owner.json && ! -L owner.json ]] || exit 1
      ln -- "$owner_temp_file" owner.json 2>/dev/null
    ); then
    rm -f -- "$owner_temp_file" 2>/dev/null || true
    RALPH_STATE_ERROR="could not record the Ralph session lock owner"
    return 1
  fi
  rm -f -- "$owner_temp_file" 2>/dev/null || true
  RALPH_STATE_LOCK_OWNER_PID="$owner_pid"
  RALPH_STATE_LOCK_OWNER_IDENTITY="$owner_identity"
  RALPH_STATE_LOCK_DIRECTORY_IDENTITY="$created_lock_identity"

  # An old-lock reclaimer may have observed this directory while owner.json was
  # still incomplete. Never enter the critical section until that recheck has
  # either stood down or atomically moved this particular directory away.
  while [[ -e "$RALPH_STATE_LOCK_DIR/.reclaim" ||
    -L "$RALPH_STATE_LOCK_DIR/.reclaim" ]]; do
    publish_wait=$((publish_wait + 1))
    if (( publish_wait >= 500 )); then
      RALPH_STATE_ERROR="timed out publishing the Ralph session lock owner"
      return 1
    fi
    sleep 0.01
  done
  current_lock_identity=$(ralph_directory_identity "$RALPH_STATE_LOCK_DIR") ||
    current_lock_identity=""
  if [[ "$current_lock_identity" != "$created_lock_identity" ]] ||
    ! ralph_read_state_lock_owner ||
    [[ "$RALPH_STATE_LOCK_READ_PID" != "$owner_pid" ]] ||
    [[ "$RALPH_STATE_LOCK_READ_IDENTITY" != "$owner_identity" ]]; then
    RALPH_STATE_LOCK_DIR=""
    RALPH_STATE_LOCK_OWNER_PID=""
    RALPH_STATE_LOCK_OWNER_IDENTITY=""
    RALPH_STATE_LOCK_DIRECTORY_IDENTITY=""
    RALPH_STATE_ERROR="lost the Ralph session lock while publishing its owner"
    return 1
  fi
}

ralph_release_state_lock() {
  local lock_dir="${RALPH_STATE_LOCK_DIR:-}"
  local archive_dir
  local current_lock_identity

  [[ -n "$lock_dir" ]] || return 0
  current_lock_identity=$(ralph_directory_identity "$lock_dir") ||
    current_lock_identity=""
  if [[ -d "$lock_dir" && ! -L "$lock_dir" && -O "$lock_dir" ]] &&
    [[ "$current_lock_identity" = "${RALPH_STATE_LOCK_DIRECTORY_IDENTITY:-}" ]] &&
    ralph_read_state_lock_owner &&
    [[ "$RALPH_STATE_LOCK_READ_PID" = "${RALPH_STATE_LOCK_OWNER_PID:-}" ]] &&
    [[ "$RALPH_STATE_LOCK_READ_IDENTITY" = "${RALPH_STATE_LOCK_OWNER_IDENTITY:-}" ]] &&
    ralph_choose_state_lock_archive_path released; then
    archive_dir="$RALPH_STATE_LOCK_ARCHIVE_DIR"
    if mv -- "$lock_dir" "$archive_dir" 2>/dev/null; then
      ralph_cleanup_state_lock_archive "$archive_dir"
    fi
  fi
  RALPH_STATE_LOCK_DIR=""
  RALPH_STATE_LOCK_OWNER_PID=""
  RALPH_STATE_LOCK_OWNER_IDENTITY=""
  RALPH_STATE_LOCK_DIRECTORY_IDENTITY=""
}
