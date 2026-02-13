---
name: verification-before-completion
description: "Verify work is complete before claiming success. Use when about to claim work is done, 'verify before commit', 'check before PR', or needs evidence-based completion confirmation. Evidence before assertions always."
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: developer-workflow
compatibility: Requires Product Org OS v3+ context layer and rules
---

# Verification Before Completion

You MUST gather proof before making assertions about work status. Claiming work is complete without verification is dishonesty, not efficiency.

## Core Principle

> "Evidence before assertions. Always."

No completion claims without fresh verification evidence.

---

## The Gate Function

Before stating ANY work is done, follow this sequence:

### 1. IDENTIFY
What command or check proves the claim?

### 2. RUN
Execute the complete, fresh command. Not cached. Not assumed.

### 3. READ
Read the full output and exit codes. Not just the last line.

### 4. VERIFY
Does the output actually confirm the assertion?

### 5. CLAIM
Only THEN make the claim, with evidence.

---

## Red Flags That Trigger This Rule

### Language Patterns
- "Should be working now"
- "That should fix it"
- "Probably passing"
- "I believe this resolves..."
- "This looks good"

### Behavior Patterns
- Expressing satisfaction before checking results
- Committing changes without fresh verification
- Closing issues without reproduction test
- Saying "done" without test output

---

## Common Failures

| Failure | What Should Happen |
|---------|-------------------|
| "Tests pass" without test output | Run tests, show output |
| "Fixed the bug" without verification | Reproduce original bug, show it's gone |
| "Build succeeds" without build log | Run build, show success |
| "Deployed successfully" without check | Verify deployment, show evidence |

---

## Verification Types

### For Code Changes

```bash
# Run tests
npm test
# or
pytest
# or
go test ./...
```

**Show:** Full output including pass/fail counts

### For Bug Fixes

```bash
# 1. First, reproduce the original bug
[command that showed the bug]

# 2. Then verify it's fixed
[same command, showing different result]
```

**Show:** Before and after

### For Build/Deploy

```bash
# Build
npm run build

# Deploy verification
curl -I https://your-app.com/health
```

**Show:** Success indicators, not assumptions

---

## Output Format

When completing work:

```markdown
## Verification: [What was done]

### Command Run
```bash
[exact command]
```

### Output
```
[actual output, not summarized]
```

### Result
✅ [Specific claim supported by output]

or

❌ [What actually happened, what needs to change]
```

---

## The Non-Negotiable Rule

Before saying ANY of these:
- "Done"
- "Fixed"
- "Working"
- "Passing"
- "Complete"
- "Resolved"
- "Ready for review"

You MUST have run verification and seen confirming output in THIS session.

Not yesterday's run. Not assumed from code reading. Not "it should work."

Fresh. Verified. Evidenced.

---

## What This Prevents

1. **Premature completion claims** — "Fixed!" when it's still broken
2. **Regression blindness** — Missing that the fix broke something else
3. **Environment-specific failures** — Works on my machine syndrome
4. **Incomplete implementations** — Happy path works, edge cases don't

---

## Self-Check Before Completion

Before ANY completion statement:

- [ ] Did I run the verification command?
- [ ] Did I see the output in this session?
- [ ] Does the output confirm my claim?
- [ ] Am I including evidence with my claim?

If ANY answer is "no" → Run verification first.

---

## Related Skills

- `/writing-plans` — Plans include verification steps
- `/dispatching-parallel-agents` — Each agent must verify independently
- `/commitment-check` — Verify readiness before commitment
