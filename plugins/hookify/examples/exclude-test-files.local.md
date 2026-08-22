---
# Example: Warn on console.log, but exclude test/story files
name: console-log-prod-only
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.(tsx?|jsx?)$
  - field: file_path
    operator: not_regex_match
    pattern: (\.test\.|\.spec\.|\.stories\.|__mocks__|__tests__)
  - field: new_text
    operator: regex_match
    pattern: console\.(log|debug|info)\(
---

**Console statement in production code!**

Remove `console.log/debug/info` before committing.

These are allowed in test and story files, which is why this rule uses
`not_regex_match` to exclude them.
