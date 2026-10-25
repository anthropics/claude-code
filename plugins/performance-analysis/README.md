# Performance Analysis Plugin

Comprehensive performance analysis and optimization toolkit for identifying bottlenecks, analyzing complexity, detecting memory issues, and recommending optimizations.

## Overview

The Performance Analysis Plugin provides a suite of specialized agents that work together to comprehensively analyze your codebase for performance issues. It identifies bottlenecks, calculates algorithmic complexity, detects memory inefficiencies, validates concurrent code, and recommends practical optimizations.

## Commands

### `/perf-analyze`

Performs comprehensive performance analysis on a file, directory, or pull request.

**What it does:**
1. Analyzes code structure and identifies entry points
2. Launches 5 parallel agents to independently audit:
   - **Bottleneck Detective**: Finds performance-critical sections
   - **Complexity Analyzer**: Calculates Big O complexity and hotspots
   - **Memory Profiler**: Detects memory inefficiencies and leaks
   - **Concurrency Validator**: Checks async/threading issues
   - **Optimization Recommender**: Suggests practical fixes
3. Scores findings by severity (critical, high, medium, low)
4. Outputs actionable recommendations with code examples

**Usage:**
```bash
/perf-analyze [file|directory|--pr]
```

**Options:**
- `[file]`: Analyze a specific file
- `[directory]`: Analyze all code in directory
- `--pr`: Analyze performance impact of current PR changes
- `--focus [bottleneck|memory|complexity|async|all]`: Focus on specific area (default: all)
- `--threshold [low|medium|high|critical]`: Filter results by severity (default: medium)

**Example workflows:**
```bash
# Analyze specific file
/perf-analyze src/utils/dataProcessor.ts

# Analyze PR changes with focus on memory issues
/perf-analyze --pr --focus memory

# Get only critical issues
/perf-analyze . --threshold critical

# Full directory analysis
/perf-analyze src/core
```

