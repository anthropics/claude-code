#!/usr/bin/env python3
"""Show buddy session summary when a session ends (Stop hook)."""

import json
import sys
from pathlib import Path

PROFILE_FILE = Path.home() / ".claude" / "buddy-customizer" / "profile.json"

LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000]


def get_level(total_xp: int) -> int:
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if total_xp < threshold:
            return i - 1
    return len(LEVEL_THRESHOLDS) - 1


def xp_to_next_level(total_xp: int) -> tuple[int, int]:
    """Returns (xp_into_current_level, xp_needed_for_next)."""
    level = get_level(total_xp)
    if level >= len(LEVEL_THRESHOLDS) - 1:
        return total_xp, total_xp  # Max level
    current_threshold = LEVEL_THRESHOLDS[level]
    next_threshold = LEVEL_THRESHOLDS[level + 1]
    return total_xp - current_threshold, next_threshold - current_threshold


def make_bar(current: int, total: int, width: int = 10) -> str:
    if total == 0:
        return "█" * width
    filled = int((current / total) * width)
    return "█" * filled + "░" * (width - filled)


def main():
    if not PROFILE_FILE.exists():
        return

    try:
        with open(PROFILE_FILE) as f:
            profile = json.load(f)
    except (json.JSONDecodeError, OSError):
        return

    # Increment session count
    profile["sessions"] = profile.get("sessions", 0) + 1
    with open(PROFILE_FILE, "w") as f:
        json.dump(profile, f, indent=2)

    name = profile.get("custom_name") or "Your Buddy"
    level = get_level(profile.get("total_xp", 0))
    xp_in, xp_needed = xp_to_next_level(profile.get("total_xp", 0))
    stats = profile.get("stats", {})
    streak = profile.get("current_streak", 0)
    achievements = profile.get("achievements_unlocked", [])

    # Compact session end summary
    parts = [f"{name} Lv.{level}"]
    parts.append(f"XP: {profile.get('total_xp', 0)} [{make_bar(xp_in, xp_needed)}]")
    if streak > 1:
        parts.append(f"🔥 {streak}-day streak")
    if achievements:
        parts.append(f"🏆 {len(achievements)} achievements")

    print(" · ".join(parts))


if __name__ == "__main__":
    main()
