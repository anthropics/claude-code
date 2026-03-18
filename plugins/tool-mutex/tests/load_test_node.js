#!/usr/bin/env node
/**
 * Node.js filesystem load test for tool-mutex.
 *
 * Claude Code uses Node.js fs APIs internally. The Windows Wof.sys BSOD
 * (issue #32870) is triggered by concurrent NtQueryDirectoryFileEx syscalls
 * originating from Node.js fs.readdir/fs.stat/fs.glob — NOT from Python.
 * This test reproduces the exact I/O pattern that causes the crash.
 *
 * Usage:
 *   # Default: 1024 workers, no mutex, scan /usr
 *   node tests/load_test_node.js
 *
 *   # Custom workers and target
 *   node tests/load_test_node.js --workers 512 --target /usr/share
 *
 *   # With delay between batches (simulates mutex cooldown)
 *   node tests/load_test_node.js --delay 75
 *
 *   # Compare: run with delay (mutex-like) vs without
 *   node tests/load_test_node.js --compare
 *
 * Environment:
 *   CLAUDE_TOOL_MUTEX_DISABLED=1  Ignored here (test always runs, flag is
 *                                  just context for why no mutex is active)
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_WORKERS = 1024;
const DEFAULT_TARGET = "/usr";
const DEFAULT_MAX_FILES = 50000; // cap per worker to avoid running forever

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    workers: DEFAULT_WORKERS,
    target: DEFAULT_TARGET,
    delay: 0,       // ms delay between batches (0 = no mutex simulation)
    compare: false,
    maxFiles: DEFAULT_MAX_FILES,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--workers": case "-w": opts.workers = parseInt(args[++i], 10); break;
      case "--target":  case "-t": opts.target  = args[++i]; break;
      case "--delay":   case "-d": opts.delay   = parseInt(args[++i], 10); break;
      case "--compare": case "-c": opts.compare = true; break;
      case "--max-files":          opts.maxFiles = parseInt(args[++i], 10); break;
      case "--help": case "-h":
        console.log(`Usage: node load_test_node.js [--workers N] [--target DIR] [--delay MS] [--compare]`);
        process.exit(0);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// System info
// ---------------------------------------------------------------------------

function printSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  console.log(`  Platform:   ${os.platform()} ${os.arch()} (${os.release()})`);
  console.log(`  CPU cores:  ${cpus.length} x ${cpus[0]?.model || "unknown"}`);
  console.log(`  Memory:     ${(freeMem / 1e9).toFixed(1)}GB free / ${(totalMem / 1e9).toFixed(1)}GB total`);
  console.log(`  Node.js:    ${process.version}`);
  console.log(`  PID:        ${process.pid}`);
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    freeMem: os.freemem(),
  };
}

// ---------------------------------------------------------------------------
// Filesystem operations (same patterns as Claude Code Glob/Grep/Read)
// ---------------------------------------------------------------------------

/**
 * Recursive readdir — the exact call that triggers NtQueryDirectoryFileEx
 * on Windows. Node.js 20+ supports { recursive: true }.
 */
async function opReaddir(target, maxFiles) {
  let count = 0;
  try {
    const entries = await fsp.readdir(target, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      count++;
      if (count >= maxFiles) break;
    }
  } catch {
    // fallback for older Node or permission errors: manual walk
    count = await walkDir(target, maxFiles);
  }
  return count;
}

async function walkDir(dir, maxFiles, count = { n: 0 }) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      count.n++;
      if (count.n >= maxFiles) return count.n;
      if (entry.isDirectory()) {
        await walkDir(path.join(dir, entry.name), maxFiles, count);
        if (count.n >= maxFiles) return count.n;
      }
    }
  } catch { /* permission denied etc */ }
  return count.n;
}

/**
 * Stat storm — stat every file we find, like the Read tool does.
 */
async function opStatStorm(target, maxFiles) {
  let count = 0;
  async function walk(dir) {
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const statPromises = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          statPromises.push(
            fsp.stat(fullPath).then(() => { count++; }).catch(() => {})
          );
          if (count >= maxFiles) return;
        } else if (entry.isDirectory()) {
          statPromises.push(walk(fullPath));
          if (count >= maxFiles) return;
        }
      }
      await Promise.all(statPromises);
    } catch { /* permission denied */ }
  }
  await walk(target);
  return count;
}

