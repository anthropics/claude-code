"""Tests for utils/config.py"""

import json
from pathlib import Path

from utils.config import deep_merge, get_config_value, load_config


class TestDeepMerge:
    """Tests for the deep_merge function."""

    def test_merge_simple_dicts(self):
        """Test merging simple dictionaries."""
        base = {"a": 1, "b": 2}
        override = {"b": 3, "c": 4}
        result = deep_merge(base, override)

        assert result == {"a": 1, "b": 3, "c": 4}

    def test_merge_nested_dicts(self):
        """Test merging nested dictionaries."""
        base = {
            "verifiers": {
                "tests_pass": {"enabled": True, "timeout": 60},
                "lint_clean": {"enabled": True}
            }
        }
        override = {
            "verifiers": {
                "tests_pass": {"timeout": 120}
            }
        }
        result = deep_merge(base, override)

        assert result["verifiers"]["tests_pass"]["enabled"] is True
        assert result["verifiers"]["tests_pass"]["timeout"] == 120
        assert result["verifiers"]["lint_clean"]["enabled"] is True

    def test_override_replaces_non_dict(self):
        """Test that non-dict values are replaced entirely."""
        base = {"a": [1, 2, 3]}
        override = {"a": [4, 5]}
        result = deep_merge(base, override)

        assert result["a"] == [4, 5]

    def test_base_unchanged(self):
        """Test that base dict is not mutated."""
        base = {"a": 1}
        override = {"a": 2}
        deep_merge(base, override)

        assert base["a"] == 1


class TestGetConfigValue:
    """Tests for the get_config_value function."""

    def test_get_simple_value(self):
        """Test getting a simple value."""
        config = {"debug": True}
        assert get_config_value(config, "debug") is True

    def test_get_nested_value(self):
        """Test getting a nested value."""
        config = {
            "behavior": {
                "max_retries": 3
            }
        }
        assert get_config_value(config, "behavior", "max_retries") == 3

    def test_get_deeply_nested_value(self):
        """Test getting a deeply nested value."""
        config = {
            "verifiers": {
                "tests_pass": {
                    "timeout": 60
                }
            }
        }
        assert get_config_value(config, "verifiers", "tests_pass", "timeout") == 60

    def test_missing_key_returns_default(self):
        """Test that missing keys return the default value."""
        config = {"a": 1}
        assert get_config_value(config, "b", default="default") == "default"

    def test_missing_nested_key_returns_default(self):
        """Test that missing nested keys return the default value."""
        config = {"a": {"b": 1}}
        assert get_config_value(config, "a", "c", default=None) is None

    def test_default_is_none_by_default(self):
        """Test that the default default is None."""
        config = {}
        assert get_config_value(config, "missing") is None


class TestLoadConfig:
    """Tests for the load_config function."""

    def test_load_default_config(self, temp_project_dir, temp_dir):
        """Test loading default configuration."""
        # Create a plugin root with default config
        plugin_root = Path(temp_dir) / "plugin"
        config_dir = plugin_root / "config"
        config_dir.mkdir(parents=True)

        default_config = {
            "verifiers": {
                "tests_pass": {"enabled": True, "timeout": 60}
            },
            "debug": False
        }
        with open(config_dir / "default_config.json", 'w') as f:
            json.dump(default_config, f)

        config = load_config(temp_project_dir, str(plugin_root))

        assert config["verifiers"]["tests_pass"]["enabled"] is True
        assert config["verifiers"]["tests_pass"]["timeout"] == 60

    def test_project_override(self, temp_project_dir, temp_dir):
        """Test that project config overrides defaults."""
        # Create plugin root with default config
        plugin_root = Path(temp_dir) / "plugin"
        config_dir = plugin_root / "config"
        config_dir.mkdir(parents=True)

        default_config = {
            "verifiers": {
                "tests_pass": {"enabled": True, "timeout": 60}
            },
            "debug": False
        }
        with open(config_dir / "default_config.json", 'w') as f:
            json.dump(default_config, f)

        # Create project override
        project_claude_dir = Path(temp_project_dir) / ".claude"
        project_claude_dir.mkdir()
        project_config = {
            "verifiers": {
                "tests_pass": {"timeout": 120}
            },
            "debug": True
        }
        with open(project_claude_dir / "verify-claims.json", 'w') as f:
            json.dump(project_config, f)

        config = load_config(temp_project_dir, str(plugin_root))

        # Default values should be preserved
        assert config["verifiers"]["tests_pass"]["enabled"] is True
        # Overridden values should be updated
        assert config["verifiers"]["tests_pass"]["timeout"] == 120
        assert config["debug"] is True

    def test_missing_default_config(self, temp_project_dir, temp_dir):
        """Test loading with missing default config."""
        plugin_root = Path(temp_dir) / "plugin"
        plugin_root.mkdir()

        config = load_config(temp_project_dir, str(plugin_root))
        assert config == {}

    def test_missing_project_config(self, temp_project_dir, temp_dir):
        """Test loading with missing project config."""
        plugin_root = Path(temp_dir) / "plugin"
        config_dir = plugin_root / "config"
        config_dir.mkdir(parents=True)

        default_config = {"debug": False}
        with open(config_dir / "default_config.json", 'w') as f:
            json.dump(default_config, f)

        config = load_config(temp_project_dir, str(plugin_root))
        assert config["debug"] is False
