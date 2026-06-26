---
description: Teach Claude about a specific aspect of your project — conventions, patterns, architecture, or workflows. Claude actively explores the codebase, synthesizes findings, and saves them to CLAUDE.md with your approval.
argument-hint: <topic>
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# /teach — Incrementally Teach Claude About Your Project

You are helping a developer teach you about their project. They want you to learn about a specific topic so you can work more effectively in future sessions.

The topic the user wants to teach you about is: **$ARGUMENTS**

## Core Principles

- **Explore actively, don't just ask**: Search the codebase systematically. The user is teaching you so you should do the work of finding and reading relevant code.
- **Synthesize, don't just list**: Identify the *patterns and conventions*, not just what files exist. The user wants you to understand the "why" and the "how," not just the "where."
- **Be concise**: CLAUDE.md consumes context tokens. Every line you propose adding must earn its place.
- **Confirm before saving**: Always show your findings and ask for approval before modifying any files.

## Process

### Step 1: Understand the Topic

Parse the topic from `$ARGUMENTS`. If the topic is vague or ambiguous, ask ONE clarifying question before proceeding (e.g., "Did you mean error handling in the API layer, or across the full stack?").

Map the topic to concrete search strategies:
- **Conventions** (error handling, logging, naming, imports) → search for recurring patterns across files
- **Architecture** (auth flow, data pipeline, routing) → trace execution paths through the codebase
- **Patterns** (state management, API design, testing) → find and compare multiple instances
- **Workflows** (build process, deployment, CI/CD) → check config files, scripts, and docs

### Step 2: Explore the Codebase

Use a systematic approach:

1. **Broad search first**: Use Glob and Grep to find relevant files and patterns. Cast a wide net — look for related config files, test files, and documentation, not just source code.
2. **Read deeply**: Read the most important files identified. Don't skim — understand the actual implementation.
3. **Compare multiple instances**: If looking at a pattern (e.g., error handling), find at least 3-4 examples to distinguish conventions from one-offs.
4. **Check existing CLAUDE.md**: Read any existing CLAUDE.md files (root, local, and in relevant subdirectories) so you don't duplicate what's already documented.

### Step 3: Synthesize Findings

Organize what you've learned into teachable insights:

- **The convention**: What is the standard approach? (e.g., "All API handlers wrap errors with `handleError()` from `src/lib/errors.ts`")
- **The pattern**: How is it structured? (e.g., "Error objects must include `code`, `message`, and `statusCode` fields")
- **The rationale**: Why this way? (e.g., "This matches the ErrorResponse type expected by the error middleware in `src/middleware/errorHandler.ts`")
- **Gotchas**: What would surprise someone? (e.g., "Never throw errors directly in async handlers — the wrapper won't catch them")
- **Files to know**: Which files are the authoritative sources?

Focus on what would help a future Claude session work correctly on the first try. Prioritize:
1. Conventions that, if violated, would break things
2. Patterns that are project-specific (not obvious from the language/framework)
3. Files that are the source of truth for this topic

### Step 4: Present Findings

Format your findings clearly:

```
## What I learned about [topic]

**The convention:**
[1-2 sentences describing the standard approach]

**Key patterns found:**
- [pattern 1 with file:line reference]
- [pattern 2 with file:line reference]
- [pattern 3 with file:line reference]

**Authoritative files:**
- `src/path/to/file.ts` — [what this file defines]
- `src/path/to/other.ts` — [what this file defines]

**Gotchas:**
- [thing that would go wrong if done differently]
```

If you find NOTHING systematic (the codebase has no clear convention for this topic), say so honestly and suggest whether one should be established.

### Step 5: Propose CLAUDE.md Update

Draft a concise addition to CLAUDE.md. Each line must be one of these forms:

```
- <topic>: <convention> (<authoritative file>)
- <topic>: Use <pattern> — <one-line reason>
- <topic>: Never <anti-pattern> — <one-line reason>
```

Keep it SHORT. One line per concept. Example:

```
- Error handling: All API handlers must wrap errors with `handleError()` from `src/lib/errors.ts` — otherwise error middleware won't catch them
```

Show the proposed additions as a diff:

```diff
+ - Error handling: Use `handleError()` from `src/lib/errors.ts` — the error middleware in `src/middleware/errorHandler.ts` requires the `code`/`message`/`statusCode` shape it produces
```

Then ASK: "Should I add these to CLAUDE.md?"

**Do NOT edit files until the user approves.**

### Step 6: Save (on Approval)

When the user approves:
1. Determine the right file: `CLAUDE.md` (team-shared, checked in) vs `CLAUDE.local.md` (personal, gitignored). Default to `CLAUDE.md` unless the content is personal preference.
2. If the file doesn't exist, create it with a brief header.
3. Add the new content under an appropriate section. If no sections exist, add a `## Conventions` heading.
4. If updating an existing section on this topic, integrate; otherwise, add a new bullet.

## Examples

### Example 1: Learning error handling

```
User: /teach error handling

Claude:
[searches for try/catch, error classes, error middleware...]
[reads src/lib/errors.ts, src/middleware/errorHandler.ts, 5 API handlers...]

## What I learned about error handling

**The convention:**
All API route handlers use the `handleError()` utility, never bare `try/catch`.
Errors must extend `AppError` with `code`, `message`, `statusCode`.

**Key patterns found:**
- `handleError(err, res)` used in all route handlers under `src/api/`
- Custom errors extend `AppError` in `src/lib/errors.ts:15`
- Error middleware in `src/middleware/errorHandler.ts:23` expects AppError shape

**Authoritative files:**
- `src/lib/errors.ts` — AppError base class and handleError utility
- `src/middleware/errorHandler.ts` — Express error middleware

**Gotchas:**
- Throwing non-AppError objects bypasses the error middleware and returns 500 with no body
- Async handlers must be wrapped with `asyncHandler()` from `src/lib/asyncHandler.ts`

**Proposed CLAUDE.md addition:**

```diff
+ - Error handling: Use `handleError()` from `src/lib/errors.ts` for all API routes — throw `AppError` subclasses only. Async handlers must use `asyncHandler()` wrapper.
```

Should I add this to CLAUDE.md?
```

### Example 2: No clear convention found

```
User: /teach database migrations

Claude:
[searches for migration files, schema changes, ORM config...]

## What I learned about database migrations

**No clear convention found.** The codebase has:
- 3 raw SQL files in `db/migrations/` (unnumbered, no naming convention)
- 2 Knex migrations in `src/knex/` (appear to be from an earlier approach)
- Prisma schema in `prisma/schema.prisma` (active ORM, but no migration history)

**Recommendation:** Standardize on Prisma migrations (`prisma migrate dev`) and document the workflow. The mixed approaches suggest an incomplete migration.

**Proposed CLAUDE.md addition:**

```diff
+ - Database: Use Prisma for schema management. Run `prisma migrate dev` to generate migrations. Legacy SQL and Knex files in `db/` and `src/knex/` are deprecated.
```

Should I add this to CLAUDE.md?
```

## Anti-Patterns to Avoid

1. **Don't be passive**: Don't ask the user to explain the convention — explore the codebase to discover it. The user is teaching you the *topic*, not the *details*.
2. **Don't over-document**: CLAUDE.md is not a wiki. Every line costs tokens. If the convention is standard for the framework, don't document it.
3. **Don't write essays**: One line per insight. Link to files for detail.
4. **Don't duplicate**: Check existing CLAUDE.md first. If it already documents this, tell the user and suggest improvements instead of adding duplicates.
5. **Don't save without asking**: Always present findings and get explicit approval before editing files.
