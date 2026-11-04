#!/usr/bin/env python3
"""Load test for tool-mutex: parallel filesystem enumeration stress test.

Simulates concurrent Claude Code tool calls (Glob, Grep, Read) hammering
the filesystem to reproduce the parallel directory enumeration pattern that
triggers Windows Wof.sys BSOD (issue #32870). On Linux containers, this
can surface OOM kills, inode exhaustion, or process crashes.

Usage:
    # Default: 16 parallel workers, no mutex
    python3 tests/load_test.py

    # With mutex enabled (uses tool-mutex semaphore)
    python3 tests/load_test.py --mutex

    # Custom parallelism and iterations
    python3 tests/load_test.py --workers 32 --iterations 50 --target /usr

    # Full stress test: high parallelism, deep scanning, no mutex
    python3 tests/load_test.py --workers 64 --iterations 100 --target / --depth 10

    # Compare: run with and without mutex
    python3 tests/load_test.py --compare --workers 32

Environment:
    CLAUDE_TOOL_MUTEX_MAX_CONCURRENT  - Max concurrent ops when --mutex (default: 1)
    CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS - Cooldown delay in ms (default: 75)
"""

import argparse
import glob
import multiprocessing
import os
import platform
import resource
import signal
import subprocess
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

# Add plugin root for mutex imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, PLUGIN_ROOT)


@dataclass
class WorkerResult:
    """Result from a single worker execution."""
    worker_id: int
    operation: str
    files_found: int
    duration_ms: float
    error: Optional[str] = None
    peak_rss_kb: int = 0


@dataclass
class LoadTestResult:
    """Aggregate results from a load test run."""
    label: str
    workers: int
    iterations: int
    total_ops: int
    total_files_enumerated: int
    total_duration_ms: float
    avg_op_duration_ms: float
    max_op_duration_ms: float
    min_op_duration_ms: float
    errors: List[str] = field(default_factory=list)
    peak_rss_mb: float = 0.0
    ops_per_second: float = 0.0
    crash_detected: bool = False


# ---------------------------------------------------------------------------
# Filesystem stress operations - these simulate what Glob/Grep/Read do
# ---------------------------------------------------------------------------

def op_glob_recursive(target: str, depth: int) -> int:
    """Simulate Glob tool: recursive pattern matching."""
    count = 0
    for pattern in ["**/*", "**/*.py", "**/*.js", "**/*.so", "**/*.h"]:
        try:
            for _ in glob.iglob(os.path.join(target, pattern), recursive=True):
                count += 1
                if count > 50000:
                    return count
        except (PermissionError, OSError):
            pass
    return count


def op_scandir_recursive(target: str, depth: int) -> int:
    """Simulate deep directory enumeration via os.scandir (NtQueryDirectoryFileEx)."""
    count = 0
    dirs_to_visit = [target]
    current_depth = 0

    while dirs_to_visit and current_depth < depth:
        next_dirs = []
        for d in dirs_to_visit:
            try:
                with os.scandir(d) as entries:
                    for entry in entries:
                        count += 1
                        if entry.is_dir(follow_symlinks=False):
                            next_dirs.append(entry.path)
            except (PermissionError, OSError):
                pass
        dirs_to_visit = next_dirs
        current_depth += 1
        if count > 100000:
            break

    return count


def op_stat_storm(target: str, depth: int) -> int:
    """Simulate Read tool: stat many files rapidly."""
    count = 0
    for root, dirs, files in os.walk(target):
        for f in files:
            try:
                path = os.path.join(root, f)
                os.stat(path)
                count += 1
                if count > 50000:
                    return count
            except (PermissionError, OSError):
                pass
        # Limit depth
        if root.count(os.sep) - target.count(os.sep) >= depth:
            dirs.clear()
    return count


def op_grep_simulation(target: str, depth: int) -> int:
    """Simulate Grep tool: read file contents searching for patterns."""
    count = 0
    for root, dirs, files in os.walk(target):
        for f in files:
            try:
                path = os.path.join(root, f)
                # Only read small files (< 1MB) like ripgrep would
                if os.path.getsize(path) < 1_000_000:
                    with open(path, "rb") as fh:
                        data = fh.read(4096)
                        if b"import" in data or b"include" in data:
                            count += 1
            except (PermissionError, OSError, IOError):
                pass
            if count > 20000:
                return count
        if root.count(os.sep) - target.count(os.sep) >= depth:
            dirs.clear()
    return count


