#!/usr/bin/env bash
# Regression tests for plugins/security-guidance/hooks/sg-python.sh
#
# Covers anthropics/claude-code issue #86709: probe stderr was discarded, so
# when every Python candidate failed the shim reported a generic
# "no working Python 3 interpreter found" and hid the real reason (a broken
# pyenv shim, the Microsoft Store stub, a missing `py` launcher, a transient
# fork failure, ...).
#
# These tests drive the shim with fake interpreters on a synthetic PATH and
# assert on the exit code and the stdout/stderr split. The suite never invokes
# a real Python interpreter, so it behaves identically whether or not the host
# machine has Python installed.
#
# Usage: bash plugins/security-guidance/tests/test-sg-python.sh
set -u

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHIM="$SELF_DIR/../hooks/sg-python.sh"

FAKE_BIN="$(mktemp -d)"
T7_TMP="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$T7_TMP"' EXIT

pass=0
fail=0

# fake <name> <body-lines...> — writes a verbatim shell body into $FAKE_BIN/<name>
fake() {
    local name=$1
    local f="$FAKE_BIN/$name"
    shift
    {
        echo '#!/bin/sh'
        printf '%s\n' "$@"
    } > "$f"
    chmod +x "$f"
}

# reset_bin — drop all fake interpreters so each test starts from a known state
reset_bin() {
    rm -f "$FAKE_BIN"/*
}

# run <extra-env> <path> <args...> — runs the shim, captures RC/OUT/ERR
run() {
    local extra_env=$1 path=$2
    shift 2
    : > "$FAKE_BIN/run.out"
    : > "$FAKE_BIN/run.err"
    if [ -n "$extra_env" ]; then
        env "$extra_env" PATH="$path" bash "$SHIM" "$@" > "$FAKE_BIN/run.out" 2> "$FAKE_BIN/run.err"
    else
        env PATH="$path" bash "$SHIM" "$@" > "$FAKE_BIN/run.out" 2> "$FAKE_BIN/run.err"
    fi
    RC=$?
    OUT="$(cat "$FAKE_BIN/run.out")"
    ERR="$(cat "$FAKE_BIN/run.err")"
}

ok() { pass=$((pass + 1)); echo "ok   - $1"; }
bad() { fail=$((fail + 1)); echo "FAIL - $1"; }

assert_rc()       { [ "$RC" -eq "$1" ] && ok "$2" || { bad "$2 (rc=$RC, want $1)"; } ; }
assert_out()      { printf '%s' "$OUT" | grep -Fq -- "$1" && ok "$2" || { bad "$2 (missing: $1)"; }; }
assert_err()      { printf '%s' "$ERR" | grep -Fq -- "$1" && ok "$2" || { bad "$2 (missing in stderr: $1)"; }; }
assert_no_err()   { printf '%s' "$ERR" | grep -Fq -- "$1" && { bad "$2 (unexpected in stderr: $1)"; } || ok "$2"; }

###
# T1 — every candidate fails: stderr from each probe is surfaced.
###
reset_bin
fake python3 'echo "pyenv: version 3.12.1 is not installed" >&2' 'exit 1'
fake python  'echo "simulated Store-stub failure" >&2' 'exit 49'
fake py      'echo "py launcher failed" >&2' 'exit 1'
run "" "$FAKE_BIN:/usr/bin:/bin" -c 'print("unreachable")'
assert_rc 1 "T1: exits 1 when every candidate fails"
assert_err "no working Python 3 interpreter found" "T1: generic message present"
assert_err "probe errors:" "T1: probe-errors section header present"
assert_err "pyenv: version 3.12.1 is not installed" "T1: python3 probe error surfaced"
assert_err "simulated Store-stub failure" "T1: python probe error surfaced"
assert_err "py launcher failed" "T1: py probe error surfaced"

###
# T2 — first candidate fails, second succeeds: failure stays hidden, shim falls back.
###
reset_bin
fake python3 'echo "bad pyenv" >&2' 'exit 1'
fake python  'if [ "$2" = "import sys; print(sys.version_info[0])" ]; then echo 3; else echo "received:$*"; fi'
run "" "$FAKE_BIN:/usr/bin:/bin" -c 'print("ran via python")'
assert_rc 0 "T2: falls back to python and succeeds"
assert_out 'received:-c print("ran via python")' "T2: python receives the payload"
assert_no_err "bad pyenv" "T2: earlier probe failure stays hidden on fallback"
assert_no_err "probe errors:" "T2: no probe-errors section on successful fallback"

###
# T3 — Python 2 candidate is rejected, not selected.
###
reset_bin
fake python3 'exit 1'
fake python  'echo 2'
run "" "$FAKE_BIN:/usr/bin:/bin" -c 'print("must-not-run")'
assert_rc 1 "T3: exits 1 when only python2 is present"
assert_err "no working Python 3 interpreter found" "T3: generic message present"
assert_no_err "must-not-run" "T3: payload never executed"

###
# T4 — multi-word `py -3` candidate still resolves after a `python3`/`python` failure.
###
reset_bin
fake python3 'exit 1'
fake python  'exit 1'
fake py      'if [ "$3" = "import sys; print(sys.version_info[0])" ]; then echo 3; else echo "received:$*"; fi'
run "" "$FAKE_BIN:/usr/bin:/bin" -c 'print("ran via py -3")'
assert_rc 0 "T4: py -3 launcher works"
assert_out 'received:-3 -c print("ran via py -3")' "T4: py -3 receives the payload"

###
# T5 — arguments passed to the shim reach the selected interpreter verbatim.
###
reset_bin
fake python3 'if [ "$2" = "import sys; print(sys.version_info[0])" ]; then echo 3; else printf "<%s>\n" "$@"; fi'
run "" "$FAKE_BIN:/usr/bin:/bin" -c 'print("argv:", sys.argv[1:])' hello "two words"
assert_rc 0 "T5: first candidate (python3) selected"
assert_out "<hello>" "T5: plain arg passed verbatim"
assert_out "<two words>" "T5: space-containing arg passed verbatim as one argument"

###
# T6 — diagnostics are best-effort: with TMPDIR unusable, mktemp fails but the
# shim must still find and exec a working interpreter (no crash from set -e).
###
reset_bin
fake python3 'if [ "$2" = "import sys; print(sys.version_info[0])" ]; then echo 3; else echo "still works"; fi'
run "TMPDIR=/nonexistent-sgtest-dir" "$FAKE_BIN:/usr/bin:/bin" -c 'print("still works")'
assert_rc 0 "T6: interpreter selection works when mktemp fails"
assert_out "still works" "T6: payload executes despite missing diagnostics"
reset_bin
fake python3 'echo "no tmp for errors" >&2' 'exit 1'
fake python  'echo "no tmp for errors" >&2' 'exit 1'
fake py      'echo "no tmp for errors" >&2' 'exit 1'
run "TMPDIR=/nonexistent-sgtest-dir" "$FAKE_BIN:/usr/bin:/bin" -c 'print("unreachable")'
assert_rc 1 "T6b: all-fail path still reports failure without a temp file"
assert_err "no working Python 3 interpreter found" "T6b: generic message present"
assert_no_err "unreachable" "T6b: payload never executed"

###
# T7 - no temp files leak: shim temp logs land in $T7_TMP (via TMPDIR), an
# isolated dir owned by this test, so the count is immune to unrelated
# activity in the shared /tmp.
###
before="$(ls "$T7_TMP"/tmp.* 2>/dev/null | wc -l)"
reset_bin
fake python3 'exit 1'
fake python  'exit 1'
fake py      'exit 1'
run "TMPDIR=$T7_TMP" "$FAKE_BIN:/usr/bin:/bin" -c 'print("unreachable")'
reset_bin
fake python3 'if [ "$2" = "import sys; print(sys.version_info[0])" ]; then echo 3; else echo "ok"; fi'
run "TMPDIR=$T7_TMP" "$FAKE_BIN:/usr/bin:/bin" -c 'print("ok")'
after="$(ls "$T7_TMP"/tmp.* 2>/dev/null | wc -l)"
[ "$before" = "$after" ] && ok "T7: no temp files leaked (before=$before after=$after)" \
                        || bad "T7: temp files leaked (before=$before after=$after)"

echo
echo "passed: $pass, failed: $fail"
[ "$fail" -eq 0 ] || exit 1
