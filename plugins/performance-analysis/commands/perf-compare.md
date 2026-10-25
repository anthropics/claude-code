---
allowed-tools: Bash(git), Bash(diff)
description: Compare performance characteristics between different code versions or branches to detect regressions
argument-hint: Target branch name (e.g., main, develop) with optional --file flag for specific file
---

Compare performance characteristics between different branches or versions.

## Comparison Workflow

1. **Fetch Target Code**: Check out or fetch target branch code
2. **Analyze Current**: Profile current branch
3. **Analyze Target**: Profile target branch
4. **Delta Calculation**: Compare metrics
5. **Regression Detection**: Identify performance regressions
6. **Improvement Detection**: Highlight optimizations
7. **Report**: Generate comparison report

## Output Format

```
## Performance Comparison: [current-branch] vs [target-branch]

### Overall Delta
- Time Complexity: [unchanged/improved/regressed]
- Memory Usage: [unchanged/improved/regressed]
- Operation Count: [delta]

### Regressions
- [Function]: [complexity change with location]

### Improvements
- [Function]: [positive change]

### No Change
- [Function]: [complexity stayed same]

### Recommendation
[Priority for addressing regressions]
```
