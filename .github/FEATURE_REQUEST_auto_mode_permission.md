# Feature Request: Add "Enable auto-mode" to permission request options

## Problem Statement

When auto mode gets turned off (for various reasons like encountering a tool that requires explicit permission), users face an avalanche of back-to-back permission requests. This makes it very difficult to get the 2 seconds of uninterrupted time needed to navigate to settings and re-enable auto mode.

Currently, users must either:
1. Manually approve each permission request one-by-one, or
2. Try to find a brief pause to navigate away and re-enable auto mode

This creates a frustrating user experience, especially when multiple permission requests queue up rapidly.

## Proposed Solution

Add "Enable auto-mode" as a new option in permission request dialogs, alongside the existing options like:
- Yes, allow
- Yes, allow for this session  
- Always allow
- No, deny

The new option would:
1. Approve the current permission request
2. Enable auto-mode for the remainder of the session
3. Allow subsequent permission requests to be handled automatically by the auto-mode classifier

### User Experience

When a permission prompt appears, users would see something like:

```
Claude wants to run: npm test

  > Yes, allow
    Yes, allow for this session
    Always allow
    Enable auto-mode (approve this and future requests automatically)
    No, deny
```

Selecting "Enable auto-mode" would:
1. Immediately approve the current pending request
2. Switch the session to auto-mode
3. Continue processing any queued requests using auto-mode

## Technical Context

Based on CHANGELOG analysis, the relevant code areas include:
- Permission prompt component (React/Ink-based UI)
- `setPermissionMode` function for changing modes
- Auto-mode classifier system
- Session state management for permission modes

The existing infrastructure supports:
- `value:"allow_all"` for session-wide permissions
- `value:"yes-accept-edits"` for auto-accepting edits
- Mode transitions via keyboard shortcuts (Shift+Tab in plan mode)

## Priority

High - This is a significant impact on productivity, especially for users who rely on auto-mode for their workflow.

## Feature Category

Interactive mode (TUI)

## Use Case Example

1. User is working with auto-mode enabled
2. A tool triggers that auto-mode can't classify (e.g., a sensitive operation)
3. Auto-mode gets disabled, prompting for explicit permission
4. User approves the operation
5. Multiple follow-up tool calls also need permission
6. Instead of approving each one, user selects "Enable auto-mode"
7. Current request is approved and auto-mode handles the rest

## Additional Context

- Slack thread: https://anthropic.slack.com/archives/C07VBSHV7EV/p1774978648891819?thread_ts=1774978537.133329&cid=C07VBSHV7EV
- Requested by Mark Christian
- Related to improving the permission request UX when auto-mode is interrupted
