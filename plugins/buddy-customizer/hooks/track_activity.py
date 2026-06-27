#!/usr/bin/env python3
"""Track coding activity for buddy gamification.

Listens to PostToolUse events and awards XP based on tool usage patterns.
Stores progress in ~/.claude/buddy-customizer/profile.json.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

PROFILE_DIR = Path.home() / ".claude" / "buddy-customizer"
PROFILE_FILE = PROFILE_DIR / "profile.json"

# XP rewards per activity
XP_TABLE = {
    "edit_file": {"stat": "debugging", "xp": 5, "label": "File Edit"},
    "write_file": {"stat": "wisdom", "xp": 3, "label": "File Create"},
    "bash_test": {"stat": "patience", "xp": 8, "label": "Test Run"},
    "bash_lint": {"stat": "wisdom", "xp": 4, "label": "Lint Check"},
    "bash_git_commit": {"stat": "debugging", "xp": 10, "label": "Git Commit"},
    "bash_git_push": {"stat": "chaos", "xp": 6, "label": "Git Push"},
    "bash_build": {"stat": "patience", "xp": 7, "label": "Build"},
    "grep_search": {"stat": "wisdom", "xp": 2, "label": "Code Search"},
    "read_file": {"stat": "patience", "xp": 1, "label": "File Read"},
}

# Level thresholds
LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000]

# Achievements
ACHIEVEMENTS = {
    "first_commit": {"name": "First Blood", "desc": "Made your first commit", "icon": "🎯", "check": lambda p: p["activity_counts"].get("bash_git_commit", 0) >= 1},
    "test_runner": {"name": "Test Champion", "desc": "Ran 25 test suites", "icon": "🧪", "check": lambda p: p["activity_counts"].get("bash_test", 0) >= 25},
    "centurion": {"name": "Centurion", "desc": "100 file edits", "icon": "💯", "check": lambda p: p["activity_counts"].get("edit_file", 0) >= 100},
    "streak_3": {"name": "On Fire", "desc": "3-day coding streak", "icon": "🔥", "check": lambda p: p.get("current_streak", 0) >= 3},
    "streak_7": {"name": "Unstoppable", "desc": "7-day coding streak", "icon": "⚡", "check": lambda p: p.get("current_streak", 0) >= 7},
    "level_5": {"name": "Journeyman", "desc": "Reached level 5", "icon": "⭐", "check": lambda p: get_level(p["total_xp"]) >= 5},
    "level_10": {"name": "Master", "desc": "Reached level 10", "icon": "👑", "check": lambda p: get_level(p["total_xp"]) >= 10},
    "explorer": {"name": "Explorer", "desc": "Searched code 50 times", "icon": "🔍", "check": lambda p: p["activity_counts"].get("grep_search", 0) >= 50},
    "builder": {"name": "Builder", "desc": "Ran 20 builds", "icon": "🏗️", "check": lambda p: p["activity_counts"].get("bash_build", 0) >= 20},
    "prolific": {"name": "Prolific", "desc": "Earned 1000 total XP", "icon": "🏆", "check": lambda p: p["total_xp"] >= 1000},
}


def get_level(total_xp: int) -> int:
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_xp < threshold:
            return i - 1
    return len(LEVEL_THRESHOLDS) - 1


def get_default_profile() -> dict:
    return {
        "custom_name": None,
        "custom_personality": None,
        "total_xp": 0,
        "stats": {
            "debugging": 0,
            "patience": 0,
            "chaos": 0,
            "wisdom": 0,
            "snark": 0,
        },
        "activity_counts": {},
        "achievements_unlocked": [],
        "sessions": 0,
        "current_streak": 0,
        "last_active_date": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def load_profile() -> dict:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    if PROFILE_FILE.exists():
        with open(PROFILE_FILE) as f:
            return json.load(f)
    return get_default_profile()


def save_profile(profile: dict) -> None:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROFILE_FILE, "w") as f:
        json.dump(profile, f, indent=2)


def classify_tool_use(tool_name: str, tool_input: str) -> str | None:
    """Classify a tool use event into an activity category."""
    name_lower = tool_name.lower()

    if name_lower in ("edit", "multiedit"):
        return "edit_file"
    if name_lower == "write":
        return "write_file"
    if name_lower in ("grep", "glob"):
        return "grep_search"
    if name_lower == "read":
        return "read_file"
    if name_lower == "bash":
        input_lower = tool_input.lower()
        if any(kw in input_lower for kw in ["test", "vitest", "jest", "pytest", "mocha"]):
            return "bash_test"
        if any(kw in input_lower for kw in ["lint", "eslint", "prettier"]):
            return "bash_lint"
        if "git commit" in input_lower:
            return "bash_git_commit"
        if "git push" in input_lower:
            return "bash_git_push"
        if any(kw in input_lower for kw in ["build", "compile", "tsc", "vite build"]):
            return "bash_build"
    return None


def update_streak(profile: dict) -> None:
    """Update daily coding streak."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_date = profile.get("last_active_date")

    if last_date == today:
        return  # Already active today

    if last_date:
        from datetime import timedelta
        last = datetime.strptime(last_date, "%Y-%m-%d")
        now = datetime.strptime(today, "%Y-%m-%d")
        diff = (now - last).days
        if diff == 1:
            profile["current_streak"] = profile.get("current_streak", 0) + 1
        elif diff > 1:
            profile["current_streak"] = 1
    else:
        profile["current_streak"] = 1

    profile["last_active_date"] = today


def check_achievements(profile: dict) -> list[str]:
    """Check and unlock new achievements. Returns list of newly unlocked."""
    newly_unlocked = []
    unlocked = set(profile.get("achievements_unlocked", []))

    for key, ach in ACHIEVEMENTS.items():
        if key not in unlocked and ach["check"](profile):
            unlocked.add(key)
            newly_unlocked.append(key)

    profile["achievements_unlocked"] = sorted(unlocked)
    return newly_unlocked


def main():
    """Process PostToolUse event from stdin."""
    try:
        event = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        return

    tool_name = event.get("tool_name", "")
    tool_input = json.dumps(event.get("tool_input", {}))

    activity = classify_tool_use(tool_name, tool_input)
    if not activity:
        return

    xp_entry = XP_TABLE.get(activity)
    if not xp_entry:
        return

    profile = load_profile()

    # Award XP
    profile["total_xp"] = profile.get("total_xp", 0) + xp_entry["xp"]
    profile["stats"][xp_entry["stat"]] = profile["stats"].get(xp_entry["stat"], 0) + xp_entry["xp"]
    profile["activity_counts"][activity] = profile["activity_counts"].get(activity, 0) + 1

    # Update streak
    update_streak(profile)

    # Check achievements
    new_achievements = check_achievements(profile)

    save_profile(profile)

    # Output achievement notifications
    if new_achievements:
        for key in new_achievements:
            ach = ACHIEVEMENTS[key]
            print(f"{ach['icon']} Achievement Unlocked: {ach['name']} — {ach['desc']}")


if __name__ == "__main__":
    main()
