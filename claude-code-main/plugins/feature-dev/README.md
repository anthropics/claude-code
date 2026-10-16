# Feature Development Plugin

A comprehensive, structured workflow for feature development with specialized agents for codebase exploration, architecture design, and quality review.

## Overview

The Feature Development Plugin provides a systematic 7-phase approach to building new features. Instead of jumping straight into code, it guides you through understanding the codebase, asking clarifying questions, designing architecture, and ensuring quality—resulting in better-designed features that integrate seamlessly with your existing code.

## Philosophy

Building features requires more than just writing code. You need to:
- **Understand the codebase** before making changes
- **Ask questions** to clarify ambiguous requirements
- **Design thoughtfully** before implementing
- **Review for quality** after building

This plugin embeds these practices into a structured workflow that runs automatically when you use the `/feature-dev` command.

## Command: `/feature-dev`

Launches a guided feature development workflow with 7 distinct phases.

**Usage:**
```bash
/feature-dev Add user authentication with OAuth
```

Or simply:
```bash
/feature-dev
```

The command will guide you through the entire process interactively.

## The 7-Phase Workflow

### Phase 1: Discovery

**Goal**: Understand what needs to be built

**What happens:**
- Clarifies the feature request if it's unclear
- Asks what problem you're solving
- Identifies constraints and requirements
- Summarizes understanding and confirms with you

**Example:**
```
You: /feature-dev Add caching
Claude: Let me understand what you need...
        - What should be cached? (API responses, computed values, etc.)
        - What are your performance requirements?
        - Do you have a preferred caching solution?
```

### Phase 2: Codebase Exploration

**Goal**: Understand relevant existing code and patterns

**What happens:**
- Launches 2-3 `code-explorer` agents in parallel
- Each agent explores different aspects (similar features, architecture, UI patterns)
- Agents return comprehensive analyses with key files to read
- Claude reads all identified files to build deep understanding
- Presents comprehensive summary of findings

**Agents launched:**
- "Find features similar to [feature] and trace implementation"
- "Map the architecture and abstractions for [area]"
- "Analyze current implementation of [related feature]"

**Example output:**
```
Found similar features:
- User authentication (src/auth/): Uses JWT tokens, middleware pattern
- Session management (src/session/): Redis-backed, 24hr expiry
- API security (src/api/middleware/): Rate limiting, CORS

Key files to understand:
- src/auth/AuthService.ts:45 - Core authentication logic
- src/middleware/authMiddleware.ts:12 - Request authentication
- src/config/security.ts:8 - Security configuration
```

### Phase 3: Clarifying Questions

**Goal**: Fill in gaps and resolve all ambiguities

**What happens:**
- Reviews codebase findings and feature request
- Identifies underspecified aspects:
  - Edge cases
  - Error handling
  - Integration points
  - Backward compatibility
  - Performance needs
- Presents all questions in an organized list
- **Waits for your answers before proceeding**

**Example:**
```
Before designing the architecture, I need to clarify:

1. OAuth provider: Which OAuth providers? (Google, GitHub, custom?)
2. User data: Store OAuth tokens or just user profile?
3. Existing auth: Replace current auth or add alongside?
4. Sessions: Integrate with existing session management?
5. Error handling: How to handle OAuth failures?
```

**Critical**: This phase ensures nothing is ambiguous before design begins.

### Phase 4: Architecture Design

**Goal**: Design multiple implementation approaches

**What happens:**
- Launches 2-3 `code-architect` agents with different focuses:
  - **Minimal changes**: Smallest change, maximum reuse
  - **Clean architecture**: Maintainability, elegant abstractions
  - **Pragmatic balance**: Speed + quality
- Reviews all approaches
- Forms opinion on which fits best for this task
- Presents comparison with trade-offs and recommendation
- **Asks which approach you prefer**

**Example output:**
```
I've designed 3 approaches:

Approach 1: Minimal Changes
- Extend existing AuthService with OAuth methods
- Add new OAuth routes to existing auth router
- Minimal refactoring required
Pros: Fast, low risk
Cons: Couples OAuth to existing auth, harder to test

Approach 2: Clean Architecture
- New OAuthService with dedicated interface
- Separate OAuth router and middleware
- Refactor AuthService to use common interface
Pros: Clean separation, testable, maintainable
Cons: More files, more refactoring

Approach 3: Pragmatic Balance
- New OAuthProvider abstraction
- Integrate into existing AuthService
- Minimal refactoring, good boundaries
Pros: Balanced complexity and cleanliness
Cons: Some coupling remains

Recommendation: Approach 3 - gives you clean boundaries without
excessive refactoring, and fits your existing architecture well.

Which approach would you like to use?
```

### Phase 5: Implementation

**Goal**: Build the feature

**What happens:**
- **Waits for explicit approval** before starting
- Reads all relevant files identified in previous phases
- Implements following chosen architecture
- Follows codebase conventions strictly
- Writes clean, well-documented code
- Updates todos as progress is made

**Notes:**
- Implementation only starts after you approve
- Follows patterns discovered in Phase 2
- Uses architecture designed in Phase 4
- Continuously tracks progress

### Phase 6: Quality Review

**Goal**: Ensure code is simple, DRY, elegant, and functionally correct

**What happens:**
- Launches 3 `code-reviewer` agents in parallel with different focuses:
  - **Simplicity/DRY/Elegance**: Code quality and maintainability
  - **Bugs/Correctness**: Functional correctness and logic errors
  - **Conventions/Abstractions**: Project standards and patterns
