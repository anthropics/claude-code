#!/usr/bin/env python3
"""
Destructive Command Guard Hook for Claude Code

PreToolUse hook that:
- BLOCKS dangerous Bash commands (mass deletion, Docker mass ops, destructive git,
  indirect execution, alternative deletion tools, file modification via Bash)
- WARNS about edits to policy files (CLAUDE.md, .claude/settings.json, hooks.json)

Exit codes:
  0 - allow (or warn via JSON on stdout)
  2 - block (message on stderr)

Security model:
  Blocklist approach -- first line of defense against accidental destructive commands.
  Not a sandbox. Cannot prevent all obfuscation vectors, but catches common patterns.
"""

import json
import os
import random
import re
import sys
import tempfile
from datetime import datetime


# --- Konfiguracja ---

STATE_FILE_PREFIX = "destructive_guard_state_"
# Log w katalogu uzytkownika, nie w /tmp (ochrona przed symlink attacks)
CLAUDE_DIR = os.path.expanduser("~/.claude")
DEBUG_LOG_FILE = os.path.join(CLAUDE_DIR, "destructive-guard-log.txt")


def debug_log(message):
    """Zapis logu debugowego z timestampem do katalogu uzytkownika."""
    try:
        os.makedirs(CLAUDE_DIR, mode=0o700, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


# --- Session state ---


def _sanitize_session_id(session_id):
    """Walidacja session_id - zapobieganie path traversal (CWE-22)."""
    if not session_id or not re.match(r"^[a-zA-Z0-9_.-]+$", session_id):
        return "default_safe"
    return session_id


def get_state_file(session_id):
    """Sciezka do pliku stanu sesji (z sanityzacja)."""
    safe_id = _sanitize_session_id(session_id)
    return os.path.join(CLAUDE_DIR, f"{STATE_FILE_PREFIX}{safe_id}.json")


def cleanup_old_state_files():
    """Usuwa pliki stanu starsze niz 30 dni."""
    try:
        if not os.path.exists(CLAUDE_DIR):
            return
        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)
        for filename in os.listdir(CLAUDE_DIR):
            if filename.startswith(STATE_FILE_PREFIX) and filename.endswith(".json"):
                file_path = os.path.join(CLAUDE_DIR, filename)
                try:
                    if os.path.getmtime(file_path) < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass
    except Exception:
        pass


def load_state(session_id):
    """Wczytaj zbior juz wyswietlonych ostrzezen."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Atomowy zapis stanu (tempfile + os.replace, POSIX atomic)."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), mode=0o700, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(
            dir=os.path.dirname(state_file), suffix=".tmp", text=True
        )
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(list(shown_warnings), f)
            os.replace(tmp_path, state_file)
        except Exception:
            # Sprzatanie pliku tymczasowego w razie bledu
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except IOError:
        pass


# --- Parsery komend Bash ---


def _split_commands(command):
    """Rozdziela polecenie na czesci po &&, ;, | (uproszczony split).

    Nie obsluguje zagniezdzenych cudzyslow -- to ograniczenie blocklist approach.
    """
    parts = re.split(r"\s*(?:&&|;|\|)\s*", command)
    return [p.strip() for p in parts if p.strip()]


def _normalize_path(path):
    """Normalizacja sciezki -- lapie warianty /./  //  /../.. itp."""
    cleaned = path
    # Usun podwojne slashe
    while "//" in cleaned:
        cleaned = cleaned.replace("//", "/")
    # Usun /./ sekwencje
    while "/./" in cleaned:
        cleaned = cleaned.replace("/./", "/")
    # Jesli zawiera parent traversal (..) -- podejrzane
    if "/.." in cleaned or cleaned.startswith(".."):
        return "/"
    return cleaned.rstrip("/") or "/"


