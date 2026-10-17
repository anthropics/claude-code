# debug-workflow

A structured debugging plugin for Claude Code that transforms vague bug reports into confirmed fixes through systematic investigation.

## Problem

When debugging, the instinct is to jump straight to a fix. This leads to:
- Fixing symptoms instead of root causes
- Introducing regressions while fixing bugs
- Missing similar bugs elsewhere in the codebase
- Wasting time on wrong hypotheses

## Solution

`debug-workflow` enforces a disciplined process: **reproduce → analyze → hypothesize → validate → fix → verify**. You never apply a fix until the hypothesis is confirmed.

## Usage

```
/debug <error message or bug description>
```

**Examples:**
```
/debug TypeError: Cannot read properties of undefined (reading 'id') at UserService.ts:42

/debug The checkout button does nothing when the cart has more than 10 items

/debug Tests in auth.test.ts started failing after yesterday's merge
```

You can also paste a full stack trace directly as the argument.

## Workflow

The plugin guides you through 8 phases:

| Phase | Goal |
|-------|------|
| 1. Triage | Classify the bug, extract key info from the error |
| 2. Reproduction | Find the minimal case that reliably triggers the bug |
| 3. Analysis | Trace logs and code paths with parallel agents |
| 4. Hypotheses | Generate ranked, evidence-based root cause candidates |
| 5. Validation | Confirm the hypothesis without touching the fix yet |
| 6. Fix | Apply the minimal correct fix after user approval |
| 7. Verification | Confirm the fix works, check for regressions and similar bugs |
| 8. Summary | Document root cause, fix applied, and follow-ups |

## Agents

| Agent | Role | Model |
|-------|------|-------|
| `log-analyzer` | Traces execution path backward from the failure point | Sonnet |
| `reproducer` | Maps the code path and finds the divergence point | Sonnet |
| `hypothesis-maker` | Generates ranked, falsifiable root cause hypotheses | Opus |
| `fix-verifier` | Verifies the fix and scans for similar vulnerabilities | Sonnet |

## Key Principles

- **Never guess**: every hypothesis must be supported by evidence and validated before applying a fix
- **Minimize first**: isolate the smallest reproduction case before analyzing
- **One hypothesis at a time**: validate and reject before trying the next
- **Find the pattern**: the verifier always checks for similar bugs elsewhere
