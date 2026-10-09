"""Paths the security reviewer must not see.

Two sources, one answer:

1. The session's own ``Read`` deny/ask permission rules, read from the same
   settings files Claude Code loads (managed, user, project, project-local).
   The main session enforces these, but the review prompt is assembled here
   from ``git diff`` and the reviewer's SDK sub-agents run with
   ``setting_sources=[]``, so neither knew about them.
2. A built-in list of well-known secret-file names (``.env``, private keys,
   credential stores). On by default; ``SG_SKIP_SECRET_FILES=0`` opts out.

``is_excluded()`` drops such files from every review diff (via
``gitutil._is_reviewable_source``) and ``subagent_disallowed_tools()`` hands
the same rules to the SDK sub-agents as ``disallowed_tools`` so they cannot
``Read``/``Grep``/``Glob`` them, nor reach them through a shell.

Not covered: rules that only exist in MDM/registry policy, server-managed
settings, or the parent's ``--settings``/``--disallowedTools`` flags — a hook
subprocess cannot see those. The README says so.
"""

import fnmatch
import json
import os
import re
import sys
from typing import List, Optional, Pattern, Tuple

from _base import debug_log

# Basename globs (case-insensitive) for files whose purpose is to hold
# credentials. Deliberately conservative: names that are secret stores by
# convention, not names that merely sound sensitive. Users extend this with
# ordinary `Read(...)` deny rules.
SECRET_BASENAME_GLOBS = (
    ".env", ".env.*", "*.env", ".envrc",
    "*.pem", "*.key", "*.p12", "*.pfx", "*.jks", "*.keystore", "*.ppk", "*.kdbx",
    "id_rsa*", "id_dsa*", "id_ecdsa*", "id_ed25519*",
    ".netrc", "_netrc", ".pgpass", ".git-credentials", ".npmrc", ".pypirc",
    ".htpasswd", "credentials", "kubeconfig",
)
# `secrets.yaml` / `credentials.json` style stores. Restricted to data
# extensions so `secrets.py` / `credentials.ts` (code that HANDLES secrets —
# exactly what the reviewer should read) stay reviewable.
_SECRET_STEMS = ("secret", "secrets", "credential", "credentials")
_DATA_EXTS = (
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".env",
    ".properties", ".xml", ".txt",
)

# Shell tools reach file contents without consulting Read(...) rules — their
# read-only commands (`cat`, `git show HEAD:path`) are auto-approved — and the
# reviewer needs none of them.
_SHELL_TOOLS = ["Bash"] + (["PowerShell"] if sys.platform == "win32" else [])
_READ_TOOLS = ("Read", "Grep", "Glob")
_RULE_RE = re.compile(r"^\s*([A-Za-z_][\w-]*)\s*(?:\((.*)\))?\s*$", re.DOTALL)

# Session state: load_for_session() only records the cwd; the settings files
# are read on first use so hook events that never review (per-edit pattern
# checks) pay nothing.
_cwd: Optional[str] = None
_loaded = False
# (kind, root, pattern, compiled). kind "cwd": root-less rule, relative to the
# session cwd (also tried against the repo toplevel, where diff paths live);
# "project": `/x`, anchored at `root`; "abs": `//x` or `~/x`, anchored at `root`.
_rules: List[Tuple[str, str, str, Optional[Pattern[str]]]] = []
_forward: List[str] = []  # rule strings for the sub-agent, `/x` made absolute
_deny_all_reads = False
_project_dir: Optional[str] = None
_toplevel: Optional[str] = None
_reported = set()  # paths already named in the debug log


def skip_secret_files_enabled() -> bool:
    return os.environ.get("SG_SKIP_SECRET_FILES", "1").strip().lower() not in ("0", "off", "false", "no")


def load_for_session(cwd: Optional[str]) -> None:
    """Point the module at this hook invocation's cwd; rules load lazily."""
    global _cwd, _loaded, _rules, _forward, _deny_all_reads, _project_dir, _toplevel
    _cwd = _norm_abs(cwd) if cwd else None
    _loaded, _rules, _forward, _deny_all_reads = False, [], [], False
    _project_dir = _toplevel = None


