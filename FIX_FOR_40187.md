# Fix for Issue #40187: Plugin hook scripts lose execute permissions after install

## Problem
When a plugin's hook script is installed without execute permissions, Claude Code 
fails with `SessionStart:resume hook error` on every session resume. The script exists 
at the correct path but is not executable.

## Solution
Add `chmod +x` to make hook scripts executable after installation.

In the plugin installation code (where hook scripts are copied), add execute permissions:

```javascript
// After copying hook script
fs.chmodSync(scriptPath, 0o755);
```

Or using Node.js:

```javascript
import { chmodSync } from 'fs';
chmodSync(scriptPath, 0o755);
```

## Location
The fix should be applied in the plugin installation logic, typically in:
- `src/plugins/` directory
- Plugin installation/activation code

## Files to modify
Look for code that:
1. Copies hook scripts from plugin to cache directory
2. Reads hooks.json and processes command paths

After copying each script, apply execute permissions.

## Testing
1. Install a plugin with hooks (e.g., `learning-output-style`)
2. Check permissions: `ls -la ~/.claude/plugins/cache/.../hooks-handlers/`
3. Verify the hook script has execute permissions (should be `-rwxr-xr-x`)
4. Resume a session - no more hook error
