# Bark — AI-Powered Permission Hook for Claude Code 🐕

A community-built hook that uses AI to assess the risk level of every tool call. Auto-approves safe operations, sends notifications for medium-risk ones, and blocks dangerous commands until you confirm.

## What it does

Bark fills the gap between "approve everything manually" and "skip all safety checks":

- **Safe operations** (Read, Grep, Glob, file edits) → instant allow, 0ms
- **Medium risk** (git push, package installs) → system notification + auto allow
- **High risk** (rm -rf, force push, DB drops) → blocked, requires confirmation

## Architecture

```
Claude Code tool call
 │
 ▼
┌──────────────────────────────┐
│ Layer 1: Fast Rules          │ Read/Grep/Glob → instant allow
│ Normal file edits → allow    │
└──────────┬───────────────────┘
           │ miss
           ▼
┌──────────────────────────────┐
│ Layer 2: Custom Rules        │ User-defined patterns (bark.conf)
└──────────┬───────────────────┘
           │ miss
           ▼
┌──────────────────────────────┐
│ Layer 3: Cache Lookup        │ Normalized patterns, 24h TTL
└──────────┬───────────────────┘
           │ cache miss
           ▼
┌──────────────────────────────┐
│ Layer 4: AI Assessment       │ Semantic risk understanding
│ Returns level + reason       │ Result cached for next time
└──────────────────────────────┘
```

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/shaominngqing/Bark/main/install.sh | bash
```

Takes effect in new Claude Code sessions automatically.

## Features

- **3-tier risk levels**: Low (silent), Medium (notify), High (block + confirm)
- **Smart caching**: 24h TTL, repeated command patterns = 0ms
- **Custom rules**: `bark.conf` for allow/notify/block patterns
- **CLI tools**: `bark stats`, `bark log`, `bark cache`, `bark test <cmd>`
- **System notifications**: macOS and Linux support
- **Zero config**: Works out of the box with Claude Code's hooks system

## Links

- **GitHub**: https://github.com/shaominngqing/bark-claude-code-hook
- **License**: MIT
