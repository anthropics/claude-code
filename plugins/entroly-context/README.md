# entroly-context

Budget-aware context management plugin for Claude Code. Uses [Entroly](https://github.com/juyterman1000/entroly) to select evidence under an explicit token budget, keep omitted content byte-exactly recoverable, and emit auditable Context Receipts.

## What it does

When working with large codebases that exceed Claude's context window, this plugin provides:

- **Budget-aware selection**: Picks the most relevant code fragments under an explicit token limit using BM25 scoring and dependency-graph analysis
- **Exact recovery**: Any omitted content stays content-addressed and byte-recoverable via CCR handles — nothing is permanently lost
- **Context Receipts**: Auditable record of what was included, excluded, and why
- **Local verification**: `entroly verify-claims` validates all operations locally, no API key needed

## Prerequisites

```bash
pip install entroly
```

Requires Python 3.10+ and Entroly v1.0.76+. No API key needed — all operations run locally.

## Verification

Run this to confirm the plugin works (no API key, no network calls):

```bash
entroly verify-claims
```

Expected output: **12/12 checks passed** (SDK import, local indexing, context optimization, exact recovery, engine mode).

## Usage

Once installed, the MCP server provides three tools:

| Tool | Description |
|------|-------------|
| `entroly_select` | Select evidence fragments under a token budget |
| `entroly_recover` | Recover omitted content by CCR handle |
| `entroly_receipt` | Get the Context Receipt audit trail |

Example in a Claude Code session:

```
> /entroly-context select "How does authentication work?" --budget 4096
Selected 17 fragments (3,877 tokens) from 140 indexed files
Top files: lib.rs, auth.py, config.json
```

## Honest limitations

- Savings are **workload-dependent** — small repos that fit in the context window pass through unchanged
- Compression can reduce answer quality on some tasks (SQuAD: 80% → 72% at 43.8% savings)
- `entroly simulate` gives local token estimates, not provider billing guarantees
- Full limitations: [docs/limitations.md](https://github.com/juyterman1000/entroly/blob/main/docs/limitations.md)

## Plugin structure

```
entroly-context/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   └── entroly-context-management.md  # Skill definition
├── .mcp.json                # MCP server configuration
└── README.md                # This file
```

## License

Apache-2.0

## Disclosure

This plugin is maintained by the Entroly project maintainer.