def is_excluded(file_path: str) -> bool:
    """True if the reviewer must not see this file: a well-known secret file
    (unless opted out) or one the session's Read deny/ask rules cover.
    `file_path` is repo-toplevel-relative (as `git diff` prints it) or absolute.
    Each withheld path is named once in the debug log, so a rule that hides
    code from review is at least visible there."""
    reason = _exclusion_reason(file_path)
    if reason and file_path not in _reported:
        _reported.add(file_path)
        debug_log(f"secretpaths: withheld from review ({reason}): {file_path}")
    return reason is not None


def subagent_disallowed_tools(context_dir: str) -> List[str]:
    """`disallowed_tools` for an SDK sub-agent rooted at `context_dir`: the
    shell tools, the session's Read/Grep/Glob deny+ask rules, and the
    secret-file globs.

    The sub-agent anchors root-less and `/x` patterns at its own cwd, which
    can differ from the session cwd and project dir (a git toplevel above
    them, or an alternate checkout), so those rules are also sent as absolute
    copies for every root they should cover."""
    _ensure_loaded()
    out = _SHELL_TOOLS + _forward
    context = _norm_abs(context_dir)
    session_cwd = _cwd or _project_dir
    for kind, root, pattern, _rx in _rules:
        if kind == "cwd":  # verbatim copy already covers `context` itself
            roots = {session_cwd, _mirrored(session_cwd, context)} - {context}
        elif kind == "project":  # _forward already covers the project dir
            roots = {_mirrored(root, context)} - {root}
        else:
            continue
        out.extend(f"Read(/{r}/{pattern})" for r in sorted(x for x in roots if x))
    if skip_secret_files_enabled():
        out.extend(f"Read({g})" for g in SECRET_BASENAME_GLOBS)
        out.extend(f"Read({stem}{ext})" for stem in _SECRET_STEMS for ext in _DATA_EXTS)
    return list(dict.fromkeys(out))


def no_file_tools() -> List[str]:
    """`disallowed_tools` for a sub-agent that must not touch the filesystem at all."""
    return _SHELL_TOOLS + list(_READ_TOOLS)


# ── internals ───────────────────────────────────────────────────────────────


def _exclusion_reason(file_path: str) -> Optional[str]:
    if skip_secret_files_enabled() and _is_secret_basename(os.path.basename(file_path)):
        return "well-known secret file"
    _ensure_loaded()
    if _deny_all_reads:
        return "Read denied"
    if not _rules:
        return None
    abs_path = _norm_abs(file_path if os.path.isabs(file_path) else os.path.join(_toplevel or os.getcwd(), file_path))
    for kind, root, _pattern, rx in _rules:
        if rx is None:
            continue
        for base in ({_cwd or _norm_abs(os.getcwd()), _toplevel} if kind == "cwd" else {root}):
            if not base:
                continue
            if not _outside(abs_path, base) and rx.match(os.path.relpath(abs_path, base).replace(os.sep, "/")):
                return "Read deny/ask rule"
    return None


def _is_secret_basename(base: str) -> bool:
    low = base.lower()
    if any(fnmatch.fnmatchcase(low, g) for g in SECRET_BASENAME_GLOBS):
        return True
    stem, ext = os.path.splitext(low)
    return stem in _SECRET_STEMS and ext in _DATA_EXTS


