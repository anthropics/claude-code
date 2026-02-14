---
name: Neon Knowledge Base
description: This skill should be used when the user asks "how does Neon work", "what is Neon branching", "Neon architecture", "Neon autoscaling", "Neon connection pooling", "Neon compute", "Neon storage", or needs contextual knowledge about Neon Serverless Postgres features, architecture, pricing, and best practices.
version: 0.1.0
---

# Neon Knowledge Base

Contextual knowledge about Neon Serverless Postgres for accurate, up-to-date answers.

## What is Neon

Neon is a serverless Postgres platform that separates storage and compute, enabling:
- **Instant branching** — Copy-on-write database branches in milliseconds
- **Autoscaling** — Compute scales from 0 to 10 CU based on load
- **Scale to zero** — Compute suspends after inactivity, eliminating idle costs
- **Serverless driver** — HTTP and WebSocket access from edge runtimes

## Architecture

```
                    ┌──────────────────┐
                    │  Neon Proxy       │  Connection routing + auth
                    │  (PgBouncer)     │  Pooled: -pooler hostname
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Compute (CU)    │  Postgres instance
                    │  Autoscale 0-10  │  Suspends on idle
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Pageserver       │  Manages data pages
                    │  (Storage)       │  Copy-on-write branches
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Safekeepers      │  WAL durability
                    │  (3 replicas)    │  Point-in-time recovery
                    └──────────────────┘
```

## Key Concepts

### Branching

Neon branches are copy-on-write clones of a database at a point in time:

- **Instant** — Branch creation takes milliseconds regardless of database size
- **Storage efficient** — Only changed pages consume additional storage
- **Independent** — Each branch has its own compute endpoint
- **Resettable** — Branches can be reset to parent state

Use cases: preview environments, testing, development, data recovery.

### Connection Pooling

Neon includes PgBouncer-based connection pooling:

- **Pooled endpoint** — `-pooler` in hostname, transaction-mode pooling
- **Direct endpoint** — For DDL, migrations, advisory locks
- **Default pool size** — 64 connections per endpoint

### Autoscaling

Compute resources scale automatically:

| Setting | Description |
|---------|-------------|
| Min CU | Minimum compute units (can be 0 for scale-to-zero) |
| Max CU | Maximum compute units (up to 10) |
| Suspend after | Idle time before compute suspends (default: 5 min) |

1 Compute Unit (CU) = 1 vCPU + 4 GB RAM.

### Regions

Neon is available in multiple AWS and Azure regions:
- `aws-us-east-1`, `aws-us-east-2`, `aws-us-west-2`
- `aws-eu-central-1`, `aws-eu-west-1`, `aws-eu-west-2`
- `aws-ap-southeast-1`, `aws-ap-southeast-2`
- Azure regions also available

### Postgres Version Support

Neon supports Postgres 14, 15, 16, and 17 (default: 16).

## Best Practices

### Connection Strings

- **Application queries**: Use pooled connection string (`-pooler`)
- **Migrations/DDL**: Use direct connection string (no pooler)
- **Edge functions**: Use `@neondatabase/serverless` with `neon()` for HTTP
- **Node.js servers**: Use `Pool` from `@neondatabase/serverless` for WebSocket

### Branch Management

- Name branches consistently: `preview/pr-{number}`, `dev`, `staging`
- Delete branches when PRs are merged/closed
- Reset dev/staging branches periodically from main
- Use schema diff before merging to catch migration issues

### Performance

- Enable connection pooling for all application connections
- Set appropriate autoscaling bounds for workload
- Use read replicas for read-heavy workloads
- Consider regional proximity between compute and application

### Security

- Store connection strings in environment variables or secret managers
- Use separate database roles for application vs. admin access
- Enable IP allowlists for production databases
- Rotate API keys periodically

## Integration Ecosystem

| Integration | Description |
|------------|-------------|
| Vercel | Native integration for preview branches |
| GitHub Actions | Branch management actions |
| Drizzle ORM | First-class serverless driver support |
| Prisma | Accelerate + serverless adapter |
| Auth.js | NextAuth adapter with Neon |
| Clerk | Auth with Neon backing store |

## Links

- Documentation: https://neon.tech/docs
- Console: https://console.neon.tech
- API Reference: https://api-docs.neon.tech
- Serverless Driver: https://github.com/neondatabase/serverless
- MCP Server: https://mcp.neon.tech
- CLI: https://neon.tech/docs/reference/neon-cli
