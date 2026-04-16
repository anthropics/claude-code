# Etudes — Sprint Coach Plugin

A sprint coach for builders who have more ideas than shipped products. Etudes interviews you about your project, skills, and patterns, then generates a 5-day sprint calibrated to how you actually work.

## Overview

Etudes provides a structured coaching workflow inside Claude Code. It reads your codebase, conducts a conversational intake interview, detects avoidance patterns, and generates a concrete 5-day sprint with time-estimated tasks grounded in your actual files. During the sprint, it provides daily check-ins, catches avoidance in real-time, and captures new ideas in a parking lot so they don't derail focus.

All state persists in a `.etudes/` directory at your project root, so coaching continues across sessions.

## Contents

| Type | Name | Description |
|------|------|-------------|
| **Skill** | `etudes` | Core coaching engine — intake interview, pattern detection, sprint generation, active coaching |
| **Command** | `/etudes` | Main entry point — runs intake if new, shows sprint status if returning |
| **Command** | `/etudes-checkin` | Daily check-in — reads sprint, asks what's done, updates progress |
| **Command** | `/etudes-retro` | Sprint retrospective — reviews what shipped, parking lot, generates next sprint |
| **Command** | `/etudes-park` | Parking lot capture — saves an idea mid-sprint without context-switching |
| **Command** | `/etudes-dashboard` | Cross-project status view in Claude Code (reads all registered projects) |
| **Local App** | `etudes-dashboard` | Web dashboard at `localhost:2400` with kanban + park/icebox across projects |

## Commands

### `/etudes`

Launches the full workflow. On first run, conducts the intake interview and generates a sprint. On subsequent runs, reads `.etudes/` state and shows current sprint status.

**Usage:**
```bash
/etudes
```

Or with context:
```bash
/etudes I'm building a recipe app and I keep rewriting the data model instead of shipping
```

### `/etudes-checkin`

Daily check-in during an active sprint. Reads the current sprint file, determines what day you're on, and asks for a status update. Marks completed tasks and redirects if it detects avoidance patterns.

**Usage:**
```bash
/etudes-checkin
```

Or with an update:
```bash
/etudes-checkin finished tasks 1 and 2, stuck on the auth flow
```

### `/etudes-park`

Captures a new idea mid-sprint without derailing focus. Appends to `.etudes/parking-lot.md` and immediately redirects back to the current task.

**Usage:**
```bash
/etudes-park what if I added a dark mode toggle
```

### `/etudes-retro`

End-of-sprint retrospective. Cross-references completed tasks with git commits, reviews the parking lot, identifies patterns, and optionally generates the next sprint with adjustments.

**Usage:**
```bash
/etudes-retro
```

### `/etudes-dashboard`

Cross-project status command inside Claude Code. Reads `~/.etudes/projects.json`, aggregates all active projects, and shows progress + next tasks in one view.

**Usage:**
```bash
/etudes-dashboard
```

Project-specific drill-down:
```bash
/etudes-dashboard liminal
```

## Local Dashboard (Option C)

Etudes now includes a local web dashboard that tracks all registered projects.

### Features

- UI primitives powered by Basecoat (`basecoat-css`) with Motion-enhanced transitions
- URL routing:
  - `http://localhost:2400/<project-slug>`
  - `http://localhost:2400/all`
- 5-column kanban: Backlog, To Do, In Progress, Done, Shipped
- Task CRUD: create, edit, move status, comment, delete
- Park/Icebox panel across projects
- Direct file mutation of `.etudes/sprint-current.md` and `.etudes/parking-lot.md`
- Deleted tasks are caught by Etudes check-ins ("done, descoped, or avoided?")

### Run locally from this repo

```bash
npm install
npm start
```

Then open:

```text
http://localhost:2400
```

### Publish for `npx etudes-dashboard`

This is a separate npm package step from `npx skills add`.

```bash
# one-time npm login
npm login

# publish package (from repo root)
npm publish
```

After publishing:

```bash
npx etudes-dashboard
```

## The Workflow

### Phase 1: Intake Interview

Etudes asks ~8 questions, one at a time, conversationally. It simultaneously scans the repo for signals: git log activity, README, tech stack, test coverage, deployment configs.

**Entry path detection:**
- **Existing code**: Assesses project state, asks where you get blocked
- **Spec or PRD**: Probes for the MVP buried in the spec
- **Idea only**: Asks what's stopped it from happening
- **Multiple projects**: Runs a lightweight dialectic to pick the shortest path to something shipped

