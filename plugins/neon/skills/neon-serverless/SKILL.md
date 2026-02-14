---
name: Neon Serverless Driver
description: This skill should be used when the user wants to "connect to Neon from edge functions", "use the Neon serverless driver", "set up Neon HTTP connection", "configure WebSocket pooling", "use @neondatabase/serverless", or needs guidance on choosing connection methods, configuring the Neon serverless driver, and optimizing for edge/serverless runtimes.
version: 0.1.0
---

# Neon Serverless Driver

Configure the `@neondatabase/serverless` driver for optimal performance across different deployment targets.

## When to Use

- Connecting to Neon from Vercel Edge Functions, Cloudflare Workers, or Deno Deploy
- Choosing between HTTP and WebSocket connection modes
- Configuring connection pooling for serverless environments
- Optimizing cold start performance

## Installation

```bash
npm install @neondatabase/serverless
```

## Connection Methods

### 1. HTTP (neon) — For Serverless/Edge

The `neon()` function creates a single-shot HTTP connection per query. Ideal for:
- Vercel Edge Functions
- Cloudflare Workers
- AWS Lambda
- Any short-lived function

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Tagged template literal syntax
const users = await sql`SELECT * FROM users WHERE id = ${userId}`;

// Parameterized query
const result = await sql('SELECT * FROM users WHERE email = $1', [email]);
```

**Characteristics:**
- One HTTP request per query (no connection overhead)
- ~5-10ms latency per query
- Stateless — no connection to manage
- Works on all runtimes including edge

### 2. WebSocket (Pool/Client) — For Long-Lived

The `Pool` class creates WebSocket-based connections. Ideal for:
- Node.js servers
- Next.js API routes (non-edge)
- Background workers

```typescript
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query('SELECT * FROM users');

// With client checkout
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

**Characteristics:**
- Persistent WebSocket connection
- Supports transactions
- Compatible with `pg.Pool` API
- ~2-3ms latency per query after connection established

### 3. TCP (pg) — For Traditional Servers

Use standard `pg` driver over TCP for traditional server deployments:

```typescript
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL });
const { rows } = await pool.query('SELECT NOW()');
```

## Connection String Variants

Neon provides two connection string types:

| Type | Hostname Pattern | Use For |
|------|-----------------|---------|
| **Pooled** | `ep-xxx-pooler.region.aws.neon.tech` | Application queries |
| **Direct** | `ep-xxx.region.aws.neon.tech` | Migrations, DDL, introspection |

## Framework Integration

### Next.js (App Router + Edge)
```typescript
// app/api/data/route.ts
import { neon } from '@neondatabase/serverless';

export const runtime = 'edge';

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  const data = await sql`SELECT * FROM items LIMIT 10`;
  return Response.json(data);
}
```

### Vercel Serverless Functions
```typescript
// api/users.ts
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL!);
  const users = await sql`SELECT * FROM users`;
  res.json(users);
}
```

### Cloudflare Workers
```typescript
import { neon } from '@neondatabase/serverless';

export default {
  async fetch(request, env) {
    const sql = neon(env.DATABASE_URL);
    const data = await sql`SELECT NOW() as time`;
    return Response.json(data);
  },
};
```

## Connection Pooling

Neon's built-in connection pooler (PgBouncer) handles pooling at the infrastructure level:

- Use the **pooled** connection string (`-pooler` in hostname)
- Default pool size: 64 connections per endpoint
- Mode: transaction pooling (connection returned after each transaction)

For application-level pooling with WebSocket:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,          // max connections in local pool
  idleTimeoutMillis: 30000,
});
```

## Performance Tips

1. **Reuse `neon()` instances** — Create once at module level, not per request
2. **Use pooled connections** — Always use the `-pooler` hostname for app queries
3. **Batch queries** — Use `sql.transaction()` for multiple related queries
4. **Cache connection strings** — Avoid re-parsing on every invocation

## Validation Checklist

- [ ] `@neondatabase/serverless` installed
- [ ] Connection string uses pooled endpoint for application queries
- [ ] Edge functions use `neon()` (HTTP), not `Pool` (WebSocket)
- [ ] Node.js servers use `Pool` for persistent connections
- [ ] Migrations use direct (non-pooled) connection string
- [ ] Connection string stored in environment variables, not code
