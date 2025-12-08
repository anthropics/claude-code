# Telemetry Fix Plugin

Diagnostic tools and workarounds for telemetry connection issues in Claude Code, including DNS failures for monitoring services like Datadog.

> **Note**: This plugin resolves issue [#13272](https://github.com/anthropics/claude-code/issues/13272) where users experienced repeated DNS errors (`getaddrinfo ENOTFOUND http-intake.logs.datadoghq.com`) that didn't affect core functionality but cluttered error logs.

## Overview

Claude Code sends telemetry data to monitoring services for analytics and error tracking. When these connections fail due to network restrictions, DNS issues, or connectivity problems, error logs can accumulate without affecting core functionality.

**This plugin helps you:**
- Diagnose telemetry connection issues
- Apply workarounds to suppress non-critical errors
- Configure Claude Code to work better in restricted networks

## Common Symptoms

You may see repeated errors like:
```
Error: getaddrinfo ENOTFOUND http-intake.logs.datadoghq.com
```

**These errors don't affect Claude Code's core functionality**, but they:
- Clutter error logs
- Waste network resources with retry attempts
- May trigger security alerts in corporate environments

## Quick Fix

The fastest way to resolve telemetry issues is to disable non-essential network traffic:

### Environment Variable

Set this environment variable before starting Claude Code:

**macOS/Linux (bash/zsh):**
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

**macOS/Linux:**
Add to your `~/.bashrc`, `~/.zshrc`, or `~/.profile`:
```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

**Windows (PowerShell):**
Add to your PowerShell profile (`$PROFILE`):
```powershell
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "true"
```

Or set as a system environment variable through Windows Settings.

## Commands

### `/telemetry-fix:diagnose`

Diagnoses telemetry connection issues and provides specific recommendations.

**Usage:**
```bash
/telemetry-fix:diagnose
```

**What it checks:**
- Environment variable configuration
- Network connectivity to telemetry endpoints
- DNS resolution capabilities
- Proxy configuration
- Common network restrictions

### `/telemetry-fix:disable`

Quick command to disable telemetry for the current session.

**Usage:**
```bash
/telemetry-fix:disable
```

Equivalent to running:
```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
```

## Related Environment Variables

Claude Code supports several environment variables for network configuration:

| Variable | Purpose | Since Version |
|----------|---------|---------------|
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disables telemetry and release notes fetching | 2.0.17 |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | Enables proxy DNS resolution (opt-in) | 2.0.55 |
| `HTTP_PROXY` / `HTTPS_PROXY` | Configure HTTP proxy | 2.0.26 |
| `NO_PROXY` | Bypass proxy for specific hosts | 1.0.90 |

## Troubleshooting

### Error Persists After Setting Environment Variable

1. **Verify the variable is set:**
   ```bash
   echo $CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC  # macOS/Linux
   echo %CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC% # Windows CMD
   $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC   # Windows PowerShell
   ```

2. **Restart Claude Code** after setting the variable

3. **Check for typos** - the variable name is case-sensitive

### Corporate Network / Firewall Issues

If you're on a corporate network:

1. **Work with IT** to whitelist these domains (if you want telemetry):
   - `*.datadoghq.com`
   - `*.anthropic.com`
   - `*.claude.ai`

2. **Configure proxy** if your network requires it:
   ```bash
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   export NO_PROXY=localhost,127.0.0.1
   ```

3. **Use offline mode** with the disable flag as shown above

### VPN Issues

Some VPNs block or redirect DNS queries:

1. Try disabling VPN temporarily to test
2. Configure VPN to allow `*.datadoghq.com` 
3. Use the `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` workaround

## Why This Happens

Telemetry failures occur when:

1. **DNS Resolution Fails**
   - Corporate DNS doesn't resolve external domains
   - VPN blocks certain DNS queries
   - DNS server is unreachable

2. **Network Restrictions**
   - Firewall blocks connections to monitoring services
   - Proxy configuration doesn't include telemetry endpoints
   - Geographic restrictions on certain domains

3. **Offline Usage**
   - No internet connection
   - Limited connectivity

## Impact on Privacy

**Disabling telemetry:**
- ✅ Reduces network traffic
- ✅ Works in offline/restricted environments
- ✅ No impact on core Claude Code functionality
- ⚠️ Anthropic won't receive usage data or error reports
- ⚠️ May delay bug fixes for issues you encounter

See [Data Usage Policies](https://docs.anthropic.com/en/docs/claude-code/data-usage) for details.

## Reporting Issues

If you continue to experience problems:

1. Use `/bug` command in Claude Code to report the issue
2. Include error messages and your network environment details
3. File an issue at: https://github.com/anthropics/claude-code/issues
4. Join the [Claude Developers Discord](https://anthropic.com/discord)

## Contributing

Found a better solution? Contributions welcome! See the main repository's contribution guidelines.

## Version History

**v1.0.0** (December 2025)
- Initial release
- Added `/telemetry-fix:diagnose` command for comprehensive diagnostics
- Added `/telemetry-fix:disable` command for quick telemetry disable
- Cross-platform support (Windows, macOS, Linux)
- Resolves issue #13272

## References

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Data Usage Policies](https://docs.anthropic.com/en/docs/claude-code/data-usage)
- [Issue #13272](https://github.com/anthropics/claude-code/issues/13272) - Original report

## Contributing

This plugin was created to help users experiencing telemetry connection issues. If you have suggestions for improvements or encounter issues, please open an issue in the main repository.
