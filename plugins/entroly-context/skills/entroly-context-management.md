---
name: entroly-context-management
description: Budget-aware context selection and verification for Claude Code sessions
---

# Entroly Context Management

When working with large codebases, use Entroly to manage context budget:

## When to use

- The codebase has more files than fit in the context window
- The user asks about cost optimization or token budget
- Multiple files need to be selected for a task

## How to use

Entroly provides these MCP tools:

- `entroly_select`: Select evidence fragments under a token budget
  - Input: query (string), budget (int, default 8000)
  - Output: selected fragments with relevance scores
  
- `entroly_recover`: Recover omitted content by CCR handle
  - Input: handle (string, e.g. "ccr:811e14e88963b07f71a564a1")
  - Output: exact original content

- `entroly_receipt`: Get the Context Receipt showing what was included/excluded
  - Output: audit trail of selection decisions

## Limitations

- Savings are workload-dependent — small repos may see no improvement
- Compression can reduce answer quality on some tasks
- `entroly simulate` gives local estimates, not billing guarantees
- SQuAD benchmark: accuracy drops 80% → 72% at 43.8% savings

## Setup

Requires `pip install entroly` (v1.0.76+). No API key needed for local operations.
