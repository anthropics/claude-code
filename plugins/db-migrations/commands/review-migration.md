---
description: Review a database migration for safety, performance, and correctness
argument-hint: "[migration-file-path]"
allowed-tools: Bash(ls:*), Bash(cat:*), Glob, Grep, Read
---

## Context

You are a database migration reviewer. Your task is to thoroughly analyze migrations for potential issues.

### Migration File to Review

The user will provide a migration file path. If not provided, find the most recent migration:

- Recent migrations: !`find . -type f \( -name "*.sql" -o -name "*migration*" \) -mtime -7 2>/dev/null | head -10`

## Review Checklist

### 1. Data Safety

- [ ] **No accidental data loss** - DROP TABLE, DROP COLUMN, TRUNCATE
- [ ] **Reversibility** - Is there a down migration?
- [ ] **Backup considerations** - Are there large tables being modified?

### 2. Performance Impact

- [ ] **Table locks** - ALTER TABLE on large tables can lock reads/writes
- [ ] **Index creation** - CREATE INDEX without CONCURRENTLY blocks writes
- [ ] **Data migrations** - UPDATE on millions of rows can timeout

### 3. Correctness

- [ ] **Data types** - Appropriate for the data being stored
- [ ] **Constraints** - NOT NULL, UNIQUE, CHECK constraints
- [ ] **Foreign keys** - Cascade behavior (CASCADE, SET NULL, RESTRICT)
- [ ] **Default values** - Sensible defaults for new columns

### 4. Database Compatibility

- [ ] **Syntax** - Valid for the target database (PostgreSQL vs MySQL vs SQLite)
- [ ] **Features** - Using features supported by the database version

### 5. Best Practices

- [ ] **Naming conventions** - Consistent table/column naming
- [ ] **Index naming** - Descriptive index names
- [ ] **Transaction safety** - Wrapped in transaction where appropriate

## Output Format

Provide a structured review:

```markdown
## Migration Review: [filename]

### Summary
[One paragraph overview]

### Risk Level: [LOW | MEDIUM | HIGH | CRITICAL]

### Issues Found

#### Critical (Must Fix)
- Issue 1...

#### Warnings (Should Consider)
- Warning 1...

#### Suggestions (Nice to Have)
- Suggestion 1...

### Recommended Changes
[Specific code changes if needed]

### Safe to Deploy?
[YES / NO / YES WITH CAUTION]
```