**Features:**
- Parallel multi-agent analysis for comprehensive coverage
- Language-aware complexity calculation (supports JS/TS, Python, Java, C#, etc.)
- Memory leak pattern detection
- Race condition and deadlock identification
- Severity-based filtering to reduce noise
- Practical optimization suggestions with examples

---

### `/perf-profile`

Creates a detailed performance profile of a specific file or function.

**What it does:**
1. Identifies all functions/methods in target
2. Analyzes time complexity for each operation
3. Identifies memory allocation patterns
4. Flags recursive or circular patterns
5. Generates optimization roadmap

**Usage:**
```bash
/perf-profile [file|function-name]
```

**Example:**
```bash
# Profile entire file
/perf-profile src/algorithms/sorting.ts

# Profile specific function
/perf-profile calculateDistribution
```

---

### `/perf-compare`

Compares performance characteristics between different code versions or branches.

**What it does:**
1. Analyzes current branch code
2. Analyzes target branch code
3. Identifies performance regressions
4. Highlights improvements
5. Calculates complexity delta

**Usage:**
```bash
/perf-compare [target-branch] [--file filename]
```

**Example:**
```bash
# Compare against main branch
/perf-compare main

# Compare specific file against develop
/perf-compare develop --file src/core/engine.ts
```

---

## Agents

### **Bottleneck Detective**
Identifies where your code spends the most time and resources.

**Detects:**
- Nested loops with high iteration counts
- Expensive operations in hot paths
- Blocking I/O in synchronous code
- N+1 query patterns (database)
- Missing caching opportunities

**Output:** High-impact bottlenecks with severity scoring

---

### **Complexity Analyzer**
Calculates and explains algorithmic complexity.

**Analyzes:**
- Time complexity (Big O notation)
- Space complexity
- Growth patterns in operations
- Optimal vs. current implementation
- Potential algorithm improvements

**Output:** Complexity report with suggested algorithm swaps

---

### **Memory Profiler**
Detects memory inefficiencies and potential leaks.

**Detects:**
- Object retention in caches/listeners
- Large object allocations
- Circular references
- Inefficient data structures
- Memory-heavy loops
- Event listener cleanup issues

**Output:** Memory issues with leak risk assessment

---

### **Concurrency Validator**
Validates async code and threading patterns.

**Detects:**
- Race conditions
- Deadlock potentials
- Missing locks/synchronization
- Unhandled promise rejections
- Resource contention
- Callback hell anti-patterns

**Output:** Concurrency issues with risk severity

---

### **Optimization Recommender**
Suggests practical, implementable optimizations.

**Recommends:**
- Algorithm improvements
- Caching strategies
- Data structure optimizations
- Parallelization opportunities
- Library/built-in function swaps
- Configuration tuning

**Output:** Prioritized optimization suggestions with code examples

---

## Skills

### Performance Patterns
Guide to common performance optimization patterns:
- Memoization & caching strategies
- Lazy loading & pagination
- Batch processing
- Connection pooling
- Resource pooling
- Circuit breaker patterns
- Early exits & short-circuiting

### Profiling Tools Guide
Language-specific profiling resources:
- **JavaScript/TypeScript**: Chrome DevTools, Node.js profiler, clinic.js
- **Python**: cProfile, py-spy, memory_profiler
- **Java**: JVM Profiler, Java Flight Recorder
- **C#/.NET**: dotTrace, PerfView

---

## Installation

The Performance Analysis Plugin is available through the Claude Code plugin system.

**Usage in your project:**

```bash
# Navigate to your project
cd your-project

# Run Claude Code
claude

# Use the performance analysis commands
/perf-analyze src/
/perf-profile dataProcessor.ts
/perf-compare main
```

Configure in `.claude/settings.json`:
```json
{
  "plugins": ["performance-analysis"],
  "performance-analysis": {
    "defaultFocus": "all",
    "defaultThreshold": "medium",
    "enableHistoricalTracking": true
  }
}
```

---

## Use Cases

### 1. **Performance Regression Detection**
Catch performance regressions before they reach production:
```bash
/perf-analyze --pr --threshold high
```

### 2. **Legacy Code Optimization**
Analyze and improve legacy codebase performance:
```bash
/perf-analyze src/legacy --focus bottleneck
```

### 3. **API Endpoint Optimization**
Optimize slow endpoints:
```bash
/perf-profile fetchUserData
```

### 4. **Database Query Performance**
Identify N+1 and inefficient queries:
```bash
/perf-analyze --pr --focus bottleneck
```

### 5. **Memory Leak Investigation**
Find and fix memory leaks:
```bash
/perf-analyze . --focus memory
```

### 6. **Concurrent Code Review**
Validate threading/async implementations:
```bash
/perf-analyze services/ --focus async
```

---

## Configuration

### Performance Thresholds

Configure sensitivity levels in settings:
- **Critical**: Issues affecting real-time responsiveness (<100ms)
- **High**: Performance issues (100ms-1s)
- **Medium**: Optimization opportunities (1s+)
- **Low**: Nice-to-have improvements

### Focus Areas

Customize which analyses run:
- `bottleneck`: Only detect bottlenecks
- `complexity`: Only analyze complexity
- `memory`: Only profile memory
- `async`: Only validate concurrency
- `all`: Full analysis (default)

---

## Integration with Other Plugins

Works seamlessly with:
- **[pr-review-toolkit](../pr-review-toolkit/)**: Performance review as part of PR analysis
- **[code-review](../code-review/)**: Performance as code quality metric
- **[feature-dev](../feature-dev/)**: Performance validation during feature development

---

## Tips & Best Practices

1. **Start with PR analysis**: Use `--pr` flag to catch regressions early
2. **Focus on hot paths**: Analyze frequently-called functions first
3. **Set appropriate thresholds**: Avoid analysis fatigue with right filtering
4. **Address critical issues first**: Prioritize by severity
5. **Validate with profiling**: Use suggested profiling tools to confirm findings
6. **Iterative optimization**: Re-run after changes to track improvements

---

## Limitations & Notes

- Analysis is static; use actual profiling tools for precise measurements
- Complex dynamic behavior may require manual validation
- Some optimizations require architectural changes
- Language-specific patterns recognized for: JS/TS, Python, Java, C#, Go, Rust

---

## Learn More

- [Performance Analysis Best Practices](https://en.wikipedia.org/wiki/Profiling_(computer_programming))
- [Big O Notation Guide](https://www.bigocheatsheet.com/)
- [Memory Profiling Guide](https://nodejs.org/en/docs/guides/nodejs-performance-observe/)
- [Concurrency Patterns](https://www.patterns.dev/posts/observer-pattern/)
