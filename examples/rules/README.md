# Rules Frontmatter Examples

Example Claude Code rules files demonstrating **correct** and **incorrect** frontmatter syntax for the `paths:` field.

> [!WARNING]
> The `paths:` field in rules frontmatter uses a **CSV string parser** internally. YAML array syntax and JSON inline array syntax will cause rules to silently fail to match any files — the rule content loads but never applies.

## Correct Syntax

### Single glob (unquoted)

```yaml
---
paths: "**/*.ts"
---
```

### Multiple globs (CSV string)

```yaml
---
paths: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx"
---
```

### Using `globs:` (alternative, also CSV)

```yaml
---
globs: "**/*.py,**/*.pyi"
---
```

## Incorrect Syntax (Silent Failures)

### YAML list syntax — BROKEN

```yaml
---
# DO NOT USE — rules will never match any files
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
```

**Why it breaks:** The internal CSV parser (`_9A()`) expects a string and iterates character by character. When YAML parse returns a JavaScript array, the parser iterates the array _elements_ instead of characters, concatenating all globs without any separator (e.g., `**/*.ts**/*.tsx`), producing an invalid glob that matches nothing.

### JSON inline array — BROKEN

```yaml
---
# DO NOT USE — rules will never match any files
paths: ["**/*.ts", "**/*.tsx"]
---
```

**Same root cause** as above — the YAML parser produces a JavaScript array.

### Quoted single value with paths: — MAY BREAK

```yaml
---
# In some versions, quoted paths: may also fail
# Use globs: if you need quoted values
paths: "**/*.cs"
---
```

See [#17204](https://github.com/anthropics/claude-code/issues/17204) — `paths:` with quoted values may undergo additional processing that strips or misinterprets the value. Use `globs:` as a more reliable alternative.

## Related Issues

- [#19377](https://github.com/anthropics/claude-code/issues/19377) — `paths:` YAML array syntax silently fails (root cause analysis in comments)
- [#13905](https://github.com/anthropics/claude-code/issues/13905) — Rules with `paths:` frontmatter not triggering
- [#21858](https://github.com/anthropics/claude-code/issues/21858) — Rules do not apply to `.claude/rules/` properly
- [#17204](https://github.com/anthropics/claude-code/issues/17204) — `paths:` with quoted globs broken

## Validation Hook

See [`examples/hooks/rules_frontmatter_validator.py`](../hooks/rules_frontmatter_validator.py) — a PreToolUse hook that detects rules files using broken frontmatter syntax.

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on rules and settings.
