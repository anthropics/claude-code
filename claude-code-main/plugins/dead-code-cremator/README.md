# Dead Code Cremator Plugin

Automatically identifies and safely removes unused code from your codebase.

## Overview

Dead Code Cremator intelligently scans your codebase to identify truly unused functions, variables, classes, and modules. It then safely removes them or creates a PR for your review, keeping your codebase lean and maintainable.

## Features

- **Comprehensive Unused Detection**: Finds unused functions, classes, variables, types, and imports
- **Smart Analysis**: Distinguishes between truly unused and internal utilities
- **Safe Removal**: Handles cascading dependencies properly
- **Export-Aware**: Understands public APIs and doesn't remove public exports
- **Test Analysis**: Skips code that's used only in tests (actually important)
- **Dynamic Call Detection**: Handles computed property access and reflection
- **Multi-language**: Supports JavaScript, TypeScript, Python, Go, Java, C#

## Command: `/dead-code-scan`

Scans codebase for unused code.

**Usage:**
```bash
/dead-code-scan
```

## Removal Levels

- **Aggressive**: Remove everything unused (dangerous for libraries)
- **Balanced**: Remove obvious dead code, keep potential utilities
- **Conservative**: Only remove imports of clearly unused packages
- **Dry-run**: Show what would be removed, don't actually remove

## Smart Detection

- Entry point analysis (skip code reachable from main/start.ts)
- Export analysis (keep public APIs)
- Dynamic call analysis (understand Reflection/destructuring patterns)
- Test file awareness (keep test utilities)
- Configuration-based preservation (customize what to keep)

## Safety Features

- Creates PR instead of direct commits
- Shows before/after metrics
- Includes rollback instructions
- Generates detailed removal rationale
