---
name: discover-plugins
description: Discover and recommend ruflo plugins based on your workflow, installed MCP tools, and current task
argument-hint: "[search-query]"
allowed-tools: mcp__claude-flow__transfer_plugin-search mcp__claude-flow__transfer_plugin-info mcp__claude-flow__transfer_plugin-featured mcp__claude-flow__transfer_plugin-official mcp__claude-flow__transfer_store-search mcp__claude-flow__transfer_store-featured mcp__claude-flow__transfer_store-trending mcp__claude-flow__transfer_store-info mcp__claude-flow__guidance_discover mcp__claude-flow__guidance_recommend mcp__claude-flow__guidance_capabilities mcp__claude-flow__mcp_status Bash Read
---

# Discover Plugins

Find and recommend ruflo plugins for your workflow.

## When to use

When starting a new project, exploring ruflo capabilities, or wondering which plugins would help with your current task.

## Steps

1. **Check installed** — run `ls plugins/` to see what's already installed
2. **Browse marketplace** — call `mcp__claude-flow__transfer_plugin-featured` for recommended plugins
3. **Search by need** — call `mcp__claude-flow__transfer_plugin-search` with keywords matching your task
4. **Get recommendations** — call `mcp__claude-flow__guidance_recommend` with your current task description for personalized suggestions
5. **Check capabilities** — call `mcp__claude-flow__guidance_capabilities` to see what each plugin enables
6. **Show details** — call `mcp__claude-flow__transfer_plugin-info` for full plugin details

## Plugin Catalog (32 plugins)

### Core & Coordination — Start here

| Plugin | When to use | What it adds |
|--------|-------------|-------------|
| **ruflo-core** | Always — base layer for all Ruflo work | MCP server, status, doctor, coder/researcher/reviewer agents |
| **ruflo-swarm** | Multi-agent tasks (3+ files, features, refactors) | Swarm topologies (hierarchical, mesh), Monitor streaming, worktree isolation |
| **ruflo-autopilot** | Autonomous task completion without manual steering | /loop-based autonomous execution, progress prediction, learning |
| **ruflo-loop-workers** | Recurring background work (audits, optimization, mapping) | 12 background workers via /loop or CronCreate scheduling |
| **ruflo-workflows** | Repeatable multi-step processes | Workflow templates, parallel execution, conditional branching |

### Memory & Intelligence — Cross-session learning

| Plugin | When to use | What it adds |
|--------|-------------|-------------|
| **ruflo-agentdb** | Semantic search over code patterns, telemetry, decisions | AgentDB with HNSW vector search (150x-12,500x faster), RuVector embeddings |
| **ruflo-rag-memory** | Simple key-value memory with search | Store/search/recall without full AgentDB setup |
| **ruflo-rvf** | Portable memory export/import across machines | RVF format, session persistence, cross-platform transfer |
| **ruflo-ruvector** | Vector embedding operations, HNSW indexing, clustering | ONNX 384-dim embeddings, hyperbolic Poincare ball, k-means/DBSCAN clustering |
| **ruflo-knowledge-graph** | Entity extraction, relation mapping, graph traversal | Pathfinder algo on AgentDB causal edges, code entity graphs |
| **ruflo-intelligence** | Task routing optimization, learning from outcomes | SONA neural patterns, trajectory learning, model routing with confidence |
| **ruflo-daa** | Self-adapting agents that evolve behavior | Dynamic Agentic Architecture, cognitive patterns, knowledge sharing |

### Architecture & Methodology — Build right

| Plugin | When to use | What it adds |
|--------|-------------|-------------|
| **ruflo-adr** | Document architecture decisions, check compliance | ADR create/index/supersede, code-to-ADR linking, compliance checking on diffs |
| **ruflo-ddd** | Domain modeling, bounded context scaffolding | Context wizard, aggregate roots, domain events, anti-corruption layers, boundary validation |
| **ruflo-sparc** | Structured development methodology | Specification-Pseudocode-Architecture-Refinement-Completion with quality gates |

### Quality & Security — Ship safely

