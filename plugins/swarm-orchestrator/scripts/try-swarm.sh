#!/usr/bin/env bash
#
# Canonical end-to-end demo for claude-swarm.
#
# Creates a venv inside the repo (./.swarm-venv/), installs claude-swarm,
# bootstraps a real working swarm with a small DAG of tasks, then launches
# the live TUI dashboard so you can watch the supervisor work through them.
# Terminates cleanly when all tasks complete (or when you Ctrl-C).
#
# Usage:
#   bash scripts/try-swarm.sh           # real claude-swarm agents, asks for $1 auth
#   bash scripts/try-swarm.sh --stub    # stub conductor, $0, smoke-test mode
#
# At the end the script points to a "global-mind" JSONL transcript — every
# task claim, dispatch, completion, and cost increment, in order, replayable.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${REPO_ROOT}/.swarm-venv"
DEMO_HOME=""
CONDUCTOR="claude"
ESTIMATED_USD="1.00"
KEEPALIVE=false

for arg in "$@"; do
    case "$arg" in
        --stub) CONDUCTOR="stub"; ESTIMATED_USD="0.00" ;;
        --keepalive) KEEPALIVE=true ;;
        --help|-h)
            sed -n '2,16p' "$0"
            exit 0
            ;;
    esac
done

cleanup() {
    if [[ "${KEEPALIVE_CLEANUP_SKIP:-false}" == "true" ]]; then
        # Keepalive mode: daemon owns the home, do NOT delete it.
        return
    fi
    if [[ -n "${DEMO_HOME}" && -d "${DEMO_HOME}" ]]; then
        echo
        echo "→ Cleaning up demo state at ${DEMO_HOME}"
        rm -rf "${DEMO_HOME}"
    fi
}
trap cleanup EXIT

cat <<EOF
================================================================
  claude-swarm — autonomous, DAG-aware multi-agent orchestration
================================================================

  Agents that will spawn (role-typed heads):
    • scanner/Scanner         — read-only; finds work, files tasks
    • builder/Builder         — full toolkit; the default worker
    • test-runner/Test-Runner — read + pytest; gates merges
    • reviewer/Reviewer       — read-only; periodic checkpoints
    • merger/Merger           — Bash + git only; runs merge pipeline

  DAG of 5 linked tasks (Scanner → Builder → {Reviewer, Test-Runner} → Merger):
    1. Scan codebase + file follow-up tasks      (Scanner)
    2. Refactor utils.py for type hints          (Builder,    blocked-by 1)
    3. Review the build                          (Reviewer,   blocked-by 2)
    4. Write tests for refactored utils.py       (Test-Runner, blocked-by 2)
    5. Merge clean branches                      (Merger,     blocked-by 3,4)

  Conductor:        ${CONDUCTOR}
  Mode:             $([[ "$KEEPALIVE" == "true" ]] && echo "KEEPALIVE — supervisor runs as a detached daemon; survives CLI exit" || echo "shell-background — supervisor tied to this script's lifetime")
  Parallel:         3 tasks dispatched concurrently — 3 heads transition to
                    in_progress within ~1 second of supervisor start
  Estimated cost:   \$${ESTIMATED_USD} (Anthropic API)
  Wall-clock time:  $([[ "$CONDUCTOR" == "claude" ]] && echo "<30 seconds (5 one-word Haiku tasks, max 3 in parallel)" || echo "~20 seconds (stub with 5s demo-delay, 3 in parallel)")
  Self-healing:     abort-marker contract, dead-teammate respawn from last commit,
                    bounded inbox queue, stuck-task watchdog (re-dispatches > 30 min).
  Global mind:      every dispatch + cost increment appended to a JSONL transcript;
                    path printed at exit.

EOF

if [[ "$CONDUCTOR" == "claude" ]]; then
    # ────────────────────────────────────────────────────────────────
    # Preflight 1: ensure 'claude' CLI is installed
    # ────────────────────────────────────────────────────────────────
    if ! command -v claude >/dev/null 2>&1; then
        cat <<'EOF'

  ✗  The 'claude' CLI is not on PATH.

     This demo dispatches work via 'claude --print' (a real Claude Code
     subprocess that runs the dispatched task). You'll need it installed.

     Install:  https://docs.claude.com/claude-code

     Or re-run with --stub for the no-LLM smoke test.