def op_mixed_enumeration(target: str, depth: int) -> int:
    """Mixed operation: combines scandir + stat + glob in rapid succession."""
    total = 0
    total += op_scandir_recursive(target, min(depth, 3))
    total += op_stat_storm(target, min(depth, 3))
    try:
        for _ in glob.iglob(os.path.join(target, "**/*.py"), recursive=True):
            total += 1
            if total > 80000:
                break
    except (PermissionError, OSError):
        pass
    return total


OPERATIONS = {
    "glob": op_glob_recursive,
    "scandir": op_scandir_recursive,
    "stat": op_stat_storm,
    "grep": op_grep_simulation,
    "mixed": op_mixed_enumeration,
}


# ---------------------------------------------------------------------------
# Worker function (runs in a subprocess)
# ---------------------------------------------------------------------------

def run_worker(args: Tuple[int, str, str, int, bool, int, str]) -> WorkerResult:
    """Execute a single filesystem stress operation.

    When mutex is enabled, acquires/releases a semaphore slot to simulate
    the PreToolUse/PostToolUse hooks gating the operation.
    """
    worker_id, operation, target, depth, use_mutex, iteration, session_id = args

    # Acquire mutex if enabled
    if use_mutex:
        try:
            from mutex.semaphore import acquire, release
            acquire(
                session_id=session_id,
                tool_use_id=f"loadtest_{worker_id}_{iteration}",
                tool_name=operation,
            )
        except Exception as e:
            return WorkerResult(
                worker_id=worker_id,
                operation=operation,
                files_found=0,
                duration_ms=0,
                error=f"Mutex acquire failed: {e}",
            )

    start = time.monotonic()
    error = None
    files_found = 0

    try:
        op_func = OPERATIONS[operation]
        files_found = op_func(target, depth)
    except Exception as e:
        error = f"{type(e).__name__}: {e}"

    duration_ms = (time.monotonic() - start) * 1000

    # Get peak RSS
    try:
        usage = resource.getrusage(resource.RUSAGE_SELF)
        peak_rss_kb = usage.ru_maxrss
    except Exception:
        peak_rss_kb = 0

    # Release mutex if enabled
    if use_mutex:
        try:
            release(
                session_id=session_id,
                tool_use_id=f"loadtest_{worker_id}_{iteration}",
            )
        except Exception:
            pass

    return WorkerResult(
        worker_id=worker_id,
        operation=operation,
        files_found=files_found,
        duration_ms=duration_ms,
        error=error,
        peak_rss_kb=peak_rss_kb,
    )


# ---------------------------------------------------------------------------
# Load test runner
# ---------------------------------------------------------------------------

def _get_system_info() -> dict:
    """Collect system info: CPU cores, free memory, total memory."""
    cpu_count = os.cpu_count() or 1
    try:
        with open("/proc/meminfo") as f:
            meminfo = {}
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    meminfo[parts[0].rstrip(":")] = int(parts[1])  # kB
            total_mem_mb = meminfo.get("MemTotal", 0) / 1024
            free_mem_mb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0)) / 1024
    except (FileNotFoundError, ValueError):
        import shutil
        total_mem_mb = shutil.disk_usage("/").total / (1024 * 1024)  # fallback
        free_mem_mb = 0
    return {
        "cpu_cores": cpu_count,
        "total_mem_mb": total_mem_mb,
        "free_mem_mb": free_mem_mb,
        "platform": platform.system(),
        "arch": platform.machine(),
    }


def _get_free_mem_mb() -> float:
    """Get current free memory in MB."""
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:") or line.startswith("MemFree:"):
                    return int(line.split()[1]) / 1024
    except (FileNotFoundError, ValueError):
        pass
    return 0.0


