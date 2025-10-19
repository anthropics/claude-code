#!/usr/bin/env python3
import json, os, sys, shlex

BLOCK_RC = 2  # exit code to block tool

def eprint(*a):
    print(*a, file=sys.stderr)

def exists_any(paths):
    for p in paths:
        if p and os.path.exists(p):
            return True
    return False

def main():
    try:
        data = json.load(sys.stdin)
    except Exception as e:
        # If hook cannot parse input, do not block
        eprint(f"[auto-guard] input parse error: {e}")
        sys.exit(0)

    tool = data.get("tool_name", "")
    ti = data.get("tool_input", {}) or {}
    cwd = data.get("cwd") or os.getcwd()

    # Kill-switch: STOP_AUTORUN sentinel
    stop_sentinels = [
        os.path.join(cwd, "STOP_AUTORUN"),
        os.path.join(cwd, ".claude", "flags", "stop"),
    ]
    if exists_any(stop_sentinels):
        eprint("[auto-guard] STOP_AUTORUN detected. Blocking execution. Remove STOP_AUTORUN to continue.")
        sys.exit(BLOCK_RC)

    # Allow read-only tools to pass quickly
    if tool in ("Read", "Grep", "Glob"):
        sys.exit(0)

    # Allow Codex/Gemini invocations by default (still reviewed later)
    if tool == "Bash":
        cmd = ti.get("command", "")
        # Normalize
        lcmd = cmd.lower()

        # Allow codex/gemini invocations
        if lcmd.startswith("codex ") or lcmd.startswith("gemini "):
            sys.exit(0)

        # Sentinels
        allow_net = os.path.join(cwd, "ALLOW_NET")
        allow_install = os.path.join(cwd, "ALLOW_INSTALL")
        allow_destructive = os.path.join(cwd, "ALLOW_DESTRUCTIVE")

        # Network-ish commands
        net_markers = [
            " curl ", " wget ", " http", " https://", " apt ", " yum ", " brew ",
            " npm ", " pnpm ", " yarn ", " pip ", " uv pip", " docker ", " kubectl ",
        ]
        if any(m in lcmd for m in net_markers) and not os.path.exists(allow_net):
            eprint("[auto-guard] Network-like command blocked.")
            eprint("Create ALLOW_NET in repo root if this is intentional.")
            eprint(f"Command: {cmd}")
            sys.exit(BLOCK_RC)

        # Install/modify dev env commands
        install_markers = [
            " apt install", " yum install", " brew install", " npm install", " pnpm add", " yarn add ", " pip install", " uv pip install",
        ]
        if any(m in lcmd for m in install_markers) and not os.path.exists(allow_install):
            eprint("[auto-guard] Package/install command blocked.")
            eprint("Create ALLOW_INSTALL in repo root if this is intentional.")
            eprint(f"Command: {cmd}")
            sys.exit(BLOCK_RC)

        # Destructive operations
        destructive_markers = [" rm -rf ", " rm -r ", " sudo ", " chmod -r ", " chown -r "]
        if any(m in lcmd for m in destructive_markers) and not os.path.exists(allow_destructive):
            eprint("[auto-guard] Destructive command blocked.")
            eprint("Create ALLOW_DESTRUCTIVE in repo root if this is intentional.")
            eprint(f"Command: {cmd}")
            sys.exit(BLOCK_RC)

        # Otherwise allow
        sys.exit(0)

    # For Write/Edit, optionally guard paths outside workspace
    if tool in ("Write", "Edit", "MultiEdit"):
        # If input carries a path, ensure it's within cwd
        paths = []
        if isinstance(ti, dict):
            for k in ("path", "file_path", "filepath", "target"):
                v = ti.get(k)
                if isinstance(v, str):
                    paths.append(v)
        outside = []
        for p in paths:
            ap = os.path.abspath(os.path.join(cwd, p) if not os.path.isabs(p) else p)
            if not ap.startswith(os.path.abspath(cwd) + os.sep):
                outside.append(p)
        if outside:
            eprint("[auto-guard] Write/Edit outside workspace blocked:", ", ".join(outside))
            sys.exit(BLOCK_RC)
        sys.exit(0)

    # Default pass-through
    sys.exit(0)

if __name__ == "__main__":
    main()

