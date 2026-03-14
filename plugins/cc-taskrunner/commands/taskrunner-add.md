---
description: Add a task to the autonomous queue
argument-hint: "<task description>"
allowed-tools: ["Bash", "Read", "Write", "AskUserQuestion"]
---

# cc-taskrunner — Add Task

Add a task to the cc-taskrunner queue for autonomous execution.

## Behavior

**If $ARGUMENTS is provided:**
Use it as the task title and prompt.

**If $ARGUMENTS is empty:**
Ask the user what task to add using AskUserQuestion with these fields:
- Title: short description of the task
- Prompt: detailed instructions (file paths, constraints, completion criteria)
- Authority: `auto_safe` (branch + PR) or `operator` (run on current branch)
- Max turns: 5-25 (default 25)

## Steps

1. Parse or gather task details.

2. Add the task:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/taskrunner.sh add "$TASK_TITLE"
   ```

   For more control (custom repo, prompt, authority, turns), write directly to the queue file:
   ```bash
   python3 -c "
   import json, uuid, datetime
   task = {
       'id': str(uuid.uuid4()),
       'title': '''$TITLE''',
       'repo': '$REPO',
       'prompt': '''$PROMPT''',
       'authority': '$AUTHORITY',
       'max_turns': $MAX_TURNS,
       'status': 'pending',
       'created_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
   }
   queue_file = '${CC_QUEUE_FILE:-queue.json}'
   try:
       with open(queue_file) as f:
           queue = json.load(f)
   except (FileNotFoundError, json.JSONDecodeError):
       queue = []
   queue.append(task)
   with open(queue_file, 'w') as f:
       json.dump(queue, f, indent=2)
   print(f'Added task {task[\"id\"][:8]}: {task[\"title\"]}')
   "
   ```

3. Show confirmation with task ID and suggest running `/taskrunner` to execute.

## Prompt Writing Tips

Good prompts are specific:
- Name file paths explicitly: "Read `src/services/quota.ts`"
- State completion criteria: "Tests should pass"
- Include context: each task is a fresh session
- Say what NOT to do: "Do NOT modify the database schema"
- End with: "Commit your work with a descriptive message"

## Authority Levels

| Authority | Branch? | PR? | Use for |
|-----------|---------|-----|---------|
| `operator` | No | No | Tasks that run on your current branch |
| `auto_safe` | Yes | Yes | Tests, docs, research, refactors |