def run_load_test(
    label: str,
    workers: int,
    iterations: int,
    target: str,
    depth: int,
    use_mutex: bool,
    operations: List[str],
) -> LoadTestResult:
    """Run a complete load test with the given parameters."""

    session_id = f"loadtest-{os.getpid()}-{int(time.time())}"
    total_ops = workers * iterations
    all_results: List[WorkerResult] = []
    sysinfo = _get_system_info()

    print(f"\n{'='*70}")
    print(f" LOAD TEST: {label}")
    print(f"{'='*70}")
    print(f"  Platform:     {sysinfo['platform']} {sysinfo['arch']}")
    print(f"  CPU cores:    {sysinfo['cpu_cores']}")
    print(f"  Memory:       {sysinfo['free_mem_mb']:.0f}MB free / {sysinfo['total_mem_mb']:.0f}MB total")
    print(f"  Workers:      {workers}")
    print(f"  Iterations:   {iterations}")
    print(f"  Total ops:    {total_ops}")
    print(f"  Target:       {target}")
    print(f"  Depth:        {depth}")
    print(f"  Mutex:        {'ON' if use_mutex else 'OFF'}")
    print(f"  Operations:   {', '.join(operations)}")
    if use_mutex:
        from mutex.semaphore import _get_max_concurrent, _get_release_delay
        print(f"  Max conc:     {_get_max_concurrent()}")
        print(f"  Delay:        {_get_release_delay()*1000:.0f}ms")
    print(f"{'='*70}")

    # Build work items: each worker runs each operation for each iteration
    work_items = []
    for iteration in range(iterations):
        for worker_id in range(workers):
            op = operations[worker_id % len(operations)]
            work_items.append(
                (worker_id, op, target, depth, use_mutex, iteration, session_id)
            )

    start_time = time.monotonic()
    crash_detected = False
    completed = 0
    min_free_mem_mb = _get_free_mem_mb()
    start_free_mem_mb = min_free_mem_mb

    # Use ProcessPoolExecutor for true parallelism (separate PIDs doing syscalls)
    max_pool = min(workers, os.cpu_count() * 4 or 16)
    try:
        with ProcessPoolExecutor(max_workers=max_pool) as executor:
            futures = {executor.submit(run_worker, item): item for item in work_items}

            for future in as_completed(futures):
                try:
                    result = future.result(timeout=120)
                    all_results.append(result)
                    completed += 1

                    # Track memory pressure periodically
                    if completed % 10 == 0:
                        free = _get_free_mem_mb()
                        if free < min_free_mem_mb:
                            min_free_mem_mb = free

                    # Progress indicator
                    if completed % 10 == 0 or completed == total_ops:
                        pct = completed / total_ops * 100
                        free = _get_free_mem_mb()
                        sys.stdout.write(
                            f"\r  Progress: {completed}/{total_ops} ({pct:.0f}%) "
                            f"free_mem: {free:.0f}MB "
                        )
                        sys.stdout.flush()

                except multiprocessing.context.TimeoutError:
                    item = futures[future]
                    all_results.append(WorkerResult(
                        worker_id=item[0],
                        operation=item[1],
                        files_found=0,
                        duration_ms=120000,
                        error="TIMEOUT (120s) - possible hang/crash",
                    ))
                except Exception as e:
                    item = futures[future]
                    error_msg = f"{type(e).__name__}: {e}"
                    if "Broken" in str(e) or "terminated" in str(e).lower():
                        crash_detected = True
                        error_msg = f"CRASH: {error_msg}"
                    all_results.append(WorkerResult(
                        worker_id=item[0],
                        operation=item[1],
                        files_found=0,
                        duration_ms=0,
                        error=error_msg,
                    ))

    except BrokenProcessPool:
        crash_detected = True
        print("\n  *** PROCESS POOL CRASHED (BrokenProcessPool) ***")

    total_duration_ms = (time.monotonic() - start_time) * 1000

    # Compute stats
    durations = [r.duration_ms for r in all_results if r.error is None]
    errors = [f"Worker {r.worker_id} [{r.operation}]: {r.error}"
              for r in all_results if r.error]
    total_files = sum(r.files_found for r in all_results)

    # Peak RSS of this process
    try:
        peak_rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    except Exception:
        peak_rss_mb = 0

    end_free_mem_mb = _get_free_mem_mb()

    result = LoadTestResult(
        label=label,
        workers=workers,
        iterations=iterations,
        total_ops=total_ops,
        total_files_enumerated=total_files,
        total_duration_ms=total_duration_ms,
        avg_op_duration_ms=sum(durations) / len(durations) if durations else 0,
        max_op_duration_ms=max(durations) if durations else 0,
        min_op_duration_ms=min(durations) if durations else 0,
        errors=errors,
        peak_rss_mb=peak_rss_mb,
        ops_per_second=(len(durations) / (total_duration_ms / 1000))
        if total_duration_ms > 0 else 0,
        crash_detected=crash_detected,
    )
    # Attach memory tracking data for display
    result._mem_start = start_free_mem_mb
    result._mem_min = min_free_mem_mb
    result._mem_end = end_free_mem_mb
    result._cpu_cores = sysinfo["cpu_cores"]

    # Cleanup mutex session
    if use_mutex:
        try:
            from mutex.semaphore import cleanup_session
            cleanup_session(session_id)
        except Exception:
            pass

    print()
    _print_results(result)
    return result


