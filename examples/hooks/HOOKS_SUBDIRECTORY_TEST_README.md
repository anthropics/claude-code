# Hooks Subdirectory Reproduction Test

## Purpose

This script helps reproduce and debug Issue #10367 and related hook execution problems when Claude Code runs from subdirectories.

## What It Tests

The script creates an isolated test environment to verify whether hooks execute correctly when Claude Code is launched from nested subdirectories vs. the home directory.

**Hook Types Tested:**
- `UserPromptSubmit` - Fires when user submits a prompt
- `PreToolUse` - Fires before tool execution (e.g., before Bash commands)
- `SessionStart` - Fires when Claude Code session starts
- `Stop` - Fires when Claude completes a response

## Usage

### Quick Test

```bash
curl -fsSL https://gist.github.com/dcversus/e18f1566a1c5515c8da56288b4975507/raw/claude-hooks-reproduction-test.sh | bash
```

### Manual Test

```bash
# Make script executable
chmod +x hooks_subdirectory_reproduction_test.sh

# Run the test
./hooks_subdirectory_reproduction_test.sh

# Follow the printed instructions
```

## What the Script Does

1. **Creates test environment** in `/tmp/claude-hooks-test-XXXXX/workspace/subdir`
2. **Generates hook scripts** that log execution to `/tmp/claude-hook-test.log`
3. **Configures both local and global settings**:
   - Local: `.claude/settings.json` in working directory
   - Global: `~/.claude/settings.json` (backs up existing)
4. **Verifies hooks work manually** before testing with Claude Code
5. **Provides step-by-step instructions** for manual verification

## Expected Results

### If Hooks Work Correctly ✅

After following the test steps, `/tmp/claude-hook-test.log` should contain entries like:

```
SessionStart: 2025-10-26 08:30:15
2025-10-26 08:30:16 - Hook executed! (UserPromptSubmit)
2025-10-26 08:30:18 - Hook executed! (PreToolUse on Bash)
Stop: 2025-10-26 08:30:19
```

### If Hooks Are Broken ❌

```bash
$ cat /tmp/claude-hook-test.log
cat: /tmp/claude-hook-test.log: No such file or directory
```

This indicates hooks never fired despite proper configuration.

## Related Issues

- **Issue #10367**: Hooks completely non-functional in subdirectories (v2.0.27)
- **Issue #8810**: UserPromptSubmit hooks not working when started from subdirectories
- **Issue #6305**: PreToolUse/PostToolUse hooks not executing

## Cleanup

The script provides cleanup instructions at the end of execution:

```bash
# Remove test environment
rm -rf /tmp/claude-hooks-test-XXXXX
rm -f /tmp/claude-hook-test.log

# Restore original settings
BACKUP=$(ls -t ~/.claude/settings.json.backup-* 2>/dev/null | head -1)
if [ -n "$BACKUP" ]; then
  mv "$BACKUP" ~/.claude/settings.json
fi
```

## Technical Details

### Hook Configuration Format

**Local Settings** (`.claude/settings.json`):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/hook-script.sh"
          }
        ]
      }
    ]
  }
}
```

**Global Settings** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/hook-script.sh"
          }
        ]
      }
    ]
  }
}
```

### Hook Script Format

Hooks must:
1. Read JSON from stdin
2. Write output to stdout/stderr
3. Exit with appropriate code:
   - `0` = Success
   - `2` = Blocking error (for PreToolUse)
   - Other = Non-blocking error

**Example Hook:**
```bash
#!/usr/bin/env bash
read -r input_json
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "$timestamp - Hook executed!" >> /tmp/claude-hook-test.log
echo "🎬 Hook fired at $timestamp" >&2
exit 0
```

## Contributing

If you discover hooks work correctly in your environment when running this test:

1. Note your Claude Code version (`claude --version`)
2. Note your OS and platform
3. Share your configuration that works
4. Comment on Issue #10367 with details

This helps the community identify working configurations and potential fixes.

## License

This test script is provided as-is for debugging and community support purposes.
