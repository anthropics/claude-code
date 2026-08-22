"""Tests for voice_to_claude.config module."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from voice_to_claude.config import Config, WHISPER_MODELS, SAMPLE_RATE


class TestConfigDefaults:
    """Test Config default values."""

    def test_default_hotkeys(self):
        config = Config()
        assert config.hotkey_ctrl is True
        assert config.hotkey_alt is True
        assert config.hotkey_shift is False
        assert config.hotkey_cmd is False

    def test_default_model(self):
        config = Config()
        assert config.model == "base"

    def test_default_output_mode(self):
        config = Config()
        assert config.output_mode == "keyboard"

    def test_default_sound_effects(self):
        config = Config()
        assert config.sound_effects is True

    def test_default_setup_not_complete(self):
        config = Config()
        assert config.setup_complete is False

    def test_default_paths_are_none(self):
        config = Config()
        assert config.whisper_cpp_path is None
        assert config.models_dir is None


class TestConfigHotkeyDescription:
    """Test Config.get_hotkey_description."""

    def test_default_hotkey(self):
        config = Config()
        assert config.get_hotkey_description() == "Ctrl+Alt"

    def test_all_modifiers(self):
        config = Config(hotkey_ctrl=True, hotkey_alt=True, hotkey_shift=True, hotkey_cmd=True)
        assert config.get_hotkey_description() == "Ctrl+Alt+Shift+Cmd"

    def test_single_modifier(self):
        config = Config(hotkey_ctrl=False, hotkey_alt=False, hotkey_shift=True, hotkey_cmd=False)
        assert config.get_hotkey_description() == "Shift"

    def test_no_modifiers(self):
        config = Config(hotkey_ctrl=False, hotkey_alt=False, hotkey_shift=False, hotkey_cmd=False)
        assert config.get_hotkey_description() == "None"


class TestConfigModelPath:
    """Test Config.get_model_path."""

    def test_with_valid_model_and_dir(self):
        config = Config(models_dir="/models", model="base")
        path = config.get_model_path()
        assert path == Path("/models/ggml-base.bin")

    def test_with_no_models_dir(self):
        config = Config(models_dir=None, model="base")
        assert config.get_model_path() is None

    def test_with_invalid_model(self):
        config = Config(models_dir="/models", model="nonexistent")
        assert config.get_model_path() is None


class TestConfigWhisperCli:
    """Test Config.get_whisper_cli."""

    def test_with_path(self):
        config = Config(whisper_cpp_path="/usr/bin/whisper-cli")
        assert config.get_whisper_cli() == Path("/usr/bin/whisper-cli")

    def test_without_path(self):
        config = Config(whisper_cpp_path=None)
        assert config.get_whisper_cli() is None


class TestConfigLoadSave:
    """Test Config load and save round-trip."""

    def test_save_and_load(self, tmp_config_dir):
        config = Config(model="medium", output_mode="clipboard", setup_complete=True)
        config.save()

        loaded = Config.load()
        assert loaded.model == "medium"
        assert loaded.output_mode == "clipboard"
        assert loaded.setup_complete is True

    def test_load_missing_file(self, tmp_config_dir):
        config = Config.load()
        # Should return defaults
        assert config.model == "base"
        assert config.setup_complete is False

    def test_load_corrupt_file(self, tmp_config_dir):
        tmp_config_dir["file"].write_text("not json {{{")
        config = Config.load()
        # Should return defaults on parse error
        assert config.model == "base"

    def test_load_ignores_unknown_fields(self, tmp_config_dir):
        data = {"model": "tiny", "unknown_field": "value", "setup_complete": True}
        tmp_config_dir["file"].write_text(json.dumps(data))
        config = Config.load()
        assert config.model == "tiny"
        assert config.setup_complete is True

    def test_save_creates_directory(self, tmp_path):
        nested_dir = tmp_path / "a" / "b" / "c"
        config_file = nested_dir / "config.json"
        with patch("voice_to_claude.config.DEFAULT_CONFIG_DIR", nested_dir), \
             patch("voice_to_claude.config.DEFAULT_CONFIG_FILE", config_file):
            config = Config(model="tiny")
            config.save()
            assert config_file.exists()


class TestWhisperModels:
    """Test whisper model definitions."""

    def test_all_models_have_required_fields(self):
        for name, info in WHISPER_MODELS.items():
            assert "file" in info, f"Model {name} missing 'file'"
            assert "size" in info, f"Model {name} missing 'size'"
            assert "url" in info, f"Model {name} missing 'url'"
            assert info["file"].endswith(".bin"), f"Model {name} file should be .bin"

    def test_base_model_exists(self):
        assert "base" in WHISPER_MODELS

    def test_sample_rate(self):
        assert SAMPLE_RATE == 16000
