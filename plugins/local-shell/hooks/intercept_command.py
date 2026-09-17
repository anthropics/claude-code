#!/usr/bin/env python3
"""
Intercepts basic shell commands (like ls, watch, pwd, etc.) typed directly into Claude Code.
Runs them locally and prevents the prompt from reaching the LLM to save tokens.
"""

import sys
import json
import subprocess
import os
import shlex

# List of commands to intercept
INTERCEPT_COMMANDS = {
    "ls", "ll", "la", "pwd", "date", "whoami", "echo", "cat", "watch",
    "git", "tree", "ps", "top", "htop", "df", "free"
}

def main():
    try:
        input_data = json.load(sys.stdin)
        user_prompt = input_data.get("user_prompt", "").strip()
        cwd = input_data.get("cwd", os.getcwd())
        
        if not user_prompt:
            print(json.dumps({"continue": True}))
            return

        # Simple parsing to get the base command
        parts = shlex.split(user_prompt)
        if not parts:
            print(json.dumps({"continue": True}))
            return
            
        base_cmd = parts[0]
        
        # Check if we should intercept it
        if base_cmd in INTERCEPT_COMMANDS:
            try:
                # We want to run it with subprocess and capture output
                # For interactive commands like watch or top, we just let them run in the terminal
                # But since this is a hook, it might not have proper TTY access if captured.
                # However, for 'ls', we just capture and return as systemMessage.
                
                # If the user is running `watch -n 0.5 ls`, it is a long running command.
                # We can run it without capture, and then return a system message.
                
                # Let's write output directly to stderr so the user sees it immediately
                # Claude passes stderr through to the user.
                
                print(f"\\033[90m[local-shell] Running locally: {user_prompt}\\033[0m", file=sys.stderr)
                
                result = subprocess.run(
                    user_prompt, 
                    shell=True, 
                    cwd=cwd,
                    text=True,
                    capture_output=True
                )
                
                output = ""
                if result.stdout:
                    output += result.stdout
                if result.stderr:
                    output += result.stderr
                    
                if not output and result.returncode == 0:
                    output = "(Command executed successfully with no output)"
                elif not output:
                    output = f"(Command failed with return code {result.returncode})"
                
                # Return the result as a system message and block the LLM call
                print(json.dumps({
                    "decision": "block",
                    "reason": f"Executed local command: {base_cmd}",
                    "systemMessage": f"**Local execution result:**\n```\n{output}\n```"
                }))
                return
                
            except Exception as e:
                print(json.dumps({
                    "decision": "block",
                    "reason": "Failed to execute local command",
                    "systemMessage": f"Error executing local command: {str(e)}"
                }))
                return

        # If not in the list, just let Claude handle it
        print(json.dumps({"continue": True}))
        
    except Exception as e:
        # On any error parsing the JSON or otherwise, just let Claude continue
        print(json.dumps({"continue": True}))
        
if __name__ == "__main__":
    main()
