# Reframe Plugin

Break through stuck debugging and design problems by reframing them through cognitive thinking frameworks.

## Overview

Developers get stuck not because they lack skill, but because they're locked into one way of seeing the problem. `/reframe` applies structured thinking frameworks to your actual codebase context — reading your git diff, locating error sources, and examining the code you're working on — to help you see the problem from a different angle.

It auto-selects the 1-2 most relevant frameworks from:

- **First Principles** — decompose to fundamental requirements, strip away inherited architecture assumptions
- **Inversion** — ask what would guarantee this code fails, then check if those conditions exist
- **Analogy** — map to a well-known engineering pattern (is this really a caching problem? a state machine?)

## Commands

### `/reframe`

Gathers codebase context and reframes your engineering problem through the most relevant cognitive lens(es).

**Usage:**

```
/reframe This API keeps timing out under load and I've already tried adding caching
```

```
/reframe I can't figure out why this test is flaky — it passes locally but fails in CI
```

```
/reframe This auth flow has gotten too complex and I don't know where to simplify
```

You can also select code in your editor and run `/reframe` to get a perspective shift on a specific block.

**What it does:**

1. **Gathers context** — reads your git diff, recent commits, and branch to understand what you've been working on
2. **Investigates** — if you mention a bug or error, uses Read, Grep, and Glob to locate relevant code and error messages in the codebase
3. **Reads code** — if you selected code or referenced files, reads the full source for the bigger picture
4. **Reframes** — applies 1-2 thinking frameworks directly to your code, referencing actual file names, functions, and patterns
5. **Next step** — suggests one concrete action, naming the specific file, function, or command to act on

**Example output:**

> **Inversion** — You're trying to make this faster, but haven't defined what's actually slow.
>
> Ask instead: what would guarantee `getDashboardData()` is slow? Answer: unbounded joins, no index on the filter column, synchronous calls to three external services. `src/api/dashboard.ts:47` does all three — it joins 4 tables on `events.created_at` which has no index.
>
> **Insight:** You've been optimizing the application layer, but the bottleneck is the query plan.
>
> **Next Step:** Run `EXPLAIN ANALYZE` on the query at `src/api/dashboard.ts:47` — check if `events` is doing a sequential scan.

## Installation

Install via the plugin marketplace:

```
/plugin install reframe@claude-plugins-official
```

Or add to your project's `.claude/settings.json`:

```json
{
  "enabledPlugins": ["reframe@claude-plugins-official"]
}
```

## Author

Anuj Gupta (anuj.1306.gupta@gmail.com)

## Version

1.0.0
