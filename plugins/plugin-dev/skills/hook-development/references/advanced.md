# Advanced Hook Use Cases

This reference covers advanced hook patterns and techniques for sophisticated automation workflows.

## Multi-Stage Validation

Combine command and prompt hooks for layered validation:

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/quick-check.sh",
          "timeout": 5
        },
        {
          "type": "prompt",
          "prompt": "Analyze the Bash hook input in $ARGUMENTS. Return {\"ok\": true} when safe or {\"ok\": false, \"reason\": \"...\"} when unsafe.",
          "timeout": 15
        }
      ]
    }
  ]
}
```

**Use case:** Fast deterministic checks followed by intelligent analysis

**Example quick-check.sh:**
```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command')

# Immediate approval for safe commands
if [[ "$command" =~ ^(ls|pwd|echo|date|whoami)$ ]]; then
  exit 0
fi

# Let prompt hook handle complex cases
exit 0
```

The command hook quickly approves obviously safe commands, while the prompt hook analyzes everything else.

## Conditional Hook Execution

Execute hooks based on environment or context:

```bash
#!/bin/bash
# Only run in CI environment
if [ -z "$CI" ]; then
  echo '{"continue": true}' # Skip in non-CI
  exit 0
fi

# Run validation logic in CI
input=$(cat)
# ... validation code ...
```

**Use cases:**
- Different behavior in CI vs local development
- Project-specific validation
- User-specific rules

**Example: Skip certain checks for trusted users:**
```bash
#!/bin/bash
# Skip detailed checks for admin users
if [ "$USER" = "admin" ]; then
  exit 0
fi

# Full validation for other users
input=$(cat)
# ... validation code ...
```

## Hook Chaining via State

Hook processes have different process IDs, so use the input `session_id` as the
cross-process key. Save this helper as `scripts/hook-state.sh`:

```bash
#!/bin/bash
# hook-state.sh
set -euo pipefail
umask 077

fail() {
  echo "Hook state error: $*" >&2
  exit 2
}

if [ "$#" -ne 3 ]; then
  fail "usage: hook-state.sh <write|read|remove|increment|rate> <namespace> <session_id>"
fi

action="$1"
namespace="$2"
session_id="$3"

