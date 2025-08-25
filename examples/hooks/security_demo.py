#!/usr/bin/env python3
"""
Security Demo Hook for Claude Code
==================================
Demonstrates client-side secret detection before tool execution.
Addresses Issue #2695 with minimal proof-of-concept.

For production use, see: https://github.com/[username]/zero-trust-ai-security
"""

import json
import sys
import re

# Basic secret patterns - production library has 12+ types
SECRET_PATTERNS = {
    'OPENAI_API_KEY': r'sk-[a-zA-Z0-9]{40,}',
    'ANTHROPIC_API_KEY': r'sk-ant-[a-zA-Z0-9_-]{95,}',
    'AWS_ACCESS_KEY': r'AKIA[0-9A-Z]{16}',
}

def detect_secrets(text):
    """Detect secrets in text content"""
    secrets_found = []
    for secret_type, pattern in SECRET_PATTERNS.items():
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            secrets_found.append((match.group(), secret_type))
    return secrets_found

def main():
    """Main hook entry point"""
    try:
        # Read tool call from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            sys.exit(0)
        
        tool_call = json.loads(input_data)
        
        # Extract text content from tool call
        tool_input = tool_call.get('tool_input', {})
        text_content = json.dumps(tool_input)
        
        # Check for secrets
        secrets = detect_secrets(text_content)
        
        if secrets:
            print("🔒 SECURITY ALERT: Secrets detected!", file=sys.stderr)
            for secret, secret_type in secrets:
                masked = secret[:8] + "..." if len(secret) > 8 else "***"
                print(f"  • {secret_type}: {masked}", file=sys.stderr)
            print("\nBlocking execution to prevent secret transmission.", file=sys.stderr)
            print("For comprehensive security, see: https://github.com/[username]/zero-trust-ai-security", file=sys.stderr)
            sys.exit(2)  # Block execution
        
        # No secrets found - allow execution
        sys.exit(0)
        
    except Exception as e:
        # Fail-safe: allow execution on errors
        print(f"Security hook error: {e}", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()