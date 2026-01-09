---
description: Validate documentation, docstrings, and generate doc coverage reports
allowed-tools: Bash(doxygen:*), Bash(python3:*), Bash(npx:*), Bash(cargo:*), Read, Glob, Grep, TodoWrite
argument-hint: [--format=sphinx|numpy|google] [--generate] [--path=src/]
---

# Documentation Validation

Check documentation coverage and quality across the codebase.

## Arguments

Parse: $ARGUMENTS

- `--format=X`: Docstring format (sphinx, numpy, google)
- `--generate`: Generate documentation
- `--path=X`: Limit to specific path

## Checks

### Python Docstrings
```bash
# Check for missing docstrings
python3 -c "
import ast
import sys
from pathlib import Path

def check_docstrings(file_path):
    with open(file_path) as f:
        tree = ast.parse(f.read())

    missing = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
            if not ast.get_docstring(node):
                missing.append((node.lineno, node.name))
    return missing

# Check files...
"

# Pydocstyle for style compliance
pydocstyle --convention=<format> <path>
```

### Rust Documentation
```bash
# Check for missing docs
cargo doc --no-deps 2>&1 | grep -i "warning.*missing"

# Generate docs
cargo doc --no-deps --open  # if --generate
```

### JavaScript/TypeScript JSDoc
```bash
# Check JSDoc coverage
npx jsdoc-coverage <path>

# TypeDoc for TypeScript
npx typedoc --validation <path>
```

### README and Markdown
```bash
# Check for broken links
npx markdown-link-check README.md

# Check markdown syntax
npx markdownlint "**/*.md"
```

### Doxygen (C/C++)
```bash
# Generate Doxyfile if not exists
doxygen -g Doxyfile 2>/dev/null

# Run doxygen and check warnings
doxygen Doxyfile 2>&1 | grep -i warning
```

## Output

Provide documentation coverage report:
- Functions/methods with docstrings: X%
- Classes with docstrings: X%
- Public API documentation: X%
- Broken links found: Y
- Missing README sections: List
