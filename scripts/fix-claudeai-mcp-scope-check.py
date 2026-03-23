#!/usr/bin/env python3
"""
Fix for GitHub Issue #21874: Claude.ai MCPs not showing up on Claude Code

Root Cause:
  The claudeai MCP server loading function ($Y6 in minified code) performs a
  client-side check for the "user:mcp_servers" OAuth scope before attempting
  to fetch MCP servers from the API. When the GrowthBook feature flag
  "tengu_claudeai_mcp_connectors" evaluates to false for a user (based on
  their anonymousId), the OAuth server may not grant the "user:mcp_servers"
  scope. The client-side check then returns early with an empty object {},
  preventing any MCP servers from loading - even if the server would actually
  serve the request.

Fix:
  Remove the early return on missing "user:mcp_servers" scope. Instead, log a
  warning and proceed with the API fetch. If the server rejects the request
  (401/403), the existing catch block returns {} gracefully. If the server
  accepts the request (because the feature was enabled server-side despite the
  cached scope not reflecting it), the MCP servers load correctly.

  This is a safe change because:
  1. The server remains the authority on access control
  2. The catch block already handles fetch failures
  3. Stale cached scopes no longer block MCP server discovery

Usage:
  python3 scripts/fix-claudeai-mcp-scope-check.py [path-to-cli.js]

  If no path is provided, the script will attempt to locate cli.js from
  the installed Claude Code package.
"""

import os
import sys
import glob
import shutil

def find_cli_js():
    """Locate the installed cli.js file."""
    candidates = []

    # npm global install
    npm_global = os.path.expanduser("~/.npm/_npx/**/node_modules/@anthropic-ai/claude-code/cli.js")
    candidates.extend(glob.glob(npm_global, recursive=True))

    # npx cache
    npx_cache = os.path.expanduser("~/.npm/_npx/**/cli.js")
    candidates.extend(glob.glob(npx_cache, recursive=True))

    # Homebrew
    brew_path = "/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js"
    if os.path.exists(brew_path):
        candidates.append(brew_path)

    # Standard npm global on Linux
    linux_path = "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js"
    if os.path.exists(linux_path):
        candidates.append(linux_path)

    # Local node_modules
    local_path = os.path.join(os.getcwd(), "node_modules/@anthropic-ai/claude-code/cli.js")
    if os.path.exists(local_path):
        candidates.append(local_path)

    return candidates


def apply_patch(cli_js_path):
    """Apply the scope-check fix to cli.js."""

    if not os.path.exists(cli_js_path):
        print(f"ERROR: File not found: {cli_js_path}")
        return False

    with open(cli_js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # The old code: returns empty {} when user:mcp_servers scope is missing.
    # This prevents MCP servers from loading even if the server would allow it.
    old_text = (
        'if(!A.scopes?.includes("user:mcp_servers"))'
        "return V(`[claudeai-mcp] Missing user:mcp_servers scope "
        '(scopes=${A.scopes?.join(",")||"none"})`),'
        'Q("tengu_claudeai_mcp_eligibility",{state:"missing_scope"}),{};'
    )

    # The new code: logs warning but continues to attempt the API fetch.
    # If the server rejects, the existing catch block handles it.
    new_text = (
        'if(!A.scopes?.includes("user:mcp_servers"))'
        "V(`[claudeai-mcp] Missing user:mcp_servers scope "
        '(scopes=${A.scopes?.join(",")||"none"}), will attempt fetch`),'
        'Q("tengu_claudeai_mcp_eligibility",{state:"missing_scope_retry"});'
    )

    # Check if already patched
    if new_text in content:
        print("Already patched! No changes needed.")
        return True

    # Find and replace
    count = content.count(old_text)
    if count == 0:
        print("ERROR: Could not find the scope-check code to patch.")
        print("The installed version may be different from the expected version.")
        print("Expected pattern (first 80 chars):")
        print(f"  {old_text[:80]}...")
        return False
    elif count > 1:
        print(f"ERROR: Found {count} occurrences of the pattern (expected 1).")
        print("Aborting to avoid unintended changes.")
        return False

    # Create backup
    backup_path = cli_js_path + ".backup"
    if not os.path.exists(backup_path):
        shutil.copy2(cli_js_path, backup_path)
        print(f"Backup created: {backup_path}")

    # Apply patch
    patched = content.replace(old_text, new_text, 1)

    with open(cli_js_path, "w", encoding="utf-8") as f:
        f.write(patched)

    print(f"Patch applied successfully to: {cli_js_path}")
    print()
    print("What changed:")
    print("  BEFORE: Missing user:mcp_servers scope -> return {} (no MCP servers)")
    print("  AFTER:  Missing user:mcp_servers scope -> log warning, attempt fetch anyway")
    print()
    print("The server remains the authority on access control.")
    print("If the server rejects the request, no MCP servers will load (same as before).")
    print("If the server accepts, MCP servers will now load correctly.")
    return True


def main():
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if os.path.isfile(path):
            success = apply_patch(path)
            sys.exit(0 if success else 1)
        else:
            print(f"ERROR: {path} is not a file.")
            sys.exit(1)

    # Auto-discover cli.js
    candidates = find_cli_js()
    if not candidates:
        print("Could not auto-discover cli.js.")
        print()
        print("Usage: python3 fix-claudeai-mcp-scope-check.py <path-to-cli.js>")
        print()
        print("To find your cli.js, try:")
        print("  npm root -g  # then look for @anthropic-ai/claude-code/cli.js")
        print("  which claude # then trace the symlink")
        sys.exit(1)

    print(f"Found {len(candidates)} candidate(s):")
    for c in candidates:
        print(f"  {c}")
    print()

    for path in candidates:
        print(f"Patching: {path}")
        apply_patch(path)
        print()


if __name__ == "__main__":
    main()
