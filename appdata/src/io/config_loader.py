"""
AppDater - Configuration Loader
Loads and validates YAML configuration files.
"""

from pathlib import Path
from typing import Dict, Any
import yaml


class ConfigLoader:
    """Loads and manages configuration"""

    DEFAULT_CONFIG = {
        'safety': {
            'min_disk_free_gb': 10,
            'warn_disk_free_gb': 20,
            'max_ram_usage_pct': 85
        },
        'processing': {
            'supported_extensions': ['.dmg', '.pkg', '.iso'],
            'skip_hidden_files': True,
            'recursive': True
        },
        'renaming': {
            'remove_intel_files': True,
            'remove_release_tags': True,
            'use_date_fallback': True
        },
        'logging': {
            'log_dir': './logs',
            'restore_dir': './restore',
            'keep_logs_days': 30
        },
        'duplicates': {
            'auto_delete': False,  # Safety: require explicit confirmation
            'keep_newest': True
        }
    }

    def __init__(self, config_path: Path = None):
        """
        Initialize configuration loader

        Args:
            config_path: Path to YAML config file (optional)
        """
        self.config_path = config_path
        self.config = self.DEFAULT_CONFIG.copy()

        if config_path and Path(config_path).exists():
            self.load(config_path)

    def load(self, config_path: Path) -> Dict[str, Any]:
        """
        Load configuration from YAML file

        Args:
            config_path: Path to YAML config file

        Returns:
            Loaded configuration dictionary
        """
        try:
            with open(config_path, 'r') as f:
                user_config = yaml.safe_load(f)

            # Merge user config with defaults
            if user_config:
                self.config = self._merge_configs(self.DEFAULT_CONFIG, user_config)

            return self.config

        except yaml.YAMLError as e:
            print(f"⚠️  Error loading config file: {e}")
            print("   Using default configuration")
            return self.DEFAULT_CONFIG

        except Exception as e:
            print(f"⚠️  Unexpected error loading config: {e}")
            print("   Using default configuration")
            return self.DEFAULT_CONFIG

    def _merge_configs(self, default: Dict, user: Dict) -> Dict:
        """
        Merge user config with default config

        Args:
            default: Default configuration
            user: User configuration

        Returns:
            Merged configuration
        """
        merged = default.copy()

        for key, value in user.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                merged[key] = self._merge_configs(merged[key], value)
            else:
                # Override with user value
                merged[key] = value

        return merged

    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get configuration value by dot-separated path

        Args:
            key_path: Dot-separated path (e.g., 'safety.min_disk_free_gb')
            default: Default value if key not found

        Returns:
            Configuration value

        Examples:
            >>> config = ConfigLoader()
            >>> config.get('safety.min_disk_free_gb')
            10
            >>> config.get('safety.unknown_key', 'default_value')
            'default_value'
        """
        keys = key_path.split('.')
        value = self.config

        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default

        return value

    def save(self, output_path: Path):
        """
        Save current configuration to YAML file

        Args:
            output_path: Path to save config file
        """
        try:
            with open(output_path, 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False, sort_keys=False)

            print(f"✓ Configuration saved to: {output_path}")

        except Exception as e:
            print(f"❌ Error saving configuration: {e}")

    def validate(self) -> bool:
        """
        Validate configuration values

        Returns:
            True if configuration is valid
        """
        errors = []

        # Validate safety settings
        min_disk = self.get('safety.min_disk_free_gb', 0)
        if min_disk < 1:
            errors.append("safety.min_disk_free_gb must be at least 1")

        # Validate extensions
        extensions = self.get('processing.supported_extensions', [])
        if not extensions:
            errors.append("processing.supported_extensions cannot be empty")

        # Validate log directories
        log_dir = self.get('logging.log_dir')
        if not log_dir:
            errors.append("logging.log_dir cannot be empty")

        if errors:
            print("❌ Configuration validation errors:")
            for error in errors:
                print(f"   - {error}")
            return False

        return True

    def print_config(self):
        """Print current configuration"""
        print("\n" + "=" * 60)
        print("CURRENT CONFIGURATION")
        print("=" * 60)
        print(yaml.dump(self.config, default_flow_style=False, sort_keys=False))
        print("=" * 60)
