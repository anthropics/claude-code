"""Configuration loading with project override support."""

import json
from pathlib import Path
from typing import Any


def load_config(cwd: str, plugin_root: str | None = None) -> dict[str, Any]:
    """
    Load configuration with project overrides.

    Priority:
    1. Project config: {cwd}/.claude/verify-claims.json
    2. Default config: {plugin_root}/config/default_config.json
    """
    config = {}

    # Load default config
    if plugin_root:
        default_path = Path(plugin_root) / "config" / "default_config.json"
    else:
        default_path = Path(__file__).parent.parent.parent / "config" / "default_config.json"

    if default_path.exists():
        with open(default_path) as f:
            config = json.load(f)

    # Load project overrides
    project_config_path = Path(cwd) / ".claude" / "verify-claims.json"
    if project_config_path.exists():
        with open(project_config_path) as f:
            project_config = json.load(f)
        config = deep_merge(config, project_config)

    return config


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Deep merge override into base config."""
    result = base.copy()

    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value

    return result


def get_config_value(config: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """Get nested config value with dot-path support."""
    current = config

    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default

    return current
