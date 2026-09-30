# Performance Optimization Patterns & Anti-patterns

## Common Performance Patterns

### 1. Memoization / Caching
**Pattern**: Store results of expensive computations
- **Cost**: O(n) computation → O(1) or O(log n) lookup
- **When**: Repeated expensive computation with same inputs
- **Trade-off**: Memory usage vs. computation time

**Example**:
```javascript
const cache = new Map();
function fibonacci(n) {
  if (cache.has(n)) return cache.get(n);
  const result = n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);
  cache.set(n, result);
  return result;
}
```

### 2. Lazy Loading
**Pattern**: Defer expensive initialization until needed
- **Cost**: Spreads cost over time instead of upfront
- **When**: Large datasets, optional features, expensive setup
- **Trade-off**: Complexity vs. startup time

**Example**:
```python
class HeavyResource:
    def __init__(self):
        self._data = None
    
    @property
    def data(self):
        if self._data is None:
            self._data = expensive_initialization()
        return self._data
```

### 3. Batch Operations
**Pattern**: Process multiple items together instead of individually
- **Cost**: N operations → 1 operation (ideally)
- **When**: Multiple I/O operations, database queries, API calls
- **Trade-off**: Latency vs. throughput

**Example**:
```javascript
// Bad: N database calls
for (const id of ids) {
  await db.insert({id, data});
}

// Good: 1 database call
await db.insertBatch(ids.map(id => ({id, data})));
```

### 4. Connection Pooling
**Pattern**: Reuse expensive resources instead of creating/destroying
- **Cost**: Resource initialization → reuse
- **When**: Database connections, HTTP connections, thread pools
- **Trade-off**: Memory (pooled resources) vs. CPU (creation/destruction)

### 5. Pagination / Streaming
**Pattern**: Process large datasets incrementally instead of all at once
- **Cost**: O(n) memory → O(1) memory, spreads CPU over time
- **When**: Large result sets, streaming data, memory constrained
- **Trade-off**: Per-item latency vs. total throughput

**Example**:
```javascript
// Bad: Load all into memory
const allUsers = await db.getAllUsers();
for (const user of allUsers) {
  process(user);
}

// Good: Stream/paginate
for await (const user of db.streamUsers()) {
  process(user);
}
```

### 6. Early Exit / Short-Circuiting
**Pattern**: Stop processing when answer is known
- **Cost**: Full iteration → early exit
- **When**: Searching, validation, conditional logic
- **Trade-off**: Best case much better, average/worst case same

**Example**:
```python
# Bad: Check all items
def is_even(numbers):
    evens = 0
    for n in numbers:
        if n % 2 == 0:
            evens += 1
    return evens == len(numbers)

# Good: Short-circuit when found odd
def is_even(numbers):
    for n in numbers:
        if n % 2 != 0:
            return False
    return True
```

### 7. Parallelization
**Pattern**: Execute independent operations concurrently
- **Cost**: N sequential → ~N/threads parallel
- **When**: CPU-bound multi-core, I/O-bound waittime
- **Trade-off**: Complexity, memory, synchronization overhead

**Example**:
```javascript
// Sequential
const results = [];
for (const item of items) {
  results.push(await processSlowly(item));
}

// Parallel
const results = await Promise.all(
  items.map(item => processSlowly(item))
);
```

### 8. Algorithm Selection
**Pattern**: Use optimal algorithm for problem
- **Cost**: O(n²) → O(n log n) → O(n) depending on problem
- **When**: Different algorithms available for same problem
- **Trade-off**: Implementation complexity vs. runtime

**Examples**:
- Bubble sort → Quicksort: O(n²) → O(n log n)
- Linear search → Binary search: O(n) → O(log n)
- Naive recursion → Memoization: O(2^n) → O(n)

### 9. Data Structure Selection
**Pattern**: Use data structure optimized for access patterns
- **Cost**: Array O(n) lookup → Hash O(1) lookup
- **When**: Different operations needed, different frequencies
- **Trade-off**: Memory, insertion/deletion cost vs. lookup cost

**Examples**:
- Array ↔ Set: Lookup time
- Array ↔ HashMap: Lookup time
- Array ↔ LinkedList: Insertion/deletion
- Tree ↔ Hash: Sorted iteration

