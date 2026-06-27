---
name: Database Migration Patterns
description: Use this skill when working with database migrations, understanding migration strategies, or implementing zero-downtime deployments. Provides patterns for safe schema changes, data migrations, and rollback strategies.
version: 1.0.0
---

# Database Migration Patterns

This skill provides comprehensive patterns and best practices for database migrations across different ORMs and databases.

## Overview

Database migrations are one of the riskiest operations in production systems. This skill covers:

- Safe schema change patterns
- Zero-downtime migration strategies
- ORM-specific patterns (Prisma, Drizzle, TypeORM, Knex)
- Database-specific considerations (PostgreSQL, MySQL, SQLite)
- Rollback and recovery strategies

## Core Principles

### 1. Reversibility

Every migration should have a clear rollback path:

```sql
-- UP
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- DOWN
ALTER TABLE users DROP COLUMN phone;
```

### 2. Idempotency

Migrations should be safe to run multiple times:

```sql
-- Bad
CREATE TABLE users (...);

-- Good
CREATE TABLE IF NOT EXISTS users (...);
```

### 3. Atomicity

Group related changes in transactions:

```sql
BEGIN;
ALTER TABLE orders ADD COLUMN status VARCHAR(20);
UPDATE orders SET status = 'pending' WHERE status IS NULL;
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
COMMIT;
```

### 4. Backward Compatibility

During deployment, both old and new code may run simultaneously:

```
Phase 1: Add new column (nullable)
Phase 2: Deploy new code that writes to new column
Phase 3: Backfill existing data
Phase 4: Make column NOT NULL
Phase 5: Remove old column (if applicable)
```

## Zero-Downtime Migration Patterns

### Pattern 1: Expand and Contract

**Adding a NOT NULL column to existing table:**

```sql
-- Step 1: Add nullable column with default
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- Step 2: Backfill data (in batches)
UPDATE users SET email_verified = TRUE
WHERE id IN (SELECT id FROM email_verifications);

-- Step 3: Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
```

### Pattern 2: Shadow Tables

**Changing column type safely:**

```sql
-- Step 1: Create new column
ALTER TABLE users ADD COLUMN price_cents BIGINT;

-- Step 2: Deploy dual-write code
-- Application writes to both price and price_cents

-- Step 3: Backfill
UPDATE users SET price_cents = price * 100;

-- Step 4: Switch reads to new column
-- Step 5: Stop writing to old column
-- Step 6: Drop old column (later)
```

### Pattern 3: Online Schema Changes

**For MySQL (pt-online-schema-change):**

```bash
pt-online-schema-change \
  --alter "ADD COLUMN status VARCHAR(20)" \
  --execute D=mydb,t=large_table
```

**For PostgreSQL (pg_repack):**

```bash
pg_repack --no-superuser-check -t large_table mydb
```

## ORM-Specific Patterns

### Prisma

```prisma
// schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

Migration command:
```bash
npx prisma migrate dev --name add_users_table
npx prisma migrate deploy  # Production
```

### Drizzle

```typescript
// schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

Migration command:
```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

### TypeORM

```typescript
// migration file
export class AddUsersTable1234567890 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
  }
}
```

### Knex

```javascript
// migration file
exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).notNull().unique();
    table.timestamp('created_at').notNull().defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
```

## Database-Specific Considerations

### PostgreSQL

**Concurrent index creation:**
```sql
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

**Online column addition:**
```sql
-- Adding column with default is fast in PG 11+
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
```

### MySQL

**Online DDL:**
```sql
ALTER TABLE users ADD COLUMN status VARCHAR(20), ALGORITHM=INPLACE, LOCK=NONE;
```

**Limitations:**
- Some operations still require table copy
- Foreign key changes may lock table

### SQLite

**Limitations:**
- No ALTER COLUMN support
- Limited ALTER TABLE operations

**Workaround pattern:**
```sql
-- Rename table
ALTER TABLE users RENAME TO users_old;

-- Create new table with desired schema
CREATE TABLE users (...);

-- Copy data
INSERT INTO users SELECT ... FROM users_old;

-- Drop old table
DROP TABLE users_old;
```

## Dangerous Operations Checklist

| Operation | Risk | Mitigation |
|-----------|------|------------|
| DROP TABLE | Data loss | Backup first, soft delete |
| DROP COLUMN | Data loss | Verify not in use |
| TRUNCATE | Data loss | Backup first |
| ALTER TYPE (shrink) | Data truncation | Check max lengths |
| ADD NOT NULL | Migration failure | Add with default |
| Rename column | App breakage | Expand/contract pattern |
| Change primary key | Complex | Create new table |

## Testing Migrations

### Local Testing

```bash
# Create test database
createdb myapp_test

# Run migrations
npx prisma migrate deploy

# Run tests
npm test

# Reset
dropdb myapp_test
```

### CI/CD Testing

```yaml
# GitHub Actions example
- name: Test migrations
  run: |
    docker run -d --name postgres -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:15
    sleep 5
    npx prisma migrate deploy
    npm test
```

## Rollback Strategies

### Immediate Rollback

```bash
# Prisma
npx prisma migrate resolve --rolled-back "migration_name"

# Knex
npx knex migrate:rollback

# TypeORM
npx typeorm migration:revert
```

### Data Recovery

```sql
-- Restore from backup
pg_restore -d mydb backup.dump

-- Point-in-time recovery (if configured)
-- Requires WAL archiving in PostgreSQL
```

## Monitoring Migrations

### Pre-migration Checks

```sql
-- Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'mydb';

-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;
```

### During Migration

```sql
-- Monitor progress (PostgreSQL)
SELECT * FROM pg_stat_progress_create_index;
SELECT * FROM pg_stat_progress_alter_table;
```

## Resources

- [PostgreSQL ALTER TABLE documentation](https://www.postgresql.org/docs/current/sql-altertable.html)
- [MySQL Online DDL Operations](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Strong Migrations gem (patterns)](https://github.com/ankane/strong_migrations)
