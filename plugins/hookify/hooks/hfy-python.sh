#!/usr/bin/env bash
# Find a working Python 3 interpreter and exec the hookify hook with it.
#
# On Windows + Git Bash, `python3` typically resolves to the Microsoft Store
# stub which exits 49 silently in non-TTY subprocess context. This shim probes
# each candidate and skips any that fails, so the Store stub falls through to
# the real python.org install or the `py -3` launcher.
#
# Order:
#   1. python3   — canonical on macOS/Linux
#   2. python    — python.org installs on Windows
#   3. py -3     — Windows Python launcher
#
# Args after the shim path are passed straight through to the chosen
# interpreter.
set -e

probe() {
    "$@" -c 'import sys; print(sys.version_info[0])' 2>/dev/null
}

for cmd in "python3" "python" "py -3"; do
    # shellcheck disable=SC2086
    v=$(probe $cmd | tr -d '\r') || continue
    if [ "$v" = "3" ]; then
        # shellcheck disable=SC2086
        exec $cmd "$@"
    fi
done

echo "hookify: no working Python 3 interpreter found." >&2
echo "  tried: python3, python, py -3" >&2
echo "  on Windows, install Python from https://python.org (NOT the Microsoft Store)" >&2
exit 1
