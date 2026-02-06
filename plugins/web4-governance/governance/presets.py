# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Policy Presets
# https://github.com/dp-web4/web4
"""
Policy Presets - Built-in rule sets users can reference by name.

Presets provide sensible defaults for common governance postures.
Users can override individual fields and append additional rules.

Usage:
    from governance.presets import get_preset, resolve_preset, list_presets

    # Get a preset
    config = get_preset("safety")

    # Resolve with overrides
    config = resolve_preset("safety", enforce=False)

    # List all presets
    for preset in list_presets():
        print(preset.name, preset.description)
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Literal

PolicyDecision = Literal["allow", "deny", "warn"]
PresetName = Literal["permissive", "safety", "strict", "audit-only"]


@dataclass
class RateLimitSpec:
    """Rate limit specification for a policy rule."""
    max_count: int
    window_ms: int


@dataclass
class TimeWindow:
    """
    Temporal constraints for policy rules.
    Rule only matches during specified time windows.
    """
    # Allowed hours [start, end] in 24h format. E.g., [9, 17] = 9am-5pm
    allowed_hours: Optional[tuple] = None
    # Allowed days of week. 0=Sunday, 1=Monday, ... 6=Saturday
    allowed_days: Optional[List[int]] = None
    # Timezone for time calculations. Defaults to system timezone.
    timezone: Optional[str] = None


@dataclass
class PolicyMatch:
    """Match criteria for a policy rule."""
    tools: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    target_patterns: Optional[List[str]] = None
    target_patterns_are_regex: bool = False
    rate_limit: Optional[RateLimitSpec] = None
    time_window: Optional[TimeWindow] = None


@dataclass
class PolicyRule:
    """A single policy rule."""
    id: str
    name: str
    priority: int
    decision: PolicyDecision
    match: PolicyMatch
    reason: Optional[str] = None


@dataclass
class PolicyConfig:
    """Complete policy configuration."""
    default_policy: PolicyDecision
    enforce: bool
    rules: List[PolicyRule] = field(default_factory=list)
    preset: Optional[str] = None


@dataclass
class PresetDefinition:
    """A named preset with description and config."""
    name: PresetName
    description: str
    config: PolicyConfig


# Safety rules shared between 'safety' and 'audit-only' presets
SAFETY_RULES = [
    PolicyRule(
        id="deny-destructive-commands",
        name="Block destructive shell commands",
        priority=1,
        decision="deny",
        reason="Destructive command blocked by safety preset",
        match=PolicyMatch(
            tools=["Bash"],
            # Block: rm with ANY flags, mkfs.* (filesystem format)
            # Rationale: rm -f bypasses prompts, rm -r is recursive, all flags are risky for agents
            target_patterns=[r"rm\s+-", r"mkfs\."],
            target_patterns_are_regex=True,
        ),
    ),
    PolicyRule(
        id="warn-file-delete",
        name="Warn on file deletion",
        priority=2,
        decision="warn",
        reason="File deletion flagged - use with caution",
        match=PolicyMatch(
            tools=["Bash"],
            # Warn on plain rm (no flags) - less dangerous but still destructive
            # Matches "rm file" or "rm ./path" but not "rm -rf" (caught by deny rule above)
            target_patterns=[r"rm\s+[^-]"],
            target_patterns_are_regex=True,
        ),
    ),
    PolicyRule(
        id="deny-secret-files",
        name="Block reading secret/credential files",
        priority=3,
        decision="deny",
        reason="Credential/secret file access denied by safety preset",
        match=PolicyMatch(
            categories=["file_read", "credential_access"],
            target_patterns=[
                # Environment and general secrets
                "**/.env",
                "**/.env.*",
                "**/credentials.*",
                "**/*secret*",
                "**/token*.json",
                "**/auth*.json",
                "**/*apikey*",
                # Cloud provider credentials
                "**/.aws/credentials",
                "**/.aws/config",
                # SSH keys
                "**/.ssh/id_*",
                "**/.ssh/config",
                # Package manager auth
                "**/.npmrc",
                "**/.pypirc",
                # Database/service credentials
                "**/.netrc",
                "**/.pgpass",
                "**/.my.cnf",
                # Container/orchestration credentials
                "**/.docker/config.json",
                "**/.kube/config",
                # Encryption keys
                "**/.gnupg/*",
                "**/.gpg/*",
            ],
        ),
    ),
    PolicyRule(
        id="warn-memory-write",
        name="Warn on agent memory file modifications",
        priority=4,
        decision="warn",
        reason="Memory file modification flagged - potential memory poisoning",
        match=PolicyMatch(
            categories=["file_write"],
            target_patterns=[
                "**/MEMORY.md",
                "**/memory.md",
                "**/memory/**/*.md",
                "**/.web4/**/memory*",
                "**/.claude/**/memory*",
            ],
        ),
    ),
    PolicyRule(
        id="warn-network",
        name="Warn on network access",
        priority=10,
        decision="warn",
        reason="Network access flagged by safety preset",
        match=PolicyMatch(categories=["network"]),
    ),
]


# All available presets
PRESETS: Dict[PresetName, PresetDefinition] = {
    "permissive": PresetDefinition(
        name="permissive",
        description="Pure observation — no rules, all actions allowed",
        config=PolicyConfig(
            default_policy="allow",
            enforce=False,
            rules=[],
        ),
    ),
    "safety": PresetDefinition(
        name="safety",
        description="Deny destructive bash, deny secret file reads, warn on network",
        config=PolicyConfig(
            default_policy="allow",
            enforce=True,
            rules=SAFETY_RULES.copy(),
        ),
    ),
    "strict": PresetDefinition(
        name="strict",
        description="Deny everything except Read, Glob, Grep, and TodoWrite",
        config=PolicyConfig(
            default_policy="deny",
            enforce=True,
            rules=[
                PolicyRule(
                    id="allow-read-tools",
                    name="Allow read-only tools",
                    priority=1,
                    decision="allow",
                    reason="Read-only tool permitted by strict preset",
                    match=PolicyMatch(tools=["Read", "Glob", "Grep", "TodoWrite"]),
                ),
            ],
        ),
    ),
    "audit-only": PresetDefinition(
        name="audit-only",
        description="Same rules as safety but enforce=false (dry-run, logs what would be blocked)",
        config=PolicyConfig(
            default_policy="allow",
            enforce=False,
            rules=SAFETY_RULES.copy(),
        ),
    ),
}


def get_preset(name: str) -> Optional[PresetDefinition]:
    """Get a preset by name, or None if not found."""
    return PRESETS.get(name)


def list_presets() -> List[PresetDefinition]:
    """List all available presets."""
    return list(PRESETS.values())


def is_preset_name(name: str) -> bool:
    """Check if a name is a valid preset name."""
    return name in PRESETS


def resolve_preset(
    preset_name: str,
    default_policy: Optional[PolicyDecision] = None,
    enforce: Optional[bool] = None,
    additional_rules: Optional[List[PolicyRule]] = None,
) -> PolicyConfig:
    """
    Resolve a policy config from preset + overrides.

    Merge order:
      1. Preset defaults (default_policy, enforce, rules)
      2. Top-level overrides (default_policy, enforce) from kwargs
      3. Additional rules are appended after preset rules

    Args:
        preset_name: Name of the preset to use as base
        default_policy: Override for default policy
        enforce: Override for enforce flag
        additional_rules: Rules to append after preset rules

    Returns:
        PolicyConfig with merged settings

    Raises:
        ValueError: If preset_name is not recognized
    """
    preset = get_preset(preset_name)
    if not preset:
        available = ", ".join(PRESETS.keys())
        raise ValueError(f'Unknown policy preset: "{preset_name}". Available: {available}')

    # Start with preset config
    config = PolicyConfig(
        default_policy=preset.config.default_policy,
        enforce=preset.config.enforce,
        rules=preset.config.rules.copy(),
        preset=preset_name,
    )

    # Apply overrides
    if default_policy is not None:
        config.default_policy = default_policy
    if enforce is not None:
        config.enforce = enforce
    if additional_rules:
        config.rules = config.rules + additional_rules

    return config


def policy_config_to_dict(config: PolicyConfig) -> Dict[str, Any]:
    """Convert PolicyConfig to JSON-serializable dict."""
    def match_to_dict(match: PolicyMatch) -> Dict[str, Any]:
        result = {
            "tools": match.tools,
            "categories": match.categories,
            "target_patterns": match.target_patterns,
            "target_patterns_are_regex": match.target_patterns_are_regex,
            "rate_limit": (
                {"max_count": match.rate_limit.max_count, "window_ms": match.rate_limit.window_ms}
                if match.rate_limit
                else None
            ),
            "time_window": (
                {
                    "allowed_hours": list(match.time_window.allowed_hours) if match.time_window.allowed_hours else None,
                    "allowed_days": match.time_window.allowed_days,
                    "timezone": match.time_window.timezone,
                }
                if match.time_window
                else None
            ),
        }
        return result

    return {
        "default_policy": config.default_policy,
        "enforce": config.enforce,
        "preset": config.preset,
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "priority": r.priority,
                "decision": r.decision,
                "reason": r.reason,
                "match": match_to_dict(r.match),
            }
            for r in config.rules
        ],
    }
