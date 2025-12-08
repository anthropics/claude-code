# Fix for Telemetry DNS Errors (Issue #13272)

## Problem

Users experience repeated DNS errors that clutter logs without affecting core functionality:

```
Error: getaddrinfo ENOTFOUND http-intake.logs.datadoghq.com
```

These errors occur when Claude Code attempts to send telemetry data to Datadog monitoring services but encounters network restrictions, DNS failures, or connectivity issues. While **core functionality remains unaffected**, the errors:
- Clutter error logs
- Waste network resources on retry attempts
- May trigger security alerts in restricted environments

## Solution

Use the `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` environment variable (available since v2.0.17) to disable telemetry and other non-essential network traffic.

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

## Documentation Updates

This PR adds troubleshooting documentation to help users resolve telemetry-related errors:

1. **Main README** - Added "Telemetry Connection Errors" section under Common Issues
2. **Plugins README** - Added telemetry-fix entry to plugins table
3. **Plugin README** - Comprehensive guide with troubleshooting steps

## Common Scenarios

### Corporate Networks
- **DNS restrictions**: Corporate DNS may not resolve external monitoring domains
- **Firewall rules**: Connections to `*.datadoghq.com` may be blocked
- **Solution**: Use the environment variable or work with IT to whitelist required domains

### VPN Usage
- **DNS blocking**: Some VPNs block or redirect DNS queries to monitoring services
- **Solution**: Configure VPN allowlist or use the environment variable

### Offline/Air-gapped Environments
- **No connectivity**: System has limited or no internet access
- **Solution**: Set the environment variable to prevent connection attempts

## Related Environment Variables

| Variable | Purpose | Since |
|----------|---------|-------|
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disables telemetry and release notes | 2.0.17 |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | Proxy DNS resolution (opt-in) | 2.0.55 |
| `HTTP_PROXY` / `HTTPS_PROXY` | HTTP proxy configuration | 2.0.26 |
| `NO_PROXY` | Bypass proxy for specific hosts | 1.0.90 |

## Privacy Considerations

Disabling telemetry:
- ✅ Reduces network traffic
- ✅ Enables offline/restricted network usage
- ✅ No impact on core functionality
- ⚠️ Anthropic won't receive usage analytics or error reports
- ⚠️ May delay bug fixes for issues you encounter

See [Data Usage Policies](https://docs.anthropic.com/en/docs/claude-code/data-usage) for details.

## Testing

Verified on:
- ✅ Windows 11 (PowerShell 5.1)
- ✅ Cross-platform shell commands validated
- ✅ Environment variable behavior confirmed

## References

- [Issue #13272](https://github.com/anthropics/claude-code/issues/13272) - Original bug report
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Data Usage Policies](https://docs.anthropic.com/en/docs/claude-code/data-usage)
