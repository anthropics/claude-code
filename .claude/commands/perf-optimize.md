---
description: Comprehensive performance analysis and optimization
argument-hint: "[path or scope to optimize]"
---

You are performing **comprehensive performance optimization** of the codebase. The goal is to identify and fix performance bottlenecks systematically.

## Performance Optimization Workflow

Target: $ARGUMENTS

If no specific path provided, analyze the entire codebase with focus on critical paths.

## Phase 1: Baseline Measurement

**Before optimizing, establish baseline metrics:**

Current state assessment: !`git status`

Document current performance:
```
Baseline Metrics (to be measured):
- Response times (p50, p95, p99)
- Throughput (requests per second)
- Memory usage
- Database query times
- Resource utilization
```

**Remember**: Never optimize without measuring first. Premature optimization is the root of all evil.

## Phase 2: Performance Expert Analysis

Launch the **performance-optimizer** agent for deep analysis:

**Task for performance-optimizer:**

Perform comprehensive performance analysis of: $ARGUMENTS

**Focus Areas:**

1. **Algorithmic Complexity**
   - Find nested loops
   - Check time complexity (O(n²) or worse)
   - Look for inefficient algorithms
   - Search for: loops, `.find(` in loops, `.sort(` repeatedly

2. **Database Performance**
   - Identify N+1 query problems
   - Check for missing indexes
   - Find queries without LIMIT
   - Look for SELECT *
   - Search for: queries in loops, database calls

3. **Memory Efficiency**
   - Find memory leaks
   - Check for large allocations
   - Look for unbounded caches
   - Search for: global arrays/objects, memory growth patterns

4. **I/O Operations**
   - Find synchronous I/O
   - Check for missing connection pooling
   - Look for repeated I/O operations
   - Search for: `readFileSync`, `*Sync`, I/O in loops

5. **Caching Opportunities**
   - Identify repeated expensive computations
   - Find cacheable data
   - Check existing cache usage
   - Search for: repeated API calls, repeated database queries

6. **Concurrency Issues**
   - Find sequential operations that could be parallel
   - Check for blocking operations
   - Look for await in loops
   - Search for: sequential async calls, missed parallelization

Provide detailed analysis with:
- **Location** (file:line)
- **Current complexity** and performance
- **Impact** (how much it matters)
- **Optimization approach** with code examples
- **Expected improvement** (estimated speedup)

## Phase 3: Profiling (if possible)

If profiling tools are available, run them:

```bash
# Node.js profiling
!`node --prof app.js` || echo "Run your application with profiling enabled"

# Python profiling
!`python -m cProfile -o profile.stats app.py` || echo "Profile Python application"

# Time critical operations
!`time [command]` || echo "Measure execution time"
```

## Phase 4: Prioritized Optimization

**Critical Optimizations (Do First):**
- Algorithmic improvements (100x+ speedup potential)
- N+1 query fixes (10-100x speedup)
- Missing database indexes (10-100x speedup)

**High Priority Optimizations:**
- Caching expensive operations
- Parallelizing independent operations
- Connection pooling

**Medium Priority Optimizations:**
- Code-level micro-optimizations
- Memory usage reductions

**Implement optimizations in priority order:**

1. For each critical optimization:
   - Implement the fix
   - Add comments explaining the optimization
   - Benchmark the improvement

2. Verify improvements:
   - Run before/after benchmarks
   - Measure actual speedup
   - Document results

## Phase 5: Database Optimization

If database performance issues found:

1. **Analyze slow queries:**
   ```sql
   !`EXPLAIN [slow_query]` || echo "Run EXPLAIN on slow queries"
   ```

2. **Add indexes:**
   ```sql
   -- Create indexes on frequently queried columns
   CREATE INDEX idx_[table]_[column] ON [table]([column]);
   ```

3. **Fix N+1 queries:**
   - Replace loops with queries with JOINs or IN clauses
   - Use eager loading instead of lazy loading
   - Implement batch loading

## Phase 6: Caching Implementation

For identified caching opportunities:

```javascript
// Example: Add caching layer
const cache = new Map()

async function getCachedData(key) {
  if (cache.has(key)) {
    return cache.get(key)
  }

  const data = await expensiveOperation(key)
  cache.set(key, data)
  return data
}

// With TTL and size limits
const LRU = require('lru-cache')
const cache = new LRU({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
})
```

## Phase 7: Parallel Execution

Convert sequential operations to parallel where safe:

```javascript
// Before (sequential - slow)
const user = await getUser(id)
const posts = await getPosts(id)
const comments = await getComments(id)

// After (parallel - fast)
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id)
])
```

## Phase 8: Benchmark Results

After optimizations, measure improvements:

```markdown
## Performance Optimization Results

### Metrics Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| p95 Response Time | 450ms | 80ms | 5.6x faster |
| Throughput | 100 req/s | 500 req/s | 5x increase |
| Memory Usage | 2GB | 800MB | 60% reduction |
| DB Query Time | 200ms | 15ms | 13.3x faster |

### Optimizations Implemented

1. **[Optimization 1]** - `path/to/file.js:123`
   - Changed: [What was changed]
   - Improvement: [X]x faster
   - Complexity: O(n²) → O(n)

2. **[Optimization 2]** - `path/to/file.js:456`
   - Changed: [What was changed]
   - Improvement: [X]x faster

### Code Changes Summary
- [Number] files modified
- [Number] algorithmic improvements
- [Number] database indexes added
- [Number] caching layers added

### Testing
- ✅ All existing tests pass
- ✅ Performance benchmarks improved
- ✅ No regressions detected

### Recommendations for Future

**Monitoring:**
- Set up performance monitoring (APM tools)
- Track response times over time
- Alert on performance degradation

**Load Testing:**
- Run load tests to verify improvements under stress
- Test with realistic data volumes
- Identify next bottlenecks

**Continuous Optimization:**
- Regular performance reviews (quarterly)
- Profile production systems
- Optimize based on real usage patterns
```

## Phase 9: Testing

Ensure optimizations don't break functionality:

1. **Run existing tests:**
   ```bash
   !`npm test` || !`pytest` || echo "Run your test suite"
   ```

2. **Verify functionality:**
   - Test critical user paths
   - Check edge cases
   - Ensure error handling still works

3. **Performance regression tests:**
   - Add benchmark tests
   - Set performance budgets
   - Fail CI if performance degrades

## Phase 10: Documentation

Document optimizations:

1. **Update code comments** - Explain non-obvious optimizations
2. **Update architecture docs** - Document caching strategy, indexing
3. **Add performance notes** - Document expected performance characteristics
4. **Update changelog** - Note performance improvements

---

## Performance Optimization Checklist

- [ ] Baseline metrics established
- [ ] Performance analysis completed
- [ ] Bottlenecks identified and prioritized
- [ ] Critical optimizations implemented
- [ ] Database queries optimized
- [ ] Caching implemented where beneficial
- [ ] Parallel execution where safe
- [ ] Benchmarks show improvement
- [ ] All tests pass
- [ ] Optimizations documented
- [ ] Performance monitoring set up

---

**Remember**:
- Measure first, optimize second
- Optimize the critical path (80/20 rule)
- Algorithm choice matters most
- Profile, don't guess
- Document trade-offs

⚡ Make it work, make it right, make it fast - in that order!
