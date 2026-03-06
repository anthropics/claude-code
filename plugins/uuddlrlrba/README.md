# uuddlrlrba

⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️

Clawd dances. +30 lives.

## Install

```
/plugin install uuddlrlrba@claude-code-plugins
```

## Use

Any of these in a message:

- `/uuddlrlrba`
- `uuddlrlrba` anywhere in a message
- `⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️` anywhere in a message

## How

`UserPromptSubmit` hook detects the trigger, renders the
Clawd GIF frame-by-frame as truecolor half-block unicode on the alt screen
buffer, then returns cleanly. Ink's buffer is never touched.

Requires `python3` + `Pillow` on PATH. Both ship with macOS.
