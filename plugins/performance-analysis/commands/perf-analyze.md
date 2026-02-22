---
allowed-tools: Bash(*), Bash(find), Bash(grep), Bash(wc), Bash(head), mcp__github_inline_comment__create_inline_comment
description: Analyze code for performance issues and optimization opportunities
---

Perform comprehensive performance analysis on code to identify bottlenecks, complexity issues, memory problems, and optimization opportunities.

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error
- All code will be readable and parseable
- Only call a tool if required to complete the task
- Focus on actual performance issues, not style preferences

**CRITICAL SUCCESS FACTORS:**
1. HIGH SIGNAL ONLY - Only flag real performance issues, not speculative ones
2. ACTIONABLE FINDINGS - Every issue must come with concrete optimization suggestions
3. SEVERITY SCORING - Issues must be scored by actual performance impact, not just code quality
4. LANGUAGE AWARENESS - Understand language-specific performance patterns

## Analysis Workflow

### Step 1: Determine Scope
- If `--pr` flag: Analyze only changed files in current PR
- If file specified: Analyze single file
- If directory specified: Analyze all code files in directory (exclude tests, node_modules, dist, build)

### Step 2: Code Characterization
Launch a haiku agent to:
1. Identify programming language(s)
2. List all files to be analyzed
3. Estimate code size (lines, functions, classes)
4. Identify framework/runtime being used (if any)

### Step 3: Parallel Agent Analysis
Launch 5 agents in PARALLEL, each analyzing the target code:

**Agent 1: Bottleneck Detective (Sonnet)**
- Identify code sections that will execute frequently
- Find nested loops, recursion, expensive operations
- Detect N+1 query patterns (database/API calls in loops)
- Identify blocking I/O in sync context
- Flag missing caching opportunities
- Output format: List of bottleneck locations with estimated impact

**Agent 2: Complexity Analyzer (Sonnet)**
- Calculate time complexity (Big O) for all functions
- Calculate space complexity
- Identify algorithmic inefficiencies
- Suggest better algorithms where applicable
- Compare current vs. optimal complexity
- Output format: Function complexity report with alternatives

**Agent 3: Memory Profiler (Sonnet)**
- Find object retention issues (listeners, caches, closures)
- Identify circular reference risks
- Flag inefficient data structures
- Detect large collection allocations
- Identify memory-heavy loops
- Output format: Memory concern list with severity

**Agent 4: Concurrency Validator (Opus)**
- Identify race conditions in shared state
- Find deadlock/lock contention risks
- Check for proper synchronization
- Validate async/promise patterns
- Detect missing error handling in async code
- Output format: Concurrency issue list with risk level

**Agent 5: Optimization Recommender (Sonnet)**
- For each issue found by agents 1-4, suggest concrete optimizations
- Provide code examples where practical
- Estimate performance improvement (rough estimate)
- Prioritize recommendations by impact
- Output format: Optimization suggestions with code examples

### Step 4: Severity Calculation
For each finding, calculate severity based on:
- **CRITICAL**: Blocks real-time performance (<100ms requirement)
- **HIGH**: Significant impact (1-100ms per operation)
- **MEDIUM**: Notable impact (100ms-1s per operation)
- **LOW**: Minor impact (1s+ impact)

### Step 5: Filtering
Apply `--threshold` filter if specified:
- If `--threshold critical`: Show only CRITICAL severity
- If `--threshold high`: Show CRITICAL and HIGH
- If `--threshold medium`: Show CRITICAL, HIGH, and MEDIUM (default)
- If `--threshold low`: Show all findings

### Step 6: Output Generation
Create a comprehensive performance analysis report:

```
## Performance Analysis Report

### Summary
- Language: [language]
- Files analyzed: [count]
- Total lines: [count]
- Findings: [count by severity]

### CRITICAL Issues
- [Issue 1: description with code location]
  - Impact: [estimated performance impact]
  - Fix: [optimization suggestion]
  - Effort: [low/medium/high]

### HIGH Priority Issues
[same format]

### MEDIUM Priority Issues
[same format]

### Optimization Opportunities
- [Opportunity 1]: [description and suggestion]

### Performance Patterns Detected
- [Pattern 1]: [description and location]

### Recommended Focus Areas
1. [Top priority fix with reasoning]
2. [Next priority fix with reasoning]
```

### Step 7: PR Comment (if --pr && issues found)
If `--pr` flag was provided AND issues were found:
- Post findings as inline comments on affected lines
- Include code suggestions for fixable issues
- Use PR review for architectural issues

### Step 8: Profile Flag Handling
If `--profile [file|function]` flag:
- Deep dive into specific file/function
- Show detailed complexity breakdown
- Provide memory allocation timeline
- Suggest language-specific profiling tools

## False Positives to Avoid
- Do NOT flag code just because it's not "optimal" for all cases
- Do NOT suggest optimizations that reduce readability without significant perf gain
- Do NOT flag pre-mature optimization opportunities
- Do NOT flag issues that are framework/library responsibilities
- Do NOT flag code documentation or style as performance issues

## Important Notes

1. **Be Precise**: Include exact line numbers and code references
2. **Be Realistic**: Only flag issues with measurable performance impact
3. **Be Helpful**: Always provide concrete optimization suggestions
4. **Be Balanced**: Consider maintainability vs. performance trade-offs
5. **Be Honest**: Note when issue requires actual profiling to validate

## Output Example

If analyzing:
```typescript
for (let i = 0; i < users.length; i++) {
  const profile = await fetchUserProfile(users[i].id);
  results.push({ user: users[i], profile });
}
```

Flag as CRITICAL bottleneck:
- **Location**: Line X, function fetchAllProfiles
- **Issue**: N+1 query pattern - sequential API calls in loop
- **Impact**: O(n) API calls instead of O(1) bulk fetch
- **Fix**: Use batch API endpoint or Promise.all()
- **Code Example**:
  ```typescript
  const profiles = await fetchUserProfiles(users.map(u => u.id));
  ```

---

Create a todo list of analysis tasks before starting, then proceed systematically through each step.