def _parse_rm_flags_and_targets(args_str):
    """Parsuje flagi i targety z argumentow rm.

    Obsluguje: -rf, -r -f, -rfv, --recursive --force, itp.
    Zwraca (flags: set, targets: list).
    """
    tokens = args_str.split()
    flags = set()
    targets = []
    end_of_flags = False
    for i, token in enumerate(tokens):
        if end_of_flags:
            targets.append(token)
            continue
        if token == "--":
            end_of_flags = True
            continue
        if token.startswith("--"):
            flag_name = token.lstrip("-")
            if flag_name == "recursive":
                flags.add("r")
            elif flag_name == "force":
                flags.add("f")
            else:
                flags.add(flag_name)
        elif token.startswith("-") and not token.startswith("--"):
            for char in token[1:]:
                flags.add(char)
        else:
            targets.append(token)
    return flags, targets


# Sciezki niebezpieczne dla rm -rf
_DANGEROUS_RM_TARGETS = {
    "/", "/*",
    "~", "~/", "~/*",
    "$HOME", "$HOME/", "$HOME/*",
    "${HOME}", "${HOME}/", "${HOME}/*",
    ".", "./", "./*",
    "..", "../", "../*",
    "*",
}

# Sciezki systemowe -- rowniez niebezpieczne dla rm -rf
_DANGEROUS_SYSTEM_PATHS = {
    "/etc", "/usr", "/var", "/home", "/opt", "/boot",
    "/bin", "/sbin", "/lib", "/lib64", "/srv", "/root",
    "/System", "/Applications", "/Library", "/Users",
}


def check_rm_dangerous(command):
    """Sprawdza czy komenda rm jest niebezpieczna.

    Blokuje: rm -rf /, ~, ., .., *, /etc, /usr, /var, /home, zmienne, subshells
    Przepuszcza: rm -rf node_modules, rm -rf /tmp/build, rm file.txt
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "rm":
            continue
        args_str = " ".join(tokens[1:])
        flags, targets = _parse_rm_flags_and_targets(args_str)

        has_recursive = "r" in flags or "R" in flags
        has_force = "f" in flags
        if not (has_recursive and has_force):
            continue

        # Sprawdz backticki w calym args_str (split rozbija je na wiele tokenow)
        if "`" in args_str:
            return (
                "BLOCKED: 'rm -rf' with backtick command substitution is not allowed. "
                "Specify the target path directly so it can be validated."
            )

        for target in targets:
            # Sprawdz command substitution / variable expansion
            if re.search(r"\$\(.*\)|`.*`", target):
                return (
                    "BLOCKED: 'rm -rf' with command substitution is not allowed. "
                    "Specify the target path directly so it can be validated."
                )
            if re.search(r"\$\{?\w+\}?", target) and target not in _DANGEROUS_RM_TARGETS:
                # Zmienna ktora nie jest na liscie znanych -- podejrzane
                return (
                    f"BLOCKED: 'rm -rf' with variable expansion ({target}) is not allowed. "
                    "Specify the target path directly so it can be validated."
                )

            # Normalizacja sciezki
            normalized = _normalize_path(target)
            raw_stripped = target.rstrip("/") or "/"

            # Sprawdz literalne niebezpieczne targety
            if (target in _DANGEROUS_RM_TARGETS
                    or raw_stripped in _DANGEROUS_RM_TARGETS
                    or normalized in _DANGEROUS_RM_TARGETS):
                return (
                    f"BLOCKED: 'rm -rf {target}' would cause irreversible data loss. "
                    f"This command targets a critical path ({target}). "
                    "If you need to remove specific files, use a more targeted command."
                )

            # Sprawdz sciezki systemowe
            if normalized in _DANGEROUS_SYSTEM_PATHS or raw_stripped in _DANGEROUS_SYSTEM_PATHS:
                return (
                    f"BLOCKED: 'rm -rf {target}' targets a critical system directory. "
                    "Removing system directories causes irreversible damage."
                )
            # Sprawdz czy target z /* jest sciezka systemowa
            if target.endswith("/*"):
                base = target[:-2].rstrip("/") or "/"
                if base in _DANGEROUS_SYSTEM_PATHS:
                    return (
                        f"BLOCKED: 'rm -rf {target}' targets contents of a critical system directory."
                    )

    return None


# --- Indirect execution / obfuscation ---


def check_indirect_execution(command):
    """Blokuje posrednie wykonanie komend (eval, sh -c, pipe do shell, base64).

    Zapobiega obejsciu guardu przez zawijanie komend w eval/sh/bash.
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens:
            continue

        cmd = tokens[0]

        # eval z argumentami
        if cmd == "eval" and len(tokens) > 1:
            return (
                "BLOCKED: 'eval' executes arbitrary strings as commands, bypassing safety checks. "
                "Run the command directly instead."
            )

        # sh -c / bash -c / zsh -c
        if cmd in ("sh", "bash", "zsh") and "-c" in tokens:
            return (
                f"BLOCKED: '{cmd} -c' executes arbitrary strings as commands, "
                "bypassing safety checks. Run the command directly instead."
            )

    # Pipe do shell: ... | sh, ... | bash, ... | zsh
    if re.search(r"\|\s*(?:sh|bash|zsh)\s*$", command):
        return (
            "BLOCKED: Piping output to a shell interpreter bypasses safety checks. "
            "Run the command directly instead."
        )

    # base64 decode piped do shell
    if re.search(r"base64\s+.*\|\s*(?:sh|bash|zsh)", command):
        return (
            "BLOCKED: Decoding and piping to shell is a common obfuscation technique. "
            "Run the command directly instead."
        )

    return None


