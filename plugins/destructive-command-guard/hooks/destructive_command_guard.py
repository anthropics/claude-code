#!/usr/bin/env python3
"""
Destructive Command Guard Hook for Claude Code

PreToolUse hook that:
- BLOCKS dangerous Bash commands (rm -rf /, docker system prune, git clean -fdx, etc.)
- WARNS about edits to policy files (CLAUDE.md, .claude/settings.json, hooks.json)

Exit codes:
  0 - allow (or warn via JSON on stdout)
  2 - block (message on stderr)
"""

import json
import os
import random
import re
import sys
from datetime import datetime


# --- Konfiguracja ---

STATE_FILE_PREFIX = "destructive_guard_state_"
DEBUG_LOG_FILE = "/tmp/destructive-guard-log.txt"


def debug_log(message):
    """Zapis logu debugowego z timestampem."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


# --- Session state (wzorzec z security-guidance) ---


def get_state_file(session_id):
    """Sciezka do pliku stanu sesji."""
    return os.path.expanduser(f"~/.claude/{STATE_FILE_PREFIX}{session_id}.json")


def cleanup_old_state_files():
    """Usuwa pliki stanu starsze niz 30 dni."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return
        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)
        for filename in os.listdir(state_dir):
            if filename.startswith(STATE_FILE_PREFIX) and filename.endswith(".json"):
                file_path = os.path.join(state_dir, filename)
                try:
                    if os.path.getmtime(file_path) < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass
    except Exception:
        pass


def load_state(session_id):
    """Wczytaj zbiór juz wyswietlonych ostrzezen."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Zapisz zbiór wyswietlonych ostrzezen."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(list(shown_warnings), f)
    except IOError:
        pass


# --- Parsery komend Bash ---


def _split_commands(command):
    """Rozdziela polecenie na czesci po &&, ;, | (uproszczony split)."""
    parts = re.split(r"\s*(?:&&|;|\|)\s*", command)
    return [p.strip() for p in parts if p.strip()]


def _parse_rm_flags_and_targets(args_str):
    """Parsuje flagi i targety z argumentow rm.

    Obsluguje: -rf, -r -f, -rfv, --recursive --force, itp.
    Zwraca (flags: set, targets: list).
    """
    tokens = args_str.split()
    flags = set()
    targets = []
    for token in tokens:
        if token == "--":
            # Wszystko po -- to targety
            idx = tokens.index(token)
            targets.extend(tokens[idx + 1:])
            break
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


# Sciezki niebezpieczne dla rm -rf (normalizowane)
_DANGEROUS_RM_TARGETS = {
    "/",
    "/*",
    "~",
    "~/",
    "~/*",
    "$HOME",
    "$HOME/",
    "$HOME/*",
    "${HOME}",
    "${HOME}/",
    "${HOME}/*",
    ".",
    "./",
    "./*",
    "..",
    "../",
    "../*",
    "*",
}


def check_rm_dangerous(command):
    """Sprawdza czy komenda rm jest niebezpieczna.

    Blokuje: rm -rf /, rm -rf ~, rm -rf ., rm -rf .., rm -rf *
    Przepuszcza: rm -rf node_modules, rm -rf /tmp/build, rm file.txt
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "rm":
            continue
        args_str = " ".join(tokens[1:])
        flags, targets = _parse_rm_flags_and_targets(args_str)

        # Blokujemy tylko gdy sa flagi -r i -f (lub kombinacje typu -rf)
        has_recursive = "r" in flags or "R" in flags
        has_force = "f" in flags
        if not (has_recursive and has_force):
            continue

        for target in targets:
            normalized = target.rstrip("/") if target not in ("/", "~/") else target
            if target in _DANGEROUS_RM_TARGETS or normalized in _DANGEROUS_RM_TARGETS:
                return (
                    f"BLOCKED: 'rm -rf {target}' would cause irreversible data loss. "
                    f"This command targets a critical path ({target}). "
                    f"If you need to remove specific files, use a more targeted command."
                )
    return None


