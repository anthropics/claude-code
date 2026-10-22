#!/usr/bin/env python3
"""CLI for buddy customization — rename, personality, stats, achievements, reset."""

import json
import sys
from pathlib import Path

PROFILE_DIR = Path.home() / ".claude" / "buddy-customizer"
PROFILE_FILE = PROFILE_DIR / "profile.json"

LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000]
LEVEL_TITLES = [
    "Hatchling", "Curious", "Apprentice", "Companion", "Sidekick",
    "Journeyman", "Adept", "Veteran", "Expert", "Master", "Legend",
]

ACHIEVEMENTS = {
    "first_commit": {"name": "First Blood", "desc": "Made your first commit", "icon": "🎯", "need": "1 git commit"},
    "test_runner": {"name": "Test Champion", "desc": "Ran 25 test suites", "icon": "🧪", "need": "25 test runs"},
    "centurion": {"name": "Centurion", "desc": "100 file edits", "icon": "💯", "need": "100 file edits"},
    "streak_3": {"name": "On Fire", "desc": "3-day coding streak", "icon": "🔥", "need": "3-day streak"},
    "streak_7": {"name": "Unstoppable", "desc": "7-day coding streak", "icon": "⚡", "need": "7-day streak"},
    "level_5": {"name": "Journeyman", "desc": "Reached level 5", "icon": "⭐", "need": "Level 5"},
    "level_10": {"name": "Master", "desc": "Reached level 10", "icon": "👑", "need": "Level 10"},
    "explorer": {"name": "Explorer", "desc": "Searched code 50 times", "icon": "🔍", "need": "50 code searches"},
    "builder": {"name": "Builder", "desc": "Ran 20 builds", "icon": "🏗️", "need": "20 builds"},
    "prolific": {"name": "Prolific", "desc": "Earned 1000 total XP", "icon": "🏆", "need": "1000 XP"},
}


def get_level(total_xp: int) -> int:
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_xp < threshold:
            return i - 1
    return len(LEVEL_THRESHOLDS) - 1


def make_bar(current: int, total: int, width: int = 10) -> str:
    if total == 0:
        return "█" * width
    filled = int((current / total) * width)
    return "█" * filled + "░" * (width - filled)


def load_profile() -> dict:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    if PROFILE_FILE.exists():
        with open(PROFILE_FILE) as f:
            return json.load(f)
    return {
        "custom_name": None,
        "custom_personality": None,
        "total_xp": 0,
        "stats": {"debugging": 0, "patience": 0, "chaos": 0, "wisdom": 0, "snark": 0},
        "activity_counts": {},
        "achievements_unlocked": [],
        "sessions": 0,
        "current_streak": 0,
        "last_active_date": None,
    }


def save_profile(profile: dict) -> None:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROFILE_FILE, "w") as f:
        json.dump(profile, f, indent=2)


def cmd_rename(name: str) -> None:
    profile = load_profile()
    old_name = profile.get("custom_name") or "(default)"
    profile["custom_name"] = name.strip()[:32]
    save_profile(profile)
    print(f"Renamed buddy: {old_name} → {profile['custom_name']}")


def cmd_personality(text: str) -> None:
    profile = load_profile()
    profile["custom_personality"] = text.strip()[:200]
    save_profile(profile)
    print(f"Personality updated: \"{profile['custom_personality']}\"")


def cmd_stats() -> None:
    profile = load_profile()
    name = profile.get("custom_name") or "Your Buddy"
    level = get_level(profile.get("total_xp", 0))
    title = LEVEL_TITLES[min(level, len(LEVEL_TITLES) - 1)]
    total_xp = profile.get("total_xp", 0)
    stats = profile.get("stats", {})
    streak = profile.get("current_streak", 0)
    sessions = profile.get("sessions", 0)
    achievements = profile.get("achievements_unlocked", [])
    personality = profile.get("custom_personality")

    # XP progress
    if level < len(LEVEL_THRESHOLDS) - 1:
        current_thresh = LEVEL_THRESHOLDS[level]
        next_thresh = LEVEL_THRESHOLDS[level + 1]
        xp_in = total_xp - current_thresh
        xp_needed = next_thresh - current_thresh
        xp_bar = make_bar(xp_in, xp_needed, 20)
        xp_line = f"  XP: {total_xp} [{xp_bar}] {xp_in}/{xp_needed} to Lv.{level + 1}"
    else:
        xp_line = f"  XP: {total_xp} [████████████████████] MAX LEVEL"

    # Stat bars (normalize to max 100 for display)
    max_stat = max(max(stats.values()), 1) if stats else 1
    stat_lines = []
    for stat_name in ["debugging", "patience", "chaos", "wisdom", "snark"]:
        val = stats.get(stat_name, 0)
        display_val = min(int((val / max_stat) * 100), 100) if max_stat > 0 else 0
        bar = make_bar(display_val, 100, 10)
        stat_lines.append(f"  {stat_name.upper():<10} {bar}  {val:>4}")

    # Achievement icons
    ach_icons = " ".join(ACHIEVEMENTS[a]["icon"] for a in achievements if a in ACHIEVEMENTS)

    # Build card
    lines = [
        f"┌──────────────────────────────────────┐",
        f"│  {name} {'⭐' * min(level, 5)} Level {level} ({title})",
        f"│",
    ]
    if personality:
        # Word-wrap personality to ~34 chars
        words = personality.split()
        plines = []
        current = ""
        for w in words:
            if len(current) + len(w) + 1 > 34:
                plines.append(current)
                current = w
            else:
                current = f"{current} {w}".strip()
        if current:
            plines.append(current)
        for pl in plines:
            lines.append(f'│  "{pl}"')
        lines.append(f"│")

    lines.append(xp_line)
    lines.append(f"│")
    for sl in stat_lines:
        lines.append(f"│{sl}")
    lines.append(f"│")

    meta_parts = []
    if streak > 0:
        meta_parts.append(f"🔥 {streak}-day streak")
    meta_parts.append(f"📊 {sessions} sessions")
    lines.append(f"│  {' · '.join(meta_parts)}")

    if ach_icons:
        lines.append(f"│  {ach_icons}")

    lines.append(f"└──────────────────────────────────────┘")

    print("\n".join(lines))


def cmd_achievements() -> None:
    profile = load_profile()
    unlocked = set(profile.get("achievements_unlocked", []))

    print("=== Achievements ===\n")
    for key, ach in ACHIEVEMENTS.items():
        status = "✅" if key in unlocked else "🔒"
        print(f"  {status} {ach['icon']} {ach['name']}")
        print(f"     {ach['desc']}")
        if key not in unlocked:
            print(f"     Requirement: {ach['need']}")
        print()

    print(f"Unlocked: {len(unlocked)}/{len(ACHIEVEMENTS)}")


def cmd_reset() -> None:
    if PROFILE_FILE.exists():
        PROFILE_FILE.unlink()
    print("Buddy customizations reset. Start fresh with /buddy-rename!")


def main():
    if len(sys.argv) < 2:
        print("Usage: buddy_cli.py <rename|personality|stats|achievements|reset> [args]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "rename":
        if len(sys.argv) < 3:
            print("Usage: buddy_cli.py rename <new_name>")
            sys.exit(1)
        cmd_rename(" ".join(sys.argv[2:]))

    elif command == "personality":
        if len(sys.argv) < 3:
            print("Usage: buddy_cli.py personality <description>")
            sys.exit(1)
        cmd_personality(" ".join(sys.argv[2:]))

    elif command == "stats":
        cmd_stats()

    elif command == "achievements":
        cmd_achievements()

    elif command == "reset":
        cmd_reset()

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