# --- Alternative deletion tools ---


def check_alternative_deletion(command):
    """Blokuje alternatywne narzedzia usuwania na sciezkach systemowych.

    Blokuje: find / -delete, find ~ -delete, shred na sciezkach systemowych
    Przepuszcza: find ./src -name '*.pyc' -delete (specyficzna sciezka)
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens:
            continue

        # find <path> ... -delete
        if tokens[0] == "find" and "-delete" in tokens:
            if len(tokens) >= 2:
                target = tokens[1]
                normalized = _normalize_path(target)
                all_dangerous = _DANGEROUS_RM_TARGETS | _DANGEROUS_SYSTEM_PATHS | {
                    "$HOME", "${HOME}", "~"
                }
                if normalized in all_dangerous or target in all_dangerous:
                    return (
                        f"BLOCKED: 'find {target} -delete' would cause irreversible data loss. "
                        "Use a more specific path."
                    )

    return None


# --- Docker ---


_DOCKER_DANGEROUS_PATTERNS = [
    # docker rm/stop/kill z subshell $(docker ps ...)
    (
        r"docker\s+(?:rm|stop|kill)\s+.*\$\(docker\s+ps",
        "BLOCKED: Mass Docker container removal/stop/kill via subshell. "
        "Remove containers individually by name instead.",
    ),
    # docker rm/stop/kill z backticks `docker ps ...`
    (
        r"docker\s+(?:rm|stop|kill)\s+.*`docker\s+ps",
        "BLOCKED: Mass Docker container removal/stop/kill via subshell. "
        "Remove containers individually by name instead.",
    ),
    # docker system prune
    (
        r"docker\s+system\s+prune",
        "BLOCKED: 'docker system prune' removes all unused data (containers, images, networks). "
        "Use targeted cleanup commands instead.",
    ),
    # docker volume prune
    (
        r"docker\s+volume\s+prune",
        "BLOCKED: 'docker volume prune' removes all unused volumes and their data. "
        "Remove specific volumes by name instead.",
    ),
    # docker container prune
    (
        r"docker\s+container\s+prune",
        "BLOCKED: 'docker container prune' removes all stopped containers. "
        "Remove specific containers by name instead.",
    ),
    # docker image prune -a (usun WSZYSTKIE nieuzywane obrazy)
    (
        r"docker\s+image\s+prune\s+(?:.*\s)?-a",
        "BLOCKED: 'docker image prune -a' removes all unused images. "
        "Remove specific images by name/tag instead.",
    ),
    (
        r"docker\s+image\s+prune\s+(?:.*\s)?--all",
        "BLOCKED: 'docker image prune --all' removes all unused images. "
        "Remove specific images by name/tag instead.",
    ),
    # docker network prune
    (
        r"docker\s+network\s+prune",
        "BLOCKED: 'docker network prune' removes all unused networks. "
        "Remove specific networks by name instead.",
    ),
    # docker builder prune
    (
        r"docker\s+builder\s+prune",
        "BLOCKED: 'docker builder prune' removes all build cache. "
        "Use targeted cleanup instead.",
    ),
    # docker compose down -v / --volumes
    (
        r"docker[\s-]compose\s+down\s+(?:.*\s)?-v\b",
        "BLOCKED: 'docker compose down -v' removes all associated volumes. "
        "Use 'docker compose down' without -v to preserve volume data.",
    ),
    (
        r"docker[\s-]compose\s+down\s+(?:.*\s)?--volumes\b",
        "BLOCKED: 'docker compose down --volumes' removes all associated volumes. "
        "Use 'docker compose down' without --volumes to preserve volume data.",
    ),
]


def check_docker_dangerous(command):
    """Sprawdza czy komenda docker jest niebezpieczna.

    Blokuje: docker system/volume/container/network/builder prune,
             docker rm/stop/kill z subshell, docker compose down -v
    Przepuszcza: docker rm my-container, docker stop my-container,
                 docker image prune (bez -a)
    """
    for part in _split_commands(command):
        for pattern, message in _DOCKER_DANGEROUS_PATTERNS:
            if re.search(pattern, part):
                return message
    return None


# --- Git ---


def check_git_dangerous(command):
    """Sprawdza czy komenda git jest niebezpieczna.

    Blokuje: git clean -fd/-fx/-fdx (bez dry-run), git checkout -- .,
             git reset --hard (bez targetu), git push --force,
             git branch -D, git stash drop/clear
    Przepuszcza: git clean -n, git reset --hard abc1234, git push,
                 git branch -d, git stash
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "git":
            continue
        if len(tokens) < 2:
            continue

        subcommand = tokens[1]

        # git clean (bez dry-run, z force + dirs/ignored)
        if subcommand == "clean":
            args_str = " ".join(tokens[2:])
            has_dry_run = bool(re.search(r"(?:^|\s)-[a-zA-Z]*n", args_str)) or \
                          "--dry-run" in args_str
            if has_dry_run:
                continue
            all_short_flags = set()
            for token in tokens[2:]:
                if token.startswith("-") and not token.startswith("--"):
                    for char in token[1:]:
                        all_short_flags.add(char)
            has_force = "f" in all_short_flags
            has_dirs_or_ignored = "d" in all_short_flags or "x" in all_short_flags or \
                                  "X" in all_short_flags
            if has_force and has_dirs_or_ignored:
                return (
                    "BLOCKED: 'git clean -fdx' permanently deletes untracked files and directories. "
                    "Use 'git clean -ndx' (dry-run) first to preview what would be deleted."
                )

        # git checkout -- . / ./ / ./*
        if subcommand == "checkout":
            rest = " ".join(tokens[2:])
            if re.search(r"--\s+\.(?:[/\s*]|$)", rest):
                return (
                    "BLOCKED: 'git checkout -- .' discards all uncommitted changes. "
                    "Use 'git stash' to save changes, or checkout specific files."
                )

        # git reset --hard (bez explicit targetu)
        if subcommand == "reset":
            rest_tokens = tokens[2:]
            if "--hard" in rest_tokens:
                non_flag_tokens = [
                    t for t in rest_tokens
                    if not t.startswith("-") and t != "--hard"
                ]
                if not non_flag_tokens:
                    return (
                        "BLOCKED: 'git reset --hard' without a target resets to HEAD, "
                        "discarding all uncommitted changes. "
                        "Specify an explicit commit (e.g., 'git reset --hard abc1234') "
                        "or use 'git stash' first."
                    )

        # git push --force / -f (nadpisuje historie remote)
        if subcommand == "push":
            rest_tokens = tokens[2:]
            if "--force" in rest_tokens or "-f" in rest_tokens:
                return (
                    "BLOCKED: 'git push --force' overwrites remote history and can cause data loss "
                    "for other collaborators. Use 'git push --force-with-lease' for safer force push."
                )
            # Sprawdz sklejone flagi np. -uf
            for token in rest_tokens:
                if token.startswith("-") and not token.startswith("--") and "f" in token[1:]:
                    return (
                        "BLOCKED: 'git push -f' overwrites remote history and can cause data loss "
                        "for other collaborators. Use 'git push --force-with-lease' instead."
                    )

        # git branch -D (force delete)
        if subcommand == "branch":
            rest_tokens = tokens[2:]
            if "-D" in rest_tokens:
                return (
                    "BLOCKED: 'git branch -D' force-deletes a branch even if not merged. "
                    "Use 'git branch -d' which will warn if the branch is not fully merged."
                )

        # git stash drop / clear (utrata zapisanych zmian)
        if subcommand == "stash":
            if len(tokens) >= 3:
                stash_action = tokens[2]
                if stash_action == "clear":
                    return (
                        "BLOCKED: 'git stash clear' permanently deletes all stashed changes. "
                        "Use 'git stash drop' to remove specific stash entries."
                    )
                if stash_action == "drop" and len(tokens) == 3:
                    # 'git stash drop' bez argumentu -- dropuje ostatni stash
                    # Przepuszczamy, bo to pojedynczy stash, nie catastrophic
                    pass

    return None


