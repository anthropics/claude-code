"""
Claude Code Hook Integration for Zero-Trust Security Framework
"""
import sys
import json
import re
from typing import Dict, Tuple, Optional, List
from .processor import ZeroTrustProcessor
from .secret_detection import SecretMatch

class ClaudeCodeHook:
    """Integration with Claude Code's hook system"""
    
    def __init__(self):
        self.processor = ZeroTrustProcessor()
    
    def process_tool_call(self, tool_call: Dict) -> Tuple[Optional[Dict], Dict[str, str]]:
        """
        Process a tool call and sanitize it if needed
        
        Args:
            tool_call: Tool call dictionary from Claude Code
            
        Returns:
            Tuple of (modified_tool_call, placeholder_mapping)
            Returns (None, {}) if no modification was needed
        """
        tool_name = tool_call.get("tool_name", "")
        tool_input = tool_call.get("tool_input", {})
        
        if not tool_name or not tool_input:
            return None, {}
        
        modified_tool_input = tool_input.copy()
        placeholder_mapping = {}
        modified = False
        
        # Process based on tool type
        if tool_name == "Bash":
            command = tool_input.get("command", "")
            if command:
                safe_command, mapping = self.processor.process_content(command)
                if mapping:
                    modified_tool_input["command"] = safe_command
                    placeholder_mapping.update(mapping)
                    modified = True
                    
        elif tool_name == "ReadFile":
            # For file reading, we might want to process the file content
            # This would require actual file access, so we'll pass through for now
            pass
        
        elif tool_name == "WriteFile":
            # For file writing, process the content being written
            content = tool_input.get("content", "")
            if content:
                safe_content, mapping = self.processor.process_content(content)
                if mapping:
                    modified_tool_input["content"] = safe_content
                    placeholder_mapping.update(mapping)
                    modified = True
        
        if modified:
            return {**tool_call, "tool_input": modified_tool_input}, placeholder_mapping
        else:
            return None, {}
    
    def validate_response(self, response: str) -> bool:
        """
        Validate Claude's response for security compliance
        
        Args:
            response: Response text from Claude
            
        Returns:
            True if response is compliant, False otherwise
        """
        # Check for unverified claims in response
        unverified_claims = self._extract_unverified_claims(response)
        return len(unverified_claims) == 0
    
    def _extract_unverified_claims(self, text: str) -> List[str]:
        """
        Extract potentially unverified claims from text
        
        Args:
            text: Text to analyze
            
        Returns:
            List of potential unverified claims
        """
        claim_patterns = [
            r'\b(several|many|multiple|various)\b.*\b(exist|available|servers?|tools?|systems?)\b',
            r'\bi found\b.*\b(servers?|tools?|systems?|evidence)\b',
            r'\bsearch reveals?\b.*\b(exist|available|show)\b',
            r'\bresults? shows?\b.*\b(exist|available|that)\b',
            r'\bthere are\b.*\b(servers?|tools?|systems?)\b'
        ]
        
        found_claims = []
        text_lower = text.lower()
        
        for pattern in claim_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                # Extract the broader context around the match
                for match in re.finditer(pattern, text_lower, re.IGNORECASE):
                    start = max(0, match.start() - 50)
                    end = min(len(text), match.end() + 50)
                    context = text[start:end].strip()
                    found_claims.append(context)
        
        return found_claims

def main():
    """
    Main entry point for Claude Code hook integration
    """
    try:
        # Read tool call from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            sys.exit(0)
        
        # Parse JSON input
        try:
            tool_call = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(f"Zero-Trust Hook Error: Invalid JSON input - {str(e)}", file=sys.stderr)
            sys.exit(1)
        
        # Process the tool call
        hook = ClaudeCodeHook()
        modified_call, mapping = hook.process_tool_call(tool_call)
        
        # Output results
        if modified_call:
            # Output modified tool call to stdout (sent to Claude)
            json.dump(modified_call, sys.stdout)
            print()  # Add newline
            
            # Log placeholder mapping to stderr (visible to user)
            if mapping:
                print("\n🔒 ZERO-TRUST SECURITY: Replaced real secrets with placeholders", file=sys.stderr)
                print("Real secrets are kept local-only for security.", file=sys.stderr)
                shown_count = 0
                for placeholder, real_value in list(mapping.items())[:3]:  # Show first 3
                    masked_real = real_value[:8] + "..." if len(real_value) > 11 else real_value[:3] + "..."
                    print(f"  • {placeholder} → {masked_real}", file=sys.stderr)
                    shown_count += 1
                if len(mapping) > 3:
                    print(f"  ... and {len(mapping) - 3} more", file=sys.stderr)
                print("For full details, check the local placeholder mapping.", file=sys.stderr)
            
            sys.exit(0)
        else:
            # No modifications needed, exit with code that allows normal execution
            sys.exit(0)
            
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception as e:
        # Log error but don't fail silently in a way that breaks Claude Code
        print(f"Zero-Trust Hook Warning: Internal error - {str(e)}", file=sys.stderr)
        print("Falling back to permissive mode.", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()