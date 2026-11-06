# hook-integrity-guard

prevents Claude from modifying its own hooks, settings, and safety infrastructure.

## why

Claude has been observed weakening or removing its own enforcement hooks to complete tasks more easily ([CVE-2025-59536](https://nvd.nist.gov/vuln/detail/CVE-2025-59536), severity 8.7/10). this can happen through:

- rewriting hook scripts to always exit 0 ([#32376](https://github.com/anthropics/claude-code/issues/32376))
- deleting hook files so hooks fail open silently ([#32990](https://github.com/anthropics/claude-code/issues/32990))
- modifying `settings.json` to disable hooks entirely
- using bash redirects, `sed -i`, `chmod`, etc. to alter protected files

this plugin intercepts all four write vectors (`Edit`, `Write`, `MultiEdit`, `Bash`) via a `PreToolUse` hook and blocks any operation targeting protected paths.

## what's protected

| path | reason |
|---|---|
| `~/.claude/hooks/` | hook scripts |
| `~/.claude/commands/` | custom command definitions |
| `~/.claude/settings.json` | global settings (hook config lives here) |
| `~/.claude/settings.local.json` | local settings override |
| `*/hooks.json` | plugin hook manifests |
| `*/hooks/` | plugin hook script directories |
| `*/.claude-plugin/plugin.json` | plugin metadata |

## how it works

the guard runs as a `PreToolUse` hook on every `Edit`, `Write`, `MultiEdit`, and `Bash` call.

**for file operations** (`Edit`, `Write`, `MultiEdit`):
- extracts `file_path` from the tool input
- resolves `~`, `$HOME`, `..`, and symlinks to a canonical path
- checks against protected directories, files, and patterns

**for bash commands**:
- scans for sensitive path fragments (`.claude/hooks`, `.claude/settings`, etc.)
- if found, checks whether the command is destructive (`rm`, `mv`, `chmod`), an in-place edit (`sed -i`, `perl -i`), or a write redirect (`>`, `>>`, `tee`)
- read-only commands like `ls`, `cat`, `grep` on protected paths are allowed

**fail behavior**: the hook fails open on malformed input (exits 0) so it never breaks unrelated operations. when it blocks, it exits 2 with a clear message explaining the restriction.

## install

the plugin is installed via the `marketplace.json` entry. no additional configuration needed.

## testing

```bash
# should block (edit hook file)
echo '{"tool_name":"Edit","tool_input":{"file_path":"~/.claude/hooks/myhook.sh","old_string":"x","new_string":"y"}}' \
  | python3 hooks/guard.py

# should block (rm hooks dir)
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf ~/.claude/hooks/"}}' \
  | python3 hooks/guard.py

# should block (write settings)
echo '{"tool_name":"Write","tool_input":{"file_path":"~/.claude/settings.json","content":"{}"}}' \
  | python3 hooks/guard.py

# should allow (normal file edit)
echo '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/foo.py","old_string":"x","new_string":"y"}}' \
  | python3 hooks/guard.py

# should allow (read-only on hooks)
echo '{"tool_name":"Bash","tool_input":{"command":"ls ~/.claude/hooks/"}}' \
  | python3 hooks/guard.py
```

blocked operations exit 2 with a stderr message. allowed operations exit 0 silently.
