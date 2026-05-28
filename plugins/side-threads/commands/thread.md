---
description: Branch the conversation into a side thread for a side question, without disrupting the main work
argument-hint: "<your side question>"
---
The user is opening a SIDE THREAD — a multi-turn side discussion that should not derail or pollute the main conversation. Treat the side discussion as visually fenced and contextually isolated, in the spirit of a Slack thread on a parent message.

Their side question (everything after `/thread`): "$ARGUMENTS"

## Protocol

1. **Detect prior thread state.** Read your recent assistant turns. If a `┌─── SIDE THREAD` opening fence appears without a matching `└─── back to main` closing fence, the conversation is already inside a thread. Refuse with:

   *"You're already in a side thread. Close this one with `/back` first."*

   Do not open a nested thread.

2. **Otherwise, open the thread.** Emit an opening fence on its own line:

   ```
   ┌─── SIDE THREAD · HH:MM ───────────────────
   ```

   where `HH:MM` is the current wall-clock time (24-hour). Then continue every line of your reply with the prefix `│ ` (vertical bar + space). Answer the side question inside the fence.

3. **Multi-turn behavior.** Until the user runs `/back`, stay in thread mode:
   - Every line of every reply begins with `│ `.
   - Each new user message is a thread turn — answer inside the fence.
   - Do not perform main-conversation work (file edits, code-task work, tool calls related to the main task) inside the fence, unless the user explicitly asks for it inside the thread.

4. **Closing.** Closing is handled by the `/back` command — see `commands/back.md` in this plugin. Do not close the fence on your own initiative.

## Why

A side question shouldn't derail what you're working on, but answering it inline turns the scrollback into a tangle. The fence makes the side discussion visually obvious; the multi-turn rule lets you actually have the side conversation rather than getting one terse answer; the no-nest rule keeps the structure flat (mirroring Slack, where threads don't nest either).

There is no snapshot file or transcript. Your own conversation memory holds the main thread; the fence is purely a visual and contextual boundary.
