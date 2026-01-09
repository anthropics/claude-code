---
description: Run all available linters on the codebase with auto-fix option
allowed-tools: Bash(ruff:*), Bash(mypy:*), Bash(cargo:*), Bash(npx:*), Bash(python3:*), Bash(codespell:*), Glob, TodoWrite
argument-hint: [--fix] [--strict] [--lang=python,rust,js]
---

# Comprehensive Linting Suite

Run all available linters across the codebase.

## Arguments

Parse: $ARGUMENTS

- `--fix`: Apply automatic fixes
- `--strict`: Treat warnings as errors
- `--lang=X`: Filter by language

## Detected Languages

!`find . -type f \( -name "*.py" -o -name "*.rs" -o -name "*.js" -o -name "*.ts" \) 2>/dev/null | head -5 | xargs -I {} dirname {} | sort -u | head -5`

## Linting Commands

### Python
```bash
# Check syntax
python3 -m compileall -q .

# Ruff (fast linter)
ruff check . --output-format=grouped
ruff check . --fix  # if --fix

# MyPy (type checking)
mypy . --ignore-missing-imports
```

### Rust
```bash
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --check  # or cargo fmt if --fix
```

### JavaScript/TypeScript
```bash
npx eslint . --ext .js,.ts,.jsx,.tsx
npx eslint . --fix  # if --fix
npx prettier --check "**/*.{js,ts,jsx,tsx}"  # or --write if --fix
```

### Spelling
```bash
codespell --skip="*.min.js,node_modules,target,.git,__pycache__" .
codespell --write-changes  # if --fix
```

## Output

Provide a summary table:
| Language | Files | Errors | Warnings | Fixed |
|----------|-------|--------|----------|-------|
| Python   | X     | Y      | Z        | N     |
| Rust     | X     | Y      | Z        | N     |
| JS/TS    | X     | Y      | Z        | N     |
| Spelling | X     | Y      | -        | N     |
