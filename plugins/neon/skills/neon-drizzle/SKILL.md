---
name: Neon Drizzle ORM
description: This skill should be used when the user wants to "set up Drizzle ORM with Neon", "create a database schema", "configure Drizzle", "add Drizzle to a Next.js project", "connect Drizzle to Neon Postgres", or needs guidance on schema definition, migrations, and connection setup with Drizzle ORM and Neon Serverless Postgres.
version: 0.1.0
---

# Neon + Drizzle ORM Setup

Guide the integration of Drizzle ORM with Neon Serverless Postgres, from installing dependencies to running migrations.

## When to Use

- Setting up a new project with Drizzle ORM and Neon
- Adding database connectivity to an existing Next.js / Node.js project
- Creating or modifying database schemas with Drizzle
- Configuring connection pooling with Neon

## Prerequisites

- A Neon project with a database (create at https://console.neon.tech)
- Node.js 18+ project with `package.json`
- Connection string from Neon dashboard

## Step 1: Install Dependencies

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

For Next.js projects also install dotenv:
```bash
npm install dotenv
```

## Step 2: Configure Environment

Create or update `.env`:
```env
# Pooled connection (for application queries via serverless driver)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require

# Direct connection (for migrations, introspection)
DIRECT_DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

- **DATABASE_URL**: Use the pooled connection string (hostname contains `-pooler`)
- **DIRECT_DATABASE_URL**: Use the direct connection string (no pooler, for DDL operations)

## Step 3: Create Database Connection

Create `db/index.ts`:
```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

For WebSocket connections (long-lived, e.g., Node.js server):
```typescript
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

## Step 4: Define Schema

Create `db/schema.ts`:
```typescript
import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## Step 5: Configure Drizzle Kit

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL!,
  },
});
```

## Step 6: Generate & Run Migrations

```bash
# Generate migration SQL from schema changes
npx drizzle-kit generate

# Push schema directly (development only)
npx drizzle-kit push

# Run migrations (production)
npx drizzle-kit migrate
```

## Step 7: Verify Connection

```typescript
import { db } from './db';
import { users } from './db/schema';

const allUsers = await db.select().from(users);
console.log('Connected! Users:', allUsers);
```

## Connection Method Selection

| Method | Use Case | Driver |
|--------|----------|--------|
| HTTP (`neon()`) | Serverless/Edge functions, short-lived | `@neondatabase/serverless` |
| WebSocket (`Pool`) | Long-running Node.js servers | `@neondatabase/serverless` |
| TCP (`pg.Pool`) | Traditional servers, CI/CD | `pg` |

## Common Patterns

### Query with Drizzle
```typescript
// Select with conditions
const user = await db.select().from(users).where(eq(users.email, 'a@b.com'));

// Insert
await db.insert(users).values({ name: 'Alice', email: 'alice@example.com' });

// Update
await db.update(users).set({ name: 'Bob' }).where(eq(users.id, 1));

// Delete
await db.delete(users).where(eq(users.id, 1));
```

### Next.js App Router
```typescript
// app/api/users/route.ts
import { db } from '@/db';
import { users } from '@/db/schema';
import { NextResponse } from 'next/server';

export async function GET() {
  const result = await db.select().from(users);
  return NextResponse.json(result);
}
```

## Validation Checklist

- [ ] `@neondatabase/serverless` and `drizzle-orm` installed
- [ ] `.env` has both `DATABASE_URL` (pooled) and `DIRECT_DATABASE_URL` (direct)
- [ ] Connection uses the appropriate driver (HTTP for serverless, WebSocket for long-lived)
- [ ] `drizzle.config.ts` uses `DIRECT_DATABASE_URL` for migrations
- [ ] Schema exports all table definitions from a single module
- [ ] `.env` is in `.gitignore` (never commit connection strings)
- [ ] Migrations generated and applied successfully