**Builder profile questions:**
- What does "done" look like in 7 days?
- Technical background
- Work patterns (multi-select avoidance pattern detector)
- Shipping history
- Available time per day
- Preferred coaching tone

### Phase 2: Pattern Detection

Based on intake signals, Etudes selects a coaching mode internally. It never announces the mode — it just shifts behavior.

| Mode | Triggers | Behavior |
|------|----------|----------|
| **Architect to Executor** | Elaborate plans, nothing shipped, overscoped goals | Cut scope aggressively. Trivially small first tasks. No spec editing rule. |
| **Confidence Builder** | Self-taught, minimizing language, discounts shipped work | Validate with evidence from their code. Progressive difficulty. |
| **Focus Lock** | Multiple projects, new ideas mid-conversation | Name the pattern. Redirect every time. Parking lot everything. |
| **Unblocking** | Stuck on specific task, emotional language about blocker | Break into 10-minute chunks. Remove decisions. Reference specific files. |
| **Accountability** | Git log gaps, vague about activity, shame language | Pick up where they left off. No shame. No lectures. |

Modes shift mid-sprint based on observed behavior.

### Phase 3: Sprint Generation

Generates a 5-day sprint with tasks grounded in the actual codebase.

**Sprint structure:**
- Day 1 is always the easiest (build momentum)
- Each task has a time estimate and "done =" definition
- Tasks reference actual files when a repo exists
- Day 5 is always "Ship Day" — put something visible in front of a real person

**Task calibration:**

| Signal | Rule |
|--------|------|
| 30 min/day | 2 tasks, ≤15 min each |
| 1 hour/day | 3 tasks |
| 2-3 hours/day | 4-5 tasks |
| "I get overwhelmed" | First task < 10 min, daily warm-up |
| "I pivot to re-planning" | Sprint rule: no spec editing |
| "I get pulled to new ideas" | Sprint rule: use `/etudes-park` |
| Time varies wildly | Starred must-do task + optional full-day |

Sprint 1 is always labeled "Calibration Sprint" — the first sprint is about learning how you work.

### Phase 4: Active Coaching

When the user returns for check-ins, Etudes responds based on context:

| Situation | Response |
|-----------|----------|
| Completed tasks | Mark done. "What's next?" |
| Partial completion | "Which ones? What's blocking the rest?" |
| Gap (missed days) | "What's left on Day [X]?" No shame. |
| New idea mid-sprint | Park it. Redirect to current task. |
| Re-planning detected | "This is the pattern. Next checkbox?" |
| Frustration/anxiety | Zoom to smallest task. "10 minutes. Go." |
| Wants to quit | "What specifically isn't working? Fix the sprint, not abandon it." |

### Phase 5: Sprint Retro

Reviews completed vs incomplete tasks, cross-references git commits, walks through the parking lot, and generates the next sprint with adjustments if requested.

## State Persistence

All state lives in `.etudes/` at the project root:

```
.etudes/
├── profile.md           # Builder profile (coaching mode, tone, rules)
├── sprint-current.md    # Active sprint with checkboxes
├── parking-lot.md       # Ideas captured mid-sprint
└── retros/
    └── sprint-1.md      # Sprint retrospectives
```

This persists across Claude Code sessions. The commands read state on every invocation.

Global cross-project index lives at:

```text
~/.etudes/projects.json
```

Dashboard-only kanban metadata is stored per project at:

```text
.etudes/board-state.json
```

## When to Use This Plugin

**Use for:**
- Side projects that have stalled
- Projects where you keep planning instead of building
- When you're torn between multiple projects
- When you need external accountability to ship
- When you know what to build but lose momentum in execution

**Don't use for:**
- Active team projects with existing sprint processes
- Quick bug fixes or one-off tasks
- Projects with external deadlines and accountability already in place

## Design Principles

- **One question at a time.** Never dump a list. Never overwhelm.
- **Mirror, don't diagnose.** Show people their patterns. Don't label them.
- **Scope only shrinks.** Mid-sprint, nothing gets added. New ideas go to the parking lot.
- **Ship something visible.** Every sprint ends with something a real person can see.
- **Direct, not motivational.** Be specific to the person's situation. Never generic.

## Author

keeeeeeeks

## Version

1.0.0