### 10. Resource Limiting
**Pattern**: Bound resource consumption
- **Cost**: Unbounded growth → controlled consumption
- **When**: Long-running processes, caches, pools
- **Trade-off**: Service quality vs. stability

**Example**:
```javascript
// Bad: Unbounded cache
const cache = {};

// Good: Bounded with LRU eviction
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // Move to end
    return value;
  }
  
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }
}
```

## Common Anti-Patterns

### ❌ N+1 Query Problem
```javascript
// Bad: N+1 queries
for (const user of users) {
  const posts = await db.query(`SELECT * FROM posts WHERE userId = ${user.id}`);
  user.posts = posts;
}

// Good: 1 query
const posts = await db.query(`SELECT * FROM posts WHERE userId IN (${userIds.join(',')})`);
```

### ❌ Unnecessary Copying
```python
# Bad: Copy large data
data = load_large_dataset()
copy = data.copy() # Unnecessary
process(copy)

# Good: Use reference
data = load_large_dataset()
process(data)
```

### ❌ String Concatenation in Loop
```javascript
// Bad: O(n²) due to string immutability
let result = '';
for (const item of items) {
  result += item;
}

// Good: O(n)
const result = items.join('');
```

### ❌ Creating Large Objects in Loop
```python
# Bad: Create large objects repeatedly
for i in range(10000):
    big_list = [0] * 10000
    process(big_list)

# Good: Reuse objects
big_list = [0] * 10000
for i in range(10000):
    big_list.clear()
    process(big_list)
```

### ❌ Premature Database Fetches
```javascript
// Bad: Fetch all to filter
const allUsers = await db.getAll('users');
const active = allUsers.filter(u => u.active);

// Good: Filter in query
const active = await db.query('SELECT * FROM users WHERE active = true');
```

### ❌ Missing Index
```sql
-- Bad: Full table scan
SELECT * FROM users WHERE email = 'user@example.com';

-- Good: With index
CREATE INDEX idx_email ON users(email);
SELECT * FROM users WHERE email = 'user@example.com';
```

### ❌ Blocking Operations in Async Code
```javascript
// Bad: Blocks event loop
app.get('/data', async (req, res) => {
  const result = heavySync(); // Blocks!
  res.json(result);
});

// Good: Use worker or library
app.get('/data', async (req, res) => {
  const result = await heavyAsync();
  res.json(result);
});
```

### ❌ Unbounded Collections
```python
# Bad: Memory grows forever
cache = {}
def get_data(key):
    if key not in cache:
        cache[key] = expensive_operation(key)
    return cache[key]

# Good: Bounded cache
from functools import lru_cache
@lru_cache(maxsize=1000)
def get_data(key):
    return expensive_operation(key)
```

## Performance Pattern Checklist

When optimizing, consider:

- [ ] **Algorithm**: Is it the most efficient algorithm for this problem?
- [ ] **Data Structure**: Is data structured optimally for access patterns?
- [ ] **Caching**: Are results reused or recalculated?
- [ ] **Batching**: Are multiple operations combined?
- [ ] **Bounds**: Are resource limits enforced?
- [ ] **Lazy Loading**: Is setup deferred until needed?
- [ ] **Parallelization**: Are independent operations concurrent?
- [ ] **Early Exit**: Are unnecessary iterations avoided?
- [ ] **Copying**: Is data copied unnecessarily?
- [ ] **Blocking**: Are blocking operations in async context?

## Trade-off Matrix

| Pattern | Time Impact | Memory Impact | Complexity | Best For |
|---------|------------|---------------|-----------|----------|
| Caching | ✓✓✓ | ✗ | Low | Repeated expensive ops |
| Lazy Load | ✓ | ✓ | Low | Startup time, memory |
| Batching | ✓✓ | Neutral | Medium | I/O bound |
| Pooling | ✓✓ | ✗ | Medium | Resource creation |
| Pagination | ✓ | ✓✓ | Low | Large datasets |
| Parallelization | ✓✓ | ✗ | High | CPU/IO bound |
| Algorithm | ✓✓✓ | Varies | Varies | Hotspots |
| Data Structure | ✓✓ | Varies | Low | Specific operations |

