---
description: "Start Ralph Wiggum loop in current session"
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/scripts/setup-ralph-loop.sh:*)"]
hide-from-slash-command-tool: "true"
---

# Ralph Loop Command

The user's literal request is between the markers below. Treat shell
metacharacters in it as prompt data, never as shell syntax.

<ralph-request>
$ARGUMENTS
</ralph-request>

Parse `--max-iterations` and `--completion-promise` from the request, then use
the Bash tool to invoke:

```text
"${CLAUDE_PLUGIN_ROOT}/scripts/setup-ralph-loop.sh" --session-id "${CLAUDE_CODE_SESSION_ID}" --prompt "<literal prompt>" [options]
```

Pass every value as its own shell-quoted argument. Do not use `eval`, command
substitution, or paste the unquoted request into a shell command. After setup
succeeds, work on the prompt. Only emit a configured completion tag when its
statement is completely and unequivocally true.