| Plugin | When to use | What it adds |
|--------|-------------|-------------|
| **ruflo-security-audit** | Before merging, after dependency changes | CVE scanning, dependency vulnerability checks, security reports |
| **ruflo-aidefence** | Processing user input, handling untrusted data | Prompt injection detection, PII scanning, adversarial defense |
| **ruflo-testgen** | After implementing features, during refactors | Test gap detection, TDD London School workflow, coverage routing |
| **ruflo-browser** | UI testing, web scraping, visual validation | Playwright automation — navigate, click, screenshot, validate |

### Development Tools — Build faster

| Plugin | When to use | What it adds |
|--------|-------------|-------------|
| **ruflo-jujutsu** | PR review, merge decisions, diff risk scoring | Diff analysis, risk classification, reviewer recommendations |
| **ruflo-docs** | After API changes, before releases | Doc generation, drift detection, API documentation |
| **ruflo-ruvllm** | Local LLM inference, custom model configs | RuVLLM integration, MicroLoRA fine-tuning, chat formatting |
| **ruflo-agent** | Sandboxed code execution, untrusted workloads | WASM agent sandboxing, community gallery |
| **ruflo-plugin-creator** | Building new ruflo plugins | Scaffold structure, validate frontmatter, test MCP references |
| **ruflo-migrations** | Database schema changes | Sequential migration numbering, up/down pairs, dry-run, rollback validation |
| **ruflo-observability** | Logging, tracing, metrics correlation | Structured JSON logging, distributed tracing, agent-to-app telemetry correlation |
| **ruflo-cost-tracker** | Token budget management | Per-agent cost attribution, model pricing, budget alerts, optimization recommendations |

### Domain-Specific — Specialized workloads

| Plugin | When to use | What it adds |
|--------|-------------|-------------|
| **ruflo-goals** | Long-horizon planning, multi-session research | GOAP algorithm, deep research orchestration, horizon tracking, synthesis |
| **ruflo-federation** | Cross-installation agent coordination | Zero-trust peer discovery, mTLS auth, consensus routing, compliance audit |
| **ruflo-iot-cognitum** | Cognitum Seed hardware device management | 5-tier device trust, telemetry anomaly detection (Z-score), fleet firmware rollouts, witness chain verification, SONA + AgentDB integration |
| **ruflo-neural-trader** | Trading strategy development and backtesting | Z-score market anomalies, SONA trajectory strategies, walk-forward backtesting, portfolio optimization |
| **ruflo-market-data** | Market data ingestion and pattern matching | OHLCV vectorization, candlestick pattern detection, HNSW-indexed historical search |

## Decision Guide

**"I need to..."** → Use this plugin:

- Build a feature → `ruflo-core` + `ruflo-swarm` + `ruflo-testgen`
- Fix a bug → `ruflo-core` + `ruflo-jujutsu` (for diff analysis)
- Audit security → `ruflo-security-audit` + `ruflo-aidefence`
- Run background tasks → `ruflo-loop-workers` + `ruflo-autopilot`
- Search past decisions → `ruflo-agentdb` + `ruflo-rag-memory`
- Plan a multi-week effort → `ruflo-goals` (horizon tracking)
- Manage IoT devices → `ruflo-iot-cognitum`
- Coordinate remote agents → `ruflo-federation`
- Test UI changes → `ruflo-browser`
- Generate docs → `ruflo-docs`
- Create a new plugin → `ruflo-plugin-creator`
- Document architecture decisions → `ruflo-adr`
- Scaffold domain models → `ruflo-ddd`
- Follow SPARC methodology → `ruflo-sparc`
- Develop trading strategies → `ruflo-neural-trader` + `ruflo-market-data`
- Work with vector embeddings → `ruflo-ruvector`
- Build knowledge graphs → `ruflo-knowledge-graph`
- Manage database migrations → `ruflo-migrations`
- Add observability → `ruflo-observability`
- Track token costs → `ruflo-cost-tracker`

## Install any plugin

```
/plugin marketplace add ruvnet/ruflo
/plugin install <plugin-name>@ruflo
```