def _ensure_loaded() -> None:
    """Read Read/Grep/Glob deny+ask rules from every settings file the parent
    session loads. A malformed file is debug-logged and skipped (Claude Code
    does not enforce rules from a file it cannot parse either); any other
    failure hides every file from the reviewer rather than risk showing it a
    denied one."""
    global _loaded, _deny_all_reads
    if _loaded:
        return
    _loaded = True
    try:
        seen = set()
        for path, anchor in _settings_files():
            try:
                # utf-8-sig: Claude Code strips a BOM before parsing, so must we.
                with open(path, encoding="utf-8-sig") as f:
                    data = json.load(f)
            except OSError:
                continue
            except ValueError as e:
                debug_log(f"secretpaths: cannot parse {path}: {e}")
                continue
            perms = data.get("permissions") if isinstance(data, dict) else None
            if not isinstance(perms, dict):
                continue
            # `ask` means "a human decides" — there is no human in the review
            # sub-agent, so it counts as a deny there.
            for key in ("deny", "ask"):
                rules = perms.get(key)
                for rule in rules if isinstance(rules, list) else []:
                    if isinstance(rule, str) and (rule, anchor) not in seen:
                        seen.add((rule, anchor))
                        _add_rule(rule, anchor)
    except Exception as e:
        debug_log(f"secretpaths: failed to load permission rules ({e}); excluding all files")
        _deny_all_reads = True
    if _rules or _deny_all_reads:
        debug_log(f"secretpaths: {len(_rules)} Read deny/ask pattern(s) loaded"
                  + (" (+ deny-all Read)" if _deny_all_reads else ""))


