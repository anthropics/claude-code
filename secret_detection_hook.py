#!/usr/bin/env python3
"""
Claude Code Security Hook for Issue #2695
==========================================
Client-side secret detection to prevent transmission of sensitive data.

This hook:
1. Detects secrets in tool inputs before transmission
2. Provides clear feedback to users about what was detected  
3. Blocks execution to prevent secret transmission
4. Guides users to remove secrets and retry

Addresses Issue #2695: Zero-Trust Architecture for Environment Variable Security
"""

import json
import sys
import re
import os
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

# Secret detection patterns
SECRET_PATTERNS = {
    'OPENAI_API_KEY': r'sk-[a-zA-Z0-9]{40,}',
    'ANTHROPIC_API_KEY': r'sk-ant-[a-zA-Z0-9_-]{95,}',
    'GITHUB_TOKEN': r'(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})',
    'AWS_ACCESS_KEY': r'AKIA[0-9A-Z]{16}',
    'AWS_SECRET_KEY': r'[A-Za-z0-9/+=]{40}',
    'SLACK_BOT_TOKEN': r'xoxb-[0-9]+-[0-9]+-[0-9]+-[a-z0-9]+',
    'POSTGRESQL_URL': r'postgres://[^:]+:[^@]+@[^/]+/[^?\s]+',
    'MYSQL_URL': r'mysql://[^:]+:[^@]+@[^/]+/[^?\s]+',
    'MONGODB_URL': r'mongodb://[^:]+:[^@]+@[^/]+/[^?\s]+',
    'REDIS_URL': r'redis://[^:]+:[^@]+@[^/]+',
    'JWT_TOKEN': r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
    'GENERIC_SECRET': r'[A-Za-z0-9+/=_-]{32,}'
}

# Environment variable names that commonly contain secrets
SENSITIVE_ENV_VARS = {
    'API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE_KEY',
    'DATABASE_URL', 'DB_PASSWORD', 'DB_USER', 'DB_HOST',
    'REDIS_URL', 'MONGO_URI', 'MONGODB_URI',
    'AWS_SECRET', 'AWS_ACCESS', 'AZURE_CLIENT',
    'GOOGLE_CLIENT', 'OAUTH', 'AUTH',
    'PRIVATE', 'CREDENTIAL', 'CERT', 'KEY',
    'SESSION_SECRET', 'ENCRYPTION_KEY'
}

def log_detection(detected_secrets: List[Tuple[str, str]], command: str, tool_name: str):
    """Log secret detection for audit purposes"""
    try:
        audit_dir = os.path.expanduser("~/.claude-code-security")
        os.makedirs(audit_dir, exist_ok=True)
        audit_file = os.path.join(audit_dir, "secret_detections.jsonl")
        
        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tool": tool_name,
            "command_hash": hash(command) % (10**8),  # Hash for privacy
            "secrets_detected": len(detected_secrets),
            "secret_types": [secret_type for secret_type, _ in detected_secrets],
            "blocked": True
        }
        
        with open(audit_file, "a", encoding='utf-8') as f:
            f.write(json.dumps(audit_entry, ensure_ascii=False) + "\n")
    except (OSError, PermissionError, IOError):
        # Fail gracefully if can't write audit log
        # Still block the command, just without logging
        pass

def detect_secrets_in_text(text: str) -> List[Tuple[str, str]]:
    """Detect secrets in text using pattern matching"""
    detected = []
    
    for secret_type, pattern in SECRET_PATTERNS.items():
        matches = re.findall(pattern, text)
        for match in matches:
            detected.append((secret_type, match[:10] + "..."))  # Truncate for display
    
    return detected

def check_environment_variables(command: str) -> List[Tuple[str, str]]:
    """Check for sensitive environment variable references"""
    detected = []
    
    # Find environment variable references: $VAR or ${VAR}
    env_refs = re.findall(r'\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?', command)
    
    for var_name in env_refs:
        upper_name = var_name.upper()
        for sensitive_pattern in SENSITIVE_ENV_VARS:
            if sensitive_pattern in upper_name:
                detected.append(("SENSITIVE_ENV_VAR", f"${var_name}"))
                break
    
    return detected

def analyze_tool_call(tool_call: Dict[str, Any]) -> List[Tuple[str, str]]:
    """Analyze tool call for secrets"""
    detected_secrets = []
    
    tool_name = tool_call.get("tool_name", "")
    tool_input = tool_call.get("tool_input", {})
    
    # Check different input fields based on tool type
    text_to_check = []
    
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        text_to_check.append(command)
        # Also check for environment variable references
        detected_secrets.extend(check_environment_variables(command))
    
    elif tool_name == "Read":
        file_path = tool_input.get("file_path", "")
        # Check if reading potentially sensitive files
        if any(sensitive in file_path.lower() for sensitive in ['.env', 'secret', 'config', 'credential']):
            detected_secrets.append(("SENSITIVE_FILE", file_path))
    
    elif tool_name == "Write":
        content = tool_input.get("content", "")
        text_to_check.append(content)
    
    elif tool_name == "Edit":
        new_string = tool_input.get("new_string", "")
        text_to_check.append(new_string)
    
    # Check all text for secret patterns
    for text in text_to_check:
        if text:
            detected_secrets.extend(detect_secrets_in_text(text))
    
    return detected_secrets

def main():
    """Main hook execution"""
    try:
        # Read tool call from stdin
        input_data = sys.stdin.read().strip()
        
        if not input_data:
            sys.exit(0)  # Allow if no input
        
        # Parse JSON
        tool_call = json.loads(input_data)
        
        # Analyze for secrets
        detected_secrets = analyze_tool_call(tool_call)
        
        if detected_secrets:
            tool_name = tool_call.get("tool_name", "unknown")
            command = str(tool_call.get("tool_input", {}))
            
            # Log the detection
            log_detection(detected_secrets, command, tool_name)
            
            # Print security alert
            print("🔒 CLAUDE CODE SECURITY ALERT", file=sys.stderr)
            print("=" * 50, file=sys.stderr)
            print("⚠️  Secrets detected in tool usage!", file=sys.stderr)
            print("", file=sys.stderr)
            
            print("Detected secrets:", file=sys.stderr)
            for secret_type, preview in detected_secrets:
                print(f"  • {secret_type}: {preview}", file=sys.stderr)
            
            print("", file=sys.stderr)
            print("🛡️  Zero-trust policy prevents transmission of secrets to AI systems.", file=sys.stderr)
            print("", file=sys.stderr)
            print("To proceed:", file=sys.stderr)
            print("1. Remove or mask sensitive values", file=sys.stderr)
            print("2. Use environment variables safely (avoid echoing secrets)", file=sys.stderr)
            print("3. Consider using placeholder values for demonstration", file=sys.stderr)
            print("", file=sys.stderr)
            print(f"📝 Detection logged to: ~/.claude-code-security/secret_detections.jsonl", file=sys.stderr)
            
            # Block execution
            sys.exit(2)
        
        # Allow execution if no secrets detected
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Invalid JSON - allow execution (fail open)
        sys.exit(0)
    except Exception as e:
        # Any other error - allow execution (fail open)
        print(f"Security hook error: {e}", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()