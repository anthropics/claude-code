# Hook Development Utility Scripts

These scripts help validate, test, and lint hook implementations before deployment.

## validate-hook-schema.sh

Validates `hooks.json` configuration files for correct structure and common issues.

**Usage:**
```bash
./validate-hook-schema.sh path/to/hooks.json
```

**Checks:**
- Valid JSON syntax
- Required fields present
- Valid hook event names
- Proper hook types (command/prompt)
- Timeout values in valid ranges
- Hardcoded path detection
- Prompt hook event compatibility

**Example:**
```bash
cd my-plugin
./validate-hook-schema.sh hooks/hooks.json
```

## test-hook.sh

Tests individual hook scripts with sample input before deploying to Claude Code.

**Usage:**
```bash
./test-hook.sh [options] <hook-script> <test-input.json>
```

**Options:**
- `-v, --verbose` - Show detailed execution information
- `-t, --timeout N` - Set timeout in seconds (default: 60)
- `--create-sample <event-type>` - Generate sample test input

**Example:**
```bash
# Create sample test input
./test-hook.sh --create-sample PreToolUse > test-input.json

# Test a hook script
./test-hook.sh my-hook.sh test-input.json

# Test with verbose output and custom timeout
./test-hook.sh -v -t 30 my-hook.sh test-input.json
```

**Features:**
- Sets up proper environment variables (CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT)
- Measures execution time
- Validates output JSON
- Shows exit codes and their meanings
- Captures environment file output

## hook-linter.sh

Checks hook scripts for common issues and best practices violations.

**Usage:**
```bash
./hook-linter.sh <hook-script.sh> [hook-script2.sh ...]
```

**Checks:**
- Shebang presence
- `set -euo pipefail` usage
- Stdin input reading
- Proper error handling
- Variable quoting (injection prevention)
- Exit code usage
- Hardcoded paths
- Long-running code detection
- Error output to stderr
- Input validation

**Example:**
```bash
# Lint single script
./hook-linter.sh ../examples/validate-write.sh

# Lint multiple scripts
./hook-linter.sh ../examples/*.sh
```

## Typical Workflow

1. **Write your hook script**
   ```bash
   vim my-plugin/scripts/my-hook.sh
   ```

2. **Lint the script**
   ```bash
   ./hook-linter.sh my-plugin/scripts/my-hook.sh
   ```

3. **Create test input**
   ```bash
   ./test-hook.sh --create-sample PreToolUse > test-input.json
   # Edit test-input.json as needed
   ```

4. **Test the hook**
   ```bash
   ./test-hook.sh -v my-plugin/scripts/my-hook.sh test-input.json
   ```

5. **Add to hooks.json**
   ```bash
   # Edit my-plugin/hooks/hooks.json
   ```

6. **Validate configuration**
   ```bash
   ./validate-hook-schema.sh my-plugin/hooks/hooks.json
   ```

7. **Test in Claude Code**
   ```bash
   claude --debug
   ```

## Tips

- Always test hooks before deploying to avoid breaking user workflows
- Use verbose mode (`-v`) to debug hook behavior
- Check the linter output for security and best practice issues
- Validate hooks.json after any changes
- Create different test inputs for various scenarios (safe operations, dangerous operations, edge cases)

## Common Issues

### Hook doesn't execute

Check:
- Script has shebang (`#!/bin/bash`)
- Script is executable (`chmod +x`)
- Path in hooks.json is correct (use `${CLAUDE_PLUGIN_ROOT}`)

### Hook times out

- Reduce timeout in hooks.json
- Optimize hook script performance
- Remove long-running operations

### Hook fails silently

- Check exit codes (should be 0 or 2)
- Ensure errors go to stderr (`>&2`)
- Validate JSON output structure

### Injection vulnerabilities

- Always quote variables: `"$variable"`
- Use `set -euo pipefail`
- Validate all input fields
- Run the linter to catch issues
