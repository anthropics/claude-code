# Standard Plugin Example

A well-structured plugin with commands, agents, and skills.

## Directory Structure

```
code-quality/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── lint.md
│   ├── test.md
│   └── review.md
├── agents/
│   ├── code-reviewer.md
│   └── test-generator.md
├── skills/
│   ├── code-standards/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── style-guide.md
│   └── testing-patterns/
│       ├── SKILL.md
│       └── examples/
│           ├── unit-test.js
│           └── integration-test.js
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       └── validate-commit.sh
└── scripts/
    ├── run-linter.sh
    └── generate-report.py
```

## File Contents

### .claude-plugin/plugin.json

```json
{
  "name": "code-quality",
  "version": "1.0.0",
  "description": "Comprehensive code quality tools including linting, testing, and review automation",
  "author": {
    "name": "Quality Team",
    "email": "quality@example.com"
  },
  "homepage": "https://docs.example.com/plugins/code-quality",
  "repository": "https://github.com/example/code-quality-plugin",
  "license": "MIT",
  "keywords": ["code-quality", "linting", "testing", "code-review", "automation"]
}
```

### commands/lint.md

```markdown
---
name: lint
description: Run linting checks on the codebase
---

# Lint Command

Run comprehensive linting checks on the project codebase.

## Process

1. Detect project type and installed linters
2. Run appropriate linters (ESLint, Pylint, RuboCop, etc.)
3. Collect and format results
4. Report issues with file locations and severity

## Implementation

Execute the linting script:

\`\`\`bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-linter.sh
\`\`\`

Parse the output and present issues organized by:
- Critical issues (must fix)
- Warnings (should fix)
- Style suggestions (optional)

For each issue, show:
- File path and line number
- Issue description
- Suggested fix (if available)
```

### commands/test.md

```markdown
---
name: test
description: Run test suite with coverage reporting
---

# Test Command

Execute the project test suite and generate coverage reports.

## Process

1. Identify test framework (Jest, pytest, RSpec, etc.)
2. Run all tests
3. Generate coverage report
4. Identify untested code

## Output

Present results in structured format:
- Test summary (passed/failed/skipped)
- Coverage percentage by file
- Critical untested areas
- Failed test details

## Integration

After test completion, offer to:
- Fix failing tests
- Generate tests for untested code (using test-generator agent)
- Update documentation based on test changes
```

### agents/code-reviewer.md

```markdown
---
description: Expert code reviewer specializing in identifying bugs, security issues, and improvement opportunities
capabilities:
  - Analyze code for potential bugs and logic errors
  - Identify security vulnerabilities
  - Suggest performance improvements
  - Ensure code follows project standards
  - Review test coverage adequacy
---

# Code Reviewer Agent

Specialized agent for comprehensive code review.

## Expertise

- **Bug detection**: Logic errors, edge cases, error handling
- **Security analysis**: Injection vulnerabilities, authentication issues, data exposure
- **Performance**: Algorithm efficiency, resource usage, optimization opportunities
- **Standards compliance**: Style guide adherence, naming conventions, documentation
- **Test coverage**: Adequacy of test cases, missing scenarios

## Review Process

1. **Initial scan**: Quick pass for obvious issues
2. **Deep analysis**: Line-by-line review of changed code
3. **Context evaluation**: Check impact on related code
4. **Best practices**: Compare against project and language standards
5. **Recommendations**: Prioritized list of improvements

## Integration with Skills

Automatically loads `code-standards` skill for project-specific guidelines.

## Output Format

For each file reviewed:
- Overall assessment
- Critical issues (must fix before merge)
- Important issues (should fix)
- Suggestions (nice to have)
- Positive feedback (what was done well)
```

### agents/test-generator.md

