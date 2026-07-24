# Slash Command Recommendations

Slash commands are quick, repeatable prompts with optional arguments. They're ideal for frequently used workflows that don't need the overhead of a subagent.

## Code Review Commands

### /pr-review
**Best for**: Reviewing current branch changes

| Recommend When | Detection |
|----------------|-----------|
| Git-based workflow | `.git/` directory |
| PR-driven development | GitHub/GitLab remote |
| Regular code reviews | Team process |

**Value**: Quick review of PR changes with actionable feedback

---

### /quick-review
**Best for**: Fast review of a specific file

| Recommend When | Detection |
|----------------|-----------|
| Single file review needs | Ad-hoc reviews |
| Pre-commit checks | Before committing |

**Value**: Focused review without full PR context

---

## Testing Commands

### /test
**Best for**: Running tests for a specific file or pattern

| Recommend When | Detection |
|----------------|-----------|
| Jest configured | `jest.config.js`, package.json |
| pytest configured | `pytest.ini`, pyproject.toml |
| vitest configured | `vitest.config.js` |
| Test directory exists | `tests/`, `__tests__/` |

**Value**: Quick test runs with failure analysis

---

### /test-file
**Best for**: Generating tests for a specific file

| Recommend When | Detection |
|----------------|-----------|
| Test framework present | Testing deps installed |
| Source files without tests | Missing test coverage |

**Value**: Generates tests following project conventions

---

## Documentation Commands

### /doc
**Best for**: Generating documentation for code

| Recommend When | Detection |
|----------------|-----------|
| JSDoc/docstring patterns | Existing doc style |
| API code | Public functions/classes |

**Value**: Consistent documentation format

---

### /api-doc
**Best for**: Documenting API endpoints

| Recommend When | Detection |
|----------------|-----------|
| REST endpoints | Express, FastAPI routes |
| OpenAPI/Swagger | Existing spec files |
| Undocumented APIs | Routes without docs |

**Value**: Generates endpoint docs with examples

---

### /changelog
**Best for**: Updating changelog with recent changes

| Recommend When | Detection |
|----------------|-----------|
| CHANGELOG.md exists | Changelog present |
| Release workflow | Semantic versioning |

**Value**: Categorized changelog entries

---

## Debugging Commands

### /debug
**Best for**: Investigating issues in code

| Recommend When | Detection |
|----------------|-----------|
| Bug reports common | Active development |
| Complex codebase | Many files/dependencies |

**Value**: Systematic debugging approach

---

### /ci-fix
**Best for**: Debugging CI/CD failures

| Recommend When | Detection |
|----------------|-----------|
| CI configured | `.github/workflows/`, `.circleci/` |
| Frequent CI failures | Active CI pipeline |

**Value**: Reproduces and fixes CI issues

---

## Refactoring Commands

### /refactor
**Best for**: Improving code structure

| Recommend When | Detection |
|----------------|-----------|
| Legacy code | Old patterns detected |
| Code smells | Long files, complex functions |

**Value**: Guided refactoring with explanations

---

### /extract
**Best for**: Extracting reusable code

| Recommend When | Detection |
|----------------|-----------|
| Code duplication | Similar patterns |
| Long functions | Needs decomposition |

**Value**: Creates clean extractions with proper types

---

## Project Commands

### /init-claude
**Best for**: Setting up Claude Code configuration

| Recommend When | Detection |
|----------------|-----------|
| No `.claude/` directory | New project setup |
| No CLAUDE.md | Missing context |

**Value**: Creates complete Claude Code setup

---

### /setup
**Best for**: Developer environment setup

| Recommend When | Detection |
|----------------|-----------|
| New developer onboarding | README instructions |
| Complex setup | Multiple steps needed |

**Value**: Automated environment setup

---

## Utility Commands

### /explain
**Best for**: Understanding code

| Recommend When | Detection |
|----------------|-----------|
| Complex codebase | New to project |
| Legacy code | Undocumented patterns |

**Value**: Clear explanations without jargon

---

### /find
**Best for**: Locating code by description

| Recommend When | Detection |
|----------------|-----------|
| Large codebase | Many files |
| Unfamiliar structure | New to project |

**Value**: Finds code by concept, not just text

---

## Quick Reference: Detection → Recommendation

| If You See | Recommend Command |
|------------|------------------|
| Git repository | /pr-review |
| Test framework | /test |
| Test gaps | /test-file |
| API routes | /api-doc |
| CHANGELOG.md | /changelog |
| CI/CD config | /ci-fix |
| Complex code | /explain |
| Large codebase | /find |
| No .claude/ | /init-claude |

---

## Slash Command Placement

Commands go in `.claude/commands/`:

```
.claude/
└── commands/
    ├── test.md
    ├── pr-review.md
    └── explain.md
```

---

## Argument Patterns

| Pattern | Meaning | Example |
|---------|---------|---------|
| `<arg>` | Required | `<file-path>` |
| `[arg]` | Optional | `[branch-name]` |
| `$ARGUMENTS` | All args as string | Full input |
| `$1`, `$2` | Positional args | First, second arg |

---

## Tool Restrictions Guide

| Use Case | Restrict To |
|----------|------------|
| Read-only | Read, Grep, Glob |
| Can edit | + Write |
| Can run commands | + Bash |
| Full access | Omit restriction |