# --- Ochrona plikow konfiguracyjnych ---
# Decyzja projektowa: edycje chronionych plikow sa ostrzegane (exit 0 + systemMessage),
# a NIE blokowane (exit 2). Uzytkownik moze celowo chciec zmodyfikowac CLAUDE.md
# lub settings - blokowanie utrudnialoby uzywanie agenta. Ostrzezenie informuje
# agenta o wrazliwosci pliku. Destrukcyjne komendy Bash sa blokowane (exit 2),
# bo sa nieodwracalne.

# Nazwy chronionych plikow (do regex matching)
_PROTECTED_FILE_NAMES = [
    "CLAUDE.md",
    ".claude/settings.json",
    ".claude/settings.local.json",
    "hooks/hooks.json",
]

_PROTECTED_FILE_PATTERNS = [
    (
        r"(?:^|/)CLAUDE\.md$",
        "policy_file_claude_md",
        "You are about to modify CLAUDE.md, which defines agent behavior policies. "
        "Ensure this change is intentional and reviewed.",
    ),
    (
        r"(?:^|/)\.claude/settings\.json$",
        "settings_file",
        "You are about to modify .claude/settings.json, which controls agent permissions. "
        "Ensure this change is intentional and reviewed.",
    ),
    (
        r"(?:^|/)\.claude/settings\.local\.json$",
        "settings_local_file",
        "You are about to modify .claude/settings.local.json (local agent settings). "
        "Ensure this change is intentional and reviewed.",
    ),
    (
        r"(?:^|/)hooks/hooks\.json$",
        "hooks_config_file",
        "You are about to modify hooks/hooks.json, which configures plugin hooks. "
        "Ensure this change is intentional and reviewed.",
    ),
]