- Consolidates findings
- Identifies highest severity issues
- **Presents findings and asks what you want to do**:
  - Fix now
  - Fix later
  - Proceed as-is
- Addresses issues based on your decision

**Example output:**
```
Code Review Results:

High Priority Issues:
1. Missing error handling in OAuth callback (src/auth/oauth.ts:67)
2. Memory leak: OAuth state not cleaned up (src/auth/oauth.ts:89)

Medium Priority:
1. Could simplify token refresh logic (src/auth/oauth.ts:120)
2. Consider extracting OAuth config validation

All tests pass. Code follows project conventions.

What would you like to do?
```

### Phase 7: Summary

**Goal**: Document what was accomplished

**What happens:**
- Marks all todos complete
- Summarizes:
  - What was built
  - Key decisions made
  - Files modified
  - Suggested next steps

**Example:**
```
Feature Complete: OAuth Authentication

What was built:
- OAuth provider abstraction supporting Google and GitHub
- OAuth routes and middleware integrated with existing auth
- Token refresh and session integration
- Error handling for all OAuth flows

Key decisions:
- Used pragmatic approach with OAuthProvider abstraction
- Integrated with existing session management
- Added OAuth state to prevent CSRF

Files modified:
- src/auth/OAuthProvider.ts (new)
- src/auth/AuthService.ts
- src/routes/auth.ts
- src/middleware/authMiddleware.ts

Suggested next steps:
- Add tests for OAuth flows
- Add more OAuth providers (Microsoft, Apple)
- Update documentation
```

## Agents

### `code-explorer`

**Purpose**: Deeply analyzes existing codebase features by tracing execution paths

**Focus areas:**
- Entry points and call chains
- Data flow and transformations
- Architecture layers and patterns
- Dependencies and integrations
- Implementation details

**When triggered:**
- Automatically in Phase 2
- Can be invoked manually when exploring code

**Output:**
- Entry points with file:line references
- Step-by-step execution flow
- Key components and responsibilities
- Architecture insights
- List of essential files to read

### `code-architect`

**Purpose**: Designs feature architectures and implementation blueprints

**Focus areas:**
- Codebase pattern analysis
- Architecture decisions
- Component design
- Implementation roadmap
- Data flow and build sequence

**When triggered:**
- Automatically in Phase 4
- Can be invoked manually for architecture design

**Output:**
- Patterns and conventions found
- Architecture decision with rationale
- Complete component design
- Implementation map with specific files
- Build sequence with phases

### `code-reviewer`

**Purpose**: Reviews code for bugs, quality issues, and project conventions

**Focus areas:**
- Project guideline compliance (CLAUDE.md)
- Bug detection
- Code quality issues
- Confidence-based filtering (only reports high-confidence issues ≥80)

**When triggered:**
- Automatically in Phase 6
- Can be invoked manually after writing code

**Output:**
- Critical issues (confidence 75-100)
- Important issues (confidence 50-74)
- Specific fixes with file:line references
- Project guideline references

## Usage Patterns

### Full workflow (recommended for new features):
```bash
/feature-dev Add rate limiting to API endpoints
```

Let the workflow guide you through all 7 phases.

### Manual agent invocation:

**Explore a feature:**
```
"Launch code-explorer to trace how authentication works"
```

**Design architecture:**
```
"Launch code-architect to design the caching layer"
```

**Review code:**
```
"Launch code-reviewer to check my recent changes"
```

## Best Practices

1. **Use the full workflow for complex features**: The 7 phases ensure thorough planning
2. **Answer clarifying questions thoughtfully**: Phase 3 prevents future confusion
3. **Choose architecture deliberately**: Phase 4 gives you options for a reason
4. **Don't skip code review**: Phase 6 catches issues before they reach production
5. **Read the suggested files**: Phase 2 identifies key files—read them to understand context

## When to Use This Plugin

**Use for:**
- New features that touch multiple files
- Features requiring architectural decisions
- Complex integrations with existing code
- Features where requirements are somewhat unclear

**Don't use for:**
- Single-line bug fixes
- Trivial changes
- Well-defined, simple tasks
- Urgent hotfixes

## Requirements

- Claude Code installed
- Git repository (for code review)
- Project with existing codebase (workflow assumes existing code to learn from)

## Troubleshooting

### Agents take too long

**Issue**: Code exploration or architecture agents are slow

**Solution**:
- This is normal for large codebases
- Agents run in parallel when possible
- The thoroughness pays off in better understanding

### Too many clarifying questions

**Issue**: Phase 3 asks too many questions

**Solution**:
- Be more specific in your initial feature request
- Provide context about constraints upfront
- Say "whatever you think is best" if truly no preference

### Architecture options overwhelming

**Issue**: Too many architecture options in Phase 4

**Solution**:
- Trust the recommendation—it's based on codebase analysis
- If still unsure, ask for more explanation
- Pick the pragmatic option when in doubt

## Tips

- **Be specific in your feature request**: More detail = fewer clarifying questions
- **Trust the process**: Each phase builds on the previous one
- **Review agent outputs**: Agents provide valuable insights about your codebase
- **Don't skip phases**: Each phase serves a purpose
- **Use for learning**: The exploration phase teaches you about your own codebase

## Author

Sid Bidasaria (sbidasaria@anthropic.com)

## Version

1.0.0
