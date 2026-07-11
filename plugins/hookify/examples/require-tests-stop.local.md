---
name: require-tests-run
enabled: false
event: stop
action: block
conditions:
  - field: bash_test_commands
    operator: equals
    pattern: ""
---

**No test command was invoked through Bash!**

Before stopping, please run tests to verify your changes work correctly.

Look for test commands like:
- `npm test`
- `pytest`
- `cargo test`

**Note:** On the first Stop attempt, this rule blocks once if no supported test
appears in an executable command position in an assistant Bash tool call.
Claude Code marks a continued Stop attempt as active to prevent hook loops, so
this is a one-time reminder, not a guarantee that tests ran successfully.
