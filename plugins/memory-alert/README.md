# memory-alert

A Claude Code plugin that monitors system memory usage and alerts you in the terminal when it exceeds a configurable threshold. Works on **macOS** and **Linux**.

## How it works

After every tool call, a lightweight shell script checks system memory usage:

- **macOS**: reads `vm_stat` (active + wired + compressed pages)
- **Linux**: reads `/proc/meminfo` (total - available)

If usage exceeds the threshold, a warning appears in your Claude Code terminal:

```
[MEMORY ALERT] System memory usage: 8.2GB / 16GB (threshold: 5GB)
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