EOF
        exit 1
    fi

    # ────────────────────────────────────────────────────────────────
    # Preflight 2: ensure 'claude --print' has working credentials
    # ────────────────────────────────────────────────────────────────
    # 'claude' resolves auth in this priority order:
    #   1. ANTHROPIC_API_KEY env var
    #   2. apiKeyHelper from --settings (or ~/.claude/settings.json)
    #   3. macOS Keychain ("Claude Code-credentials" service) — set by
    #      running `claude` interactively and completing the OAuth login
    #      (Pro/Max/Team plans store tokens here)
    #
    # We probe with a tiny Haiku call. Failure → guide the user, don't
    # silently start a 5-task demo that produces empty results.
    echo "→ Verifying claude CLI authentication (one tiny Haiku ping)..."
    AUTH_TEST=$(perl -e 'alarm 30; exec @ARGV' claude --print --model claude-haiku-4-5 <<< "respond with the single word OK" 2>&1 | head -1)
    if [[ "$AUTH_TEST" != *"OK"* ]] && [[ "$AUTH_TEST" != *"ok"* ]]; then
        cat <<'EOF'

  ✗  'claude --print' did not return a valid response. Probable cause:
     missing or invalid credentials.

     Output from probe:
EOF
        echo "       ${AUTH_TEST}"
        cat <<EOF

     Pick one of the following auth paths and re-run this script:

     ┌─────────────────────────────────────────────────────────────┐
     │ Option A — interactive login (Claude Pro / Max / Team plan) │
     └─────────────────────────────────────────────────────────────┘
        $ claude                  # opens browser, completes OAuth
        $ /exit                   # tokens persist in macOS Keychain
                                   # (service: "Claude Code-credentials")

     ┌──────────────────────────────────────────────────────────────┐
     │ Option B — API key (developer / CI / no Max plan)            │
     └──────────────────────────────────────────────────────────────┘
        # Get a key from https://console.anthropic.com/settings/keys
        export ANTHROPIC_API_KEY="sk-ant-..."
        # Then re-run this script.

     If you want to skip auth entirely, use --stub for the no-LLM mode:
        $ bash scripts/try-swarm.sh --stub

EOF
        exit 1
    fi
    echo "→ Auth probe OK — proceeding with real claude-swarm agents."
    echo

    # ────────────────────────────────────────────────────────────────
    # Preflight 3: explicit consent (the operator must opt in)
    # ────────────────────────────────────────────────────────────────
    cat <<'EOF'
  ⚠  This run uses real claude-swarm agents (via 'claude --print' for each task).
     The supervisor will spawn 5 subprocesses (one per role-typed head)
     against your authenticated Claude account. Re-run with --stub for
     a free smoke-test that uses no claude-swarm agents.

EOF
    read -r -p "Proceed with spawning real claude-swarm agents? [yes/no] " AUTH
    case "${AUTH}" in
        yes|YES|y|Y) echo "→ Confirmed — proceeding." ;;
        *) echo "→ Not confirmed — aborting (no dispatch happened)."; exit 0 ;;
    esac
    echo
fi

echo "→ Setting up venv at ${VENV_DIR}"
if [[ ! -d "${VENV_DIR}" ]]; then
    python3 -m venv "${VENV_DIR}"
fi
# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

echo "→ Installing claude-swarm + dashboard deps (quiet, always pulls fresh main)"
pip install --quiet --upgrade pip
# --force-reinstall on claude-swarm itself ensures we don't use a cached older
# version from a previous demo run (the pip URL stays the same across PR
# commits, so pip's default cache hit would silently use stale code missing
# the latest flags). We install WITH deps so click + sqlite + etc. land too.
pip install --quiet --upgrade --force-reinstall git+https://github.com/kushalj1997/claude-swarm.git@main
pip install --quiet rich