def _print_results(r: LoadTestResult):
    """Print formatted load test results."""
    print(f"\n  --- Results: {r.label} ---")
    print(f"  Total time:       {r.total_duration_ms:.0f}ms ({r.total_duration_ms/1000:.1f}s)")
    print(f"  Ops completed:    {r.total_ops - len(r.errors)}/{r.total_ops}")
    print(f"  Files enumerated: {r.total_files_enumerated:,}")
    print(f"  Ops/second:       {r.ops_per_second:.1f}")
    print(f"  Avg op time:      {r.avg_op_duration_ms:.0f}ms")
    print(f"  Min op time:      {r.min_op_duration_ms:.0f}ms")
    print(f"  Max op time:      {r.max_op_duration_ms:.0f}ms")
    if hasattr(r, "_cpu_cores"):
        print(f"  CPU cores:        {r._cpu_cores}")
    print(f"  Peak RSS:         {r.peak_rss_mb:.1f}MB")
    if hasattr(r, "_mem_start"):
        print(f"  Free memory:      {r._mem_start:.0f}MB start -> {r._mem_min:.0f}MB min -> {r._mem_end:.0f}MB end")

    if r.errors:
        print(f"  Errors:           {len(r.errors)}")
        for err in r.errors[:10]:
            print(f"    - {err}")
        if len(r.errors) > 10:
            print(f"    ... and {len(r.errors)-10} more")

    if r.crash_detected:
        print(f"\n  *** CRASH DETECTED ***")
        print(f"  The parallel filesystem enumeration caused a process crash.")
        print(f"  On Windows, this pattern triggers Wof.sys BSOD (issue #32870).")

    print()


