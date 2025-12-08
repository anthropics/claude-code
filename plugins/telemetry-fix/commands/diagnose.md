---
description: Diagnose telemetry connection issues and get specific recommendations
allowed-tools: ["Bash", "Read", "Write"]
---

# Telemetry Diagnostics

Run comprehensive diagnostics to identify and resolve telemetry connection issues.

## Steps

### 1. Check Environment Variables

Use Bash tool to check if telemetry is already disabled:

**macOS/Linux:**
```bash
echo "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=$CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"
echo "HTTP_PROXY=$HTTP_PROXY"
echo "HTTPS_PROXY=$HTTPS_PROXY"
echo "NO_PROXY=$NO_PROXY"
echo "CLAUDE_CODE_PROXY_RESOLVES_HOSTS=$CLAUDE_CODE_PROXY_RESOLVES_HOSTS"
```

**Windows:**
```powershell
Write-Host "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"
Write-Host "HTTP_PROXY=$env:HTTP_PROXY"
Write-Host "HTTPS_PROXY=$env:HTTPS_PROXY"
Write-Host "NO_PROXY=$env:NO_PROXY"
Write-Host "CLAUDE_CODE_PROXY_RESOLVES_HOSTS=$env:CLAUDE_CODE_PROXY_RESOLVES_HOSTS"
```

### 2. Test DNS Resolution

Check if telemetry endpoints can be resolved:

**macOS/Linux:**
```bash
nslookup http-intake.logs.datadoghq.com 2>&1 || echo "DNS resolution failed"
```

**Windows:**
```powershell
try { Resolve-DnsName http-intake.logs.datadoghq.com -ErrorAction Stop; Write-Host "✓ DNS resolves successfully" } catch { Write-Host "✗ DNS resolution failed: $_" }
```

### 3. Test Network Connectivity

Attempt to reach the telemetry endpoint:

**macOS/Linux:**
```bash
curl -I --connect-timeout 5 https://http-intake.logs.datadoghq.com 2>&1 || echo "Connection failed"
```

**Windows:**
```powershell
try { $response = Invoke-WebRequest -Uri "https://http-intake.logs.datadoghq.com" -Method Head -TimeoutSec 5 -ErrorAction Stop; Write-Host "✓ Connection successful" } catch { Write-Host "✗ Connection failed: $_" }
```

### 4. Analyze Results

Based on the diagnostic results:

**If CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is already set:**
- Inform user telemetry is disabled
- Explain that errors should not appear
- If errors persist, recommend restarting Claude Code

**If DNS fails:**
- Recommend setting `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true`
- Explain DNS is blocked/unreachable
- Suggest checking network/VPN/firewall settings

**If DNS works but connection fails:**
- Recommend checking firewall rules
- Suggest proxy configuration might be needed
- Provide example proxy setup commands

**If everything works:**
- Issue may be intermittent
- Recommend monitoring for recurring errors
- Suggest checking Claude Code logs for more details

### 5. Provide Actionable Recommendations

Based on diagnosis, tell the user:

**Immediate fix:**
```bash
# For this session (macOS/Linux):
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true

# For this session (Windows PowerShell):
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"

# Then restart Claude Code
```

**Permanent fix:**
Add to shell profile (`~/.bashrc`, `~/.zshrc`, `~/.profile`, or PowerShell `$PROFILE`):
```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

**Alternative - If telemetry is needed:**
Work with IT team to whitelist:
- `*.datadoghq.com`
- `*.anthropic.com` 
- `*.claude.ai`

### 6. Create Helper Script (Optional)

Offer to create a helper script that sets the environment variable:

**macOS/Linux (`~/.claude_config`):**
```bash
#!/bin/bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
echo "✓ Claude Code telemetry disabled"
```

**Windows (`~/.claude_config.ps1`):**
```powershell
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"
Write-Host "✓ Claude Code telemetry disabled"
```

Instruct user to source this before running Claude Code.

## Output Format

Present findings in clear sections:

```
🔍 Telemetry Diagnostic Results
================================

Environment Configuration:
- CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: [value or "not set"]
- Proxy configured: [yes/no]

Network Tests:
- DNS Resolution: [✓ Pass / ✗ Fail]
- Network Connectivity: [✓ Pass / ✗ Fail]

📋 Diagnosis:
[Explanation of what's wrong]

✨ Recommended Fix:
[Specific commands to run]

📚 Documentation:
- See /telemetry-fix:disable for quick fix
- Full details: plugins/telemetry-fix/README.md
```

## Error Handling

- If Bash/PowerShell commands fail, explain the issue gracefully
- Don't assume user has admin/sudo privileges
- Provide both temporary and permanent solutions
- Link to plugin README for full documentation
