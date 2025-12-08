# Fix for Telemetry DNS Errors (Issue #13272)

## Problem

Users experience repeated DNS errors that don't affect core functionality but clutter logs:

```
Error: getaddrinfo ENOTFOUND http-intake.logs.datadoghq.com
```

Occurs when Claude Code attempts telemetry connections to Datadog but encounters network restrictions, DNS failures, or connectivity issues.

## Solution

Set the `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` environment variable (available since v2.0.17):

### Quick Fix

**macOS/Linux:**
```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

**Windows (PowerShell):**
```powershell
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"
```

**Windows (CMD):**
```cmd
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

### Permanent Configuration

**macOS/Linux** - Add to `~/.bashrc`, `~/.zshrc`, or `~/.profile`:
```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

**Windows (PowerShell)** - Add to your PowerShell profile (`$PROFILE`):
```powershell
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"
```

**Windows (System)** - Set as system environment variable through Windows Settings → System → Advanced → Environment Variables.

## What This PR Does

Adds troubleshooting documentation for telemetry DNS errors (Issue #13272):
- Main README: Added "Telemetry Connection Errors" quick fix section
- Plugins README: Added telemetry-fix reference
- New plugin directory with comprehensive troubleshooting guide

## Common Scenarios

**Corporate Networks** - DNS restrictions or firewall blocks `*.datadoghq.com`  
**VPN Usage** - VPN blocks/redirects DNS queries to monitoring services  
**Offline/Air-gapped** - Limited or no internet connectivity

## Related Environment Variables

| Variable | Purpose | Since |
|----------|---------|-------|
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disables telemetry and release notes | 2.0.17 |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | Proxy DNS resolution (opt-in) | 2.0.55 |
| `HTTP_PROXY` / `HTTPS_PROXY` | HTTP proxy configuration | 2.0.26 |
| `NO_PROXY` | Bypass proxy for specific hosts | 1.0.90 |

## Testing

✅ Verified on Windows 11 (PowerShell 5.1)  
✅ Cross-platform commands validated  
✅ Environment variable behavior confirmed

## References

- [Issue #13272](https://github.com/anthropics/claude-code/issues/13272) - Original bug report
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Data Usage Policies](https://docs.anthropic.com/en/docs/claude-code/data-usage)
