---
description: Quickly disable telemetry for the current Claude Code session
allowed-tools: ["Bash"]
---

# Disable Telemetry

Disable non-essential network traffic (telemetry) for the current Claude Code session to avoid connection errors.

## Steps

### 1. Detect Operating System

Check the platform to provide OS-specific instructions:

**macOS/Linux:**
```bash
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux"* ]]; then
  echo "unix"
else
  echo "windows"
fi
```

### 2. Set Environment Variable

For the current session:

**macOS/Linux:**
```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
echo "✓ Telemetry disabled for this session"
echo ""
echo "Note: This only affects the current terminal session."
echo "To make this permanent, add the following to your shell profile:"
echo ""
echo "  export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true"
echo ""
```

**Windows PowerShell:**
```powershell
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"
Write-Host "✓ Telemetry disabled for this session" -ForegroundColor Green
Write-Host ""
Write-Host "Note: This only affects the current PowerShell session."
Write-Host "To make this permanent, add the following to your PowerShell profile:"
Write-Host ""
Write-Host '  $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"'
Write-Host ""
Write-Host "Run 'notepad `$PROFILE' to edit your PowerShell profile."
```

### 3. Verify Setting

Confirm the variable is set:

**macOS/Linux:**
```bash
if [ "$CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC" = "true" ]; then
  echo "✓ Configuration verified"
else
  echo "✗ Configuration failed - variable not set correctly"
fi
```

**Windows PowerShell:**
```powershell
if ($env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC -eq "true") {
  Write-Host "✓ Configuration verified" -ForegroundColor Green
} else {
  Write-Host "✗ Configuration failed - variable not set correctly" -ForegroundColor Red
}
```

### 4. Provide Next Steps

Tell the user:

```
🎉 Telemetry Disabled Successfully!

What this means:
- No more DNS/connection errors for telemetry services
- Claude Code core functionality unaffected
- Reduced network traffic
- Works better in restricted network environments

⚠️ Important:
- You must RESTART Claude Code for this to take effect
- This setting only applies to the current terminal/PowerShell session
- Close this window and open a new one after restarting

To make this permanent:

macOS/Linux - Add to ~/.bashrc, ~/.zshrc, or ~/.profile:
  export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true

Windows - Add to PowerShell profile ($PROFILE):
  $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"
  
  Edit with: notepad $PROFILE

Need help? Run /telemetry-fix:diagnose for full diagnostics.
```

## Important Notes

**Inform the user:**
- This disables telemetry and release notes fetching
- Claude Code will still work normally
- Anthropic won't receive usage data or error reports
- You can re-enable by unsetting the variable
- No restart needed if set before launching Claude Code

**Re-enabling telemetry:**

To re-enable telemetry later:

macOS/Linux:
```bash
unset CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
```

Windows PowerShell:
```powershell
Remove-Item Env:\CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
```

Then remove from your shell profile/PowerShell profile if you made it permanent.

## Error Handling

- If Bash command fails, provide manual instructions
- If on Windows, detect PowerShell vs CMD and adjust accordingly
- Gracefully handle cases where environment modification isn't possible
- Always provide copy-pasteable commands
