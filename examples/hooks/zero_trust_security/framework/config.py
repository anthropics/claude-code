"""
Configuration module for Zero-Trust Security Framework
Supports external configuration for secret patterns
"""
import json
import os
from typing import Dict, List, Any

# Default configuration
DEFAULT_CONFIG = {
    "zero_trust_security": {
        "enabled": True,
        "secret_detection": {
            "patterns": [
                {
                    "type": "openai_api_key",
                    "pattern": "sk-[a-zA-Z0-9]{48}",
                    "enabled": True,
                    "validator": "not_test_pattern"
                },
                {
                    "type": "anthropic_api_key", 
                    "pattern": "sk-ant-[a-zA-Z0-9_-]{94}R",
                    "enabled": True,
                    "validator": "not_test_pattern"
                },
                {
                    "type": "aws_access_key",
                    "pattern": "AKIA[0-9A-Z]{16}",
                    "enabled": True, 
                    "validator": "not_test_pattern"
                },
                {
                    "type": "github_token",
                    "pattern": "(ghp|github_pat)_[a-zA-Z0-9_]+",
                    "enabled": True,
                    "validator": "not_test_pattern"
                }
            ],
            "entropy_threshold": 3.5,
            "context_aware": True
        },
        "placeholder_format": "<SECRET_PLACEHOLDER_{counter}>",
        "audit": {
            "enabled": True,
            "log_level": "INFO"
        }
    }
}

def load_config(config_path: str = None) -> Dict[str, Any]:
    """
    Load configuration from file or return defaults
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        Configuration dictionary
    """
    if config_path is None:
        # Look for config in common locations
        config_paths = [
            "zero_trust_config.json",
            "~/.zero_trust_config.json",
            "/etc/zero_trust/config.json"
        ]
        
        for path in config_paths:
            expanded_path = os.path.expanduser(path)
            if os.path.exists(expanded_path):
                config_path = expanded_path
                break
    
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load config from {config_path}: {e}")
            return DEFAULT_CONFIG
    else:
        return DEFAULT_CONFIG

def save_config(config: Dict[str, Any], config_path: str = "zero_trust_config.json"):
    """
    Save configuration to file
    
    Args:
        config: Configuration dictionary
        config_path: Path to configuration file
    """
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except IOError as e:
        print(f"Error: Failed to save config to {config_path}: {e}")

def get_secret_patterns(config: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """
    Get secret patterns from configuration
    
    Args:
        config: Configuration dictionary (uses default if None)
        
    Returns:
        List of enabled secret patterns
    """
    if config is None:
        config = load_config()
    
    security_config = config.get("zero_trust_security", {})
    detection_config = security_config.get("secret_detection", {})
    patterns = detection_config.get("patterns", [])
    
    # Filter enabled patterns
    return [pattern for pattern in patterns if pattern.get("enabled", True)]

def add_secret_pattern(pattern_type: str, pattern: str, validator: str = None):
    """
    Add a new secret pattern to the configuration
    
    Args:
        pattern_type: Type of secret (e.g., "custom_api_key")
        pattern: Regex pattern to match
        validator: Validator function name
    """
    config = load_config()
    security_config = config.setdefault("zero_trust_security", {})
    detection_config = security_config.setdefault("secret_detection", {})
    patterns = detection_config.setdefault("patterns", [])
    
    # Add new pattern
    patterns.append({
        "type": pattern_type,
        "pattern": pattern,
        "enabled": True,
        "validator": validator
    })
    
    # Save updated configuration
    save_config(config)

# Example usage
if __name__ == "__main__":
    # Load current configuration
    config = load_config()
    print("Current configuration:")
    print(json.dumps(config, indent=2))
    
    # Get secret patterns
    patterns = get_secret_patterns(config)
    print(f"\nFound {len(patterns)} enabled secret patterns:")
    for pattern in patterns:
        print(f"  - {pattern['type']}: {pattern['pattern']}")