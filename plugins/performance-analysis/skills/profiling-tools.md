# Profiling Tools & Techniques Guide

Language-specific tools and approaches for validating performance findings.

## JavaScript / Node.js / TypeScript

### Built-in Tools

**Node.js Profiler**
```bash
# Generate CPU profile
node --prof app.js

# Process profile
node --prof-process isolate-*.log > profile.txt
```

**Chrome DevTools** (Minimum viable profiling guide)
1. Open DevTools → Performance tab
2. Record (click circle)
3. Run your code
4. Stop recording
5. Analyze flame graph (finds hot functions)

**Flamegraph analysis**
- Y-axis: Call stack depth
- X-axis: Time spent
- Tallest rectangles = most time spent

### Libraries

**clinic.js** - Node.js performance monitoring
```bash
npm install clinic
clinic doctor -- node app.js
```
- Visualizes bottlenecks, garbage collection, event loop delay

**node-inspect-process** - Simple CPU sampling
```bash
npm install node-inspect-process
node-inspect-process --prof app.js
```

### Browser-based Profiling

**WebPerformance API**
```javascript
// Measure custom code
performance.mark('operation:start');
// your code
performance.mark('operation:end');
performance.measure('operation', 'operation:start', 'operation:end');

const metrics = performance.getEntriesByName('operation');
console.log(metrics[0].duration);
```

### Memory Profiling

**Heap Snapshot**
1. DevTools → Memory tab
2. Click "Take heap snapshot"
3. Analyze object counts and retained sizes
4. Look for unexpected large objects

**Growing Memory Investigation**
```javascript
// Track array growth
let items = [];
setInterval(() => {
  console.log('Array size:', items.length);
  console.log('Memory:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');
}, 5000);
```

---

## Python

### Built-in Tools

**cProfile** - CPU profiling
```bash
python -m cProfile -s cumulative script.py
```

Output columns:
- `ncalls`: Number of calls
- `cumtime`: Total time spent (including subcalls)
- `percall`: Per-call average
- `filename:lineno(function)`: Location

**timeit** - Micro-benchmarking
```python
import timeit
time = timeit.timeit('function()', setup='from module import function', number=1000)
print(f'Average: {time/1000} seconds')
```

### Libraries

**py-spy** - Sampling profiler (lower overhead)
```bash
pip install py-spy
py-spy record -o profile.svg -- python app.py
```

Generates flamegraph showing where time is spent.

**memory_profiler** - Line-by-line memory tracking
```bash
pip install memory_profiler

# Add to code
@profile
def my_function():
    pass

# Run
python -m memory_profiler script.py
```

**line_profiler** - Line-by-line timing
```bash
pip install line_profiler

# Add decorator
@profile
def function():
    pass

# Run
kernprof -l -v script.py
```

### Memory Debugging

**objgraph** - Object reference visualization
```python
import objgraph

objgraph.show_most_common_types(limit=10)
objgraph.show_growth()  # Call before and after to see new objects
```

---

## Java

### Built-in Tools

**Java Flight Recorder (JFR)** - Production-grade profiling
```bash
java -XX:StartFlightRecording=delay=20s,duration=60s,filename=recording.jfr MyApp
jmc # Java Mission Control GUI
```

**async-profiler** - Low overhead sampling profiler
```bash
./profiler.sh -d 30 -f myresults.html <pid>
```

### Tools

**JProfiler** - Commercial IDE integration
- CPU sampling
- Memory snapshots
- Thread analysis

**YourKit** - Commercial with low overhead
- Remote profiling
- Memory leaks detection
- Thread contention analysis

### Memory Analysis

**Heap Dump**
```bash
# Force heap dump
jmap -dump:live,format=b,file=heap.bin <pid>

# Analyze with MAT or JvisualVM
jvisualvm

# Find retained objects
# Open dump in Eclipse MAT (Memory Analyzer)
```

---

## C# / .NET

### Built-in Tools

**dotTrace** (JetBrains)
- Timeline profiling
- Memory profiling
- Concurrency profiling

**PerfView** (Microsoft)
```bash
perfview.exe /CollectingToFile
# Run your application
perfview.exe stop
```

Traces ETW events for deep system analysis.

### Performance Counters

**Monitor real-time metrics**
```csharp
var counter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
Console.WriteLine(counter.NextValue());
```

---

## Go

### Built-in Profiling

**pprof** - Go built-in profiler
```go
import _ "net/http/pprof"

// In main()
go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

**Access profiles**
```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
go tool pprof http://localhost:6060/debug/pprof/heap
```

**Generate flamegraph**
```bash
go tool pprof -http=:8080 profile.out
```

---

## Rust

### Built-in Tools

**flamegraph** - Flamegraph generation
```bash
cargo flamegraph
```

**perf** - Linux performance analysis
```bash
perf record -F 99 ./target/release/app
perf report
```

---

## General Profiling Workflow

1. **Establish Baseline**
   - Measure current performance
   - Record metrics: latency, throughput, memory
   - Document test scenario

2. **Profile Suspected Areas**
   - Run profiler on specific operation
   - Identify top 3-5 hotspots
   - Note their contribution (% of total time)

3. **Drill Down**
   - Focus on highest impact operations
   - Look at call stacks
   - Understand why they're slow

4. **Optimize One Thing**
   - Change one thing
   - Re-profile to verify improvement
   - Measure in context (not micro-benchmark)

5. **Validate**
   - Ensure improvement (≥ 5-10% minimum)
   - Check for regressions
   - Update baseline

## Profiling Best Practices

**Representative Data**
- Use realistic data sizes
- Include edge cases
- Profile with expected load

**Warmup Period**
- JIT compilation affects timing
- Caches need warming
- Discard first few runs

**Isolate Variables**
- Run one optimization at a time
- Control external factors
- Minimize background processes

**Measure Consistently**
- Same hardware/conditions
- Multiple runs
- Use medians, not averages

**Document Results**
- Before/after metrics
- Test scenario
- Expected real-world impact
- Caveats and assumptions

## When to Profile

✅ **Do profile:**
- Before optimizing
- To validate improvement claims
- Real-world scenarios
- Before/after optimization
- Suspected bottlenecks

❌ **Don't profile:**
- Code that obviously isn't hot
- Non-critical paths
- Without hypothesis
- Constantly (only when needed)

