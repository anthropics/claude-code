# Subagent Recommendations

Subagents are specialized Claude instances that run in parallel, each with their own context window and tool access. They're ideal for focused reviews, analysis, or generation tasks.

## Code Review Agents

### code-reviewer
**Best for**: Automated code quality checks on large codebases

| Recommend When | Detection |
|----------------|-----------|
| Large codebase (>500 files) | File count |
| Frequent code changes | Active development |
| Team wants consistent review | Quality focus |

**Value**: Runs code review in parallel while you continue working
**Model**: sonnet (balanced quality/speed)
**Tools**: Read, Grep, Glob, Bash

---

### security-reviewer
**Best for**: Security-focused code review

| Recommend When | Detection |
|----------------|-----------|
| Auth code present | `auth/`, `login`, `session` patterns |
| Payment processing | `stripe`, `payment`, `billing` patterns |
| User data handling | `user`, `profile`, `pii` patterns |
| API keys in code | Environment variable patterns |

**Value**: Catches OWASP vulnerabilities, auth issues, data exposure
**Model**: sonnet
**Tools**: Read, Grep, Glob (read-only for safety)

---

### test-writer
**Best for**: Generating comprehensive test coverage

| Recommend When | Detection |
|----------------|-----------|
| Low test coverage | Few test files vs source files |
| Test suite exists | `tests/`, `__tests__/` present |
| Testing framework configured | jest, pytest, vitest in deps |

**Value**: Generates tests matching project conventions
**Model**: sonnet
**Tools**: Read, Write, Grep, Glob

---

## Specialized Agents

### api-documenter
**Best for**: API documentation generation

| Recommend When | Detection |
|----------------|-----------|
| REST endpoints | Express routes, FastAPI paths |
| GraphQL schema | `.graphql` files |
| OpenAPI exists | `openapi.yaml`, `swagger.json` |
| Undocumented APIs | Routes without docs |

**Value**: Generates OpenAPI specs, endpoint documentation
**Model**: sonnet
**Tools**: Read, Write, Grep, Glob

---

### performance-analyzer
**Best for**: Finding performance bottlenecks

| Recommend When | Detection |
|----------------|-----------|
| Database queries | ORM usage, raw SQL |
| High-traffic code | API endpoints, hot paths |
| Performance complaints | User reports slowness |
| Complex algorithms | Nested loops, recursion |

**Value**: Finds N+1 queries, O(n²) algorithms, memory leaks
**Model**: sonnet
**Tools**: Read, Grep, Glob, Bash

---

### ui-reviewer
**Best for**: Frontend accessibility and UX review

| Recommend When | Detection |
|----------------|-----------|
| React/Vue/Angular | Frontend framework detected |
| Component library | `components/` directory |
| User-facing UI | Not just API project |

**Value**: Catches accessibility issues, UX problems, responsive design gaps
**Model**: sonnet
**Tools**: Read, Grep, Glob

---

## Utility Agents

### dependency-updater
**Best for**: Safe dependency updates

| Recommend When | Detection |
|----------------|-----------|
| Outdated deps | `npm outdated` has results |
| Security advisories | `npm audit` warnings |
| Major version behind | Significant version gaps |

**Value**: Updates dependencies incrementally with testing
**Model**: sonnet
**Tools**: Read, Write, Bash, Grep

---

### migration-helper
**Best for**: Framework/version migrations

| Recommend When | Detection |
|----------------|-----------|
| Major upgrade needed | Framework version very old |
| Breaking changes coming | Deprecation warnings |
| Refactoring planned | Architectural changes |

**Value**: Plans and executes migrations incrementally
**Model**: opus (complex reasoning needed)
**Tools**: Read, Write, Grep, Glob, Bash

---

## Quick Reference: Detection → Recommendation

| If You See | Recommend Subagent |
|------------|-------------------|
| Large codebase | code-reviewer |
| Auth/payment code | security-reviewer |
| Few tests | test-writer |
| API routes | api-documenter |
| Database heavy | performance-analyzer |
| Frontend components | ui-reviewer |
| Outdated packages | dependency-updater |
| Old framework version | migration-helper |

---

## Subagent Placement

Subagents go in `.claude/agents/`:

```
.claude/
└── agents/
    ├── code-reviewer.md
    ├── security-reviewer.md
    └── test-writer.md
```

---

## Model Selection Guide

| Model | Best For | Trade-off |
|-------|----------|-----------|
| **haiku** | Simple, repetitive checks | Fast, cheap, less thorough |
| **sonnet** | Most review/analysis tasks | Balanced (recommended default) |
| **opus** | Complex migrations, architecture | Thorough, slower, more expensive |

---

## Tool Access Guide

| Access Level | Tools | Use Case |
|--------------|-------|----------|
| Read-only | Read, Grep, Glob | Reviews, analysis |
| Writing | + Write | Code generation, docs |
| Full | + Bash | Migrations, testing |
