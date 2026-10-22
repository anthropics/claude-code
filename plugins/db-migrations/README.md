# Database Migrations Plugin

A comprehensive database migration toolkit for Claude Code that helps you design schemas, generate migrations, review changes, and optimize queries safely.

## Overview

Database migrations are one of the riskiest operations in production systems. This plugin provides:

- **Safe migration generation** with proper up/down scripts
- **Migration review** for safety, performance, and correctness
- **Schema design** assistance with best practices
- **SQL optimization** for slow queries
- **Zero-downtime patterns** for production deployments
- **Safety hooks** that warn about dangerous operations

## Features

### Commands

| Command | Description |
|---------|-------------|
| `/generate-migration` | Generate database migrations from schema changes |
| `/review-migration` | Review migrations for safety and performance issues |
| `/schema-diff` | Compare schemas between environments and generate sync migrations |

### Agents

| Agent | Use When |
|-------|----------|
| `migration-reviewer` | Reviewing migrations before deployment |
| `schema-designer` | Designing new tables or data models |
| `sql-optimizer` | Optimizing slow queries or analyzing EXPLAIN output |

### Skills

| Skill | Content |
|-------|---------|
| `migration-patterns` | Zero-downtime patterns, ORM guides, rollback strategies |

### Hooks

| Hook | Purpose |
|------|---------|
| `PreToolUse` (Bash) | Warns about dangerous SQL operations (DROP, TRUNCATE, etc.) |

## Supported Technologies

### ORMs / Migration Tools
- Prisma
- Drizzle
- TypeORM
- Knex
- Raw SQL

### Databases
- PostgreSQL
- MySQL
- SQLite
- SQL Server

## Usage Examples

### Generate a Migration

```
/generate-migration add-user-roles --orm prisma --db postgres
```

Claude will:
1. Detect your project's ORM and database
2. Analyze current schema
3. Generate migration with UP and DOWN scripts
4. Include safety checks and recommendations

### Review a Migration

```
/review-migration prisma/migrations/20240101_add_users/migration.sql
```

Output includes:
- Risk level assessment (LOW/MEDIUM/HIGH/CRITICAL)
- Potential issues categorized by severity
- Performance implications
- Deployment recommendations
- Rollback strategy

### Compare Schemas

```
/schema-diff schema.prisma schema.prod.prisma
```

Generates:
- Detailed diff report
- Tables/columns added, removed, modified
- Index and constraint changes
- Migration to sync the schemas

### Design a Schema

Just ask the `schema-designer` agent:

```
"Design a schema for a multi-tenant SaaS application with users, organizations, and subscriptions"
```

### Optimize a Query

Ask the `sql-optimizer` agent:

```
"This query is running slow, can you optimize it?

SELECT * FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.created_at > '2024-01-01'
ORDER BY o.total DESC
LIMIT 100"
```

## Safety Features

### Automatic Warnings

The plugin automatically warns about:
- `DROP TABLE` operations
- `DROP COLUMN` without verification
- `TRUNCATE` on production tables
- `DELETE/UPDATE` without WHERE clauses
- Adding NOT NULL without DEFAULT
- Production migration commands

### Review Checklist

Every migration review includes:
- [ ] Data safety verification
- [ ] Performance impact assessment
- [ ] Correctness validation
- [ ] Rollback plan confirmation
- [ ] Staging test recommendation

## Best Practices

### Before Running Migrations

1. **Always backup** production data
2. **Test on staging** with production-like data
3. **Review with the plugin** using `/review-migration`
4. **Plan for rollback** - ensure DOWN migration works
5. **Schedule during low traffic** for large tables

### Migration Patterns

The plugin teaches and implements:

- **Expand and Contract** - For safe column changes
- **Shadow Tables** - For type changes
- **Online Schema Changes** - For large tables
- **Backward Compatibility** - For zero-downtime deploys

## Installation

1. Clone the claude-code repository
2. The plugin is automatically discovered from `plugins/db-migrations/`
3. Enable in Claude Code settings if not auto-enabled

## Directory Structure

```
db-migrations/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── generate-migration.md
│   ├── review-migration.md
│   └── schema-diff.md
├── agents/
│   ├── migration-reviewer.md
│   ├── schema-designer.md
│   └── sql-optimizer.md
├── skills/
│   └── migration-patterns/
│       ├── SKILL.md
│       └── examples/
│           └── zero-downtime-examples.md
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       └── validate-migration-command.sh
└── README.md
```

## Troubleshooting

### Hook not triggering

Ensure the hook script is executable:
```bash
chmod +x plugins/db-migrations/hooks/scripts/validate-migration-command.sh
```

### ORM not detected

Specify explicitly:
```
/generate-migration my-migration --orm prisma
```

### Wrong database dialect

Specify the database:
```
/generate-migration my-migration --db mysql
```

## Contributing

Contributions welcome! Please:
1. Follow existing patterns
2. Add examples for new patterns
3. Test with multiple ORMs/databases
4. Update README for new features

## Author

Rajesh Kumar (kakumanurajeshkumar@gmail.com)

## Version

1.0.0

## License

MIT