def _settings_files() -> List[Tuple[str, str]]:
    """(settings file, anchor dir for its `/`-prefixed patterns) — the files
    Claude Code itself loads: managed (+ drop-ins), user, the project dir's
    settings.json / settings.local.json, and settings.local.json at the
    canonical repo root (where Claude Code keeps it for linked worktrees).
    Managed, project and local rules anchor at the project dir, user rules
    at the config dir."""
    global _project_dir, _toplevel
    from gitutil import _git_dir, _git_toplevel  # gitutil imports this module

    config_dir = _norm_abs(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude"))
    _project_dir = _norm_abs(os.environ.get("CLAUDE_PROJECT_DIR") or _cwd or os.getcwd())
    top = _git_toplevel(_cwd or _project_dir)
    _toplevel = _norm_abs(top) if top else (_cwd or _project_dir)
    canonical = None
    if top:
        common = _git_dir(top)
        if common and os.path.basename(os.path.normpath(common)) == ".git":
            canonical = _norm_abs(os.path.dirname(os.path.normpath(common)))
    managed = _managed_settings_dir()
    files = [(os.path.join(managed, "managed-settings.json"), _project_dir)]
    try:
        dropins = sorted(os.listdir(os.path.join(managed, "managed-settings.d")))
    except OSError:
        dropins = []
    files.extend((os.path.join(managed, "managed-settings.d", n), _project_dir)
                 for n in dropins if n.endswith(".json"))
    files.append((os.path.join(config_dir, "settings.json"), config_dir))
    files.append((os.path.join(_project_dir, ".claude", "settings.json"), _project_dir))
    files.append((os.path.join(_project_dir, ".claude", "settings.local.json"), _project_dir))
    if canonical and canonical != _project_dir:
        files.append((os.path.join(canonical, ".claude", "settings.local.json"), _project_dir))
    return files


def _mirrored(directory: Optional[str], context: str) -> Optional[str]:
    """`directory`'s counterpart inside the checkout rooted at `context` (the
    sub-agent's cwd): itself when the sub-agent runs inside this repo, else
    the same toplevel-relative location under `context`."""
    if not directory or not _toplevel or not _outside(context, _toplevel):
        return directory
    rel = os.path.relpath(directory, _toplevel)
    return None if _outside(directory, _toplevel) else _norm_abs(os.path.join(context, rel))


def _outside(path: str, root: str) -> bool:
    try:
        rel = os.path.relpath(path, root)
    except ValueError:  # different Windows drive
        return True
    return rel == ".." or rel.startswith(".." + os.sep)


def _managed_settings_dir() -> str:
    if sys.platform == "darwin":
        return "/Library/Application Support/ClaudeCode"
    if sys.platform == "win32":
        return r"C:\Program Files\ClaudeCode"
    return "/etc/claude-code"


def _norm_abs(path: str) -> str:
    """Absolute path; on Windows in the `/c/Users/...` form Claude Code
    matches against, so rules and paths compare in one notation."""
    p = os.path.abspath(path)
    if os.name == "nt":
        p = p.replace("\\", "/")
        if re.match(r"^[A-Za-z]:", p):
            p = "/" + p[0].lower() + p[2:]
    return p


def _add_rule(rule: str, anchor: str) -> None:
    global _deny_all_reads
    m = _RULE_RE.match(rule)
    if not m or m.group(1) not in _READ_TOOLS:
        return
    tool, pattern = m.group(1), (m.group(2) or "").strip()
    if not pattern:
        # Bare `Read` denies every read; bare `Grep`/`Glob` only remove a tool.
        if tool == "Read":
            _deny_all_reads = True
        _forward.append(tool)
        return
    if tool != "Read":
        # Grep(...)/Glob(...) content rules are not path rules; forward as-is.
        _forward.append(rule.strip())
        return
    # Same prefix conventions as Claude Code's patternWithRootFor.
    if os.name == "nt" and re.match(r"^(~\\|\\(?![!#]))", pattern):
        pattern = pattern.replace("\\", "/")
    if os.name == "nt" and re.match(r"^[A-Za-z]:[/\\]", pattern):
        pattern = "//" + pattern[0].lower() + pattern[2:].replace("\\", "/")
    if pattern.startswith("//"):
        kind, root, rel = "abs", "/", pattern[2:]
        if os.name == "nt" and re.match(r"^[A-Za-z]/", rel):
            root, rel = "/" + rel[0].lower(), rel[2:]
    elif pattern.startswith("~/"):
        kind, root, rel = "abs", _norm_abs(os.path.expanduser("~")), pattern[2:]
    elif pattern.startswith("/"):
        kind, root, rel = "project", anchor, pattern[1:]
        rule = f"Read(/{anchor}/{rel})"
    else:
        kind, root, rel = "cwd", "", (pattern[2:] if pattern.startswith("./") else pattern)
    # All three prefixed forms stay anchored at their root, as in Claude Code.
    _rules.append((kind, root, rel, _compile(rel if kind == "cwd" else "/" + rel)))
    _forward.append(rule.strip())


def _compile(pattern: str) -> Optional[Pattern[str]]:
    """gitignore-style pattern → regex over a root-relative POSIX path.
    Approximates the `ignore` matcher Claude Code uses; where it differs it
    errs toward matching (excluding) more: negations are skipped, directory
    patterns also match a same-named file, and — as Claude Code itself does
    for deny rules — a trailing `/**` is dropped, so `dir/**` means `dir` at
    any depth."""
    p = pattern.strip()
    if p.startswith("!") or p.startswith("#"):
        return None
    if p.endswith("/**"):
        p = p[:-3]
    p = p.rstrip("/")
    if p.startswith("\\"):
        p = p[1:]
    anchored = "/" in p
    p = p.lstrip("/")
    if not p:
        return None  # `./`, `/`, `~/`: matches nothing, as in Claude Code
    if p == "**":
        return re.compile("")  # everything under the root
    out, i = "", 0
    while i < len(p):
        c = p[i]
        if p.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif p.startswith("**", i):
            out += ".*"
            i += 2
        elif c == "*":
            out += "[^/]*"
            i += 1
        elif c == "?":
            out += "[^/]"
            i += 1
        elif c == "[":
            j = p.find("]", i + 2)
            if j == -1:
                out += re.escape(c)
                i += 1
            else:
                body = p[i + 1:j]
                if body.startswith("!"):
                    body = "^" + body[1:]
                out += "[" + body.replace("\\", "\\\\") + "]"
                i = j + 1
        elif c == "\\" and i + 1 < len(p):
            out += re.escape(p[i + 1])
            i += 2
        else:
            out += re.escape(c)
            i += 1
    prefix = "^" if anchored else "^(?:.*/)?"
    try:
        return re.compile(prefix + out + "(?:/.*)?$", re.IGNORECASE)
    except re.error:
        debug_log(f"secretpaths: unusable pattern {pattern!r}; treating as match-all")
        return re.compile("")
