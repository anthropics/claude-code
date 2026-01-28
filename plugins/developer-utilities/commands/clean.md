---
description: Clean up Claude Code cache, logs, and temporary files to free disk space
---

## Your Task

**Analyze** accumulated Claude Code cache and logs, then **ask the user** before cleaning anything.

**IMPORTANT:**
- Steps 1-4: Analysis only (read-only, safe)
- Step 5: Cleaning (requires user confirmation)
- Step 6: Deep cleaning (requires explicit user confirmation)

**Do NOT run Step 5 or Step 6 without asking the user first!**

## Context

Claude Code accumulates data over time:
- Debug logs (can reach 3GB+)
- Old proxy databases (1GB+ per version)
- Proxy session files (171+ log files, 30MB)
- Project caches (2GB+)
- File history (50MB+)

This command helps identify and clean these files safely.

## Commands to Execute

### Step 1: Show Current Disk Usage

First, check current ~/.claude directory size:

```bash
du -sh ~/.claude 2>/dev/null || echo "~/.claude directory not found"
```

### Step 2: Analyze What's Taking Space

Show breakdown of ~/.claude contents:

```bash
du -sh ~/.claude/* 2>/dev/null | sort -hr
```

### Step 3: Identify What Can Be Cleaned

Check for cleanable items:

```bash
echo "=== Analyzing Cleanable Items ==="
```

```bash
echo "" && echo "Debug logs older than 7 days:" && find ~/.claude/debug -name "*.log" -mtime +7 2>/dev/null | wc -l
```

```bash
echo "" && echo "Shell snapshots older than 7 days:" && find ~/.claude/shell-snapshots -mtime +7 2>/dev/null | wc -l
```

```bash
echo "" && echo "File history older than 30 days:" && find ~/.claude/file-history -mtime +30 2>/dev/null | wc -l
```

```bash
echo "" && echo "Temporary files:" && du -sh ~/.claude/tmp 2>/dev/null || echo "No temp directory"
```

### Step 4: Calculate Potential Space Savings

Show how much space would be freed:

```bash
echo "=== Potential Space to Free ===" && echo ""
```

```bash
echo "From old debug logs:" && find ~/.claude/debug -name "*.log" -mtime +7 -exec du -sk {} + 2>/dev/null | awk '{sum+=$1} END {if(sum) print sum/1024 " MB"; else print "0 MB"}'
```

```bash
echo "" && echo "From old shell snapshots:" && find ~/.claude/shell-snapshots -mtime +7 -exec du -sk {} + 2>/dev/null | awk '{sum+=$1} END {if(sum) print sum/1024 " MB"; else print "0 MB"}'
```

```bash
echo "" && echo "From old file history:" && find ~/.claude/file-history -mtime +30 -exec du -sk {} + 2>/dev/null | awk '{sum+=$1} END {if(sum) print sum/1024 " MB"; else print "0 MB"}'
```

## Analysis Complete

**STOP HERE and show the user the analysis results above.**

**Do NOT proceed to Step 5 or Step 6 without explicit user confirmation.**

Ask the user: "Would you like to proceed with regular clean (removes old logs/snapshots/temp files)?"

---

### Step 5: Regular Clean (Only After User Says YES)

**⚠️ ONLY execute these commands if the user explicitly confirmed above.**

**Clean debug logs older than 7 days:**
```bash
find ~/.claude/debug -name "*.log" -mtime +7 -delete 2>/dev/null && echo "✓ Cleaned old debug logs"
```

**Clean shell snapshots older than 7 days:**
```bash
find ~/.claude/shell-snapshots -mtime +7 -delete 2>/dev/null && echo "✓ Cleaned old shell snapshots"
```

**Clean file history older than 30 days:**
```bash
find ~/.claude/file-history -mtime +30 -delete 2>/dev/null && echo "✓ Cleaned old file history"
```

**Clean temporary files:**
```bash
rm -rf ~/.claude/tmp/* 2>/dev/null && echo "✓ Cleaned temporary files"
```

**Show new size after regular clean:**
```bash
echo "" && echo "=== After Regular Clean ===" && du -sh ~/.claude 2>/dev/null
```

---

### Step 6: Deep Clean (Only After Explicit User Confirmation)

**⚠️ WARNING: Deep clean removes project caches and may slow down first project load.**

**STOP and ask the user explicitly:** "Do you want to proceed with DEEP clean? This removes project caches and command history. (yes/no)"

**⚠️ ONLY execute these commands if the user explicitly says YES to deep clean.**

**Remove all project caches:**
```bash
du -sh ~/.claude/projects 2>/dev/null && echo "" && echo "Removing project caches..." && rm -rf ~/.claude/projects/* 2>/dev/null && echo "✓ Cleaned project caches"
```

**Remove old proxy databases (keep latest only):**
```bash
ls -t ~/.claude/local/*.db 2>/dev/null | tail -n +2 | xargs -r du -sk 2>/dev/null | awk '{sum+=$1} END {if(sum) print "Freeing " sum/1024 " MB from old proxy DBs"}'
```

```bash
ls -t ~/.claude/local/*.db 2>/dev/null | tail -n +2 | xargs -r rm 2>/dev/null && echo "✓ Cleaned old proxy databases"
```

**Clear command history:**
```bash
du -sh ~/.claude/history.jsonl 2>/dev/null && echo "" && > ~/.claude/history.jsonl && echo "✓ Cleared command history"
```

**Show final size after deep clean:**
```bash
echo "" && echo "=== After Deep Clean ===" && du -sh ~/.claude 2>/dev/null
```

## Expected Behavior

After running this command:

1. **Analysis phase** (Steps 1-4): Read-only, shows:
   - Current disk usage
   - Breakdown by directory
   - What can be cleaned
   - Potential space savings

2. **Regular clean** (Step 5): Removes (with user confirmation):
   - Debug logs older than 7 days
   - Shell snapshots older than 7 days
   - File history older than 30 days
   - Temporary files

3. **Deep clean** (Step 6): Removes (with explicit user confirmation):
   - All project caches
   - Old proxy databases (keeps latest)
   - Command history

## Safety Notes

- Analysis steps (1-4) are 100% read-only
- Regular clean is safe - only removes old/temporary files
- Deep clean requires explicit confirmation - removes caches
- Always shows disk usage before and after
- If ~/.claude doesn't exist, reports this and exits
- Uses `find -delete` which is safer than `rm -rf` for specific patterns
