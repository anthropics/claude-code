# Bug Report: /hooks command always selects PreToolUse on first attempt

## Summary

When using the `/hooks` command to create a new hook, the hook type selector always selects `PreToolUse` on the first attempt, regardless of which option the user scrolls to and selects with Enter. The selection works correctly on subsequent attempts after pressing Escape.

## Steps to Reproduce

1. Open Claude Code
2. Type `/hooks` to open the hooks management interface
3. Navigate to create a new hook
4. When the hook type selector appears (showing PreToolUse, PostToolUse, Stop, UserPromptSubmit, etc.), scroll down using arrow keys to select a different hook type (e.g., `PostToolUse`)
5. Press Enter to confirm selection
6. **Bug:** `PreToolUse` is selected instead of the highlighted option

## Workaround

1. Press Escape to cancel the selection
2. Re-enter the hook type selector
3. Scroll to desired hook type
4. Press Enter
5. **Result:** Correct hook type is now selected

## Expected Behavior

The hook type selector should select the option that is visually highlighted when the user presses Enter, on both first and subsequent attempts.

## Root Cause Analysis

This appears to be a **state synchronization issue** where:

1. On first render of the hook type selector, the internal selected index is initialized to `0` (PreToolUse is the first item)
2. The visual highlight updates correctly when scrolling with arrow keys (the user sees a different item highlighted)
3. However, when pressing Enter, the handler reads from the internal state (which may still be `0`) rather than the current highlighted position
4. After pressing Escape and re-opening the selector, the state is properly synchronized

### Potential Code Areas

Based on similar issues and the CHANGELOG history, the fix likely involves one of these patterns:

1. **Initial state not synced**: The selection state may need to be initialized differently, or there's a race condition between render and state initialization

2. **Event handler reading stale state**: The Enter key handler might be using a captured/stale reference to the selection index rather than the current value

3. **Scroll handler not updating state**: The arrow key navigation might only be updating the visual highlight without updating the underlying state that Enter reads from

### Similar Fixed Issues

- **CHANGELOG v2.0.35**: "Fixed menu navigation getting stuck on items with empty string or other falsy values (e.g., in the `/hooks` menu)"
- **CHANGELOG v0.2.69**: "Fixed UI glitches with improved Select component behavior"
- **Issue #6674**: Hook Navigation Infinite Loop on Duplicate Entries (related Select component issue)

## Environment

- Reported on: Multiple environments
- Claude Code Version: Current latest

## Slack Thread Reference

https://anthropic.slack.com/archives/C07VBSHV7EV/p1766159670734839?thread_ts=1766158844.979909&cid=C07VBSHV7EV

## Labels

`bug`, `hooks`, `ui`, `select-component`
