---
description: Close the current side thread and resume the main conversation
---
The user is closing a SIDE THREAD opened earlier with `/thread`. Resume the main conversation.

## Protocol

1. **Detect prior thread state.** Read your recent assistant turns. If no `┌─── SIDE THREAD` opening fence appears (or every opening fence already has a matching `└─── back to main` closing fence), there is no thread to close. Reply briefly:

   *"No side thread is open."*

   Do nothing else.

2. **Otherwise, close the thread.** On a new line, write the closing fence — the first line is still inside the fence (so it has the `│ ` prefix), the second line is the closing fence character:

   ```
   │ >>> /back
   └─── back to main ───────────────────
   ```

3. **Resume the main conversation.** From the next line on, drop the `│ ` prefix. Give a brief one-line acknowledgement that you're back (e.g. *"Back to the main thread."*), then continue addressing whatever the user was working on before the thread opened. Your own conversation memory holds that context — pick up the main work naturally.

## Why

`/back` is the explicit signal that the side discussion is done. Without it, replies would stay inside the fence indefinitely; with it, the visual and contextual switch is unambiguous. The closing fence on its own line is the scroll-back marker that says "everything below here is main conversation again."
