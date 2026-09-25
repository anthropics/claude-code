# Architecture Enforcer Plugin

Prevents architectural violations by validating code changes against your project's architecture rules before they're committed.

## Overview

Architecture Enforcer acts as your project's architectural guardian, automatically detecting when developers write code that violates your project's established patterns, layer boundaries, and design rules. It blocks problematic code before it gets committed.

## Features

- **Real-time Architecture Validation**: Checks every code change against architecture rules
- **Layer Enforcement**: Ensures proper separation between API, service, domain, and data layers
- **Pattern Detection**: Enforces project-specific patterns and conventions
- **Custom Rules**: Define domain-specific rules in simple YAML
- **Helpful Guidance**: Suggests correct patterns instead of just saying "no"
- **Pre-commit Integration**: Works as git hook for immediate feedback

## Command: `/architecture-validate`

Validates code changes against your project architecture.

**Usage:**
```bash
/architecture-validate
```

Scans staged changes and detects violations before commit.

## Architecture Rules

Define rules in `.claude/architecture-rules.json`:

```json
{
  "layers": {
    "api": { "canImport": ["service", "domain", "shared"] },
    "service": { "canImport": ["domain", "data", "shared"] },
    "domain": { "canImport": ["shared"] },
    "data": { "canImport": ["shared"] }
  },
  "patterns": {
    "react-components": {
      "location": "src/components/**/*.tsx",
      "requires": ["hooks", "styling"],
      "forbids": ["direct-api-calls"]
    }
  },
  "denyRules": [
    "data layer imports api layer",
    "circular dependencies",
    "domain logic in components"
  ]
}
```

## Supported Validations

- Layer boundary violations
- Circular dependency detection
- Naming convention enforcement
- Directory structure validation
- Forbidden import patterns
- Code organization rules