echo "→ Bootstrapping demo swarm"
if [[ "$KEEPALIVE" == "true" ]]; then
    # Stable home so daemon state survives the script's cleanup trap
    DEMO_HOME="${HOME}/.claude/swarm-demo"
    mkdir -p "$DEMO_HOME"
    KEEPALIVE_CLEANUP_SKIP=true
else
    DEMO_HOME="$(mktemp -d "${TMPDIR:-/tmp}/claude-swarm-demo-XXXXXX")"
    KEEPALIVE_CLEANUP_SKIP=false
fi
cd "${DEMO_HOME}"
git init --quiet
git config user.email "demo@example.com"
git config user.name "claude-swarm demo"
mkdir -p src
cat > src/utils.py <<'PYEOF'
def add(a, b):
    return a + b

def needs_typing(value, threshold):
    if value > threshold:
        return value * 2
    return value
PYEOF
git add src/utils.py
git commit --quiet -m "demo: seed source file"
claude-swarm init --home .claude-swarm

echo "→ Submitting demo tasks (DAG: scanner → builder → reviewer → test-runner → merger)"
# Each prompt asks for a one-word answer so real-LLM tasks finish in ~3-5s
# via claude --print --model claude-haiku-4-5. Total demo time is ~15-25s
# end-to-end. Reviewer runs in parallel with test-runner after builder
# completes (both review the build + run tests, then merger gates on both).
T1=$(claude-swarm submit \
    --title "Scanner ping" \
    --prompt "Respond with only the single word: SCANNED" \
    --head scanner | awk '{print $1}')
T2=$(claude-swarm submit \
    --title "Builder ping" \
    --prompt "Respond with only the single word: BUILT" \
    --head builder \
    --blocked-by "${T1}" | awk '{print $1}')
T3=$(claude-swarm submit \
    --title "Reviewer ping" \
    --prompt "Respond with only the single word: REVIEWED" \
    --head reviewer \
    --blocked-by "${T2}" | awk '{print $1}')
T4=$(claude-swarm submit \
    --title "Test-runner ping" \
    --prompt "Respond with only the single word: TESTED" \
    --head test-runner \
    --blocked-by "${T2}" | awk '{print $1}')
T5=$(claude-swarm submit \
    --title "Merger ping" \
    --prompt "Respond with only the single word: MERGED" \
    --head merger \
    --blocked-by "${T3}" --blocked-by "${T4}" | awk '{print $1}')

echo "  T1=${T1}  T2=${T2}  T3=${T3}  T4=${T4}  T5=${T5}"
echo
echo "spawning agents: scanner/Scanner, builder/Builder, test-runner/Test-Runner, reviewer/Reviewer, merger/Merger"
echo

GLOBAL_MIND_LOG="${DEMO_HOME}/global-mind.jsonl"

echo "→ Starting supervisor loop ($([[ "$KEEPALIVE" == "true" ]] && echo "DETACHED daemon" || echo "shell-background"), conductor=${CONDUCTOR})"
# Stub conductor finishes in <1ms per dispatch; inject an 8-second delay so the
# dashboard has time to render each head's status transition visibly. The real
# LLM conductor doesn't need this — Claude calls take 10-60s each on their own.
DEMO_DELAY_S=$([[ "$CONDUCTOR" == "stub" ]] && echo "8" || echo "0")

if [[ "$KEEPALIVE" == "true" ]]; then
    # Daemon mode: detached supervisor, survives this script's exit.
    claude-swarm run \
        --home .claude-swarm \
        --conductor "${CONDUCTOR}" \
        --demo-delay-s "${DEMO_DELAY_S}" \
        --global-mind-log "${GLOBAL_MIND_LOG}" \
        --max-parallel 3 \
        --daemon \
        >"${DEMO_HOME}/supervisor.log" 2>&1
    SUPERVISOR_PID=""
