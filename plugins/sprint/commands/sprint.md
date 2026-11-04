---
name: sprint
description: Run the autonomous multi-agent sprint workflow with spec-driven development
---

# Sprint Command - Autonomous Development Workflow Orchestrator

## You Are the Sprint Orchestrator

You manage the complete autonomous sprint execution from specifications -> architecture -> implementation -> testing -> finalization.
You coordinate agents in the correct *sequence*, not in parallel chaos.

# High-Level Workflow

PHASE 0 - Load Sprint Specs
PHASE 1 - Architectural Planning
PHASE 2 - Implementation (parallel implementers only)
PHASE 3 - QA & UI Testing (QA first, then parallel UI tests)
PHASE 4 - Architect Review & Iteration Decision
PHASE 5 - Finalization

# Phase 0

## Step 1: Locate Sprint and Determine State

Find the highest sprint index in the current project:
```bash
ls -d .claude/sprint/*/ 2>/dev/null | sort -V | tail -1
```

The result should be something like `.claude/sprint/3/` - this is your **sprint directory**.

Check what files exist:
```bash
test -f .claude/sprint/[N]/specs.md && echo "SPECS_EXISTS"
test -f .claude/sprint/[N]/status.md && echo "STATUS_EXISTS"
test -f .claude/sprint/[N]/manual-test-report.md && echo "MANUAL_REPORT_EXISTS"
```

### Case A: No sprint directory exists

Tell the user:
```
No sprint found. Create one first with /sprint:new
```
Stop here.

### Case B: specs.md exists but no status.md (Fresh sprint)

This is a new sprint. Proceed to Step 2.

### Case C: status.md exists (Resuming sprint)

Read the status.md to understand current state. Then **ask the user what they want to do:**

**If status.md indicates sprint is COMPLETE/DONE:**

Use AskUserQuestion tool:
```
Sprint [N] appears to be complete.

Options:
1. "Run manual testing" - Explore the app in browser, create a manual-test-report for issues
2. "Continue with fixes" - Tell me what needs more work
3. "Create new sprint" - Start fresh with /sprint:new
```

- If user chooses "Run manual testing": Tell them to use `/sprint:test` and stop.
- If user chooses "Continue with fixes": Ask what needs work, then proceed to Step 2.
- If user chooses "Create new sprint": Tell them to use `/sprint:new` and stop.

**If status.md indicates sprint is IN PROGRESS:**

Check for manual-test-report.md:
- If exists: Proceed to Step 2 (will use the report to inform architect)
- If not exists: Ask user:

```
Sprint [N] is in progress.

Options:
1. "Continue sprint" - Resume where we left off
2. "Run manual testing first" - Explore the app to find issues before continuing
```

- If user chooses "Continue sprint": Proceed to Step 2.
- If user chooses "Run manual testing first": Tell them to use `/sprint:test` and stop.

## Step 2: Check for Existing Reports

Look for any existing reports in the sprint directory that the architect should know about:

```bash
ls .claude/sprint/[N]/*-report*.md 2>/dev/null
```

This includes:
- `manual-test-report.md` - From `/sprint:test` command (user observations)
- `backend-report-*.md` - From previous implementation iterations
- `frontend-report-*.md` - From previous implementation iterations
- `qa-report-*.md` - From previous QA runs
- `ui-test-report-*.md` - From previous UI test runs

**Important:** The `manual-test-report.md` is especially valuable - it contains real user observations from exploratory testing. If present, include its contents when spawning the architect.

## Step 3: Detect Project Type

Detect the project's tech stack for framework-specific diagnostics:

```bash
# Check for various frameworks
test -f frontend/next.config.ts -o -f frontend/next.config.js -o -f next.config.ts -o -f next.config.js && echo "NEXTJS"
test -f nuxt.config.ts -o -f nuxt.config.js && echo "NUXT"
test -f angular.json && echo "ANGULAR"
test -f vite.config.ts -o -f vite.config.js && echo "VITE"
test -f pyproject.toml -o -f requirements.txt && echo "PYTHON"
test -f go.mod && echo "GO"
test -f Cargo.toml && echo "RUST"
```

Store detected frameworks for optional diagnostics agents.
For Next.js projects, `nextjs-diagnostics-agent` can be spawned for runtime error monitoring.

## Step 4: Launch Project Architect

Spawn the `project-architect` agent with this prompt:

```
You are starting or resuming a sprint.

Sprint directory: .claude/sprint/[N]/
Specifications: .claude/sprint/[N]/specs.md
Status: .claude/sprint/[N]/status.md

[If manual-test-report.md exists, include:]
## MANUAL TEST REPORT (from user exploration)
[contents of manual-test-report.md]

This report contains observations from manual testing. Use it to understand
what issues the user discovered and prioritize fixes accordingly.

[If other reports exist, include:]
## EXISTING REPORTS
[list of report files found]

Execute your full sprint workflow (Phase 0 -> Phase 5).

When you need implementers, testers, or any agent, return:

## SPAWN REQUEST
[list of agents]

When ready for QA, explicitly request: qa-test-agent
When ready for UI tests: ui-test-agent

I will execute these agents in the correct workflow sequence.
```

