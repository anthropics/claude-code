#!/usr/bin/env bash
# patch-tmp-paths.sh — Fix hardcoded /tmp/claude paths for Termux/Android compatibility
#
# Claude Code hardcodes "/tmp" and "/tmp/claude" in multiple places within its
# bundled cli.js. On Termux (Android), /tmp is owned by shell:shell with 0771
# permissions, and non-root users cannot create directories there. Termux sets
# $TMPDIR to /data/data/com.termux/files/usr/tmp, but Claude Code ignores it.
#
# This script patches cli.js to use a dynamic TMPDIR resolution:
#   1. $CLAUDE_CODE_TMPDIR (explicit user override)
#   2. $TMPDIR / $TEMP / $TMP (platform environment variables)
#   3. /tmp (absolute last resort)
#
# This is the same priority chain that Node.js os.tmpdir() uses internally.
#
# Usage:
#   bash scripts/patch-tmp-paths.sh [path/to/cli.js]
#
# The script is idempotent — running it multiple times will not corrupt cli.js.
#
# Related issues:
#   https://github.com/anthropics/claude-code/issues/15628
#   https://github.com/anthropics/claude-code/issues/15637
#   https://github.com/anthropics/claude-code/issues/16955
#   https://github.com/anthropics/claude-code/issues/17366
#   https://github.com/anthropics/claude-code/issues/18342
#   https://github.com/anthropics/claude-code/issues/23634

set -euo pipefail

# Resolve cli.js path
if [ -n "${1:-}" ]; then
    CLI_JS="$1"
else
    # Try common locations
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "${SCRIPT_DIR}/../cli.js" ]; then
        CLI_JS="${SCRIPT_DIR}/../cli.js"
    elif [ -f "${SCRIPT_DIR}/../node_modules/@anthropic-ai/claude-code/cli.js" ]; then
        CLI_JS="${SCRIPT_DIR}/../node_modules/@anthropic-ai/claude-code/cli.js"
    else
        # Try to find it via npm
        NPM_ROOT="$(npm root -g 2>/dev/null || true)"
        if [ -n "$NPM_ROOT" ] && [ -f "$NPM_ROOT/@anthropic-ai/claude-code/cli.js" ]; then
            CLI_JS="$NPM_ROOT/@anthropic-ai/claude-code/cli.js"
        else
            echo "Error: cli.js not found. Provide the path as an argument:"
            echo "  $0 /path/to/cli.js"
            exit 1
        fi
    fi
fi

CLI_JS="$(cd "$(dirname "$CLI_JS")" && pwd)/$(basename "$CLI_JS")"

if [ ! -f "$CLI_JS" ]; then
    echo "Error: cli.js not found at $CLI_JS"
    exit 1
fi

echo "Patching: $CLI_JS"
echo ""

# We use Python for reliable literal string replacement (no regex escaping issues).
# Python is available on virtually all systems that can run Claude Code,
# including Termux (where it's a core package).
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo "Error: python3 or python is required but not found."
    echo "On Termux: pkg install python"
    exit 1
fi

PYTHON="$(command -v python3 || command -v python)"

# Define all patches as a Python script for reliable string replacement.
# Each patch is a (description, old, new) tuple.
"$PYTHON" - "$CLI_JS" << 'PYTHON_SCRIPT'
import sys

cli_js_path = sys.argv[1]

with open(cli_js_path, "r", encoding="utf-8") as f:
    content = f.read()

original = content

# Dynamic TMPDIR expression — mirrors Node.js os.tmpdir() internals.
TMPDIR = '(process.env.TMPDIR||process.env.TEMP||process.env.TMP||"/tmp")'

