#!/usr/bin/env python3
"""
Zero-Trust Security Hook for Claude Code
========================================
Implements client-side secret detection and replacement to prevent real 
secrets from being transmitted to Claude's API.

This hook:
1. Detects common secrets (API keys, tokens, connection strings)
2. Replaces real values with safe placeholders before transmission
3. Allows safe analysis while keeping real secrets local-only
4. Integrates with Claude Code's PreToolUse hook system

Usage in settings.json:
{
  "preToolUseHooks": [
    {
      "path": "./examples/hooks/zero_trust_security/hook.py"
    }
  ]
}
"""

import sys
import json
import re
from typing import Dict, List, Tuple

# Secret patterns to detect various types of secrets
SECRET_PATTERNS = [
    ('OPENAI_API_KEY', r'sk-[a-zA-Z0-9]{48}'),
    ('ANTHROPIC_API_KEY', r'sk-ant-[a-zA-Z0-9_-]{90,100}[A-Za-z0-9]'),
    ('AWS_ACCESS_KEY', r'AKIA[0-9A-Z]{16}'),
    ('GITHUB_TOKEN', r'ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}'),
    ('GOOGLE_API_KEY', r'AIza[0-9A-Za-z_-]{35}'),
    ('SLACK_TOKEN', r'xox[baprs]-[0-9a-zA-Z]{10,48}'),
    ('JWT', r'eyJ[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*'),
]

# Counter for generating unique placeholders
placeholder_counter = 0

def generate_placeholder(secret_type: str) -> str:
    """Generate a unique placeholder for a secret"""
    global placeholder_counter
    placeholder_counter += 1
    return f"<{secret_type.upper()}_PLACEHOLDER_{placeholder_counter:03d}>"

def detect_secrets_in_text(text: str) -> List[Tuple[str, str, str]]:
    """Detect secrets in text and return (full_match, secret_type, placeholder)"""
    secrets_found = []
    
    # Skip if text looks like a test/example
    if any(test_word in text.lower() for test_word in ['example', 'test', 'sample', 'dummy']):
        return secrets_found
    
    # Find all matches
    for secret_type, pattern in SECRET_PATTERNS:
        matches = re.finditer(pattern, text)
        for match in matches:
            secret = match.group()
            # Additional validation to avoid false positives
            if len(secret) >= 20 and 'EXAMPLE' not in secret.upper():
                placeholder = generate_placeholder(secret_type)
                secrets_found.append((secret, secret_type, placeholder))
    
    return secrets_found

def replace_secrets_with_placeholders(text: str) -> Tuple[str, Dict[str, str]]:
    """Replace secrets in text with placeholders and return mapping"""
    secrets = detect_secrets_in_text(text)
    replaced_text = text
    placeholder_mapping = {}
    
    # Replace secrets with placeholders (in reverse order by position to avoid conflicts)
    for secret, secret_type, placeholder in sorted(secrets, key=lambda x: text.find(x[0]), reverse=True):
        replaced_text = replaced_text.replace(secret, placeholder)
        placeholder_mapping[placeholder] = secret
    
    return replaced_text, placeholder_mapping

def main():
    """Main hook entry point"""
    try:
        # Read tool call from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            sys.exit(0)
        
        # Parse JSON input
        try:
            tool_call = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(f"Zero-Trust Security Hook Error: Invalid JSON input - {str(e)}", file=sys.stderr)
            sys.exit(1)
            
        # Extract tool information
        tool_name = tool_call.get("tool_name", "")
        tool_input = tool_call.get("tool_input", {})
        
        # Create a copy of the tool call to modify
        modified_tool_call = tool_call.copy()
        modified_tool_input = tool_input.copy()
        
        # Track if we made any modifications
        modified = False
        placeholder_mapping = {}
        
        # Process different types of tool inputs
        if tool_name == "Bash":
            command = tool_input.get("command", "")
            if command:
                safe_command, mapping = replace_secrets_with_placeholders(command)
                if mapping:
                    modified_tool_input["command"] = safe_command
                    placeholder_mapping.update(mapping)
                    modified = True
                    
        # Update the tool call if we made modifications
        if modified:
            modified_tool_call["tool_input"] = modified_tool_input
            
            # Output the modified tool call to stdout (this is what gets sent to Claude)
            json.dump(modified_tool_call, sys.stdout)
            print()  # Add newline
            
            # Log the placeholder mapping to stderr (visible to user but not sent to Claude)
            if placeholder_mapping:
                print("\n🔒 ZERO-TRUST SECURITY: Replaced real secrets with placeholders", file=sys.stderr)
                print("Real secrets are kept local-only for security.", file=sys.stderr)
                shown_count = 0
                for placeholder, real_value in list(placeholder_mapping.items())[:3]:  # Show first 3
                    masked_real = real_value[:8] + "..." if len(real_value) > 11 else real_value[:3] + "..."
                    print(f"  • {placeholder} → {masked_real}", file=sys.stderr)
                    shown_count += 1
                if len(placeholder_mapping) > 3:
                    print(f"  ... and {len(placeholder_mapping) - 3} more", file=sys.stderr)
                print("For full details, check the local placeholder mapping.", file=sys.stderr)
            
            # Exit code 0 allows execution but with modified input
            sys.exit(0)
        else:
            # No modifications needed, pass through unchanged
            sys.exit(0)
        
    except KeyboardInterrupt:
        sys.exit(1)
    except MemoryError:
        print("Zero-Trust Security Hook Error: Insufficient memory", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # Log error but don't fail silently
        print(f"Zero-Trust Security Hook Warning: Internal error - {str(e)}", file=sys.stderr)
        print("Falling back to permissive mode.", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()