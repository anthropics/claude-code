"""
Utility functions for Zero-Trust Security Framework
"""
import hashlib
import json
import logging
from typing import Any, Dict
from pathlib import Path

# Set up logging
logger = logging.getLogger(__name__)

def generate_hash(content: str) -> str:
    """
    Generate a SHA-256 hash of content
    
    Args:
        content: String content to hash
        
    Returns:
        SHA-256 hash as hexadecimal string
    """
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def load_config(config_path: str = "zero_trust_config.json") -> Dict[str, Any]:
    """
    Load configuration from JSON file
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        Configuration dictionary
    """
    config_path = Path(config_path)
    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load config from {config_path}: {e}")
            return {}
    else:
        # Return default configuration
        return {
            "zeroTrustSecurity": {
                "enabled": True,
                "secretDetection": {
                    "entropyThreshold": 3.5,
                    "contextAware": True
                },
                "placeholderFormat": "<SECRET_PLACEHOLDER_{counter}>",
                "audit": {
                    "enabled": True,
                    "logLevel": "INFO"
                }
            }
        }

def save_config(config: Dict[str, Any], config_path: str = "zero_trust_config.json"):
    """
    Save configuration to JSON file
    
    Args:
        config: Configuration dictionary
        config_path: Path to configuration file
    """
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except IOError as e:
        logger.error(f"Failed to save config to {config_path}: {e}")

def mask_sensitive_data(data: str, show_chars: int = 8) -> str:
    """
    Mask sensitive data for display
    
    Args:
        data: Sensitive data to mask
        show_chars: Number of characters to show at the beginning
        
    Returns:
        Masked data string
    """
    if len(data) <= show_chars + 3:
        return "***"
    else:
        return data[:show_chars] + "..." + data[-3:] if len(data) > show_chars + 3 else data[:show_chars] + "..."

def is_test_environment() -> bool:
    """
    Check if running in a test environment
    
    Returns:
        True if running in test environment, False otherwise
    """
    import os
    return os.environ.get('ZERO_TRUST_TESTING', '').lower() in ('1', 'true', 'yes')

def get_resource_path(relative_path: str) -> Path:
    """
    Get absolute path to resource, works for dev and for PyInstaller
    
    Args:
        relative_path: Relative path to resource
        
    Returns:
        Absolute path to resource
    """
    import sys
    import os
    
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    
    return Path(base_path) / relative_path