import os
import re
import shlex
import subprocess
import time

from gitutil import GIT_CMD, _git_toplevel
from session_state import with_locked_state


RES_NONE = 0
RES_CWD = 1
RES_COMMAND = 2
RES_SHA_SCAN = 3
RES_TOUCHED_PATHS = 4
RES_HINT = 5

COMMIT_SUBCOMMANDS = {("git", "commit"), ("gt", "create"), ("gt", "modify")}
PUSH_SUBCOMMANDS = {("git", "push"), ("gt", "submit")}

SCAN_SKIP_DIRS = {
    "node_modules", ".venv", "venv", "__pycache__", ".tox", "dist",
    "build", "target", ".cache", ".git", "vendor", "site-packages",
}
SCAN_MAX_DEPTH = int(os.environ.get("SG_REPO_SCAN_MAX_DEPTH", "3"))
SCAN_MAX_REPOS = int(os.environ.get("SG_REPO_SCAN_MAX_REPOS", "64"))
SCAN_BUDGET_S = float(os.environ.get("SG_REPO_SCAN_BUDGET_S", "4"))

_SEPARATORS = frozenset(";&|()\n")
_SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")
_ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
_PREFIX_WORDS = frozenset(("env", "time", "exec", "command", "nohup"))


def _abs(base, p):
    try:
        p = os.path.expanduser(p)
        if not os.path.isabs(p):
            p = os.path.join(base or os.getcwd(), p)
        return os.path.normpath(p)
    except (TypeError, ValueError, OSError):
        return None


def _is_sep(tok):
    return bool(tok) and set(tok) <= _SEPARATORS


def _tokenize(command):
    if os.sep == "\\":
        command = command.replace("\\", "\\\\")
    try:
        lex = shlex.shlex(command, posix=True, punctuation_chars=";&|()")
        lex.whitespace_split = True
        return list(lex)
    except ValueError:
        try:
            return command.replace("&&", " && ").replace(";", " ; ").split()
        except Exception:
            return []


def dirs_from_command(command, cwd, subcommands=None):
    if not isinstance(command, str) or not command.strip():
        return []
    tokens = _tokenize(command)
    out = []
    cur = cwd or ""
    i = 0
    n = len(tokens)
    at_start = True
    while i < n:
        t = tokens[i]
        if _is_sep(t):
            at_start = True
            i += 1
            continue
        if at_start and (_ENV_ASSIGN_RE.match(t) or t in _PREFIX_WORDS):
            i += 1
            continue
        if at_start and t in ("cd", "pushd"):
            if i + 1 < n and not _is_sep(tokens[i + 1]) and tokens[i + 1] not in ("-",) \
                    and not tokens[i + 1].startswith("-"):
                nxt = _abs(cur, tokens[i + 1])
                if nxt:
                    cur = nxt
                i += 2
            else:
                i += 1
            at_start = False
            continue
        prog = os.path.basename(t) if t else t
        if at_start and prog in ("git", "gt"):
            j = i + 1
            cdir = cur
            gdir = None
            wtree = None
            if prog == "git":
                while j < n and not _is_sep(tokens[j]):
                    a = tokens[j]
                    if a == "-C" and j + 1 < n:
                        cdir = _abs(cdir, tokens[j + 1]) or cdir
                        j += 2
                        continue
                    if a == "-c" and j + 1 < n:
                        j += 2
                        continue
                    if a.startswith("--git-dir="):
                        gdir = _abs(cdir, a.split("=", 1)[1])
                        j += 1
                        continue
                    if a == "--git-dir" and j + 1 < n:
                        gdir = _abs(cdir, tokens[j + 1])
                        j += 2
                        continue
                    if a.startswith("--work-tree="):
                        wtree = _abs(cdir, a.split("=", 1)[1])
                        j += 1
                        continue
                    if a == "--work-tree" and j + 1 < n:
                        wtree = _abs(cdir, tokens[j + 1])
                        j += 2
                        continue
                    if a.startswith("-"):
                        j += 1
                        continue
                    break
            sub = tokens[j] if j < n and not _is_sep(tokens[j]) else None
            if subcommands is None or (prog, sub) in subcommands:
                cand = wtree
                if not cand and gdir:
                    cand = os.path.dirname(gdir) if os.path.basename(gdir) == ".git" else gdir
                if not cand:
                    cand = cdir
                if cand:
                    out.append(cand)
            i = j + 1 if j < n else j
            at_start = False
            continue
        at_start = False
        i += 1
    return list(dict.fromkeys(d for d in out if d))


