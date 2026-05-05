---
description: Generate a database migration from schema changes or description
argument-hint: "[migration-name] [--orm prisma|drizzle|typeorm|knex|raw] [--db postgres|mysql|sqlite|mssql]"
allowed-tools: Bash(ls:*), Bash(cat:*), Bash(find:*), Glob, Grep, Read, Write, Edit
---

## Context

You are a database migration generator. Your task is to create safe, reversible database migrations.

### Current Project Analysis

- Migration files: !`find . -type f \( -name "*.sql" -o -name "*migration*" \) 2>/dev/null | head -20`
- Schema files: !`find . -type f \( -name "schema.prisma" -o -name "schema.ts" -o -name "*schema*" \) 2>/dev/null | head -10`
- ORM config: !`ls -la prisma/ drizzle/ migrations/ 2>/dev/null | head -20`
- Package.json deps: !`cat package.json 2>/dev/null | grep -E "(prisma|drizzle|typeorm|knex|sequelize|pg|mysql|sqlite)" | head -10`

## Your Task

Generate a database migration based on the user's request. Follow these steps:

### Step 1: Detect ORM/Migration Tool

Look for:
- `prisma/` directory → Prisma
- `drizzle.config.ts` → Drizzle
- `ormconfig.json` or `typeorm` in package.json → TypeORM
- `knexfile.js` → Knex
- Raw `.sql` files in `migrations/` → Raw SQL

### Step 2: Analyze Current Schema

Read the current schema to understand:
- Existing tables and relationships
- Data types and constraints
- Indexes and foreign keys

### Step 3: Generate Migration

Create the migration file in the appropriate format:

**For Prisma:**
```
prisma/migrations/YYYYMMDDHHMMSS_migration_name/migration.sql
```

**For Drizzle:**
```
drizzle/XXXX_migration_name.sql
```

**For TypeORM:**
```
src/migrations/timestamp-MigrationName.ts
```

**For Knex:**
```
migrations/timestamp_migration_name.js
```

**For Raw SQL:**
```
migrations/YYYYMMDDHHMMSS_migration_name.up.sql
migrations/YYYYMMDDHHMMSS_migration_name.down.sql
```

### Step 4: Include Both Up and Down

ALWAYS generate:
1. **UP migration** - Apply the change
2. **DOWN migration** - Revert the change (for rollback)

### Step 5: Safety Checks

Before finalizing, verify:
- [ ] No data loss without explicit user confirmation
- [ ] Foreign key constraints are handled correctly
- [ ] Indexes are created for frequently queried columns
- [ ] Column types are appropriate for the database
- [ ] Default values are set for non-nullable columns in existing tables

## Output Format

After generating the migration:

1. Show the migration file content
2. Explain what the migration does
3. List any potential risks or considerations
4. Provide the command to run the migration