[[ "$namespace" =~ ^[a-z][a-z0-9-]{0,31}$ ]] || fail "invalid namespace"
[[ "$session_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || fail "invalid session_id"

state_root="${CLAUDE_HOOK_STATE_DIR:-${TMPDIR:-/tmp}/claude-hook-state-$(id -u)}"
[[ "$state_root" = /* ]] || fail "state directory must be absolute"
[[ ! -L "$state_root" ]] || fail "state directory must not be a symlink"
if [ -e "$state_root" ] && [ ! -d "$state_root" ]; then
  fail "state path is not a directory"
fi
if [ ! -d "$state_root" ]; then
  mkdir -m 700 "$state_root" || fail "cannot create state directory"
fi
[[ ! -L "$state_root" && -d "$state_root" && -O "$state_root" ]] ||
  fail "state directory must be owned by the current user"
chmod 700 "$state_root" || fail "cannot secure state directory"

state_file="$state_root/$session_id.$namespace.state"
temp_file=""
lock_dir=""
lock_owned=0

cleanup_runtime_files() {
  if [ -n "$temp_file" ]; then
    rm -f "$temp_file"
  fi
  if [ "$lock_owned" -eq 1 ]; then
    rmdir "$lock_dir" 2>/dev/null || true
  fi
}
trap cleanup_runtime_files EXIT
trap 'exit 2' HUP INT TERM

validate_state_file() {
  [[ ! -L "$state_file" ]] || fail "state file must not be a symlink"
  if [ -e "$state_file" ] && { [ ! -f "$state_file" ] || [ ! -O "$state_file" ]; }; then
    fail "state file must be a regular file owned by the current user"
  fi
}

atomic_write() {
  validate_state_file
  temp_file=$(mktemp "$state_root/.state.XXXXXX") || fail "cannot create state file"
  chmod 600 "$temp_file" || fail "cannot secure state file"
  cat > "$temp_file" || fail "cannot write state"
  mv -f "$temp_file" "$state_file" || fail "cannot publish state"
  temp_file=""
}

read_state() {
  validate_state_file
  [ -f "$state_file" ] || return 1
  cat "$state_file"
}

acquire_lock() {
  lock_dir="$state_file.lock"
  [[ ! -L "$lock_dir" ]] || fail "lock path must not be a symlink"
  attempts=0
  until mkdir -m 700 "$lock_dir" 2>/dev/null; do
    [[ ! -L "$lock_dir" ]] || fail "lock path must not be a symlink"
    attempts=$((attempts + 1))
    [ "$attempts" -lt 100 ] || fail "state lock timed out"
    sleep 0.02
  done
  lock_owned=1
}

validate_state_file
case "$action" in
  write)
    atomic_write
    ;;
  read)
    read_state || fail "state is missing"
    ;;
  remove)
    if [ -f "$state_file" ]; then
      rm -f "$state_file" || fail "cannot remove state"
    fi
    rmdir "$state_root" 2>/dev/null || true
    ;;
  increment)
    acquire_lock
    current=0
    if [ -e "$state_file" ]; then
      current=$(read_state) || fail "cannot read counter"
      [[ "$current" =~ ^[0-9]+$ ]] || fail "counter state is invalid"
    fi
    current=$((current + 1))
    printf '%s\n' "$current" | atomic_write
    printf '%s\n' "$current"
    ;;
  rate)
    limit="${HOOK_RATE_LIMIT:-10}"
    [[ "$limit" =~ ^[1-9][0-9]*$ ]] || fail "rate limit must be a positive integer"
    acquire_lock
    current_minute=$(date +%Y%m%d%H%M)
    previous_minute=""
    count=0
    if [ -e "$state_file" ]; then
      state=$(read_state) || fail "cannot read rate state"
      previous_minute=$(printf '%s\n' "$state" | sed -n '1p')
      count=$(printf '%s\n' "$state" | sed -n '2p')
      [[ "$previous_minute" =~ ^[0-9]{12}$ && "$count" =~ ^[0-9]+$ ]] ||
        fail "rate state is invalid"
    fi
    if [ "$previous_minute" != "$current_minute" ]; then
      count=0
    fi
    count=$((count + 1))
    printf '%s\n%s\n' "$current_minute" "$count" | atomic_write
    if [ "$count" -gt "$limit" ]; then
      echo "Rate limit exceeded" >&2
      exit 2
    fi
    ;;
  *)
    fail "unknown state action"
    ;;
esac
```

The producer validates stdin and writes a mode-`0600` state file atomically:

```bash
#!/bin/bash
# analyze-command.sh
set -euo pipefail

if ! input=$(jq -ce '
  if type == "object" and
     (.session_id | type) == "string" and
     (.tool_input | type) == "object" and
     (.tool_input.command | type) == "string"
  then . else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi

session_id=$(printf '%s\n' "$input" | jq -r '.session_id')
command=$(printf '%s\n' "$input" | jq -r '.tool_input.command')
case "$command" in
  "rm -rf "*|sudo\ *|*" > /dev/"*) risk_level="high" ;;
  *) risk_level="low" ;;
esac

plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }
printf '%s\n' "$risk_level" |
  bash "$plugin_root/scripts/hook-state.sh" write risk "$session_id"
```

The consumer runs in a separate process, reads the same session key, and removes
the state on every successful read:

```bash
#!/bin/bash
# enforce-risk.sh
set -euo pipefail

if ! input=$(jq -ce '
  if type == "object" and (.session_id | type) == "string"
  then . else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi

session_id=$(printf '%s\n' "$input" | jq -r '.session_id')
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }
state_helper="$plugin_root/scripts/hook-state.sh"

if ! risk_level=$(bash "$state_helper" read risk "$session_id"); then
  echo "Risk state is missing or invalid" >&2
  exit 2
fi
bash "$state_helper" remove risk "$session_id"

if [ "$risk_level" = "high" ]; then
  echo "High risk operation detected" >&2
  exit 2
fi
```

This pattern is only for sequential events. Hooks attached to the same event run
in parallel and must not depend on one another.

## Dynamic Hook Configuration

Modify hook behavior based on project configuration:

```bash
#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 1

# Read project-specific config
if [ -f ".claude-hooks-config.json" ]; then
  strict_mode=$(jq -r '.strict_mode' .claude-hooks-config.json)

  if [ "$strict_mode" = "true" ]; then
    # Apply strict validation
    # ...
  else
    # Apply lenient validation
    # ...
  fi
fi
```

**Example .claude-hooks-config.json:**
```json
{
  "strict_mode": true,
  "allowed_commands": ["ls", "pwd", "grep"],
  "forbidden_paths": ["/etc", "/sys"]
}
```

## Context-Aware Prompt Hooks

Use transcript and session context for intelligent decisions:

```json
{
  "Stop": [
    {
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Review the transcript in $ARGUMENTS. Check: 1) Were tests run after code changes? 2) Did the build succeed? 3) Were all user questions answered? 4) Is there unfinished work? Return {\"ok\": true} only when complete; otherwise return {\"ok\": false, \"reason\": \"...\"}."
        }
      ]
    }
  ]
}
```

The LLM can read the transcript file and make context-aware decisions.

## Performance Optimization

### Caching Validation Results

```bash
#!/bin/bash
set -euo pipefail
umask 077

fail() {
  echo "Cache error: $1" >&2
  exit 2
}

input=$(cat)
file_path=$(printf '%s' "$input" | jq -er \
  '.tool_input.file_path | select(type == "string" and length > 0)') ||
  fail "tool_input.file_path must be a non-empty string"

cache_root="${CLAUDE_HOOK_CACHE_DIR:-${TMPDIR:-/tmp}/claude-hook-cache-$(id -u)}"
case "$cache_root" in
  /*) ;;
  *) fail "cache directory must be an absolute path" ;;
esac

if [ -L "$cache_root" ] || { [ -e "$cache_root" ] && [ ! -d "$cache_root" ]; }; then
  fail "cache directory must be a real directory"
fi
if [ ! -d "$cache_root" ]; then
  mkdir -m 700 -- "$cache_root" || fail "cannot create cache directory"
fi
[[ ! -L "$cache_root" && -d "$cache_root" && -O "$cache_root" ]] ||
  fail "cache directory must be owned by the current user"
chmod 700 "$cache_root" || fail "cannot secure cache directory"

if command -v sha256sum >/dev/null 2>&1; then
  cache_key=$(printf '%s' "$file_path" | sha256sum | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  cache_key=$(printf '%s' "$file_path" | shasum -a 256 | awk '{print $1}')
else
  fail "a SHA-256 utility is required"
fi
case "$cache_key" in
  ""|*[!0-9a-fA-F]*) fail "failed to calculate cache key" ;;
esac

cache_file="$cache_root/$cache_key"
if [ -L "$cache_file" ] || {
  [ -e "$cache_file" ] && { [ ! -f "$cache_file" ] || [ ! -O "$cache_file" ]; }
}; then
  fail "cache entry must be a regular file owned by the current user"
fi

# Check cache
if [ -f "$cache_file" ]; then
  cache_mtime=$(stat -f %m -- "$cache_file" 2>/dev/null ||
    stat -c %Y -- "$cache_file" 2>/dev/null) || fail "cannot inspect cache entry"
  cache_age=$(($(date +%s) - cache_mtime))
  if [ "$cache_age" -ge 0 ] && [ "$cache_age" -lt 300 ]; then  # 5 minute cache
    cat -- "$cache_file"
    exit 0
  fi
fi

# Perform validation, atomically cache the successful result, and allow with no output.
temp_file=$(mktemp "$cache_root/.cache.XXXXXX") || fail "cannot create cache entry"
cleanup_cache_temp() {
  if [ -n "${temp_file:-}" ]; then
    rm -f -- "$temp_file"
  fi
}
trap cleanup_cache_temp EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
chmod 600 "$temp_file" || fail "cannot secure cache entry"
: > "$temp_file"
mv -f -- "$temp_file" "$cache_file" || fail "cannot publish cache entry"
temp_file=""
exit 0
```

The cache lives in a private, user-owned directory. Cache files are rejected if
they are symbolic links or are not regular files owned by the current user.

### Parallel Execution Optimization

Since hooks run in parallel, design them to be independent:

```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "bash check-size.sh",      // Independent
          "timeout": 2
        },
        {
          "type": "command",
          "command": "bash check-path.sh",      // Independent
          "timeout": 2
        },
        {
          "type": "prompt",
          "prompt": "Check content safety",     // Independent
          "timeout": 10
        }
      ]
    }
  ]
}
```

All three hooks run simultaneously, reducing total latency.

## Cross-Event Workflows

Coordinate hooks across different events:

**SessionStart - Set up tracking:**
```bash
#!/bin/bash
# session-start-tracking.sh
set -euo pipefail

if ! input=$(jq -ce '
  if type == "object" and (.session_id | type) == "string"
  then . else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi
session_id=$(printf '%s\n' "$input" | jq -r '.session_id')
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }
printf '0\n' |
  bash "$plugin_root/scripts/hook-state.sh" write test-count "$session_id"
```

**PostToolUse - Track events:**
```bash
#!/bin/bash
# track-test-run.sh
set -euo pipefail

if ! input=$(jq -ce '
  if type == "object" and
     (.session_id | type) == "string" and
     (.tool_name | type) == "string" and
     ((.tool_input // {}) | type) == "object" and
     ((.tool_input.command? // "") | type) == "string"
  then . else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi

session_id=$(printf '%s\n' "$input" | jq -r '.session_id')
tool_name=$(printf '%s\n' "$input" | jq -r '.tool_name')
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }

if [ "$tool_name" = "Bash" ]; then
  command=$(printf '%s\n' "$input" | jq -r '.tool_input.command // ""')
  if [[ "$command" == *"test"* ]]; then
    bash "$plugin_root/scripts/hook-state.sh" increment test-count "$session_id" >/dev/null
  fi
fi
```

**Stop - Verify based on tracking:**
```bash
#!/bin/bash
# verify-test-run.sh
set -euo pipefail

if ! input=$(jq -ce '
  if type == "object" and (.session_id | type) == "string"
  then . else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi
session_id=$(printf '%s\n' "$input" | jq -r '.session_id')
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }
state_helper="$plugin_root/scripts/hook-state.sh"

if ! test_count=$(bash "$state_helper" read test-count "$session_id"); then
  echo "Test tracking state is missing or invalid" >&2
  exit 2
fi
bash "$state_helper" remove test-count "$session_id"
[[ "$test_count" =~ ^[0-9]+$ ]] || { echo "Test count is invalid" >&2; exit 2; }

if [ "$test_count" -eq 0 ]; then
  echo "No tests were run" >&2
  exit 2
fi
```

Use a `SessionEnd` hook as a fallback cleanup when the normal consumer did not
run:

```bash
#!/bin/bash
# session-end-cleanup.sh
set -euo pipefail

if ! session_id=$(jq -er '
  if type == "object" and (.session_id | type) == "string"
  then .session_id else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }
bash "$plugin_root/scripts/hook-state.sh" remove test-count "$session_id"
bash "$plugin_root/scripts/hook-state.sh" remove command-rate "$session_id"
```

## Integration with External Systems

### Slack Notifications

```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')
decision="blocked"

# Send notification to Slack
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"Hook ${decision} ${tool_name} operation\"}" \
  2>/dev/null

echo "Operation denied by policy" >&2
exit 2
```

### Database Logging

```bash
#!/bin/bash
# database-logging.sh
set -euo pipefail

if ! input=$(jq -ce 'if type == "object" then . else error("invalid hook input") end' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi

psql "$DATABASE_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=hook_event=PreToolUse \
  --set=hook_data="$input" <<'SQL'
INSERT INTO hook_logs (event, data)
VALUES (:'hook_event', :'hook_data'::jsonb);
SQL

exit 0
```

`psql`'s `:'name'` form quotes each variable as an SQL literal. The hook JSON is
passed as one process argument and never concatenated into the SQL program.

### Metrics Collection

```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')

# Send metrics to monitoring system
echo "hook.pretooluse.${tool_name}:1|c" | nc -u -w1 statsd.local 8125

exit 0
```

## Security Patterns

### Rate Limiting

```bash
#!/bin/bash
# rate-limit-hook.sh
set -euo pipefail

if ! session_id=$(jq -er '
  if type == "object" and (.session_id | type) == "string"
  then .session_id else error("invalid hook input") end
' 2>/dev/null); then
  echo "Invalid hook input" >&2
  exit 2
fi
plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$plugin_root" ] || { echo "CLAUDE_PLUGIN_ROOT is required" >&2; exit 2; }

export HOOK_RATE_LIMIT=10
bash "$plugin_root/scripts/hook-state.sh" rate command-rate "$session_id"
```

The helper serializes concurrent updates with a mode-`0700` lock directory.
The `session-end-cleanup.sh` example above removes a remaining rate state.

### Audit Logging

```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')
timestamp=$(date -Iseconds)

# Append to audit log
echo "$timestamp | $USER | $tool_name | $input" >> ~/.claude/audit.log

exit 0
```

### Secret Detection

```bash
#!/bin/bash
input=$(cat)
content=$(echo "$input" | jq -r '.tool_input.content')

# Check for common secret patterns
if echo "$content" | grep -qE "(api[_-]?key|password|secret|token).{0,20}['\"]?[A-Za-z0-9]{20,}"; then
  echo "Potential secret detected in content" >&2
  exit 2
fi

exit 0
```

## Testing Advanced Hooks

### Unit Testing Hook Scripts

```bash
# test-hook.sh
#!/bin/bash

# Test 1: Approve safe command
result=$(echo '{"tool_input": {"command": "ls"}}' | bash validate-bash.sh)
if [ $? -eq 0 ]; then
  echo "✓ Test 1 passed"
else
  echo "✗ Test 1 failed"
fi

# Test 2: Block dangerous command
result=$(echo '{"tool_input": {"command": "rm -rf /"}}' | bash validate-bash.sh)
if [ $? -eq 2 ]; then
  echo "✓ Test 2 passed"
else
  echo "✗ Test 2 failed"
fi
```

### Integration Testing

Create test scenarios that exercise the full hook workflow:

```bash
# integration-test.sh
#!/bin/bash
set -euo pipefail

# Set up test environment
TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/hook-integration.XXXXXX")
cleanup() {
  case "${TEST_ROOT:-}" in
    ""|/)
      echo "Refusing to remove an unsafe test directory" >&2
      return 1
      ;;
  esac
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

export CLAUDE_PROJECT_DIR="$TEST_ROOT/project"
export CLAUDE_PLUGIN_ROOT="$(pwd)"
mkdir -p "$CLAUDE_PROJECT_DIR"

# Test SessionStart hook
echo '{}' | bash hooks/session-start.sh
if [ -f "$CLAUDE_PROJECT_DIR/session-initialized" ]; then
  echo "✓ SessionStart hook works"
else
  echo "✗ SessionStart hook failed"
  exit 1
fi
```

## Best Practices for Advanced Hooks

1. **Keep hooks independent**: Don't rely on execution order
2. **Use timeouts**: Set appropriate limits for each hook type
3. **Handle errors gracefully**: Provide clear error messages
4. **Document complexity**: Explain advanced patterns in README
5. **Test thoroughly**: Cover edge cases and failure modes
6. **Monitor performance**: Track hook execution time
7. **Version configuration**: Use version control for hook configs
8. **Provide escape hatches**: Allow users to bypass hooks when needed

## Common Pitfalls

### ❌ Assuming Hook Order

```bash
# BAD: Assumes hooks run in specific order
# Hook 1 saves state, Hook 2 reads it
# This can fail because hooks run in parallel!
```

### ❌ Long-Running Hooks

```bash
# BAD: Hook takes 2 minutes to run
sleep 120
# This will timeout and block the workflow
```

### ❌ Uncaught Exceptions

```bash
# BAD: Script crashes on unexpected input
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
cat "$file_path"  # Fails if file doesn't exist
```

### ✅ Proper Error Handling

```bash
# GOOD: Handles errors gracefully
file_path=$(echo "$input" | jq -r '.tool_input.file_path')
if [ ! -f "$file_path" ]; then
  echo '{"continue": true, "systemMessage": "File not found, skipping check"}'
  exit 0
fi
```

## Conclusion

Advanced hook patterns enable sophisticated automation while maintaining reliability and performance. Use these techniques when basic hooks are insufficient, but always prioritize simplicity and maintainability.