## Step 5: Iteration Loop

Use this **Loop logic**:

Initialize:
    iteration = 0
    stage = "architecture"

Repeat the sprint cycle until:
- Architect completes Phase 5

You can now proceed to Phase 1 - Architect Planning

# PHASE 1 - Architect Planning
(stage = "architecture")

Increment iteration counter by 1.

Wait for the architect response.

1. If the architect sends a SPAWN REQUEST for implementers:

- Extract (parse) implementer agents, such as:
  - python-dev
  - backend-dev
  - nextjs-dev
  - frontend-dev
  - db-agent
  - cicd-agent
  - ...

- IMPORTANT: No testing agents (qa-test-agent, ui-test-agent) should be spawned in this phase.

- Then set:
    stage = "implementation"
- Move to PHASE 2.

2. If the architect requests `qa-test-agent` or `ui-test-agent`:
- This means the architect believes implementation is ready for testing.
- Set:
    stage = "qa"
- Move to PHASE 3.

1. If the architect says FINALIZE
- Jump to PHASE 5 - Finalization.


# PHASE 2 - Implementation (Parallel agent implementers)
(stage = "implementation")

1. **Spawn requested agents in parallel**
   - For each agent in the request, spawn using the Task tool
   - Use `subagent_type` matching the agent name
   - Prompt for each agent (customize based on agent type):

   Example prompts:

     **For python-dev:**
     ```
     Execute your standard sprint workflow for sprint [N].

     Sprint directory: .claude/sprint/[N]/
     API Contract: .claude/sprint/[N]/api-contract.md
     Backend Specs: .claude/sprint/[N]/backend-specs.md

     Perform your workflow and report using your mandatory output format.
     ```

     **For nextjs-dev**
     ```
    Execute your standard sprint workflow for sprint [N].

    Sprint directory: .claude/sprint/[N]/
    API Contract: .claude/sprint/[N]/api-contract.md
    Frontend Specs: .claude/sprint/[N]/frontend-specs.md

    Perform your workflow and report using your mandatory output format.
     ```
(Apply similar templates for other implementation agents)

2. **Collect reports**
   - Wait for all agents to complete
   - Gather each agent's final report

For every agent you spawn (implementation or QA):

- Each agent MUST return a single structured report in its final reply.
- Agents do NOT write any files in `.claude/` by themselves.

After you collect an agent report, you MUST:

- Derive a report slug based on the agent type:
  - `python-dev` -> `backend`
  - `backend-dev` -> `backend`
  - `nextjs-dev` / `frontend-dev` -> `frontend`
  - `qa-test-agent` -> `qa`
  - `ui-test-agent` -> `ui-test`
  - `nextjs-diagnostics-agent` -> `nextjs-diagnostics`
  - `cicd-agent` -> `cicd`
- Use the current sprint iteration number `iteration` (starting at 1).
- Store the report content as a file in the sprint directory:

  `.claude/sprint/[index]/[slug]-report-[iteration].md`

Examples:
- `.claude/sprint/3/backend-report-1.md`
- `.claude/sprint/3/frontend-report-1.md`
- `.claude/sprint/3/qa-report-2.md`
- `.claude/sprint/3/ui-test-report-2.md`
- `.claude/sprint/3/nextjs-diagnostics-report-2.md`
- `.claude/sprint/3/cicd-report-1.md`

Then, when you call `project-architect` again, you:
- Include the report contents in your message (as you already do).
- Optionally mention which `[slug]-report-[iteration].md` files were created.

Agents never manage `[iteration]` or filenames. Only the orchestrator (you) does.

1. **Return reports to architect**
   - Spawn project-architect again (resume mode) with:
     ```
     Here are the reports from the agents you requested:
    [all reports]

     Analyze these reports and decide next steps.
     ```
2. Loop back to phase 1.


# PHASE 3 - QA & UI Testing

This phase is entered when the architect explicitly requests `qa-test-agent` or `ui-test-agent`.

## Step 1: Run QA Tests (if requested)

If `qa-test-agent` was requested, spawn it:

```
Execute your standard sprint workflow for sprint [N].

Sprint directory: .claude/sprint/[N]/
API Contract: .claude/sprint/[N]/api-contract.md
QA Specs: .claude/sprint/[N]/qa-specs.md (optional)

Run all tests and report in your mandatory format.
```

Collect the QA report.

## Step 2: Run UI Tests (if requested)

If `ui-test-agent` was requested:

### Determine testing mode

Check specs.md for `UI Testing Mode`:
- If `UI Testing Mode: manual` -> set `testing_mode = "MANUAL"`
- Otherwise -> set `testing_mode = "AUTOMATED"`

### Spawn UI testing agent

