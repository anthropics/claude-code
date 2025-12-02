# Fix Proposal for Issue #11391: Terminal Focus Event Escape Sequences

## Problem Summary

Terminal focus events (DECSET 1004) are causing escape sequences like `[I` (focus in) and `[O` (focus out) to appear as literal text in Claude Code's input when users switch between terminal panes or windows.

**Affected terminals:** WezTerm, Ghostty, Alacritty with tmux, Kitty, Windows Terminal, iTerm2

**Impact:** Degrades user experience by inserting unwanted characters into prompts, particularly in multi-pane terminal workflows.

## Root Cause

Node.js's `readline` module doesn't automatically filter DECSET 1004 focus event sequences:
- `\x1b[I` - Focus In event (terminal gains focus)
- `\x1b[O` - Focus Out event (terminal loses focus)

These sequences are sent by terminal emulators when:
1. Focus events are enabled (DECSET 1004 is active)
2. The user switches between terminal panes/windows
3. The terminal application gains/loses focus

The sequences are processed as regular input by readline, causing them to appear in the input buffer.

## Proposed Solutions

### Solution 1: Filter Focus Events from Input Stream (Recommended)

**Approach:** Intercept and filter focus event escape sequences before they reach the readline interface.

**Implementation:**
```typescript
// Filter regex
const FOCUS_EVENT_REGEX = /\x1b\[(?:0)?\[?[IO]\]?/g;

// Apply to readline input stream
input.emit = function (event: string, ...args: any[]) {
  if (event === 'data') {
    const chunk = args[0];
    let data = typeof chunk === 'string' ? chunk : chunk.toString();

    // Filter focus events
    data = data.replace(FOCUS_EVENT_REGEX, '');

    if (data.length > 0) {
      return originalEmit(event, data, ...args.slice(1));
    }
    return false; // Don't emit if everything was filtered
  }
  return originalEmit(event, ...args);
};
```

**Advantages:**
- Doesn't affect other tools that may rely on focus events
- Maintains compatibility with terminal multiplexers
- No visible user-facing changes required
- Can be extended to filter other problematic sequences (mouse events, etc.)

**Location to apply:** Where readline interface is initialized for the REPL/CLI input.

### Solution 2: Disable Focus Events on Startup

**Approach:** Send the DECSET 1004 disable sequence when Claude Code starts.

**Implementation:**
```typescript
// On startup
if (process.stdout.isTTY) {
  process.stdout.write('\x1b[?1004l'); // Disable focus events
}

// On exit (cleanup)
process.stdout.write('\x1b[?1004h'); // Re-enable focus events
```

**Advantages:**
- Simple, clean solution
- Prevents the problem at the source
- Minimal code changes

**Disadvantages:**
- May affect other tools if not properly cleaned up on exit
- Requires proper signal handling (SIGINT, SIGTERM, etc.)

### Solution 3: Hybrid Approach (Best)

Combine both solutions:

1. **Disable focus events on startup** to prevent most issues
2. **Filter remaining sequences** as a backup for edge cases
3. **Re-enable on exit** to maintain clean terminal state

```typescript
// Startup
export function initializeTerminal() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?1004l'); // Disable focus events
  }

  // Also install filter as backup
  applyFocusEventFilter(readlineInterface);

  // Ensure cleanup on exit
  const cleanup = () => {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[?1004h'); // Re-enable
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}
```

## Additional Sequences to Consider Filtering

While fixing focus events, consider also filtering these commonly problematic sequences:

1. **Mouse tracking events:** `\x1b[<...M`
2. **Bracketed paste markers:** `\x1b[200~` and `\x1b[201~`
3. **Cursor position reports:** `\x1b[...R`

These can all leak into input under certain terminal configurations.

## Testing Strategy

### Manual Testing

1. **WezTerm/Kitty with splits:**
   ```bash
   # Open claude in a split pane
   # Create additional panes
   # Switch between panes rapidly
   # Verify no [I or [O appears in input
   ```

2. **Tmux environment:**
   ```bash
   # In tmux session
   tmux set -g focus-events on  # Ensure focus events are enabled
   # Run claude
   # Switch tmux panes
   # Verify input is clean
   ```

3. **External editor mode (Ctrl+G):**
   ```bash
   # Start claude
   # Press Ctrl+G to enter external editor
   # Exit editor
   # Switch terminal focus
   # Verify no escape sequences appear
   ```

### Automated Testing

Create a test that:
1. Simulates focus event sequences being sent to stdin
2. Verifies they don't appear in the readline buffer
3. Ensures normal input still works correctly

```typescript
describe('Focus Event Filtering', () => {
  it('should filter focus in events', () => {
    const input = '\x1b[IHello World';
    const filtered = input.replace(FOCUS_EVENT_REGEX, '');
    expect(filtered).toBe('Hello World');
  });

  it('should filter focus out events', () => {
    const input = 'Test\x1b[O Input';
    const filtered = input.replace(FOCUS_EVENT_REGEX, '');
    expect(filtered).toBe('Test Input');
  });

  it('should handle Kitty/tmux variations', () => {
    const input = 'Start\x1b[0[I]End';
    const filtered = input.replace(FOCUS_EVENT_REGEX, '');
    expect(filtered).toBe('StartEnd');
  });
});
```

## Implementation Checklist

- [ ] Add focus event filtering to readline input stream
- [ ] Disable DECSET 1004 on CLI startup
- [ ] Re-enable DECSET 1004 on clean exit
- [ ] Handle SIGINT/SIGTERM for proper cleanup
- [ ] Add optional environment-based detection (tmux, WezTerm, etc.)
- [ ] Consider filtering other problematic sequences (mouse, paste)
- [ ] Add automated tests
- [ ] Test manually in affected terminals
- [ ] Update changelog/release notes

## Related Issues

This fix would also address or improve:
- #11433 - TUI apps breaking terminal state
- #11702 - Hyprland key bindings adding text
- #11952 - Mouse reporting sequences
- #12242 - Option+N keybinding escape sequences
- #12626 - iTerm2 auto-input with escape sequences

## Files to Modify

Based on the npm package structure, the changes should be made in:

1. **Main CLI initialization** - Where the readline interface is created
2. **Input handling module** - Where stdin is processed
3. **Terminal setup/cleanup** - Where terminal state is managed

Since Claude Code is distributed as a compiled bundle (`cli.js`), the source files would be:
- Terminal initialization logic (likely in a `terminal.ts` or `cli.ts` file)
- Readline wrapper/setup code
- Process signal handlers

## References

- [DECSET 1004 Specification](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-_-ordered-by-the-final-character_s_)
- [Node.js Readline Documentation](https://nodejs.org/api/readline.html)
- [Terminal Escape Sequences](https://en.wikipedia.org/wiki/ANSI_escape_code)

## Author

This fix proposal addresses issue #11391 and related terminal escape sequence issues.
