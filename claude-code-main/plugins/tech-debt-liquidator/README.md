# Tech Debt Liquidator Plugin

Intelligently identifies technical debt and automatically refactors code while maintaining 100% behavior.

## Overview

Tech Debt Liquidator identifies hidden technical debt patterns in your codebase and systematically eliminates them. It uses sophisticated code transformation techniques to refactor safely, ensuring every change is behavior-preserving.

## Features

- **Debt Pattern Detection**: Identifies common tech debt patterns
- **Priority Scoring**: Ranks debt by impact on velocity and maintenance
- **Atomic Refactorings**: Each refactor is behavior-preserving
- **Test Generation**: Adds tests to verify behavior preservation
- **Rollback Safe**: Creates git commits that are easily reverted
- **Gradual Migration**: Handles refactors across multiple commits
- **Metrics Tracking**: Measures improvement in code quality

## Command: `/tech-debt-audit`

Audits codebase for technical debt.

**Usage:**
```bash
/tech-debt-audit
```

## Debt Categories

- **Code Complexity**: Overly complex functions, deep nesting
- **Duplication**: Copy-pasted code, repeated patterns
- **Poor Naming**: Unclear variable/function names
- **Inconsistent Style**: Inconsistent patterns across codebase
- **Poor Architecture**: Violated design patterns, layer violations
- **Deprecated APIs**: Use of old/deprecated functions
- **Missing Tests**: Untested code paths
- **Documentation Debt**: Missing or outdated documentation

## Safety Measures

- Every refactor preserves 100% of behavior
- Tests run before committing
- Behavior-equivalence verification
- Easy rollback via git
- Progress checkpoints every 5 refactors
