# Pattern Sweep

A slash command that searches the codebase for patterns similar to a recent bug fix, so you can fix all instances at once instead of discovering them one by one.

## Usage

After fixing a bug, run:

```
/pattern-sweep
```

The command reads your recent git diff, identifies the buggy pattern that was fixed, searches the entire codebase for similar instances, and offers to fix them all.

## How it works

1. **Reads your diff** to understand what changed (old buggy code vs new fixed code)
2. **Searches the codebase** using multiple strategies (exact match, structural match, related files)
3. **Reports all matches** with file paths, line numbers, and context
4. **Fixes with confirmation** - asks before making changes, then applies the same fix pattern

## Example

You fix a null check bug:

```diff
- if (user.name == null) {
+ if (user.name === null) {
```

Running `/pattern-sweep` finds 3 more `== null` comparisons in your codebase and offers to fix them all to `=== null`.

## Installation

```bash
claude plugin install pattern-sweep
```
