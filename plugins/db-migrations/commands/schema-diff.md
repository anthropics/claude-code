---
description: Compare database schema between environments or versions and generate migration
argument-hint: "[source-schema] [target-schema]"
allowed-tools: Bash(ls:*), Bash(cat:*), Bash(diff:*), Bash(pg_dump:*), Bash(mysqldump:*), Glob, Grep, Read, Write
---

## Context

You are a schema comparison expert. Your task is to identify differences between two database schemas and generate migrations to sync them.

### Available Schema Sources

- Schema files: !`find . -type f \( -name "schema.prisma" -o -name "*.sql" -o -name "schema.ts" \) 2>/dev/null | head -10`
- Migration history: !`find . -path "*/migrations/*" -name "*.sql" 2>/dev/null | head -10`

## Your Task

### Step 1: Load Both Schemas

Accept schemas from:
1. **File paths** - Direct schema file comparison
2. **Database connection** - Dump schema from live database
3. **Git refs** - Compare schema at different commits
4. **Environments** - Compare dev vs staging vs production

### Step 2: Parse and Compare

Identify differences in:
- **Tables** - Added, removed, renamed
- **Columns** - Added, removed, type changes, constraint changes
- **Indexes** - Added, removed, modified
- **Foreign Keys** - Added, removed, cascade changes
- **Constraints** - CHECK, UNIQUE, NOT NULL changes
- **Sequences** - Auto-increment changes
- **Views** - Definition changes
- **Functions/Procedures** - If applicable

### Step 3: Generate Diff Report

```markdown
## Schema Diff Report

### Source: [source identifier]
### Target: [target identifier]

---

### Tables

#### Added Tables
- `new_table` - [columns summary]

#### Removed Tables
- `old_table` (⚠️ DATA LOSS)

#### Modified Tables

##### `users`
| Change | Column | Before | After |
|--------|--------|--------|-------|
| MODIFIED | email | varchar(100) | varchar(255) |
| ADDED | phone | - | varchar(20) |
| REMOVED | legacy_id | int | - |

### Indexes

#### Added
- `idx_users_email` on `users(email)`

#### Removed
- `idx_old_index` on `old_table(column)`

### Foreign Keys

[Similar format]

---

### Migration Required: YES/NO
### Estimated Risk: LOW/MEDIUM/HIGH
### Data Loss Warning: YES/NO
```

### Step 4: Generate Migration (Optional)

If requested, generate migration SQL to transform source → target.

## Output

Provide:
1. Detailed diff report
2. Risk assessment
3. Recommended migration strategy
4. Generated migration files (if requested)