def run_comparison(workers: int, iterations: int, target: str, depth: int,
                   operations: List[str]):
    """Run back-to-back tests with and without mutex, then compare."""

    print("\n" + "=" * 70)
    print(" COMPARISON TEST: mutex OFF vs mutex ON")
    print("=" * 70)

    # Test without mutex
    result_no_mutex = run_load_test(
        label="NO MUTEX (unthrottled)",
        workers=workers,
        iterations=iterations,
        target=target,
        depth=depth,
        use_mutex=False,
        operations=operations,
    )

    # Brief pause between tests
    time.sleep(1)

    # Test with mutex
    result_mutex = run_load_test(
        label="WITH MUTEX (throttled)",
        workers=workers,
        iterations=iterations,
        target=target,
        depth=depth,
        use_mutex=True,
        operations=operations,
    )

    # Print comparison
    print("\n" + "=" * 70)
    print(" COMPARISON SUMMARY")
    print("=" * 70)
    print(f"  {'Metric':<25} {'No Mutex':>15} {'With Mutex':>15} {'Delta':>10}")
    print(f"  {'-'*25} {'-'*15} {'-'*15} {'-'*10}")

    def _row(label, v1, v2, fmt=".0f", unit=""):
        delta = v2 - v1
        sign = "+" if delta > 0 else ""
        print(f"  {label:<25} {v1:>14{fmt}}{unit} {v2:>14{fmt}}{unit} {sign}{delta:>8{fmt}}{unit}")

    _row("Total time (ms)", result_no_mutex.total_duration_ms, result_mutex.total_duration_ms)
    _row("Ops/second", result_no_mutex.ops_per_second, result_mutex.ops_per_second, ".1f")
    _row("Avg op time (ms)", result_no_mutex.avg_op_duration_ms, result_mutex.avg_op_duration_ms)
    _row("Max op time (ms)", result_no_mutex.max_op_duration_ms, result_mutex.max_op_duration_ms)
    _row("Errors", len(result_no_mutex.errors), len(result_mutex.errors))
    _row("Peak RSS (MB)", result_no_mutex.peak_rss_mb, result_mutex.peak_rss_mb, ".1f")

    if result_no_mutex.crash_detected and not result_mutex.crash_detected:
        print("\n  MUTEX PREVENTED THE CRASH!")
    elif result_no_mutex.crash_detected and result_mutex.crash_detected:
        print("\n  Both configurations crashed - try increasing mutex strictness.")
    elif not result_no_mutex.crash_detected:
        print(f"\n  No crash in either mode (container may be more resilient than Windows).")
        print(f"  On Windows with Wof.sys, the unthrottled run would trigger BSOD.")

    print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Load test: parallel filesystem enumeration stress test",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--workers", "-w", type=int, default=16,
        help="Number of parallel workers (default: 16)",
    )
    parser.add_argument(
        "--iterations", "-i", type=int, default=10,
        help="Iterations per worker (default: 10)",
    )
    parser.add_argument(
        "--target", "-t", type=str, default="/usr",
        help="Target directory to scan (default: /usr)",
    )
    parser.add_argument(
        "--depth", "-d", type=int, default=6,
        help="Max directory traversal depth (default: 6)",
    )
    parser.add_argument(
        "--mutex", "-m", action="store_true",
        help="Enable tool mutex (semaphore throttling)",
    )
    parser.add_argument(
        "--compare", "-c", action="store_true",
        help="Run comparison: no mutex vs with mutex",
    )
    parser.add_argument(
        "--operations", "-o", type=str, default="scandir,glob,stat,grep,mixed",
        help="Comma-separated operations to run (default: all)",
    )
    parser.add_argument(
        "--escalate", "-e", action="store_true",
        help="Escalating stress: start low, increase until failure or max",
    )

    args = parser.parse_args()
    operations = [op.strip() for op in args.operations.split(",")]

    for op in operations:
        if op not in OPERATIONS:
            parser.error(f"Unknown operation: {op}. Choose from: {list(OPERATIONS)}")

    if args.escalate:
        run_escalating(args.target, args.depth, operations)
    elif args.compare:
        run_comparison(args.workers, args.iterations, args.target, args.depth, operations)
    else:
        run_load_test(
            label=f"{'MUTEX' if args.mutex else 'NO MUTEX'} stress test",
            workers=args.workers,
            iterations=args.iterations,
            target=args.target,
            depth=args.depth,
            use_mutex=args.mutex,
            operations=operations,
        )


def run_escalating(target: str, depth: int, operations: List[str]):
    """Run escalating stress tests: double workers each round until crash or max."""
    print("\n" + "=" * 70)
    print(" ESCALATING STRESS TEST")
    print(" Doubling parallel workers each round until crash or limit")
    print("=" * 70)

    worker_counts = [2, 4, 8, 16, 32, 64, 128]
    results = []

    for w in worker_counts:
        result = run_load_test(
            label=f"Escalation: {w} workers",
            workers=w,
            iterations=5,
            target=target,
            depth=depth,
            use_mutex=False,
            operations=operations,
        )
        results.append(result)

        if result.crash_detected or len(result.errors) > w * 2:
            print(f"\n  Stopping escalation at {w} workers due to failures.")
            break

        time.sleep(0.5)

    # Summary
    print("\n" + "=" * 70)
    print(" ESCALATION SUMMARY")
    print("=" * 70)
    print(f"  {'Workers':>8} {'Ops/s':>10} {'Avg ms':>10} {'Max ms':>10} {'Errors':>8} {'Files':>12}")
    for r in results:
        err_flag = " ***" if r.crash_detected else ""
        print(f"  {r.workers:>8} {r.ops_per_second:>10.1f} {r.avg_op_duration_ms:>10.0f} "
              f"{r.max_op_duration_ms:>10.0f} {len(r.errors):>8} {r.total_files_enumerated:>12,}{err_flag}")
    print()


if __name__ == "__main__":
    main()
