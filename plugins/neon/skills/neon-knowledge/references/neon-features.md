# Neon Feature Reference

## Branching

- **Copy-on-write**: Branches share unchanged pages with parent, only divergent pages consume storage
- **Instant creation**: Sub-second regardless of database size
- **Independent compute**: Each branch gets its own compute endpoint
- **Point-in-time branching**: Branch from any point in time within retention window
- **Reset**: Restore a branch to parent state without recreating

## Autoscaling

- **Range**: 0.25 CU to 10 CU (1 CU = 1 vCPU + 4 GB RAM)
- **Scale to zero**: Compute suspends after configurable idle period (default: 5 min)
- **Cold start**: ~500ms to resume from suspended state
- **Warm start**: Immediate scaling within active range

## Connection Pooling (PgBouncer)

- **Mode**: Transaction pooling
- **Default pool size**: 64 connections per endpoint
- **Pooled hostname**: Contains `-pooler` suffix
- **Use for**: Application queries, serverless functions
- **Don't use for**: Migrations, advisory locks, LISTEN/NOTIFY

## Storage

- **Engine**: Custom storage engine separating compute and storage
- **Redundancy**: 3 safekeeper replicas for WAL durability
- **Point-in-time recovery**: Available within retention window
- **Compression**: Automatic page compression

## Serverless Driver

- **Package**: `@neondatabase/serverless`
- **HTTP mode**: `neon()` — single-shot queries over HTTP, edge-compatible
- **WebSocket mode**: `Pool`/`Client` — persistent connections, transaction support
- **Compatibility**: Works on Vercel Edge, Cloudflare Workers, Deno Deploy, AWS Lambda

## Neon Auth

- **Integration**: Stack Auth, Clerk, Auth.js support
- **Feature**: Automatic user sync to Neon database
- **RLS**: Row-level security with auth context

## Logical Replication

- **Inbound**: Replicate from external Postgres to Neon
- **Outbound**: Replicate from Neon to external systems
- **Use for**: Migration from other providers, data synchronization

## API

- **Base URL**: `https://console.neon.tech/api/v2`
- **Auth**: Bearer token (API key)
- **Resources**: Projects, Branches, Endpoints, Databases, Roles, Operations
- **Rate limits**: Vary by plan
- **OpenAPI spec**: Available at https://api-docs.neon.tech

## CLI (neonctl)

- **Install**: `npm install -g neonctl`
- **Auth**: `neonctl auth` (browser-based OAuth)
- **Key commands**:
  - `neonctl projects list`
  - `neonctl branches create --project-id <id> --name <name>`
  - `neonctl branches delete <name> --project-id <id>`
  - `neonctl connection-string --project-id <id>`
  - `neonctl databases list --project-id <id> --branch-name <name>`

## MCP Server

- **Package**: `@neondatabase/mcp-server-neon`
- **Protocol**: Model Context Protocol (MCP)
- **Capabilities**: Project/branch/database CRUD, SQL execution, schema inspection
- **Auth**: NEON_API_KEY environment variable or OAuth flow
