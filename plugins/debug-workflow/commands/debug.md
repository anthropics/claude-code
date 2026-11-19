---
description: Structured debugging workflow — reproduce, analyze, hypothesize, fix, verify
argument-hint: Paste error message, stack trace, or describe the bug
---

# Debug Workflow

You are guiding a developer through a structured debugging process. Your job is to transform a vague bug report into a confirmed fix through systematic investigation — not guessing.

## Core Principles

- **Never guess**: Form hypotheses ranked by evidence, then validate before fixing
- **Minimize before fixing**: Isolate the smallest case that reproduces the issue
- **One fix at a time**: Apply and verify one hypothesis before trying the next
- **Use TodoWrite**: Track all phases and findings throughout
- **Read before editing**: Always read a file fully before modifying it

---

## Phase 1: Triage

**Goal**: Understand the nature of the bug before touching any code

Initial report: $ARGUMENTS

**Actions**:
1. Create a todo list with all phases
2. Classify the bug:
   - **Type**: crash / wrong output / performance / intermittent / build failure / test failure
   - **Scope**: single file / module / integration / environment-specific
   - **Reproducibility**: always / sometimes / only in production / unknown
3. If the error message or stack trace was provided, extract:
   - The exact error type and message
   - The file and line where it originates
   - The call chain leading to it
4. If information is insufficient, ask the user:
   - What were you doing when this happened?
   - Can you reproduce it? How?
   - Is this a regression? When did it last work?
5. Confirm your understanding with the user before proceeding

---

## Phase 2: Reproduction

**Goal**: Find the minimal case that reliably triggers the bug

**Actions**:
1. Launch a `reproducer` agent with:
   - The error description and any stack trace
   - Instructions to find: the entry point, the relevant code path, existing tests that cover this area
2. Read all files the agent identifies as key
3. Attempt to reproduce the bug:
   - Run the failing command / test / code path
   - Confirm you see the same error
4. Try to simplify the reproduction:
   - Remove unrelated inputs/dependencies
   - Find the smallest input that still triggers the bug
5. Present the minimal reproduction case to the user and confirm it matches their experience

**If you cannot reproduce it**: Tell the user and ask for more context (environment, OS, version, config). Do not proceed to hypothesis phase without a reproduction case.

---

## Phase 3: Analysis

**Goal**: Gather evidence from code and runtime artifacts

**Actions**:
1. Launch 2 agents in parallel:

   **Agent 1 — `log-analyzer`**:
   - Analyze the stack trace, error message, and any logs
   - Trace the execution path backward from the crash/failure point
   - Identify every function call, state mutation, and I/O operation in the path
   - Return: key files with line numbers, data flow summary, anomalies spotted

   **Agent 2 — `reproducer`** (second pass):
   - Map the code path that the reproduction case takes
   - Identify where the actual behavior diverges from expected behavior
   - Check git history for recent changes to affected files (`git log --oneline -20 -- <file>`)
   - Return: divergence point, recent changes to suspect files

2. Read all files identified by both agents
3. Summarize findings: what you now know about the failure point and surrounding context

---

## Phase 4: Hypotheses

**Goal**: Generate ranked hypotheses and choose one to test

**Actions**:
1. Launch a `hypothesis-maker` agent with:
   - The reproduction case
   - The analysis findings from Phase 3
   - All relevant file contents already read
2. Review the agent's ranked hypothesis list
3. Present hypotheses to the user in this format:

   ```
   Hypothesis 1 (HIGH confidence): <description>
   Evidence: <what supports this>
   Test: <how to confirm/reject without applying the fix>

   Hypothesis 2 (MEDIUM confidence): <description>
   Evidence: <what supports this>
   Test: <how to confirm/reject>
   ```

4. Ask the user: "Should I start with Hypothesis 1, or do you want to investigate a different one?"
5. **Wait for user confirmation before proceeding**

---

## Phase 5: Validation

**Goal**: Confirm or reject the chosen hypothesis without applying the fix yet

**Actions**:
1. Design a targeted test for the hypothesis:
   - Add a temporary log/assertion at the suspected location
   - Or write a focused unit test that isolates the suspect behavior
   - Or trace the specific variable/state that the hypothesis claims is wrong
2. Run the test and report what you observe
3. State clearly: "Hypothesis CONFIRMED" or "Hypothesis REJECTED"
4. If rejected: return to Phase 4 and try the next hypothesis
5. If confirmed: summarize exactly what is wrong and why, then proceed

---

## Phase 6: Fix

**Goal**: Apply the minimal correct fix

**DO NOT START WITHOUT CONFIRMED HYPOTHESIS**

**Actions**:
1. Read the full file(s) to be modified
2. Design the fix:
   - Prefer the simplest change that addresses the root cause
   - Do not refactor surrounding code unless directly necessary
   - Do not add features or handle unrelated edge cases
3. Present the proposed fix to the user before applying it:
   - Show the diff (old → new)
   - Explain why this fixes the root cause
   - Note any risks or assumptions
4. **Ask for user approval**
5. Apply the fix after approval
6. Remove any temporary logs or assertions added in Phase 5

---

## Phase 7: Verification

**Goal**: Confirm the fix resolves the bug and introduces no regressions

**Actions**:
1. Re-run the exact reproduction case from Phase 2 — the bug must be gone
2. Run the existing test suite for the affected module
3. Launch a `fix-verifier` agent to:
   - Check for related code paths that the fix might affect
   - Look for similar patterns elsewhere in the codebase that might have the same bug
4. Report results:
   - Bug fixed: yes/no
   - Tests passing: yes/no
   - Regressions found: list or none
   - Similar bugs elsewhere: list or none
5. If regressions are found, address them before closing

---

## Phase 8: Summary

**Goal**: Document what was found and fixed

**Actions**:
1. Mark all todos complete
2. Write a concise summary:
   - **Root cause**: one sentence explaining why the bug existed
   - **Fix applied**: what was changed and where
   - **Files modified**: list with paths
   - **Suggested follow-ups**: related issues found, tests that should be added, similar patterns to watch for