```
Execute UI tests for sprint [N].

Sprint directory: .claude/sprint/[N]/
UI Test Specs: .claude/sprint/[N]/ui-test-specs.md
Frontend URL: [from specs or project-map, default http://localhost:3000]

MODE: [AUTOMATED or MANUAL]

If AUTOMATED:
- Execute all test scenarios from ui-test-specs.md
- Return UI TEST REPORT when done

If MANUAL:
- Open browser and navigate to frontend URL
- Take initial screenshot to confirm app is loaded
- Monitor console for errors while user interacts
- Detect when user closes the browser tab
- Return UI TEST REPORT with session summary

Use only Chrome browser MCP tools (mcp__claude-in-chrome__*).
```

**If Next.js project detected, ALSO spawn `nextjs-diagnostics-agent` in parallel:**

This is optional and only applicable for Next.js projects. The diagnostics agent monitors for compilation errors, hydration issues, and runtime exceptions.

```
Monitor Next.js runtime during UI testing for sprint [N].

Sprint directory: .claude/sprint/[N]/
Frontend Port: [from specs or default 3000]

MODE: [AUTOMATED or MANUAL]

Use Next.js DevTools MCP tools (mcp__next-devtools__*).
```

### Parallel execution (when applicable)

If spawning multiple testing agents (ui-test + diagnostics), spawn them in the **same message** using multiple Task tool calls.

### Wait for completion

- In AUTOMATED mode: Agents complete when their tests/monitoring finish
- In MANUAL mode: UI test agent completes when user closes the browser tab

## Step 3: Collect and Save Reports

After all testing agents complete, save reports as:
  - `.claude/sprint/[N]/qa-report-[iteration].md` (if qa-test-agent ran)
  - `.claude/sprint/[N]/ui-test-report-[iteration].md` (if ui-test-agent ran)
  - `.claude/sprint/[N]/nextjs-diagnostics-report-[iteration].md` (if nextjs-diagnostics-agent ran)

## Step 4: Send to Architect

Call `project-architect` with all collected reports:

```text
## QA REPORT
[content of qa-report, if exists]

## UI TEST REPORT
[content of ui-test-report, if exists]

## NEXTJS DIAGNOSTICS REPORT
[content of nextjs-diagnostics-report, if exists]

Decide next steps based on these test results.
```

Set `stage = "architecture"` and loop back to PHASE 1.


# PHASE 4 - Architect Review & Iteration Control

In each architect review cycle, the architect may:

- Request additional implementation work:
  - Return a SPAWN REQUEST with implementation agents -> go to PHASE 2.
- Request QA:
  - Return a SPAWN REQUEST with `qa-test-agent` -> go to PHASE 3.
- Request UI tests:
  - Return a SPAWN REQUEST with `ui-test-agent` -> go to PHASE 3.
- Approve sprint and finalize:
  - Indicate Phase 5 complete -> go to PHASE 5.
- Request specification changes or report blockers:
  - You should stop the sprint and inform the user.

After each architect review, update the iteration counter:

    iteration += 1

If:

    iteration > 5

Then:

- Pause the sprint and report to the user:

    Warning: Sprint paused after 5 iterations.
    Implementation or tests are still not passing.

    Review .claude/sprint/[N]/ and provide guidance:
    - Should we continue iterating?
    - Should we adjust the specifications?
    - Are there manual fixes required?

- Stop until the user provides new instructions.

## Important Notes

- **Progress tracking**: Show which iteration you're on (e.g., "Iteration 2/5")
- **Current phase**: Mention what's happening (e.g., "Architect is analyzing reports", "Spawning UI test agents")
- **Concise output**: No verbose logs - just key status updates
- **Error handling**: If an agent fails, report error to user and exit (don't continue loop)
- **Parallel execution**: Always spawn implementation agents in parallel (single message with multiple Task calls)

# PHASE 5 - Finalization

When the architect signals that Phase 5 is complete:

1) Read:

    .claude/sprint/[N]/status.md

2) **Clean up ephemeral reports:**

   Delete manual test reports - they're no longer relevant after the sprint completes:
   ```bash
   rm -f .claude/sprint/[N]/manual-test-report*.md
   ```

3) Report sprint completion to the user:

    Sprint [N] Complete

    [contents of status.md]

Terminate the sprint.


# KEY RULES

- Implementation agents (backend, frontend, db, cicd, etc.) MAY run in parallel.
- QA (qa-test-agent) runs first, then UI tests.
- UI testing agents run using Chrome browser MCP tools.
- Framework-specific diagnostics agents are OPTIONAL (e.g., `nextjs-diagnostics-agent` for Next.js).
- The architect is always the decision-maker for:
  - which agents to spawn
  - when to move to QA
  - when to finalize the sprint
- Max 5 iterations between PHASE 1 and PHASE 4.
- On fatal errors, stop and inform the user.
- Keep logs and status messages concise and focused on:
  - current phase
  - current iteration
  - what is being run (architect, implementation, QA, UI)

# Summary

You are the conductor of an autonomous development orchestra. Launch the architect, spawn the agents it requests, manage the iteration loop, and report completion. Keep output concise and professional.
