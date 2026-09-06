# RTL (Hebrew / Arabic) Support in Claude CLI for VS Code

## Background
When running **Claude CLI** inside VS Code’s integrated terminal on Windows, 
right-to-left (RTL) text such as Hebrew or Arabic is displayed incorrectly:
- Characters appear reversed
- Alignment is broken
- The CLI becomes almost unusable in RTL languages

This happens because VS Code’s built-in terminal does not fully support 
bidirectional Unicode text.

After testing, we found a **working solution** by launching Claude inside 
**Git Bash (mintty)**, which has full Unicode + RTL rendering support.

---

## Step-by-Step Guide

### 1. Install Git Bash
- Install [Git for Windows](https://git-scm.com/download/win).
- This provides **Git Bash** (based on `mintty`).

### 2. Ensure `claude` is in PATH
Open Git Bash and run:
```bash
echo 'export PATH="$PATH:$APPDATA/npm"' >> ~/.bashrc
source ~/.bashrc
which claude
````

You should see a path to the `claude` executable.

### 3. Create a VS Code Task

In your project, add `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Claude (mintty external, RTL)",
      "type": "process",
      "command": "C:\\Program Files\\Git\\usr\\bin\\mintty.exe",
      "args": [
        "--title", "claude",
        "/usr/bin/bash",
        "-lc",
        "exec claude"
      ],
      "problemMatcher": []
    }
  ]
}
```

Now, from VS Code:

* Press **Ctrl+Shift+P → Tasks: Run Task → Claude (mintty external, RTL)**
* A new Git Bash window will open, running Claude with proper RTL support.

---

## Why This Works

* **mintty** supports Unicode bidirectional rendering (RTL).
* `bash -lc` loads environment variables and PATH, ensuring `claude` runs properly.
* `exec claude` replaces the shell process with Claude CLI → smooth experience.

---

## Benefits

* Fixes reversed/broken Hebrew/Arabic text.
* Enables proper use of Claude CLI in **Hebrew, Arabic, Persian**.
* Improves international developer experience significantly.

---

## Suggestions

* This guide could be linked from the official docs.
* Alternatively, native RTL support could be investigated in the integrated terminal.

