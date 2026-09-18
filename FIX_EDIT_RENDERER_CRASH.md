# Fix: Edit tool result renderer crash on session resume

**Issues:** #40424, #40452

## Problem

Resuming a session crashes with `undefined is not an object (evaluating 'H.startsWith')` (or `q.startsWith`) when the conversation history contains an Edit tool call where `filePath` is undefined in the reconstructed result object.

This specifically occurs when:
- An Edit tool call used `replace_all: true` with `new_string: ""` (deletion)
- The session is resumed and the TUI re-renders the conversation history

## Root Cause

The `renderToolResultMessage` function for the Edit tool (`MEq` in v2.1.86, `DR7` in v2.1.87) destructures `{filePath: H}` from its argument and immediately calls `H.startsWith()` without checking if `H` is defined.

The sibling function `renderToolUseMessage` (`XEq`) correctly guards against this:
```javascript
function XEq({file_path: q}, {verbose: K}) {
  if (!q) return null;  // guard present
  if (q.startsWith(ZA())) return "";
  ...
}
```

But `renderToolResultMessage` does not:
```javascript
function MEq({filePath: q, structuredPatch: K, originalFile: _}, Y, {style: z, verbose: A}) {
  let O = q.startsWith(ZA());  // crashes when q is undefined
  ...
}
```

## Fix

Add a null guard at the top of the Edit tool's `renderToolResultMessage`, matching the pattern used in `renderToolUseMessage`:

```typescript
// In the Edit tool's renderToolResultMessage (source, not minified):
function renderToolResultMessage(
  { filePath, structuredPatch, originalFile },
  toolUseBlock,
  { style, verbose }
) {
  if (!filePath) return null;  // ADD THIS GUARD
  let isInCwd = filePath.startsWith(getCwd());
  ...
}
```

The same guard pattern should also be applied to the Write tool's result renderer if it has the same unguarded `.startsWith()` call in the `"update"` case branch.
