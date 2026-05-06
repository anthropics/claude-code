#!/usr/bin/env bash
# Patch the installed Claude Code npm package to enable the PowerShell tool
# on macOS and Linux (where pwsh is available), not just Windows.
#
# Related issue: https://github.com/anthropics/claude-code/issues/45963
#
# Root cause: OE6() in cli.js hard-codes an early return on non-Windows,
# preventing the PowerShell tool from being registered even when pwsh is
# installed and CLAUDE_CODE_USE_POWERSHELL_TOOL=1 is set.
#
# After patching, add to ~/.claude/settings.json:
#   { "env": { "CLAUDE_CODE_USE_POWERSHELL_TOOL": "1" } }
# and ensure pwsh is on PATH (e.g. `brew install powershell` on macOS).

set -euo pipefail

CLI_JS="$(npm root -g)/@anthropic-ai/claude-code/cli.js"

if [[ ! -f "$CLI_JS" ]]; then
  echo "Error: could not find $CLI_JS" >&2
  echo "Make sure Claude Code is installed globally via npm." >&2
  exit 1
fi

if ! command -v pwsh &>/dev/null; then
  echo "Warning: pwsh not found on PATH. Install PowerShell first." >&2
  echo "  macOS:  brew install powershell" >&2
  echo "  Linux:  https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux" >&2
fi

# Back up original
if [[ ! -f "${CLI_JS}.orig" ]]; then
  cp "$CLI_JS" "${CLI_JS}.orig"
  echo "Backup saved to ${CLI_JS}.orig"
fi

python3 - "$CLI_JS" <<'PYEOF'
import sys, re

path = sys.argv[1]
with open(path) as f:
    content = f.read()

# Fix 1: Remove the windows-only gate from OE6()
# Before: function OE6(){if(k1()!=="windows")return!1;return B6(process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL)}
# After:  function OE6(){return B6(process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL)}
old1 = 'function OE6(){if(k1()!=="windows")return!1;return B6(process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL)}'
new1 = 'function OE6(){return B6(process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL)}'

if old1 not in content:
    print("Fix 1 pattern not found — already patched or version mismatch.")
else:
    content = content.replace(old1, new1, 1)
    print("Fix 1 applied: removed windows-only gate from OE6()")

# Fix 2: Remove windows-only check from onboarding hint so macOS/Linux users
# also see the CLAUDE_CODE_USE_POWERSHELL_TOOL=1 suggestion.
old2 = 'isRelevant:async()=>k1()==="windows"&&process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL===void 0'
new2 = 'isRelevant:async()=>process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL===void 0'

if old2 not in content:
    print("Fix 2 pattern not found — already patched or version mismatch.")
else:
    content = content.replace(old2, new2, 1)
    print("Fix 2 applied: removed windows-only filter from onboarding hint")

with open(path, 'w') as f:
    f.write(content)

print("Done.")
PYEOF

echo ""
echo "Patch complete. To activate:"
echo "  1. Add to ~/.claude/settings.json:"
echo '     { "env": { "CLAUDE_CODE_USE_POWERSHELL_TOOL": "1" } }'
echo "  2. Restart Claude Code."
