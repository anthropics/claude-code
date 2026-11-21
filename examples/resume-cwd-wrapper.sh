#!/usr/bin/env zsh
# resume-cwd-wrapper.sh
#
# Workaround for https://github.com/anthropics/claude-code/issues/43202
#
# PROBLEM
# -------
# Sessions are stored at ~/.claude/projects/<ENCODED_CWD>/<session-id>.jsonl
# where ENCODED_CWD is the working directory at session start, with '/' replaced by '-'.
#
# When `claude --resume <id>` is called from a different directory (e.g. after
# a rename, or opening a new shell), Claude looks in the *current* directory's
# project folder, doesn't find the session, falls into the web-session code
# path, and throws a misleading authentication error instead of "session not found".
#
# FIX
# ---
# This shell function wraps the `claude` binary so that before resuming it:
#   1. Searches ~/.claude/projects/ across ALL project dirs for <session-id>.jsonl
#   2. Reads the original `cwd` recorded in the session's first JSONL entry
#   3. cd's to that directory so the project-path lookup succeeds
#
# USAGE
# -----
# Source this file in your shell config (~/.zshrc or ~/.bashrc):
#
#   source /path/to/resume-cwd-wrapper.sh
#
# Then use `claude --resume` as normal.

function claude() {
  local resume_idx=-1
  local session_id=""

  for i in {1..${#@}}; do
    local arg="${@[$i]}"
    if [[ "$arg" == "--resume" || "$arg" == "-r" ]]; then
      resume_idx=$i
      local next_idx=$((i + 1))
      if [[ $next_idx -le ${#@} && "${@[$next_idx]}" != -* ]]; then
        session_id="${@[$next_idx]}"
      fi
      break
    fi
  done

  if [[ -n "$session_id" ]]; then
    local session_file
    session_file=$(find ~/.claude/projects -name "${session_id}.jsonl" 2>/dev/null | head -1)

    if [[ -n "$session_file" ]]; then
      local session_cwd
      session_cwd=$(python3 - "$session_file" <<'EOF'
import json, sys
with open(sys.argv[1]) as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'cwd' in data:
                print(data['cwd'])
                break
        except Exception:
            pass
EOF
)
      if [[ -n "$session_cwd" && -d "$session_cwd" && "$session_cwd" != "$PWD" ]]; then
        echo "claude: resuming session from $session_cwd" >&2
        cd "$session_cwd"
      elif [[ -n "$session_cwd" && ! -d "$session_cwd" ]]; then
        echo "claude: warning: original session directory '$session_cwd' no longer exists" >&2
      fi
    fi
  fi

  command claude "$@"
}
