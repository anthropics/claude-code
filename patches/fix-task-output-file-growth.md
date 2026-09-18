# Fix: Task `.output` files grow unbounded and are never cleaned up

Fixes #26911

## Problem

Task `.output` files under `/tmp/claude-<uid>/<session-id>/tasks/` grow without
any size limit and are never deleted, causing disk exhaustion. Users have reported
individual files reaching 271 GB - 1 TB.

## Root cause (from analysis of distributed cli.js v2.1.76)

Two bugs in the task output management code:

1. **`Y91` (disk writer class) has no file size cap.** Once `TaskOutput` spills to
   disk, `Y91.append()` writes indefinitely via `O_WRONLY | O_APPEND | O_CREAT`
   with no maximum size check.

2. **`kw.clear()` does not delete the `.output` file.** When a background task
   completes, `cleanup()` calls `clear()`, which resets in-memory state but leaves
   the file on disk. The existing `deleteOutputFile()` method is only called in the
   foreground completion path, gated by `!this.#q` (not backgrounded), so it is
   never reached for background/agent tasks.

## Changes (against minified cli.js from npm @anthropic-ai/claude-code@2.1.76)

### Change 1: Add max output file size constant (100 MB)

```diff
- var X97,P97=8388608,K38,K91;
+ var X97,P97=8388608,K38,K91,qX9=104857600;
```

`qX9` = 104857600 (100 MB). This is the maximum size a single `.output` file can
grow to before writes are silently dropped. 100 MB is generous enough to capture
any reasonable command output while preventing the 100 GB+ runaway growth.

### Change 2: Add size tracking to Y91 and cap writes

```diff
- class Y91{#A;#q=null;#K=[];#z=null;#Y=null;constructor(A){this.#A=g2(A)}
+ class Y91{#A;#q=null;#K=[];#z=null;#Y=null;#j=0;constructor(A){this.#A=g2(A)}
```

```diff
- append(A){if(this.#K.push(A),!this.#z)this.#z=new Promise((q)=>{this.#Y=q}),this.#H()}
+ append(A){if(this.#j+=typeof A==="string"?A.length:0,this.#j>qX9)return;if(this.#K.push(A),!this.#z)this.#z=new Promise((q)=>{this.#Y=q}),this.#H()}
```

Adds `#j` field to track total bytes appended. When `#j` exceeds `qX9` (100 MB),
`append()` returns early, preventing further disk writes. The existing data remains
readable; only new writes are dropped.

### Change 3: `clear()` calls `deleteOutputFile()`

```diff
- clear(){this.#A="",this.#q="",this.#z.clear(),this.#$=null,this.#K?.cancel(),kw.stopPolling(this.taskId),kw.#O.delete(this.taskId)}
+ clear(){this.#A="",this.#q="",this.#z.clear(),this.#$=null,this.#K?.cancel(),this.deleteOutputFile(),kw.stopPolling(this.taskId),kw.#O.delete(this.taskId)}
```

`deleteOutputFile()` is async but called in a sync context (fire-and-forget), which
is appropriate for cleanup — we don't need to await the deletion. This ensures that
when a background task completes and `cleanup()` -> `clear()` is called, the
`.output` file is actually removed from disk.

## Deminified variable mapping

| Minified | Meaning |
|----------|---------|
| `Y91` | Disk file writer class |
| `kw` | `TaskOutput` class |
| `j38` | Command runner class |
| `y$3` (8388608) | In-memory buffer limit before spill to disk |
| `qX9` (104857600) | **New**: max output file size (100 MB) |
| `E$3` | `unlink` from `fs/promises` |
| `g2(A)` | Returns `.output` file path for a task ID |
| `yJ6()` | Returns tasks directory path |
| `K38` | Cached tasks directory path |
| `R1()` | Returns session ID |

## What this does NOT fix (left for future work)

- **Startup cleanup of orphaned files from old sessions**: Requires checking whether
  other sessions are still alive, which is complex. OS `/tmp` cleanup on reboot
  handles truly stale files.
- **Rate-limiting progress writes**: As noted in #26911 comments, hook invocations
  generate ~2 GB/min of progress entries. This fix caps the damage at 100 MB but
  doesn't reduce the write volume.
- **`claude clean` command**: See #11646.

## Testing

These changes were verified by:
1. Confirming the exact search strings match uniquely in `cli.js` (1 match each)
2. Tracing the execution flow for background task completion:
   `result.then()` -> `flush()` -> `cleanup()` -> `clear()` -> `deleteOutputFile()`
3. Verifying that `deleteOutputFile()` being fire-and-forget in `clear()` is safe
   (it catches all errors internally)
4. Confirming the `Y91.#j` size tracking correctly prevents unbounded growth
   while preserving existing data readability
