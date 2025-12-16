# VSCode Extension Installation Regression: "1: 1" Error

**Reported**: 2025-12-16
**Status**: Under Investigation
**Slack Thread**: https://anthropic.slack.com/archives/C07VBSHV7EV/p1765922691961929?thread_ts=1765922103.768169&cid=C07VBSHV7EV

## Description

Users are unable to use the VSCode IDE integration when running Claude Code in a Homespace (containerized environment). The `/ide` command initially reports success, but a few seconds later an error appears.

### Error Message

```
IDE: ✘ Error installing VS Code extension: 1: 1
      Please restart your IDE and try again.
```

## Steps to Reproduce

1. Run Claude Code in a Homespace environment
2. Execute `/ide` command
3. Observe initial success message
4. Wait a few seconds - error popup appears
5. Run `/status` to confirm the error

## Root Cause Analysis

### Error Pattern Analysis

The error message `1: 1` follows the pattern from the extension installation error handling:

```javascript
throw Error(`${result.code}: ${result.error} ${result.stderr}`)
```

For "1: 1" to appear, the values must be:
- `result.code` = 1 (exit code from VS Code CLI)
- `result.error` = "1" (incorrectly set to the exit code instead of error message)
- `result.stderr` = "" (empty)

### Regression Hypothesis

The async execution result object is incorrectly populating the `error` field with the numeric exit code instead of the actual error message from stderr. This appears to be a regression in subprocess output parsing.

### Timeline

- **Working**: Last week (user confirmed)
- **Broken**: Current version (2.0.59+)
- **Likely introduced**: Between versions 2.0.59-2.0.70

## Environment

- Running in Homespace (containerized environment)
- VSCode Remote development setup

## Temporary Workaround

If experiencing this issue, try:

1. Manually install the Claude Code extension in VS Code:
   - Open VS Code Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Type "Extensions: Install Extension"
   - Search for "Claude Code" (by Anthropic)
   - Install manually

2. After manual installation, restart your IDE and try `/ide` again

## Related Changes in CHANGELOG

Potentially relevant recent changes:
- 2.0.64: VSCode: Fixed extension not working on Windows ARM64
- 2.0.62: Fixed IDE diff tab not closing when rejecting file changes
- 2.0.61: Reverted VSCode support for multiple terminal clients
- 2.0.60: VSCode: Added support for multiple terminal clients
- 2.0.59: VS Code: Fixed .claude.json config file being read from incorrect location

## Fix Required

The fix needs to address how subprocess execution results are parsed, specifically ensuring that:
1. The `error` field contains the actual error message (from stderr), not the exit code
2. Proper error handling for when VS Code CLI fails in containerized environments
