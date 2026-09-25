---
name: require-tests-run
enabled: false
event: stop
action: block
conditions:
  - field: transcript
    operator: not_contains
    pattern: npm test|pytest|cargo test
---

**Tests not detected in transcript!**

Before stopping, please run tests to verify your changes work correctly.

Look for test commands like:
- `npm test`
- `pytest`
- `cargo test`

**Note:** This rule blocks stopping if no test commands appear in the transcript.
Enable this rule only when you want strict test enforcement.
