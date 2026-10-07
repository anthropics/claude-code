# MCP Doctor Plugin

Robust MCP configuration validator that catches issues the built-in `/doctor` misses. Provides detailed diagnostics with exact error positions, encoding detection, and server-type-specific schema validation.

## Why This Plugin?

The built-in `/doctor` command can falsely report valid `.mcp.json` files as invalid JSON ([#30172](https://github.com/anthropics/claude-code/issues/30172)). This happens because the internal JSON parser uses an LRU cache that can return stale results, and the doctor's directory-walking logic may conflate errors from parent directories with the project config.

This plugin provides an independent validation path using Python's standard `json` module — no caching, no false positives.

## Features

### Comprehensive JSON Validation
- Standard-compliant JSON parsing with exact error positions (line and column)
- Detection of common JSON mistakes: trailing commas, comments, duplicate keys
- Full context in error messages showing the problematic text

### Encoding Detection
- UTF-8 BOM detection and removal guidance
- UTF-16 encoding detection
- Invisible character detection (zero-width spaces, non-breaking spaces, line/paragraph separators)
- Null byte detection for binary file contamination

### Schema Validation
- Validates `mcpServers` wrapper structure
- Server-type-specific field checks:
  - **stdio**: requires `command`, warns if `url` is present
  - **sse/http/ws**: requires `url`, warns if `command` is present
- Environment variable type checking (must be strings)
- Args array type validation
- Detects servers defined at root level instead of under `mcpServers`

### Directory Hierarchy Scanning
- Walks from project root to filesystem root (matching actual config merge order)
- Also checks inline `mcpServers` in user settings files
- Reports each file independently with clear paths

## Usage

### Slash Command

```
/validate-mcp
```

Runs full validation and reports results for all `.mcp.json` files in the project hierarchy.

### Automatic (SessionStart Hook)

The plugin automatically validates configs when a session starts. If issues are found, a diagnostic report is printed to stderr before the session begins. This does **not** block session startup — it's purely informational.

### Standalone

```bash
cd /your/project
python3 path/to/validate_mcp_config.py
```

## Example Output

### Valid Config
```
==============================
MCP Configuration Validation
==============================

  [OK] /home/user/project/.mcp.json

All configs are valid.
==============================
```

### Invalid Config
```
==============================
MCP Configuration Validation
==============================

  [FAIL] /home/user/project/.mcp.json
  [ERROR] JSON parse error: Expecting ',' delimiter (line 8, col 5)
         -> Fix the syntax at line 8, column 5. Context: ...      "stdio"      "arg...
  [WARN] Possible trailing comma detected (not valid in JSON)
         -> Remove the trailing comma before } or ]

Found: 1 error, 1 warning

NOTE: If the built-in /doctor reports 'MCP config is not a valid JSON'
but this validator shows no errors, the issue is likely a false positive
in the built-in JSON parser cache. Restarting the session may resolve it.
==============================
```

### Schema Issues
```
==============================
MCP Configuration Validation
==============================

  [WARN] /home/user/project/.mcp.json
  [ERROR] Server 'my-api' (http): missing required 'url' field
         -> Add "url": "<server-url>" to the 'my-api' server config
  [WARN] Server 'local-tool': has 'url' field but type is 'stdio' (url is ignored)
         -> Remove 'url' or change type to 'sse', 'http', or 'ws'

Found: 1 error, 1 warning
==============================
```

## Installation

### Option 1: Copy to plugins directory

```bash
cp -r mcp-doctor ~/.claude/plugins/
```

### Option 2: Add to settings.json

```json
{
  "plugins": [
    "/path/to/mcp-doctor"
  ]
}
```

## How It Differs from /doctor

| Check | /doctor | This Plugin |
|-------|---------|-------------|
| JSON parse | Cached (can give false positives) | Fresh parse every time |
| Error position | "not a valid JSON" (no details) | Exact line and column |
| Encoding | Strips BOM only | Full BOM, UTF-16, invisible char detection |
| Schema | Basic | Server-type-specific field validation |
| Comments | Silent failure | Detects and reports |
| Trailing commas | Silent failure | Detects and reports |
| Directory walk | Errors may be misattributed | Each file reported separately |

## Requirements

- Python 3.8+ (uses only standard library modules)
