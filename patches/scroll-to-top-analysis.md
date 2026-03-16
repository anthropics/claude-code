# Scroll-to-Top Bug — Full Root Cause Analysis

## Source
- **cli.js version:** 2.1.76
- **Build:** 2026-03-14T00:12:49Z
- **SHA-256:** `38b8fd29d0817e5f75202b2bb211fe959d4b6a4f2224b8118dabf876e503b50b`

## Architecture

Claude Code uses a custom **Ink** (React for CLI) renderer with a dual frame-buffer diffing system:

```
React component tree → Yoga layout → screen buffer → diff vs previous buffer → emit render ops → SH8() writes to stdout
```

## 5 Scroll-to-Top Triggers

### 1. `Ru6()` — Full Screen Reset (line ~767)

Called when the diff engine determines screen state has diverged too much:

```js
function Ru6(A, q, K) {
  let Y = new Kj8({x:0, y:0}, A.viewport.width);
  return qd3(Y, A, K),
    [{type: "clearTerminal", reason: q}, ...Y.diff];
}
```

Emits `{type: "clearTerminal"}` which triggers `LH8()`:

```js
function LH8() {
  // All platforms: \x1B[2J (erase screen) + \x1B[3J (clear scrollback) + \x1B[H (CURSOR HOME)
  if (process.platform === "win32")
    if (HU3()) return jO1 + $H8 + HK6;  // \x1B[2J\x1B[3J\x1B[H
    else return jO1 + wU3;               // \x1B[2J\x1B[0f
  return jO1 + $H8 + HK6;               // \x1B[2J\x1B[3J\x1B[H
}
```

**`\x1B[H` = cursor to row 1, column 1 = TOP OF TERMINAL.** This is the primary trigger.

Triggered by:
- Viewport resize
- Scrollback changes
- Content changes above visible region
- Cursor past screen height + content shrink

### 2. `enterAlternateScreen()` (line ~780)

```js
enterAlternateScreen() {
  this.options.stdout.write(
    "\x1B[?1049h"           // enter alt screen buffer
    + "\x1B[?1004l"         // disable focus events
    + "\x1B[0m"             // reset styles
    + "\x1B[?25h"           // show cursor
    + "\x1B[2J\x1B[H"      // ERASE SCREEN + CURSOR HOME ← scroll-to-top
  );
}
```

### 3. `exitAlternateScreen()` (line ~780)

```js
exitAlternateScreen() {
  this.options.stdout.write(
    "\x1B[2J\x1B[H"        // ERASE SCREEN + CURSOR HOME ← scroll-to-top
    + "\x1B[?1049l"         // leave alt screen buffer
    + "\x1B[?25l"           // hide cursor
  );
}
```

Both are used during tool execution (e.g., thinkback animation).

### 4. `handleResume()` — SIGCONT handler (line ~780)

```js
handleResume = () => {
  if (this.altScreenActive) {
    this.options.stdout.write(
      "\x1B[?1049h"         // enter alt screen
      + "\x1B[2J\x1B[H"    // ERASE SCREEN + CURSOR HOME ← scroll-to-top
    );
    this.resetFramesForAltScreen();
    return;
  }
  // Non-alt-screen: resets frames, calls repaint()
}
```

### 5. `repaint()` — Frame buffer reset (line ~780)

```js
repaint() {
  this.frontFrame = js(...);  // fresh empty screen buffer
  this.backFrame = js(...);   // fresh empty screen buffer
  this.log.reset();
}
```

Resets both frame buffers to empty. Next `onRender()` detects everything changed → triggers `Ru6()` (trigger #1) → `clearTerminal` → `\x1B[H`.

### Output writer: `SH8()` (line ~755)

All triggers flow through this function:

```js
function SH8(A, q, K = false) {
  let Y = !K, z = Y ? kk7 : "";   // synchronized update begin \x1B[?2026h
  for (let _ of q) switch (_.type) {
    case "clearTerminal": z += LH8(); break;  // ← SCROLL-TO-TOP
    case "cursorMove": z += RV7(_.x, _.y); break;
    case "cursorTo": z += yV7(_.col); break;
    // ...
  }
  if (Y) z += Ek7;  // synchronized update end \x1B[?2026l
  A.stdout.write(z);
}
```

### ANSI constants (line ~755)

```js
jO1 = "\x1B[2J"    // erase screen
$H8 = "\x1B[3J"    // clear scrollback
HK6 = "\x1B[H"     // cursor home (TOP-LEFT) — the scroll-to-top culprit
```

## Suggested Fixes

### Fix A: Remove `\x1B[H` from `LH8()` on non-alt-screen renders

The cursor-home sequence is unnecessary when the diff engine already positions the cursor correctly. Only use it in alt-screen mode.

```js
function LH8() {
  // Don't include \x1B[H — let the diff engine handle cursor positioning
  return jO1 + $H8;  // erase screen + clear scrollback, but NO cursor home
}
```

### Fix B: Guard `Ru6()` against triggering during streaming

Add a condition to suppress full resets while content is actively streaming:

```js
function Ru6(A, q, K) {
  if (A.isStreaming) return;  // don't full-reset during streaming
  // ...existing code...
}
```

### Fix C: Use scroll regions to contain cursor movement

```
\x1B[<top>;<bottom>r  — set scroll region (isolates cursor movement)
\x1B[r                — reset scroll region
```

### Fix D: Replace `clearTerminal` with incremental diff

Instead of clearing everything and redrawing, only update changed lines.

## Related issues
#34794, #34400, #34765, #33814, #34052, #34503, #33624