/**
 * Grep simulation — read first 4KB of each file looking for a pattern.
 */
async function opGrepSim(target, maxFiles) {
  let count = 0;
  async function walk(dir) {
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (count >= maxFiles) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          try {
            const fd = await fsp.open(fullPath, "r");
            const buf = Buffer.alloc(4096);
            await fd.read(buf, 0, 4096, 0);
            await fd.close();
            count++;
          } catch { /* skip */ }
        } else if (entry.isDirectory()) {
          await walk(fullPath);
        }
      }
    } catch { /* permission denied */ }
  }
  await walk(target);
  return count;
}

/**
 * Glob simulation using fs.glob (Node 22+) or manual pattern matching.
 */
async function opGlob(target, maxFiles) {
  let count = 0;

  // Node 22+ has fs.glob
  if (typeof fsp.glob === "function") {
    try {
      for await (const _ of fsp.glob(path.join(target, "**/*"))) {
        count++;
        if (count >= maxFiles) break;
      }
      return count;
    } catch { /* fallback */ }
  }

  // Fallback: manual recursive readdir with pattern matching
  try {
    const entries = await fsp.readdir(target, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      count++;
      if (count >= maxFiles) break;
    }
  } catch {
    count = await walkDir(target, maxFiles);
  }
  return count;
}

/**
 * Mixed — combines readdir + stat + read, maximum concurrent fs pressure.
 */
async function opMixed(target, maxFiles) {
  const [a, b, c] = await Promise.all([
    opReaddir(target, Math.floor(maxFiles / 3)),
    opStatStorm(target, Math.floor(maxFiles / 3)),
    opGrepSim(target, Math.floor(maxFiles / 3)),
  ]);
  return a + b + c;
}

const OPERATIONS = { readdir: opReaddir, stat: opStatStorm, grep: opGrepSim, glob: opGlob, mixed: opMixed };
const OP_NAMES = Object.keys(OPERATIONS);

// ---------------------------------------------------------------------------
// Worker thread entry point
// ---------------------------------------------------------------------------

if (!isMainThread) {
  const { workerId, operation, target, maxFiles } = workerData;
  const opFn = OPERATIONS[operation];
  const start = performance.now();

  opFn(target, maxFiles)
    .then((filesFound) => {
      parentPort.postMessage({
        workerId,
        operation,
        filesFound,
        durationMs: performance.now() - start,
        error: null,
        memRss: process.memoryUsage().rss,
      });
    })
    .catch((err) => {
      parentPort.postMessage({
        workerId,
        operation,
        filesFound: 0,
        durationMs: performance.now() - start,
        error: `${err.name}: ${err.message}`,
        memRss: process.memoryUsage().rss,
      });
    });
}

// ---------------------------------------------------------------------------
// Main thread: orchestrator
// ---------------------------------------------------------------------------

