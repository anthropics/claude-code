#!/usr/bin/env bash
# Find a working Python 3 interpreter and exec the hook with it.
#
# On Windows + Git Bash, `python3` typically resolves to the Microsoft Store
# stub at C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\python3, which
# exits 49 silently in non-TTY subprocess context (a known Microsoft Store
# stub behavior). This shim
# probes each candidate with `-c ""` and skips any that fails, so the Store
# stub falls through to the real python.org install (`python` in Git Bash) or
# the `py -3` launcher.
#
# Order:
#   1. python3   — canonical on macOS/Linux; the Store stub fails the probe.
#   2. python    — python.org installs on Windows; some Linux distros (RHEL 7
#                  EOL'd 2024-06) point this at Python 2, but `-c ""` succeeds
#                  on Python 2 too — guard with a version check.
#   3. py -3     — Windows Python launcher.
#
# Args after the shim path are passed straight through to the chosen
# interpreter, so the hooks.json invocation is:
#   bash "${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh" \
#        "${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py"
set -e

probe() {
    # $1..N: the interpreter command (may be multi-word like `py -3`)
    # Probe writes the major version to stdout and exits 0 iff it's >=3.
    "$@" -c 'import sys; print(sys.version_info[0])' 2>/dev/null
}

for cmd in "python3" "python" "py -3"; do
    # Word-split intentionally so `py -3` works
    # shellcheck disable=SC2086
    v=$(probe $cmd) || continue
    if [ "$v" = "3" ]; then
        # shellcheck disable=SC2086
        exec $cmd "$@"
    fi
done

echo "security-guidance: no working Python 3 interpreter found." >&2
echo "  tried: python3, python, py -3" >&2
echo "  on Windows, install Python from https://python.org (NOT the Microsoft Store)" >&2
exit 1
