---
description: Start a pair programming session where two AIs collaborate - one implements, one critiques
argument-hint: What you want to build (e.g., "user authentication function")
---

# Pair AI Coding

Follow this 5-phase workflow for collaborative AI coding.

## Phase 1: Understanding

**Goal**: Clarify the task

**Actions**:
1. If task unclear, ask user for:
   - What exactly should be built?
   - Any constraints (language, framework, performance)?
   - What's the acceptance criteria?
2. Create todo list for tracking progress

## Phase 2: Initial Implementation

**Goal**: Get a working first draft

**Actions**:
1. Launch implementer agent to create initial code
2. Agent should focus on:
   - Meeting functional requirements
   - Clean, readable code
   - Following project conventions
3. Present initial implementation to user

## Phase 3: Critique Round

**Goal**: Identify improvements

**Actions**:
1. Launch critic agent to review the implementation
2. Agent should analyze:
   - **Bugs**: Logic errors, edge cases, null handling
   - **Security**: Injection, XSS, authentication issues
   - **Performance**: Time/space complexity, resource usage
   - **Maintainability**: Readability, naming, structure
3. Return prioritized list of issues with severity scores (0-100)
4. Filter to only include issues with score >= 70

## Phase 4: Revision Round

**Goal**: Improve based on feedback

**Actions**:
1. Launch implementer agent with critic's feedback
2. Agent should:
   - Address high-priority issues
   - Explain what was changed and why
   - Defend decisions if critique was incorrect
3. If significant changes were made, optionally run another critique round (max 2 total)

## Phase 5: Summary

**Goal**: Present final result

**Actions**:
1. Show final code
2. Summarize the debate:
   - What issues were found
   - How they were resolved
   - Any remaining concerns
3. Suggest next steps (tests, documentation, etc.)