async function runLoadTest(label, workers, target, delay, maxFiles) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(` NODE.JS LOAD TEST: ${label}`);
  console.log(`${"=".repeat(70)}`);
  printSystemInfo();
  console.log(`  Workers:    ${workers}`);
  console.log(`  Target:     ${target}`);
  console.log(`  Delay:      ${delay}ms${delay === 0 ? " (no mutex)" : " (mutex simulation)"}`);
  console.log(`  Max files:  ${maxFiles.toLocaleString()} per worker`);
  console.log(`${"=".repeat(70)}`);

  const startMem = getMemoryUsage();
  const startTime = performance.now();
  const results = [];
  let completed = 0;
  let errors = 0;
  let crashDetected = false;
  let peakRss = startMem.rss;
  let peakWorkerRss = 0;

  // Memory monitoring interval
  let minFreeMem = startMem.freeMem;
  const memMonitor = setInterval(() => {
    const free = os.freemem();
    if (free < minFreeMem) minFreeMem = free;
    const rss = process.memoryUsage().rss;
    if (rss > peakRss) peakRss = rss;
  }, 250);

  // Launch workers in batches if delay > 0, otherwise all at once.
  // When delay > 0 (mutex simulation), only allow a small number of
  // concurrent workers — this mirrors the real semaphore where most
  // workers are queued waiting for a slot, not all running at once.
  const maxConcurrent = delay > 0 ? Math.min(4, workers) : workers;
  const workerPromises = [];

  for (let i = 0; i < workers; i += maxConcurrent) {
    const batch = [];
    const end = Math.min(i + maxConcurrent, workers);

    for (let w = i; w < end; w++) {
      const operation = OP_NAMES[w % OP_NAMES.length];
      batch.push(
        new Promise((resolve) => {
          try {
            const worker = new Worker(__filename, {
              workerData: { workerId: w, operation, target, maxFiles },
            });

            const timeout = setTimeout(() => {
              worker.terminate();
              resolve({
                workerId: w, operation, filesFound: 0,
                durationMs: 120000, error: "TIMEOUT (120s)", memRss: 0,
              });
            }, 120000);

            worker.on("message", (msg) => {
              clearTimeout(timeout);
              completed++;
              if (msg.memRss > peakWorkerRss) peakWorkerRss = msg.memRss;
              if (completed % 100 === 0 || completed === workers) {
                process.stdout.write(
                  `\r  Progress: ${completed}/${workers} (${((completed / workers) * 100).toFixed(0)}%) `
                );
              }
              resolve(msg);
            });

            worker.on("error", (err) => {
              clearTimeout(timeout);
              errors++;
              const errMsg = `${err.name}: ${err.message}`;
              if (/terminate|kill|crash|broken/i.test(errMsg)) crashDetected = true;
              resolve({
                workerId: w, operation, filesFound: 0,
                durationMs: 0, error: errMsg, memRss: 0,
              });
            });

            worker.on("exit", (code) => {
              clearTimeout(timeout);
              if (code !== 0 && code !== null) {
                crashDetected = true;
                resolve({
                  workerId: w, operation, filesFound: 0,
                  durationMs: 0, error: `Worker exited with code ${code}`, memRss: 0,
                });
              }
            });
          } catch (err) {
            crashDetected = true;
            resolve({
              workerId: w, operation: OP_NAMES[w % OP_NAMES.length], filesFound: 0,
              durationMs: 0, error: `Spawn failed: ${err.message}`, memRss: 0,
            });
          }
        })
      );
    }

    workerPromises.push(...batch);

    // With mutex: wait for current batch to finish + apply cooldown delay
    // before launching next batch (real semaphore queues workers serially)
    if (delay > 0 && i + maxConcurrent < workers) {
      await Promise.all(batch);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const allResults = await Promise.all(workerPromises);
  clearInterval(memMonitor);

  const totalDurationMs = performance.now() - startTime;
  const endMem = getMemoryUsage();

  // Aggregate
  const durations = allResults.filter((r) => !r.error).map((r) => r.durationMs);
  const totalFiles = allResults.reduce((sum, r) => sum + r.filesFound, 0);
  const errorList = allResults.filter((r) => r.error).map((r) => `Worker ${r.workerId} [${r.operation}]: ${r.error}`);

  const result = {
    label,
    workers,
    totalFiles,
    totalDurationMs,
    avgOpMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    maxOpMs: durations.length ? Math.max(...durations) : 0,
    minOpMs: durations.length ? Math.min(...durations) : 0,
    opsPerSecond: durations.length > 0 ? durations.length / (totalDurationMs / 1000) : 0,
    errors: errorList,
    crashDetected,
    peakRssMB: peakRss / 1e6,
    peakWorkerRssMB: peakWorkerRss / 1e6,
    minFreeMemMB: minFreeMem / 1e6,
    startFreeMemMB: startMem.freeMem / 1e6,
    endFreeMemMB: endMem.freeMem / 1e6,
    cpuCores: os.cpus().length,
  };

  printResults(result);
  return result;
}

function printResults(r) {
  console.log(`\n  --- Results: ${r.label} ---`);
  console.log(`  Total time:       ${r.totalDurationMs.toFixed(0)}ms (${(r.totalDurationMs / 1000).toFixed(1)}s)`);
  console.log(`  Ops completed:    ${r.workers - r.errors.length}/${r.workers}`);
  console.log(`  Files enumerated: ${r.totalFiles.toLocaleString()}`);
  console.log(`  Ops/second:       ${r.opsPerSecond.toFixed(1)}`);
  console.log(`  Avg op time:      ${r.avgOpMs.toFixed(0)}ms`);
  console.log(`  Min op time:      ${r.minOpMs.toFixed(0)}ms`);
  console.log(`  Max op time:      ${r.maxOpMs.toFixed(0)}ms`);
  console.log(`  CPU cores:        ${r.cpuCores}`);
  console.log(`  Peak RSS:         ${r.peakRssMB.toFixed(1)}MB (main), ${r.peakWorkerRssMB.toFixed(1)}MB (peak worker)`);
  console.log(`  Free memory:      ${r.startFreeMemMB.toFixed(0)}MB start -> ${r.minFreeMemMB.toFixed(0)}MB min -> ${r.endFreeMemMB.toFixed(0)}MB end`);

  if (r.errors.length > 0) {
    console.log(`  Errors:           ${r.errors.length}`);
    r.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
    if (r.errors.length > 10) console.log(`    ... and ${r.errors.length - 10} more`);
  }

  if (r.crashDetected) {
    console.log(`\n  *** CRASH DETECTED ***`);
    console.log(`  Parallel Node.js fs operations caused worker crashes.`);
    console.log(`  On Windows, this pattern triggers Wof.sys BSOD (issue #32870).`);
  }

  console.log();
}

async function runComparison(workers, target, maxFiles) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(` COMPARISON: no delay vs 75ms delay (mutex simulation)`);
  console.log(`${"=".repeat(70)}`);

  const r1 = await runLoadTest("NO MUTEX (all workers at once)", workers, target, 0, maxFiles);
  await new Promise((r) => setTimeout(r, 2000));
  const r2 = await runLoadTest("WITH MUTEX SIM (75ms delay between batches)", workers, target, 75, maxFiles);

  console.log(`\n${"=".repeat(70)}`);
  console.log(` COMPARISON SUMMARY`);
  console.log(`${"=".repeat(70)}`);
  const pad = (s, n) => String(s).padStart(n);
  console.log(`  ${"Metric".padEnd(25)} ${pad("No Mutex", 15)} ${pad("With Mutex", 15)}`);
  console.log(`  ${"-".repeat(25)} ${"-".repeat(15)} ${"-".repeat(15)}`);
  console.log(`  ${"Total time (ms)".padEnd(25)} ${pad(r1.totalDurationMs.toFixed(0), 15)} ${pad(r2.totalDurationMs.toFixed(0), 15)}`);
  console.log(`  ${"Ops/second".padEnd(25)} ${pad(r1.opsPerSecond.toFixed(1), 15)} ${pad(r2.opsPerSecond.toFixed(1), 15)}`);
  console.log(`  ${"Errors".padEnd(25)} ${pad(r1.errors.length, 15)} ${pad(r2.errors.length, 15)}`);
  console.log(`  ${"Peak RSS (MB)".padEnd(25)} ${pad(r1.peakRssMB.toFixed(1), 15)} ${pad(r2.peakRssMB.toFixed(1), 15)}`);
  console.log(`  ${"Min free mem (MB)".padEnd(25)} ${pad(r1.minFreeMemMB.toFixed(0), 15)} ${pad(r2.minFreeMemMB.toFixed(0), 15)}`);
  console.log(`  ${"Crashes".padEnd(25)} ${pad(r1.crashDetected ? "YES" : "no", 15)} ${pad(r2.crashDetected ? "YES" : "no", 15)}`);

  if (r1.crashDetected && !r2.crashDetected) {
    console.log(`\n  MUTEX PREVENTED THE CRASH!`);
  } else if (!r1.crashDetected) {
    console.log(`\n  No crash in either mode (Linux is more resilient than Windows Wof.sys).`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (isMainThread) {
  const opts = parseArgs();

  if (opts.compare) {
    runComparison(opts.workers, opts.target, opts.maxFiles).catch(console.error);
  } else {
    runLoadTest(
      opts.delay > 0 ? "WITH DELAY (mutex simulation)" : "NO MUTEX (full parallel)",
      opts.workers,
      opts.target,
      opts.delay,
      opts.maxFiles
    ).catch(console.error);
  }
}
