"""
Universal Secret Detection Engine
================================
Extracted from Claude Code security hook implementation.
Provides configurable secret pattern detection for any system.
"""

import re
import hashlib
import json
import os
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum

class SecurityLevel(Enum):
    """Security enforcement levels"""
    FAIL_SAFE = "fail_safe"      # Allow on errors (user-friendly)
    FAIL_SECURE = "fail_secure"  # Block on errors (zero-trust)

@dataclass
class SecretPattern:
    """Secret detection pattern configuration"""
    name: str
    pattern: str
    description: str
    risk_level: str = "high"

@dataclass 
class DetectionResult:
    """Result of secret detection analysis"""
    secrets_found: List[Tuple[str, str]]  # (value, type) pairs
    blocked: bool
    risk_score: int
    audit_data: Dict[str, Any]

class SecretDetector:
    """Universal secret detection engine"""
    
    # Standard secret patterns extracted from production
    DEFAULT_PATTERNS = {
        'OPENAI_API_KEY': SecretPattern(
            'OPENAI_API_KEY', 
            r'sk-[a-zA-Z0-9]{40,}',
            'OpenAI API keys'
        ),
        'ANTHROPIC_API_KEY': SecretPattern(
            'ANTHROPIC_API_KEY',
            r'sk-ant-[a-zA-Z0-9_-]{95,}', 
            'Anthropic API keys'
        ),
        'GITHUB_TOKEN': SecretPattern(
            'GITHUB_TOKEN',
            r'(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})',
            'GitHub personal access tokens'
        ),
        'AWS_ACCESS_KEY': SecretPattern(
            'AWS_ACCESS_KEY',
            r'AKIA[0-9A-Z]{16}',
            'AWS access keys'
        ),
        'AWS_SECRET_KEY': SecretPattern(
            'AWS_SECRET_KEY', 
            r'[A-Za-z0-9/+=]{40}',
            'AWS secret keys'
        ),
        'SLACK_BOT_TOKEN': SecretPattern(
            'SLACK_BOT_TOKEN',
            r'xoxb-[0-9]+-[0-9]+-[0-9]+-[a-z0-9]+',
            'Slack bot tokens'
        ),
        'POSTGRESQL_URL': SecretPattern(
            'POSTGRESQL_URL',
            r'postgres://[^:]+:[^@]+@[^/]+/[^?\s]+',
            'PostgreSQL connection strings'
        ),
        'MYSQL_URL': SecretPattern(
            'MYSQL_URL',
            r'mysql://[^:]+:[^@]+@[^/]+/[^?\s]+',
            'MySQL connection strings'
        ),
        'MONGODB_URL': SecretPattern(
            'MONGODB_URL', 
            r'mongodb://[^:]+:[^@]+@[^/]+/[^?\s]+',
            'MongoDB connection strings'
        ),
        'REDIS_URL': SecretPattern(
            'REDIS_URL',
            r'redis://[^:]+:[^@]+@[^/]+',
            'Redis connection strings'
        ),
        'JWT_TOKEN': SecretPattern(
            'JWT_TOKEN',
            r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
            'JSON Web Tokens'
        ),
        'GENERIC_SECRET': SecretPattern(
            'GENERIC_SECRET',
            r'[A-Za-z0-9+/=_-]{32,}',
            'Generic high-entropy secrets'
        )
    }
    
    # Sensitive environment variable indicators  
    SENSITIVE_ENV_PATTERNS = {
        'API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE_KEY',
        'DATABASE_URL', 'DB_PASSWORD', 'DB_USER', 'DB_HOST',
        'REDIS_URL', 'MONGO_URI', 'MONGODB_URI',
        'AWS_SECRET', 'AWS_ACCESS', 'AZURE_CLIENT',
        'GOOGLE_CLIENT', 'OAUTH', 'AUTH',
        'PRIVATE', 'CREDENTIAL', 'CERT', 'KEY',
        'SESSION_SECRET', 'ENCRYPTION_KEY'
    }
    
    def __init__(self, 
                 security_level: SecurityLevel = SecurityLevel.FAIL_SAFE,
                 custom_patterns: Optional[Dict[str, SecretPattern]] = None,
                 audit_dir: Optional[str] = None):
        """Initialize secret detector
        
        Args:
            security_level: How to handle errors (fail-safe vs fail-secure)
            custom_patterns: Additional patterns beyond defaults
            audit_dir: Directory for audit logs (default: ~/.zero-trust-security)
        """
        self.security_level = security_level
        self.patterns = self.DEFAULT_PATTERNS.copy()
        
        if custom_patterns:
            self.patterns.update(custom_patterns)
            
        # Setup audit directory
        if audit_dir:
            self.audit_dir = audit_dir
        else:
            self.audit_dir = os.path.expanduser("~/.zero-trust-security")
        os.makedirs(self.audit_dir, exist_ok=True)
        
    def detect_secrets_in_text(self, text: str) -> List[Tuple[str, str]]:
        """Detect secrets in text using configured patterns"""
        detected = []
        
        for pattern_name, pattern_obj in self.patterns.items():
            matches = re.finditer(pattern_obj.pattern, text, re.IGNORECASE)
            for match in matches:
                detected.append((match.group(), pattern_name))
                
        return detected
    
    def detect_sensitive_env_vars(self, text: str) -> List[Tuple[str, str]]:
        """Detect references to sensitive environment variables"""
        detected = []
        
        # Look for $VAR_NAME or ${VAR_NAME} patterns
        env_patterns = [
            r'\$([A-Z_][A-Z0-9_]*)',
            r'\$\{([A-Z_][A-Z0-9_]*)\}'
        ]
        
        for env_pattern in env_patterns:
            matches = re.finditer(env_pattern, text, re.IGNORECASE)
            for match in matches:
                var_name = match.group(1).upper()
                if any(sensitive in var_name for sensitive in self.SENSITIVE_ENV_PATTERNS):
                    detected.append((match.group(), "SENSITIVE_ENV_VAR"))
                    
        return detected
        
    def analyze_data(self, data: Any) -> DetectionResult:
        """Analyze arbitrary data for secrets
        
        Args:
            data: Data to analyze (dict, string, or other)
            
        Returns:
            DetectionResult with findings and recommendations
        """
        try:
            detected_secrets = []
            
            # Convert data to searchable text
            if isinstance(data, dict):
                text_content = self._extract_text_from_dict(data)
            elif isinstance(data, str):
                text_content = [data]
            else:
                text_content = [str(data)]
            
            # Scan all text for secrets
            for text in text_content:
                if text:
                    detected_secrets.extend(self.detect_secrets_in_text(text))
                    detected_secrets.extend(self.detect_sensitive_env_vars(text))
            
            # Calculate risk score
            risk_score = len(detected_secrets) * 10
            blocked = len(detected_secrets) > 0
            
            # Create audit data
            audit_data = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data_hash": hashlib.sha256(str(data).encode()).hexdigest()[:16],
                "secrets_count": len(detected_secrets),
                "secret_types": [secret_type for _, secret_type in detected_secrets],
                "risk_score": risk_score,
                "security_level": self.security_level.value,
                "blocked": blocked
            }
            
            # Log to audit trail
            self._log_detection(audit_data)
            
            return DetectionResult(
                secrets_found=detected_secrets,
                blocked=blocked,
                risk_score=risk_score,
                audit_data=audit_data
            )
            
        except Exception as e:
            # Handle errors according to security level
            if self.security_level == SecurityLevel.FAIL_SECURE:
                # Zero-trust: any error is suspicious
                return DetectionResult(
                    secrets_found=[("ERROR", str(e))],
                    blocked=True,
                    risk_score=100,
                    audit_data={"error": str(e), "fail_secure": True}
                )
            else:
                # Fail-safe: allow on errors
                return DetectionResult(
                    secrets_found=[],
                    blocked=False,
                    risk_score=0,
                    audit_data={"error": str(e), "fail_safe": True}
                )
                
    def _extract_text_from_dict(self, data: dict) -> List[str]:
        """Extract searchable text from dictionary data"""
        text_content = []
        
        def extract_recursive(obj):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    text_content.append(str(key))
                    extract_recursive(value)
            elif isinstance(obj, list):
                for item in obj:
                    extract_recursive(item)
            elif obj is not None:
                text_content.append(str(obj))
                
        extract_recursive(data)
        return text_content
        
    def _log_detection(self, audit_data: dict):
        """Log detection results to audit file"""
        try:
            audit_file = os.path.join(self.audit_dir, "secret_detections.jsonl")
            with open(audit_file, 'a') as f:
                f.write(json.dumps(audit_data) + "\n")
        except Exception:
            # Silently fail on audit errors (don't break main functionality)
            pass
            
    def add_custom_pattern(self, name: str, pattern: SecretPattern):
        """Add a custom secret detection pattern"""
        self.patterns[name] = pattern
        
    def remove_pattern(self, name: str):
        """Remove a secret detection pattern"""
        if name in self.patterns:
            del self.patterns[name]