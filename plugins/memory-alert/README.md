# memory-alert

A Claude Code plugin that monitors **Claude Code's own process memory** and alerts you in the terminal when it exceeds a configurable threshold. Works on **macOS** and **Linux**.

## How it works

After every tool call, a lightweight shell script sums the RSS (resident set size) of all running `claude` processes:

- **macOS / Linux**: uses `ps -eo rss,command` to find and sum Claude process memory

If the combined memory exceeds the threshold, a warning appears in your Claude Code terminal:

```
[MEMORY ALERT] Claude Code memory usage: 5.2GB (threshold: 5GB) — consider closing idle sessions
```

The alert is non-blocking — it never interrupts your workflow.

## Configuration

Set the threshold (in GB) via environment variable:

```bash
# In your shell profile (~/.zshrc, ~/.bashrc, etc.)
export MEMORY_ALERT_THRESHOLD_GB=8
```

Default threshold is **5GB**.

## Plugin structure

```
memory-alert/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       └── memory-alert.sh
└── README.md
```