patches = [
    # =========================================================================
    # Patch 1: Main temp directory resolution (wE variable)
    # =========================================================================
    # The wE variable resolves the base temp directory for Claude Code's
    # working files (session data, scratchpads, etc.). It falls back to "/tmp"
    # on non-Windows instead of using os.tmpdir().
    (
        "Main temp dir resolution (wE)",
        'CLAUDE_CODE_TMPDIR||(c8()==="windows"?hIz():"/tmp")',
        f'CLAUDE_CODE_TMPDIR||(c8()==="windows"?hIz():{TMPDIR})',
    ),
    # =========================================================================
    # Patch 2: Sandbox TMPDIR environment variable (VY1 function)
    # =========================================================================
    # The VY1 function builds environment variables for the sandbox. It uses
    # CLAUDE_TMPDIR (note: different env var name!) with a /tmp/claude fallback.
    (
        "Sandbox TMPDIR env var (VY1)",
        'process.env.CLAUDE_TMPDIR||"/tmp/claude"',
        f'process.env.CLAUDE_TMPDIR||{TMPDIR}+"/claude"',
    ),
    # =========================================================================
    # Patch 3: Shell sandbox temp dir + screenshot path
    # =========================================================================
    # Multiple functions (LW1, ob4) use CLAUDE_CODE_TMPDIR with a "/tmp"
    # fallback. All instances should use the dynamic resolution.
    (
        "Shell sandbox temp dir (LW1) + screenshot path (ob4)",
        'process.env.CLAUDE_CODE_TMPDIR||"/tmp"',
        f"process.env.CLAUDE_CODE_TMPDIR||{TMPDIR}",
    ),
    # =========================================================================
    # Patch 4: MCP browser bridge socket directory (jd6 function)
    # =========================================================================
    # Creates a directory for MCP browser bridge Unix sockets. Hardcodes /tmp.
    (
        "MCP browser bridge dir (jd6)",
        "return`/tmp/claude-mcp-browser-bridge-",
        'return`${process.env.TMPDIR||process.env.TEMP||process.env.TMP||"/tmp"}/claude-mcp-browser-bridge-',
    ),
    # =========================================================================
    # Patch 5: MCP browser bridge fallback socket path (A_4 function)
    # =========================================================================
    # Lists possible socket paths with a hardcoded /tmp/${K} fallback.
    (
        "MCP browser bridge fallback (A_4)",
        "z=`/tmp/${K}`",
        'z=`${process.env.TMPDIR||process.env.TEMP||process.env.TMP||"/tmp"}/${K}`',
    ),
    # =========================================================================
    # Patch 6: Sandbox path allowlist ($x6 function)
    # =========================================================================
    # The sandbox allowlist must include the actual temp directory path so that
    # sandboxed processes can access their temp files.
    (
        "Sandbox path allowlist ($x6)",
        '"/tmp/claude","/private/tmp/claude"',
        f'"/tmp/claude","/private/tmp/claude",{TMPDIR}+"/claude"',
    ),
]

applied = 0
skipped_already = 0
skipped_missing = 0

for desc, old, new in patches:
    # Check for the new pattern first to handle cases where old is a
    # substring of new (e.g., the allowlist patch).
    if new in content:
        skipped_already += 1
        print(f"  [SKIP] {desc} — already patched")
    elif old in content:
        content = content.replace(old, new)
        if new in content:
            applied += 1
            print(f"  [OK]   {desc}")
        else:
            print(f"  [WARN] {desc} — replacement not verified")
    else:
        skipped_missing += 1
        print(f"  [SKIP] {desc} — pattern not found (cli.js version may differ)")

if content != original:
    with open(cli_js_path, "w", encoding="utf-8") as f:
        f.write(content)

print()
print("--- Summary ---")
print(f"Patches applied: {applied}")
print(f"Already patched: {skipped_already}")
if skipped_missing:
    print(f"Not found:       {skipped_missing}")
print()

if applied == 0:
    print("No changes were needed (already patched or different cli.js version).")
else:
    print(f"Successfully patched {applied} hardcoded /tmp path(s).")
    print()
    print("The patched cli.js now resolves temp directories dynamically:")
    print("  1. $CLAUDE_CODE_TMPDIR (if set)")
    print("  2. $TMPDIR / $TEMP / $TMP (platform default)")
    print("  3. /tmp (last resort fallback)")
PYTHON_SCRIPT
