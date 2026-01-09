---
description: Run comprehensive code quality validation on a repository or specific files
allowed-tools: Bash(git:*), Bash(ruff:*), Bash(mypy:*), Bash(cargo:*), Bash(npx:*), Bash(python3:*), Bash(jq:*), Bash(codespell:*), Read, Glob, Grep, TodoWrite
argument-hint: [branch|all] [--lang=python,rust,js] [--fix] [--path=src/]
---

# Repository Code Quality Validator

You are a code quality validation assistant. Your task is to run comprehensive quality checks on the repository.

## Current Context

- Git branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`
- Git status: !`git status --porcelain 2>/dev/null | head -20`
- Repository root: !`git rev-parse --show-toplevel 2>/dev/null || pwd`

## Arguments

Parse the following arguments: $ARGUMENTS

- `branch|all`: Validate current branch, specific branch, or all branches
- `--lang=X,Y`: Filter by languages (python, rust, javascript, typescript)
- `--fix`: Attempt automatic fixes where possible
- `--path=X`: Limit validation to specific path

## Validation Tasks

Create a TODO list and work through these checks systematically:

### 1. Python Files (.py)
```bash
# Syntax check
python3 -m compileall -q <path>

# Linting with ruff
ruff check --output-format=grouped <path>

# Type checking
mypy --ignore-missing-imports <path>

# Auto-fix (if --fix)
ruff check --fix <path>
```

### 2. Rust Files (.rs)
```bash
# Type and borrow checking
cargo check --all-targets

# Linting with clippy
cargo clippy --all-targets -- -W clippy::all

# Auto-fix (if --fix)
cargo fix --allow-dirty --allow-staged
cargo fmt
```

### 3. JavaScript/TypeScript Files (.js, .ts, .jsx, .tsx)
```bash
# JSHint for JavaScript
npx jshint <file>

# ESLint
npx eslint <path>

# TypeScript type check
npx tsc --noEmit --skipLibCheck

# Auto-fix (if --fix)
npx eslint --fix <path>
npx prettier --write <path>
```

### 4. JSON Files
```bash
# Validate JSON syntax
jq '.' <file> > /dev/null
```

### 5. Spelling and Documentation
```bash
# Check spelling in code
codespell <path>

# Check for missing docstrings (Python)
# Check for missing JSDoc (JavaScript)
```

## Output Format

For each file type, report:
1. Number of files checked
2. Errors found (blocking issues)
3. Warnings found (suggestions)
4. Files auto-fixed (if --fix was used)

Provide a summary table at the end showing overall repository health.

## Important Notes

- Run checks in parallel where possible for efficiency
- Stop on first critical error in each category
- Suggest fixes for common issues
- Track all tasks in the TODO list
