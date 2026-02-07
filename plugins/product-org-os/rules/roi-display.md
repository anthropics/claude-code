# ROI Display (SELECTIVE)

This rule governs when and how time-savings are displayed. **ROI is for deliverables only, not every interaction.**

---

## Core Rule: Deliverables Only

**Show ROI when you produce a tangible deliverable:**
- Document created or significantly updated
- Analysis with actionable recommendations
- Multi-agent synthesis with recommendations

**Skip ROI for everything else:**
- Simple Q&A and explanations
- Context lookups and recalls
- Quick answers to questions
- Reading files or providing information
- System operations

---

## The Quick Test

Before adding an ROI line, ask: **"Did I create or deliver something the user would save as a file?"**

- **YES** → Show ROI
- **NO** → Skip ROI

---

## Format (When Showing)

```markdown
⏱️ ~[X] hrs/min saved in [Y]s (vs. [brief manual equivalent])
```

**Examples:**
- `⏱️ ~4 hrs saved in 52s (vs. manual PRD writing + stakeholder reviews)`
- `⏱️ ~2 hrs saved in 38s (vs. conducting competitive analysis)`
- `⏱️ ~90 min saved in 25s (vs. documenting decision + aligning stakeholders)`

**Always reference product work**, never coding or development.

---

## Trigger Checklist

| Trigger | Show ROI? |
|---------|-----------|
| Created PRD, spec, analysis doc | ✅ YES |
| Agent produced recommendations | ✅ YES |
| PLT/gateway session with synthesis | ✅ YES |
| Answered a question | ❌ NO |
| Looked up context/feedback | ❌ NO |
| Read files for the user | ❌ NO |
| Explained something | ❌ NO |
| Failed/cancelled operation | ❌ NO |
| System operation (setup, index) | ❌ NO |

---

## Calculation Method

### Step 1: Identify Base Time
Look up the skill/agent in `reference/roi-baselines.md`

### Step 2: Assess Complexity
Determine complexity factor based on:
- **Simple (0.5×)**: Short prompt, single topic, straightforward request
- **Standard (1.0×)**: Typical request, moderate detail
- **Complex (1.5×)**: Multiple topics, significant context, stakeholder considerations
- **Enterprise (2.0×)**: Strategic, cross-functional, multi-phase

### Step 3: Calculate
```
Estimated Savings = Base Time × Complexity Factor
```

### Step 4: Update Session Total
Add to running session total for cumulative display.

---

## Examples (Always Reference Product Work)

### Simple User Story
```markdown
⏱️ ~20 min saved in 8s (vs. writing story + acceptance criteria manually)
```

### Complex PRD
```markdown
⏱️ ~6 hrs saved in 65s (vs. gathering requirements + stakeholder interviews + documentation)
```

### PLT Meeting Session
```markdown
⏱️ ~10 hrs saved in 95s (vs. scheduling + running cross-functional alignment meeting)
```

### Agent Spawning (PM Review)
```markdown
⏱️ ~90 min saved in 28s (vs. manual competitive research + synthesis)
```

### Decision Record
```markdown
⏱️ ~60 min saved in 22s (vs. documenting decision + gathering stakeholder input)
```

### Context Retrieval
```markdown
⏱️ ~30 min saved in 15s (vs. searching through past decisions manually)
```

---

## Session Totals (Optional)

For longer sessions, you may optionally add session totals after the standard line:

```markdown
⏱️ ~90 min saved in 31s (vs. market research + analysis)
📊 Session: ~4.5 hrs saved in 6 min actual time
```

Only add session totals when:
- Session has 5+ skill/agent interactions
- User has requested session tracking
- Using `/roi-report` skill

---

## Session Tracking

### What Gets Tracked
- Each skill invocation (skill name, complexity, time saved)
- Each agent invocation (agent name, task type, time saved)
- Session start time
- Cumulative totals

### Where It's Stored
Session data logged to `context/roi/session-log.md` (ephemeral, per-session)

### Format
```markdown
## Session: [Date] [Time]

| Time | Type | Name | Complexity | Elapsed | Minutes Saved |
|------|------|------|------------|---------|---------------|
| 09:15 | skill | /prd | complex | 52s | 360 |
| 09:32 | agent | @pm | standard | 28s | 90 |
| 10:05 | skill | /user-story | simple | 8s | 10 |

**Session Total**: 460 min saved (~7.7 hrs) in 88s actual time
```

---

## Monthly Aggregation

At session end, update `context/roi/history/[YYYY-MM].md` with:
- Date
- Session duration
- Total minutes saved
- Top skills used
- Skill count

This enables `/roi-report` to show 30/90 day summaries.

---

## Operating Principle

> "ROI tracking demonstrates value for meaningful work. Don't clutter simple interactions with metrics."

**For detailed ROI aggregation in multi-agent scenarios, see `agent-spawn-protocol.md` Section 3.**