```markdown
---
description: Generates comprehensive test suites from code analysis
capabilities:
  - Analyze code structure and logic flow
  - Generate unit tests for functions and methods
  - Create integration tests for modules
  - Design edge case and error condition tests
  - Suggest test fixtures and mocks
---

# Test Generator Agent

Specialized agent for generating comprehensive test suites.

## Expertise

- **Unit testing**: Individual function/method tests
- **Integration testing**: Module interaction tests
- **Edge cases**: Boundary conditions, error paths
- **Test organization**: Proper test structure and naming
- **Mocking**: Appropriate use of mocks and stubs

## Generation Process

1. **Code analysis**: Understand function purpose and logic
2. **Path identification**: Map all execution paths
3. **Input design**: Create test inputs covering all paths
4. **Assertion design**: Define expected outputs
5. **Test generation**: Write tests in project's framework

## Integration with Skills

Automatically loads `testing-patterns` skill for project-specific test conventions.

## Test Quality

Generated tests include:
- Happy path scenarios
- Edge cases and boundary conditions
- Error handling verification
- Mock data for external dependencies
- Clear test descriptions
```

### skills/code-standards/SKILL.md

```markdown
---
name: Code Standards
description: This skill should be used when reviewing code, enforcing style guidelines, checking naming conventions, or ensuring code quality standards. Provides project-specific coding standards and best practices.
version: 1.0.0
---

# Code Standards

Comprehensive coding standards and best practices for maintaining code quality.

## Overview

Enforce consistent code quality through standardized conventions for:
- Code style and formatting
- Naming conventions
- Documentation requirements
- Error handling patterns
- Security practices

## Style Guidelines

### Formatting

- **Indentation**: 2 spaces (JavaScript/TypeScript), 4 spaces (Python)
- **Line length**: Maximum 100 characters
- **Braces**: Same line for opening brace (K&R style)
- **Whitespace**: Space after commas, around operators

### Naming Conventions

- **Variables**: camelCase for JavaScript, snake_case for Python
- **Functions**: camelCase, descriptive verb-noun pairs
- **Classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case for modules

## Documentation Requirements

### Function Documentation

Every function must include:
- Purpose description
- Parameter descriptions with types
- Return value description with type
- Example usage (for public functions)

### Module Documentation

Every module must include:
- Module purpose
- Public API overview
- Usage examples
- Dependencies

## Error Handling

### Required Practices

- Never swallow errors silently
- Always log errors with context
- Use specific error types
- Provide actionable error messages
- Clean up resources in finally blocks

### Example Pattern

\`\`\`javascript
async function processData(data) {
  try {
    const result = await transform(data)
    return result
  } catch (error) {
    logger.error('Data processing failed', {
      data: sanitize(data),
      error: error.message,
      stack: error.stack
    })
    throw new DataProcessingError('Failed to process data', { cause: error })
  }
}
\`\`\`

## Security Practices

- Validate all external input
- Sanitize data before output
- Use parameterized queries
- Never log sensitive information
- Keep dependencies updated

## Detailed Guidelines

For comprehensive style guides by language, see:
- `references/style-guide.md`
```

### skills/code-standards/references/style-guide.md

```markdown
# Comprehensive Style Guide

Detailed style guidelines for all supported languages.

## JavaScript/TypeScript

### Variable Declarations

Use `const` by default, `let` when reassignment needed, never `var`:

\`\`\`javascript
// Good
const MAX_RETRIES = 3
let currentTry = 0

// Bad
var MAX_RETRIES = 3
\`\`\`

### Function Declarations

Use function expressions for consistency:

\`\`\`javascript
// Good
const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// Bad (inconsistent style)
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}
\`\`\`

### Async/Await

Prefer async/await over promise chains:

\`\`\`javascript
// Good
async function fetchUserData(userId) {
  const user = await db.getUser(userId)
  const orders = await db.getOrders(user.id)
  return { user, orders }
}

// Bad
function fetchUserData(userId) {
  return db.getUser(userId)
    .then(user => db.getOrders(user.id)
      .then(orders => ({ user, orders })))
}
\`\`\`

## Python

### Import Organization

Order imports: standard library, third-party, local:

\`\`\`python
# Good
import os
import sys

import numpy as np
import pandas as pd

from app.models import User
from app.utils import helper

# Bad - mixed order
from app.models import User
import numpy as np
import os
\`\`\`

### Type Hints

Use type hints for all function signatures:

\`\`\`python
# Good
def calculate_average(numbers: list[float]) -> float:
    return sum(numbers) / len(numbers)

# Bad
def calculate_average(numbers):
    return sum(numbers) / len(numbers)
\`\`\`

## Additional Languages

See language-specific guides for:
- Go: `references/go-style.md`
- Rust: `references/rust-style.md`
- Ruby: `references/ruby-style.md`
```

