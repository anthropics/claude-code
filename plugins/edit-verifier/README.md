# Edit Verifier

A PostToolUse hook plugin that verifies file edits applied correctly by reading the file back after Edit operations.

## Problem

When Claude uses the Edit tool, it assumes the edit succeeded and proceeds without verifying. If the target text wasn't found (whitespace mismatch, code already modified, partial match), the edit silently fails and Claude continues with incorrect assumptions.

## How it works

After each Edit tool operation, this plugin:

1. Reads the edited file back from disk
2. Checks that `new_string` from the edit is present in the file
3. If **not found**, sends a warning to Claude suggesting it read the file to verify
4. If **found**, stays silent (no unnecessary output)

The plugin is non-blocking - it warns but never denies operations.

## Installation

```bash
claude plugin install edit-verifier
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": ["edit-verifier"]
}
```

## Configuration

No configuration needed. The hook runs automatically after every Edit operation.

**Skipped cases:**
- Empty edits or replacements shorter than 5 characters (avoids false positives on whitespace)
- Files that can't be read (warns instead of blocking)