def check_file_protection(file_path):
    """Sprawdza czy plik jest chroniony (CLAUDE.md, settings, hooks.json).

    Zwraca (warning_key, message) lub (None, None).
    """
    if not file_path:
        return None, None
    for pattern, key, message in _PROTECTED_FILE_PATTERNS:
        if re.search(pattern, file_path):
            return key, message
    return None, None


def check_bash_file_modification(command):
    """Sprawdza czy komenda Bash modyfikuje chronione pliki.

    Lapie: echo > CLAUDE.md, sed -i CLAUDE.md, mv/cp/tee/truncate/dd
    Nie blokuje -- wyswietla warning (return message string lub None).
    """
    # Wzorce modyfikacji plikow w Bash
    _BASH_FILE_MOD_PATTERNS = [
        r"(?:>|>>)\s*\S*{name}",          # echo "x" > CLAUDE.md, >> append
        r"tee\s+(?:-a\s+)?\S*{name}",     # tee CLAUDE.md, tee -a CLAUDE.md
        r"sed\s+-i\S*\s+.*\S*{name}",     # sed -i 's/.../.../' CLAUDE.md
        r"mv\s+\S+\s+\S*{name}",          # mv something CLAUDE.md
        r"cp\s+\S+\s+\S*{name}",          # cp something CLAUDE.md
        r"truncate\s+.*\S*{name}",         # truncate -s 0 CLAUDE.md
        r"dd\s+.*of=\S*{name}",           # dd if=... of=CLAUDE.md
    ]

    for name in _PROTECTED_FILE_NAMES:
        # Escape regex special chars w nazwie pliku
        escaped_name = re.escape(name)
        for pattern_template in _BASH_FILE_MOD_PATTERNS:
            pattern = pattern_template.format(name=escaped_name)
            if re.search(pattern, command):
                # Znajdz odpowiedni warning message
                for _, _, msg in _PROTECTED_FILE_PATTERNS:
                    if name.split("/")[-1] in msg or name in msg:
                        return msg
                return (
                    f"You are about to modify {name} via Bash command. "
                    "Ensure this change is intentional and reviewed."
                )

    return None