def toplevel_from_command(command, cwd, subcommands=None, cwd_root=None):
    cwd_abs = _abs(None, cwd) if cwd else None
    for d in dirs_from_command(command, cwd, subcommands):
        if cwd_root and d == cwd_abs:
            return cwd_root
        try:
            if os.path.isdir(d):
                top = _git_toplevel(d)
                if top:
                    return top
        except OSError:
            continue
    return None


def scan_roots(cwd):
    roots = []
    for r in (cwd, os.environ.get("CLAUDE_PROJECT_DIR")):
        if r and os.path.isdir(r):
            a = os.path.abspath(r)
            if a not in roots:
                roots.append(a)
    return roots


def iter_git_repos(roots, max_depth=None, max_repos=None, deadline=None):
    max_depth = SCAN_MAX_DEPTH if max_depth is None else max_depth
    max_repos = SCAN_MAX_REPOS if max_repos is None else max_repos
    seen = set()
    for root in roots or []:
        try:
            if not root or not os.path.isdir(root):
                continue
            root = os.path.abspath(root)
        except OSError:
            continue
        base_depth = root.rstrip(os.sep).count(os.sep)
        for dirpath, dirnames, filenames in os.walk(root):
            if deadline is not None and time.monotonic() > deadline:
                return
            if ".git" in dirnames or ".git" in filenames:
                try:
                    key = os.path.realpath(dirpath)
                except OSError:
                    key = dirpath
                if key not in seen:
                    seen.add(key)
                    yield dirpath
                    if len(seen) >= max_repos:
                        return
            depth = dirpath.rstrip(os.sep).count(os.sep) - base_depth
            if depth >= max_depth:
                dirnames[:] = []
            else:
                dirnames[:] = [
                    d for d in dirnames
                    if d not in SCAN_SKIP_DIRS and not d.startswith(".")
                ]


def repo_containing_commit(sha, roots, budget_s=None):
    if not isinstance(sha, str) or not _SHA_RE.match(sha):
        return None
    budget_s = SCAN_BUDGET_S if budget_s is None else budget_s
    deadline = time.monotonic() + budget_s
    for repo in iter_git_repos(roots, deadline=deadline):
        try:
            r = subprocess.run(
                [*GIT_CMD, "cat-file", "-e", f"{sha}^{{commit}}"],
                cwd=repo, capture_output=True, timeout=3,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            continue
        if r.returncode == 0:
            return _git_toplevel(repo) or repo
    return None


def repos_from_paths(paths, cwd=None, limit=200):
    counts = {}
    order = []
    cache = {}
    for p in list(paths or [])[:limit]:
        if not isinstance(p, str) or not p:
            continue
        ap = p if os.path.isabs(p) else _abs(cwd, p)
        if not ap:
            continue
        d = os.path.dirname(ap)
        while d and not os.path.isdir(d):
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent
        if not d:
            continue
        if d in cache:
            top = cache[d]
        else:
            try:
                top = _git_toplevel(d) if os.path.isdir(d) else None
            except OSError:
                top = None
            cache[d] = top
        if top:
            if top not in counts:
                order.append(top)
            counts[top] = counts.get(top, 0) + 1
    return sorted(order, key=lambda t: (-counts[t], order.index(t)))


def save_repo_hint(session_id, repo_root):
    if not session_id or not repo_root:
        return

    def _save(state):
        state["repo_root_hint"] = repo_root
    try:
        with_locked_state(session_id, _save)
    except Exception:
        pass


def load_repo_hint(session_id):
    if not session_id:
        return None
    try:
        hint = with_locked_state(session_id, lambda s: s.get("repo_root_hint"))
    except Exception:
        return None
    if isinstance(hint, str) and hint and os.path.isdir(hint):
        top = _git_toplevel(hint)
        if top:
            return top
    return None


_UNSET = object()


def resolve_repo_root(cwd, command=None, subcommands=None, sha=None,
                      touched_paths=None, session_id=None, cwd_root=_UNSET):
    if cwd_root is _UNSET:
        cwd_root = _git_toplevel(cwd) if cwd else None
    if command:
        top = toplevel_from_command(command, cwd, subcommands, cwd_root)
        if top and top != cwd_root:
            return top, RES_COMMAND
    if cwd_root:
        return cwd_root, RES_CWD
    if touched_paths:
        tops = repos_from_paths(touched_paths, cwd)
        if tops:
            return tops[0], RES_TOUCHED_PATHS
    if sha:
        top = repo_containing_commit(sha, scan_roots(cwd))
        if top:
            return top, RES_SHA_SCAN
    hint = load_repo_hint(session_id)
    if hint:
        return hint, RES_HINT
    return None, RES_NONE