# Wzorce docker niebezpiecznych komend
_DOCKER_DANGEROUS_PATTERNS = [
    # docker rm/stop/kill z subshell $(docker ps ...)
    (
        r"docker\s+(?:rm|stop|kill)\s+.*\$\(docker\s+ps",
        "BLOCKED: Mass Docker container removal/stop/kill via subshell. "
        "Remove containers individually by name instead.",
    ),
    # docker system prune (z lub bez -f/--force, z lub bez -a/--all)
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
    # docker compose down -v (usuwa woluminy)
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

    Blokuje: docker rm -f $(docker ps -aq), docker system prune, docker volume prune,
             docker compose down -v
    Przepuszcza: docker rm my-container, docker stop my-container
    """
    for part in _split_commands(command):
        for pattern, message in _DOCKER_DANGEROUS_PATTERNS:
            if re.search(pattern, part):
                return message
    return None


def check_git_dangerous(command):
    """Sprawdza czy komenda git jest niebezpieczna.

    Blokuje: git clean -fdx (bez -n/--dry-run), git checkout -- ., git reset --hard (bez targetu)
    Przepuszcza: git clean -n, git clean -ndx, git reset --hard abc1234
    """
    for part in _split_commands(command):
        tokens = part.split()
        if not tokens or tokens[0] != "git":
            continue

        if len(tokens) < 2:
            continue

        subcommand = tokens[1]

        # git clean -fdx (bez dry-run)
        if subcommand == "clean":
            args_str = " ".join(tokens[2:])
            # Sprawdz czy jest dry-run (-n lub --dry-run)
            has_dry_run = bool(re.search(r"(?:^|\s)-[a-zA-Z]*n", args_str)) or \
                          "--dry-run" in args_str
            if has_dry_run:
                continue
            # Sprawdz czy sa niebezpieczne flagi (-f z -d lub -x)
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

        # git checkout -- . (odrzuca wszystkie lokalne zmiany)
        # Obsluguje: -- ., -- ./, -- ./*
        if subcommand == "checkout":
            rest = " ".join(tokens[2:])
            if re.search(r"--\s+\.(?:[/\s*]|$)", rest):
                return (
                    "BLOCKED: 'git checkout -- .' discards all uncommitted changes. "
                    "Use 'git stash' to save changes, or checkout specific files."
                )

        # git reset --hard (bez explicit commit hash)
        if subcommand == "reset":
            rest_tokens = tokens[2:]
            if "--hard" in rest_tokens:
                # Sprawdz czy po --hard jest explicit target (commit hash, branch, HEAD~N)
                hard_idx = rest_tokens.index("--hard")
                # Tokeny ktore nie sa flagami
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

    return None


# --- Ochrona plikow konfiguracyjnych ---
# Decyzja projektowa: edycje chronionych plikow sa ostrzegane (exit 0 + systemMessage),
# a NIE blokowane (exit 2). Uzytkownik moze celowo chciec zmodyfikowac CLAUDE.md
# lub settings - blokowanie utrudnialoby uzywanie agenta. Ostrzezenie informuje
# agenta o wrazliwosci pliku. Destrukcyjne komendy Bash sa blokowane (exit 2),
# bo sa nieodwracalne.

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


# --- Glowna logika ---


def handle_bash(tool_input):
    """Obsluga narzedzia Bash - sprawdza komende pod katem destrukcyjnych operacji."""
    command = tool_input.get("command", "")
    if not command:
        return None

    # Sprawdz kolejno kazda kategorie
    result = check_rm_dangerous(command)
    if result:
        return result

    result = check_docker_dangerous(command)
    if result:
        return result

    result = check_git_dangerous(command)
    if result:
        return result

    return None


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

    # Sprawdz czy juz ostrzegano w tej sesji
    shown_warnings = load_state(session_id)
    full_key = f"{file_path}-{warning_key}"
    if full_key in shown_warnings:
        return False, ""

    # Zapisz ostrzezenie
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

    # Obsluga Bash - blokowanie destrukcyjnych komend
    if tool_name == "Bash":
        block_message = handle_bash(tool_input)
        if block_message:
            print(block_message, file=sys.stderr)
            sys.exit(2)
        sys.exit(0)

    # Obsluga Write/Edit/MultiEdit - ostrzezenia o chronionych plikach
    if tool_name in ("Write", "Edit", "MultiEdit"):
        should_warn, message = handle_file_edit(tool_name, tool_input, session_id)
        if should_warn:
            # Wyslij warning jako systemMessage (exit 0, JSON na stdout)
            warning_output = json.dumps({"systemMessage": message})
            print(warning_output)
            sys.exit(0)
        sys.exit(0)

    # Inne narzedzia - przepusc
    sys.exit(0)


if __name__ == "__main__":
    main()