# --- Glowna logika ---


def handle_bash(tool_input):
    """Obsluga narzedzia Bash - sprawdza komende pod katem destrukcyjnych operacji.

    Zwraca (block_message, warn_message) -- block_message powoduje exit 2,
    warn_message powoduje systemMessage (exit 0).
    """
    command = tool_input.get("command", "")
    if not command:
        return None, None

    # 1. Indirect execution (eval, sh -c, pipe to shell)
    result = check_indirect_execution(command)
    if result:
        return result, None

    # 2. rm -rf na niebezpiecznych sciezkach
    result = check_rm_dangerous(command)
    if result:
        return result, None

    # 3. Alternatywne narzedzia usuwania (find -delete)
    result = check_alternative_deletion(command)
    if result:
        return result, None

    # 4. Docker destrukcyjne komendy
    result = check_docker_dangerous(command)
    if result:
        return result, None

    # 5. Git destrukcyjne komendy
    result = check_git_dangerous(command)
    if result:
        return result, None

    # 6. Modyfikacja chronionych plikow przez Bash (warning, nie block)
    warn = check_bash_file_modification(command)
    if warn:
        return None, warn

    return None, None


def handle_file_edit(tool_name, tool_input, session_id):
    """Obsluga narzedzi Write/Edit/MultiEdit - ostrzezenie przy edycji chronionych plikow.

    Zwraca (should_warn: bool, message: str).
    Warning jest wyswietlany tylko raz na sesje per plik.
    """
    file_path = tool_input.get("file_path", "")
    if not file_path:
        return False, ""

    warning_key, message = check_file_protection(file_path)
    if not warning_key:
        return False, ""

    shown_warnings = load_state(session_id)
    full_key = f"{file_path}-{warning_key}"
    if full_key in shown_warnings:
        return False, ""

    shown_warnings.add(full_key)
    save_state(session_id, shown_warnings)
    return True, message


def main():
    # Sprawdz env var wylaczajacy guard
    if os.environ.get("ENABLE_DESTRUCTIVE_GUARD", "1") == "0":
        sys.exit(0)

    # Periodyczny cleanup starych plikow stanu (10% szans)
    if random.random() < 0.1:
        cleanup_old_state_files()

    # Wczytaj dane wejsciowe z stdin
    try:
        raw_input_data = sys.stdin.read()
        input_data = json.loads(raw_input_data)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Obsluga Bash
    if tool_name == "Bash":
        block_message, warn_message = handle_bash(tool_input)
        if block_message:
            print(block_message, file=sys.stderr)
            sys.exit(2)
        if warn_message:
            # Warning o modyfikacji chronionego pliku przez Bash
            # Raz na sesje per warning
            shown_warnings = load_state(session_id)
            warn_key = f"bash-{warn_message[:50]}"
            if warn_key not in shown_warnings:
                shown_warnings.add(warn_key)
                save_state(session_id, shown_warnings)
                warning_output = json.dumps({"systemMessage": warn_message})
                print(warning_output)
        sys.exit(0)

    # Obsluga Write/Edit/MultiEdit
    if tool_name in ("Write", "Edit", "MultiEdit"):
        should_warn, message = handle_file_edit(tool_name, tool_input, session_id)
        if should_warn:
            warning_output = json.dumps({"systemMessage": message})
            print(warning_output)
            sys.exit(0)
        sys.exit(0)

    # Inne narzedzia -- przepusc
    sys.exit(0)


if __name__ == "__main__":
    main()
