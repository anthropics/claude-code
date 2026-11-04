---
name: clean
description: Remove old sprint directories with safety checks and archiving options
argument-hint: "[--all | --keep-latest | --keep N]"
---

# Clean Sprints Command

You are cleaning up old sprint directories.

## IMPORTANT WARNING

**Sprint directories contain valuable artifacts:**
- Specification files (api-contract.md, backend-specs.md, etc.)
- Implementation reports from agents
- Status summaries
- Test reports

**The user is responsible for:**
- Creating checkpoints (git commits) before cleanup
- Backing up important sprint data
- Deciding which sprints to keep

## Workflow

### Step 1: List Existing Sprints

```bash
ls -la .claude/sprint/
```

Show the user:
- Sprint directories found
- Last modified dates
- Size of each directory

### Step 2: Confirm Action

Ask the user which sprints to clean:

**Options:**
1. **Clean all** - Remove all sprint directories
2. **Keep latest** - Remove all except the most recent sprint
3. **Keep N latest** - Remove all except the N most recent sprints
4. **Select specific** - Let user specify which to remove
5. **Cancel** - Do nothing

### Step 3: Safety Check

Before deletion, verify:

```bash
# Check for uncommitted changes
git status --porcelain .claude/sprint/
```

If there are uncommitted changes, WARN the user:

```
WARNING: You have uncommitted changes in sprint directories.

Uncommitted files:
[list files]

Recommendation: Commit your changes before cleaning.

git add .claude/
git commit -m "Checkpoint before cleanup"

Continue anyway? (y/N)
```

### Step 4: Execute Cleanup

Based on user choice:

**Clean all:**
```bash
rm -rf .claude/sprint/*/
```

**Keep latest:**
```bash
LATEST=$(ls -d .claude/sprint/*/ | sort -V | tail -1)
find .claude/sprint/ -mindepth 1 -maxdepth 1 -type d ! -path "$LATEST" -exec rm -rf {} +
```

**Keep N latest:**
```bash
ls -d .claude/sprint/*/ | sort -V | head -n -[N] | xargs rm -rf
```

**Select specific:**
```bash
rm -rf .claude/sprint/[selected]/
```

### Step 5: Report

After cleanup:

```
Cleanup complete.

Removed:
- .claude/sprint/1/
- .claude/sprint/2/
- ...

Remaining:
- .claude/sprint/[N]/

Tip: Create a checkpoint now:
git add -A && git commit -m "Cleanup old iterations"
```

## Quick Mode

For quick cleanup without prompts:

`/sprint:clean --all` - Remove all sprints
`/sprint:clean --keep-latest` - Keep only the latest
`/sprint:clean --keep 3` - Keep the 3 most recent

## Archive Option

Instead of deleting, offer to archive:

```bash
# Archive sprints before deletion
tar -czf .claude/sprint-archive-$(date +%Y%m%d).tar.gz .claude/sprint/
```

Then proceed with deletion.

## User Responsibility Notice

Always remind the user:

```
REMINDER: You are responsible for checkpointing your work.

Before cleaning, consider:
1. git add .claude/ && git commit -m "Checkpoint"
2. Push to remote if you want off-machine backup
3. Keep sprint specs if you might need to reference them

Sprint artifacts are valuable documentation of:
- Architectural decisions
- API contracts
- Implementation reports
- Test results
```