else
    # Shell-background: supervisor dies when this script exits. Parallel
    # dispatch (3 at a time) so the dashboard renders multiple in-progress
    # heads simultaneously — the "live" demo feel. No --max-iterations
    # cap — the supervisor exits on its own when the kanban drains.
    claude-swarm run \
        --home .claude-swarm \
        --conductor "${CONDUCTOR}" \
        --demo-delay-s "${DEMO_DELAY_S}" \
        --global-mind-log "${GLOBAL_MIND_LOG}" \
        --max-parallel 3 \
        >"${DEMO_HOME}/supervisor.log" 2>&1 &
    SUPERVISOR_PID=$!
fi

cleanup_pid() {
    if [[ -n "${SUPERVISOR_PID:-}" ]] && kill -0 "${SUPERVISOR_PID}" 2>/dev/null; then
        # Kill any 'claude --print' subprocesses the supervisor forked
        # (they're children of the supervisor; pkill -P gets them).
        pkill -TERM -P "${SUPERVISOR_PID}" 2>/dev/null || true
        # Then the supervisor itself
        kill -TERM "${SUPERVISOR_PID}" 2>/dev/null || true
        # Give it 2 seconds to exit cleanly, then SIGKILL if needed
        for _ in 1 2 3 4; do
            kill -0 "${SUPERVISOR_PID}" 2>/dev/null || break
            sleep 0.5
        done
        if kill -0 "${SUPERVISOR_PID}" 2>/dev/null; then
            pkill -KILL -P "${SUPERVISOR_PID}" 2>/dev/null || true
            kill -KILL "${SUPERVISOR_PID}" 2>/dev/null || true
        fi
    fi
    cleanup
}
# Trap SIGINT (Ctrl+C) + SIGTERM + normal EXIT so cleanup runs on every path
trap cleanup_pid EXIT INT TERM

# Give the supervisor a moment to start writing state
sleep 0.5

echo "→ Launching dashboard (Ctrl-C to exit; auto-exits when all tasks complete)"
echo
"${VENV_DIR}/bin/python3" "${REPO_ROOT}/scripts/swarm_dashboard.py" \
    --home "${DEMO_HOME}/.claude-swarm" \
    --exit-when-done \
    --max-runtime-s 1200

# Wait briefly for the supervisor to flush
wait "${SUPERVISOR_PID}" 2>/dev/null || true

echo
echo "================================================================"
echo "  Run complete. The swarm's global-mind transcript:"
echo "================================================================"
echo
echo "  Supervisor log:"
echo "    ${DEMO_HOME}/supervisor.log"
echo
echo "  Global-mind events (JSONL — every dispatch, status, cost increment):"
echo "    ${GLOBAL_MIND_LOG}"
echo
echo "  Kanban status timeline + cascade events:"
echo "    ${DEMO_HOME}/.claude-swarm/state/cascade-events.jsonl"
echo
if [[ -f "${GLOBAL_MIND_LOG}" ]]; then
    echo "  Sample events from the global mind:"
    head -3 "${GLOBAL_MIND_LOG}" | sed 's/^/    /'
    echo "    ..."
fi
echo
echo "  Replay the swarm's collective state with:"
echo "    cat ${GLOBAL_MIND_LOG} | jq ."
echo
if [[ "$KEEPALIVE" == "true" ]]; then
    echo "================================================================"
    echo "  KEEPALIVE DAEMON IS STILL RUNNING"
    echo "================================================================"
    echo
    echo "  The supervisor is detached from this script. You can:"
    echo "    - close this terminal"
    echo "    - exit Claude Code"
    echo "    - 'claude --resume' later"
    echo "  ...and the daemon keeps polling. Submit more tasks any time:"
    echo
    echo "    claude-swarm submit --home ${DEMO_HOME}/.claude-swarm \\"
    echo "        --title 'my-task' --prompt 'do something' --head builder"
    echo
    echo "  Status:"
    echo "    claude-swarm daemon-status --home ${DEMO_HOME}/.claude-swarm"
    echo
    echo "  Stop the daemon:"
    echo "    claude-swarm daemon-stop --home ${DEMO_HOME}/.claude-swarm"
    echo
fi
echo "Done. The venv at ${VENV_DIR} persists for re-runs; remove with:"
echo "    rm -rf ${VENV_DIR}"
