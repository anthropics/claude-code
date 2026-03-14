---
description: Create detailed performance profile of a specific file or function with complexity and memory analysis
argument-hint: File path or function name to profile
---

Create a comprehensive performance profile including complexity analysis, memory patterns, and optimization roadmap.

## Profile Workflow

1. **Target Identification**: Determine if analyzing file or specific function
2. **Function Enumeration**: List all functions/methods in target
3. **Complexity Analysis**: Calculate Big O for each function
4. **Memory Analysis**: Identify memory allocation patterns
5. **Call Graph**: Trace function call relationships
6. **Hotspot Identification**: Find frequently called/expensive functions
7. **Optimization Roadmap**: Prioritized list of improvements

## Output Format

```
## Performance Profile: [target]

### Function List
- functionName() - [complexity] - [memory estimate]

### Call Graph
[Visual representation of function calls]

### Hotspots (by estimated cost)
1. [Function] - [reason for impact]

### Memory Patterns
- [Pattern 1]: [description]

### Optimization Roadmap
[Prioritized list with effort/impact estimates]
```
