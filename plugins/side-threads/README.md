# Side Threads

Branch a Claude Code conversation into a multi-turn side discussion — like a Slack thread on a parent message — without derailing the main work.

## Commands

| Command | Effect |
|---|---|
| `/thread <question>` | Open a side thread on the side question. Visual fence opens; multi-turn discussion happens inside. |
| `/back` | Close the current side thread and resume the main conversation. |

Threads are **flat** — running `/thread` while already inside a thread is refused. (Mirrors Slack: threads don't nest.)

## What it looks like

```
... main conversation ...

>>> /thread what's the difference between mutex and semaphore?

┌─── SIDE THREAD · 14:32 ───────────────────
│ A mutex is binary, owned by one thread at a time; a semaphore is
│ a counter that lets up to N threads in. So a mutex is the right
│ tool for protecting a single critical section; a semaphore models
│ a pool of N resources.
│
│ >>> follow-up: when would I prefer one over the other?
│
│ Use a mutex when there's exactly one shared thing... [continues]
│
│ >>> /back
└─── back to main ───────────────────

Back to the main thread. Where we were: ...
```

## How it works

There is no persistent state — no snapshot file, no transcript log. The plugin is two command prompts that tell the model to draw the fence, stay inside it for follow-up turns, and resume when `/back` is invoked. Claude's own conversation memory holds the main-thread context, so resume is just "continue what we were doing."

This is **deliberately minimal**. A more elaborate version with persisted snapshots and per-domain extensions exists in the `ai-tutor` skill ([prior art](https://github.com/yihao-liang/AI-tutor-skill)), which proved the conversation-branching pattern in practice. This plugin is the stripped-down generalization usable in any Claude Code session.

## Install

After installing this marketplace:

```
/plugin install side-threads@claude-code-plugins
```

Then start a conversation and try `/thread <anything>` followed by `/back`.

## Limitations

- **Detection is heuristic.** The model decides whether you're inside a thread by reading recent assistant turns for a `┌───` without a matching `└───`. If conversation history is compacted away or the fence lines are filtered out by a custom output style, detection may misfire. If that happens to you in practice, please open an issue.
- **One thread at a time.** No nested threads, no parallel side discussions.
- **One session at a time.** If a session ends inside a thread, the next session starts on the main conversation. Nothing is persisted.

## License

MIT.
