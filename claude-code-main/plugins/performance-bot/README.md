# Performance Bot Plugin

Automatically flags performance issues during code review and suggests algorithmic optimizations.

## Overview

Performance Bot is your project's performance guardian, analyzing code changes for performance anti-patterns and automatically suggesting optimizations. It catches O(n²) algorithms, memory leaks, unnecessary re-renders, and other common performance issues before they make it to production.

## Features

- **Algorithmic Complexity Analysis**: Detects O(n²), O(2^n), and other problematic complexities
- **Memory Leak Detection**: Identifies potential memory leaks and dangling references
- **Inefficiency Patterns**: Spots common anti-patterns like N+1 queries, unnecessary serialization
- **Performance Estimation**: Estimates performance impact and suggests fixes
- **Framework-Specific**: Understands React, Vue, Angular, Node.js, Python, Go, etc.
- **Actionable Suggestions**: Provides code examples for optimization

## Command: `/performance-review`

Analyzes code changes for performance issues.

**Usage:**
```bash
/performance-review
```

## Detection Patterns

- Nested loops without early termination
- Unindexed database queries
- React re-render triggers (missing useCallback, memo)
- Inefficient sorting/searching
- Synchronous blocking operations
- Regular expression catastrophic backtracking
- Unnecessary copies of large objects
- Inefficient string concatenation
- Missing pagination or lazy loading

## Performance Categories

- **Algorithmic Complexity**: Time and space complexity analysis
- **Database Performance**: Query optimization and indexing
- **UI Performance**: Re-render optimization, layout thrashing
- **Memory Management**: Leak detection, unused variables
- **Network Performance**: Unnecessary requests, caching opportunities
