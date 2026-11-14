# Issue #83484: Broken Symlink with Literal %h Path

## Summary
The `claude install` subcommand creates a broken symlink at `~/.local/bin/claude` with an unexpanded placeholder `%h` instead of the actual home directory path.

**Current Behavior (Broken):**
```
/home/user/.local/bin/claude → %h/.local/share/claude/versions/2.1.220 (broken link)
```

**Expected Behavior (Fixed):**
```
/home/user/.local/bin/claude → /home/user/.local/share/claude/versions/2.1.220 (working link)
```

## Root Cause Analysis

### Where the Bug Occurs
From issue comments, the problem is in the **installer/auto-updater code that creates or updates the symlink**. The bug appears to trigger specifically during:
- Auto-update checks (based on `.last-update-result.json` timestamps)
- The `claude install` subcommand invoked by the shell installer

### Why It Happens
The code is using a format string or placeholder (`%h`) without expanding it to the home directory:

1. **Possible causes:**
   - Code path used `%h` (systemd/tmpfiles-style specifier) thinking it would be expanded later
   - A shell command like `ln -s "%h/..."` was written, but `%h` is not a shell variable (shell uses `$HOME`)
   - Templating system left the placeholder unexpanded
   - Update metadata contains the literal `%h` and is used to create the symlink without expansion

2. **Environment-specific behavior:**
   - Bug appears intermittently (observed during auto-update checks)
   - Doesn't happen on every launch
   - Persists across multiple updates

### Code Pattern to Find
Search the binary/updater source for:
```bash
# WRONG (creates literal %h in symlink):
ln -s "%h/.local/share/claude/versions/..." ~/.local/bin/claude
ln --symbolic "%h/.local/share/claude/..." "${HOME}/.local/bin/claude"

# CORRECT (expands before creating symlink):
TARGET_PATH="${HOME}/.local/share/claude/versions/$(get_version)"
ln -s "$TARGET_PATH" ~/.local/bin/claude
```

## The Fix

### Strategy
In the code that creates the symlink (likely in the `install` subcommand):

1. **Always expand placeholders BEFORE creating symlink**
   - Replace `%h` with `$HOME` or `~` (and expand with `expanduser()` in Rust/Go)
   - Never write template/format strings directly into symlink targets

2. **Use absolute paths**
   - Symlink targets should be absolute paths (`/home/user/...`)
   - This prevents relativity issues and ensures clarity

3. **Add validation**
   - After creating symlink, verify it doesn't contain `%h`
   - Check that the symlink target exists and is valid

### Reference Implementation
See `bin/claude-install-fix.sh` for the correct pattern:

```bash
# Key lines from fix:
INSTALL_ROOT="${HOME}/.local/share/claude/versions"     # ← Expanded
TARGET_PATH="${INSTALL_ROOT}/${LATEST_VERSION}"         # ← Expanded
ln -s "$TARGET_PATH" "$LINK_PATH"                       # ← Uses expanded path
```

## Testing the Fix

### Before Fix
```bash
readlink ~/.local/bin/claude
# Output: %h/.local/share/claude/versions/2.1.220  ← BROKEN

ls -la ~/.local/bin/claude
# Output: lrwxrwxrwx ... claude -> %h/.local/share/claude/versions/2.1.220 (broken symlink)

# Symlink is broken:
~/.local/bin/claude --version
# Error: No such file or directory
```

### After Fix
```bash
readlink ~/.local/bin/claude
# Output: /home/user/.local/share/claude/versions/2.1.220  ← EXPANDED

ls -la ~/.local/bin/claude
# Output: lrwxrwxrwx ... claude -> /home/user/.local/share/claude/versions/2.1.220

# Symlink works:
~/.local/bin/claude --version
# Output: 2.1.220
```

## User-Facing Fix (Temporary Workaround)

While the code fix is being deployed, users can manually repair their symlink:

```bash
# Find the latest installed version
LATEST_VERSION=$(ls -1v ~/.local/share/claude/versions/ | sort -V | tail -1)

# Recreate symlink with correct target
ln -sf ~/.local/share/claude/versions/$LATEST_VERSION ~/.local/bin/claude

# Verify it works
ls -la ~/.local/bin/claude
claude --version
```

## Files Affected
- **Binary source code:** The `install` subcommand implementation (location TBD - likely Rust/Go)
- **Update logic:** Code that runs during auto-update checks
- **No changes needed:** Shell installer script (`curl -fsSL https://claude.ai/install.sh`) is correct per issue description

## Related Issues
- Issue #83484 (GitHub)
- Reported on Fedora 44, Claude Code 2.1.220
- Affects Linux systems during auto-update
