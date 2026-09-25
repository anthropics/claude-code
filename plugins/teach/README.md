# Teach Plugin

Incrementally teach Claude Code about your project — one topic at a time.

## The Problem

Claude Code has two ways to learn about your project:

- **`/init`**: A broad, one-shot scan that creates a general CLAUDE.md. Good for initial setup, but can't capture nuance.
- **Manual editing**: You can edit CLAUDE.md and memory files directly. Powerful, but you have to do all the work yourself.

What's missing is an **incremental, interactive way** to teach Claude about specific topics as you work.

## The Solution: `/teach`

`/teach <topic>` tells Claude to actively explore your codebase, understand a specific aspect of it, and save what it learns to CLAUDE.md — with your approval.

### How it works

1. You pick a topic: `/teach error handling`
2. Claude searches the codebase, reads files, identifies patterns
3. Claude presents what it learned in a clear summary
4. You review and approve (or reject) the proposed CLAUDE.md update
5. Claude saves the knowledge — and uses it in every future session

### What you can teach

| Topic Type | Example |
|---|---|
| **Conventions** | `/teach logging patterns` |
| **Architecture** | `/teach authentication flow` |
| **Patterns** | `/teach state management` |
| **Workflows** | `/teach deployment process` |
| **Gotchas** | `/teach common pitfalls` |

### Why this matters

Each `/teach` session makes Claude Code smarter about your project. After a few sessions, Claude will:

- Follow your conventions without being told
- Know which files are authoritative for each concern
- Avoid repeating mistakes you've already fixed
- Work more autonomously because it understands your patterns

## Usage

```
/teach <topic>
```

### Examples

```
/teach error handling
/teach auth flow
/teach database patterns
/teach testing conventions
/teach API design
/teach component structure
/teach logging patterns
/teach state management
```

## Requirements

- Claude Code installed
- A project with code to explore

## Installation

This plugin is available in the Claude Code plugin marketplace:

```
/plugin install teach
```

Or install from the bundled plugins directory.

## Author

LvienOeria

## License

Apache-2.0