### hooks/hooks.json

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Before modifying code, verify it meets our coding standards from the code-standards skill. Check formatting, naming conventions, and documentation. If standards aren't met, suggest improvements.",
          "timeout": 30
        }
      ]
    }
  ],
  "Stop": [
    {
      "matcher": ".*",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/validate-commit.sh",
          "timeout": 45
        }
      ]
    }
  ]
}
```

### hooks/scripts/validate-commit.sh

```bash
#!/bin/bash
# Validate code quality before task completion

set -e

# Check if there are any uncommitted changes
if [[ -z $(git status -s) ]]; then
  echo '{"systemMessage": "No changes to validate. Task complete."}'
  exit 0
fi

# Run linter on changed files
CHANGED_FILES=$(git diff --name-only --cached | grep -E '\.(js|ts|py)$' || true)

if [[ -z "$CHANGED_FILES" ]]; then
  echo '{"systemMessage": "No code files changed. Validation passed."}'
  exit 0
fi

# Run appropriate linters
ISSUES=0

for file in $CHANGED_FILES; do
  case "$file" in
    *.js|*.ts)
      if ! npx eslint "$file" --quiet; then
        ISSUES=$((ISSUES + 1))
      fi
      ;;
    *.py)
      if ! python -m pylint "$file" --errors-only; then
        ISSUES=$((ISSUES + 1))
      fi
      ;;
  esac
done

if [[ $ISSUES -gt 0 ]]; then
  echo "{\"systemMessage\": \"Found $ISSUES code quality issues. Please fix before completing.\"}"
  exit 1
fi

echo '{"systemMessage": "Code quality checks passed. Ready to commit."}'
exit 0
```

## Usage Examples

### Running Commands

```
$ claude
> /lint
Running linter checks...

Critical Issues (2):
  src/api/users.js:45 - SQL injection vulnerability
  src/utils/helpers.js:12 - Unhandled promise rejection

Warnings (5):
  src/components/Button.tsx:23 - Missing PropTypes
  ...

Style Suggestions (8):
  src/index.js:1 - Use const instead of let
  ...

> /test
Running test suite...

Test Results:
  ✓ 245 passed
  ✗ 3 failed
  ○ 2 skipped

Coverage: 87.3%

Untested Files:
  src/utils/cache.js - 0% coverage
  src/api/webhooks.js - 23% coverage

Failed Tests:
  1. User API › GET /users › should handle pagination
     Expected 200, received 500
  ...
```

### Using Agents

```
> Review the changes in src/api/users.js

[code-reviewer agent selected automatically]

Code Review: src/api/users.js

Critical Issues:
  1. Line 45: SQL injection vulnerability
     - Using string concatenation for SQL query
     - Replace with parameterized query
     - Priority: CRITICAL

  2. Line 67: Missing error handling
     - Database query without try/catch
     - Could crash server on DB error
     - Priority: HIGH

Suggestions:
  1. Line 23: Consider caching user data
     - Frequent DB queries for same users
     - Add Redis caching layer
     - Priority: MEDIUM
```

## Key Points

1. **Complete manifest**: All recommended metadata fields
2. **Multiple components**: Commands, agents, skills, hooks
3. **Rich skills**: References and examples for detailed information
4. **Automation**: Hooks enforce standards automatically
5. **Integration**: Components work together cohesively

## When to Use This Pattern

- Production plugins for distribution
- Team collaboration tools
- Plugins requiring consistency enforcement
- Complex workflows with multiple entry points
